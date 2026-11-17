import { Router } from 'express';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { adminLimiter } from '../middleware/rateLimit.js';
import { ContentBlock } from '../models/ContentBlock.js';
import { Partner } from '../models/Partner.js';
import { Revision } from '../models/Revision.js';
import { invalidateContentCache } from '../services/contentService.js';
import { record, snapshot } from '../services/historyService.js';
import { exportData, importData } from '../services/importService.js';
import { COLLECTIONS } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BLOCK_KEYS } from '../utils/blocks.js';
import { HttpError } from '../utils/httpError.js';
import { parseBlock } from '../utils/validators.js';
import { crudRouter, labelOf } from './crud.js';
import uploadsRouter from './uploads.js';

const router = Router();
const ID_RE = /^[a-f0-9]{24}$/i;
const notTrashed = { deletedAt: null };
const inTrash = () => ({ deletedAt: mongoose.trusted({ $ne: null }) });

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.use(requireAuth, adminLimiter);

// Réglages utiles à l'interface (aperçu des images du site, liens vers le site public).
router.get('/config', (_req, res) => {
  res.json({ siteOrigin: env.origins[0] || 'https://groupendoyeafrica.com', cloudinary: Boolean(env.cloudinary.cloudName) });
});

// Tableau de bord : compteurs par rubrique, corbeille et dernières modifications.
router.get(
  '/overview',
  asyncHandler(async (_req, res) => {
    const counts = {};
    const trash = {};
    for (const [name, Model] of Object.entries(COLLECTIONS)) {
      [counts[name], trash[name]] = await Promise.all([Model.countDocuments(notTrashed), Model.countDocuments(inTrash())]);
    }
    const [partnersWorld, partnersAfrica, blocks, recent] = await Promise.all([
      Partner.countDocuments({ ...notTrashed, kind: 'world' }),
      Partner.countDocuments({ ...notTrashed, kind: 'africa' }),
      ContentBlock.countDocuments(),
      Revision.find().select('-before').sort({ createdAt: -1 }).limit(10),
    ]);
    res.json({ ...counts, partnersWorld, partnersAfrica, blocks, trash, recent });
  })
);

// ───────── Blocs de contenu (statistiques, coordonnées, textes de présentation…) ─────────

router.get(
  '/blocks',
  asyncHandler(async (_req, res) => {
    const docs = await ContentBlock.find().select('key updatedAt');
    res.json(docs.map((d) => ({ key: d.key, updatedAt: d.updatedAt })));
  })
);

router.get(
  '/blocks/:key',
  asyncHandler(async (req, res) => {
    if (!BLOCK_KEYS.includes(req.params.key)) throw new HttpError(404, 'Bloc inconnu.');
    const doc = await ContentBlock.findOne({ key: req.params.key });
    if (!doc) throw new HttpError(404, 'Bloc non initialisé : redémarrez le service pour lancer la synchronisation.');
    res.json({ key: doc.key, data: doc.data, updatedAt: doc.updatedAt });
  })
);

router.put(
  '/blocks/:key',
  asyncHandler(async (req, res) => {
    const data = parseBlock(req.params.key, req.body);
    let doc = await ContentBlock.findOne({ key: req.params.key });
    const before = doc ? snapshot(doc).data : null;
    if (!doc) doc = new ContentBlock({ key: req.params.key });
    doc.data = data;
    doc.markModified('data');
    await doc.save();
    await record({ target: `block:${doc.key}`, action: 'update', label: doc.key, before, by: req.admin.email });
    invalidateContentCache();
    res.json({ key: doc.key, data: doc.data, updatedAt: doc.updatedAt });
  })
);

// ───────── Historique : chaque version précédente peut être rétablie ─────────

router.get(
  '/history',
  asyncHandler(async (req, res) => {
    const filter = {};
    const target = String(req.query.target || '');
    const docId = String(req.query.docId || '');
    if (target && /^[a-z]+(:[A-Za-z]+)?$/.test(target)) filter.target = target;
    if (docId && ID_RE.test(docId)) filter.docId = docId;
    const page = Math.max(1, Math.min(200, Number(req.query.page) || 1));
    const items = await Revision.find(filter)
      .select('-before')
      .sort({ createdAt: -1 })
      .skip((page - 1) * 50)
      .limit(50);
    res.json({ page, items });
  })
);

router.get(
  '/history/:id',
  asyncHandler(async (req, res) => {
    if (!ID_RE.test(req.params.id)) throw new HttpError(400, 'Identifiant invalide.');
    const rev = await Revision.findById(req.params.id);
    if (!rev) throw new HttpError(404, 'Version introuvable.');
    res.json(rev);
  })
);

const REVERT_SKIP = new Set(['_id', 'id', '__v', 'createdAt', 'updatedAt', 'seedKey']);

// Rétablit l'état enregistré AVANT la modification choisie (l'état actuel est lui-même gardé dans l'historique).
router.post(
  '/history/:id/revert',
  asyncHandler(async (req, res) => {
    if (!ID_RE.test(req.params.id)) throw new HttpError(400, 'Identifiant invalide.');
    const rev = await Revision.findById(req.params.id);
    if (!rev) throw new HttpError(404, 'Version introuvable.');
    const by = req.admin.email;

    if (rev.target.startsWith('block:')) {
      const key = rev.target.slice(6);
      if (!rev.before) throw new HttpError(400, 'Aucune version antérieure pour ce bloc.');
      const doc = await ContentBlock.findOne({ key });
      if (!doc) throw new HttpError(404, 'Bloc introuvable.');
      await record({ target: rev.target, action: 'revert', label: key, before: snapshot(doc).data, by });
      doc.data = rev.before;
      doc.markModified('data');
      await doc.save();
      invalidateContentCache();
      return res.json({ ok: true });
    }

    const Model = COLLECTIONS[rev.target];
    if (!Model) throw new HttpError(400, 'Version non rétablissable.');

    if (rev.action === 'reorder') {
      const orders = Array.isArray(rev.before) ? rev.before.filter((o) => ID_RE.test(String(o?.id)) && Number.isInteger(o.order)) : [];
      const current = await Model.find({ _id: mongoose.trusted({ $in: orders.map((o) => o.id) }) }).select('order');
      await record({ target: rev.target, action: 'revert', label: 'Ordre', before: current.map((d) => ({ id: String(d._id), order: d.order })), by });
      await Model.bulkWrite(orders.map((o) => ({ updateOne: { filter: { _id: o.id }, update: { $set: { order: o.order } } } })));
      invalidateContentCache();
      return res.json({ ok: true });
    }

    if (!rev.docId || !ID_RE.test(rev.docId)) throw new HttpError(400, 'Version non rétablissable.');
    let doc = await Model.findById(rev.docId);

    // Annuler une création = mettre l'élément à la corbeille (jamais d'effacement).
    if (!rev.before) {
      if (!doc) throw new HttpError(404, 'Élément introuvable.');
      await record({ target: rev.target, docId: doc._id, action: 'revert', label: labelOf(doc), before: snapshot(doc), by });
      doc.deletedAt = doc.deletedAt || new Date();
      await doc.save();
      invalidateContentCache();
      return res.json({ ok: true, doc });
    }

    const previous = Object.fromEntries(Object.entries(rev.before).filter(([k]) => !REVERT_SKIP.has(k)));
    if (doc) {
      await record({ target: rev.target, docId: doc._id, action: 'revert', label: labelOf(doc), before: snapshot(doc), by });
      for (const path of Object.keys(Model.schema.paths)) {
        if (REVERT_SKIP.has(path) || path.includes('.')) continue;
        doc.set(path, Object.prototype.hasOwnProperty.call(previous, path) ? previous[path] : undefined);
      }
    } else {
      doc = new Model({ ...previous, _id: new mongoose.Types.ObjectId(rev.docId) });
      await record({ target: rev.target, docId: rev.docId, action: 'revert', label: labelOf(doc), before: null, by });
    }
    await doc.save();
    invalidateContentCache();
    return res.json({ ok: true, doc });
  })
);

// ───────── Sauvegarde et import ─────────

router.get(
  '/export',
  asyncHandler(async (_req, res) => {
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    res.set('Content-Disposition', `attachment; filename="gnah-sauvegarde-${stamp}.json"`);
    res.json(await exportData());
  })
);

router.post(
  '/import',
  asyncHandler(async (req, res) => {
    res.json(await importData(req.body, req.admin.email));
  })
);

// ───────── Collections ─────────

for (const name of Object.keys(COLLECTIONS)) router.use(`/${name}`, crudRouter(COLLECTIONS[name], name));
router.use('/uploads', uploadsRouter);

export default router;

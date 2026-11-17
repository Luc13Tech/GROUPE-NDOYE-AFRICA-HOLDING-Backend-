import { Router } from 'express';
import mongoose from 'mongoose';
import { invalidateContentCache } from '../services/contentService.js';
import { record, snapshot } from '../services/historyService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import { parseActive, parseReorder } from '../utils/validators.js';

const SYSTEM_FIELDS = new Set(['_id', '__v', 'createdAt', 'updatedAt', 'deletedAt', 'seedKey']);
const ID_RE = /^[a-f0-9]{24}$/i;

/** Libellé lisible d'un élément pour l'historique. */
export function labelOf(doc) {
  if (!doc) return '';
  const fr = doc.fr;
  const candidates = [
    doc.name,
    doc.title && typeof doc.title === 'object' ? doc.title.fr : doc.title,
    fr && typeof fr === 'object' ? fr.title || fr.name || fr.country : fr,
    doc.code,
  ];
  return String(candidates.find((c) => typeof c === 'string' && c.trim()) || '').slice(0, 200);
}

/**
 * Gestion d'une collection : liste, création, lecture, modification, activation, ordre,
 * mise en corbeille et restauration. AUCUNE suppression définitive : un élément « supprimé »
 * est seulement masqué (deletedAt) et chaque changement est copié dans l'historique.
 * Les images Cloudinary ne sont jamais effacées automatiquement.
 */
export function crudRouter(Model, target) {
  const router = Router();
  const fields = Object.keys(Model.schema.paths).filter((p) => !SYSTEM_FIELDS.has(p) && !p.includes('.'));

  const pick = (body) => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Corps de requête invalide.');
    const out = {};
    for (const f of fields) if (Object.prototype.hasOwnProperty.call(body, f)) out[f] = body[f];
    return out;
  };

  const find = async (id) => {
    const doc = await Model.findById(id);
    if (!doc) throw new HttpError(404, 'Élément introuvable.');
    return doc;
  };

  router.param('id', (_req, _res, next, id) =>
    mongoose.isValidObjectId(id) && ID_RE.test(id) ? next() : next(new HttpError(400, 'Identifiant invalide.'))
  );

  // ?trash=1 → éléments en corbeille ; sinon éléments actifs et masqués (hors corbeille).
  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const inTrash = req.query.trash === '1';
      // mongoose.trusted : nos propres opérateurs ne doivent pas être neutralisés par sanitizeFilter.
      const filter = inTrash ? { deletedAt: mongoose.trusted({ $ne: null }) } : { deletedAt: null };
      res.json(await Model.find(filter).sort(inTrash ? { deletedAt: -1 } : { order: 1, createdAt: 1 }));
    })
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const data = pick(req.body);
      if (data.order === undefined) {
        const last = await Model.findOne({ deletedAt: null }).sort({ order: -1 }).select('order');
        data.order = last ? (last.order ?? 0) + 1 : 0;
      }
      const doc = await Model.create(data);
      await record({ target, docId: doc._id, action: 'create', label: labelOf(doc), before: null, by: req.admin?.email });
      invalidateContentCache();
      res.status(201).json(doc);
    })
  );

  // Déclaré avant « /:id » pour ne pas être capturé par lui.
  router.put(
    '/reorder',
    asyncHandler(async (req, res) => {
      const { ids } = parseReorder(req.body);
      const before = await Model.find({ _id: mongoose.trusted({ $in: ids }) }).select('order');
      await record({ target, action: 'reorder', label: 'Ordre', before: before.map((d) => ({ id: String(d._id), order: d.order })), by: req.admin?.email });
      await Model.bulkWrite(ids.map((id, index) => ({ updateOne: { filter: { _id: id }, update: { $set: { order: index } } } })));
      invalidateContentCache();
      res.json({ ok: true });
    })
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      res.json(await find(req.params.id));
    })
  );

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const doc = await find(req.params.id);
      const before = snapshot(doc);
      for (const [k, v] of Object.entries(pick(req.body))) doc.set(k, v);
      await doc.save();
      await record({ target, docId: doc._id, action: 'update', label: labelOf(doc), before, by: req.admin?.email });
      invalidateContentCache();
      res.json(doc);
    })
  );

  router.patch(
    '/:id/active',
    asyncHandler(async (req, res) => {
      const { active } = parseActive(req.body);
      const doc = await find(req.params.id);
      const before = snapshot(doc);
      doc.active = active;
      await doc.save();
      await record({ target, docId: doc._id, action: 'active', label: labelOf(doc), before, by: req.admin?.email });
      invalidateContentCache();
      res.json(doc);
    })
  );

  // « Supprimer » = mettre à la corbeille (restaurable à tout moment).
  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const doc = await find(req.params.id);
      if (doc.deletedAt) return res.json(doc);
      const before = snapshot(doc);
      doc.deletedAt = new Date();
      await doc.save();
      await record({ target, docId: doc._id, action: 'delete', label: labelOf(doc), before, by: req.admin?.email });
      invalidateContentCache();
      return res.json(doc);
    })
  );

  router.post(
    '/:id/restore',
    asyncHandler(async (req, res) => {
      const doc = await find(req.params.id);
      const before = snapshot(doc);
      doc.deletedAt = null;
      await doc.save();
      await record({ target, docId: doc._id, action: 'restore', label: labelOf(doc), before, by: req.admin?.email });
      invalidateContentCache();
      res.json(doc);
    })
  );

  return router;
}

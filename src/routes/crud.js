import { Router } from 'express';
import mongoose from 'mongoose';
import { destroyAssets } from '../services/mediaService.js';
import { invalidateContentCache } from '../services/contentService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import { parseActive, parseReorder } from '../utils/validators.js';

const SYSTEM_FIELDS = new Set(['_id', '__v', 'createdAt', 'updatedAt']);
const ID_RE = /^[a-f0-9]{24}$/i;

/**
 * CRUD générique d'une collection : liste, création, lecture, modification, suppression,
 * activation et réordonnancement. Seuls les champs du schéma sont acceptés ; les validations
 * (types, longueurs, URLs, langues) sont celles du modèle Mongoose.
 */
export function crudRouter(Model) {
  const router = Router();
  const fields = Object.keys(Model.schema.paths).filter((p) => !SYSTEM_FIELDS.has(p) && !p.includes('.'));
  const publicIdFields = fields.filter((f) => f.endsWith('PublicId'));

  const pick = (body) => {
    if (!body || typeof body !== 'object') throw new HttpError(400, 'Corps de requête invalide.');
    const out = {};
    for (const f of fields) if (Object.prototype.hasOwnProperty.call(body, f)) out[f] = body[f];
    return out;
  };

  router.param('id', (_req, _res, next, id) =>
    mongoose.isValidObjectId(id) && ID_RE.test(id) ? next() : next(new HttpError(400, 'Identifiant invalide.'))
  );

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      res.json(await Model.find().sort({ order: 1, createdAt: 1 }));
    })
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const data = pick(req.body);
      if (data.order === undefined) {
        const last = await Model.findOne().sort({ order: -1 }).select('order');
        data.order = last ? (last.order ?? 0) + 1 : 0;
      }
      const doc = await Model.create(data);
      invalidateContentCache();
      res.status(201).json(doc);
    })
  );

  // Déclaré avant « /:id » pour ne pas être capturé par lui.
  router.put(
    '/reorder',
    asyncHandler(async (req, res) => {
      const { ids } = parseReorder(req.body);
      await Model.bulkWrite(ids.map((id, index) => ({ updateOne: { filter: { _id: id }, update: { $set: { order: index } } } })));
      invalidateContentCache();
      res.json({ ok: true });
    })
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const doc = await Model.findById(req.params.id);
      if (!doc) throw new HttpError(404, 'Élément introuvable.');
      res.json(doc);
    })
  );

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const doc = await Model.findById(req.params.id);
      if (!doc) throw new HttpError(404, 'Élément introuvable.');
      const before = publicIdFields.map((f) => doc.get(f));
      for (const [k, v] of Object.entries(pick(req.body))) doc.set(k, v);
      await doc.save();
      // Images remplacées : on supprime les anciennes de Cloudinary.
      destroyAssets(before.filter((old, i) => old && old !== doc.get(publicIdFields[i])));
      invalidateContentCache();
      res.json(doc);
    })
  );

  router.patch(
    '/:id/active',
    asyncHandler(async (req, res) => {
      const { active } = parseActive(req.body);
      const doc = await Model.findById(req.params.id);
      if (!doc) throw new HttpError(404, 'Élément introuvable.');
      doc.active = active;
      await doc.save();
      invalidateContentCache();
      res.json(doc);
    })
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const doc = await Model.findById(req.params.id);
      if (!doc) throw new HttpError(404, 'Élément introuvable.');
      const ids = publicIdFields.map((f) => doc.get(f));
      await doc.deleteOne();
      destroyAssets(ids);
      invalidateContentCache();
      res.json({ ok: true });
    })
  );

  return router;
}

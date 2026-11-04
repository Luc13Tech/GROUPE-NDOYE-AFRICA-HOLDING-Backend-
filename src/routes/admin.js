import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { adminLimiter } from '../middleware/rateLimit.js';
import { Ad } from '../models/Ad.js';
import { Company } from '../models/Company.js';
import { ContentBlock } from '../models/ContentBlock.js';
import { GalleryItem } from '../models/GalleryItem.js';
import { Partner } from '../models/Partner.js';
import { Project } from '../models/Project.js';
import { Service } from '../models/Service.js';
import { Video } from '../models/Video.js';
import { Villa } from '../models/Villa.js';
import { invalidateContentCache } from '../services/contentService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BLOCK_KEYS } from '../utils/blocks.js';
import { HttpError } from '../utils/httpError.js';
import { parseBlock } from '../utils/validators.js';
import { crudRouter } from './crud.js';
import uploadsRouter from './uploads.js';

const router = Router();

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.use(requireAuth, adminLimiter);

// Tableau de bord : compteurs par rubrique.
router.get(
  '/overview',
  asyncHandler(async (_req, res) => {
    const [services, villas, partnersWorld, partnersAfrica, companies, projects, gallery, ads, videos, blocks] = await Promise.all([
      Service.countDocuments(),
      Villa.countDocuments(),
      Partner.countDocuments({ kind: 'world' }),
      Partner.countDocuments({ kind: 'africa' }),
      Company.countDocuments(),
      Project.countDocuments(),
      GalleryItem.countDocuments(),
      Ad.countDocuments(),
      Video.countDocuments(),
      ContentBlock.countDocuments(),
    ]);
    res.json({ services, villas, partnersWorld, partnersAfrica, companies, projects, gallery, ads, videos, blocks });
  })
);

// Blocs de contenu (statistiques, engagements, textes de présentation, coordonnées…).
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
    if (!doc) throw new HttpError(404, 'Bloc non initialisé (lancez « npm run seed »).');
    res.json({ key: doc.key, data: doc.data, updatedAt: doc.updatedAt });
  })
);

router.put(
  '/blocks/:key',
  asyncHandler(async (req, res) => {
    const data = parseBlock(req.params.key, req.body);
    let doc = await ContentBlock.findOne({ key: req.params.key });
    if (!doc) doc = new ContentBlock({ key: req.params.key });
    doc.data = data;
    doc.markModified('data');
    await doc.save();
    invalidateContentCache();
    res.json({ key: doc.key, data: doc.data, updatedAt: doc.updatedAt });
  })
);

router.use('/services', crudRouter(Service));
router.use('/villas', crudRouter(Villa));
router.use('/partners', crudRouter(Partner));
router.use('/companies', crudRouter(Company));
router.use('/projects', crudRouter(Project));
router.use('/gallery', crudRouter(GalleryItem));
router.use('/ads', crudRouter(Ad));
router.use('/videos', crudRouter(Video));
router.use('/uploads', uploadsRouter);

export default router;

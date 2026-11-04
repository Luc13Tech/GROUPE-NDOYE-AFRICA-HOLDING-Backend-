import { Router } from 'express';
import { getPublicContent } from '../services/contentService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const CACHE = 'public, max-age=60, stale-while-revalidate=300';

// Tout le contenu public en une requête (le site garde ses données intégrées en secours).
router.get(
  '/content',
  asyncHandler(async (_req, res) => {
    res.set('Cache-Control', CACHE);
    res.json(await getPublicContent());
  })
);

// Publicités seules (rafraîchissement léger du carrousel).
router.get(
  '/ads',
  asyncHandler(async (_req, res) => {
    const { ads, version } = await getPublicContent();
    res.set('Cache-Control', CACHE);
    res.json({ version, ads });
  })
);

export default router;

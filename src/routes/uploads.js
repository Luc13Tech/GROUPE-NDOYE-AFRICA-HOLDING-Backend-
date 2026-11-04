import { Router } from 'express';
import cloudinary from '../config/cloudinary.js';
import { env } from '../config/env.js';
import { UPLOAD_FOLDERS, parseSignRequest } from '../utils/validators.js';

const router = Router();
const ALLOWED_FORMATS = 'jpg,jpeg,png,webp,avif';
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Signature d'envoi Cloudinary. Le navigateur envoie ensuite l'image directement à Cloudinary
 * (le serveur Render ne transporte pas les fichiers) avec exactement ces paramètres :
 * file, api_key, timestamp, signature, folder, allowed_formats.
 */
router.post('/sign', (req, res) => {
  const { folder } = parseSignRequest(req.body);
  const timestamp = Math.round(Date.now() / 1000);
  const params = { allowed_formats: ALLOWED_FORMATS, folder: UPLOAD_FOLDERS[folder], timestamp };
  const signature = cloudinary.utils.api_sign_request(params, env.cloudinary.apiSecret);

  res.json({
    cloudName: env.cloudinary.cloudName,
    apiKey: env.cloudinary.apiKey,
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.cloudinary.cloudName}/image/upload`,
    folder: params.folder,
    allowedFormats: ALLOWED_FORMATS,
    timestamp,
    signature,
    maxBytes: MAX_BYTES,
  });
});

export default router;

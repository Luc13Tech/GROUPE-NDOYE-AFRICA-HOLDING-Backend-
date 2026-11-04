import 'dotenv/config';

const get = (key, fallback = '') => String(process.env[key] ?? fallback).trim();

const isProd = get('NODE_ENV') === 'production';
const sameSiteRaw = get('COOKIE_SAMESITE', 'strict').toLowerCase();

export const env = {
  isProd,
  port: Number(get('PORT')) || 5000,
  mongoUri: get('MONGODB_URI'),
  jwtSecret: get('JWT_SECRET'),
  origins: get('FRONTEND_ORIGIN')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean),
  cookieSameSite: ['strict', 'lax', 'none'].includes(sameSiteRaw) ? sameSiteRaw : 'strict',
  cloudinary: {
    cloudName: get('CLOUDINARY_CLOUD_NAME'),
    apiKey: get('CLOUDINARY_API_KEY'),
    apiSecret: get('CLOUDINARY_API_SECRET'),
  },
  admin: {
    email: get('ADMIN_EMAIL').toLowerCase(),
    password: String(process.env.ADMIN_PASSWORD ?? ''),
  },
};

export const SERVER_KEYS = [
  'MONGODB_URI',
  'JWT_SECRET',
  'FRONTEND_ORIGIN',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];

/** Arrête le processus si une variable obligatoire manque ou est trop faible. */
export function assertEnv(keys) {
  const missing = keys.filter((k) => !get(k));
  if (missing.length) {
    console.error(`[config] Variables d'environnement manquantes : ${missing.join(', ')}`);
    process.exit(1);
  }
  if (keys.includes('JWT_SECRET') && env.jwtSecret.length < 32) {
    console.error('[config] JWT_SECRET doit contenir au moins 32 caractères.');
    process.exit(1);
  }
  if (keys.includes('FRONTEND_ORIGIN') && isProd && env.origins.some((o) => !o.startsWith('https://'))) {
    console.error('[config] En production, FRONTEND_ORIGIN doit utiliser https://.');
    process.exit(1);
  }
  if (env.cookieSameSite === 'none' && !isProd) {
    console.warn('[config] COOKIE_SAMESITE=none nécessite HTTPS : à réserver à la production.');
  }
}

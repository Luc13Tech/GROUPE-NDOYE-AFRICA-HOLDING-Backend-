import jwt from 'jsonwebtoken';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { AdminUser } from '../models/AdminUser.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';

export const SESSION_SECONDS = 2 * 60 * 60; // session de 2 h, non prolongée
// Le préfixe __Host- impose Secure + Path=/ + aucun Domain : cookie lié strictement à ce serveur.
export const COOKIE_NAME = env.isProd ? '__Host-gnah_session' : 'gnah_session';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const cookieOptions = () => ({
  httpOnly: true,
  secure: env.isProd,
  sameSite: env.cookieSameSite,
  path: '/',
});

const safeEqual = (a, b) => {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  return A.length === B.length && timingSafeEqual(A, B);
};

export const newCsrfToken = () => randomBytes(24).toString('hex');

export function signSession(user, csrf) {
  return jwt.sign({ sub: String(user._id), tv: user.tokenVersion, csrf }, env.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: SESSION_SECONDS,
  });
}

export function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: SESSION_SECONDS * 1000 });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
}

/** Toute requête qui modifie des données doit venir d'une origine autorisée (anti-CSRF, niveau 1). */
export function originGuard(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.get('origin');
  if (!origin || !env.origins.includes(origin)) return next(new HttpError(403, 'Origine non autorisée.'));
  return next();
}

/** Session valide + jeton CSRF (anti-CSRF, niveau 2) pour les requêtes qui modifient des données. */
export const requireAuth = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) throw new HttpError(401, 'Authentification requise.');

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    throw new HttpError(401, 'Session expirée. Reconnectez-vous.');
  }

  const user = await AdminUser.findById(payload.sub).select('email tokenVersion');
  if (!user || user.tokenVersion !== payload.tv) throw new HttpError(401, 'Session invalide. Reconnectez-vous.');

  if (!SAFE_METHODS.has(req.method)) {
    const sent = req.get('x-csrf-token');
    if (!sent || !safeEqual(sent, payload.csrf)) throw new HttpError(403, 'Jeton CSRF invalide.');
  }

  req.admin = { id: String(user._id), email: user.email, csrf: payload.csrf };
  next();
});

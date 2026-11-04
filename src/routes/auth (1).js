import bcrypt from 'bcryptjs';
import { Router } from 'express';
import {
  SESSION_SECONDS,
  clearSessionCookie,
  newCsrfToken,
  requireAuth,
  setSessionCookie,
  signSession,
} from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimit.js';
import { AdminUser } from '../models/AdminUser.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import { parseLogin, parsePasswordChange } from '../utils/validators.js';

const router = Router();
const MAX_FAILED = 5;
const LOCK_MS = 15 * 60 * 1000;
const BCRYPT_COST = 12;

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Empreinte factice : le temps de réponse ne révèle pas si l'e-mail existe.
let dummyHash;
const getDummyHash = async () => (dummyHash ??= await bcrypt.hash('gnah-dummy-password', BCRYPT_COST));

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = parseLogin(req.body);
    const user = await AdminUser.findOne({ email }).select('+passwordHash');
    const now = Date.now();

    if (user?.lockUntil && user.lockUntil.getTime() > now) {
      const retry = Math.ceil((user.lockUntil.getTime() - now) / 1000);
      res.set('Retry-After', String(retry));
      throw new HttpError(429, 'Trop de tentatives. Réessayez dans quelques minutes.', { retryAfterSeconds: retry });
    }

    const ok = await bcrypt.compare(password, user?.passwordHash ?? (await getDummyHash()));
    if (!user || !ok) {
      if (user) {
        user.failedAttempts += 1;
        if (user.failedAttempts >= MAX_FAILED) {
          user.lockUntil = new Date(now + LOCK_MS);
          user.failedAttempts = 0;
        }
        await user.save();
      }
      throw new HttpError(401, 'Identifiants invalides.');
    }

    user.failedAttempts = 0;
    user.lockUntil = null;
    user.lastLoginAt = new Date();
    await user.save();

    const csrf = newCsrfToken();
    setSessionCookie(res, signSession(user, csrf));
    res.json({ admin: { email: user.email }, csrfToken: csrf, expiresInSeconds: SESSION_SECONDS });
  })
);

// Restaure la session après un rechargement de page (le jeton CSRF vit en mémoire côté navigateur).
router.get('/me', requireAuth, (req, res) => {
  res.json({ admin: { email: req.admin.email }, csrfToken: req.admin.csrf });
});

router.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.put(
  '/password',
  requireAuth,
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = parsePasswordChange(req.body);
    const user = await AdminUser.findById(req.admin.id).select('+passwordHash');
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new HttpError(400, 'Mot de passe actuel incorrect.');
    }
    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
    user.tokenVersion += 1; // invalide toutes les autres sessions
    await user.save();

    const csrf = newCsrfToken();
    setSessionCookie(res, signSession(user, csrf));
    res.json({ ok: true, csrfToken: csrf });
  })
);

export default router;

import rateLimit from 'express-rate-limit';

const make = (limit, message, extra = {}) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: message },
    ...extra,
  });

export const apiLimiter = make(400, 'Trop de requêtes. Réessayez dans quelques minutes.');
export const loginLimiter = make(10, 'Trop de tentatives de connexion. Réessayez dans 15 minutes.', {
  skipSuccessfulRequests: true,
});
export const adminLimiter = make(300, 'Trop de requêtes d’administration. Réessayez dans quelques minutes.');

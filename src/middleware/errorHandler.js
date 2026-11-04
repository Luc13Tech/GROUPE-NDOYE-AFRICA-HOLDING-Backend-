import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

export function notFound(_req, res) {
  res.status(404).json({ error: 'Route introuvable.' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...(err.details ? { details: err.details } : {}) });
  }
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON invalide.' });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Requête trop volumineuse.' });
  if (err?.name === 'ValidationError') {
    const details = Object.values(err.errors ?? {}).map((e) => ({ path: e.path, message: e.message }));
    return res.status(400).json({ error: 'Données invalides.', details });
  }
  if (err?.name === 'CastError') return res.status(400).json({ error: `Valeur invalide pour « ${err.path} ».` });
  if (err?.code === 11000) return res.status(409).json({ error: 'Cet élément existe déjà.' });

  console.error('[error]', req.method, req.originalUrl, err?.message);
  if (!env.isProd && err?.stack) console.error(err.stack);
  return res.status(500).json({ error: 'Erreur interne du serveur.' });
}

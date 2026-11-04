import { sanitizeDeep } from '../utils/safe.js';

/** Retire les clés « $… » / « a.b » (injection NoSQL) et les caractères de contrôle. */
export function sanitizeInput(req, _res, next) {
  if (req.body) req.body = sanitizeDeep(req.body);
  if (req.query && typeof req.query === 'object') {
    const clean = sanitizeDeep({ ...req.query });
    for (const k of Object.keys(req.query)) delete req.query[k];
    Object.assign(req.query, clean);
  }
  next();
}

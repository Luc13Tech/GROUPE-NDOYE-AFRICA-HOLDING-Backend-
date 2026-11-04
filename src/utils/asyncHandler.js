/** Transmet les erreurs des handlers async au gestionnaire d'erreurs Express. */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

import { Revision } from '../models/Revision.js';

const MAX_BEFORE_BYTES = 400_000;

/** Copie de l'état précédent d'un document (sans les champs internes de Mongo). */
export function snapshot(doc) {
  if (!doc) return null;
  const plain = typeof doc.toObject === 'function' ? doc.toObject({ depopulate: true, versionKey: false }) : { ...doc };
  delete plain.__v;
  return JSON.parse(JSON.stringify(plain));
}

/** Enregistre une entrée d'historique. N'interrompt jamais l'opération principale en cas d'échec. */
export async function record({ target, docId, action, label, before, by }) {
  try {
    let saved = before ?? null;
    if (saved && JSON.stringify(saved).length > MAX_BEFORE_BYTES) saved = { note: 'Contenu trop volumineux pour l’historique.' };
    await Revision.create({ target, docId: docId ? String(docId) : undefined, action, label, before: saved, by });
  } catch (err) {
    console.warn('[historique] enregistrement impossible :', err.message);
  }
}

import { HttpError } from './httpError.js';
import { checkPasswordStrength } from './password.js';
import { BLOCK_SHAPES } from './blocks.js';
import { LANGS, isPlainObject, isSafeLink, isSafeString, isSafeValue } from './safe.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

export const UPLOAD_FOLDERS = {
  ads: 'gnah/ads',
  gallery: 'gnah/gallery',
  companies: 'gnah/companies',
  villas: 'gnah/villas',
  projects: 'gnah/projects',
  videos: 'gnah/videos',
  misc: 'gnah/misc',
};

function fail(issues) {
  throw new HttpError(400, 'Données invalides.', issues);
}

export function parseLogin(body) {
  const issues = [];
  const email = isPlainObject(body) && typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = isPlainObject(body) && typeof body.password === 'string' ? body.password : '';
  if (!EMAIL_RE.test(email) || email.length > 200) issues.push({ path: 'email', message: 'Adresse e-mail invalide.' });
  if (!password || password.length > 200) issues.push({ path: 'password', message: 'Mot de passe invalide.' });
  if (issues.length) fail(issues);
  return { email, password };
}

export function parsePasswordChange(body) {
  const issues = [];
  const currentPassword = isPlainObject(body) && typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = isPlainObject(body) && typeof body.newPassword === 'string' ? body.newPassword : '';
  if (!currentPassword || currentPassword.length > 200) issues.push({ path: 'currentPassword', message: 'Mot de passe actuel requis.' });
  const weak = checkPasswordStrength(newPassword);
  if (weak.length) issues.push({ path: 'newPassword', message: `Nouveau mot de passe insuffisant : ${weak.join(', ')}.` });
  if (!issues.length && currentPassword === newPassword) {
    issues.push({ path: 'newPassword', message: 'Le nouveau mot de passe doit être différent de l’actuel.' });
  }
  if (issues.length) fail(issues);
  return { currentPassword, newPassword };
}

export function parseSignRequest(body) {
  const folder = isPlainObject(body) ? body.folder : undefined;
  if (typeof folder !== 'string' || !Object.prototype.hasOwnProperty.call(UPLOAD_FOLDERS, folder)) {
    fail([{ path: 'folder', message: `Dossier inconnu (${Object.keys(UPLOAD_FOLDERS).join(', ')}).` }]);
  }
  return { folder };
}

export function parseReorder(body) {
  const ids = isPlainObject(body) ? body.ids : undefined;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500) fail([{ path: 'ids', message: 'Liste d’identifiants requise.' }]);
  if (!ids.every((i) => typeof i === 'string' && OBJECT_ID_RE.test(i))) fail([{ path: 'ids', message: 'Identifiant invalide.' }]);
  if (new Set(ids).size !== ids.length) fail([{ path: 'ids', message: 'Identifiants en double.' }]);
  return { ids };
}

export function parseActive(body) {
  if (!isPlainObject(body) || typeof body.active !== 'boolean') fail([{ path: 'active', message: 'Booléen requis.' }]);
  return { active: body.active };
}

// ───────── Blocs de contenu ─────────

function parseSite(data) {
  const issues = [];
  const allowed = ['name', 'short', 'phone', 'whatsapp', 'email', 'address_fr', 'social', 'waMsg'];
  for (const k of Object.keys(data)) if (!allowed.includes(k)) issues.push({ path: k, message: 'Champ non autorisé.' });

  const text = (k, max, required = true) => {
    const v = data[k];
    if (v === undefined || v === '') {
      if (required) issues.push({ path: k, message: 'Champ requis.' });
    } else if (!isSafeString(v, max)) issues.push({ path: k, message: 'Valeur invalide.' });
  };
  text('name', 120);
  text('short', 40, false);
  text('address_fr', 300);
  if (typeof data.phone !== 'string' || !/^\+?[0-9 ()\-.]{6,25}$/.test(data.phone)) issues.push({ path: 'phone', message: 'Téléphone invalide.' });
  if (typeof data.whatsapp !== 'string' || !/^[0-9]{6,20}$/.test(data.whatsapp)) issues.push({ path: 'whatsapp', message: 'Numéro WhatsApp invalide (chiffres uniquement).' });
  if (typeof data.email !== 'string' || !EMAIL_RE.test(data.email) || data.email.length > 200) issues.push({ path: 'email', message: 'E-mail invalide.' });

  if (data.social !== undefined) {
    if (!isPlainObject(data.social)) issues.push({ path: 'social', message: 'Objet attendu.' });
    else {
      for (const [k, v] of Object.entries(data.social)) {
        if (!['facebook', 'instagram', 'tiktok', 'threads', 'linkedin'].includes(k) || !isSafeLink(v) || !String(v).startsWith('https://')) {
          issues.push({ path: `social.${k}`, message: 'Lien https invalide.' });
        }
      }
    }
  }
  if (data.waMsg !== undefined) {
    if (!isPlainObject(data.waMsg)) issues.push({ path: 'waMsg', message: 'Objet attendu.' });
    else {
      for (const [k, v] of Object.entries(data.waMsg)) {
        if (!LANGS.includes(k) || !isSafeString(v, 500)) issues.push({ path: `waMsg.${k}`, message: 'Message invalide.' });
      }
    }
  }
  if (issues.length) fail(issues);
}

/** Valide un bloc de contenu (forme, taille, contenu) avant enregistrement. */
export function parseBlock(key, body) {
  if (!Object.prototype.hasOwnProperty.call(BLOCK_SHAPES, key)) throw new HttpError(404, 'Bloc inconnu.');
  const data = isPlainObject(body) ? body.data : undefined;
  const shape = BLOCK_SHAPES[key];
  const okShape = shape === 'array' ? Array.isArray(data) : isPlainObject(data);
  if (!okShape) fail([{ path: 'data', message: shape === 'array' ? 'Tableau attendu.' : 'Objet attendu.' }]);
  if (!isSafeValue(data)) fail([{ path: 'data', message: 'Contenu non autorisé (taille, profondeur, clés ou liens dangereux).' }]);
  if (key === 'site') parseSite(data);
  return data;
}

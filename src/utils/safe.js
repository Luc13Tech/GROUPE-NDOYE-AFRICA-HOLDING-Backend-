// Utilitaires de validation et d'assainissement — sans aucune dépendance.

export const LANGS = ['fr', 'en', 'es', 'de', 'zh'];

const DANGEROUS = /^\s*(javascript|vbscript)\s*:|^\s*data\s*:\s*(text|application)\//i;
const KEY_RE = /^[A-Za-z0-9_-]{1,40}$/;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export const isPlainObject = (v) => Object.prototype.toString.call(v) === '[object Object]';

/** Supprime les clés dangereuses ($…, a.b, __proto__) et les caractères de contrôle. */
export function sanitizeDeep(value, depth = 0) {
  if (depth > 12) return undefined;
  if (typeof value === 'string') return value.replace(CONTROL_CHARS, '');
  if (Array.isArray(value)) return value.map((x) => sanitizeDeep(x, depth + 1));
  if (isPlainObject(value)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith('$') || k.includes('.') || FORBIDDEN_KEYS.has(k)) continue;
      out[k] = sanitizeDeep(v, depth + 1);
    }
    return out;
  }
  return value;
}

export function isSafeString(s, max = 6000) {
  return typeof s === 'string' && s.length <= max && !DANGEROUS.test(s);
}

/** Valeur JSON « sûre » : types simples, tailles et profondeur bornées, clés alphanumériques. */
export function isSafeValue(v, opts = {}, depth = 0) {
  const { maxStr = 6000, maxItems = 300, maxKeys = 120, maxDepth = 8, maxJson = 250000 } = opts;
  if (depth === 0) {
    try {
      if (JSON.stringify(v ?? null).length > maxJson) return false;
    } catch {
      return false;
    }
  }
  if (v === null || v === undefined || typeof v === 'boolean') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string') return isSafeString(v, maxStr);
  if (depth >= maxDepth) return false;
  if (Array.isArray(v)) return v.length <= maxItems && v.every((x) => isSafeValue(x, opts, depth + 1));
  if (isPlainObject(v)) {
    const keys = Object.keys(v);
    return (
      keys.length <= maxKeys &&
      keys.every((k) => KEY_RE.test(k) && !FORBIDDEN_KEYS.has(k) && isSafeValue(v[k], opts, depth + 1))
    );
  }
  return false;
}

/** Objet de textes par clé : { title, desc }… ; la clé 1 est obligatoire si `required`. */
export function isLangBlock(v, keys, required = false) {
  if (v === null || v === undefined) return !required;
  if (!isPlainObject(v)) return false;
  const present = Object.keys(v);
  if (!present.every((k) => keys.includes(k))) return false;
  if (!present.every((k) => isSafeString(v[k]))) return false;
  if (required && !(typeof v[keys[0]] === 'string' && v[keys[0]].trim())) return false;
  return true;
}

/** Table langue → texte : { fr, en, es, de, zh } ; le français est obligatoire si `required`. */
export function isLangMap(v, required = false) {
  if (v === null || v === undefined) return !required;
  if (!isPlainObject(v)) return false;
  const present = Object.keys(v);
  if (!present.every((k) => LANGS.includes(k))) return false;
  if (!present.every((k) => isSafeString(v[k]))) return false;
  if (required && !(typeof v.fr === 'string' && v.fr.trim())) return false;
  return true;
}

/** Pièces d'une villa : [{ fr, en, es, de, zh, val }]. */
export function isRoomsList(v) {
  if (v === null || v === undefined) return true;
  if (!Array.isArray(v) || v.length > 30) return false;
  return v.every(
    (r) =>
      isPlainObject(r) &&
      Object.keys(r).every((k) => LANGS.includes(k) || k === 'val') &&
      Object.values(r).every((x) => isSafeString(x, 200))
  );
}

/** Points forts d'une villa : { fr: [..], en: [..], … }. */
export function isFeaturesMap(v) {
  if (v === null || v === undefined) return true;
  if (!isPlainObject(v)) return false;
  return Object.entries(v).every(
    ([k, list]) => LANGS.includes(k) && Array.isArray(list) && list.length <= 20 && list.every((s) => isSafeString(s, 300))
  );
}

/** Chemin local (/Images/…) ou https Cloudinary (notre compte) / Unsplash. */
export function isSafeAssetUrl(url, cloudName) {
  if (typeof url !== 'string' || url.length > 600) return false;
  if (url.startsWith('/')) {
    return !url.startsWith('//') && !url.includes('..') && /^\/[A-Za-z0-9_\-./%@+ ]+$/.test(url);
  }
  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' || u.username || u.password) return false;
  if (u.hostname === 'res.cloudinary.com') return Boolean(cloudName) && u.pathname.startsWith(`/${cloudName}/`);
  return u.hostname === 'images.unsplash.com';
}

/** Lien sortant : https uniquement (ou chemin interne). */
export function isSafeLink(url) {
  if (typeof url !== 'string' || url.length > 600) return false;
  if (url === '#') return true;
  if (url.startsWith('/')) return !url.startsWith('//') && /^\/[A-Za-z0-9_\-./%?=&#]*$/.test(url);
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !u.username && !u.password;
  } catch {
    return false;
  }
}

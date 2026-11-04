import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { isLangBlock, isLangMap, isSafeAssetUrl, isSafeLink, isSafeString } from '../utils/safe.js';

export const baseOptions = {
  timestamps: true,
  strict: true,
  toJSON: {
    versionKey: false,
    transform(_doc, ret) {
      ret.id = String(ret._id);
      delete ret._id;
      return ret;
    },
  },
};

export const orderActive = {
  order: { type: Number, default: 0, min: 0, max: 100000 },
  active: { type: Boolean, default: true },
};

/** Texte court assaini (pas de schéma javascript:, longueur bornée). */
export const safeText = (max = 300, opts = {}) => ({
  type: String,
  trim: true,
  maxlength: max,
  ...opts,
  validate: { validator: (v) => !v || isSafeString(v, max), message: 'Texte non autorisé.' },
});

/** Chemin local /Images/… ou URL https (Cloudinary du compte, Unsplash). */
export const assetUrl = (opts = {}) => ({
  type: String,
  trim: true,
  maxlength: 600,
  ...opts,
  validate: {
    validator: (v) => !v || isSafeAssetUrl(v, env.cloudinary.cloudName),
    message: 'URL ou chemin d’image non autorisé.',
  },
});

export const publicIdField = {
  type: String,
  trim: true,
  maxlength: 300,
  validate: { validator: (v) => !v || /^gnah\/[A-Za-z0-9_\-/]+$/.test(v), message: 'Identifiant Cloudinary invalide.' },
};

export const linkField = (opts = {}) => ({
  type: String,
  trim: true,
  maxlength: 600,
  ...opts,
  validate: { validator: (v) => !v || isSafeLink(v), message: 'Lien non autorisé (https uniquement).' },
});

/** { fr: {…}, en: {…} } — un bloc par langue, la clé `keys[0]` est obligatoire en français. */
export const langBlock = (keys, { required = false } = {}) => ({
  type: mongoose.Schema.Types.Mixed,
  required: required ? [true, 'La version française est obligatoire.'] : false,
  validate: {
    validator: (v) => isLangBlock(v, keys, required),
    message: `Contenu invalide (clés autorisées : ${keys.join(', ')}).`,
  },
});

/** { fr: 'texte', en: 'text', … } */
export const langMap = ({ required = false } = {}) => ({
  type: mongoose.Schema.Types.Mixed,
  required: required ? [true, 'La version française est obligatoire.'] : false,
  validate: {
    validator: (v) => isLangMap(v, required),
    message: 'Textes par langue invalides (fr, en, es, de, zh).',
  },
});

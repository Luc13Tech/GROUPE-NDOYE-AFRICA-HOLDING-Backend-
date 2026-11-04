import mongoose from 'mongoose';
import { isFeaturesMap, isRoomsList } from '../utils/safe.js';
import { assetUrl, baseOptions, langBlock, orderActive, publicIdField, safeText } from './_common.js';

const keys = ['name', 'standing'];

const schema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, match: /^[a-z0-9-]{2,30}$/ },
    color: { type: String, match: /^#[0-9a-fA-F]{6}$/, default: '#64748b' },
    surface: safeText(30),
    bati: safeText(30),
    img: assetUrl(),
    imgPublicId: publicIdField,
    planImg: assetUrl(),
    planImgPublicId: publicIdField,
    fr: langBlock(keys, { required: true }),
    en: langBlock(keys),
    es: langBlock(keys),
    de: langBlock(keys),
    zh: langBlock(keys),
    rooms: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
      validate: { validator: isRoomsList, message: 'Liste de pièces invalide.' },
    },
    features: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      validate: { validator: isFeaturesMap, message: 'Points forts invalides.' },
    },
    ...orderActive,
  },
  baseOptions
);

export const Villa = mongoose.model('Villa', schema);

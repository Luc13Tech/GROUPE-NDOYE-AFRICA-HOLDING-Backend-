import mongoose from 'mongoose';
import { GALLERY_CATS } from '../utils/enums.js';
import { assetUrl, baseOptions, orderActive, publicIdField, safeText } from './_common.js';


const schema = new mongoose.Schema(
  {
    cat: { type: String, enum: GALLERY_CATS, required: true },
    src: assetUrl({ required: true }),
    srcPublicId: publicIdField,
    fallback: assetUrl(),
    fr: safeText(300, { required: true }),
    en: safeText(300),
    es: safeText(300),
    de: safeText(300),
    zh: safeText(300),
    ...orderActive,
  },
  baseOptions
);

export const GalleryItem = mongoose.model('GalleryItem', schema);

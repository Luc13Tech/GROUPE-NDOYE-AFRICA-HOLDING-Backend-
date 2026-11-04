import mongoose from 'mongoose';
import { assetUrl, baseOptions, langBlock, linkField, orderActive, publicIdField } from './_common.js';

const keys = ['title', 'desc'];

const schema = new mongoose.Schema(
  {
    platform: { type: String, enum: ['youtube', 'tiktok', 'facebook', 'instagram'], required: true },
    url: linkField({ required: true }),
    thumbnail: assetUrl(),
    thumbnailPublicId: publicIdField,
    fallback: assetUrl(),
    duration: { type: String, trim: true, match: /^\d{1,2}(:\d{2}){1,2}$/ },
    fr: langBlock(keys, { required: true }),
    en: langBlock(keys),
    es: langBlock(keys),
    de: langBlock(keys),
    zh: langBlock(keys),
    ...orderActive,
  },
  baseOptions
);

export const Video = mongoose.model('Video', schema);

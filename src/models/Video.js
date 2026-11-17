import mongoose from 'mongoose';
import { VIDEO_PLATFORMS } from '../utils/enums.js';
import { assetUrl, baseOptions, langBlock, linkField, orderActive, publicIdField } from './_common.js';

const keys = ['title', 'desc'];

const schema = new mongoose.Schema(
  {
    platform: { type: String, enum: VIDEO_PLATFORMS, required: true },
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

import mongoose from 'mongoose';
import { SERVICE_ICONS } from '../utils/enums.js';
import { baseOptions, langBlock, orderActive } from './_common.js';

const keys = ['title', 'desc'];

const schema = new mongoose.Schema(
  {
    icon: { type: String, enum: SERVICE_ICONS, default: 'building' },
    fr: langBlock(keys, { required: true }),
    en: langBlock(keys),
    es: langBlock(keys),
    de: langBlock(keys),
    zh: langBlock(keys),
    ...orderActive,
  },
  baseOptions
);

export const Service = mongoose.model('Service', schema);

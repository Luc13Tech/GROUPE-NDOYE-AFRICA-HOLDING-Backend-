import mongoose from 'mongoose';
import { assetUrl, baseOptions, langMap, orderActive, publicIdField } from './_common.js';

export const PROJECT_CATEGORIES = ['Immobilier', 'Infrastructure', 'Agriculture', 'Énergie', 'Autre'];

const schema = new mongoose.Schema(
  {
    category: { type: String, enum: PROJECT_CATEGORIES, default: 'Immobilier' },
    img: assetUrl(),
    imgPublicId: publicIdField,
    title: langMap({ required: true }),
    desc: langMap({ required: true }),
    waMsg: langMap(),
    ...orderActive,
  },
  baseOptions
);

export const Project = mongoose.model('Project', schema);

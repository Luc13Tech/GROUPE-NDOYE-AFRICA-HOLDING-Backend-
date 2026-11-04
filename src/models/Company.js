import mongoose from 'mongoose';
import { assetUrl, baseOptions, langMap, linkField, orderActive, publicIdField, safeText } from './_common.js';

const schema = new mongoose.Schema(
  {
    name: safeText(120, { required: true }),
    logo: assetUrl(),
    logoPublicId: publicIdField,
    sector: langMap({ required: true }),
    desc: langMap({ required: true }),
    website: linkField(),
    country: safeText(80),
    ...orderActive,
  },
  baseOptions
);

export const Company = mongoose.model('Company', schema);

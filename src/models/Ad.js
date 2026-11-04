import mongoose from 'mongoose';
import { assetUrl, baseOptions, langMap, linkField, orderActive, publicIdField, safeText } from './_common.js';

const schema = new mongoose.Schema(
  {
    title: safeText(120, { required: true }), // libellé interne (non affiché)
    img: assetUrl({ required: true }),
    imgPublicId: publicIdField,
    alt: langMap(),
    link: linkField(),
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    ...orderActive,
  },
  baseOptions
);

schema.pre('validate', function checkDates() {
  if (this.startsAt && this.endsAt && this.endsAt < this.startsAt) {
    this.invalidate('endsAt', 'La date de fin doit suivre la date de début.');
  }
});

export const Ad = mongoose.model('Ad', schema);

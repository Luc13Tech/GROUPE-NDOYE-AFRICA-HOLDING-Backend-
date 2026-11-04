import mongoose from 'mongoose';
import { baseOptions, langBlock, orderActive, safeText } from './_common.js';

const keys = ['country', 'focus'];

const schema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['world', 'africa'], required: true },
    code: { type: String, trim: true, match: /^[A-Z]{2}$/ },
    name: safeText(100),
    fr: langBlock(keys),
    en: langBlock(keys),
    es: langBlock(keys),
    de: langBlock(keys),
    zh: langBlock(keys),
    ...orderActive,
  },
  baseOptions
);

schema.pre('validate', function checkKind() {
  if (this.kind === 'world') {
    if (!this.code) this.invalidate('code', 'Code pays requis (ex. TR).');
    if (!this.fr?.country || !this.fr?.focus) this.invalidate('fr', 'Pays et domaine requis en français.');
  } else if (this.kind === 'africa' && !this.name) {
    this.invalidate('name', 'Nom du pays requis.');
  }
});

export const Partner = mongoose.model('Partner', schema);

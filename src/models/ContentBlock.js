import mongoose from 'mongoose';
import { BLOCK_KEYS } from '../utils/blocks.js';
import { isSafeValue } from '../utils/safe.js';
import { baseOptions } from './_common.js';

const schema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, enum: BLOCK_KEYS },
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      validate: { validator: (v) => isSafeValue(v), message: 'Contenu non autorisé.' },
    },
  },
  baseOptions
);

export const ContentBlock = mongoose.model('ContentBlock', schema);

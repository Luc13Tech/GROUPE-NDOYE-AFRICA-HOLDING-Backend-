import mongoose from 'mongoose';

/**
 * Historique : avant chaque modification, suppression ou restauration, l'état précédent
 * est copié ici. N'importe quelle version peut ensuite être rétablie depuis l'administration.
 */
const schema = new mongoose.Schema(
  {
    target: { type: String, required: true, maxlength: 40, index: true }, // ex. « services », « block:site »
    docId: { type: String, maxlength: 60, index: true },
    action: { type: String, enum: ['create', 'update', 'delete', 'restore', 'active', 'reorder', 'sync', 'import', 'revert'], required: true },
    label: { type: String, maxlength: 200 },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    by: { type: String, maxlength: 200 },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      versionKey: false,
      transform(_doc, ret) {
        ret.id = String(ret._id);
        delete ret._id;
        return ret;
      },
    },
  }
);

schema.index({ createdAt: -1 });

export const Revision = mongoose.model('Revision', schema);

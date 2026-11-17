import mongoose from 'mongoose';

/**
 * Mémorise le contenu du site chargé lors de la dernière synchronisation.
 * Il sert de référence pour distinguer une correction faite dans le site (à appliquer)
 * d'une modification faite dans l'administration (à conserver).
 */
const schema = new mongoose.Schema(
  {
    _id: { type: String, default: 'site' },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    appliedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

export const SyncState = mongoose.model('SyncState', schema);

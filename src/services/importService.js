import mongoose from 'mongoose';
import { ContentBlock } from '../models/ContentBlock.js';
import { BLOCK_KEYS } from '../utils/blocks.js';
import { HttpError } from '../utils/httpError.js';
import { isPlainObject } from '../utils/safe.js';
import { invalidateContentCache } from './contentService.js';
import { record } from './historyService.js';
import { convertLegacy } from './legacyImport.js';
import { KEYS } from './syncPlan.js';
import { COLLECTIONS } from '../models/index.js';

const ID_RE = /^[a-f0-9]{24}$/i;
const SYSTEM = ['_id', 'id', '__v', 'createdAt', 'updatedAt', 'seedKey'];
const clean = (doc) => Object.fromEntries(Object.entries(doc).filter(([k]) => !SYSTEM.includes(k)));

/** Ajoute un élément s'il n'existe pas déjà (même identifiant naturel). Ne modifie jamais l'existant. */
async function addIfMissing(name, item, by, existingKeys, report) {
  const Model = COLLECTIONS[name];
  const key = KEYS[name](item);
  if (existingKeys.has(key)) {
    report.ignored += 1;
    return;
  }
  try {
    const last = await Model.findOne().sort({ order: -1 }).select('order');
    const doc = await Model.create({ ...clean(item), order: last ? (last.order ?? 0) + 1 : 0 });
    existingKeys.add(key);
    report.added += 1;
    await record({ target: name, docId: doc._id, action: 'import', label: String(key).slice(0, 200), before: null, by });
  } catch (err) {
    report.errors.push(`${name} « ${String(key).slice(0, 80)} » : ${err.message}`);
  }
}

async function keysOf(name) {
  const docs = await COLLECTIONS[name].find().lean();
  return new Set(docs.map((d) => KEYS[name](d)));
}

/** Données de l'ancien tableau de bord (navigateur). */
async function importLegacy(raw, by) {
  const { collections, settings } = convertLegacy(raw);
  const report = { added: 0, ignored: 0, errors: [], settings: null };
  for (const [name, items] of Object.entries(collections)) {
    const keys = await keysOf(name);
    for (const item of items) await addIfMissing(name, item, by, keys, report);
  }
  // Les anciens « paramètres » n'étaient pas publiés sur le site : ils sont seulement signalés.
  if (settings) {
    const site = (await ContentBlock.findOne({ key: 'site' }))?.data || {};
    const diff = {};
    if (settings.phone && settings.phone !== site.phone) diff.phone = String(settings.phone);
    if (settings.email && settings.email !== site.email) diff.email = String(settings.email);
    if (settings.address && settings.address !== site.address_fr) diff.address_fr = String(settings.address);
    if (Object.keys(diff).length) report.settings = diff;
  }
  return report;
}

/** Sauvegarde exportée depuis la nouvelle administration : seuls les éléments absents sont recréés. */
async function importBackup(data, by) {
  const report = { added: 0, ignored: 0, errors: [] };
  for (const [key, value] of Object.entries(isPlainObject(data.blocks) ? data.blocks : {})) {
    if (!BLOCK_KEYS.includes(key)) continue;
    if (await ContentBlock.exists({ key })) report.ignored += 1;
    else {
      try {
        await ContentBlock.create({ key, data: value });
        report.added += 1;
        await record({ target: `block:${key}`, action: 'import', label: key, before: null, by });
      } catch (err) {
        report.errors.push(`bloc ${key} : ${err.message}`);
      }
    }
  }
  for (const [name, Model] of Object.entries(COLLECTIONS)) {
    const items = Array.isArray(data.collections?.[name]) ? data.collections[name] : [];
    for (const item of items) {
      if (!isPlainObject(item)) continue;
      const id = String(item.id || item._id || '');
      if (!ID_RE.test(id)) {
        report.errors.push(`${name} : identifiant invalide`);
        continue;
      }
      if (await Model.exists({ _id: new mongoose.Types.ObjectId(id) })) {
        report.ignored += 1;
        continue;
      }
      try {
        await Model.create({ ...clean(item), _id: new mongoose.Types.ObjectId(id), ...(item.seedKey ? { seedKey: String(item.seedKey) } : {}) });
        report.added += 1;
        await record({ target: name, docId: id, action: 'import', label: 'Restauré depuis une sauvegarde', before: null, by });
      } catch (err) {
        report.errors.push(`${name} ${id} : ${err.message}`);
      }
    }
  }
  return report;
}

/** Point d'entrée : reconnaît le format et n'ajoute que ce qui manque. */
export async function importData(body, by) {
  const data = isPlainObject(body) ? body.data : undefined;
  if (!isPlainObject(data)) throw new HttpError(400, 'Fichier invalide.');
  let report;
  if (data.format === 'gnah-export') report = await importBackup(data, by);
  else if (data.format === 'gnah-legacy-admin' && isPlainObject(data.items)) report = await importLegacy(data.items, by);
  else if (Object.keys(data).some((k) => k.startsWith('gnah_'))) report = await importLegacy(data, by);
  else throw new HttpError(400, 'Format non reconnu (sauvegarde GNAH ou export de l’ancien tableau de bord attendu).');
  invalidateContentCache();
  report.errors = report.errors.slice(0, 50);
  return report;
}

/** Sauvegarde complète du contenu (corbeille comprise ; jamais les comptes administrateurs). */
export async function exportData() {
  const blocks = await ContentBlock.find().lean();
  const collections = {};
  for (const [name, Model] of Object.entries(COLLECTIONS)) {
    collections[name] = (await Model.find().sort({ order: 1 }).lean()).map(({ _id, __v, ...rest }) => ({ id: String(_id), ...rest }));
  }
  return {
    format: 'gnah-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    blocks: Object.fromEntries(blocks.map((b) => [b.key, b.data])),
    collections,
  };
}

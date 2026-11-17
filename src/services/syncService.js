import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { AdminUser } from '../models/AdminUser.js';
import { ContentBlock } from '../models/ContentBlock.js';
import { COLLECTIONS } from '../models/index.js';
import { SyncState } from '../models/SyncState.js';
import { checkPasswordStrength } from '../utils/password.js';
import { invalidateContentCache } from './contentService.js';
import { record } from './historyService.js';
import { planBlocks, planCollection } from './syncPlan.js';

export const readJson = (file) => JSON.parse(fs.readFileSync(new URL(`../../data/${file}`, import.meta.url), 'utf8'));
const readOptional = (file) => {
  try {
    return readJson(file);
  } catch {
    return null;
  }
};

const asCollection = (seed, name) => (name === 'partners' ? [...(seed?.partners?.world || []), ...(seed?.partners?.africa || [])] : seed?.[name] || []);

/**
 * Synchronisation sans perte du contenu du site vers MongoDB (voir services/syncPlan.js).
 * Sans danger à chaque démarrage : elle n'efface jamais rien et n'écrase aucune modification de l'admin.
 */
export async function syncContent({ log = console.log, dryRun = false } = {}) {
  const next = readJson('seed.json');
  // Référence : le contenu appliqué la dernière fois ; à défaut, celui du tout premier chargement.
  const state = await SyncState.findById('site').lean();
  const base = state?.data || readOptional('seed.base.json') || next;
  const report = {};
  const errors = [];
  // Chaque écriture est isolée : un élément refusé est signalé sans bloquer les autres.
  const attempt = async (what, fn) => {
    try {
      await fn();
    } catch (err) {
      errors.push(`${what} : ${err.message}`);
    }
  };

  // Blocs de contenu
  const blockDocs = await ContentBlock.find();
  const existingBlocks = Object.fromEntries(blockDocs.map((d) => [d.key, d.data]));
  const bp = planBlocks({ base: base.blocks, next: next.blocks, existing: existingBlocks });
  if (!dryRun) {
    for (const { key, data } of bp.inserts) await attempt(`bloc ${key}`, () => ContentBlock.create({ key, data }));
    for (const { key, data, before } of bp.updates) {
      await attempt(`bloc ${key}`, async () => {
        await record({ target: `block:${key}`, action: 'sync', label: key, before, by: 'synchronisation' });
        await ContentBlock.updateOne({ key }, { $set: { data } });
      });
    }
  }
  report.blocs = { ajoutés: bp.inserts.length, misÀJour: bp.updates.length, conservés: bp.kept };

  // Collections
  for (const [name, Model] of Object.entries(COLLECTIONS)) {
    const existing = (await Model.find()).map((d) => d.toObject());
    const plan = planCollection(name, { base: asCollection(base, name), next: asCollection(next, name), existing });
    if (!dryRun) {
      const last = await Model.findOne().sort({ order: -1 }).select('order');
      let order = last ? (last.order ?? 0) + 1 : 0;
      for (const item of plan.inserts) {
        await attempt(`${name} « ${item.seedKey} »`, () => Model.create({ ...item, order: order++, active: item.active !== false }));
      }
      for (const { id, set, before, stampOnly } of plan.updates) {
        await attempt(`${name} ${id}`, async () => {
          if (!stampOnly) await record({ target: name, docId: id, action: 'sync', label: 'Correction depuis le site', before, by: 'synchronisation' });
          await Model.updateOne({ _id: new mongoose.Types.ObjectId(id) }, { $set: set }, { runValidators: true });
        });
      }
    }
    report[name] = { ajoutés: plan.inserts.length, misÀJour: plan.updates.filter((u) => !u.stampOnly).length, conservés: plan.kept };
  }

  if (errors.length) {
    // La référence n'avance pas : les éléments refusés seront retentés au prochain démarrage.
    console.error(`[sync] ${errors.length} élément(s) non synchronisé(s) :\n  - ${errors.slice(0, 20).join('\n  - ')}`);
  } else if (!dryRun) {
    await SyncState.findByIdAndUpdate('site', { data: next, appliedAt: new Date() }, { upsert: true });
  }
  if (!dryRun) invalidateContentCache();
  log(`[sync] ${dryRun ? 'Simulation' : 'Synchronisation'} terminée : ${JSON.stringify(report)}`);
  report.erreurs = errors.length;
  return report;
}

const mask = (email) => email.replace(/^(.{2}).*(@.*)$/, '$1***$2');

/**
 * Compte administrateur depuis les variables Render ADMIN_EMAIL et ADMIN_PASSWORD :
 *  - aucun administrateur en base → le compte est créé ;
 *  - ADMIN_RESET=true → le compte ADMIN_EMAIL est créé ou son mot de passe réinitialisé
 *    (déblocage compris, autres sessions déconnectées) ;
 *  - sinon les comptes existants ne sont jamais modifiés.
 * Retirez ADMIN_PASSWORD (et ADMIN_RESET) une fois connecté.
 */
export async function bootstrapAdmin({ log = console.log } = {}) {
  const { email, password } = env.admin;
  const reset = process.env.ADMIN_RESET === 'true';
  const admins = await AdminUser.find().select('email').lean();

  if (!email || !password) {
    if (!admins.length) log('[admin] Aucun administrateur. Renseignez ADMIN_EMAIL et ADMIN_PASSWORD dans Render, puis redémarrez.');
    return false;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    log('[admin] ADMIN_EMAIL invalide : aucun compte créé ni modifié.');
    return false;
  }
  const weak = checkPasswordStrength(password);
  if (weak.length) {
    log(`[admin] ADMIN_PASSWORD refusé (${weak.join(', ')}) : aucun compte créé ni modifié.`);
    return false;
  }

  const existing = await AdminUser.findOne({ email }).select('+passwordHash');
  if (existing && reset) {
    existing.passwordHash = await bcrypt.hash(password, 12);
    existing.tokenVersion += 1;
    existing.failedAttempts = 0;
    existing.lockUntil = null;
    await existing.save();
    log(`[admin] Mot de passe réinitialisé pour ${mask(email)}. Retirez maintenant ADMIN_PASSWORD et ADMIN_RESET des variables Render.`);
    return true;
  }
  if (existing) {
    log(`[admin] Le compte ${mask(email)} existe déjà : mot de passe inchangé. Pour le réinitialiser, ajoutez ADMIN_RESET=true puis redémarrez.`);
    return false;
  }
  if (admins.length && !reset) {
    log(`[admin] ${admins.length} autre(s) compte(s) existe(nt) déjà (${admins.map((a) => mask(a.email)).join(', ')}) : ${mask(email)} non créé. Ajoutez ADMIN_RESET=true pour le créer.`);
    return false;
  }
  await AdminUser.create({ email, passwordHash: await bcrypt.hash(password, 12) });
  log(`[admin] Administrateur créé : ${mask(email)}. Retirez maintenant ADMIN_PASSWORD${reset ? ' et ADMIN_RESET' : ''} des variables Render.`);
  return true;
}

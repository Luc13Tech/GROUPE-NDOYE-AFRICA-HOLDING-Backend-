import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { KEYS, planBlocks, planCollection } from '../src/services/syncPlan.js';

const read = (f) => JSON.parse(fs.readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const base = read('seed.base.json');
const next = read('seed.json');
const clone = (x) => JSON.parse(JSON.stringify(x));
// Documents tels que l'ancien chargement les a créés : ordre = position, sans repère.
const legacyDocs = (items) => items.map((it, i) => ({ ...clone(it), _id: `id${i}`, order: i, active: true }));

test('base vide : tout le contenu du site est ajouté', () => {
  const plan = planCollection('gallery', { base: [], next: next.gallery, existing: [] });
  assert.equal(plan.inserts.length, next.gallery.length);
  assert.ok(plan.inserts.every((x) => x.seedKey === KEYS.gallery(x)));
});

test("base de l'ancien chargement : corrections du site appliquées, rien d'ajouté en double", () => {
  const existing = legacyDocs(base.gallery);
  const plan = planCollection('gallery', { base: base.gallery, next: next.gallery, existing });
  assert.equal(plan.inserts.length, 0);
  const real = plan.updates.filter((u) => !u.stampOnly);
  assert.deepEqual(real.map((u) => u.set.src).sort(), ['/Images/yaye-dia/villa-f4duplex.jpg', '/Images/yaye-dia/villa-f4pp-plan2.jpg']);
  assert.ok(real.every((u) => u.before.src)); // l'ancienne valeur est gardée dans l'historique
  assert.equal(plan.updates.length, next.gallery.length); // chaque document reçoit son repère
});

test("une modification faite dans l'administration n'est jamais écrasée", () => {
  const existing = legacyDocs(base.gallery);
  existing[16].src = '/Images/yaye-dia/photo-choisie-par-admin.jpg';
  const plan = planCollection('gallery', { base: base.gallery, next: next.gallery, existing });
  assert.equal(plan.kept, 1);
  const u16 = plan.updates.find((u) => u.id === 'id16');
  assert.equal(u16.stampOnly, true);
  assert.equal(u16.set.src, undefined);
});

test("un élément renommé dans l'administration n'est pas recréé (repère seedKey)", () => {
  const existing = legacyDocs(next.services).map((d) => ({ ...d, seedKey: KEYS.services(d) }));
  existing[0].fr = { ...existing[0].fr, title: 'Nouveau titre choisi par l’admin' };
  const plan = planCollection('services', { base: next.services, next: next.services, existing });
  assert.equal(plan.inserts.length, 0);
  assert.equal(plan.kept, 1);
});

test('un élément mis à la corbeille n’est pas réinséré ; un élément absent de la base est rajouté', () => {
  const existing = legacyDocs(next.videos).map((d) => ({ ...d, seedKey: KEYS.videos(d) }));
  existing[1].deletedAt = new Date().toISOString();
  existing.splice(2, 1); // disparu de la base (ancienne suppression définitive)
  const plan = planCollection('videos', { base: next.videos, next: next.videos, existing });
  assert.equal(plan.inserts.length, 1);
  assert.equal(plan.inserts[0].fr.title, next.videos[2].fr.title);
});

test('partenaires : 7 mondiaux et 11 pays africains reconnus sans doublon', () => {
  const all = (s) => [...s.partners.world, ...s.partners.africa];
  assert.equal(next.partners.world.length, 7);
  assert.equal(next.partners.africa.length, 11);
  const plan = planCollection('partners', { base: all(base), next: all(next), existing: legacyDocs(all(base)) });
  assert.equal(plan.inserts.length, 0);
  assert.equal(plan.updates.filter((u) => !u.stampOnly).length, 0);
});

test('blocs : ajout des nouveaux, correction si intact, conservation si modifié', () => {
  const existing = clone(base.blocks);
  existing.tagline = { fr: 'Texte modifié dans l’admin' };
  const plan = planBlocks({ base: base.blocks, next: next.blocks, existing });
  assert.deepEqual(plan.inserts.map((i) => i.key).sort(), ['collabBenefits', 'collabTypes', 'contactSubjects', 'expertiseList', 'processSteps']);
  assert.deepEqual(plan.updates.map((u) => u.key).sort(), ['site', 'yayeSlides']);
  assert.equal(plan.updates.find((u) => u.key === 'site').data.email, 'Contact@groupendoyeafrica.com');
  assert.equal(plan.kept, 1); // la tagline modifiée dans l'administration est conservée
});

test('relancer la synchronisation ne change plus rien', () => {
  const existing = legacyDocs(next.gallery).map((d) => ({ ...d, seedKey: KEYS.gallery(d) }));
  const plan = planCollection('gallery', { base: next.gallery, next: next.gallery, existing });
  assert.equal(plan.inserts.length + plan.updates.length, 0);
});

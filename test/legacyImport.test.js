import assert from 'node:assert/strict';
import { test } from 'node:test';
import { convertLegacy } from '../src/services/legacyImport.js';

test("conversion des données de l'ancien tableau de bord", () => {
  const { collections, settings } = convertLegacy({
    gnah_services: JSON.stringify([{ id: 1, active: true, icon: 'leaf', title_fr: 'Agro', title_en: 'Agri', desc_fr: 'Desc', desc_en: 'Desc EN' }]),
    gnah_projets: [{ id: 2, active: false, category: 'Énergie', img: 'data:image/png;base64,AAAA', title: { fr: 'Solaire' }, desc: { fr: 'Parc' }, waMsg: { fr: 'Bonjour' } }],
    gnah_gallery: [{ id: 3, title: 'Façade', title_en: 'Facade', img: '/Images/x.jpg', category: 'Plans 3D' }, { id: 4, title: 'Sans image' }],
    gnah_partners: [{ id: 5, country: 'Japon', code: 'jp', focus: 'Technologie', focus_en: 'Technology' }, { id: 6, country: 'Sans code', focus: 'x' }],
    gnah_companies: [{ id: 7, name: 'Entreprise', sector: { fr: 'BTP' }, desc: { fr: 'Description' }, website: '#' }],
    gnah_settings: JSON.stringify({ phone: '+221 00', email: 'a@b.cd' }),
  });
  assert.deepEqual(collections.services[0], { icon: 'leaf', active: true, fr: { title: 'Agro', desc: 'Desc' }, en: { title: 'Agri', desc: 'Desc EN' } });
  assert.equal(collections.projects[0].img, ''); // image collée en base64 non reprise
  assert.equal(collections.projects[0].active, false);
  assert.equal(collections.gallery.length, 1);
  assert.equal(collections.gallery[0].cat, 'plans');
  assert.equal(collections.partners.length, 1);
  assert.equal(collections.partners[0].code, 'JP');
  assert.equal(collections.companies[0].name, 'Entreprise');
  assert.equal(settings.phone, '+221 00');
});

test('entrées invalides ignorées sans erreur', () => {
  const { collections } = convertLegacy({ gnah_services: '{pas du json', gnah_gallery: 'null', gnah_partners: [null, 3, 'x'] });
  assert.deepEqual(collections.services, []);
  assert.deepEqual(collections.gallery, []);
  assert.deepEqual(collections.partners, []);
});

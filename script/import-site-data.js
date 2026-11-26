// Régénère data/seed.json à partir des données du site (src/data/siteData.js du dépôt frontend).
//   npm run import-site-data -- ../GROUPE-NDOYE-AFRICA-HOLDING
// Au prochain démarrage, la synchronisation sans perte ajoute ce qui manque dans la base
// et applique les corrections du site uniquement là où l'administration n'a rien modifié.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const frontend = path.resolve(process.argv[2] || '../GROUPE-NDOYE-AFRICA-HOLDING');
const source = path.join(frontend, 'src/data/siteData.js');
if (!fs.existsSync(source)) {
  console.error(`Fichier introuvable : ${source}\nIndiquez le dossier du dépôt frontend : npm run import-site-data -- <dossier>`);
  process.exit(1);
}

// siteData.js est un module ES sans dépendance : on le charge depuis une copie .mjs temporaire.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gnah-'));
const copy = path.join(tmp, 'siteData.mjs');
fs.copyFileSync(source, copy);
const d = await import(pathToFileURL(copy).href);
fs.rmSync(tmp, { recursive: true, force: true });

const without = (obj, ...keys) => Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));
const SITE_FIELDS = ['name', 'short', 'phone', 'phoneFixed', 'whatsapp', 'email', 'address_fr', 'lat', 'lng', 'mapsUrl', 'social', 'waMsg'];

const seed = {
  blocks: {
    site: Object.fromEntries(SITE_FIELDS.filter((k) => d.SITE[k] !== undefined).map((k) => [k, d.SITE[k]])),
    tagline: d.TAGLINE,
    subtitle: d.SUBTITLE,
    stats: d.STATS,
    operations: d.OPERATIONS,
    investCapacity: d.INVEST_CAPACITY,
    commitments: d.COMMITMENTS,
    africaOpps: d.AFRICA_OPPS,
    companyIntro: d.COMPANY_INTRO,
    consortium: d.CONSORTIUM,
    strategy: d.STRATEGY,
    objectives: d.OBJECTIVES,
    amenities: d.AMENITIES,
    lotissement: d.LOTISSEMENT,
    archPhilosophy: d.ARCH_PHILOSOPHY,
    materials: d.MATERIALS,
    yayeSlides: d.YAYE_SLIDES,
    collabBenefits: d.COLLAB_BENEFITS,
    collabTypes: d.COLLAB_TYPES,
    expertiseList: d.EXPERTISE_LIST,
    processSteps: d.PROCESS_STEPS,
    contactSubjects: d.CONTACT_SUBJECTS,
  },
  services: d.SERVICES.map((s) => without(s, 'id')),
  villas: d.VILLA_TYPES.map(({ id, ...v }) => ({ code: id, ...v })),
  partners: {
    world: d.PARTNERS_WORLD.map((p) => ({ kind: 'world', ...without(p, 'id') })),
    africa: d.AFRICA_PARTNERS.map((name) => ({ kind: 'africa', name })),
  },
  companies: d.COMPANIES.map((c) => without(c, 'id')),
  projects: d.PROJECTS.map((p) => without(p, 'id')),
  gallery: d.GALLERY_ITEMS.map((g) => without(g, 'id')),
  videos: d.VIDEOS.map((v) => without(v, 'id')),
  ads: (d.ADS || []).map((a) => without(a, 'id')),
};

for (const [key, value] of Object.entries(seed.blocks)) {
  if (value === undefined) {
    console.error(`Donnée manquante dans siteData.js pour le bloc « ${key} ».`);
    process.exit(1);
  }
}

const target = new URL('../data/seed.json', import.meta.url);
fs.writeFileSync(target, `${JSON.stringify(seed, null, 2)}\n`);
const count = (x) => (Array.isArray(x) ? x.length : Object.values(x).reduce((n, v) => n + v.length, 0));
console.log(
  `✔ data/seed.json régénéré : ${Object.keys(seed.blocks).length} blocs, ` +
    ['services', 'villas', 'partners', 'companies', 'projects', 'gallery', 'videos', 'ads'].map((k) => `${k} ${count(seed[k])}`).join(', ')
);

// Charge dans MongoDB les données actuelles du site (identiques à siteData.js, Gallery.js et Videos.js).
// Idempotent : une collection déjà remplie n'est jamais écrasée.
//   npm run seed                              → complète ce qui est vide
//   CONFIRM_RESET=yes npm run seed -- --reset → efface TOUT le contenu puis recharge (jamais les administrateurs)
import fs from 'node:fs';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { assertEnv } from '../src/config/env.js';
import { Ad } from '../src/models/Ad.js';
import { Company } from '../src/models/Company.js';
import { ContentBlock } from '../src/models/ContentBlock.js';
import { GalleryItem } from '../src/models/GalleryItem.js';
import { Partner } from '../src/models/Partner.js';
import { Project } from '../src/models/Project.js';
import { Service } from '../src/models/Service.js';
import { Video } from '../src/models/Video.js';
import { Villa } from '../src/models/Villa.js';

assertEnv(['MONGODB_URI']);

const seed = JSON.parse(fs.readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const reset = process.argv.includes('--reset');

if (reset && process.env.CONFIRM_RESET !== 'yes') {
  console.error('« --reset » efface le contenu du site. Relancez avec CONFIRM_RESET=yes pour confirmer.');
  process.exit(1);
}

const withOrder = (items) => items.map((item, order) => ({ ...item, order, active: item.active !== false }));

async function fill(label, Model, items) {
  if (reset) await Model.deleteMany({});
  const existing = await Model.estimatedDocumentCount();
  if (existing > 0) {
    console.log(`• ${label} : ${existing} déjà présent(s) — ignoré`);
    return;
  }
  if (!items.length) {
    console.log(`• ${label} : aucune donnée de départ`);
    return;
  }
  await Model.insertMany(withOrder(items));
  console.log(`✔ ${label} : ${items.length} créé(s)`);
}

async function main() {
  await connectDB();

  if (reset) await ContentBlock.deleteMany({});
  let blocks = 0;
  for (const [key, data] of Object.entries(seed.blocks)) {
    if (!(await ContentBlock.exists({ key }))) {
      await ContentBlock.create({ key, data });
      blocks += 1;
    }
  }
  console.log(`✔ Blocs de contenu : ${blocks} créé(s), ${Object.keys(seed.blocks).length - blocks} déjà présent(s)`);

  await fill('Services', Service, seed.services);
  await fill('Villas', Villa, seed.villas);
  await fill('Partenaires (monde + Afrique)', Partner, [...seed.partners.world, ...seed.partners.africa]);
  await fill('Entreprises', Company, seed.companies);
  await fill('Projets', Project, seed.projects);
  await fill('Galerie', GalleryItem, seed.gallery);
  await fill('Vidéos', Video, seed.videos);
  await fill('Publicités', Ad, seed.ads);

  console.log('Terminé.');
  await disconnectDB();
}

main().catch(async (err) => {
  console.error('Échec du chargement :', err.message);
  if (err.errors) console.error(Object.values(err.errors).map((e) => `  - ${e.path} : ${e.message}`).join('\n'));
  await disconnectDB().catch(() => {});
  process.exit(1);
});

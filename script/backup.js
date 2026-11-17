// Sauvegarde complète du contenu (corbeille comprise ; jamais les comptes administrateurs)
// dans backups/gnah-sauvegarde-AAAA-MM-JJ-HH-MM.json (dossier ignoré par Git).
// Le fichier peut être réimporté depuis l'administration : seuls les éléments manquants sont recréés.
//   npm run backup
import fs from 'node:fs';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { assertEnv } from '../src/config/env.js';
import { exportData } from '../src/services/importService.js';

assertEnv(['MONGODB_URI']);

try {
  await connectDB();
  const data = await exportData();
  const dir = new URL('../backups/', import.meta.url);
  fs.mkdirSync(dir, { recursive: true });
  const file = new URL(`gnah-sauvegarde-${data.exportedAt.slice(0, 16).replace(/[:T]/g, '-')}.json`, dir);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  const total = Object.values(data.collections).reduce((n, list) => n + list.length, 0);
  console.log(`✔ Sauvegarde : ${Object.keys(data.blocks).length} blocs, ${total} éléments → ${file.pathname}`);
} catch (err) {
  console.error('Échec de la sauvegarde :', err.message);
  process.exitCode = 1;
} finally {
  await disconnectDB().catch(() => {});
}

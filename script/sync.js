// Synchronisation SANS PERTE du contenu du site (data/seed.json) vers MongoDB.
// Elle a lieu automatiquement à chaque démarrage du serveur ; ce script permet de la lancer à la main.
//   npm run sync          → applique
//   npm run sync:check    → simulation : affiche ce qui serait ajouté ou corrigé, sans rien écrire
// Rien n'est jamais supprimé ni écrasé : seules les données absentes sont ajoutées, et une correction
// du site n'est appliquée que si l'élément n'a pas été modifié depuis l'administration.
import { connectDB, disconnectDB } from '../src/config/db.js';
import { assertEnv } from '../src/config/env.js';
import { syncContent } from '../src/services/syncService.js';

assertEnv(['MONGODB_URI']);

const dryRun = process.argv.includes('--dry-run');

try {
  await connectDB();
  await syncContent({ dryRun });
} catch (err) {
  console.error('Échec de la synchronisation :', err.message);
  process.exitCode = 1;
} finally {
  await disconnectDB().catch(() => {});
}

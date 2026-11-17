import mongoose from 'mongoose';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { SERVER_KEYS, assertEnv, env } from './config/env.js';
import { bootstrapAdmin, syncContent } from './services/syncService.js';

assertEnv(SERVER_KEYS);

async function main() {
  await connectDB();

  // Premier administrateur (si aucun) puis synchronisation SANS PERTE du contenu du site.
  // Une erreur ici est signalée mais n'empêche jamais le site de fonctionner.
  try {
    await bootstrapAdmin();
  } catch (err) {
    console.error('[admin] Création du premier administrateur impossible :', err.message);
  }
  if (process.env.SYNC_ON_START !== 'false') {
    try {
      await syncContent();
    } catch (err) {
      console.error('[sync] Synchronisation impossible (aucune donnée modifiée) :', err.message);
    }
  }

  const app = createApp();
  const server = app.listen(env.port, '0.0.0.0', () => {
    console.log(`[api] En écoute sur le port ${env.port} (${env.isProd ? 'production' : 'développement'})`);
    console.log(`[admin] Administration : ${env.publicOrigin}/`);
  });

  const shutdown = (signal) => {
    console.log(`[api] ${signal} reçu, arrêt en cours…`);
    server.close(async () => {
      await mongoose.connection.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

process.on('unhandledRejection', (err) => console.error('[api] unhandledRejection :', err));

main().catch((err) => {
  console.error('[api] Démarrage impossible :', err.message);
  process.exit(1);
});

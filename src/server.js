import mongoose from 'mongoose';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { SERVER_KEYS, assertEnv, env } from './config/env.js';
import { AdminUser } from './models/AdminUser.js';

assertEnv(SERVER_KEYS);

async function main() {
  await connectDB();

  if ((await AdminUser.estimatedDocumentCount()) === 0) {
    console.warn('[admin] Aucun administrateur : lancez « npm run create-admin » (voir README).');
  }

  const app = createApp();
  const server = app.listen(env.port, '0.0.0.0', () => {
    console.log(`[api] En écoute sur le port ${env.port} (${env.isProd ? 'production' : 'développement'})`);
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

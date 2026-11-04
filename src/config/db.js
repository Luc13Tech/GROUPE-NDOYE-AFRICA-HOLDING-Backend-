import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.set('strictQuery', true);
// Neutralise les opérateurs MongoDB ($ne, $gt…) injectés dans les filtres.
mongoose.set('sanitizeFilter', true);

export async function connectDB() {
  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 15000,
    maxPoolSize: 10,
  });
  console.log('[db] MongoDB connecté');
}

export async function disconnectDB() {
  await mongoose.disconnect();
}

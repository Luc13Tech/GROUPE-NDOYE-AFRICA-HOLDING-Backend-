// Crée (ou réinitialise) le compte administrateur. Le mot de passe est lu dans l'environnement,
// haché avec bcrypt, puis jamais stocké ni affiché en clair.
//   1. Renseignez ADMIN_EMAIL et ADMIN_PASSWORD dans votre .env LOCAL (jamais sur GitHub)
//   2. npm run create-admin
//   3. Supprimez ensuite ces deux lignes du .env
import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { assertEnv, env } from '../src/config/env.js';
import { AdminUser } from '../src/models/AdminUser.js';
import { checkPasswordStrength } from '../src/utils/password.js';

assertEnv(['MONGODB_URI']);

const email = env.admin.email;
const password = env.admin.password;

if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
  console.error('ADMIN_EMAIL manquant ou invalide.');
  process.exit(1);
}
const weak = checkPasswordStrength(password);
if (weak.length) {
  console.error(`ADMIN_PASSWORD refusé : ${weak.join(', ')}.`);
  process.exit(1);
}

async function main() {
  await connectDB();
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await AdminUser.findOne({ email }).select('+passwordHash');
  if (existing) {
    existing.passwordHash = passwordHash;
    existing.tokenVersion += 1; // déconnecte les sessions ouvertes
    existing.failedAttempts = 0;
    existing.lockUntil = null;
    await existing.save();
    console.log(`✔ Mot de passe réinitialisé pour ${email}`);
  } else {
    await AdminUser.create({ email, passwordHash });
    console.log(`✔ Administrateur créé : ${email}`);
  }
  console.log('Pensez à retirer ADMIN_EMAIL et ADMIN_PASSWORD de votre .env.');
  await disconnectDB();
}

main().catch(async (err) => {
  console.error('Échec :', err.message);
  await disconnectDB().catch(() => {});
  process.exit(1);
});

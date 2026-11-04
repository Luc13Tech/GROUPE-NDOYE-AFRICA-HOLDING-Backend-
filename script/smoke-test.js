// Vérifie un backend DÉPLOYÉ : disponibilité, contenu, en-têtes de sécurité, CORS, protection de l'admin.
//   npm run smoke-test -- https://api.groupendoyeafrica.com
// Option : ADMIN_EMAIL + ADMIN_PASSWORD dans l'environnement pour tester aussi la connexion (lecture seule).
import 'dotenv/config';

const BASE = (process.argv[2] || process.env.BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
const ORIGIN = (process.env.TEST_ORIGIN || (process.env.FRONTEND_ORIGIN || 'https://groupendoyeafrica.com').split(',')[0]).trim().replace(/\/+$/, '');

const rows = [];
let failures = 0;
const record = (status, name, info = '') => {
  rows.push([status, name, info]);
  if (status === 'FAIL') failures += 1;
};
const check = (cond, name, info = '') => record(cond ? 'OK' : 'FAIL', name, info);
const warn = (cond, name, info = '') => record(cond ? 'OK' : 'WARN', name, info);

const call = (path, { method = 'GET', headers = {}, body } = {}) =>
  fetch(`${BASE}${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });

const cookiesOf = (res) => {
  const raw = res.headers.getSetCookie?.() ?? (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
  return raw.map((c) => c.split(';')[0]).join('; ');
};

async function main() {
  console.log(`Test de ${BASE} (origine simulée : ${ORIGIN})\n`);

  // 1. Santé
  const t0 = Date.now();
  let res = await call('/api/health');
  const health = await res.json().catch(() => ({}));
  check(res.status === 200 && health.status === 'ok', 'Santé /api/health', `${Date.now() - t0} ms`);
  check(health.db === 'up', 'Base MongoDB connectée');
  warn(Date.now() - t0 < 5000, 'Temps de réponse < 5 s', 'sinon : service en veille (démarrage à froid)');

  // 2. Contenu public
  res = await call('/api/content', { headers: { Origin: ORIGIN } });
  const content = await res.json().catch(() => ({}));
  check(res.status === 200 && content.blocks, 'Contenu public /api/content');
  const n = (x) => (Array.isArray(x) ? x.length : -1);
  const expected = [
    ['Services', n(content.services), 6],
    ['Villas', n(content.villas), 4],
    ['Partenaires mondiaux', n(content.partners?.world), 7],
    ['Pays africains partenaires', n(content.partners?.africa), 11],
    ['Entreprises', n(content.companies), 3],
    ['Projets', n(content.projects), 3],
    ['Vidéos', n(content.videos), 4],
    ['Photos de galerie', n(content.gallery), 28],
  ];
  for (const [label, got, want] of expected) {
    warn(got === want, `${label} : ${got}`, got === want ? '' : `attendu ${want} après le chargement initial (normal si modifié depuis l'admin)`);
  }
  check(!JSON.stringify(content).includes('admin123'), 'Aucun mot de passe dans le contenu public');

  // 3. En-têtes de sécurité
  const h = res.headers;
  check(h.get('x-content-type-options') === 'nosniff', 'En-tête X-Content-Type-Options');
  check(!h.get('x-powered-by'), 'X-Powered-By masqué');
  if (BASE.startsWith('https://')) check(Boolean(h.get('strict-transport-security')), 'HSTS actif');

  // 4. CORS
  res = await call('/api/content', { headers: { Origin: 'https://site-malveillant.example' } });
  check(!res.headers.get('access-control-allow-origin'), 'CORS : origine inconnue refusée');
  res = await call('/api/content', { headers: { Origin: ORIGIN } });
  check(res.headers.get('access-control-allow-origin') === ORIGIN, 'CORS : origine du site autorisée', res.headers.get('access-control-allow-origin') || 'absent');

  // 5. Protection de l'administration
  res = await call('/api/admin/overview', { headers: { Origin: ORIGIN } });
  check(res.status === 401, 'Admin sans session → 401', `reçu ${res.status}`);
  res = await call('/api/auth/login', { method: 'POST', body: { email: 'x@x.xx', password: 'x' } });
  check(res.status === 403, 'Écriture sans origine autorisée → 403', `reçu ${res.status}`);
  res = await call('/api/auth/login', { method: 'POST', headers: { Origin: ORIGIN }, body: { email: 'inconnu@exemple.com', password: 'mauvais-mot-de-passe' } });
  check(res.status === 401, 'Mauvais identifiants → 401', `reçu ${res.status}`);
  res = await call('/api/inexistant');
  check(res.status === 404, 'Route inconnue → 404');

  // 6. Connexion réelle (optionnelle, lecture seule)
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    res = await call('/api/auth/login', { method: 'POST', headers: { Origin: ORIGIN }, body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
    const login = await res.json().catch(() => ({}));
    check(res.status === 200 && login.csrfToken, 'Connexion administrateur', `statut ${res.status}`);
    if (res.status === 200) {
      const cookie = cookiesOf(res);
      const setCookie = (res.headers.getSetCookie?.() ?? []).join(' ').toLowerCase();
      check(setCookie.includes('httponly'), 'Cookie de session HttpOnly');
      if (BASE.startsWith('https://')) check(setCookie.includes('secure'), 'Cookie de session Secure');
      res = await call('/api/admin/overview', { headers: { Origin: ORIGIN, Cookie: cookie } });
      check(res.status === 200, 'Admin avec session → 200', `reçu ${res.status}`);
      res = await call('/api/admin/ads/reorder', { method: 'PUT', headers: { Origin: ORIGIN, Cookie: cookie }, body: { ids: ['0'.repeat(24)] } });
      check(res.status === 403, 'Écriture sans jeton CSRF → 403', `reçu ${res.status}`);
      res = await call('/api/auth/logout', { method: 'POST', headers: { Origin: ORIGIN, Cookie: cookie } });
      check(res.status === 200, 'Déconnexion');
    }
  } else {
    record('WARN', 'Connexion administrateur non testée', 'renseignez ADMIN_EMAIL et ADMIN_PASSWORD pour la tester');
  }

  // Rapport
  const icon = { OK: '✔', WARN: '⚠', FAIL: '✖' };
  for (const [status, name, info] of rows) console.log(`${icon[status]} ${name}${info ? `  — ${info}` : ''}`);
  const warns = rows.filter((r) => r[0] === 'WARN').length;
  console.log(`\n${rows.length - failures - warns} réussi(s), ${warns} avertissement(s), ${failures} échec(s).`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error('Test impossible :', err.message);
  process.exit(1);
});

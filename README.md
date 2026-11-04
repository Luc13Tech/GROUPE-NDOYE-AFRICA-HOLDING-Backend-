# GNAH Backend — API sécurisée

API Node.js (Express + MongoDB + Cloudinary) du site **Groupe Ndoye Africa Holding**.
Elle porte l'**administration** (contenu en 5 langues, médias, publicités) et fournit au site public son contenu.

```
Navigateur ──► groupendoyeafrica.com  (Vercel — frontend)
          └──► api.groupendoyeafrica.com  (Render — cette API) ──► MongoDB Atlas + Cloudinary
```

## 1. MongoDB Atlas
1. Créez un cluster gratuit (M0), puis **Database Access** → un utilisateur avec un mot de passe fort (lettres et chiffres, évitez `@ : / ?`).
2. **Network Access** → autorisez `0.0.0.0/0` (les adresses de Render changent ; la sécurité repose sur l'utilisateur et son mot de passe).
3. **Connect → Drivers** → copiez la chaîne et **ajoutez le nom de base** : `mongodb+srv://USER:MOT_DE_PASSE@cluster.xxxx.mongodb.net/gnah?retryWrites=true&w=majority`

## 2. Cloudinary
**Dashboard → API Keys** : notez *Cloud name*, *API Key*, *API Secret*. Les images seront rangées dans `gnah/ads`, `gnah/gallery`, `gnah/companies`…

## 3. Render (service web)
1. **New → Web Service**, reliez le dépôt GitHub `gnah-backend`.
2. Runtime **Node** · Build Command `npm install` · Start Command `npm start` · **Health Check Path** `/api/health` · Région **Frankfurt** (la plus proche de l'Afrique de l'Ouest).
3. **Environment** — saisissez ces variables (jamais dans GitHub, jamais dans un chat) :

| Variable | Valeur |
|---|---|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | la chaîne Atlas du point 1 |
| `JWT_SECRET` | 48 octets aléatoires : `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"` |
| `FRONTEND_ORIGIN` | `https://groupendoyeafrica.com` (ajoutez `,https://www.groupendoyeafrica.com` si ce domaine est utilisé) |
| `COOKIE_SAMESITE` | `strict` |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | depuis Cloudinary |

## 4. Sous-domaine `api.groupendoyeafrica.com`
1. Render → votre service → **Settings → Custom Domains → Add** : `api.groupendoyeafrica.com`.
2. Chez le gestionnaire DNS du domaine, créez l'enregistrement **CNAME** `api` → `<votre-service>.onrender.com` (Render affiche la valeur exacte).
3. Attendez la validation (quelques minutes) : le certificat HTTPS est automatique.

> Site et API partagent le même domaine principal : le cookie de session reste fiable sur Safari et Chrome.

## 5. Premier chargement (depuis votre ordinateur)
```bash
git clone … && cd gnah-backend && npm install
cp .env.example .env        # renseignez MONGODB_URI (même base qu'en production), puis :
npm run seed                # charge les données actuelles du site (idempotent)
```
Créez ensuite l'administrateur : ajoutez `ADMIN_EMAIL` et `ADMIN_PASSWORD` dans votre `.env` **local**
(12 caractères minimum, majuscule, minuscule, chiffre, symbole), lancez `npm run create-admin`, puis **supprimez ces deux lignes**.

## 6. Vérification
```bash
npm run smoke-test -- https://api.groupendoyeafrica.com
```
Contrôle : santé, contenu (11 pays africains, 7 partenaires, 6 services, 4 villas, 3 entreprises…), en-têtes de sécurité, CORS, protection de l'administration. Avec `ADMIN_EMAIL` et `ADMIN_PASSWORD`, il teste aussi la connexion (lecture seule).

## Sécurité en bref
- Mot de passe haché (bcrypt, coût 12), blocage 15 min après 5 échecs, 10 tentatives de connexion / 15 min / IP.
- Session : cookie `HttpOnly` + `Secure` + `SameSite=Strict` (préfixe `__Host-`), 2 h, invalidée au changement de mot de passe.
- Anti-CSRF : origine contrôlée **et** jeton `X-CSRF-Token` pour toute écriture.
- CORS limité à `FRONTEND_ORIGIN`, `helmet`, limitation de débit, filtres anti-injection NoSQL, validation de chaque champ.
- Images : envoi **signé** vers Cloudinary (formats jpg, png, webp, avif) ; seules les URLs Cloudinary de votre compte, Unsplash ou des chemins `/Images/…` sont acceptées.

## Render gratuit : mise en veille
Après ~15 min sans visite, le service s'endort ; la requête suivante peut prendre 30–60 s. Le site public n'en souffre pas (il garde ses données intégrées), mais l'administration sera lente au premier chargement. Solutions : formule payante, ou un ping toutes les 10 min sur `/api/health` (UptimeRobot, gratuit).

## Points d'accès (pour le frontend)
- Public : `GET /api/health`, `GET /api/content`, `GET /api/ads`
- Session : `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`, `PUT /api/auth/password`
- Admin (session + en-tête `X-CSRF-Token` pour écrire, requêtes avec `credentials: 'include'`) :
  `GET /api/admin/overview`, `GET|PUT /api/admin/blocks/:clé`,
  `/api/admin/{services,villas,partners,companies,projects,gallery,ads,videos}` (liste, création, `GET|PUT|DELETE /:id`, `PATCH /:id/active`, `PUT /reorder`),
  `POST /api/admin/uploads/sign` (`{ "folder": "ads" }` → signature Cloudinary).
- Variable du frontend (CRA/Vercel) : `REACT_APP_API_URL=https://api.groupendoyeafrica.com`

## En cas de souci
- **CORS / cookie absent** : `FRONTEND_ORIGIN` doit être exactement l'adresse du site (https, sans « / » final).
- **Connexion impossible** : relancez `npm run create-admin` (réinitialise aussi le blocage).
- **Rien ne démarre** : les logs Render indiquent la variable manquante.
- Si une clé a été exposée (chat, capture, GitHub) : régénérez-la aussitôt (Atlas, Cloudinary) et mettez à jour Render.

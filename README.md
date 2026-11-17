# GNAH Backend — API et administration

Serveur Node.js (Express + MongoDB + Cloudinary) du site **Groupe Ndoye Africa Holding**.
Il fournit au site public son contenu et **héberge l'espace d'administration**, séparé du site :

```
Visiteurs ──► groupendoyeafrica.com            (Vercel — site public, lecture seule)
                     │  GET /api/content
                     ▼
Administrateur ──► api.groupendoyeafrica.com/   (Render — ce dépôt : administration + API) ──► MongoDB Atlas + Cloudinary
```

- **Administration** : <https://api.groupendoyeafrica.com/> (page de connexion). L'ancienne adresse `groupendoyeafrica.com/admin` y renvoie.
- Le site public garde une copie intégrée de ses données (`src/data/siteData.js`) : si l'API est injoignable, il reste complet.

## Aucune perte de données

| Situation | Ce qui se passe |
|---|---|
| « Supprimer » dans l'administration | L'élément part dans la **corbeille** ; il est restaurable à tout moment. Aucune suppression définitive n'existe. |
| Modifier, masquer, réordonner | L'état précédent est copié dans l'**historique** ; « Rétablir l'état d'avant » le remet en place. |
| Changer une image | L'ancienne image n'est jamais effacée de Cloudinary. |
| Démarrage du serveur | **Synchronisation sans perte** avec `data/seed.json` (contenu du site) : ajoute ce qui manque ; applique une correction du site **seulement** si l'élément n'a pas été modifié dans l'administration ; ne supprime jamais rien. |
| Anciennes modifications faites avec l'ancien tableau de bord (stockées dans le navigateur) | Sur l'appareil utilisé, ouvrir `groupendoyeafrica.com/admin` → « Télécharger les anciennes données », puis administration → **Sauvegarde et import**. Seuls les éléments absents sont ajoutés. |
| Sauvegarde | Administration → **Sauvegarde et import** → « Télécharger une sauvegarde », ou `npm run backup`. Un import ne remplace jamais rien. |

La référence de la synchronisation (contenu appliqué la dernière fois) est conservée dans MongoDB ;
`data/seed.base.json` est le contenu du tout premier chargement, utilisé une seule fois pour reconnaître les données déjà en base.

## 1. MongoDB Atlas
1. Cluster (M0 gratuit possible), **Database Access** → un utilisateur avec un mot de passe fort (lettres et chiffres, évitez `@ : / ?`).
2. **Network Access** → `0.0.0.0/0` (les adresses de Render changent ; la sécurité repose sur l'utilisateur et son mot de passe).
3. **Connect → Drivers** → copiez la chaîne et **ajoutez le nom de base** : `mongodb+srv://USER:MOT_DE_PASSE@cluster.xxxx.mongodb.net/gnah?retryWrites=true&w=majority`

## 2. Cloudinary
**Dashboard → API Keys** : *Cloud name*, *API Key*, *API Secret*. Les images sont rangées dans `gnah/ads`, `gnah/gallery`, `gnah/companies`…

## 3. Render (service web)
Runtime **Node** · Build `npm install` · Start `npm start` · **Health Check Path** `/api/health` · Région **Frankfurt**.

**Environment** — à saisir uniquement dans Render (jamais dans GitHub, jamais dans un chat) :

| Variable | Valeur |
|---|---|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | la chaîne Atlas du point 1 |
| `JWT_SECRET` | 48 octets aléatoires : `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"` |
| `FRONTEND_ORIGIN` | `https://groupendoyeafrica.com` (ajoutez `,https://www.groupendoyeafrica.com` si ce domaine est utilisé) |
| `API_PUBLIC_ORIGIN` | `https://api.groupendoyeafrica.com` |
| `COOKIE_SAMESITE` | `strict` |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | depuis Cloudinary |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | **seulement pour créer le premier compte** (voir point 5), à retirer ensuite |

## 4. Sous-domaine `api.groupendoyeafrica.com`
Render → **Settings → Custom Domains** : `api.groupendoyeafrica.com`, puis chez le gestionnaire DNS un **CNAME** `api` → `<service>.onrender.com`. Le certificat HTTPS est automatique.
L'administration ne fonctionne que sur cette adresse (`API_PUBLIC_ORIGIN`) : depuis l'adresse `…onrender.com`, les écritures sont refusées.

## 5. Premier démarrage
Rien à lancer à la main :
1. Au démarrage, la synchronisation complète la base avec tout le contenu du site (dont les nouveaux blocs : avantages et types de collaboration, expertises, étapes de la méthode, objets du formulaire de contact) et applique les corrections du site (e-mail, image du diaporama, plans de la galerie) là où rien n'a été modifié.
2. S'il n'existe **aucun** administrateur, le compte `ADMIN_EMAIL` / `ADMIN_PASSWORD` est créé (12 caractères minimum, majuscule, minuscule, chiffre, symbole). Un compte existant n'est jamais modifié.
3. Connectez-vous sur <https://api.groupendoyeafrica.com/>, puis **retirez `ADMIN_PASSWORD`** des variables Render.

Les journaux Render affichent le résultat : `[sync] Synchronisation terminée : {…}`.

## 6. Mettre à jour le contenu intégré au site
Après une modification de `src/data/siteData.js` dans le dépôt du site :
```bash
npm run import-site-data -- ../GROUPE-NDOYE-AFRICA-HOLDING   # régénère data/seed.json
npm run sync:check                                          # simulation (base de production via .env local)
```
Puis commit + déploiement : la synchronisation s'applique au redémarrage, sans écraser l'administration.

## Scripts
| Commande | Rôle |
|---|---|
| `npm start` | serveur (synchronisation + premier administrateur au démarrage ; `SYNC_ON_START=false` pour la désactiver) |
| `npm run sync` / `npm run sync:check` | synchronisation sans perte / simulation |
| `npm run import-site-data -- <dossier du site>` | régénère `data/seed.json` depuis `siteData.js` |
| `npm run backup` | sauvegarde JSON dans `backups/` (ignoré par Git) |
| `npm run create-admin` | crée ou réinitialise un administrateur depuis le `.env` **local** |
| `npm run smoke-test -- https://api.groupendoyeafrica.com` | contrôle du serveur déployé |
| `npm test` | tests de la synchronisation et de l'import |

## Organisation
```
admin/            interface d'administration (HTML, CSS, JS sans dépendance), servie à la racine
data/             seed.json (contenu du site) · seed.base.json (premier chargement)
script/           sync, import-site-data, backup, createAdmin, smoke-test
src/config/       environnement, MongoDB, Cloudinary
src/middleware/   authentification, CSRF/origine, limitation, erreurs, assainissement
src/models/       collections MongoDB (index.js : liste des rubriques) · Revision (historique) · SyncState
src/routes/       public, auth, admin (historique, export, import), crud (corbeille), uploads
src/services/     contenu public, historique, synchronisation (syncPlan = calcul pur), import / export
src/utils/        validation, listes de valeurs, mots de passe
test/             tests node:test
```

## Points d'accès
- Public : `GET /api/health`, `GET /api/content`, `GET /api/ads`
- Session : `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`, `PUT /api/auth/password`
- Administration (session + `X-CSRF-Token` pour écrire, depuis `API_PUBLIC_ORIGIN` uniquement) :
  `GET /api/admin/overview|config|export`, `POST /api/admin/import`, `GET|PUT /api/admin/blocks/:clé`,
  `GET /api/admin/history`, `POST /api/admin/history/:id/revert`,
  `/api/admin/{services,villas,partners,companies,projects,gallery,videos,ads}` : liste (`?trash=1` pour la corbeille), création, `GET|PUT|DELETE /:id`, `POST /:id/restore`, `PATCH /:id/active`, `PUT /reorder`,
  `POST /api/admin/uploads/sign`.
- Frontend (Vercel) : `REACT_APP_API_URL=https://api.groupendoyeafrica.com`

## Sécurité
- Mot de passe haché (bcrypt, coût 12), blocage 15 min après 5 échecs, 10 tentatives / 15 min / IP.
- Session : cookie `HttpOnly` + `Secure` + `SameSite=Strict` (préfixe `__Host-`), 2 h, invalidée au changement de mot de passe.
- Écritures acceptées seulement depuis l'administration (contrôle d'origine) **et** avec le jeton `X-CSRF-Token`.
- Administration : politique CSP stricte (aucun script externe, aucun script en ligne), `noindex`, `robots.txt` fermé, aucune donnée insérée en HTML brut.
- Site public : lecture seule, CORS limité à `FRONTEND_ORIGIN`, sans cookie.
- `helmet`, limitation de débit, filtres anti-injection NoSQL, validation de chaque champ, envoi d'images **signé** vers Cloudinary (jpg, png, webp, avif, 8 Mo).

## Render gratuit : mise en veille
Après ~15 min sans visite, le service s'endort ; la requête suivante peut prendre 30–60 s. Le site public n'en souffre pas (données intégrées), l'administration sera lente au premier chargement. Solutions : formule payante, ou un ping toutes les 10 min sur `/api/health` (UptimeRobot).

## En cas de souci
- **« Origine non autorisée »** : ouvrez l'administration par `https://api.groupendoyeafrica.com/` et vérifiez `API_PUBLIC_ORIGIN`.
- **Le site n'affiche pas le contenu de l'API** : `FRONTEND_ORIGIN` doit être exactement l'adresse du site (https, sans « / » final).
- **Connexion impossible** : `npm run create-admin` depuis votre `.env` local (réinitialise aussi le blocage).
- **Rien ne démarre** : les journaux Render indiquent la variable manquante.
- Si une clé a été exposée (chat, capture, GitHub) : régénérez-la aussitôt (Atlas, Cloudinary) et mettez à jour Render.

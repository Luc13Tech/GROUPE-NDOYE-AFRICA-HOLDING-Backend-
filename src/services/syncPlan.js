// Calcul pur (sans base de données) de la synchronisation « sans perte » entre :
//   base     : le contenu chargé lors de la synchronisation précédente (data/seed.base.json)
//   next     : le contenu actuel du site (data/seed.json, généré depuis le frontend)
//   existing : ce qui se trouve réellement dans MongoDB
// Règles : on AJOUTE ce qui manque ; on MET À JOUR une valeur seulement si personne ne l'a
// modifiée depuis le chargement précédent ; on ne SUPPRIME jamais rien.

/** JSON canonique (clés triées, undefined ignoré) pour comparer deux valeurs. */
export function canonical(value) {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? 'null' : canonical(v))).join(',')}]`;
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
}

export const same = (a, b) => canonical(a) === canonical(b);

/** Identifiant « naturel » d'un élément, stable d'une version du site à l'autre. */
export const KEYS = {
  services: (x) => x?.fr?.title,
  villas: (x) => x?.code,
  partners: (x) => (x?.kind === 'africa' ? `africa:${x.name}` : `world:${x?.code}`),
  companies: (x) => x?.name,
  projects: (x) => x?.title?.fr,
  gallery: (x) => `${x?.cat}|${x?.fr}`,
  videos: (x) => `${x?.platform}|${x?.fr?.title}`,
  ads: (x) => x?.img,
};

/** Seuls les champs fournis par le site sont comparés (ordre, état, corbeille… appartiennent à l'admin). */
const ADMIN_OWNED = new Set(['order', 'active', 'deletedAt', 'seedKey']);
const seedFields = (item) => Object.keys(item).filter((k) => !ADMIN_OWNED.has(k));
const pickFields = (obj, fields) => Object.fromEntries(fields.map((f) => [f, obj?.[f]]));
const isKey = (k) => k !== undefined && k !== null && k !== '';

/**
 * Associe chaque élément de `next` à son équivalent dans `base` : d'abord par identifiant naturel,
 * puis, pour un élément dont l'identifiant a changé dans le site (ex. légende corrigée), par position.
 */
function pairWithBase(keyOf, base, next) {
  const baseByKey = new Map(base.map((b) => [keyOf(b), b]));
  const nextKeys = new Set(next.map(keyOf));
  const leftover = new Map(base.map((b, i) => [i, b]).filter(([, b]) => !nextKeys.has(keyOf(b))));
  return next.map((item, i) => baseByKey.get(keyOf(item)) ?? leftover.get(i));
}

/**
 * Plan pour une collection. Chaque document chargé reçoit un repère interne (`seedKey`) qui reste
 * fixe même si l'admin renomme l'élément : il n'est donc jamais recréé en double.
 * @returns {{ inserts: object[], updates: {id:string, set:object, before:object|null, stampOnly:boolean}[], kept: number, unchanged: number }}
 */
export function planCollection(name, { base = [], next = [], existing = [] }) {
  const keyOf = KEYS[name];
  const previousOf = pairWithBase(keyOf, base, next);
  const nextKeys = new Set(next.map(keyOf));
  const claimed = new Set();
  const free = (d) => d && !claimed.has(d);
  const bySeed = (k) => isKey(k) && existing.find((d) => free(d) && d.seedKey === k);
  const byNatural = (k) => isKey(k) && existing.find((d) => free(d) && !d.seedKey && keyOf(d) === k);
  // Documents chargés avant l'arrivée du repère : l'ancien chargement leur donnait l'ordre = position.
  const byLegacyOrder = (i) =>
    existing.find((d) => free(d) && !d.seedKey && d.order === i && !nextKeys.has(keyOf(d)));

  const plan = { inserts: [], updates: [], kept: 0, unchanged: 0 };

  next.forEach((item, i) => {
    const key = keyOf(item);
    const previous = previousOf[i];
    const prevKey = previous ? keyOf(previous) : undefined;
    const doc =
      bySeed(key) || bySeed(prevKey) || byNatural(key) || byNatural(prevKey) || (previous ? byLegacyOrder(i) : undefined);

    if (!doc) {
      // Absent de la base : on l'ajoute (rien du site ne doit manquer dans l'administration).
      plan.inserts.push({ ...item, seedKey: key });
      return;
    }
    claimed.add(doc);
    const stamp = doc.seedKey === key ? {} : { seedKey: key };
    const fields = seedFields(item);
    const current = pickFields(doc, fields);
    const wanted = pickFields(item, fields);
    const untouched = previous && same(current, pickFields(previous, fields));

    if (same(current, wanted) || !untouched) {
      // Déjà à jour, ou modifié dans l'admin (sa version est conservée) : seul le repère est posé.
      if (same(current, wanted)) plan.unchanged += 1;
      else plan.kept += 1;
      if (Object.keys(stamp).length) plan.updates.push({ id: String(doc._id ?? doc.id), set: stamp, before: null, stampOnly: true });
      return;
    }
    // Jamais touché dans l'admin → on applique la correction faite dans le site.
    const set = { ...stamp };
    for (const f of fields) if (!same(current[f], wanted[f])) set[f] = wanted[f];
    plan.updates.push({ id: String(doc._id ?? doc.id), set, before: current, stampOnly: false });
  });
  return plan;
}

/** Plan pour les blocs de contenu (statistiques, coordonnées, textes de présentation…). */
export function planBlocks({ base = {}, next = {}, existing = {} }) {
  const plan = { inserts: [], updates: [], kept: 0, unchanged: 0 };
  for (const [key, data] of Object.entries(next)) {
    if (!Object.prototype.hasOwnProperty.call(existing, key)) {
      plan.inserts.push({ key, data });
      continue;
    }
    const current = existing[key];
    if (same(current, data)) plan.unchanged += 1;
    else if (Object.prototype.hasOwnProperty.call(base, key) && same(current, base[key])) {
      plan.updates.push({ key, data, before: current });
    } else plan.kept += 1;
  }
  return plan;
}

// Conversion (pure, sans base de données) des données de l'ANCIEN tableau de bord,
// qui étaient enregistrées dans le navigateur (localStorage : gnah_services, gnah_projets…),
// vers le format des collections du serveur.
import { PROJECT_CATEGORIES, SERVICE_ICONS } from '../utils/enums.js';
import { LANGS, isPlainObject } from '../utils/safe.js';

const LEGACY_GALLERY_CATS = {
  'Vue Générale': 'overview',
  Extérieur: 'exterior',
  Intérieur: 'interior',
  'Plans 3D': 'plans',
  Immeubles: 'buildings',
  Commodités: 'amenities',
};

const str = (v, max = 6000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const list = (v) => (Array.isArray(v) ? v.filter(isPlainObject).slice(0, 500) : []);

/** Garde les langues renseignées : { fr: '…', en: '…' }. */
function langMap(source) {
  const out = {};
  if (isPlainObject(source)) for (const l of LANGS) if (str(source[l])) out[l] = str(source[l]);
  return out;
}

/** Image : seuls les chemins et liens https sont repris (pas les images collées en base64). */
const image = (v) => {
  const s = str(v, 600);
  return s.startsWith('/') || s.startsWith('https://') ? s : '';
};

function services(items) {
  return list(items)
    .map((s) => {
      const doc = { icon: SERVICE_ICONS.includes(s.icon) ? s.icon : 'building', active: s.active !== false };
      for (const l of LANGS) {
        const title = str(s[`title_${l}`]) || (l === 'fr' ? str(s.fr?.title) : str(s[l]?.title));
        const desc = str(s[`desc_${l}`]) || (l === 'fr' ? str(s.fr?.desc) : str(s[l]?.desc));
        if (title || desc) doc[l] = { ...(title ? { title } : {}), ...(desc ? { desc } : {}) };
      }
      return doc;
    })
    .filter((d) => d.fr?.title);
}

function projects(items) {
  return list(items)
    .map((p) => ({
      category: PROJECT_CATEGORIES.includes(str(p.category)) ? str(p.category) : 'Autre',
      img: image(p.img),
      title: langMap(p.title),
      desc: langMap(p.desc),
      waMsg: langMap(p.waMsg),
      active: p.active !== false,
    }))
    .filter((d) => d.title.fr);
}

function gallery(items) {
  return list(items)
    .map((g) => ({
      cat: LEGACY_GALLERY_CATS[str(g.category)] || 'exterior',
      src: image(g.img),
      fr: str(g.title, 300),
      ...(str(g.title_en) ? { en: str(g.title_en, 300) } : {}),
      active: g.active !== false,
    }))
    .filter((d) => d.src && d.fr);
}

function partners(items) {
  return list(items)
    .map((p) => {
      const code = str(p.code, 2).toUpperCase();
      return {
        kind: 'world',
        code,
        fr: { country: str(p.country, 200), focus: str(p.focus) },
        ...(str(p.focus_en) ? { en: { country: str(p.country, 200), focus: str(p.focus_en) } } : {}),
        active: p.active !== false,
      };
    })
    .filter((d) => /^[A-Z]{2}$/.test(d.code) && d.fr.country && d.fr.focus);
}

function companies(items) {
  return list(items)
    .map((c) => ({
      name: str(c.name, 120),
      logo: image(c.logo),
      sector: langMap(c.sector),
      desc: langMap(c.desc),
      website: str(c.website, 600) || '#',
      country: str(c.country, 80),
      active: c.active !== false,
    }))
    .filter((d) => d.name && d.sector.fr && d.desc.fr);
}

/**
 * @param {object} raw  { gnah_services: [...] | '[…]', gnah_projets, gnah_gallery, gnah_partners, gnah_companies, gnah_settings }
 * @returns {{ collections: Record<string, object[]>, settings: object|null }}
 */
export function convertLegacy(raw) {
  const read = (key) => {
    const v = raw?.[key];
    if (typeof v !== 'string') return v;
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  };
  const settings = read('gnah_settings');
  return {
    collections: {
      services: services(read('gnah_services')),
      projects: projects(read('gnah_projets')),
      gallery: gallery(read('gnah_gallery')),
      partners: partners(read('gnah_partners')),
      companies: companies(read('gnah_companies')),
    },
    settings: isPlainObject(settings) ? settings : null,
  };
}

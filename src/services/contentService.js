import { Ad } from '../models/Ad.js';
import { Company } from '../models/Company.js';
import { ContentBlock } from '../models/ContentBlock.js';
import { GalleryItem } from '../models/GalleryItem.js';
import { Partner } from '../models/Partner.js';
import { Project } from '../models/Project.js';
import { Service } from '../models/Service.js';
import { Video } from '../models/Video.js';
import { Villa } from '../models/Villa.js';

const TTL_MS = 60_000;
let cache = null; // { at, payload }

export function invalidateContentCache() {
  cache = null;
}

const active = () => ({ active: true });
const sorted = { order: 1, createdAt: 1 };

/** Forme publique : sans dates internes, ordre, état ni identifiants Cloudinary. */
function publicShape(doc, drop = []) {
  const o = doc.toJSON();
  for (const k of ['createdAt', 'updatedAt', 'order', 'active', ...drop]) delete o[k];
  for (const k of Object.keys(o)) if (k.endsWith('PublicId')) delete o[k];
  return o;
}

export async function getPublicContent() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.payload;

  const [blocks, services, villas, partners, companies, projects, gallery, ads, videos] = await Promise.all([
    ContentBlock.find(),
    Service.find(active()).sort(sorted),
    Villa.find(active()).sort(sorted),
    Partner.find(active()).sort(sorted),
    Company.find(active()).sort(sorted),
    Project.find(active()).sort(sorted),
    GalleryItem.find(active()).sort(sorted),
    Ad.find(active()).sort(sorted),
    Video.find(active()).sort(sorted),
  ]);

  const now = new Date();
  const liveAds = ads.filter((a) => (!a.startsAt || a.startsAt <= now) && (!a.endsAt || a.endsAt >= now));

  const all = [blocks, services, villas, partners, companies, projects, gallery, ads, videos].flat();
  const latest = all.reduce((max, d) => (d.updatedAt && d.updatedAt > max ? d.updatedAt : max), new Date(0));

  const payload = {
    version: latest.toISOString(),
    blocks: Object.fromEntries(blocks.map((b) => [b.key, b.data])),
    services: services.map((d) => publicShape(d)),
    villas: villas.map((d) => publicShape(d)),
    partners: {
      world: partners.filter((p) => p.kind === 'world').map((d) => publicShape(d, ['kind', 'name'])),
      africa: partners.filter((p) => p.kind === 'africa').map((p) => p.name),
    },
    companies: companies.map((d) => publicShape(d)),
    projects: projects.map((d) => publicShape(d)),
    gallery: gallery.map((d) => publicShape(d)),
    ads: liveAds.map((d) => publicShape(d, ['title', 'startsAt', 'endsAt'])),
    videos: videos.map((d) => publicShape(d)),
  };

  cache = { at: Date.now(), payload };
  return payload;
}

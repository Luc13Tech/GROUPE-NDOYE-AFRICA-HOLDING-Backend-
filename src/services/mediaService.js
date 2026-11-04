import cloudinary from '../config/cloudinary.js';

/** Supprime des images Cloudinary (au mieux, sans bloquer la réponse). Seuls les fichiers gnah/… sont concernés. */
export function destroyAssets(publicIds = []) {
  const ids = [...new Set(publicIds.filter((id) => typeof id === 'string' && id.startsWith('gnah/')))];
  if (!ids.length) return;
  Promise.allSettled(ids.map((id) => cloudinary.uploader.destroy(id, { invalidate: true }))).then((results) => {
    results.forEach((r, i) => {
      if (r.status === 'rejected') console.warn('[cloudinary] suppression impossible :', ids[i]);
    });
  });
}

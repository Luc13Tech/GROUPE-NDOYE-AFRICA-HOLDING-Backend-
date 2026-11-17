import { Ad } from './Ad.js';
import { Company } from './Company.js';
import { GalleryItem } from './GalleryItem.js';
import { Partner } from './Partner.js';
import { Project } from './Project.js';
import { Service } from './Service.js';
import { Video } from './Video.js';
import { Villa } from './Villa.js';

/** Collections gérées depuis l'administration (nom d'URL → modèle). */
export const COLLECTIONS = {
  services: Service,
  villas: Villa,
  partners: Partner,
  companies: Company,
  projects: Project,
  gallery: GalleryItem,
  videos: Video,
  ads: Ad,
};

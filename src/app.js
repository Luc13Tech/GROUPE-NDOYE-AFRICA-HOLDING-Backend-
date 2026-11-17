import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { originGuard } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { sanitizeInput } from './middleware/sanitize.js';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';

const ADMIN_DIR = fileURLToPath(new URL('../admin/', import.meta.url));

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // Render place un proxy devant le service

  // L'espace d'administration est servi par ce serveur : politique de sécurité stricte (aucun script externe).
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com', 'https://images.unsplash.com', ...env.origins],
          connectSrc: ["'self'", 'https://api.cloudinary.com'],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          ...(env.isProd ? { upgradeInsecureRequests: [] } : {}),
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
    })
  );
  // Ni l'API ni l'administration ne doivent apparaître dans les moteurs de recherche.
  app.use((_req, res, next) => {
    res.set('X-Robots-Tag', 'noindex, nofollow');
    next();
  });
  app.get('/robots.txt', (_req, res) => res.type('text/plain').send('User-agent: *\nDisallow: /\n'));

  // Sonde de santé (Render, supervision, « keep-alive »).
  app.get('/api/health', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'up' : 'down', uptime: Math.round(process.uptime()) });
  });

  app.use(compression());
  app.use(
    '/api',
    cors({
      origin: env.origins,
      credentials: false, // le site public ne fait que lire ; l'administration est sur la même origine que l'API
      methods: ['GET'],
      maxAge: 600,
    })
  );
  // Seul l'import de sauvegarde accepte un fichier plus volumineux.
  const smallJson = express.json({ limit: '300kb' });
  const largeJson = express.json({ limit: '5mb' });
  app.use((req, res, next) => (req.path === '/api/admin/import' ? largeJson : smallJson)(req, res, next));
  app.use(cookieParser());
  app.use(sanitizeInput);

  app.use('/api', apiLimiter);
  app.use('/api', originGuard);
  app.use('/api', publicRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', notFound);

  // Espace d'administration : https://api.groupendoyeafrica.com/
  app.use(
    express.static(ADMIN_DIR, {
      index: 'index.html',
      dotfiles: 'deny',
      setHeaders: (res) => res.set('Cache-Control', 'no-cache'),
    })
  );

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';

import { config } from './config';
import { testConnection } from './db';
import { errorHandler } from './middleware/errorHandler';

import './scheduler';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import profilesRouter from './routes/profiles';
import stopsRouter from './routes/stops';
import driverLocationsRouter from './routes/driver-locations';
import pricingZonesRouter from './routes/pricing-zones';
import uploadsRouter from './routes/uploads';
import superadminRouter from './routes/superadmin';

const app = express();

app.set('trust proxy', 1);


// ─── Storage directory ────────────────────────────────────────────────────────
const uploadDir = path.resolve(config.STORAGE_DIR);
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ─── Security ─────────────────────────────────────────────────────────────────
app.use(helmet());

const allowedOrigins = config.CORS_ORIGIN.split(',').map((o) => o.trim());
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        cb(null, true);
      } else {
        cb(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
  })
);

// ─── Rate limiting ────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Static uploads ───────────────────────────────────────────────────────────
app.use('/uploads', express.static(uploadDir, { maxAge: '7d', etag: true, lastModified: true }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/profiles', profilesRouter);
app.use('/api/stops', stopsRouter);
app.use('/api/driver-locations', driverLocationsRouter);
app.use('/api/pricing-zones', pricingZonesRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/superadmin', superadminRouter);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
async function start() {
  try {
    await testConnection();
    app.listen(config.PORT, () => {
      console.log(`🚀 LocalXpress backend running on port ${config.PORT} [${config.NODE_ENV}]`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

start();

export default app;

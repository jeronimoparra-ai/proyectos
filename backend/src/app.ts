import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { errorHandler } from './middleware/error.middleware';
import { authRoutes } from './modules/auth/auth.routes';
import { taskRoutes } from './modules/tasks/task.routes';
import { reminderRoutes } from './modules/reminders/reminder.routes';
import { eventRoutes } from './modules/events/event.routes';
import { googleCalendarRoutes } from './modules/google/google-calendar.routes';
import { aiRoutes } from './modules/ai/ai.routes';
import { academicTaskRoutes } from './modules/academic/academic-task.routes';
import { webSearchRoutes } from './modules/web-search/web-search.routes';
import { reviewRoutes } from './modules/reviews/review.routes';
import { studySessionRoutes } from './modules/study-sessions/study-session.routes';
import { notificationRoutes } from './modules/notifications/notification.routes';

const app = express();

// Detras del proxy de Render/Vercel hay exactamente un salto: sin esto req.ip
// es la IP del proxy y el rate limit por IP se vuelve un cubo global.
app.set('trust proxy', 1);

app.use(helmet());
// La autenticacion viaja en Authorization: Bearer, no en cookies, asi que no
// se habilitan credenciales cross-origin.
app.use(cors({ origin: env.corsOrigin, credentials: false }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
// El limite global es pequeno a proposito: se parsea ANTES del rate limit.
app.use(express.json({ limit: '256kb' }));
// Solo la IA recibe documentos largos (el schema ya limita a 200k caracteres).
app.use('/api/ai', express.json({ limit: '1mb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts, please try again later' },
});

app.get('/health', (_req, res) => {
  // Un /health que responde 200 sin poder autenticar hace que el proveedor
  // marque el deploy como verde mientras la API esta inservible.
  if (!process.env.SUPABASE_ANON_KEY && !process.env.SUPABASE_PUBLISHABLE_KEY) {
    res.status(503).json({ status: 'degraded', missing: 'SUPABASE_ANON_KEY' });
    return;
  }
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/tasks', apiLimiter, taskRoutes);
app.use('/api/reminders', apiLimiter, reminderRoutes);
app.use('/api/events', apiLimiter, eventRoutes);
app.use('/api/google', apiLimiter, googleCalendarRoutes);
app.use('/api/ai', apiLimiter, aiRoutes);
app.use('/api/academic', apiLimiter, academicTaskRoutes);
app.use('/api/search', apiLimiter, webSearchRoutes);
app.use('/api/reviews', apiLimiter, reviewRoutes);
app.use('/api/study-sessions', apiLimiter, studySessionRoutes);
app.use('/api/notifications', apiLimiter, notificationRoutes);

app.use(errorHandler);

// El trabajador de recordatorios se arranca explícitamente desde
// server.ts. Importar app.ts NO lanza ningún worker ni intervalo.

export { app };

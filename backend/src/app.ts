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
import { startReminderChecker } from './modules/reminders/reminder-checker';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));

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

startReminderChecker();

export { app };

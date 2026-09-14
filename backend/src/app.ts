import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
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

const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/google', googleCalendarRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/academic', academicTaskRoutes);
app.use('/api/search', webSearchRoutes);
app.use('/api/reviews', reviewRoutes);

app.use(errorHandler);

export { app };

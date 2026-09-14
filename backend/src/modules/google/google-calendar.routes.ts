import { Router } from 'express';
import { googleCalendarController } from './google-calendar.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/auth-url', (req, res, next) => googleCalendarController.getAuthUrl(req, res, next));
router.post('/callback', (req, res, next) => googleCalendarController.handleCallback(req, res, next));
router.post('/sync', (req, res, next) => googleCalendarController.syncEvents(req, res, next));
router.post('/disconnect', (req, res, next) => googleCalendarController.disconnect(req, res, next));
router.get('/status', (req, res, next) => googleCalendarController.checkConnection(req, res, next));

export { router as googleCalendarRoutes };

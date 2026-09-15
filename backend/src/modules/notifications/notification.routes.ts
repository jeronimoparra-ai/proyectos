import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { notificationController } from './notification.controller';

const router = Router();

router.use(authMiddleware);

router.post('/push-token', (req, res, next) => notificationController.registerPushToken(req, res, next));
router.delete('/push-token', (req, res, next) => notificationController.removePushToken(req, res, next));
router.get('/', (req, res, next) => notificationController.listNotifications(req, res, next));
router.get('/unread-count', (req, res, next) => notificationController.getUnreadCount(req, res, next));
router.patch('/:id/read', (req, res, next) => notificationController.markAsRead(req, res, next));
router.patch('/read-all', (req, res, next) => notificationController.markAllAsRead(req, res, next));

export { router as notificationRoutes };

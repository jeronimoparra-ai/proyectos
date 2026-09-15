import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { notificationService } from './notification.service';
import { registerPushTokenSchema } from './notification.schema';
import { getStringParam } from '../../utils/helpers';

export class NotificationController {
  async registerPushToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const input = registerPushTokenSchema.parse(req.body);
      const token = await notificationService.registerPushToken(userId, input);
      res.json(token);
    } catch (error) {
      next(error);
    }
  }

  async removePushToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const { token } = req.body as { token?: string };
      if (!token) {
        res.status(400).json({ message: 'Token is required' });
        return;
      }
      await notificationService.removePushToken(userId, token);
      res.json({ message: 'Push token removed' });
    } catch (error) {
      next(error);
    }
  }

  async listNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const limit = parseInt(req.query.limit as string) || 50;
      const notifications = await notificationService.listNotifications(userId, limit);
      res.json(notifications);
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const id = getStringParam(req.params.id);
      await notificationService.markAsRead(userId, id);
      res.json({ message: 'Notification marked as read' });
    } catch (error) {
      next(error);
    }
  }

  async markAllAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      await notificationService.markAllAsRead(userId);
      res.json({ message: 'All notifications marked as read' });
    } catch (error) {
      next(error);
    }
  }

  async getUnreadCount(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const count = await notificationService.getUnreadCount(userId);
      res.json({ count });
    } catch (error) {
      next(error);
    }
  }
}

export const notificationController = new NotificationController();

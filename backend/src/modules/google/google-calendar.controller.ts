import { Request, Response, NextFunction } from 'express';
import { googleCalendarService } from './google-calendar.service';
import type { AuthenticatedRequest } from '../../middleware/auth.middleware';

export class GoogleCalendarController {
  async getAuthUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const url = await googleCalendarService.getAuthUrl((req as AuthenticatedRequest).userId!);
      res.json({ url });
    } catch (error) {
      next(error);
    }
  }

  async handleCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const { code, state, redirectUri } = req.body as { code: unknown; state: unknown; redirectUri: unknown };
      const userId = (req as AuthenticatedRequest).userId!;
      const result = await googleCalendarService.handleOAuthCallback(code, userId, state, redirectUri);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async syncEvents(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as AuthenticatedRequest).userId!;
      const result = await googleCalendarService.syncEvents(userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async disconnect(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as AuthenticatedRequest).userId!;
      const result = await googleCalendarService.disconnect(userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async checkConnection(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as AuthenticatedRequest).userId!;
      const connected = await googleCalendarService.isConnected(userId);
      res.json({ connected });
    } catch (error) {
      next(error);
    }
  }
}

export const googleCalendarController = new GoogleCalendarController();

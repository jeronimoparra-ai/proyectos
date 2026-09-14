import { Request, Response, NextFunction } from 'express';
import { googleCalendarService } from './google-calendar.service';
import type { AuthenticatedRequest } from '../../middleware/auth.middleware';

export class GoogleCalendarController {
  async getAuthUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const url = googleCalendarService.getAuthUrl(authReq.userId!);
      res.json({ url });
    } catch (error) {
      next(error);
    }
  }

  async handleCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const { code } = req.body;
      const result = await googleCalendarService.handleOAuthCallback(code, authReq.userId!);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async syncEvents(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const result = await googleCalendarService.syncEvents(authReq.userId!);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async disconnect(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const result = await googleCalendarService.disconnect(authReq.userId!);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async checkConnection(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const connected = await googleCalendarService.isConnected(authReq.userId!);
      res.json({ connected });
    } catch (error) {
      next(error);
    }
  }
}

export const googleCalendarController = new GoogleCalendarController();

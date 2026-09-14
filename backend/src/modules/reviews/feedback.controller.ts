import { Request, Response, NextFunction } from 'express';
import { feedbackService } from './feedback.service';
import type { AuthenticatedRequest } from '../../middleware/auth.middleware';

export class FeedbackController {
  async getWeeklyFeedback(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const result = await feedbackService.getWeeklyFeedback(authReq.userId!);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getRecommendations(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const result = await feedbackService.getAIRecommendations(authReq.userId!);
      res.json({ recommendations: result });
    } catch (error) {
      next(error);
    }
  }
}

export const feedbackController = new FeedbackController();

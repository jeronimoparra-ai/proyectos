import { Request, Response, NextFunction } from 'express';
import { reviewService } from './review.service';
import type { CreateReviewInput } from './review.schema';
import type { AuthenticatedRequest } from '../../middleware/auth.middleware';

function getStringParam(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return '';
}

export class ReviewController {
  async recordReview(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const result = await reviewService.recordReview(authReq.userId!, req.body as CreateReviewInput);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getDueReviews(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const limitParam = getStringParam(req.query.limit);
      const limit = parseInt(limitParam) || 10;
      const result = await reviewService.getDueReviews(authReq.userId!, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getReviewHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const taskId = getStringParam(req.params.taskId);
      const result = await reviewService.getReviewHistory(authReq.userId!, taskId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getReviewStats(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const result = await reviewService.getReviewStats(authReq.userId!);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async initializeForTask(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const taskId = getStringParam(req.params.taskId);
      const result = await reviewService.initializeForTask(authReq.userId!, taskId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const reviewController = new ReviewController();

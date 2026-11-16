import { Request, Response, NextFunction } from 'express';
import { reviewService } from './review.service';
import type { CreateReviewInput } from './review.schema';
import type { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { getStringParam } from '../../utils/helpers';

export class ReviewController {
  async recordReview(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const input = req.body as CreateReviewInput;
      const result = await reviewService.recordReview(authReq.userId!, input);
      const statusCode = result.isDuplicate ? 200 : 201;
      res.status(statusCode).json(result);
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

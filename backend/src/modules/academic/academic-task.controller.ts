import { Request, Response, NextFunction } from 'express';
import { academicTaskService } from './academic-task.service';
import type {
  CreateAcademicTaskInput,
  UpdateAcademicTaskInput,
  AcademicTaskQueryInput,
} from './academic-task.schema';
import type { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { getStringParam, parseQuery } from '../../utils/helpers';

export class AcademicTaskController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as AuthenticatedRequest).userId!;
      const result = await academicTaskService.list(
        userId,
        parseQuery<AcademicTaskQueryInput>(req.query as Record<string, unknown>)
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as AuthenticatedRequest).userId!;
      const id = getStringParam(req.params.id);
      const result = await academicTaskService.getById(userId, id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as AuthenticatedRequest).userId!;
      const result = await academicTaskService.create(
        userId,
        req.body as CreateAcademicTaskInput
      );
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as AuthenticatedRequest).userId!;
      const id = getStringParam(req.params.id);
      const result = await academicTaskService.update(
        userId,
        id,
        req.body as UpdateAcademicTaskInput
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as AuthenticatedRequest).userId!;
      const id = getStringParam(req.params.id);
      const result = await academicTaskService.softDelete(userId, id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async processWithAI(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as AuthenticatedRequest).userId!;
      const id = getStringParam(req.params.id);
      const result = await academicTaskService.processWithAI(userId, id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const academicTaskController = new AcademicTaskController();

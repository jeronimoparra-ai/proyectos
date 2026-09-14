import { Request, Response, NextFunction } from 'express';
import { academicTaskService } from './academic-task.service';
import type {
  CreateAcademicTaskInput,
  UpdateAcademicTaskInput,
  AcademicTaskQueryInput,
} from './academic-task.schema';
import type { AuthenticatedRequest } from '../../middleware/auth.middleware';

function getStringParam(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return '';
}

function parseQuery<T extends Record<string, unknown>>(query: Record<string, unknown>): T {
  return query as T;
}

export class AcademicTaskController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const result = await academicTaskService.list(
        authReq.userId!,
        parseQuery<AcademicTaskQueryInput>(req.query as Record<string, unknown>)
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const id = getStringParam(req.params.id);
      const result = await academicTaskService.getById(authReq.userId!, id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const result = await academicTaskService.create(
        authReq.userId!,
        req.body as CreateAcademicTaskInput
      );
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const id = getStringParam(req.params.id);
      const result = await academicTaskService.update(
        authReq.userId!,
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
      const authReq = req as AuthenticatedRequest;
      const id = getStringParam(req.params.id);
      const result = await academicTaskService.softDelete(authReq.userId!, id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async processWithAI(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const id = getStringParam(req.params.id);
      const result = await academicTaskService.processWithAI(authReq.userId!, id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const academicTaskController = new AcademicTaskController();

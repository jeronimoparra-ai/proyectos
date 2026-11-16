import { Request, Response, NextFunction } from 'express';
import { taskService } from './task.service';
import type { CreateTaskInput, UpdateTaskInput, TaskQueryInput } from './task.schema';
import type { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { getStringParam, parseQuery } from '../../utils/helpers';

export class TaskController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const result = await taskService.list(
        authReq.userId!,
        parseQuery<TaskQueryInput>(req.query as Record<string, unknown>)
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
      const result = await taskService.getById(userId, id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as AuthenticatedRequest).userId!;
      const result = await taskService.create(userId, req.body as CreateTaskInput);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as AuthenticatedRequest).userId!;
      const id = getStringParam(req.params.id);
      const result = await taskService.update(userId, id, req.body as UpdateTaskInput);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as AuthenticatedRequest).userId!;
      const id = getStringParam(req.params.id);
      const result = await taskService.softDelete(userId, id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async complete(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as AuthenticatedRequest).userId!;
      const id = getStringParam(req.params.id);
      const result = await taskService.complete(userId, id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getOverdue(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as AuthenticatedRequest).userId!;
      const result = await taskService.getOverdue(userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getUpcoming(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as AuthenticatedRequest).userId!;
      const daysParam = getStringParam(req.query.days);
      const days = parseInt(daysParam) || 7;
      const result = await taskService.getUpcoming(userId, days);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const taskController = new TaskController();

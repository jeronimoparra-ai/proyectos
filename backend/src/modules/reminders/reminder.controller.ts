import { Request, Response, NextFunction } from 'express';
import { reminderService } from './reminder.service';
import type { CreateReminderInput, UpdateReminderInput } from './reminder.schema';
import type { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { getStringParam } from '../../utils/helpers';

export class ReminderController {
  async listByTask(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const taskId = getStringParam(req.params.taskId);
      const result = await reminderService.listByTask(authReq.userId!, taskId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async listUpcoming(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const daysParam = getStringParam(req.query.days);
      const days = parseInt(daysParam) || 7;
      const result = await reminderService.listUpcoming(authReq.userId!, days);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const result = await reminderService.create(authReq.userId!, req.body as CreateReminderInput);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const id = getStringParam(req.params.id);
      const result = await reminderService.update(authReq.userId!, id, req.body as UpdateReminderInput);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const id = getStringParam(req.params.id);
      const result = await reminderService.delete(authReq.userId!, id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const reminderController = new ReminderController();

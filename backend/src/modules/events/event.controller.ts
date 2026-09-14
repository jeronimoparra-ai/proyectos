import { Request, Response, NextFunction } from 'express';
import { eventService } from './event.service';
import type { CreateEventInput, UpdateEventInput, EventQueryInput } from './event.schema';
import type { AuthenticatedRequest } from '../../middleware/auth.middleware';

function getStringParam(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return '';
}

function parseQuery<T extends Record<string, unknown>>(query: Record<string, unknown>): T {
  return query as T;
}

export class EventController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const result = await eventService.list(
        authReq.userId!,
        parseQuery<EventQueryInput>(req.query as Record<string, unknown>)
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
      const result = await eventService.getById(authReq.userId!, id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const result = await eventService.create(authReq.userId!, req.body as CreateEventInput);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const id = getStringParam(req.params.id);
      const result = await eventService.update(authReq.userId!, id, req.body as UpdateEventInput);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const id = getStringParam(req.params.id);
      const result = await eventService.softDelete(authReq.userId!, id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getByDateRange(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const startDate = getStringParam(req.query.start_date);
      const endDate = getStringParam(req.query.end_date);
      const result = await eventService.getByDateRange(authReq.userId!, startDate, endDate);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async syncFromGoogle(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const result = await eventService.syncFromGoogle(authReq.userId!, req.body.events);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const eventController = new EventController();

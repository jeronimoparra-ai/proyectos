import { Request, Response, NextFunction } from 'express';
import { eventService } from './event.service';
import type { CreateEventInput, UpdateEventInput, EventQueryInput } from './event.schema';
import type { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { getStringParam, parseQuery } from '../../utils/helpers';

export class EventController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await eventService.list(
        (req as AuthenticatedRequest).userId!,
        parseQuery<EventQueryInput>(req.query as Record<string, unknown>)
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getStringParam(req.params.id);
      const result = await eventService.getById((req as AuthenticatedRequest).userId!, id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await eventService.create((req as AuthenticatedRequest).userId!, req.body as CreateEventInput);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getStringParam(req.params.id);
      const result = await eventService.update((req as AuthenticatedRequest).userId!, id, req.body as UpdateEventInput);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getStringParam(req.params.id);
      const result = await eventService.softDelete((req as AuthenticatedRequest).userId!, id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getByDateRange(req: Request, res: Response, next: NextFunction) {
    try {
      const startDate = getStringParam(req.query.start_date);
      const endDate = getStringParam(req.query.end_date);
      const result = await eventService.getByDateRange((req as AuthenticatedRequest).userId!, startDate, endDate);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async syncFromGoogle(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await eventService.syncFromGoogle((req as AuthenticatedRequest).userId!, req.body.events);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const eventController = new EventController();

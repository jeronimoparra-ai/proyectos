import { Request, Response, NextFunction } from 'express';
import { studySessionService } from './study-session.service';
import type { CreateStudySessionInput, UpdateStudySessionInput } from './study-session.schema';
import type { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { getStringParam } from '../../utils/helpers';

export class StudySessionController {
  async createSession(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const result = await studySessionService.createSession(authReq.userId!, req.body as CreateStudySessionInput);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getSessionById(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const id = getStringParam(req.params.id);
      const result = await studySessionService.getSessionById(authReq.userId!, id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async listSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const academicTaskId = req.query.academicTaskId ? getStringParam(req.query.academicTaskId) : undefined;
      const result = await studySessionService.listSessions(authReq.userId!, academicTaskId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async updateSession(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const id = getStringParam(req.params.id);
      const result = await studySessionService.updateSession(authReq.userId!, id, req.body as UpdateStudySessionInput);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async deleteSession(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const id = getStringParam(req.params.id);
      const result = await studySessionService.deleteSession(authReq.userId!, id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const studySessionController = new StudySessionController();

import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import type { RegisterInput, LoginInput, ForgotPasswordInput } from './auth.schema';
import type { AuthenticatedRequest } from '../../middleware/auth.middleware';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body as RegisterInput;
      const result = await authService.register(data);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body as LoginInput;
      const result = await authService.login(data);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const token = req.headers.authorization?.split(' ')[1] ?? '';
      const result = await authService.logout(token);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getSession(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.headers.authorization?.split(' ')[1] ?? '';
      const result = await authService.getSession(token);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refresh_token } = req.body;
      const result = await authService.refreshToken(refresh_token);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body as ForgotPasswordInput;
      const result = await authService.forgotPassword(data);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.updateProfile(req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();

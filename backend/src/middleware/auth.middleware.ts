import { Request, Response, NextFunction } from 'express';
import { supabase } from '../database/supabase';
import { createAppError } from './error.middleware';

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw createAppError('Missing or invalid authorization header', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.split(' ')[1];

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      throw createAppError('Invalid or expired token', 401, 'UNAUTHORIZED');
    }

    req.userId = data.user.id;
    next();
  } catch (error) {
    next(error);
  }
}

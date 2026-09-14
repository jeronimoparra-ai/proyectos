import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { createAppError } from './error.middleware';

export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.issues.map((issue) => issue.message).join(', ');
        next(createAppError(message, 400, 'VALIDATION_ERROR'));
      } else {
        next(error);
      }
    }
  };
}

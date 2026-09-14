import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export function createAppError(message: string, statusCode: number, code?: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export function errorHandler(err: AppError, _req: Request, res: Response, _next: NextFunction) {
  const statusCode = err.statusCode ?? 500;
  const message = err.message ?? 'Internal server error';

  if (process.env.NODE_ENV === 'development') {
    console.error(`[Error] ${statusCode}: ${message}`, err.stack);
  }

  res.status(statusCode).json({
    error: {
      message,
      code: err.code,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
}

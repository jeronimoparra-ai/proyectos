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

  // El detalle real (mensajes de Postgres, cuerpos de OpenRouter, stacks) solo
  // va al log del servidor: devolverlo al cliente filtra internals.
  console.error(`[Error] ${statusCode}: ${message}`, err.stack);

  // Los errores 5xx se responden con un mensaje generico; los 4xx son
  // intencionados (validacion, auth) y si son utiles para el usuario.
  const isServerError = statusCode >= 500;

  res.status(statusCode).json({
    error: {
      message: isServerError ? 'Internal server error' : message,
      code: isServerError ? 'INTERNAL_ERROR' : err.code,
    },
  });
}

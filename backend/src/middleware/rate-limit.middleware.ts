import { Request } from 'express';
import rateLimit from 'express-rate-limit';
import type { AuthenticatedRequest } from './auth.middleware';

interface RateLimitConfig {
  windowMs: number;
  max: number;
  keyGenerator: (req: Request) => string;
  message?: string;
}

// Limiter reutilizable. La clave es el usuario autenticado cuando existe:
// asi una sola cuenta no puede agotar la cuota de todos los que comparten IP.
export function createRateLimiter(config: RateLimitConfig) {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: config.keyGenerator,
    message: config.message ?? { message: 'Too many requests, please try again later' },
  });
}

// Atajo para el caso habitual: limitar por usuario y caer a IP si falta.
export function userKey(req: Request): string {
  return (req as AuthenticatedRequest).userId ?? req.ip ?? 'unknown';
}

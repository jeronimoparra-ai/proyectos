import { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
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
// ipKeyGenerator normaliza IPv6 a su prefijo /64: sin el, un cliente puede
// rotar direcciones dentro de su /64 y multiplicar su cuota.
export function userKey(req: Request): string {
  const userId = (req as AuthenticatedRequest).userId;
  if (userId) return userId;
  return req.ip ? ipKeyGenerator(req.ip) : 'unknown';
}

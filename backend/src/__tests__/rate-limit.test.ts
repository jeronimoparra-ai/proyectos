import { describe, it, expect } from "vitest";
import type { Request } from 'express';
import { createRateLimiter, userKey } from '../middleware/rate-limit.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';

// Verifica que la cuota se aplique por usuario y no por IP compartida.
describe('userKey', () => {
  it('usa el userId cuando la peticion esta autenticada', () => {
    const req = { userId: 'user-123', ip: '10.0.0.1' } as AuthenticatedRequest;
    expect(userKey(req as Request)).toBe('user-123');
  });

  it('cae a la IP cuando no hay userId', () => {
    const req = { ip: '10.0.0.1' } as Request;
    expect(userKey(req)).toBe('10.0.0.1');
  });

  it('devuelve un valor estable si tampoco hay IP', () => {
    const req = {} as Request;
    expect(userKey(req)).toBe('unknown');
  });
});

describe('createRateLimiter', () => {
  it('construye un middleware reutilizable con la configuracion recibida', () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      max: 20,
      keyGenerator: userKey,
    });

    // express-rate-limit devuelve una funcion middleware de Express.
    expect(typeof limiter).toBe('function');
    expect(limiter.length).toBeGreaterThanOrEqual(2);
  });

  it('acepta un mensaje personalizado sin romper la construccion', () => {
    const limiter = createRateLimiter({
      windowMs: 1_000,
      max: 1,
      keyGenerator: () => 'constante',
      message: 'limite alcanzado',
    });
    expect(typeof limiter).toBe('function');
  });
});

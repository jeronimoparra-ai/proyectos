import { Router } from 'express';
import { authController } from './auth.controller';
import { validate } from '../../middleware/validate.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
} from './auth.schema';

const router = Router();

router.post('/register', validate(registerSchema), (req, res, next) =>
  authController.register(req, res, next)
);

router.post('/login', validate(loginSchema), (req, res, next) =>
  authController.login(req, res, next)
);

router.post('/logout', authMiddleware, (req, res, next) =>
  authController.logout(req, res, next)
);

router.get('/session', authMiddleware, (req, res, next) =>
  authController.getSession(req, res, next)
);

router.post('/refresh', validate(refreshTokenSchema), (req, res, next) =>
  authController.refreshToken(req, res, next)
);

router.post('/forgot-password', validate(forgotPasswordSchema), (req, res, next) =>
  authController.forgotPassword(req, res, next)
);

router.patch('/profile', authMiddleware, (req, res, next) =>
  authController.updateProfile(req, res, next)
);

export { router as authRoutes };

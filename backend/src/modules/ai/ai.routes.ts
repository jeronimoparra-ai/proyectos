import { Router } from 'express';
import { aiController } from './ai.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { createRateLimiter, userKey } from '../../middleware/rate-limit.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  generateSummarySchema,
  generateQuestionsSchema,
  explainConceptSchema,
} from './ai.schema';

const router = Router();

router.use(authMiddleware);

const aiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: userKey,
});

router.post('/summarize', aiRateLimiter, validate(generateSummarySchema), (req, res, next) =>
  aiController.generateSummary(req, res, next)
);

router.post('/questions', aiRateLimiter, validate(generateQuestionsSchema), (req, res, next) =>
  aiController.generateQuestions(req, res, next)
);

router.post('/explain', aiRateLimiter, validate(explainConceptSchema), (req, res, next) =>
  aiController.explainConcept(req, res, next)
);

export { router as aiRoutes };

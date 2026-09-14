import { Router } from 'express';
import { aiController } from './ai.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  generateSummarySchema,
  generateQuestionsSchema,
  explainConceptSchema,
} from './ai.schema';

const router = Router();

router.use(authMiddleware);

router.post('/summarize', validate(generateSummarySchema), (req, res, next) =>
  aiController.generateSummary(req, res, next)
);

router.post('/questions', validate(generateQuestionsSchema), (req, res, next) =>
  aiController.generateQuestions(req, res, next)
);

router.post('/explain', validate(explainConceptSchema), (req, res, next) =>
  aiController.explainConcept(req, res, next)
);

export { router as aiRoutes };

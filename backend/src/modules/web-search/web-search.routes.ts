import { Router } from 'express';
import { webSearchController } from './web-search.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { createRateLimiter, userKey } from '../../middleware/rate-limit.middleware';
import { validate } from '../../middleware/validate.middleware';
import { webSearchSchema, researchTopicSchema } from './web-search.schema';

const router = Router();

router.use(authMiddleware);

const searchRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: userKey,
});

router.post('/', searchRateLimiter, validate(webSearchSchema), (req, res, next) =>
  webSearchController.search(req, res, next)
);

router.post('/research', searchRateLimiter, validate(researchTopicSchema), (req, res, next) =>
  webSearchController.researchTopic(req, res, next)
);

export { router as webSearchRoutes };

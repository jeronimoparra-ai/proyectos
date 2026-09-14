import { Router } from 'express';
import { webSearchController } from './web-search.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { webSearchSchema, researchTopicSchema } from './web-search.schema';

const router = Router();

router.use(authMiddleware);

router.post('/', validate(webSearchSchema), (req, res, next) =>
  webSearchController.search(req, res, next)
);

router.post('/research', validate(researchTopicSchema), (req, res, next) =>
  webSearchController.researchTopic(req, res, next)
);

export { router as webSearchRoutes };

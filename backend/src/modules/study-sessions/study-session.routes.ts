import { Router } from 'express';
import { studySessionController } from './study-session.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createStudySessionSchema, updateStudySessionSchema } from './study-session.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', (req, res, next) => studySessionController.listSessions(req, res, next));
router.get('/:id', (req, res, next) => studySessionController.getSessionById(req, res, next));
router.post('/', validate(createStudySessionSchema), (req, res, next) => studySessionController.createSession(req, res, next));
router.patch('/:id', validate(updateStudySessionSchema), (req, res, next) => studySessionController.updateSession(req, res, next));
router.delete('/:id', (req, res, next) => studySessionController.deleteSession(req, res, next));

export { router as studySessionRoutes };

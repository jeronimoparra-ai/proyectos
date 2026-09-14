import { Router } from 'express';
import { eventController } from './event.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createEventSchema, updateEventSchema } from './event.schema';

const router = Router();

router.use(authMiddleware);

router.get('/range', (req, res, next) => eventController.getByDateRange(req, res, next));
router.post('/sync-google', (req, res, next) => eventController.syncFromGoogle(req, res, next));
router.get('/', (req, res, next) => eventController.list(req, res, next));
router.get('/:id', (req, res, next) => eventController.getById(req, res, next));
router.post('/', validate(createEventSchema), (req, res, next) => eventController.create(req, res, next));
router.patch('/:id', validate(updateEventSchema), (req, res, next) => eventController.update(req, res, next));
router.delete('/:id', (req, res, next) => eventController.delete(req, res, next));

export { router as eventRoutes };

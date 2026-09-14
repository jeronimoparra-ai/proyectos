import { Router } from 'express';
import { reminderController } from './reminder.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createReminderSchema, updateReminderSchema } from './reminder.schema';

const router = Router();

router.use(authMiddleware);

router.get('/upcoming', (req, res, next) => reminderController.listUpcoming(req, res, next));
router.get('/task/:taskId', (req, res, next) => reminderController.listByTask(req, res, next));
router.post('/', validate(createReminderSchema), (req, res, next) => reminderController.create(req, res, next));
router.patch('/:id', validate(updateReminderSchema), (req, res, next) => reminderController.update(req, res, next));
router.delete('/:id', (req, res, next) => reminderController.delete(req, res, next));

export { router as reminderRoutes };

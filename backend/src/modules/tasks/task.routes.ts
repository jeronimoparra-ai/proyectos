import { Router } from 'express';
import { taskController } from './task.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createTaskSchema, updateTaskSchema } from './task.schema';

const router = Router();

router.use(authMiddleware);

router.get('/overdue', (req, res, next) => taskController.getOverdue(req, res, next));
router.get('/upcoming', (req, res, next) => taskController.getUpcoming(req, res, next));
router.get('/', (req, res, next) => taskController.list(req, res, next));
router.get('/:id', (req, res, next) => taskController.getById(req, res, next));
router.post('/', validate(createTaskSchema), (req, res, next) => taskController.create(req, res, next));
router.patch('/:id', validate(updateTaskSchema), (req, res, next) => taskController.update(req, res, next));
router.patch('/:id/complete', (req, res, next) => taskController.complete(req, res, next));
router.delete('/:id', (req, res, next) => taskController.delete(req, res, next));

export { router as taskRoutes };

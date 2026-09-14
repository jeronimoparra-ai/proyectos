import { Router } from 'express';
import { academicTaskController } from './academic-task.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createAcademicTaskSchema, updateAcademicTaskSchema } from './academic-task.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', (req, res, next) => academicTaskController.list(req, res, next));
router.get('/:id', (req, res, next) => academicTaskController.getById(req, res, next));
router.post('/', validate(createAcademicTaskSchema), (req, res, next) =>
  academicTaskController.create(req, res, next)
);
router.patch('/:id', validate(updateAcademicTaskSchema), (req, res, next) =>
  academicTaskController.update(req, res, next)
);
router.delete('/:id', (req, res, next) => academicTaskController.delete(req, res, next));
router.post('/:id/process', (req, res, next) =>
  academicTaskController.processWithAI(req, res, next)
);

export { router as academicTaskRoutes };

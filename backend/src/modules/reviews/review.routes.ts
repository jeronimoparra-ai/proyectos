import { Router } from 'express';
import { reviewController } from './review.controller';
import { feedbackController } from './feedback.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createReviewSchema } from './review.schema';

const router = Router();

router.use(authMiddleware);

router.get('/due', (req, res, next) => reviewController.getDueReviews(req, res, next));
router.get('/stats', (req, res, next) => reviewController.getReviewStats(req, res, next));
router.get('/feedback', (req, res, next) => feedbackController.getWeeklyFeedback(req, res, next));
router.get('/recommendations', (req, res, next) => feedbackController.getRecommendations(req, res, next));
router.get('/history/:taskId', (req, res, next) => reviewController.getReviewHistory(req, res, next));
router.post('/', validate(createReviewSchema), (req, res, next) => reviewController.recordReview(req, res, next));
router.post('/initialize/:taskId', (req, res, next) => reviewController.initializeForTask(req, res, next));

export { router as reviewRoutes };

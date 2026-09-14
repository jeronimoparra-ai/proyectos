import { z } from 'zod';

export const createReviewSchema = z.object({
  academic_task_id: z.string().uuid('Invalid academic task ID'),
  quality: z.number().int().min(0).max(5, 'Quality must be between 0 and 5'),
  difficulty: z.number().min(0).max(1).optional(),
  time_spent_seconds: z.number().int().positive().optional(),
});

export const getDueReviewsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type GetDueReviewsInput = z.infer<typeof getDueReviewsSchema>;

import { z } from 'zod';

export const createStudySessionSchema = z.object({
  academic_task_id: z.string().uuid('Invalid academic task ID').optional(),
  topic_id: z.string().uuid('Invalid topic ID').optional(),
  started_at: z.string().datetime().optional(),
  ended_at: z.string().datetime().optional(),
  duration_seconds: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
});

export const updateStudySessionSchema = z.object({
  ended_at: z.string().datetime().optional(),
  duration_seconds: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
});

export type CreateStudySessionInput = z.infer<typeof createStudySessionSchema>;
export type UpdateStudySessionInput = z.infer<typeof updateStudySessionSchema>;

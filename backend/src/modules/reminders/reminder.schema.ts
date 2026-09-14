import { z } from 'zod';

export const createReminderSchema = z.object({
  task_id: z.string().uuid('Invalid task ID'),
  remind_at: z.string().datetime('Invalid datetime format'),
  type: z.enum(['notification', 'alarm']).default('notification'),
});

export const updateReminderSchema = z.object({
  remind_at: z.string().datetime().optional(),
  type: z.enum(['notification', 'alarm']).optional(),
});

export type CreateReminderInput = z.infer<typeof createReminderSchema>;
export type UpdateReminderInput = z.infer<typeof updateReminderSchema>;

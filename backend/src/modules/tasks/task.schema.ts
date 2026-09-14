import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional(),
  due_date: z.string().optional(),
  due_time: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  category_id: z.string().uuid().optional(),
  tags: z.array(z.string().uuid()).optional(),
  estimated_minutes: z.number().int().positive().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  is_recurring: z.boolean().default(false),
  recurrence_rule: z.object({
    frequency: z.enum(['daily', 'weekly', 'monthly']),
    interval: z.number().int().positive().default(1),
    days_of_week: z.array(z.number().int().min(0).max(6)).optional(),
    end_date: z.string().optional(),
  }).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  due_date: z.string().optional().nullable(),
  due_time: z.string().optional().nullable(),
  status: z.enum(['pending', 'in_progress', 'completed', 'postponed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  category_id: z.string().uuid().optional().nullable(),
  tags: z.array(z.string().uuid()).optional(),
  estimated_minutes: z.number().int().positive().optional().nullable(),
  actual_minutes: z.number().int().positive().optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
});

export const taskQuerySchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'postponed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  category_id: z.string().uuid().optional(),
  due_before: z.string().optional(),
  due_after: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TaskQueryInput = z.infer<typeof taskQuerySchema>;

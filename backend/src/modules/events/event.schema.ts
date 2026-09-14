import { z } from 'zod';

export const createEventSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional(),
  start_date: z.string().datetime('Invalid start date'),
  end_date: z.string().datetime('Invalid end date'),
  all_day: z.boolean().default(false),
  location: z.string().max(255).optional(),
  category_id: z.string().uuid().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export const updateEventSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  all_day: z.boolean().optional(),
  location: z.string().max(255).optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
});

export const eventQuerySchema = z.object({
  start_after: z.string().optional(),
  start_before: z.string().optional(),
  category_id: z.string().uuid().optional(),
  search: z.string().optional(),
  source: z.enum(['local', 'google']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type EventQueryInput = z.infer<typeof eventQuerySchema>;

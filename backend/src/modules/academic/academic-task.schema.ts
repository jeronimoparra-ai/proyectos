import { z } from 'zod';

export const createAcademicTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  subject: z.string().max(100).optional(),
  content: z.string().optional(),
  materials: z.array(z.object({
    type: z.enum(['text', 'pdf', 'image', 'link']),
    content: z.string().min(1),
    file_name: z.string().optional(),
  })).optional(),
  topics: z.array(z.object({
    name: z.string().min(1),
    description: z.string().optional(),
  })).optional(),
});

export const updateAcademicTaskSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  subject: z.string().max(100).optional().nullable(),
  content: z.string().optional().nullable(),
  summary: z.string().optional().nullable(),
  key_ideas: z.array(z.string()).optional().nullable(),
  concepts: z.array(z.string()).optional().nullable(),
  questions: z.array(z.string()).optional().nullable(),
});

export const academicTaskQuerySchema = z.object({
  subject: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateAcademicTaskInput = z.infer<typeof createAcademicTaskSchema>;
export type UpdateAcademicTaskInput = z.infer<typeof updateAcademicTaskSchema>;
export type AcademicTaskQueryInput = z.infer<typeof academicTaskQuerySchema>;

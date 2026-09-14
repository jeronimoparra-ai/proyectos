import { z } from 'zod';

export const generateSummarySchema = z.object({
  content: z.string().min(10, 'Content is required (min 10 characters)'),
});

export const generateQuestionsSchema = z.object({
  content: z.string().min(10, 'Content is required'),
  count: z.number().int().min(1).max(20).default(5),
});

export const explainConceptSchema = z.object({
  concept: z.string().min(1, 'Concept is required'),
  context: z.string().min(1, 'Context is required'),
});

export type GenerateSummaryInput = z.infer<typeof generateSummarySchema>;
export type GenerateQuestionsInput = z.infer<typeof generateQuestionsSchema>;
export type ExplainConceptInput = z.infer<typeof explainConceptSchema>;

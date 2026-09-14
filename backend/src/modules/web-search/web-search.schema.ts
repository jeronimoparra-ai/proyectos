import { z } from 'zod';

export const webSearchSchema = z.object({
  query: z.string().min(2, 'Query must be at least 2 characters').max(500),
  count: z.number().int().min(1).max(10).default(5),
});

export const researchTopicSchema = z.object({
  topic: z.string().min(2, 'Topic is required').max(500),
  context: z.string().max(1000).optional(),
});

export type WebSearchInput = z.infer<typeof webSearchSchema>;
export type ResearchTopicInput = z.infer<typeof researchTopicSchema>;

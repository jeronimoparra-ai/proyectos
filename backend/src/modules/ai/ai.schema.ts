import { z } from 'zod';

// Dos limites distintos a proposito:
//   - 200 000 caracteres: cordura del payload de entrada (bajo el limite de 10mb de express.json).
//   - 15 000 caracteres: tope real enviado al modelo, aplicado en ai.service (truncado).
// Poner 15 000 en el schema convertiria el truncado en un 400 para contenido largo ya soportado.
export const generateSummarySchema = z.object({
  content: z.string().min(10, 'Content is required (min 10 characters)').max(200000),
});

export const generateQuestionsSchema = z.object({
  content: z.string().min(10, 'Content is required').max(200000),
  count: z.number().int().min(1).max(20).default(5),
});

export const explainConceptSchema = z.object({
  concept: z.string().min(1, 'Concept is required'),
  context: z.string().min(1, 'Context is required').max(200000),
});

export type GenerateSummaryInput = z.infer<typeof generateSummarySchema>;
export type GenerateQuestionsInput = z.infer<typeof generateQuestionsSchema>;
export type ExplainConceptInput = z.infer<typeof explainConceptSchema>;

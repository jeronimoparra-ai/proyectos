import { Request, Response, NextFunction } from 'express';
import { aiService } from './ai.service';
import type { GenerateSummaryInput, GenerateQuestionsInput, ExplainConceptInput } from './ai.schema';

export class AIController {
  async generateSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const { content } = req.body as GenerateSummaryInput;
      const result = await aiService.generateSummary(content);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async generateQuestions(req: Request, res: Response, next: NextFunction) {
    try {
      const { content, count } = req.body as GenerateQuestionsInput;
      const result = await aiService.generateQuestions(content, count);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async explainConcept(req: Request, res: Response, next: NextFunction) {
    try {
      const { concept, context } = req.body as ExplainConceptInput;
      const result = await aiService.explainConcept(concept, context);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const aiController = new AIController();

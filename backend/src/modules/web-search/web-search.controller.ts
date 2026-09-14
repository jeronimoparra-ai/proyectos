import { Request, Response, NextFunction } from 'express';
import { webSearchService } from './web-search.service';
import type { WebSearchInput, ResearchTopicInput } from './web-search.schema';

export class WebSearchController {
  async search(req: Request, res: Response, next: NextFunction) {
    try {
      const { query, count } = req.body as WebSearchInput;
      const result = await webSearchService.search(query, count);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async researchTopic(req: Request, res: Response, next: NextFunction) {
    try {
      const { topic, context } = req.body as ResearchTopicInput;
      const result = await webSearchService.researchTopic(topic, context);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const webSearchController = new WebSearchController();

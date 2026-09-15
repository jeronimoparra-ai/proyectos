import { apiClient } from './api';
import { supabase } from './supabase';

export interface AISummaryOptions {
  maxLength?: number;
  style?: 'brief' | 'detailed';
}

export interface AISummaryResult {
  summary: string;
  keyIdeas: string[];
  concepts: string[];
}

export type AcademicLevel = 'high_school' | 'undergraduate' | 'graduate' | 'professional';

export interface AIProvider {
  summarize(content: string, options?: AISummaryOptions): Promise<AISummaryResult>;
  extractKeyIdeas(content: string): Promise<string[]>;
  generateQuestions(content: string, count?: number): Promise<string[]>;
  explainConcept(concept: string, context: string, level?: AcademicLevel): Promise<string>;
}

class OpenRouterAIProvider implements AIProvider {
  private async getToken(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? '';
  }

  async summarize(content: string, _options?: AISummaryOptions): Promise<AISummaryResult> {
    const token = await this.getToken();
    const result = await apiClient.post<{ summary: string; keyIdeas: string[]; concepts: string[] }>(
      '/ai/summarize',
      { content },
      token,
    );
    return {
      summary: result.summary,
      keyIdeas: result.keyIdeas,
      concepts: result.concepts,
    };
  }

  async extractKeyIdeas(content: string): Promise<string[]> {
    const token = await this.getToken();
    const result = await this.summarize(content);
    return result.keyIdeas;
  }

  async generateQuestions(content: string, count: number = 5): Promise<string[]> {
    const token = await this.getToken();
    const result = await apiClient.post<{ questions: string[] }>(
      '/ai/questions',
      { content, count },
      token,
    );
    return result.questions;
  }

  async explainConcept(concept: string, context: string, _level?: AcademicLevel): Promise<string> {
    const token = await this.getToken();
    const result = await apiClient.post<{ explanation: string }>(
      '/ai/explain',
      { concept, context },
      token,
    );
    return result.explanation;
  }
}

export const aiProvider: AIProvider = new OpenRouterAIProvider();

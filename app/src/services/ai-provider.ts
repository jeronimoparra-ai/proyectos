export interface AIProvider {
  summarize(content: string, options?: AISummaryOptions): Promise<AISummaryResult>;
  extractKeyIdeas(content: string): Promise<string[]>;
  generateQuestions(content: string, count?: number): Promise<string[]>;
  explainConcept(concept: string, context: string, level?: AcademicLevel): Promise<string>;
}

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

export interface AIProviderConfig {
  provider: 'openrouter' | 'gemini' | 'openai' | 'local';
  apiKey: string;
  model: string;
}

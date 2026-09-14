import { env } from '../../config/env';
import { createAppError } from '../../middleware/error.middleware';

export interface AISummaryResult {
  summary: string;
  keyIdeas: string[];
  concepts: string[];
}

export interface AIQuestionsResult {
  questions: string[];
}

export interface AIExplanationResult {
  explanation: string;
}

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

const SYSTEM_PROMPT = `You are an academic assistant. Analyze the content provided and generate structured responses.
Always respond in valid JSON format as specified in the user prompt.
Be concise but thorough. Focus on the most important academic concepts.`;

export class AIService {
  private async callOpenRouter(messages: OpenRouterMessage[]): Promise<string> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.openrouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': env.frontendUrl ?? 'http://localhost:8081',
        'X-Title': 'Productivity App',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages,
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw createAppError(`AI service error: ${error}`, 500, 'AI_SERVICE_ERROR');
    }

    const data = await response.json() as OpenRouterResponse;
    return data.choices[0]?.message?.content ?? '';
  }

  async generateSummary(content: string): Promise<AISummaryResult> {
    const prompt = `Analyze the following academic content and provide:
1. A concise summary (2-3 paragraphs)
2. Key ideas (list of 3-7 main ideas)
3. Important concepts (list of key terms/concepts)

Respond in JSON format:
{
  "summary": "...",
  "keyIdeas": ["...", "..."],
  "concepts": ["...", "..."]
}

Content to analyze:
${content}`;

    const response = await this.callOpenRouter([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ]);

    try {
      const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleaned) as AISummaryResult;
    } catch {
      return {
        summary: response,
        keyIdeas: [],
        concepts: [],
      };
    }
  }

  async generateQuestions(content: string, count: number = 5): Promise<AIQuestionsResult> {
    const prompt = `Based on the following academic content, generate ${count} review questions that test understanding of the key concepts.

Respond in JSON format:
{
  "questions": ["Question 1?", "Question 2?", ...]
}

Content:
${content}`;

    const response = await this.callOpenRouter([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ]);

    try {
      const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleaned) as AIQuestionsResult;
    } catch {
      return { questions: [] };
    }
  }

  async explainConcept(concept: string, context: string): Promise<AIExplanationResult> {
    const prompt = `Explain the following concept in simple terms, suitable for a student:

Concept: ${concept}
Context: ${context}

Provide a clear, concise explanation with examples if helpful.

Respond in JSON format:
{
  "explanation": "..."
}`;

    const response = await this.callOpenRouter([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ]);

    try {
      const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleaned) as AIExplanationResult;
    } catch {
      return { explanation: response };
    }
  }

  async generateStudyRecommendation(
    topics: string[],
    performance: Record<string, 'weak' | 'medium' | 'strong'>
  ): Promise<string> {
    const prompt = `Based on the student's study topics and performance, generate a brief study recommendation.

Topics studied: ${topics.join(', ')}
Performance: ${JSON.stringify(performance)}

Provide a concise, actionable recommendation (2-3 sentences).`;

    return this.callOpenRouter([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ]);
  }
}

export const aiService = new AIService();

import { apiClient } from './api';
import { supabase } from './supabase';
import type { AcademicTask, StudyMaterial, Topic } from '../types';

interface AcademicTaskFilters {
  subject?: string;
  search?: string;
  page?: number;
  limit?: number;
}

interface AcademicTaskListResponse {
  tasks: AcademicTask[];
  total: number;
  page: number;
  limit: number;
}

interface AIResult {
  summary: string;
  keyIdeas: string[];
  concepts: string[];
  questions: string[];
}

class AcademicTaskService {
  private async getToken(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? '';
  }

  async list(filters: AcademicTaskFilters = {}): Promise<AcademicTaskListResponse> {
    const token = await this.getToken();
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });

    const queryString = params.toString();
    const endpoint = `/academic${queryString ? `?${queryString}` : ''}`;

    return apiClient.get<AcademicTaskListResponse>(endpoint, token);
  }

  async getById(id: string): Promise<AcademicTask> {
    const token = await this.getToken();
    return apiClient.get<AcademicTask>(`/academic/${id}`, token);
  }

  async create(data: {
    title: string;
    subject?: string;
    content?: string;
    materials?: Array<{ type: string; content: string; file_name?: string }>;
    topics?: Array<{ name: string; description?: string }>;
  }): Promise<AcademicTask> {
    const token = await this.getToken();
    return apiClient.post<AcademicTask>('/academic', data, token);
  }

  async update(id: string, data: Partial<AcademicTask>): Promise<AcademicTask> {
    const token = await this.getToken();
    return apiClient.patch<AcademicTask>(`/academic/${id}`, data, token);
  }

  async remove(id: string): Promise<void> {
    const token = await this.getToken();
    await apiClient.delete(`/academic/${id}`, token);
  }

  async processWithAI(id: string): Promise<AIResult> {
    const token = await this.getToken();
    return apiClient.post<AIResult>(`/academic/${id}/process`, {}, token);
  }

  async generateSummary(content: string): Promise<{ summary: string; keyIdeas: string[]; concepts: string[] }> {
    const token = await this.getToken();
    return apiClient.post('/ai/summarize', { content }, token);
  }

  async generateQuestions(content: string, count: number = 5): Promise<{ questions: string[] }> {
    const token = await this.getToken();
    return apiClient.post('/ai/questions', { content, count }, token);
  }

  async explainConcept(concept: string, context: string): Promise<{ explanation: string }> {
    const token = await this.getToken();
    return apiClient.post('/ai/explain', { concept, context }, token);
  }

  async webSearch(query: string, count: number = 5): Promise<{
    results: Array<{ title: string; url: string; description: string; age?: string }>;
    query: string;
    totalResults: number;
  }> {
    const token = await this.getToken();
    return apiClient.post('/search', { query, count }, token);
  }

  async researchTopic(topic: string, context?: string): Promise<{
    sources: Array<{ title: string; url: string; description: string }>;
    summary: string;
  }> {
    const token = await this.getToken();
    return apiClient.post('/search/research', { topic, context }, token);
  }
}

export const academicTaskService = new AcademicTaskService();

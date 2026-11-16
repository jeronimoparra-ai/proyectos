/**
 * Cliente API tipado para tests de integración
 * Proporciona helpers para interactuar con el backend durante tests
 */

import { createAppError, type AppError } from '../../backend/src/middleware/error.middleware';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  statusCode?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export class ApiTestClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private authTokens?: AuthTokens;

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  setAuthTokens(tokens: AuthTokens) {
    this.authTokens = tokens;
  }

  clearAuthTokens() {
    this.authTokens = undefined;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    customHeaders?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...customHeaders,
    };

    if (this.authTokens) {
      headers['Authorization'] = `Bearer ${this.authTokens.accessToken}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error: AppError = {
        message: data.error?.message ?? 'Request failed',
        statusCode: response.status,
        code: data.error?.code,
      };
      throw error;
    }

    return {
      success: true,
      data: data as T,
    };
  }

  // Auth endpoints
  async register(email: string, password: string, displayName: string): Promise<ApiResponse<{ user: unknown; tokens: AuthTokens }>> {
    return this.request('POST', '/api/auth/register', { email, password, displayName });
  }

  async login(email: string, password: string): Promise<ApiResponse<{ user: unknown; tokens: AuthTokens }>> {
    return this.request('POST', '/api/auth/login', { email, password });
  }

  async refreshToken(refreshToken: string): Promise<ApiResponse<{ tokens: AuthTokens }>> {
    return this.request('POST', '/api/auth/refresh', { refresh_token: refreshToken });
  }

  async forgotPassword(email: string): Promise<ApiResponse<unknown>> {
    return this.request('POST', '/api/auth/forgot-password', { email });
  }

  // Tasks endpoints
  async getTasks(params?: { page?: number; limit?: number; status?: string }): Promise<ApiResponse<unknown>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.status) searchParams.set('status', params.status);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request('GET', `/api/tasks${query}`);
  }

  async createTask(data: { title: string; description?: string; due_date?: string; priority?: string }): Promise<ApiResponse<unknown>> {
    return this.request('POST', '/api/tasks', data);
  }

  async updateTask(id: string, data: Partial<{ title: string; description: string; due_date: string; priority: string; status: string }>): Promise<ApiResponse<unknown>> {
    return this.request('PATCH', `/api/tasks/${id}`, data);
  }

  async deleteTask(id: string): Promise<ApiResponse<unknown>> {
    return this.request('DELETE', `/api/tasks/${id}`);
  }

  // Events endpoints
  async getEvents(params?: { page?: number; limit?: number }): Promise<ApiResponse<unknown>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request('GET', `/api/events${query}`);
  }

  async createEvent(data: { title: string; start_date: string; end_date: string; description?: string }): Promise<ApiResponse<unknown>> {
    return this.request('POST', '/api/events', data);
  }

  // Academic tasks endpoints
  async getAcademicTasks(params?: { page?: number; limit?: number; subject?: string }): Promise<ApiResponse<unknown>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.subject) searchParams.set('subject', params.subject);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request('GET', `/api/academic-tasks${query}`);
  }

  async createAcademicTask(data: { title: string; subject?: string; content?: string }): Promise<ApiResponse<unknown>> {
    return this.request('POST', '/api/academic-tasks', data);
  }

  // Reviews endpoints
  async recordReview(data: { academic_task_id: string; quality: number; difficulty?: number; time_spent_seconds?: number }): Promise<ApiResponse<unknown>> {
    return this.request('POST', '/api/reviews', data);
  }

  async getDueReviews(limit?: number): Promise<ApiResponse<unknown>> {
    const query = limit ? `?limit=${limit}` : '';
    return this.request('GET', `/api/reviews/due${query}`);
  }

  // AI endpoints
  async processAI(data: { prompt: string; model?: string }): Promise<ApiResponse<unknown>> {
    return this.request('POST', '/api/ai/process', data);
  }

  // Notifications endpoints
  async registerPushToken(data: { token: string; platform: string }): Promise<ApiResponse<unknown>> {
    return this.request('POST', '/api/notifications/push-token', data);
  }
}

// Instancia singleton para uso compartido
export const apiClient = new ApiTestClient();
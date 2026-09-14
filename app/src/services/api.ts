const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

interface RequestOptions extends RequestInit {
  token?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { token, ...fetchOptions } = options;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...fetchOptions,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message ?? `HTTP ${response.status}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  get<T>(endpoint: string, token?: string) {
    return this.request<T>(endpoint, { method: 'GET', token });
  }

  post<T>(endpoint: string, body: unknown, token?: string) {
    return this.request<T>(endpoint, { method: 'POST', body: JSON.stringify(body), token });
  }

  put<T>(endpoint: string, body: unknown, token?: string) {
    return this.request<T>(endpoint, { method: 'PUT', body: JSON.stringify(body), token });
  }

  patch<T>(endpoint: string, body: unknown, token?: string) {
    return this.request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body), token });
  }

  delete<T>(endpoint: string, token?: string) {
    return this.request<T>(endpoint, { method: 'DELETE', token });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);

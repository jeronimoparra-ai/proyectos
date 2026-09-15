const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const DEFAULT_TIMEOUT_MS = 15000;

export class ApiTimeoutError extends Error {
  constructor(message = 'Sin conexión: el servidor tardó demasiado en responder') {
    super(message);
    this.name = 'TimeoutError';
  }
}

interface RequestOptions extends RequestInit {
  token?: string;
  timeoutMs?: number;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { token, timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const signal = options.signal ?? (
      typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(timeoutMs)
        : undefined
    );

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...fetchOptions,
        headers,
        signal,
      });
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
        throw new ApiTimeoutError();
      }
      throw err;
    }

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

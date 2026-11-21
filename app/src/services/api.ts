import { offlineEngine, currentSession } from './offline/runtime';
import { isList, isMutation, uuid } from './offline/engine';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const DEFAULT_TIMEOUT_MS = 15000;

export class ApiTimeoutError extends Error {
  constructor(message = 'Connection failed: the server took too long to respond') {
    super(message);
    this.name = 'TimeoutError';
  }
}

interface RequestOptions extends RequestInit {
  token?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export class ApiHttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

class ApiClient {
  private baseUrl: string;
  private activeControllers = new Set<AbortController>();

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  abortAll() {
    for (const controller of this.activeControllers) {
      try {
        controller.abort();
      } catch {
        // Ignore errors during abort
      }
    }
    this.activeControllers.clear();
  }

  async syncOffline() {
    await offlineEngine.syncNow();
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const method = options.method ?? 'GET';
    const mutation = isMutation(endpoint, method);
    const session = options.token && (mutation || isList(endpoint)) ? await currentSession() : null;
    if (session && session.token !== options.token) throw new Error('Session changed');
    if (session) await offlineEngine.setUser(session.userId);
    const key = mutation ? uuid() : '';
    const body = mutation ? JSON.parse(String(options.body ?? '{}')) : {};
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (session && mutation && offlineEngine.state.pending.length) {
      const local = await offlineEngine.enqueue(endpoint, method, body, session.userId, key);
      void this.syncOffline().catch(() => {});
      return local as T;
    }
    let result: T;
    try {
      result = await this.network<T>(endpoint, {
        ...options, headers: { ...(options.headers as Record<string, string>), ...(key ? { 'Idempotency-Key': key } : {}) },
      });
    } catch (error) {
      if (session && mutation && error instanceof ApiHttpError && [409, 412].includes(error.status)) {
        const local = await offlineEngine.enqueue(endpoint, method, body, session.userId, key);
        await offlineEngine.markConflict(key);
        return local as T;
      }
      // Explicit cancellation is never a user intent to save a mutation offline.
      if (options.signal?.aborted || error instanceof ApiHttpError ||
          !(error instanceof TypeError || error instanceof ApiTimeoutError)) throw error;
      if (!session) throw error;
      const active = await currentSession();
      if (active?.userId !== session.userId) throw error;
      if (mutation) {
        const local = await offlineEngine.enqueue(endpoint, method, body, session.userId, key);
        void this.syncOffline().catch(() => {});
        return local as T;
      }
      const cached = await offlineEngine.cached(endpoint, session.userId);
      if (cached !== undefined) return cached as T;
      throw error;
    }
    if (session) {
      if (mutation) await offlineEngine.invalidate(session.userId);
      else await offlineEngine.cacheList(endpoint, result, session.userId);
      void this.syncOffline().catch(() => {});
    }
    return result;
  }

  // Replay calls this directly so a failed replay cannot enqueue a second operation.
  async network<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { token, timeoutMs = DEFAULT_TIMEOUT_MS, signal, ...fetchOptions } = options;

    const controller = new AbortController();
    this.activeControllers.add(controller);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let timedOut = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
    }

    const abortFromCaller = () => controller.abort();
    if (signal) {
      if (signal.aborted) {
        controller.abort();
      } else {
        signal.addEventListener('abort', abortFromCaller, { once: true });
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Request failed' }));
        throw new ApiHttpError(response.status, error.message ?? `HTTP ${response.status}`);
      }
      if (response.status === 204) return undefined as T;
      // Keep the deadline and caller cancellation alive while reading a slow body.
      return await response.json();
    } catch (err: unknown) {
      if (timedOut) throw new ApiTimeoutError();
      throw err;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      signal?.removeEventListener('abort', abortFromCaller);
      this.activeControllers.delete(controller);
    }
  }

  get<T>(endpoint: string, token?: string, signal?: AbortSignal) {
    return this.request<T>(endpoint, { method: 'GET', token, signal });
  }

  post<T>(endpoint: string, body: unknown, token?: string, signal?: AbortSignal) {
    return this.request<T>(endpoint, { method: 'POST', body: JSON.stringify(body), token, signal });
  }

  put<T>(endpoint: string, body: unknown, token?: string, signal?: AbortSignal) {
    return this.request<T>(endpoint, { method: 'PUT', body: JSON.stringify(body), token, signal });
  }

  patch<T>(endpoint: string, body: unknown, token?: string, signal?: AbortSignal) {
    return this.request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body), token, signal });
  }

  delete<T>(endpoint: string, token?: string, body?: unknown, signal?: AbortSignal) {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      token,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal,
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);

offlineEngine.transport = (endpoint, method, body, session, key, signal) =>
  apiClient.network(endpoint, {
    method, body: JSON.stringify(body), token: session.token, signal,
    headers: { 'Idempotency-Key': key },
  });

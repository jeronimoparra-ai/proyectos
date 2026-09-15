import { apiClient } from './api';
import { supabase } from './supabase';
import type { Task, TaskStatus, TaskPriority } from '../types';

interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  category_id?: string;
  due_before?: string;
  due_after?: string;
  search?: string;
  page?: number;
  limit?: number;
}

interface TaskListResponse {
  tasks: Task[];
  total: number;
  page: number;
  limit: number;
}

class TaskService {
  private async getToken(): Promise<string> {
    if (!supabase) return '';
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? '';
  }

  async list(filters: TaskFilters = {}): Promise<TaskListResponse> {
    const token = await this.getToken();
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });

    const queryString = params.toString();
    const endpoint = `/tasks${queryString ? `?${queryString}` : ''}`;

    return apiClient.get<TaskListResponse>(endpoint, token);
  }

  async getById(id: string): Promise<Task> {
    const token = await this.getToken();
    return apiClient.get<Task>(`/tasks/${id}`, token);
  }

  async create(data: Partial<Task> & { title: string }): Promise<Task> {
    const token = await this.getToken();
    return apiClient.post<Task>('/tasks', data, token);
  }

  async update(id: string, data: Partial<Task>): Promise<Task> {
    const token = await this.getToken();
    return apiClient.patch<Task>(`/tasks/${id}`, data, token);
  }

  async complete(id: string): Promise<Task> {
    const token = await this.getToken();
    return apiClient.patch<Task>(`/tasks/${id}/complete`, {}, token);
  }

  async remove(id: string): Promise<void> {
    const token = await this.getToken();
    await apiClient.delete(`/tasks/${id}`, token);
  }

  async getOverdue(): Promise<Task[]> {
    const token = await this.getToken();
    return apiClient.get<Task[]>('/tasks/overdue', token);
  }

  async getUpcoming(days: number = 7): Promise<Task[]> {
    const token = await this.getToken();
    return apiClient.get<Task[]>(`/tasks/upcoming?days=${days}`, token);
  }
}

export const taskService = new TaskService();

import { apiClient } from './api';
import { supabase } from './supabase';
import type { Event } from '../types';

interface EventFilters {
  start_after?: string;
  start_before?: string;
  category_id?: string;
  search?: string;
  source?: 'local' | 'google';
  page?: number;
  limit?: number;
}

interface EventListResponse {
  events: Event[];
  total: number;
  page: number;
  limit: number;
}

class EventService {
  private async getToken(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? '';
  }

  async list(filters: EventFilters = {}): Promise<EventListResponse> {
    const token = await this.getToken();
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });

    const queryString = params.toString();
    const endpoint = `/events${queryString ? `?${queryString}` : ''}`;

    return apiClient.get<EventListResponse>(endpoint, token);
  }

  async getById(id: string): Promise<Event> {
    const token = await this.getToken();
    return apiClient.get<Event>(`/events/${id}`, token);
  }

  async create(data: Partial<Event> & { title: string; start_date: string; end_date: string }): Promise<Event> {
    const token = await this.getToken();
    return apiClient.post<Event>('/events', data, token);
  }

  async update(id: string, data: Partial<Event>): Promise<Event> {
    const token = await this.getToken();
    return apiClient.patch<Event>(`/events/${id}`, data, token);
  }

  async remove(id: string): Promise<void> {
    const token = await this.getToken();
    await apiClient.delete(`/events/${id}`, token);
  }

  async getByDateRange(startDate: string, endDate: string): Promise<Event[]> {
    const token = await this.getToken();
    return apiClient.get<Event[]>(`/events/range?start_date=${startDate}&end_date=${endDate}`, token);
  }
}

export const eventService = new EventService();

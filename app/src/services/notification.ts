import { apiClient } from './api';
import { supabase } from './supabase';

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  read_at: string | null;
  data: Record<string, unknown> | null;
  created_at: string;
}

class NotificationService {
  private async getToken(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? '';
  }

  async registerPushToken(pushToken: string, platform: 'android' | 'ios' | 'web' = 'android'): Promise<void> {
    const token = await this.getToken();
    await apiClient.post('/notifications/push-token', { token: pushToken, platform }, token);
  }

  async removePushToken(pushToken: string): Promise<void> {
    const token = await this.getToken();
    await apiClient.delete('/notifications/push-token', token);
  }

  async listNotifications(limit: number = 50): Promise<AppNotification[]> {
    const token = await this.getToken();
    return apiClient.get<AppNotification[]>(`/notifications?limit=${limit}`, token);
  }

  async markAsRead(notificationId: string): Promise<void> {
    const token = await this.getToken();
    await apiClient.patch(`/notifications/${notificationId}/read`, {}, token);
  }

  async markAllAsRead(): Promise<void> {
    const token = await this.getToken();
    await apiClient.patch('/notifications/read-all', {}, token);
  }

  async getUnreadCount(): Promise<number> {
    const token = await this.getToken();
    const result = await apiClient.get<{ count: number }>('/notifications/unread-count', token);
    return result.count;
  }
}

export const notificationService = new NotificationService();

import { apiClient } from './api';
import { supabase } from './supabase';
import type { AcademicTask } from '../types';

export interface Review {
  id: string;
  academic_task_id: string;
  user_id: string;
  quality: number;
  difficulty: number | null;
  time_spent_seconds: number | null;
  ease_factor: number;
  interval: number;
  repetitions: number;
  next_review_at: string | null;
  created_at: string;
}

export interface ReviewResult {
  review: Review;
  sm2: {
    easeFactor: number;
    interval: number;
    repetitions: number;
    nextReviewAt: string;
  };
}

export interface ReviewStats {
  totalTasks: number;
  dueToday: number;
  totalReviews: number;
}

export interface WeeklyFeedback {
  tasksCompleted: number;
  tasksPending: number;
  tasksOverdue: number;
  studyHours: number;
  topicsStudied: string[];
  recentActivity: string[];
  recommendations: string[];
}

class ReviewService {
  private async getToken(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? '';
  }

  async getDueReviews(limit: number = 10): Promise<AcademicTask[]> {
    const token = await this.getToken();
    return apiClient.get<AcademicTask[]>(`/reviews/due?limit=${limit}`, token);
  }

  async recordReview(data: {
    academic_task_id: string;
    quality: number;
    difficulty?: number;
    time_spent_seconds?: number;
  }): Promise<ReviewResult> {
    const token = await this.getToken();
    return apiClient.post<ReviewResult>('/reviews', data, token);
  }

  async getReviewHistory(taskId: string): Promise<Review[]> {
    const token = await this.getToken();
    return apiClient.get<Review[]>(`/reviews/history/${taskId}`, token);
  }

  async getReviewStats(): Promise<ReviewStats> {
    const token = await this.getToken();
    return apiClient.get<ReviewStats>('/reviews/stats', token);
  }

  async getWeeklyFeedback(): Promise<WeeklyFeedback> {
    const token = await this.getToken();
    return apiClient.get<WeeklyFeedback>('/reviews/feedback', token);
  }

  async getRecommendations(): Promise<string[]> {
    const token = await this.getToken();
    const response = await apiClient.get<{ recommendations: string[] }>('/reviews/recommendations', token);
    return response.recommendations;
  }

  async initializeForTask(taskId: string): Promise<{ message: string }> {
    const token = await this.getToken();
    return apiClient.post<{ message: string }>(`/reviews/initialize/${taskId}`, {}, token);
  }
}

export const reviewService = new ReviewService();

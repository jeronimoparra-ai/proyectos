import { apiClient } from './api';
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
  async getDueReviews(limit: number = 10): Promise<AcademicTask[]> {
    return apiClient.get<AcademicTask[]>(`/reviews/due?limit=${limit}`);
  }

  async recordReview(data: {
    academic_task_id: string;
    quality: number;
    difficulty?: number;
    time_spent_seconds?: number;
  }): Promise<ReviewResult> {
    return apiClient.post<ReviewResult>('/reviews', data);
  }

  async getReviewHistory(taskId: string): Promise<Review[]> {
    return apiClient.get<Review[]>(`/reviews/history/${taskId}`);
  }

  async getReviewStats(): Promise<ReviewStats> {
    return apiClient.get<ReviewStats>('/reviews/stats');
  }

  async getWeeklyFeedback(): Promise<WeeklyFeedback> {
    return apiClient.get<WeeklyFeedback>('/reviews/feedback');
  }

  async getRecommendations(): Promise<string[]> {
    const response = await apiClient.get<{ recommendations: string[] }>('/reviews/recommendations');
    return response.recommendations;
  }

  async initializeForTask(taskId: string): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>(`/reviews/initialize/${taskId}`, {});
  }
}

export const reviewService = new ReviewService();

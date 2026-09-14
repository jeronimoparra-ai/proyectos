import { create } from 'zustand';
import { reviewService, type Review, type ReviewStats, type WeeklyFeedback } from '../services/review';
import type { AcademicTask } from '../types';

interface ReviewState {
  dueReviews: AcademicTask[];
  reviewHistory: Review[];
  reviewStats: ReviewStats | null;
  feedback: WeeklyFeedback | null;
  recommendations: string[];
  isLoading: boolean;
  isSubmitting: boolean;

  loadDueReviews: (limit?: number) => Promise<void>;
  loadReviewHistory: (taskId: string) => Promise<void>;
  loadReviewStats: () => Promise<void>;
  submitReview: (data: {
    academic_task_id: string;
    quality: number;
    difficulty?: number;
    time_spent_seconds?: number;
  }) => Promise<void>;
  loadFeedback: () => Promise<void>;
  loadRecommendations: () => Promise<void>;
}

export const useReviewStore = create<ReviewState>((set) => ({
  dueReviews: [],
  reviewHistory: [],
  reviewStats: null,
  feedback: null,
  recommendations: [],
  isLoading: false,
  isSubmitting: false,

  loadDueReviews: async (limit = 10) => {
    set({ isLoading: true });
    try {
      const dueReviews = await reviewService.getDueReviews(limit);
      set({ dueReviews });
    } catch (error) {
      console.error('Error loading due reviews:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  loadReviewHistory: async (taskId: string) => {
    set({ isLoading: true });
    try {
      const reviewHistory = await reviewService.getReviewHistory(taskId);
      set({ reviewHistory });
    } catch (error) {
      console.error('Error loading review history:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  loadReviewStats: async () => {
    try {
      const reviewStats = await reviewService.getReviewStats();
      set({ reviewStats });
    } catch (error) {
      console.error('Error loading review stats:', error);
    }
  },

  submitReview: async (data) => {
    set({ isSubmitting: true });
    try {
      await reviewService.recordReview(data);
    } catch (error) {
      console.error('Error submitting review:', error);
      throw error;
    } finally {
      set({ isSubmitting: false });
    }
  },

  loadFeedback: async () => {
    try {
      const feedback = await reviewService.getWeeklyFeedback();
      set({ feedback });
    } catch (error) {
      console.error('Error loading feedback:', error);
    }
  },

  loadRecommendations: async () => {
    try {
      const recommendations = await reviewService.getRecommendations();
      set({ recommendations });
    } catch (error) {
      console.error('Error loading recommendations:', error);
    }
  },
}));

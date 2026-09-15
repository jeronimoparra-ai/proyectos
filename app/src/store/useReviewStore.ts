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
  error: string | null;

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
  error: null,

  loadDueReviews: async (limit = 10) => {
    set({ isLoading: true, error: null });
    try {
      const dueReviews = await reviewService.getDueReviews(limit);
      set({ dueReviews });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load due reviews';
      console.error('Error loading due reviews:', error);
      set({ error: message });
    } finally {
      set({ isLoading: false });
    }
  },

  loadReviewHistory: async (taskId: string) => {
    set({ isLoading: true, error: null });
    try {
      const reviewHistory = await reviewService.getReviewHistory(taskId);
      set({ reviewHistory });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load review history';
      console.error('Error loading review history:', error);
      set({ error: message });
    } finally {
      set({ isLoading: false });
    }
  },

  loadReviewStats: async () => {
    set({ error: null });
    try {
      const reviewStats = await reviewService.getReviewStats();
      set({ reviewStats });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load review stats';
      console.error('Error loading review stats:', error);
      set({ error: message });
    }
  },

  submitReview: async (data) => {
    set({ isSubmitting: true, error: null });
    try {
      await reviewService.recordReview(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit review';
      console.error('Error submitting review:', error);
      set({ error: message });
      throw error;
    } finally {
      set({ isSubmitting: false });
    }
  },

  loadFeedback: async () => {
    set({ error: null });
    try {
      const feedback = await reviewService.getWeeklyFeedback();
      set({ feedback });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load feedback';
      console.error('Error loading feedback:', error);
      set({ error: message });
    }
  },

  loadRecommendations: async () => {
    set({ error: null });
    try {
      const recommendations = await reviewService.getRecommendations();
      set({ recommendations });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load recommendations';
      console.error('Error loading recommendations:', error);
      set({ error: message });
    }
  },
}));

import { supabase } from '../../database/supabase';
import { createAppError } from '../../middleware/error.middleware';
import { calculateSM2 } from '../../utils/sm2';
import type { CreateReviewInput } from './review.schema';

export class ReviewService {
  async recordReview(userId: string, input: CreateReviewInput) {
    // Use atomic RPC function for review recording with locking, idempotency, and proper SM-2 tracking
    const { data, error } = await supabase.rpc('record_review_atomic', {
      p_user_id: userId,
      p_academic_task_id: input.academic_task_id,
      p_quality: input.quality,
      p_difficulty: input.difficulty ?? null,
      p_time_spent_seconds: input.time_spent_seconds ?? null,
      p_idempotency_key: input.idempotency_key ?? null,
    });

    if (error) {
      // Handle specific error codes
      if (error.code === 'P0001') {
        throw createAppError('Academic task not found', 404, 'TASK_NOT_FOUND');
      }
      throw createAppError(error.message, 500, 'DB_ERROR');
    }

    if (!data || data.length === 0) {
      throw createAppError('Failed to record review', 500, 'DB_ERROR');
    }

    const result = data[0];

    // Return format compatible with existing code
    return {
      review: {
        id: result.review_id,
        academic_task_id: input.academic_task_id,
        user_id: userId,
        quality: result.quality,
        difficulty: result.difficulty,
        time_spent_seconds: result.time_spent_seconds,
        ease_factor: result.ease_factor,
        interval: result.interval,
        repetitions: result.repetitions,
        next_review_at: result.next_review_at,
        created_at: result.created_at,
      },
      sm2: {
        easeFactor: result.ease_factor,
        interval: result.interval,
        repetitions: result.repetitions,
        nextReviewAt: result.next_review_at,
      },
      isDuplicate: result.is_duplicate,
      sm2Repetitions: result.sm2_repetitions,
      totalReviews: result.total_reviews,
    };
  }

  async getDueReviews(userId: string, limit: number = 10) {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('academic_tasks')
      .select(`
        *,
        study_materials (*),
        topics (*)
      `)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .lte('next_review_at', now)
      .order('next_review_at', { ascending: true })
      .limit(limit);

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');

    return data ?? [];
  }

  async getReviewHistory(userId: string, academicTaskId: string) {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('user_id', userId)
      .eq('academic_task_id', academicTaskId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');

    return data ?? [];
  }

  async getReviewStats(userId: string) {
    const { data: tasks, error: tasksError } = await supabase
      .from('academic_tasks')
      .select('id, next_review_at, review_count, total_reviews')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (tasksError) throw createAppError(tasksError.message, 500, 'DB_ERROR');

    const now = new Date();
    const dueToday = (tasks ?? []).filter((t) => {
      if (!t.next_review_at) return false;
      return new Date(t.next_review_at) <= now;
    }).length;

    // Use total_reviews for historical count, review_count for SM-2 streak
    const totalReviews = (tasks ?? []).reduce((sum, t) => sum + (t.total_reviews ?? 0), 0);

    const { count: totalTasks } = await supabase
      .from('academic_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('deleted_at', null);

    return {
      totalTasks: totalTasks ?? 0,
      dueToday,
      totalReviews,
    };
  }

  async initializeForTask(userId: string, academicTaskId: string) {
    const { error } = await supabase
      .from('academic_tasks')
      .update({
        next_review_at: new Date().toISOString(),
        review_count: 0,
        total_reviews: 0,
      })
      .eq('id', academicTaskId)
      .eq('user_id', userId);

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');

    return { message: 'Task initialized for spaced repetition' };
  }
}

export const reviewService = new ReviewService();
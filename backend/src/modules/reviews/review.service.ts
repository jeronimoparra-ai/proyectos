import { supabase } from '../../database/supabase';
import { createAppError } from '../../middleware/error.middleware';
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
    }) as { data: Array<{ review_id: string; quality: number; difficulty: number | null; time_spent_seconds: number | null; ease_factor: number; interval: number; repetitions: number; next_review_at: string; created_at: string; is_duplicate: boolean; sm2_repetitions: number; total_reviews: number }> | null; error: { code: string; message: string } | null };

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

    const dueReviews = (data ?? []) as Array<{ id: string; [key: string]: unknown }>;
    return dueReviews;
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

    const history = (data ?? []) as Array<{ id: string; [key: string]: unknown }>;
    return history;
  }

  async getReviewStats(userId: string) {
    const { data, error } = await supabase.rpc('get_review_stats', { p_user_id: userId }) as {
      data: Array<{ total_tasks: number | string; due_today: number | string; total_reviews: number | string }> | null;
      error: { message: string } | null;
    };
    if (error) throw createAppError(error.message, 500, 'DB_ERROR');
    const stats = data?.[0];
    return {
      totalTasks: Number(stats?.total_tasks ?? 0),
      dueToday: Number(stats?.due_today ?? 0),
      totalReviews: Number(stats?.total_reviews ?? 0),
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
      .eq('user_id', userId)
      .is('next_review_at', null)
      .eq('total_reviews', 0);

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');

    return { message: 'Task initialized for spaced repetition' };
  }
}

export const reviewService = new ReviewService();
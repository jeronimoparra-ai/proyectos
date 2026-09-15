import { supabase } from '../../database/supabase';
import { createAppError } from '../../middleware/error.middleware';
import { calculateSM2 } from '../../utils/sm2';
import type { CreateReviewInput } from './review.schema';

export class ReviewService {
  async recordReview(userId: string, input: CreateReviewInput) {
    const { data: existing, error: fetchError } = await supabase
      .from('academic_tasks')
      .select('id, user_id')
      .eq('id', input.academic_task_id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !existing) {
      throw createAppError('Academic task not found', 404, 'TASK_NOT_FOUND');
    }

    const { data: lastReview } = await supabase
      .from('reviews')
      .select('ease_factor, interval, repetitions')
      .eq('academic_task_id', input.academic_task_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const sm2Result = calculateSM2(
      input.quality,
      lastReview?.ease_factor ?? 2.5,
      lastReview?.interval ?? 0,
      lastReview?.repetitions ?? 0
    );

    const { data, error } = await supabase
      .from('reviews')
      .insert({
        academic_task_id: input.academic_task_id,
        user_id: userId,
        quality: input.quality,
        difficulty: input.difficulty,
        time_spent_seconds: input.time_spent_seconds,
        ease_factor: sm2Result.easeFactor,
        interval: sm2Result.interval,
        repetitions: sm2Result.repetitions,
        next_review_at: sm2Result.nextReviewAt,
      })
      .select()
      .single();

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');

    await supabase
      .from('academic_tasks')
      .update({
        next_review_at: sm2Result.nextReviewAt,
        review_count: (lastReview?.repetitions ?? 0) + 1,
      })
      .eq('id', input.academic_task_id);

    return {
      review: data,
      sm2: sm2Result,
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
      .select('id, next_review_at, review_count')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (tasksError) throw createAppError(tasksError.message, 500, 'DB_ERROR');

    const now = new Date();
    const dueToday = (tasks ?? []).filter((t) => {
      if (!t.next_review_at) return false;
      return new Date(t.next_review_at) <= now;
    }).length;

    const totalReviews = (tasks ?? []).reduce((sum, t) => sum + (t.review_count ?? 0), 0);

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
      })
      .eq('id', academicTaskId)
      .eq('user_id', userId);

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');

    return { message: 'Task initialized for spaced repetition' };
  }
}

export const reviewService = new ReviewService();

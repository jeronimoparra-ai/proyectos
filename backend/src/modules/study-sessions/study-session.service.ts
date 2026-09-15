import { supabase } from '../../database/supabase';
import { createAppError } from '../../middleware/error.middleware';
import type { CreateStudySessionInput, UpdateStudySessionInput } from './study-session.schema';

export class StudySessionService {
  async createSession(userId: string, input: CreateStudySessionInput) {
    const { data, error } = await supabase
      .from('study_sessions')
      .insert({
        user_id: userId,
        academic_task_id: input.academic_task_id ?? null,
        topic_id: input.topic_id ?? null,
        started_at: input.started_at ?? new Date().toISOString(),
        ended_at: input.ended_at ?? null,
        duration_seconds: input.duration_seconds ?? 0,
        notes: input.notes ?? null,
      })
      .select()
      .single();

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');
    return data;
  }

  async getSessionById(userId: string, sessionId: string) {
    const { data, error } = await supabase
      .from('study_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw createAppError('Study session not found', 404, 'SESSION_NOT_FOUND');
    }
    return data;
  }

  async listSessions(userId: string, academicTaskId?: string) {
    let query = supabase
      .from('study_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false });

    if (academicTaskId) {
      query = query.eq('academic_task_id', academicTaskId);
    }

    const { data, error } = await query;
    if (error) throw createAppError(error.message, 500, 'DB_ERROR');
    return data ?? [];
  }

  async updateSession(userId: string, sessionId: string, input: UpdateStudySessionInput) {
    const { data: existing } = await supabase
      .from('study_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (!existing) {
      throw createAppError('Study session not found', 404, 'SESSION_NOT_FOUND');
    }

    const { data, error } = await supabase
      .from('study_sessions')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');
    return data;
  }

  async deleteSession(userId: string, sessionId: string) {
    const { error } = await supabase
      .from('study_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', userId);

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');
    return { success: true };
  }
}

export const studySessionService = new StudySessionService();

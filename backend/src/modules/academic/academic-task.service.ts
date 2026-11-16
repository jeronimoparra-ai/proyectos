import { supabase } from '../../database/supabase';
import { createAppError } from '../../middleware/error.middleware';
import { aiService } from '../ai/ai.service';
import type {
  CreateAcademicTaskInput,
  UpdateAcademicTaskInput,
  AcademicTaskQueryInput,
} from './academic-task.schema';

export class AcademicTaskService {
  async list(userId: string, query: AcademicTaskQueryInput) {
    let qb = supabase
      .from('academic_tasks')
      .select('*, study_materials (*), topics (*)', { count: 'exact' })
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (query.subject) qb = qb.ilike('subject', `%${query.subject}%`);
    if (query.search) qb = qb.ilike('title', `%${query.search}%`);

    const offset = (query.page - 1) * query.limit;
    qb = qb.range(offset, offset + query.limit - 1);
    qb = qb.order('created_at', { ascending: false });

    const { data, error, count } = await qb;

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');

    return {
      tasks: (data ?? []) as Array<{ id: string; [key: string]: unknown }>,
      total: count ?? 0,
      page: query.page,
      limit: query.limit,
    };
  }

  async getById(userId: string, taskId: string) {
    const { data, error } = await supabase
      .from('academic_tasks')
      .select('*, study_materials (*), topics (*)')
      .eq('id', taskId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      throw createAppError('Academic task not found', 404, 'ACADEMIC_TASK_NOT_FOUND');
    }

    const typedData = data as { id: string; content?: string; study_materials?: Array<{ type: string; content: string }>; [key: string]: unknown };
    return typedData;
  }

  async create(userId: string, input: CreateAcademicTaskInput) {
    const { materials, topics, ...taskData } = input;

    // Use atomic RPC function for task + materials + topics creation
    const { data, error } = await supabase.rpc('create_academic_task_atomic', {
      p_user_id: userId,
      p_title: taskData.title,
      p_subject: taskData.subject ?? null,
      p_content: taskData.content ?? null,
      p_materials: materials ?? [],
      p_topics: topics ?? [],
    }) as { data: Array<{ id: string; [key: string]: unknown }> | null; error: Error | null };

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');

    if (!data || data.length === 0) {
      throw createAppError('Failed to create academic task', 500, 'DB_ERROR');
    }

    const createdTask = data[0] as { id: string; [key: string]: unknown };
    return createdTask;
  }

  async update(userId: string, taskId: string, input: UpdateAcademicTaskInput) {
    await this.getById(userId, taskId);

    const { data, error } = await supabase
      .from('academic_tasks')
      .update(input)
      .eq('id', taskId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');

    const updatedTask = data as { id: string; [key: string]: unknown };
    return updatedTask;
  }

  async softDelete(userId: string, taskId: string) {
    await this.getById(userId, taskId);

    const { error } = await supabase
      .from('academic_tasks')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', taskId)
      .eq('user_id', userId);

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');

    return { message: 'Academic task deleted' };
  }

  async processWithAI(userId: string, taskId: string) {
    const task = await this.getById(userId, taskId);

    const contentParts: string[] = [];

    if (task.content) {
      contentParts.push(task.content);
    }

    if (task.study_materials && task.study_materials.length > 0) {
      for (const material of task.study_materials) {
        if (material.type === 'text' || material.type === 'link') {
          contentParts.push(material.content);
        }
      }
    }

    if (contentParts.length === 0) {
      throw createAppError('No content to process', 400, 'NO_CONTENT');
    }

    const fullContent = contentParts.join('\n\n');
    const truncatedContent = fullContent.length > 15000 ? fullContent.substring(0, 15000) : fullContent;
    const summaryResult = await aiService.generateSummary(truncatedContent);
    const questionsResult = await aiService.generateQuestions(truncatedContent);

    const { error } = await supabase
      .from('academic_tasks')
      .update({
        summary: summaryResult.summary,
        key_ideas: summaryResult.keyIdeas,
        concepts: summaryResult.concepts,
        questions: questionsResult.questions,
        ai_processed_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .eq('user_id', userId);

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');

    return {
      summary: summaryResult.summary,
      keyIdeas: summaryResult.keyIdeas,
      concepts: summaryResult.concepts,
      questions: questionsResult.questions,
    };
  }
}

export const academicTaskService = new AcademicTaskService();

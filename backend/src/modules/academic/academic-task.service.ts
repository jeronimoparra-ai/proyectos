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
      tasks: data ?? [],
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

    return data;
  }

  async create(userId: string, input: CreateAcademicTaskInput) {
    const { materials, topics, ...taskData } = input;

    const { data, error } = await supabase
      .from('academic_tasks')
      .insert({ ...taskData, user_id: userId })
      .select()
      .single();

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');

    if (materials && materials.length > 0) {
      const materialInserts = materials.map((m) => ({
        academic_task_id: data.id,
        ...m,
      }));

      const { error: matError } = await supabase
        .from('study_materials')
        .insert(materialInserts);

      if (matError) throw createAppError(matError.message, 500, 'DB_ERROR');
    }

    if (topics && topics.length > 0) {
      const topicInserts = topics.map((t) => ({
        academic_task_id: data.id,
        ...t,
      }));

      const { error: topicError } = await supabase
        .from('topics')
        .insert(topicInserts);

      if (topicError) throw createAppError(topicError.message, 500, 'DB_ERROR');
    }

    return data;
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

    return data;
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
    const summaryResult = await aiService.generateSummary(fullContent);
    const questionsResult = await aiService.generateQuestions(fullContent);

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

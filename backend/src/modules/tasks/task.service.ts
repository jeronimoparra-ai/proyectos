import { supabase } from '../../database/supabase';
import { createAppError } from '../../middleware/error.middleware';
import type { CreateTaskInput, UpdateTaskInput, TaskQueryInput } from './task.schema';

export class TaskService {
  async list(userId: string, query: TaskQueryInput) {
    let qb = supabase
      .from('tasks')
      .select(`
        *,
        categories (*),
        task_tags (tags (*))
      `, { count: 'exact' })
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (query.status) qb = qb.eq('status', query.status);
    if (query.priority) qb = qb.eq('priority', query.priority);
    if (query.category_id) qb = qb.eq('category_id', query.category_id);
    if (query.due_before) qb = qb.lte('due_date', query.due_before);
    if (query.due_after) qb = qb.gte('due_date', query.due_after);
    if (query.search) qb = qb.ilike('title', `%${query.search}%`);

    const offset = (query.page - 1) * query.limit;
    qb = qb.range(offset, offset + query.limit - 1);
    qb = qb.order('due_date', { ascending: true, nullsFirst: false });
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
      .from('tasks')
      .select(`
        *,
        categories (*),
        task_tags (tags (*)),
        subtasks (*),
        reminders (*)
      `)
      .eq('id', taskId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      throw createAppError('Task not found', 404, 'TASK_NOT_FOUND');
    }

    return data;
  }

  async create(userId: string, input: CreateTaskInput) {
    const { tags, ...taskData } = input;

    const { data, error } = await supabase
      .from('tasks')
      .insert({ ...taskData, user_id: userId })
      .select()
      .single();

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');

    if (tags && tags.length > 0) {
      const tagInserts = tags.map((tagId) => ({
        task_id: data.id,
        tag_id: tagId,
      }));

      const { error: tagError } = await supabase
        .from('task_tags')
        .insert(tagInserts);

      if (tagError) throw createAppError(tagError.message, 500, 'DB_ERROR');
    }

    return data;
  }

  async update(userId: string, taskId: string, input: UpdateTaskInput) {
    const existing = await this.getById(userId, taskId);

    const { tags, ...updateData } = input;

    const { data, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');

    if (tags !== undefined) {
      await supabase
        .from('task_tags')
        .delete()
        .eq('task_id', taskId);

      if (tags.length > 0) {
        const tagInserts = tags.map((tagId) => ({
          task_id: taskId,
          tag_id: tagId,
        }));

        const { error: tagError } = await supabase
          .from('task_tags')
          .insert(tagInserts);

        if (tagError) throw createAppError(tagError.message, 500, 'DB_ERROR');
      }
    }

    return data;
  }

  async softDelete(userId: string, taskId: string) {
    await this.getById(userId, taskId);

    const { error } = await supabase
      .from('tasks')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', taskId)
      .eq('user_id', userId);

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');

    return { message: 'Task deleted' };
  }

  async complete(userId: string, taskId: string) {
    return this.update(userId, taskId, { status: 'completed' });
  }

  async getOverdue(userId: string) {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('tasks')
      .select('*, categories (*)')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .neq('status', 'completed')
      .neq('status', 'cancelled')
      .lt('due_date', today)
      .order('due_date', { ascending: true });

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');

    return data ?? [];
  }

  async getUpcoming(userId: string, days: number = 7) {
    const today = new Date().toISOString().split('T')[0];
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('tasks')
      .select('*, categories (*)')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .neq('status', 'completed')
      .neq('status', 'cancelled')
      .gte('due_date', today)
      .lte('due_date', futureDateStr)
      .order('due_date', { ascending: true });

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');

    return data ?? [];
  }
}

export const taskService = new TaskService();

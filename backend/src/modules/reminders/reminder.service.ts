import { supabase } from '../../database/supabase';
import { createAppError } from '../../middleware/error.middleware';
import type { CreateReminderInput, UpdateReminderInput } from './reminder.schema';

export class ReminderService {
  async listByTask(userId: string, taskId: string) {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('task_id', taskId)
      .eq('user_id', userId)
      .order('remind_at', { ascending: true });

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');

    return data ?? [];
  }

  async listUpcoming(userId: string, days: number = 7) {
    const now = new Date().toISOString();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const { data, error } = await supabase
      .from('reminders')
      .select(`
        *,
        tasks (id, title, status, priority, due_date, due_time)
      `)
      .eq('user_id', userId)
      .eq('is_sent', false)
      .gte('remind_at', now)
      .lte('remind_at', futureDate.toISOString())
      .order('remind_at', { ascending: true });

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');

    return data ?? [];
  }

  async create(userId: string, input: CreateReminderInput) {
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id, user_id')
      .eq('id', input.task_id)
      .eq('user_id', userId)
      .single();

    if (taskError || !task) {
      throw createAppError('Task not found', 404, 'TASK_NOT_FOUND');
    }

    const { data, error } = await supabase
      .from('reminders')
      .insert({
        task_id: input.task_id,
        user_id: userId,
        remind_at: input.remind_at,
        type: input.type,
      })
      .select()
      .single();

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');

    return data;
  }

  async update(userId: string, reminderId: string, input: UpdateReminderInput) {
    const { data: existing, error: existingError } = await supabase
      .from('reminders')
      .select('id')
      .eq('id', reminderId)
      .eq('user_id', userId)
      .single();

    if (existingError || !existing) {
      throw createAppError('Reminder not found', 404, 'REMINDER_NOT_FOUND');
    }

    const { data, error } = await supabase
      .from('reminders')
      .update(input)
      .eq('id', reminderId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');

    return data;
  }

  async delete(userId: string, reminderId: string) {
    const { error } = await supabase
      .from('reminders')
      .delete()
      .eq('id', reminderId)
      .eq('user_id', userId);

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');

    return { message: 'Reminder deleted' };
  }

  async markAsSent(reminderId: string) {
    const { error } = await supabase
      .from('reminders')
      .update({ is_sent: true })
      .eq('id', reminderId);

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');
  }
}

export const reminderService = new ReminderService();

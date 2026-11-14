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

  /** Temp failures: bump attempts and keep last_error. */
  async incrementAttempts(reminderId: string, error: string) {
    const { data, error: getError } = await supabase
      .from('reminders')
      .select('attempts')
      .eq('id', reminderId)
      .single();
    if (getError) throw createAppError(getError.message, 500, 'DB_ERROR');
    const next = (data?.attempts ?? 0) + 1;
    const { error: updateError } = await supabase
      .from('reminders')
      .update({ attempts: next, last_error: error })
      .eq('id', reminderId);
    console.log('[worker] reminder.service incrementAttempts: reminderId:', reminderId, 'next:', next, 'updateError:', updateError?.message);
    if (updateError) throw createAppError(updateError.message, 500, 'DB_ERROR');
  }

  /** Record last_error without touching the attempts counter (used for
   * acceptance-before-receipt: the worker re-reserves for the receipt poll). */
  async updateLastError(reminderId: string, error: string) {
    const { error: updateError } = await supabase
      .from('reminders')
      .update({ last_error: error })
      .eq('id', reminderId);
    if (updateError) throw createAppError(updateError.message, 500, 'DB_ERROR');
  }

  /**
   * Delivered or dead-lettered (maximum retries reached).
   * `is_sent=true` => the worker never re-forwards this reminder anymore
   * (persistent processing marker for historical/previous reminders).
   */
  async markDone(reminderId: string) {
    const { error } = await supabase
      .from('reminders')
      .update({ is_sent: true, claimed_at: null, attempts: 0, last_error: null })
      .eq('id', reminderId);

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');
  }
}

export const reminderService = new ReminderService();

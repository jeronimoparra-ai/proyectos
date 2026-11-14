import { createReminderCheckerClient, runWithSystemUser } from '../../database/supabase';
import { notificationService } from '../notifications/notification.service';

interface DueReminder {
  id: string;
  user_id: string;
  remind_at: string;
  type: string;
  tasks: { id: string; user_id: string; title: string; priority: string } | null;
}

const CHECK_INTERVAL_MS = 60_000;

export function startReminderChecker() {
  const supabase = createReminderCheckerClient();
  setInterval(async () => {
    try {
      const now = new Date().toISOString();

      const { data: dueReminders, error } = await supabase
        .from('reminders')
        .select(`
          id,
          user_id,
          remind_at,
          type,
          tasks (id, user_id, title, priority)
        `)
        .eq('is_sent', false)
        .lte('remind_at', now)
        .limit(50)
        .returns<DueReminder[]>();

      if (error || !dueReminders || dueReminders.length === 0) return;

      for (const reminder of dueReminders) {
        try {
          const task = reminder.tasks;
          if (!task || task.user_id !== reminder.user_id) {
            throw new Error('Reminder task ownership mismatch');
          }
          const taskTitle = task.title;

          await runWithSystemUser(reminder.user_id, () => notificationService.sendReminderNotification(
            reminder.user_id,
            taskTitle,
            reminder.remind_at,
            { taskId: task.id, reminderId: reminder.id, priority: task.priority }
          ));

          const { error: updateError } = await supabase
            .from('reminders')
            .update({ is_sent: true })
            .eq('id', reminder.id)
            .eq('user_id', reminder.user_id)
            .eq('task_id', task.id);
          if (updateError) throw updateError;
        } catch (err) {
          console.error(`Failed to process reminder ${reminder.id}:`, err);
        }
      }
    } catch (err) {
      console.error('Reminder checker error:', err);
    }
  }, CHECK_INTERVAL_MS);
}

import { supabase } from '../../database/supabase';
import { notificationService } from '../notifications/notification.service';

const CHECK_INTERVAL_MS = 60_000;

export function startReminderChecker() {
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
          tasks (id, title, priority)
        `)
        .eq('is_sent', false)
        .lte('remind_at', now)
        .limit(50);

      if (error || !dueReminders || dueReminders.length === 0) return;

      for (const reminder of dueReminders) {
        try {
          const task = reminder.tasks as unknown as { id: string; title: string; priority: string } | null;
          const taskTitle = task?.title ?? 'Tarea sin título';

          await notificationService.sendReminderNotification(
            reminder.user_id,
            taskTitle,
            reminder.remind_at,
            { taskId: task?.id, reminderId: reminder.id, priority: task?.priority }
          );

          await supabase
            .from('reminders')
            .update({ is_sent: true })
            .eq('id', reminder.id);
        } catch (err) {
          console.error(`Failed to process reminder ${reminder.id}:`, err);
        }
      }
    } catch (err) {
      console.error('Reminder checker error:', err);
    }
  }, CHECK_INTERVAL_MS);
}

import { useEffect, useCallback, useRef } from 'react';
import { useTaskStore } from '../store/useTaskStore';
import { useReviewStore } from '../store/useReviewStore';
import { useAutomationStore } from '../store/useAutomationStore';
import { useAuthStore } from '../store/useAuthStore';
import {
  scheduleTaskReminders,
  scheduleReviewReminders,
  scheduleSnooze,
  cancelTaskNotifications,
  cancelAllNotifications,
  rescheduleAllNotifications,
  initializeLocalNotifications,
  addNotificationListeners,
} from '../services/local-notifications';
import type { Task } from '../types';

export function useSmartReminders() {
  const user = useAuthStore((s) => s.user);
  const remindersEnabled = useAutomationStore((s) => s.remindersEnabled);
  const tasks = useTaskStore((s) => s.tasks);
  const dueReviews = useReviewStore((s) => s.dueReviews);
  const isInitialized = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Initialize notifications when user logs in and reminders are enabled
  useEffect(() => {
    if (!user || !remindersEnabled || isInitialized.current) return;

    const init = async () => {
      await initializeLocalNotifications();
      isInitialized.current = true;
    };

    init();
  }, [user, remindersEnabled]);

  // Set up notification listeners
  useEffect(() => {
    if (!user) return;

    cleanupRef.current = addNotificationListeners(
      (notification) => {
        console.log('[SmartReminders] Notification received:', notification.request.content.data);
      },
      (response) => {
        const data = response.notification.request.content.data;
        console.log('[SmartReminders] Notification tapped:', data);
      }
    );

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [user]);

  // Schedule reminders when tasks change
  useEffect(() => {
    if (!user || !remindersEnabled || !isInitialized.current) return;

    const schedule = async () => {
      for (const task of tasks) {
        if (task.status !== 'completed') {
          await scheduleTaskReminders(task);
        }
      }
      await scheduleReviewReminders();
    };

    schedule();
  }, [tasks, dueReviews, user, remindersEnabled, isInitialized.current]);

  // Cancel notifications when task is completed or deleted
  const handleTaskComplete = useCallback(async (taskId: string) => {
    await cancelTaskNotifications(taskId);
  }, []);

  const handleTaskDelete = useCallback(async (taskId: string) => {
    await cancelTaskNotifications(taskId);
  }, []);

  // Snooze a notification
  const snooze = useCallback(async (taskId: string, type: 'due_soon' | 'overdue' | 'review', minutes?: number) => {
    const snoozeMinutes = minutes ?? useAutomationStore.getState().snoozeMinutes;
    await scheduleSnooze(taskId, type, snoozeMinutes);
  }, []);

  // Reschedule all (e.g., when silent hours change)
  const reschedule = useCallback(async () => {
    if (!user || !remindersEnabled) return;
    await rescheduleAllNotifications();
  }, [user, remindersEnabled]);

  // Clean up on logout
  useEffect(() => {
    if (!user && isInitialized.current) {
      cancelAllNotifications();
      isInitialized.current = false;
    }
  }, [user]);

  return {
    snooze,
    reschedule,
    handleTaskComplete,
    handleTaskDelete,
  };
}

// Hook to integrate with task store mutations
export function useTaskReminderIntegration() {
  const user = useAuthStore((s) => s.user);
  const remindersEnabled = useAutomationStore((s) => s.remindersEnabled);
  const completeTask = useTaskStore((s) => s.completeTask);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const updateTask = useTaskStore((s) => s.updateTask);
  const createTask = useTaskStore((s) => s.createTask);

  const { handleTaskComplete, handleTaskDelete, reschedule } = useSmartReminders();

  // Wrap completeTask to cancel notifications
  const completeTaskWithReminders = useCallback(async (id: string) => {
    await handleTaskComplete(id);
    return completeTask(id);
  }, [handleTaskComplete, completeTask]);

  // Wrap deleteTask to cancel notifications
  const deleteTaskWithReminders = useCallback(async (id: string) => {
    await handleTaskDelete(id);
    return deleteTask(id);
  }, [handleTaskDelete, deleteTask]);

  // Wrap updateTask to reschedule if due date changes
  const updateTaskWithReminders = useCallback(async (id: string, data: Partial<Task>) => {
    const result = await updateTask(id, data);
    if (data.due_date || data.due_time || data.status) {
      await reschedule();
    }
    return result;
  }, [updateTask, reschedule]);

  // Wrap createTask to schedule reminders
  const createTaskWithReminders = useCallback(async (data: Partial<Task> & { title: string }) => {
    const result = await createTask(data);
    if (user && remindersEnabled && result.due_date && result.due_time && result.status !== 'completed') {
      await scheduleTaskReminders(result);
    }
    return result;
  }, [createTask, user, remindersEnabled]);

  return {
    completeTask: completeTaskWithReminders,
    deleteTask: deleteTaskWithReminders,
    updateTask: updateTaskWithReminders,
    createTask: createTaskWithReminders,
  };
}
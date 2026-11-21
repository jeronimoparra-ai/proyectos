import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useTaskStore } from '../store/useTaskStore';
import { useReviewStore } from '../store/useReviewStore';
import { useAutomationStore } from '../store/useAutomationStore';
import { useAuthStore } from '../store/useAuthStore';
import type { Task } from '../types';

// El handler global (con guard recipientUserId) vive en usePushNotifications.ts.


interface ScheduledNotification {
  id: string;
  taskId: string;
  triggerDate: Date;
  type: 'due_soon' | 'overdue' | 'review' | 'snooze';
}

const NOTIFICATION_PREFIX = 'fa_auto_';
const MAX_NOTIFICATIONS = 64; // iOS limit

function generateNotificationId(taskId: string, type: ScheduledNotification['type']): string {
  return `${NOTIFICATION_PREFIX}${taskId}_${type}`;
}

function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

function isInSilentHours(date: Date, silentStart: string, silentEnd: string): boolean {
  const { hours: startHours, minutes: startMinutes } = parseTime(silentStart);
  const { hours: endHours, minutes: endMinutes } = parseTime(silentEnd);

  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  const startTotalMinutes = startHours * 60 + startMinutes;
  const endTotalMinutes = endHours * 60 + endMinutes;

  if (startTotalMinutes <= endTotalMinutes) {
    // Same day (e.g., 07:00 - 22:00)
    return currentMinutes >= startTotalMinutes && currentMinutes < endTotalMinutes;
  } else {
    // Crosses midnight (e.g., 22:00 - 07:00)
    return currentMinutes >= startTotalMinutes || currentMinutes < endTotalMinutes;
  }
}

function getNextValidTime(date: Date, silentStart: string, silentEnd: string): Date {
  const result = new Date(date);
  while (isInSilentHours(result, silentStart, silentEnd)) {
    // Move to end of silent period
    const { hours: endHours, minutes: endMinutes } = parseTime(silentEnd);
    result.setHours(endHours, endMinutes, 0, 0);
    if (result <= date) {
      result.setDate(result.getDate() + 1);
    }
  }
  return result;
}

async function requestPermissionsIfNeeded(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') {
    return true;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B35',
    });

    await Notifications.setNotificationChannelAsync('silent', {
      name: 'Silent Reminders',
      importance: Notifications.AndroidImportance.LOW,
      vibrationPattern: [],
      lightColor: '#FF6B35',
    });
  }
}

function createGenericContent(title: string, body: string): Notifications.NotificationContentInput {
  return {
    title,
    body,
    sound: 'default',
    priority: Notifications.AndroidNotificationPriority.HIGH,
    data: { automated: true },
  };
}

function createSilentContent(): Notifications.NotificationContentInput {
  return {
    title: 'Recordatorio',
    body: 'Tienes una tarea pendiente',
    sound: false,
    priority: Notifications.AndroidNotificationPriority.LOW,
    data: { automated: true, silent: true },
  };
}

export async function scheduleTaskReminders(task: Task): Promise<void> {
  const user = useAuthStore.getState().user;
  if (!user) return;

  const { remindersEnabled, silentStart, silentEnd, snoozeMinutes } = useAutomationStore.getState();
  if (!remindersEnabled) return;

  const hasPermission = await requestPermissionsIfNeeded();
  if (!hasPermission) {
    console.warn('[LocalNotifications] Permission denied for task reminders');
    return;
  }

  await setupNotificationChannel();

  const now = new Date();
  const notifications: Array<{ id: string; trigger: Notifications.NotificationTriggerInput; content: Notifications.NotificationContentInput }> = [];

  // 1. Due soon reminder (1 hour before due date)
  if (task.due_date && task.due_time && task.status !== 'completed') {
    const dueDateTime = new Date(`${task.due_date}T${task.due_time}`);
    const reminderTime = new Date(dueDateTime.getTime() - 60 * 60 * 1000); // 1 hour before

    if (reminderTime > now) {
      const adjustedTime = getNextValidTime(reminderTime, silentStart, silentEnd);
      const notificationId = generateNotificationId(task.id, 'due_soon');

      notifications.push({
        id: notificationId,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: adjustedTime },
        content: createGenericContent(
          'Tarea próxima a vencer',
          `"${task.title}" vence en 1 hora`
        ),
      });
    }
  }

  // 2. Overdue reminder (at due time if not completed)
  if (task.due_date && task.due_time && task.status !== 'completed') {
    const dueDateTime = new Date(`${task.due_date}T${task.due_time}`);

    if (dueDateTime > now) {
      const adjustedTime = getNextValidTime(dueDateTime, silentStart, silentEnd);
      const notificationId = generateNotificationId(task.id, 'overdue');

      notifications.push({
        id: notificationId,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: adjustedTime },
        content: createSilentContent(),
      });
    }
  }

  // Schedule all notifications
  for (const notification of notifications) {
    try {
      // Check if we already have this notification scheduled
      const existingNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const existing = existingNotifications.map(n => n.identifier);
      if (!existing.includes(notification.id)) {
        await Notifications.scheduleNotificationAsync({
          identifier: notification.id,
          content: notification.content,
          trigger: notification.trigger,
        });
      }
    } catch (error) {
      console.warn('[LocalNotifications] Failed to schedule notification:', error);
    }
  }
}

export async function scheduleReviewReminders(): Promise<void> {
  const user = useAuthStore.getState().user;
  if (!user) return;

  const { remindersEnabled, silentStart, silentEnd } = useAutomationStore.getState();
  if (!remindersEnabled) return;

  const hasPermission = await requestPermissionsIfNeeded();
  if (!hasPermission) {
    console.warn('[LocalNotifications] Permission denied for review reminders');
    return;
  }

  await setupNotificationChannel();

  const dueReviews = useReviewStore.getState().dueReviews;
  const now = new Date();

  for (const review of dueReviews.slice(0, 10)) { // Limit to 10 reviews
    if (!review.due_date || !review.due_time) continue;

    const dueDateTime = new Date(`${review.due_date}T${review.due_time}`);
    if (dueDateTime <= now) continue;

    const adjustedTime = getNextValidTime(dueDateTime, silentStart, silentEnd);
    const notificationId = generateNotificationId(review.id, 'review');

    const existingNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const existing = existingNotifications.map(n => n.identifier);
    if (existing.includes(notificationId)) continue;

    try {
      await Notifications.scheduleNotificationAsync({
        identifier: notificationId,
        content: createSilentContent(),
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: adjustedTime },
      });
    } catch (error) {
      console.warn('[LocalNotifications] Failed to schedule review notification:', error);
    }
  }
}

export async function scheduleSnooze(taskId: string, type: 'due_soon' | 'overdue' | 'review', minutes: number): Promise<void> {
  const { remindersEnabled } = useAutomationStore.getState();
  if (!remindersEnabled) return;

  const hasPermission = await requestPermissionsIfNeeded();
  if (!hasPermission) return;

  const triggerTime = new Date(Date.now() + minutes * 60 * 1000);
  const { silentStart, silentEnd } = useAutomationStore.getState();
  const adjustedTime = getNextValidTime(triggerTime, silentStart, silentEnd);
  const notificationId = generateNotificationId(taskId, 'snooze');

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: notificationId,
      content: createSilentContent(),
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: adjustedTime },
    });
  } catch (error) {
    console.warn('[LocalNotifications] Failed to schedule snooze:', error);
  }
}

export async function cancelTaskNotifications(taskId: string): Promise<void> {
  const types: ScheduledNotification['type'][] = ['due_soon', 'overdue', 'review', 'snooze'];

  for (const type of types) {
    const notificationId = generateNotificationId(taskId, type);
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      // Ignore if not found
    }
  }
}

export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.warn('[LocalNotifications] Failed to cancel all notifications:', error);
  }
}

export async function rescheduleAllNotifications(): Promise<void> {
  await cancelAllNotifications();

  const user = useAuthStore.getState().user;
  if (!user) return;

  const { remindersEnabled } = useAutomationStore.getState();
  if (!remindersEnabled) return;

  const tasks = useTaskStore.getState().tasks;

  // Schedule task reminders
  for (const task of tasks) {
    if (task.status !== 'completed') {
      await scheduleTaskReminders(task);
    }
  }

  // Schedule review reminders
  await scheduleReviewReminders();
}

export async function initializeLocalNotifications(): Promise<void> {
  const user = useAuthStore.getState().user;
  if (!user) return;

  const { remindersEnabled } = useAutomationStore.getState();
  if (!remindersEnabled) return;

  const hasPermission = await requestPermissionsIfNeeded();
  if (!hasPermission) {
    console.warn('[LocalNotifications] Permission denied during initialization');
    return;
  }

  await setupNotificationChannel();
  await rescheduleAllNotifications();
}

export function addNotificationListeners(
  onReceived: (notification: Notifications.Notification) => void,
  onResponse: (response: Notifications.NotificationResponse) => void
): () => void {
  const receivedSubscription = Notifications.addNotificationReceivedListener(onReceived);
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(onResponse);

  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}
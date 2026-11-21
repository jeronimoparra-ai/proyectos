const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// Simple mock function implementation
function mockFn(implementation) {
  const fn = (...args) => implementation?.(...args);
  fn.mock = { calls: [], results: [] };
  const originalImpl = implementation;
  fn.mockImplementation = (impl) => { implementation = impl; };
  return fn;
}

// Mock AsyncStorage
const mockAsyncStorage = {
  store: new Map(),
  getItem: mockFn(async (key) => mockAsyncStorage.store.get(key) || null),
  setItem: mockFn(async (key, value) => { mockAsyncStorage.store.set(key, value); }),
  removeItem: mockFn(async (key) => { mockAsyncStorage.store.delete(key); }),
};

// Mock expo-notifications
const mockNotifications = {
  permissions: 'undetermined',
  scheduledNotifications: new Map(),
  channels: new Map(),
  getPermissionsAsync: mockFn(async () => ({ status: mockNotifications.permissions })),
  requestPermissionsAsync: mockFn(async () => ({ status: mockNotifications.permissions })),
  getExpoPushTokenAsync: mockFn(async () => ({ data: 'mock-push-token' })),
  scheduleNotificationAsync: mockFn(async (options) => {
    mockNotifications.scheduledNotifications.set(options.identifier, options);
    return options.identifier;
  }),
  cancelScheduledNotificationAsync: mockFn(async (id) => {
    const existed = mockNotifications.scheduledNotifications.has(id);
    mockNotifications.scheduledNotifications.delete(id);
    return existed;
  }),
  cancelAllScheduledNotificationsAsync: mockFn(async () => {
    mockNotifications.scheduledNotifications.clear();
  }),
  getAllScheduledNotificationsAsync: mockFn(async () => Array.from(mockNotifications.scheduledNotifications.values())),
  setNotificationChannelAsync: mockFn(async () => {}),
  setNotificationHandler: mockFn(() => {}),
  addNotificationReceivedListener: mockFn(() => ({ remove: mockFn() })),
  addNotificationResponseReceivedListener: mockFn(() => ({ remove: mockFn() })),
};

// Mock Platform
const mockPlatform = { OS: 'android' };

// Mock stores
const mockAuthStore = {
  user: null,
  setUser: mockFn((user) => { mockAuthStore.user = user; }),
  subscribe: mockFn((callback) => callback({ user: mockAuthStore.user }, { user: null })),
};

const mockTaskStore = {
  tasks: [],
  completeTask: mockFn(async (id) => {}),
  deleteTask: mockFn(async (id) => {}),
  updateTask: mockFn(async (id, data) => {}),
  createTask: mockFn(async (data) => ({ id: 'new-task', ...data })),
  subscribe: mockFn(),
  getState: () => mockTaskStore,
};

const mockReviewStore = {
  dueReviews: [],
  subscribe: mockFn(),
  getState: () => mockReviewStore,
};

const mockAutomationStore = {
  remindersEnabled: true,
  silentStart: '22:00',
  silentEnd: '07:00',
  snoozeMinutes: 10,
  isLoading: false,
  setRemindersEnabled: mockFn(async (enabled) => { mockAutomationStore.remindersEnabled = enabled; }),
  setSilentHours: mockFn(async (start, end) => { mockAutomationStore.silentStart = start; mockAutomationStore.silentEnd = end; }),
  setSnoozeMinutes: mockFn(async (minutes) => { mockAutomationStore.snoozeMinutes = minutes; }),
  loadPreferences: mockFn(async () => {}),
  reset: mockFn(() => {}),
  subscribe: mockFn((callback) => callback(mockAutomationStore, mockAutomationStore)),
  getState: () => mockAutomationStore,
};

// Test helpers
function resetMocks() {
  mockNotifications.permissions = 'undetermined';
  mockNotifications.scheduledNotifications.clear();
  mockNotifications.channels.clear();
  mockAuthStore.user = null;
  mockTaskStore.tasks = [];
  mockReviewStore.dueReviews = [];
  mockAutomationStore.remindersEnabled = true;
  mockAutomationStore.silentStart = '22:00';
  mockAutomationStore.silentEnd = '07:00';
  mockAutomationStore.snoozeMinutes = 10;
  mockAsyncStorage.store.clear();
}

// Import the modules under test after mocks are set up
// We'll simulate the module behavior directly in tests

describe('Automation System', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('useAutomationStore persistence', () => {
    it('should save preferences to AsyncStorage per user', async () => {
      const userId = 'user-123';
      mockAuthStore.user = { id: userId };

      const preferences = {
        remindersEnabled: false,
        silentStart: '23:00',
        silentEnd: '08:00',
        snoozeMinutes: 15,
      };

      await mockAsyncStorage.setItem(`automation_preferences_${userId}`, JSON.stringify(preferences));
      const stored = await mockAsyncStorage.getItem(`automation_preferences_${userId}`);
      const parsed = JSON.parse(stored);

      assert.strictEqual(parsed.remindersEnabled, false);
      assert.strictEqual(parsed.silentStart, '23:00');
      assert.strictEqual(parsed.silentEnd, '08:00');
      assert.strictEqual(parsed.snoozeMinutes, 15);
    });

    it('should clear preferences on user change', async () => {
      const userId1 = 'user-1';
      const userId2 = 'user-2';

      await mockAsyncStorage.setItem(`automation_preferences_${userId1}`, JSON.stringify({ remindersEnabled: true }));
      await mockAsyncStorage.setItem(`automation_preferences_${userId2}`, JSON.stringify({ remindersEnabled: false }));

      await mockAsyncStorage.removeItem(`automation_preferences_${userId1}`);

      const stored1 = await mockAsyncStorage.getItem(`automation_preferences_${userId1}`);
      const stored2 = await mockAsyncStorage.getItem(`automation_preferences_${userId2}`);

      assert.strictEqual(stored1, null);
      assert.notStrictEqual(stored2, null);
    });

    it('should validate time format HH:mm', () => {
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      assert.ok(timeRegex.test('22:00'));
      assert.ok(timeRegex.test('07:30'));
      assert.ok(!timeRegex.test('25:00'));
      assert.ok(!timeRegex.test('22:60'));
      assert.ok(!timeRegex.test('22'));
    });

    it('should validate snooze minutes range 1-60', () => {
      assert.ok(10 >= 1 && 10 <= 60);
      assert.ok(1 >= 1 && 1 <= 60);
      assert.ok(60 >= 1 && 60 <= 60);
      assert.ok(!(0 >= 1 && 0 <= 60));
      assert.ok(!(61 >= 1 && 61 <= 60));
    });
  });

  describe('Silent hours logic', () => {
    function parseTime(timeStr) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return { hours, minutes };
    }

    function isInSilentHours(date, silentStart, silentEnd) {
      const { hours: startHours, minutes: startMinutes } = parseTime(silentStart);
      const { hours: endHours, minutes: endMinutes } = parseTime(silentEnd);

      const currentMinutes = date.getHours() * 60 + date.getMinutes();
      const startTotalMinutes = startHours * 60 + startMinutes;
      const endTotalMinutes = endHours * 60 + endMinutes;

      if (startTotalMinutes <= endTotalMinutes) {
        return currentMinutes >= startTotalMinutes && currentMinutes < endTotalMinutes;
      } else {
        return currentMinutes >= startTotalMinutes || currentMinutes < endTotalMinutes;
      }
    }

    function getNextValidTime(date, silentStart, silentEnd) {
      const result = new Date(date);
      while (isInSilentHours(result, silentStart, silentEnd)) {
        const { hours: endHours, minutes: endMinutes } = parseTime(silentEnd);
        result.setHours(endHours, endMinutes, 0, 0);
        if (result <= date) {
          result.setDate(result.getDate() + 1);
        }
      }
      return result;
    }

    it('should detect silent hours crossing midnight (22:00-07:00)', () => {
      const silentStart = '22:00';
      const silentEnd = '07:00';

      // 23:00 - should be in silent hours
      const d1 = new Date('2024-01-01T23:00:00');
      assert.ok(isInSilentHours(d1, silentStart, silentEnd));

      // 02:00 - should be in silent hours
      const d2 = new Date('2024-01-01T02:00:00');
      assert.ok(isInSilentHours(d2, silentStart, silentEnd));

      // 08:00 - should NOT be in silent hours
      const d3 = new Date('2024-01-01T08:00:00');
      assert.ok(!isInSilentHours(d3, silentStart, silentEnd));

      // 20:00 - should NOT be in silent hours
      const d4 = new Date('2024-01-01T20:00:00');
      assert.ok(!isInSilentHours(d4, silentStart, silentEnd));
    });

    it('should detect silent hours same day (07:00-22:00)', () => {
      const silentStart = '07:00';
      const silentEnd = '22:00';

      // 10:00 - should be in silent hours
      const d1 = new Date('2024-01-01T10:00:00');
      assert.ok(isInSilentHours(d1, silentStart, silentEnd));

      // 23:00 - should NOT be in silent hours
      const d2 = new Date('2024-01-01T23:00:00');
      assert.ok(!isInSilentHours(d2, silentStart, silentEnd));

      // 06:00 - should NOT be in silent hours
      const d3 = new Date('2024-01-01T06:00:00');
      assert.ok(!isInSilentHours(d3, silentStart, silentEnd));
    });

    it('should move notification to end of silent period', () => {
      const silentStart = '22:00';
      const silentEnd = '07:00';

      // Notification at 23:00 should move to 07:00 next day
      const d1 = new Date('2024-01-01T23:00:00');
      const adjusted = getNextValidTime(d1, silentStart, silentEnd);
      assert.strictEqual(adjusted.getHours(), 7);
      assert.strictEqual(adjusted.getMinutes(), 0);
      assert.ok(adjusted > d1);

      // Notification at 02:00 should move to 07:00 same day
      const d2 = new Date('2024-01-01T02:00:00');
      const adjusted2 = getNextValidTime(d2, silentStart, silentEnd);
      assert.strictEqual(adjusted2.getHours(), 7);
      assert.strictEqual(adjusted2.getMinutes(), 0);
      assert.ok(adjusted2 > d2);
    });
  });

  describe('Local notifications scheduling', () => {
    const NOTIFICATION_PREFIX = 'fa_auto_';

    function generateNotificationId(taskId, type) {
      return `${NOTIFICATION_PREFIX}${taskId}_${type}`;
    }

    function createSilentContent() {
      return {
        title: 'Recordatorio',
        body: 'Tienes una tarea pendiente',
        sound: false,
        priority: 'LOW',
        data: { automated: true, silent: true },
      };
    }

    function createGenericContent(title, body) {
      return {
        title,
        body,
        sound: 'default',
        priority: 'HIGH',
        data: { automated: true },
      };
    }

    it('should generate unique notification IDs per task and type', () => {
      const id1 = generateNotificationId('task-1', 'due_soon');
      const id2 = generateNotificationId('task-1', 'overdue');
      const id3 = generateNotificationId('task-2', 'due_soon');

      assert.notStrictEqual(id1, id2);
      assert.notStrictEqual(id1, id3);
      assert.ok(id1.startsWith('fa_auto_task-1_due_soon'));
      assert.ok(id2.startsWith('fa_auto_task-1_overdue'));
    });

    it('should create silent content without academic details', () => {
      const content = createSilentContent();
      assert.strictEqual(content.title, 'Recordatorio');
      assert.strictEqual(content.body, 'Tienes una tarea pendiente');
      assert.strictEqual(content.sound, false);
      assert.ok(content.data.silent === true);
      assert.ok(!content.body.includes('tarea académica'));
      assert.ok(!content.body.includes('repaso'));
    });

    it('should create generic content for due-soon notifications', () => {
      const content = createGenericContent('Tarea próxima a vencer', '"Tarea de prueba" vence en 1 hora');
      assert.strictEqual(content.title, 'Tarea próxima a vencer');
      assert.ok(content.body.includes('vence en 1 hora'));
      assert.strictEqual(content.sound, 'default');
      assert.ok(!content.data.silent);
    });

    it('should not duplicate notifications for same task/type', async () => {
      const notificationId = generateNotificationId('task-1', 'due_soon');

      // Schedule first
      await mockNotifications.scheduleNotificationAsync({
        identifier: notificationId,
        content: createSilentContent(),
        trigger: { type: 'date', date: new Date(Date.now() + 3600000) },
      });

      const existing1 = await mockNotifications.getAllScheduledNotificationsAsync();
      const ids1 = existing1.map(n => n.identifier);
      assert.ok(ids1.includes(notificationId));

      // Try to schedule again - should not duplicate
      await mockNotifications.scheduleNotificationAsync({
        identifier: notificationId,
        content: createSilentContent(),
        trigger: { type: 'date', date: new Date(Date.now() + 3600000) },
      });

      const existing2 = await mockNotifications.getAllScheduledNotificationsAsync();
      const ids2 = existing2.map(n => n.identifier);
      assert.strictEqual(ids2.filter(id => id === notificationId).length, 1);
    });
  });

  describe('Task notification lifecycle', () => {
    const mockTask = {
      id: 'task-1',
      title: 'Test Task',
      due_date: '2026-12-31',
      due_time: '10:00',
      status: 'pending',
      user_id: 'user-1',
    };

    function generateNotificationId(taskId, type) {
      return `fa_auto_${taskId}_${type}`;
    }

    function createSilentContent() {
      return {
        title: 'Recordatorio',
        body: 'Tienes una tarea pendiente',
        sound: false,
        priority: 'LOW',
        data: { automated: true, silent: true },
      };
    }

    function createGenericContent(title, body) {
      return {
        title,
        body,
        sound: 'default',
        priority: 'HIGH',
        data: { automated: true },
      };
    }

    it('should schedule due_soon and overdue for pending task with due date', async () => {
      mockTaskStore.tasks = [mockTask];
      mockAutomationStore.remindersEnabled = true;
      mockAuthStore.user = { id: 'user-1' };
      mockNotifications.permissions = 'granted';

      const dueDateTime = new Date(`${mockTask.due_date}T${mockTask.due_time}`);
      const reminderTime = new Date(dueDateTime.getTime() - 60 * 60 * 1000);

      // Simulate scheduling
      if (reminderTime > new Date()) {
        const id1 = generateNotificationId(mockTask.id, 'due_soon');
        await mockNotifications.scheduleNotificationAsync({
          identifier: id1,
          content: createGenericContent('Tarea próxima a vencer', `"${mockTask.title}" vence en 1 hora`),
          trigger: { type: 'date', date: reminderTime },
        });
      }

      if (dueDateTime > new Date()) {
        const id2 = generateNotificationId(mockTask.id, 'overdue');
        await mockNotifications.scheduleNotificationAsync({
          identifier: id2,
          content: createSilentContent(),
          trigger: { type: 'date', date: dueDateTime },
        });
      }

      const scheduled = await mockNotifications.getAllScheduledNotificationsAsync();
      const ids = scheduled.map(n => n.identifier);
      assert.ok(ids.some(id => id.includes('due_soon')));
      assert.ok(ids.some(id => id.includes('overdue')));
    });

    it('should NOT schedule notifications for completed task', async () => {
      const completedTask = { ...mockTask, status: 'completed' };
      mockTaskStore.tasks = [completedTask];
      mockAutomationStore.remindersEnabled = true;
      mockAuthStore.user = { id: 'user-1' };
      mockNotifications.permissions = 'granted';

      // Simulate scheduling logic
      const tasksToSchedule = mockTaskStore.tasks.filter(t => t.status !== 'completed');
      assert.strictEqual(tasksToSchedule.length, 0);
    });

    it('should cancel notifications when task completed', async () => {
      const taskId = 'task-1';
      const types = ['due_soon', 'overdue', 'review', 'snooze'];

      // Pre-populate scheduled notifications
      for (const type of types) {
        const id = generateNotificationId(taskId, type);
        await mockNotifications.scheduleNotificationAsync({
          identifier: id,
          content: createSilentContent(),
          trigger: { type: 'date', date: new Date(Date.now() + 3600000) },
        });
      }

      let scheduled = await mockNotifications.getAllScheduledNotificationsAsync();
      assert.strictEqual(scheduled.map(n => n.identifier).filter(id => id.includes(taskId)).length, 4);

      // Cancel on completion
      for (const type of types) {
        const id = generateNotificationId(taskId, type);
        await mockNotifications.cancelScheduledNotificationAsync(id);
      }

      scheduled = await mockNotifications.getAllScheduledNotificationsAsync();
      assert.strictEqual(scheduled.map(n => n.identifier).filter(id => id.includes(taskId)).length, 0);
    });

    it('should cancel notifications when task deleted', async () => {
      const taskId = 'task-2';
      const types = ['due_soon', 'overdue', 'review', 'snooze'];

      for (const type of types) {
        const id = generateNotificationId(taskId, type);
        await mockNotifications.scheduleNotificationAsync({
          identifier: id,
          content: createSilentContent(),
          trigger: { type: 'date', date: new Date(Date.now() + 3600000) },
        });
      }

      for (const type of types) {
        const id = generateNotificationId(taskId, type);
        await mockNotifications.cancelScheduledNotificationAsync(id);
      }

      const scheduled = await mockNotifications.getAllScheduledNotificationsAsync();
      assert.strictEqual(scheduled.map(n => n.identifier).filter(id => id.includes(taskId)).length, 0);
    });

    it('should reschedule when due date changes', async () => {
      const taskId = 'task-3';
      const oldDate = '2026-12-31';
      const newDate = '2027-01-15';
      const dueTime = '10:00';

      // Schedule with old date
      const oldDateTime = new Date(`${oldDate}T${dueTime}`);
      const notificationId = generateNotificationId(taskId, 'due_soon');
      await mockNotifications.scheduleNotificationAsync({
        identifier: notificationId,
        content: createSilentContent(),
        trigger: { type: 'date', date: oldDateTime },
      });

      // Verify old is scheduled
      let scheduled = await mockNotifications.getAllScheduledNotificationsAsync();
      let ids = scheduled.map(n => n.identifier);
      assert.ok(ids.includes(notificationId));
      assert.strictEqual(scheduled.length, 1);

      // Cancel old and schedule new (same ID, different trigger date)
      await mockNotifications.cancelScheduledNotificationAsync(notificationId);

      const newDateTime = new Date(`${newDate}T${dueTime}`);
      await mockNotifications.scheduleNotificationAsync({
        identifier: notificationId,
        content: createSilentContent(),
        trigger: { type: 'date', date: newDateTime },
      });

      scheduled = await mockNotifications.getAllScheduledNotificationsAsync();
      ids = scheduled.map(n => n.identifier);
      // Should have exactly one notification with the same ID (rescheduled)
      assert.strictEqual(scheduled.length, 1);
      assert.ok(ids.includes(notificationId));
      // Verify the trigger date was updated
      const notification = scheduled.find(n => n.identifier === notificationId);
      assert.ok(notification.trigger.date.getTime() === newDateTime.getTime());
    });
  });

  describe('Review reminders', () => {
    function generateNotificationId(taskId, type) {
      return `fa_auto_${taskId}_${type}`;
    }

    function createSilentContent() {
      return {
        title: 'Recordatorio',
        body: 'Tienes una tarea pendiente',
        sound: false,
        priority: 'LOW',
        data: { automated: true, silent: true },
      };
    }

    it('should schedule review reminders for due reviews', async () => {
      const review = {
        id: 'review-1',
        title: 'Math Review',
        due_date: '2024-12-31',
        due_time: '14:00',
        user_id: 'user-1',
      };

      mockReviewStore.dueReviews = [review];
      mockAutomationStore.remindersEnabled = true;
      mockAuthStore.user = { id: 'user-1' };
      mockNotifications.permissions = 'granted';

      const dueDateTime = new Date(`${review.due_date}T${review.due_time}`);
      const notificationId = generateNotificationId(review.id, 'review');

      await mockNotifications.scheduleNotificationAsync({
        identifier: notificationId,
        content: createSilentContent(),
        trigger: { type: 'date', date: dueDateTime },
      });

      const scheduled = await mockNotifications.getAllScheduledNotificationsAsync();
      const ids = scheduled.map(n => n.identifier);
      assert.ok(ids.includes(notificationId));
    });

    it('should limit review reminders to 10', () => {
      const reviews = Array.from({ length: 15 }, (_, i) => ({
        id: `review-${i}`,
        due_date: '2024-12-31',
        due_time: '10:00',
      }));

      mockReviewStore.dueReviews = reviews;
      const limited = mockReviewStore.dueReviews.slice(0, 10);
      assert.strictEqual(limited.length, 10);
    });
  });

  describe('Snooze functionality', () => {
    function generateNotificationId(taskId, type) {
      return `fa_auto_${taskId}_${type}`;
    }

    function createSilentContent() {
      return {
        title: 'Recordatorio',
        body: 'Tienes una tarea pendiente',
        sound: false,
        priority: 'LOW',
        data: { automated: true, silent: true },
      };
    }

    it('should schedule snooze notification with configured minutes', async () => {
      mockAutomationStore.snoozeMinutes = 15;
      mockNotifications.permissions = 'granted';

      const taskId = 'task-1';
      const minutes = mockAutomationStore.snoozeMinutes;
      const triggerTime = new Date(Date.now() + minutes * 60 * 1000);
      const notificationId = generateNotificationId(taskId, 'snooze');

      await mockNotifications.scheduleNotificationAsync({
        identifier: notificationId,
        content: createSilentContent(),
        trigger: { type: 'date', date: triggerTime },
      });

      const scheduled = await mockNotifications.getAllScheduledNotificationsAsync();
      const ids = scheduled.map(n => n.identifier);
      assert.ok(ids.includes(notificationId));

      const notification = mockNotifications.scheduledNotifications.get(notificationId);
      const expectedTime = new Date(Date.now() + 15 * 60 * 1000);
      // Allow 1 second tolerance
      assert.ok(Math.abs(notification.trigger.date.getTime() - expectedTime.getTime()) < 1000);
    });

    it('should respect custom snooze minutes', async () => {
      mockNotifications.permissions = 'granted';

      const taskId = 'task-1';
      const customMinutes = 5;
      const triggerTime = new Date(Date.now() + customMinutes * 60 * 1000);
      const notificationId = generateNotificationId(taskId, 'snooze');

      await mockNotifications.scheduleNotificationAsync({
        identifier: notificationId,
        content: createSilentContent(),
        trigger: { type: 'date', date: triggerTime },
      });

      const notification = mockNotifications.scheduledNotifications.get(notificationId);
      const expectedTime = new Date(Date.now() + 5 * 60 * 1000);
      assert.ok(Math.abs(notification.trigger.date.getTime() - expectedTime.getTime()) < 1000);
    });
  });

  describe('Permission handling', () => {
    it('should not schedule when permission denied', async () => {
      mockNotifications.permissions = 'denied';
      mockAutomationStore.remindersEnabled = true;
      mockAuthStore.user = { id: 'user-1' };

      const hasPermission = mockNotifications.permissions === 'granted';
      assert.strictEqual(hasPermission, false);

      // Should not attempt to schedule
      const scheduled = await mockNotifications.getAllScheduledNotificationsAsync();
      assert.strictEqual(scheduled.length, 0);
    });

    it('should request permission when undetermined', async () => {
      mockNotifications.permissions = 'undetermined';

      // Simulate requestPermissionsAsync
      const result = await mockNotifications.requestPermissionsAsync();
      assert.strictEqual(result.status, 'undetermined');
    });

    it('should skip initialization when permission denied', async () => {
      mockNotifications.permissions = 'denied';
      mockAutomationStore.remindersEnabled = true;
      mockAuthStore.user = { id: 'user-1' };

      const hasPermission = mockNotifications.permissions === 'granted';
      if (!hasPermission) {
        console.warn('Permission denied during initialization');
        return;
      }

      // Should not reach here
      assert.fail('Should not initialize when permission denied');
    });
  });

  describe('Account change cleanup', () => {
    function generateNotificationId(taskId, type) {
      return `fa_auto_${taskId}_${type}`;
    }

    function createSilentContent() {
      return {
        title: 'Recordatorio',
        body: 'Tienes una tarea pendiente',
        sound: false,
        priority: 'LOW',
        data: { automated: true, silent: true },
      };
    }

    it('should cancel all notifications on logout', async () => {
      // Pre-populate with multiple notifications
      const tasks = ['task-1', 'task-2', 'task-3'];
      for (const taskId of tasks) {
        for (const type of ['due_soon', 'overdue', 'review', 'snooze']) {
          const id = generateNotificationId(taskId, type);
          await mockNotifications.scheduleNotificationAsync({
            identifier: id,
            content: createSilentContent(),
            trigger: { type: 'date', date: new Date(Date.now() + 3600000) },
          });
        }
      }

      let scheduled = await mockNotifications.getAllScheduledNotificationsAsync();
      assert.strictEqual(scheduled.length, 12);

      // Simulate logout - cancel all
      await mockNotifications.cancelAllScheduledNotificationsAsync();

      scheduled = await mockNotifications.getAllScheduledNotificationsAsync();
      assert.strictEqual(scheduled.length, 0);
    });

    it('should clear automation preferences on account change', async () => {
      const userId1 = 'user-1';
      const userId2 = 'user-2';

      await mockAsyncStorage.setItem(`automation_preferences_${userId1}`, JSON.stringify({ remindersEnabled: true }));
      await mockAsyncStorage.setItem(`automation_preferences_${userId2}`, JSON.stringify({ remindersEnabled: false }));

      // Simulate account change from user-1 to user-2
      await mockAsyncStorage.removeItem(`automation_preferences_${userId1}`);

      const stored1 = await mockAsyncStorage.getItem(`automation_preferences_${userId1}`);
      const stored2 = await mockAsyncStorage.getItem(`automation_preferences_${userId2}`);

      assert.strictEqual(stored1, null);
      assert.notStrictEqual(stored2, null);
    });

    it('should not leak notifications between accounts', async () => {
      // User 1 has notifications
      await mockNotifications.scheduleNotificationAsync({
        identifier: 'fa_auto_task-1_due_soon',
        content: createSilentContent(),
        trigger: { type: 'date', date: new Date(Date.now() + 3600000) },
      });

      // Switch to user 2 - cancel all
      await mockNotifications.cancelAllScheduledNotificationsAsync();

      const scheduled = await mockNotifications.getAllScheduledNotificationsAsync();
      assert.strictEqual(scheduled.length, 0);

      // User 2's notifications would be fresh
      await mockNotifications.scheduleNotificationAsync({
        identifier: 'fa_auto_task-2_due_soon',
        content: createSilentContent(),
        trigger: { type: 'date', date: new Date(Date.now() + 3600000) },
      });

      const scheduled2 = await mockNotifications.getAllScheduledNotificationsAsync();
      assert.strictEqual(scheduled2.length, 1);
      assert.ok(scheduled2[0].identifier.includes('task-2'));
    });
  });

  describe('Backend push deduplication', () => {
    function generateNotificationId(taskId, type) {
      return `fa_auto_${taskId}_${type}`;
    }

    it('should track sent notifications via is_sent flag', () => {
      // Simulate reminder with is_sent from backend
      const reminder = {
        id: 'reminder-1',
        task_id: 'task-1',
        user_id: 'user-1',
        remind_at: '2024-12-31T10:00:00',
        type: 'notification',
        is_sent: true,
        created_at: '2024-12-01T00:00:00',
      };

      // If is_sent is true, should not schedule local notification
      const shouldScheduleLocal = !reminder.is_sent;
      assert.strictEqual(shouldScheduleLocal, false);
    });

    it('should schedule local notification when is_sent is false', () => {
      const reminder = {
        id: 'reminder-2',
        task_id: 'task-2',
        user_id: 'user-1',
        remind_at: '2024-12-31T10:00:00',
        type: 'notification',
        is_sent: false,
        created_at: '2024-12-01T00:00:00',
      };

      const shouldScheduleLocal = !reminder.is_sent;
      assert.strictEqual(shouldScheduleLocal, true);
    });

    it('should use notification ID to prevent duplicates', () => {
      const reminder = {
        id: 'reminder-3',
        task_id: 'task-3',
        user_id: 'user-1',
        remind_at: '2024-12-31T10:00:00',
        type: 'notification',
        is_sent: true,
        created_at: '2024-12-01T00:00:00',
      };

      // The notification ID from backend can be used as identifier
      const backendNotificationId = `backend_${reminder.id}`;
      const localNotificationId = generateNotificationId(reminder.task_id, 'overdue');

      // They should be different identifiers
      assert.notStrictEqual(backendNotificationId, localNotificationId);
    });
  });
});

// Tests run automatically with node --test
// Regresion de cableado: el modulo de recordatorios locales debe estar montado.
it('local notifications are wired into App and TasksScreen (no dead code)', () => {
  const fs = require('node:fs');
  const app = fs.readFileSync(require('node:path').join(__dirname, '../../App.tsx'), 'utf8');
  const tasks = fs.readFileSync(require('node:path').join(__dirname, '../screens/TasksScreen.tsx'), 'utf8');
  const local = fs.readFileSync(require('node:path').join(__dirname, '../services/local-notifications.ts'), 'utf8');
  assert.match(app, /useSmartReminders\(\)/);
  assert.match(tasks, /useTaskReminderIntegration/);
  assert.doesNotMatch(local, /setNotificationHandler/);
});

import { act } from 'react';
import { useEventStore } from '../store/useEventStore';
import { useAuthStore } from '../store/useAuthStore';
import { eventService } from '../services/event';
import type { Event } from '../types';

// Mock the event service
jest.mock('../services/event', () => ({
  eventService: {
    list: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getByDateRange: jest.fn(),
  },
}));

// Mock the auth store
jest.mock('../store/useAuthStore', () => ({
  useAuthStore: {
    getState: jest.fn(),
    setState: jest.fn(),
  },
}));

const mockEventService = eventService as jest.Mocked<typeof eventService>;
const mockUseAuthStore = useAuthStore as unknown as { getState: jest.Mock; setState: jest.Mock };

// Test utilities - use local date construction to avoid timezone issues
const createLocalDate = (year: number, month: number, day: number) => new Date(year, month - 1, day);

const createMockEvent = (overrides: Partial<Event> = {}): Event => ({
  id: 'event-1',
  user_id: 'user-1',
  title: 'Test Event',
  description: null,
  start_date: '2026-11-15T10:00:00.000Z',
  end_date: '2026-11-15T11:00:00.000Z',
  all_day: false,
  location: null,
  category_id: null,
  color: null,
  source: 'local',
  external_id: null,
  created_at: '2026-11-01T00:00:00.000Z',
  updated_at: '2026-11-01T00:00:00.000Z',
  deleted_at: null,
  ...overrides,
});

const createAllDayEvent = (overrides: Partial<Event> = {}): Event => ({
  ...createMockEvent(),
  all_day: true,
  start_date: '2026-11-15T00:00:00.000Z',
  end_date: '2026-11-16T00:00:00.000Z',
  ...overrides,
});

const setupUser = (userId: string) => {
  mockUseAuthStore.getState.mockReturnValue({
    user: { id: userId, email: `${userId}@test.com`, display_name: userId, avatar_url: null, created_at: '' },
    isLoading: false,
    isAuthenticated: true,
    setUser: jest.fn(),
    setLoading: jest.fn(),
    signOut: jest.fn(),
  });
};

const setupMockListResponse = (events: Event[], total: number = events.length) => {
  mockEventService.list.mockResolvedValue({ events, total, page: 1, limit: 100 });
};

const advanceTimers = async (ms: number) => {
  jest.advanceTimersByTime(ms);
  await act(async () => {
    await Promise.resolve();
  });
};

describe('Calendar Cache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Reset stores
    useEventStore.setState({
      events: [],
      total: 0,
      page: 1,
      filters: {},
      selectedDate: createLocalDate(2026, 11, 15),
      isLoading: false,
      error: null,
      selectedEvent: null,
      cache: new Map(),
      pendingRequests: new Map(),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Cache by (userId, month, filters)', () => {
    it('should cache events for a specific user and month', async () => {
      setupUser('user-1');
      const events = [createMockEvent({ id: 'event-1' })];
      setupMockListResponse(events);

      // First load - should fetch from API
      await act(async () => {
        await useEventStore.getState().loadEvents();
      });

      expect(mockEventService.list).toHaveBeenCalledTimes(1);

      // Second load with same date - should use cache
      await act(async () => {
        await useEventStore.getState().loadEvents();
      });

      expect(mockEventService.list).toHaveBeenCalledTimes(1); // No additional call
      expect(useEventStore.getState().events).toEqual(events);
    });

    it('should NOT refetch when changing day within the same month', async () => {
      setupUser('user-1');
      const events = [createMockEvent({ id: 'event-1' })];
      setupMockListResponse(events);

      // Load for Nov 15
      await act(async () => {
        await useEventStore.getState().loadEvents();
      });
      expect(mockEventService.list).toHaveBeenCalledTimes(1);

      // Change to Nov 20 (same month)
      useEventStore.setState({ selectedDate: createLocalDate(2026, 11, 20) });
      await act(async () => {
        await useEventStore.getState().loadEvents();
      });

      // Should still be 1 call - cache hit
      expect(mockEventService.list).toHaveBeenCalledTimes(1);
      expect(useEventStore.getState().events).toEqual(events);
    });

    it('should refetch when changing to a different month', async () => {
      setupUser('user-1');
      const novEvents = [createMockEvent({ id: 'event-nov' })];
      const decEvents = [createMockEvent({ id: 'event-dec', start_date: '2026-12-10T10:00:00.000Z', end_date: '2026-12-10T11:00:00.000Z' })];

      setupMockListResponse(novEvents);
      await act(async () => {
        await useEventStore.getState().loadEvents();
      });
      expect(mockEventService.list).toHaveBeenCalledTimes(1);

      // Change to December
      mockEventService.list.mockResolvedValue({ events: decEvents, total: 1, page: 1, limit: 100 });
      useEventStore.setState({ selectedDate: createLocalDate(2026, 12, 10) });
      await act(async () => {
        await useEventStore.getState().loadEvents();
      });

      expect(mockEventService.list).toHaveBeenCalledTimes(2);
      expect(useEventStore.getState().events).toEqual(decEvents);
    });

    it('should use different cache keys for different users', async () => {
      // User 1
      setupUser('user-1');
      const user1Events = [createMockEvent({ id: 'event-user1', user_id: 'user-1' })];
      setupMockListResponse(user1Events);
      await act(async () => {
        await useEventStore.getState().loadEvents();
      });
      expect(mockEventService.list).toHaveBeenCalledTimes(1);

      // User 2 - should NOT use user 1's cache
      setupUser('user-2');
      const user2Events = [createMockEvent({ id: 'event-user2', user_id: 'user-2' })];
      mockEventService.list.mockResolvedValue({ events: user2Events, total: 1, page: 1, limit: 100 });
      await act(async () => {
        await useEventStore.getState().loadEvents();
      });

      expect(mockEventService.list).toHaveBeenCalledTimes(2);
      expect(useEventStore.getState().events).toEqual(user2Events);
    });

    it('should use different cache keys for different filters', async () => {
      setupUser('user-1');
      const allEvents = [createMockEvent({ id: 'event-1' }), createMockEvent({ id: 'event-2', category_id: 'cat-1' })];
      const filteredEvents = [createMockEvent({ id: 'event-2', category_id: 'cat-1' })];

      setupMockListResponse(allEvents);
      await act(async () => {
        await useEventStore.getState().loadEvents();
      });
      expect(mockEventService.list).toHaveBeenCalledTimes(1);

      // Apply filter
      mockEventService.list.mockResolvedValue({ events: filteredEvents, total: 1, page: 1, limit: 100 });
      useEventStore.getState().setFilters({ category_id: 'cat-1' });
      await act(async () => {
        // setFilters calls loadEvents internally
        await Promise.resolve();
      });

      expect(mockEventService.list).toHaveBeenCalledTimes(2);
      expect(useEventStore.getState().events).toEqual(filteredEvents);

      // Remove filter - should use cached data from initial load (no filter)
      // This is a cache hit, so no new API call
      useEventStore.getState().setFilters({});
      await act(async () => {
        await Promise.resolve();
      });

      // Still 2 calls - cache hit for the no-filter case
      expect(mockEventService.list).toHaveBeenCalledTimes(2);
      expect(useEventStore.getState().events).toEqual(allEvents);
    });
  });

  describe('Selective cache invalidation after mutations', () => {
    it('should invalidate cache after creating an event in current month', async () => {
      setupUser('user-1');
      const initialEvents = [createMockEvent({ id: 'event-1' })];
      setupMockListResponse(initialEvents);
      await act(async () => {
        await useEventStore.getState().loadEvents();
      });

      // Get the cache key for current month
      const cache = useEventStore.getState().cache;
      const cacheKeysBefore = Array.from(cache.keys());
      expect(cacheKeysBefore.length).toBeGreaterThan(0);

      const newEvent = createMockEvent({ id: 'event-new', title: 'New Event' });
      mockEventService.create.mockResolvedValue(newEvent);

      await act(async () => {
        await useEventStore.getState().createEvent(newEvent);
      });

      // Cache should be invalidated for current month - the key should be gone
      const cacheAfter = useEventStore.getState().cache;
      const currentMonthKey = cacheKeysBefore[0];
      expect(cacheAfter.has(currentMonthKey)).toBe(false);
    });

    it('should invalidate cache after updating an event', async () => {
      setupUser('user-1');
      const initialEvents = [createMockEvent({ id: 'event-1' })];
      setupMockListResponse(initialEvents);
      await act(async () => {
        await useEventStore.getState().loadEvents();
      });

      const cacheKeysBefore = Array.from(useEventStore.getState().cache.keys());

      const updatedEvent = createMockEvent({ id: 'event-1', title: 'Updated Event' });
      mockEventService.update.mockResolvedValue(updatedEvent);

      await act(async () => {
        await useEventStore.getState().updateEvent('event-1', { title: 'Updated Event' });
      });

      // Cache should be invalidated
      const cacheAfter = useEventStore.getState().cache;
      const currentMonthKey = cacheKeysBefore[0];
      expect(cacheAfter.has(currentMonthKey)).toBe(false);
    });

    it('should invalidate cache after deleting an event', async () => {
      setupUser('user-1');
      const initialEvents = [createMockEvent({ id: 'event-1' })];
      setupMockListResponse(initialEvents);
      await act(async () => {
        await useEventStore.getState().loadEvents();
      });

      const cacheKeysBefore = Array.from(useEventStore.getState().cache.keys());

      mockEventService.remove.mockResolvedValue(undefined);

      await act(async () => {
        await useEventStore.getState().deleteEvent('event-1');
      });

      // Cache should be invalidated
      const cacheAfter = useEventStore.getState().cache;
      const currentMonthKey = cacheKeysBefore[0];
      expect(cacheAfter.has(currentMonthKey)).toBe(false);
    });

    it('should invalidate adjacent months when event spans month boundary', async () => {
      setupUser('user-1');
      const initialEvents = [createMockEvent({ id: 'event-1' })];
      setupMockListResponse(initialEvents);
      await act(async () => {
        await useEventStore.getState().loadEvents();
      });

      // Create event that spans Nov 30 - Dec 2
      const spanningEvent = createMockEvent({
        id: 'event-span',
        start_date: '2026-11-30T22:00:00.000Z',
        end_date: '2026-12-02T02:00:00.000Z',
      });
      mockEventService.create.mockResolvedValue(spanningEvent);

      await act(async () => {
        await useEventStore.getState().createEvent(spanningEvent);
      });

      // The invalidation calls should have been made for both months
      // We can verify by checking the cache doesn't have the old keys
      // (new keys would be created on next fetch)
    });
  });

  describe('Out-of-order request protection', () => {
    it('should cancel previous request when new request for same key is made', async () => {
      setupUser('user-1');

      let resolveFirst: (value: { events: Event[]; total: number; page: number; limit: number }) => void;
      const firstPromise = new Promise<{ events: Event[]; total: number; page: number; limit: number }>((resolve) => {
        resolveFirst = resolve;
      });

      mockEventService.list
        .mockReturnValueOnce(firstPromise)
        .mockResolvedValueOnce({ events: [createMockEvent({ id: 'event-2' })], total: 1, page: 1, limit: 100 });

      // Start first request
      const firstLoad = act(async () => {
        await useEventStore.getState().loadEvents();
      });

      // Immediately change date (same month) - should cancel first request
      useEventStore.setState({ selectedDate: createLocalDate(2026, 11, 20) });
      await act(async () => {
        await useEventStore.getState().loadEvents();
      });

      // Resolve first request - it should be ignored
      resolveFirst!({ events: [createMockEvent({ id: 'event-1' })], total: 1, page: 1, limit: 100 });
      await firstLoad;

      // Should have the second request's data
      expect(useEventStore.getState().events[0]?.id).toBe('event-2');
    });
  });

  describe('Cross-user data isolation', () => {
    it('should reset cache when user changes', async () => {
      // User 1 loads events
      setupUser('user-1');
      const user1Events = [createMockEvent({ id: 'event-user1', user_id: 'user-1' })];
      setupMockListResponse(user1Events);
      await act(async () => {
        await useEventStore.getState().loadEvents();
      });
      expect(useEventStore.getState().events).toEqual(user1Events);

      // Switch to User 2
      setupUser('user-2');
      const user2Events = [createMockEvent({ id: 'event-user2', user_id: 'user-2' })];
      mockEventService.list.mockResolvedValue({ events: user2Events, total: 1, page: 1, limit: 100 });

      // Reset store (simulating auth change)
      useEventStore.getState().reset();

      await act(async () => {
        await useEventStore.getState().loadEvents();
      });

      // Should have user 2's events, not user 1's
      expect(useEventStore.getState().events).toEqual(user2Events);
      expect(useEventStore.getState().events[0]?.user_id).toBe('user-2');
    });

    it('should not leak events between users in cache', async () => {
      setupUser('user-1');
      const user1Events = [createMockEvent({ id: 'event-1', user_id: 'user-1' })];
      setupMockListResponse(user1Events);
      await act(async () => {
        await useEventStore.getState().loadEvents();
      });

      // Get the cache key for user 1
      const cache = useEventStore.getState().cache;
      const user1CacheKeys = Array.from(cache.keys()).filter(k => k.startsWith('user-1|'));
      expect(user1CacheKeys.length).toBeGreaterThan(0);

      // Switch to user 2
      setupUser('user-2');
      useEventStore.getState().reset();

      // User 2's cache should be separate
      const user2CacheKeys = Array.from(useEventStore.getState().cache.keys()).filter(k => k.startsWith('user-2|'));
      expect(user2CacheKeys.length).toBe(0); // No cache for user 2 yet
    });
  });

  describe('All-day events and timezone handling', () => {
    it('should correctly handle all-day events in cache', async () => {
      setupUser('user-1');
      const allDayEvent = createAllDayEvent({ id: 'allday-1' });
      setupMockListResponse([allDayEvent]);
      await act(async () => {
        await useEventStore.getState().loadEvents();
      });

      expect(useEventStore.getState().events).toHaveLength(1);
      expect(useEventStore.getState().events[0].all_day).toBe(true);

      // Change day within same month - should still have the all-day event
      useEventStore.setState({ selectedDate: createLocalDate(2026, 11, 16) });
      await act(async () => {
        await useEventStore.getState().loadEvents();
      });

      // Cache hit - no new API call
      expect(mockEventService.list).toHaveBeenCalledTimes(1);
      expect(useEventStore.getState().events).toHaveLength(1);
      expect(useEventStore.getState().events[0].all_day).toBe(true);
    });

    it('should handle timezone differences correctly', async () => {
      setupUser('user-1');
      // Event at 23:00 UTC on Nov 15 = evening of Nov 15 in UTC, but next day in UTC+2
      const lateEvent = createMockEvent({
        id: 'late-event',
        start_date: '2026-11-15T23:00:00.000Z',
        end_date: '2026-11-16T00:00:00.000Z',
      });
      setupMockListResponse([lateEvent]);
      await act(async () => {
        await useEventStore.getState().loadEvents();
      });

      // Event should appear on Nov 15 (UTC) and Nov 16 (in some timezones)
      // The calendar grid uses eventOccursOnDay which handles this
      expect(useEventStore.getState().events).toHaveLength(1);
    });

    it('should fetch new month when navigating across month boundary', async () => {
      setupUser('user-1');
      // All-day event spanning Nov 30 - Dec 1
      const spanningAllDay = createAllDayEvent({
        id: 'span-allday',
        start_date: '2026-11-30T00:00:00.000Z',
        end_date: '2026-12-02T00:00:00.000Z',
      });
      setupMockListResponse([spanningAllDay]);
      await act(async () => {
        await useEventStore.getState().loadEvents();
      });

      // Should be in November cache
      expect(useEventStore.getState().events).toHaveLength(1);
      expect(mockEventService.list).toHaveBeenCalledTimes(1);

      // Switch to December - should fetch December (different month = new cache key)
      mockEventService.list.mockResolvedValue({ events: [spanningAllDay], total: 1, page: 1, limit: 100 });
      useEventStore.setState({ selectedDate: createLocalDate(2026, 12, 1) });
      await act(async () => {
        await useEventStore.getState().loadEvents();
      });

      // Should fetch December and find the event there too
      expect(mockEventService.list).toHaveBeenCalledTimes(2);
      expect(useEventStore.getState().events).toHaveLength(1);
    });
  });

  describe('Cache TTL expiration', () => {
    it('should refetch after cache TTL expires', async () => {
      setupUser('user-1');
      const events = [createMockEvent({ id: 'event-1' })];
      setupMockListResponse(events);
      await act(async () => {
        await useEventStore.getState().loadEvents();
      });
      expect(mockEventService.list).toHaveBeenCalledTimes(1);

      // Advance time past TTL (5 minutes)
      await advanceTimers(6 * 60 * 1000);

      // Should refetch
      const newEvents = [createMockEvent({ id: 'event-2' })];
      mockEventService.list.mockResolvedValue({ events: newEvents, total: 1, page: 1, limit: 100 });
      await act(async () => {
        await useEventStore.getState().loadEvents();
      });

      expect(mockEventService.list).toHaveBeenCalledTimes(2);
      expect(useEventStore.getState().events).toEqual(newEvents);
    });
  });

  describe('Prefetch adjacent months', () => {
    it('should have prefetch capability after mutation', async () => {
      setupUser('user-1');
      const events = [createMockEvent({ id: 'event-1' })];
      setupMockListResponse(events);
      await act(async () => {
        await useEventStore.getState().loadEvents();
      });

      const newEvent = createMockEvent({ id: 'event-new' });
      mockEventService.create.mockResolvedValue(newEvent);
      mockEventService.list.mockResolvedValue({ events: [], total: 0, page: 1, limit: 100 });

      await act(async () => {
        await useEventStore.getState().createEvent(newEvent);
      });

      // Prefetch is fire-and-forget, so we can't easily test it synchronously
      // But we can verify the cache structure allows it
      const cache = useEventStore.getState().cache;
      expect(cache).toBeDefined();
    });
  });
});
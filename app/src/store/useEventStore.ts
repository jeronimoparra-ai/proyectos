import { create } from 'zustand';
import { eventService } from '../services/event';
import { useAuthStore } from './useAuthStore';
import type { Event } from '../types';

interface EventFilters {
  start_after?: string;
  start_before?: string;
  category_id?: string;
  search?: string;
  source?: 'local' | 'google';
}

// Cache key: userId|year|month|filtersHash
type CacheKey = string;

interface CachedMonth {
  events: Event[];
  total: number;
  fetchedAt: number;
  filtersHash: string;
}

interface PendingRequest {
  controller: AbortController;
  promise: Promise<void>;
}

interface EventState {
  events: Event[];
  total: number;
  page: number;
  filters: EventFilters;
  selectedDate: Date;
  isLoading: boolean;
  error: string | null;
  selectedEvent: Event | null;

  // Cache
  cache: Map<CacheKey, CachedMonth>;
  pendingRequests: Map<CacheKey, PendingRequest>;

  setFilters: (filters: EventFilters) => void;
  setSelectedDate: (date: Date) => void;
  loadEvents: () => Promise<void>;
  loadEvent: (id: string) => Promise<void>;
  createEvent: (data: Partial<Event> & { title: string; start_date: string; end_date: string }) => Promise<Event>;
  updateEvent: (id: string, data: Partial<Event>) => Promise<Event>;
  deleteEvent: (id: string) => Promise<void>;
  clearSelectedEvent: () => void;
  reset: () => void;

  // Cache helpers
  invalidateCache: (userId: string, year: number, month: number) => void;
  invalidateAllUserCache: (userId: string) => void;
  prefetchAdjacentMonths: (userId: string, year: number, month: number, filters: EventFilters) => void;
  getCacheKey: (userId: string, year: number, month: number, filters: EventFilters) => CacheKey;
  getFiltersHash: (filters: EventFilters) => string;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function stableStringify(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj).sort();
  return JSON.stringify(Object.fromEntries(keys.map(k => [k, obj[k]])));
}

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  total: 0,
  page: 1,
  filters: {},
  selectedDate: new Date(),
  isLoading: false,
  error: null,
  selectedEvent: null,

  cache: new Map(),
  pendingRequests: new Map(),

  setFilters: (filters) => {
    set({ filters, page: 1 });
    get().loadEvents();
  },

  setSelectedDate: (date) => {
    set({ selectedDate: date });
    get().loadEvents();
  },

  getCacheKey: (userId: string, year: number, month: number, filters: EventFilters) => {
    const filtersHash = get().getFiltersHash(filters);
    return `${userId}|${year}|${month}|${filtersHash}`;
  },

  getFiltersHash: (filters: EventFilters) => {
    // Only include relevant filters for cache key
    const relevantFilters = {
      category_id: filters.category_id,
      search: filters.search,
      source: filters.source,
    };
    return stableStringify(relevantFilters);
  },

  loadEvents: async () => {
    const { selectedDate, filters, cache, pendingRequests, getCacheKey, getFiltersHash } = get();
    const authState = useAuthStore.getState();
    const userId = authState.user?.id;

    if (!userId) {
      set({ events: [], total: 0, isLoading: false, error: 'No user authenticated' });
      return;
    }

    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const cacheKey = getCacheKey(userId, year, month, filters);

    // Check if we have a valid cached entry
    const cached = cache.get(cacheKey);
    const now = Date.now();
    if (cached && (now - cached.fetchedAt) < CACHE_TTL_MS) {
      // Check if filters match (defense against stale cache)
      if (cached.filtersHash === getFiltersHash(filters)) {
        set({ events: cached.events, total: cached.total, isLoading: false });
        return;
      }
    }

    // Cancel any pending request for this same key (out-of-order protection)
    const existingPending = pendingRequests.get(cacheKey);
    if (existingPending) {
      existingPending.controller.abort();
    }

    const controller = new AbortController();
    let resolvePromise: (value: void) => void;
    const promise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });

    set((state) => ({
      pendingRequests: new Map(state.pendingRequests).set(cacheKey, { controller, promise }),
      isLoading: true,
      error: null,
    }));

    try {
      const startDate = new Date(year, month, 1).toISOString();
      const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

      const result = await eventService.list({
        ...filters,
        start_after: startDate,
        start_before: endDate,
        limit: 100,
      }, controller.signal);

      // Verify request wasn't superseded
      const currentPending = get().pendingRequests.get(cacheKey);
      if (currentPending?.controller !== controller) {
        // Another request superseded this one
        return;
      }

      const newCacheEntry: CachedMonth = {
        events: result.events,
        total: result.total,
        fetchedAt: Date.now(),
        filtersHash: getFiltersHash(filters),
      };

      set((state) => {
        const newCache = new Map(state.cache);
        newCache.set(cacheKey, newCacheEntry);
        const newPending = new Map(state.pendingRequests);
        newPending.delete(cacheKey);
        return {
          cache: newCache,
          pendingRequests: newPending,
          events: result.events,
          total: result.total,
          isLoading: false,
        };
      });

      resolvePromise!();
    } catch (error) {
      // Verify request wasn't superseded
      const currentPending = get().pendingRequests.get(cacheKey);
      if (currentPending?.controller !== controller) {
        return;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        // Request was cancelled, not an error
        return;
      }

      set((state) => {
        const newPending = new Map(state.pendingRequests);
        newPending.delete(cacheKey);
        return {
          pendingRequests: newPending,
          error: (error as Error).message,
          isLoading: false,
        };
      });
      resolvePromise!();
    }
  },

  loadEvent: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const event = await eventService.getById(id);
      set({ selectedEvent: event, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  createEvent: async (data) => {
    const event = await eventService.create(data);
    const { selectedDate } = get();
    const authState = useAuthStore.getState();
    const userId = authState.user?.id;

    // Optimistic update - add to current events if it belongs to current month
    if (userId) {
      const eventStart = new Date(event.start_date);
      const eventEnd = new Date(event.end_date ?? event.start_date);
      const currentMonthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      const currentMonthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59);

      const overlapsCurrentMonth = eventStart <= currentMonthEnd && eventEnd >= currentMonthStart;

      if (overlapsCurrentMonth) {
        set((state) => ({ events: [...state.events, event] }));
      }

      // Invalidate cache for this month (and adjacent if event spans boundaries)
      get().invalidateCache(userId, selectedDate.getFullYear(), selectedDate.getMonth());

      // If event spans into next/prev month, invalidate those too
      if (eventStart.getMonth() !== selectedDate.getMonth() || eventEnd.getMonth() !== selectedDate.getMonth()) {
        if (eventStart.getMonth() === (selectedDate.getMonth() + 1) % 12) {
          const nextYear = eventStart.getMonth() === 0 ? selectedDate.getFullYear() + 1 : selectedDate.getFullYear();
          get().invalidateCache(userId, nextYear, eventStart.getMonth());
        }
        if (eventEnd.getMonth() === (selectedDate.getMonth() + 1) % 12) {
          const nextYear = eventEnd.getMonth() === 0 ? selectedDate.getFullYear() + 1 : selectedDate.getFullYear();
          get().invalidateCache(userId, nextYear, eventEnd.getMonth());
        }
      }

      // Prefetch adjacent months for smoother navigation
      get().prefetchAdjacentMonths(userId, selectedDate.getFullYear(), selectedDate.getMonth(), get().filters);
    }

    return event;
  },

  updateEvent: async (id, data) => {
    const event = await eventService.update(id, data);
    const { selectedDate, events } = get();
    const authState = useAuthStore.getState();
    const userId = authState.user?.id;

    // Find the old event to check month changes
    const oldEvent = events.find(e => e.id === id);

    // Optimistic update
    set((state) => ({
      events: state.events.map((e) => (e.id === id ? event : e)),
      selectedEvent: state.selectedEvent?.id === id ? event : state.selectedEvent,
    }));

    if (userId && oldEvent) {
      const oldStart = new Date(oldEvent.start_date);
      const oldEnd = new Date(oldEvent.end_date ?? oldEvent.start_date);
      const newStart = new Date(event.start_date);
      const newEnd = new Date(event.end_date ?? event.start_date);

      // Invalidate all months that could be affected
      const affectedMonths = new Set<string>();

      // Old event months
      for (let d = new Date(oldStart); d <= oldEnd; d.setMonth(d.getMonth() + 1)) {
        affectedMonths.add(`${d.getFullYear()}|${d.getMonth()}`);
      }
      // New event months
      for (let d = new Date(newStart); d <= newEnd; d.setMonth(d.getMonth() + 1)) {
        affectedMonths.add(`${d.getFullYear()}|${d.getMonth()}`);
      }

      affectedMonths.forEach(key => {
        const [year, month] = key.split('|').map(Number);
        get().invalidateCache(userId, year, month);
      });

      // Prefetch adjacent months
      get().prefetchAdjacentMonths(userId, selectedDate.getFullYear(), selectedDate.getMonth(), get().filters);
    }

    return event;
  },

  deleteEvent: async (id) => {
    const { selectedDate, events } = get();
    const authState = useAuthStore.getState();
    const userId = authState.user?.id;

    const eventToDelete = events.find(e => e.id === id);

    await eventService.remove(id);

    set((state) => ({
      events: state.events.filter((e) => e.id !== id),
      selectedEvent: state.selectedEvent?.id === id ? null : state.selectedEvent,
    }));

    if (userId && eventToDelete) {
      const eventStart = new Date(eventToDelete.start_date);
      const eventEnd = new Date(eventToDelete.end_date ?? eventToDelete.start_date);

      // Invalidate all months the event spanned
      for (let d = new Date(eventStart); d <= eventEnd; d.setMonth(d.getMonth() + 1)) {
        get().invalidateCache(userId, d.getFullYear(), d.getMonth());
      }

      // Prefetch adjacent months
      get().prefetchAdjacentMonths(userId, selectedDate.getFullYear(), selectedDate.getMonth(), get().filters);
    }
  },

  invalidateCache: (userId: string, year: number, month: number) => {
    const { filters, cache } = get();
    const cacheKey = get().getCacheKey(userId, year, month, filters);

    set((state) => {
      const newCache = new Map(state.cache);
      newCache.delete(cacheKey);
      return { cache: newCache };
    });
  },

  invalidateAllUserCache: (userId: string) => {
    set((state) => {
      const newCache = new Map(state.cache);
      for (const key of newCache.keys()) {
        if (key.startsWith(`${userId}|`)) {
          newCache.delete(key);
        }
      }
      return { cache: newCache };
    });
  },

  prefetchAdjacentMonths: (userId: string, year: number, month: number, filters: EventFilters) => {
    // Only prefetch if we don't already have fresh data for adjacent months
    // This avoids unnecessary network requests
    const cache = get().cache;
    const now = Date.now();

    const monthsToPrefetch = [
      { year: month === 0 ? year - 1 : year, month: month === 0 ? 11 : month - 1 }, // previous
      { year: month === 11 ? year + 1 : year, month: month === 11 ? 0 : month + 1 }, // next
    ];

    monthsToPrefetch.forEach(({ year: y, month: m }) => {
      const cacheKey = get().getCacheKey(userId, y, m, filters);
      const cached = cache.get(cacheKey);

      // Only prefetch if not cached or cache is stale
      if (!cached || (now - cached.fetchedAt) >= CACHE_TTL_MS) {
        // Fire and forget - don't await, don't block UI
        const controller = new AbortController();
        eventService.list({
          ...filters,
          start_after: new Date(y, m, 1).toISOString(),
          start_before: new Date(y, m + 1, 0, 23, 59, 59).toISOString(),
          limit: 100,
        }, controller.signal)
          .then(result => {
            // Only update cache if request wasn't aborted and still relevant
            const currentCache = get().cache;
            const currentCached = currentCache.get(cacheKey);
            if (!controller.signal.aborted && (!currentCached || currentCached.filtersHash === get().getFiltersHash(filters))) {
              set((state) => {
                const newCache = new Map(state.cache);
                newCache.set(cacheKey, {
                  events: result.events,
                  total: result.total,
                  fetchedAt: Date.now(),
                  filtersHash: get().getFiltersHash(filters),
                });
                return { cache: newCache };
              });
            }
          })
          .catch(() => {
            // Ignore prefetch errors silently
          });
      }
    });
  },

  clearSelectedEvent: () => set({ selectedEvent: null }),

  reset: () => {
    const authState = useAuthStore.getState();
    if (authState.user?.id) {
      get().invalidateAllUserCache(authState.user.id);
    }
    set({
      events: [],
      total: 0,
      page: 1,
      filters: {},
      selectedDate: new Date(),
      isLoading: false,
      error: null,
      selectedEvent: null,
    });
  },
}));

// Extend eventService to accept AbortSignal
declare module '../services/event' {
  interface EventService {
    list(filters: EventFilters, signal?: AbortSignal): Promise<{ events: Event[]; total: number }>;
  }
}
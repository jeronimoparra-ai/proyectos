import { create } from 'zustand';
import { eventService } from '../services/event';
import type { Event } from '../types';

interface EventFilters {
  start_after?: string;
  start_before?: string;
  category_id?: string;
  search?: string;
  source?: 'local' | 'google';
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

  setFilters: (filters: EventFilters) => void;
  setSelectedDate: (date: Date) => void;
  loadEvents: () => Promise<void>;
  loadEvent: (id: string) => Promise<void>;
  createEvent: (data: Partial<Event> & { title: string; start_date: string; end_date: string }) => Promise<Event>;
  updateEvent: (id: string, data: Partial<Event>) => Promise<Event>;
  deleteEvent: (id: string) => Promise<void>;
  clearSelectedEvent: () => void;
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

  setFilters: (filters) => {
    set({ filters, page: 1 });
    get().loadEvents();
  },

  setSelectedDate: (date) => {
    set({ selectedDate: date });
    get().loadEvents();
  },

  loadEvents: async () => {
    set({ isLoading: true, error: null });
    try {
      const { filters, selectedDate } = get();
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const startDate = new Date(year, month, 1).toISOString();
      const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

      const result = await eventService.list({
        ...filters,
        start_after: startDate,
        start_before: endDate,
        limit: 100,
      });
      set({ events: result.events, total: result.total, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
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
    set((state) => ({ events: [...state.events, event] }));
    return event;
  },

  updateEvent: async (id, data) => {
    const event = await eventService.update(id, data);
    set((state) => ({
      events: state.events.map((e) => (e.id === id ? event : e)),
      selectedEvent: state.selectedEvent?.id === id ? event : state.selectedEvent,
    }));
    return event;
  },

  deleteEvent: async (id) => {
    await eventService.remove(id);
    set((state) => ({
      events: state.events.filter((e) => e.id !== id),
      selectedEvent: state.selectedEvent?.id === id ? null : state.selectedEvent,
    }));
  },

  clearSelectedEvent: () => set({ selectedEvent: null }),
}));

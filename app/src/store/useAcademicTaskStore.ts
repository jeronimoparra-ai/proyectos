import { create } from 'zustand';
import { academicTaskService } from '../services/academic';
import type { AcademicTask } from '../types';

interface AcademicTaskFilters {
  subject?: string;
  search?: string;
}

interface SearchResult {
  title: string;
  url: string;
  description: string;
  age?: string;
}

interface AcademicTaskState {
  tasks: AcademicTask[];
  total: number;
  page: number;
  filters: AcademicTaskFilters;
  isLoading: boolean;
  isProcessing: boolean;
  isSearching: boolean;
  error: string | null;
  selectedTask: AcademicTask | null;
  searchResults: SearchResult[];

  setFilters: (filters: AcademicTaskFilters) => void;
  loadTasks: () => Promise<void>;
  loadTask: (id: string) => Promise<void>;
  createTask: (data: Parameters<typeof academicTaskService.create>[0]) => Promise<AcademicTask>;
  updateTask: (id: string, data: Partial<AcademicTask>) => Promise<AcademicTask>;
  deleteTask: (id: string) => Promise<void>;
  processWithAI: (id: string) => Promise<void>;
  researchTopic: (topic: string, context?: string) => Promise<void>;
  clearSearchResults: () => void;
  clearSelectedTask: () => void;
}

export const useAcademicTaskStore = create<AcademicTaskState>((set, get) => ({
  tasks: [],
  total: 0,
  page: 1,
  filters: {},
  isLoading: false,
  isProcessing: false,
  isSearching: false,
  error: null,
  selectedTask: null,
  searchResults: [],

  setFilters: (filters) => {
    set({ filters, page: 1 });
    get().loadTasks();
  },

  loadTasks: async () => {
    set({ isLoading: true, error: null });
    try {
      const { filters, page } = get();
      const result = await academicTaskService.list({ ...filters, page, limit: 20 });
      set({ tasks: result.tasks, total: result.total, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadTask: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const task = await academicTaskService.getById(id);
      set({ selectedTask: task, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  createTask: async (data) => {
    const task = await academicTaskService.create(data);
    set((state) => ({ tasks: [task, ...state.tasks] }));
    return task;
  },

  updateTask: async (id, data) => {
    const task = await academicTaskService.update(id, data);
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? task : t)),
      selectedTask: state.selectedTask?.id === id ? task : state.selectedTask,
    }));
    return task;
  },

  deleteTask: async (id) => {
    await academicTaskService.remove(id);
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
      selectedTask: state.selectedTask?.id === id ? null : state.selectedTask,
    }));
  },

  processWithAI: async (id) => {
    set({ isProcessing: true, error: null });
    try {
      const result = await academicTaskService.processWithAI(id);
      set((state) => ({
        selectedTask: state.selectedTask?.id === id
          ? {
              ...state.selectedTask,
              summary: result.summary,
              key_ideas: result.keyIdeas,
              concepts: result.concepts,
              questions: result.questions,
              ai_processed_at: new Date().toISOString(),
            }
          : state.selectedTask,
        isProcessing: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isProcessing: false });
    }
  },

  researchTopic: async (topic, context) => {
    set({ isSearching: true, error: null });
    try {
      const result = await academicTaskService.researchTopic(topic, context);
      set({ searchResults: result.sources, isSearching: false });
    } catch (error) {
      set({ error: (error as Error).message, isSearching: false });
    }
  },

  clearSearchResults: () => set({ searchResults: [] }),

  clearSelectedTask: () => set({ selectedTask: null, searchResults: [] }),
}));

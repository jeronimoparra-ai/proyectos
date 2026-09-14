import { create } from 'zustand';
import { taskService } from '../services/task';
import type { Task, TaskStatus, TaskPriority } from '../types';

interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  search?: string;
}

interface TaskState {
  tasks: Task[];
  total: number;
  page: number;
  filters: TaskFilters;
  isLoading: boolean;
  error: string | null;
  selectedTask: Task | null;

  setFilters: (filters: TaskFilters) => void;
  loadTasks: () => Promise<void>;
  loadTask: (id: string) => Promise<void>;
  createTask: (data: Partial<Task> & { title: string }) => Promise<Task>;
  updateTask: (id: string, data: Partial<Task>) => Promise<Task>;
  completeTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  clearSelectedTask: () => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  total: 0,
  page: 1,
  filters: {},
  isLoading: false,
  error: null,
  selectedTask: null,

  setFilters: (filters) => {
    set({ filters, page: 1 });
    get().loadTasks();
  },

  loadTasks: async () => {
    set({ isLoading: true, error: null });
    try {
      const { filters, page } = get();
      const result = await taskService.list({ ...filters, page, limit: 20 });
      set({ tasks: result.tasks, total: result.total, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadTask: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const task = await taskService.getById(id);
      set({ selectedTask: task, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  createTask: async (data) => {
    const task = await taskService.create(data);
    set((state) => ({ tasks: [task, ...state.tasks] }));
    return task;
  },

  updateTask: async (id, data) => {
    const task = await taskService.update(id, data);
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? task : t)),
      selectedTask: state.selectedTask?.id === id ? task : state.selectedTask,
    }));
    return task;
  },

  completeTask: async (id) => {
    await taskService.complete(id);
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, status: 'completed' as const } : t
      ),
    }));
  },

  deleteTask: async (id) => {
    await taskService.remove(id);
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
      selectedTask: state.selectedTask?.id === id ? null : state.selectedTask,
    }));
  },

  clearSelectedTask: () => set({ selectedTask: null }),
}));

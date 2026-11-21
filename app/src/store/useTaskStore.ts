import { create } from 'zustand';
import { taskService } from '../services/task';
import { useAuthStore } from './useAuthStore';
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
  isRefreshing: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  searchPending: boolean;
  error: string | null;
  selectedTask: Task | null;
  setFilters: (filters: TaskFilters) => void;
  setSearch: (search: string) => void;
  loadTasks: () => Promise<void>;
  loadMore: () => Promise<void>;
  loadTask: (id: string) => Promise<void>;
  createTask: (data: Partial<Task> & { title: string }) => Promise<Task>;
  updateTask: (id: string, data: Partial<Task>) => Promise<Task>;
  completeTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  clearSelectedTask: () => void;
  reset: () => void;
}

const initial = () => ({
  tasks: [] as Task[], total: 0, page: 0, filters: {} as TaskFilters,
  isLoading: false, isRefreshing: false, isLoadingMore: false,
  hasMore: false, searchPending: false, error: null as string | null,
  selectedTask: null as Task | null,
});

export const useTaskStore = create<TaskState>((set, get) => {
  let session = 0;
  let generation = 0;
  let detailGeneration = 0;
  let listBusy = false;
  let detailBusy = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const completing = new Set<string>();
  const invalidate = () => {
    generation++;
    // Si cambia la busqueda/filtros mientras hay un completado optimista en
    // vuelo, el Set quedaba marcado y loadTasks() volvia a salir early-return,
    // dejando la lista sin refrescar. La invalidacion tambien libera esos locks.
    completing.clear();
    listBusy = false;
    clearTimeout(timer);
    timer = undefined;
    set({ isLoading: detailBusy, isRefreshing: false, isLoadingMore: false, searchPending: false });
  };
  const identity = () => useAuthStore.getState().user?.id;
  const guard = () => {
    const epoch = session;
    const userId = identity();
    return () => epoch === session && userId === identity();
  };
  const fetchPage = async (append: boolean) => {
    if (!identity() || completing.size || get().searchPending) return;
    if (listBusy) return;
    if (append && !get().hasMore) return;
    const validSession = guard();
    const request = ++generation;
    const page = append ? get().page + 1 : 1;
    listBusy = true;
    set({ isLoading: detailBusy || (!append && !get().tasks.length), isRefreshing: !append && !!get().tasks.length,
      isLoadingMore: append, error: null });
    try {
      const result = await taskService.list({ ...get().filters, page, limit: 20 });
      if (!validSession() || request !== generation) return;
      const tasks = [...new Map((append ? [...get().tasks, ...result.tasks] : result.tasks)
        .map(task => [task.id, task])).values()];
      set({ tasks, total: result.total, page,
        hasMore: result.tasks.length > 0 && page * result.limit < result.total });
    } catch (error) {
      if (validSession() && request === generation) set({ error: (error as Error).message });
    } finally {
      if (validSession() && request === generation) {
        listBusy = false;
        set({ isLoading: detailBusy, isRefreshing: false, isLoadingMore: false });
      }
    }
  };
  return {
    ...initial(),
    setSearch: (search) => {
      const value = search || undefined;
      if (value === get().filters.search) return;
      invalidate();
      set({ filters: { ...get().filters, search: value }, searchPending: true, hasMore: false });
      timer = setTimeout(() => {
        timer = undefined;
        set({ searchPending: false });
        void get().loadTasks();
      }, 300);
    },
    setFilters: (filters) => {
      const current = get().filters;
      const next = { ...current, ...filters };
      if (current.search === next.search && current.status === next.status && current.priority === next.priority) return;
      invalidate();
      set({ filters: next, hasMore: false });
      void get().loadTasks();
    },
    loadTasks: () => fetchPage(false),
    loadMore: () => fetchPage(true),
    loadTask: async (id) => {
      const valid = guard();
      const request = ++detailGeneration;
      detailBusy = true;
      set({ selectedTask: null, error: null, isLoading: true });
      try {
        const task = await taskService.getById(id);
        if (valid() && request === detailGeneration) set({ selectedTask: task });
      } catch (error) {
        if (valid() && request === detailGeneration) set({ error: (error as Error).message });
      } finally {
        if (valid() && request === detailGeneration) {
          detailBusy = false;
          set({ isLoading: listBusy && !get().tasks.length && !get().isLoadingMore });
        }
      }
    },
    createTask: async (data) => {
      const valid = guard();
      const task = await taskService.create(data);
      if (valid()) { invalidate(); await get().loadTasks(); }
      return task;
    },
    updateTask: async (id, data) => {
      const valid = guard();
      const task = await taskService.update(id, data);
      if (valid()) {
        invalidate();
        set(state => ({ selectedTask: state.selectedTask?.id === id ? task : state.selectedTask }));
        await get().loadTasks();
      }
      return task;
    },
    completeTask: async (id) => {
      if (completing.has(id)) return;
      const previous = get().tasks.find(task => task.id === id);
      if (!previous || previous.status === 'completed') return;
      const valid = guard();
      completing.add(id);
      invalidate();
      const mutationFilters = get().filters;
      let failed = false;
      const optimistic = { ...previous, status: 'completed' as const };
      set(state => ({ tasks: state.tasks.map(task => task.id === id ? optimistic : task), error: null }));
      try {
        const task = await taskService.complete(id);
        if (valid()) set(state => ({ tasks: state.tasks.map(item => item === optimistic ? task : item) }));
      } catch (error) {
        failed = true;
        if (valid()) set(state => ({
          tasks: state.tasks.map(task => task === optimistic ? previous : task),
          error: (error as Error).message,
        }));
      } finally {
        if (valid()) {
          completing.delete(id);
          // Reconcile filtered membership and pagination after the last mutation.
          if (!completing.size && (!failed || get().filters !== mutationFilters)) void get().loadTasks();
        }
      }
    },
    deleteTask: async (id) => {
      const valid = guard();
      await taskService.remove(id);
      if (valid()) {
        invalidate();
        set(state => ({ tasks: state.tasks.filter(task => task.id !== id),
          selectedTask: state.selectedTask?.id === id ? null : state.selectedTask }));
        await get().loadTasks();
      }
    },
    clearSelectedTask: () => {
      detailGeneration++;
      detailBusy = false;
      set({ selectedTask: null, isLoading: listBusy && !get().tasks.length && !get().isLoadingMore });
    },
    reset: () => {
      session++;
      detailGeneration++;
      detailBusy = false;
      invalidate();
      completing.clear();
      set(initial());
    },
  };
});

// Clear account data immediately, even when TasksScreen is not mounted.
useAuthStore.subscribe((state, previous) => {
  if (state.user?.id !== previous.user?.id) useTaskStore.getState().reset();
});

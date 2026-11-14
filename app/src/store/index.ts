import { useAuthStore } from './useAuthStore';
import { useTaskStore } from './useTaskStore';
import { useEventStore } from './useEventStore';
import { useAcademicTaskStore } from './useAcademicTaskStore';
import { useReviewStore } from './useReviewStore';

export { useAuthStore } from './useAuthStore';
export { useAppStore } from './useAppStore';
export { useTaskStore } from './useTaskStore';
export { useEventStore } from './useEventStore';
export { useAcademicTaskStore } from './useAcademicTaskStore';
export { useReviewStore } from './useReviewStore';

/**
 * Limpia de manera exhaustiva todos los stores de Zustand con estado de usuario,
 * selecciones y filtros para evitar fuga de estado entre sesiones.
 */
export function clearAllUserStores() {
  useTaskStore.getState().reset();
  useEventStore.getState().reset();
  useAcademicTaskStore.getState().reset();
  useReviewStore.getState().reset();
  useAuthStore.getState().signOut();
}

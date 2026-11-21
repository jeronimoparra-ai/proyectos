import { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme } from '../hooks';
import { useAuthStore } from '../store/useAuthStore';
import { useTaskStore } from '../store/useTaskStore';
import { useTaskReminderIntegration } from '../hooks/useSmartReminders';
import { spacing, touchTarget, typography } from '../theme';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { FadeSlideIn } from '../components/FadeSlideIn';
import { ScreenSkeleton } from '../components/Skeleton';
import { IconPlus, IconSearch, IconTask } from '../components/icons';
import type { Task, TaskStatus, TaskPriority } from '../types';
import type { TabScreenProps } from '../navigation/types';

const STATUS_FILTERS: { label: string; value: TaskStatus | undefined }[] = [
  { label: 'Todas', value: undefined },
  { label: 'Pendientes', value: 'pending' },
  { label: 'En curso', value: 'in_progress' },
  { label: 'Completadas', value: 'completed' },
];

const PRIORITY_FILTERS: { label: string; value: TaskPriority | undefined }[] = [
  { label: 'Todas', value: undefined },
  { label: 'Urgente', value: 'urgent' },
  { label: 'Alta', value: 'high' },
  { label: 'Media', value: 'medium' },
  { label: 'Baja', value: 'low' },
];

export function TasksScreen({ navigation }: TabScreenProps<'Tasks'>) {
  const { colors, borderRadius, insets } = useTheme();
  const tasks = useTaskStore(state => state.tasks);
  const isLoading = useTaskStore(state => state.isLoading);
  const isRefreshing = useTaskStore(state => state.isRefreshing);
  const isLoadingMore = useTaskStore(state => state.isLoadingMore);
  const error = useTaskStore(state => state.error);
  const filters = useTaskStore(state => state.filters);
  const setFilters = useTaskStore(state => state.setFilters);
  const setSearch = useTaskStore(state => state.setSearch);
  const loadTasks = useTaskStore(state => state.loadTasks);
  const loadMore = useTaskStore(state => state.loadMore);
  const { completeTask } = useTaskReminderIntegration();
  const userId = useAuthStore(state => state.user?.id);

  useEffect(() => {
    if (userId) void loadTasks();
  }, [loadTasks, userId]);

  const handleStatusFilter = (status: TaskStatus | undefined) => {
    setFilters({ status });
  };

  const handleTaskPress = (task: Task) => {
    navigation.navigate('TaskDetail', { taskId: task.id });
  };

  const handleComplete = async (task: Task) => {
    if (task.status !== 'completed') {
      try { await completeTask(task.id); } catch { Alert.alert('No se pudo completar', 'Inténtalo de nuevo.'); }
    }
  };

  const handleCreateTask = () => {
    navigation.navigate('TaskForm', { taskId: undefined });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FadeSlideIn index={0}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
          <Text style={[styles.title, { color: colors.text }]}>Tareas</Text>
          <AnimatedPressable
            style={[styles.addButton, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
            onPress={handleCreateTask}
            accessibilityRole="button"
            accessibilityLabel="Crear nueva tarea"
          >
            <IconPlus size={16} color={colors.inkMuted} />
            <Text style={[styles.addButtonText, { color: colors.inkMuted }]}>Crear tarea</Text>
          </AnimatedPressable>
        </View>

        <View style={[styles.searchContainer, { backgroundColor: colors.surfaceVariant, borderRadius: borderRadius.md }]}>
          <IconSearch size={18} color={colors.textTertiary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            accessibilityLabel="Buscar tareas"
            placeholder="Buscar tareas…"
            placeholderTextColor={colors.textTertiary}
            value={filters.search ?? ''}
            onChangeText={setSearch}
          />
        </View>

        <View style={styles.filters}>
          <View style={styles.filterRow}>
            {STATUS_FILTERS.map((filter) => (
              <AnimatedPressable
                key={filter.label}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: filters.status === filter.value ? colors.primary : colors.surfaceVariant,
                    borderRadius: borderRadius.full,
                  },
                ]}
                onPress={() => handleStatusFilter(filter.value)}
                accessibilityRole="button"
                accessibilityLabel={`Filtrar por ${filter.label}`}
                accessibilityState={{ selected: filters.status === filter.value }}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: filters.status === filter.value ? colors.inkMuted : colors.textSecondary },
                  ]}
                >
                  {filter.label}
                </Text>
              </AnimatedPressable>
            ))}
          </View>
          <Text style={{ color: colors.textSecondary, marginTop: spacing.sm }}>Prioridad</Text>
          <View style={styles.filterRow}>
            {PRIORITY_FILTERS.map(filter => <AnimatedPressable key={filter.label}
              style={[styles.filterChip, { backgroundColor: filters.priority === filter.value ? colors.primary : colors.surfaceVariant, borderRadius: borderRadius.full }]}
              onPress={() => setFilters({ priority: filter.value })} accessibilityLabel={`Prioridad: ${filter.label}`} accessibilityState={{ selected: filters.priority === filter.value }}>
              <Text style={{ color: filters.priority === filter.value ? colors.inkMuted : colors.textSecondary }}>{filter.label}</Text>
            </AnimatedPressable>)}
          </View>
        </View>
      </FadeSlideIn>

      {isLoading && tasks.length === 0 ? (
        <ScreenSkeleton count={4} />
      ) : error && tasks.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{error}</Text>
          <AnimatedPressable
            style={[styles.retryButton, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
            onPress={() => loadTasks()}
            accessibilityRole="button"
            accessibilityLabel="Reintentar carga de tareas"
          >
            <Text style={[styles.retryButtonText, { color: colors.inkMuted }]}>Reintentar</Text>
          </AnimatedPressable>
        </View>
      ) : (
        <FlatList
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          data={tasks}
          refreshing={isRefreshing}
          onRefresh={loadTasks}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={isLoadingMore ? <ActivityIndicator color={colors.primary} /> : error ? (
            <AnimatedPressable onPress={() => loadTasks()} accessibilityRole="button" accessibilityLabel="Reintentar carga de tareas">
              <Text style={{ color: colors.textSecondary }}>{error} · Reintentar</Text>
            </AnimatedPressable>
          ) : null}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <FadeSlideIn index={index}>
              <View style={[styles.taskRow, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: borderRadius.lg }]}>
                <AnimatedPressable style={styles.check} onPress={() => handleComplete(item)} disabled={item.status === 'completed'}
                  accessibilityRole="checkbox" accessibilityState={{ checked: item.status === 'completed', disabled: item.status === 'completed' }} accessibilityLabel={`Completar ${item.title}`}>
                  <Text style={{ color: item.status === 'completed' ? colors.success : colors.primary, fontSize: typography.sizes['2xl'] }}>{item.status === 'completed' ? '✓' : '○'}</Text>
                </AnimatedPressable>
                <AnimatedPressable containerStyle={{ flex: 1 }} style={styles.taskContent} onPress={() => handleTaskPress(item)} accessibilityLabel={`Abrir tarea: ${item.title}`}>
                  <Text numberOfLines={2} style={{ color: colors.text, fontWeight: '600', textDecorationLine: item.status === 'completed' ? 'line-through' : 'none' }}>{item.title}</Text>
                  <Text style={{ color: colors.textSecondary }}>{({ pending: 'Pendiente', in_progress: 'En curso', completed: 'Completada', postponed: 'Pospuesta', cancelled: 'Cancelada' })[item.status]} · {PRIORITY_FILTERS.find(filter => filter.value === item.priority)?.label}</Text>
                  <Text style={{ color: colors.accent }}>{item.due_date?.slice(0, 10) || 'Sin fecha'}{item.due_time ? ` · ${item.due_time.slice(0, 5)}` : ''}</Text>
                </AnimatedPressable>
              </View>
            </FadeSlideIn>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <IconTask size={48} color={colors.textTertiary} accessibilityLabel="No hay tareas con estos filtros" />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {filters.search || filters.status || filters.priority ? 'No hay tareas con estos filtros' : 'Crea tu primera tarea para organizar el día'}
              </Text>
              {(filters.search || filters.status || filters.priority) && <AnimatedPressable style={styles.retryButton} onPress={() => setFilters({ search: undefined, status: undefined, priority: undefined })}><Text style={{ color: colors.primary }}>Limpiar filtros</Text></AnimatedPressable>}
            </View>
          }
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  taskRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, marginBottom: spacing.sm, padding: spacing.sm, borderWidth: StyleSheet.hairlineWidth },
  check: { minWidth: touchTarget.min, minHeight: touchTarget.min, alignItems: 'center', justifyContent: 'center' },
  taskContent: { minHeight: touchTarget.comfortable, justifyContent: 'center', gap: spacing.xs },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  title: {
    fontSize: typography.sizes['3xl'],
    fontWeight: '700',
  },
  addButton: {
    minHeight: touchTarget.min,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: typography.sizes['sm'],
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    minHeight: touchTarget.min,
    fontSize: typography.sizes['md'],
  },
  filters: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  filterRow: {
    flexWrap: 'wrap',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterChip: {
    minHeight: touchTarget.min,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  filterChipText: {
    fontSize: typography.sizes['sm'],
    fontWeight: '500',
  },
  list: {
    paddingBottom: spacing.xl,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingTop: spacing['6xl'],
    gap: spacing.lg,
  },
  emptyText: {
    fontSize: typography.sizes['md'],
  },
  retryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: typography.sizes['sm'],
  },
});

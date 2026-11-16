import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
} from 'react-native';
import { useTheme } from '../hooks';
import { useTaskStore } from '../store/useTaskStore';
import { TaskCard } from '../components/tasks/TaskCard';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { FadeSlideIn } from '../components/FadeSlideIn';
import { ScreenSkeleton } from '../components/Skeleton';
import { IconPlus, IconSearch, IconTask } from '../components/icons';
import type { Task, TaskStatus, TaskPriority } from '../types';
import type { TabScreenProps } from '../navigation/types';

const STATUS_FILTERS: { label: string; value: TaskStatus | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Pending', value: 'pending' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
];

const PRIORITY_FILTERS: { label: string; value: TaskPriority | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Urgent', value: 'urgent' },
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
];

export function TasksScreen({ navigation }: TabScreenProps<'Tasks'>) {
  const { colors, spacing, borderRadius, insets } = useTheme();
  const { tasks, isLoading, error, filters, setFilters, loadTasks, completeTask } = useTaskStore();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    setFilters({ ...filters, search: text || undefined });
  };

  const handleStatusFilter = (status: TaskStatus | undefined) => {
    setFilters({ ...filters, status });
  };

  const handlePriorityFilter = (priority: TaskPriority | undefined) => {
    setFilters({ ...filters, priority });
  };

  const handleTaskPress = (task: Task) => {
    navigation.navigate('TaskDetail', { taskId: task.id });
  };

  const handleComplete = async (task: Task) => {
    if (task.status !== 'completed') {
      await completeTask(task.id);
    }
  };

  const handleCreateTask = () => {
    navigation.navigate('TaskForm', { taskId: undefined });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FadeSlideIn index={0}>
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Text style={[styles.title, { color: colors.text }]}>Tasks</Text>
          <AnimatedPressable
            style={[styles.addButton, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
            onPress={handleCreateTask}
            accessibilityRole="button"
            accessibilityLabel="Create new task"
          >
            <IconPlus size={16} color="#fff" />
            <Text style={styles.addButtonText}>New</Text>
          </AnimatedPressable>
        </View>

        <View style={[styles.searchContainer, { backgroundColor: colors.surfaceVariant, borderRadius: borderRadius.md }]}>
          <IconSearch size={18} color={colors.textTertiary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search tasks..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={handleSearch}
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
                accessibilityLabel={`Filter by ${filter.label}`}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: filters.status === filter.value ? '#fff' : colors.textSecondary },
                  ]}
                >
                  {filter.label}
                </Text>
              </AnimatedPressable>
            ))}
          </View>
        </View>
      </FadeSlideIn>

      {isLoading ? (
        <ScreenSkeleton count={4} />
      ) : error && tasks.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{error}</Text>
          <AnimatedPressable
            style={[styles.retryButton, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
            onPress={() => loadTasks()}
            accessibilityRole="button"
            accessibilityLabel="Retry loading tasks"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </AnimatedPressable>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <FadeSlideIn index={index}>
              <TaskCard task={item} onPress={handleTaskPress} onComplete={handleComplete} />
            </FadeSlideIn>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <IconTask size={48} color={colors.textTertiary} accessibilityLabel="No tasks found" />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No tasks found
              </Text>
            </View>
          }
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
  },
  filters: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  list: {
    paddingBottom: 20,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});

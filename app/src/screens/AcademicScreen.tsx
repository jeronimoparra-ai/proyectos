import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
} from 'react-native';
import { useTheme } from '../hooks';
import { useAcademicTaskStore } from '../store/useAcademicTaskStore';
import { AcademicTaskCard } from '../components/academic/AcademicTaskCard';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { FadeSlideIn } from '../components/FadeSlideIn';
import { ScreenSkeleton } from '../components/Skeleton';
import { IconPlus, IconSearch, IconBrain } from '../components/icons';
import type { AcademicTask } from '../types';
import type { TabScreenProps } from '../navigation/types';

export function AcademicScreen({ navigation }: TabScreenProps<'Academic'>) {
  const { colors, borderRadius, insets } = useTheme();
  const { tasks, isLoading, filters, setFilters, loadTasks } = useAcademicTaskStore();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    setFilters({ ...filters, search: text || undefined });
  };

  const handleTaskPress = (task: AcademicTask) => {
    navigation.navigate('AcademicTaskDetail', { taskId: task.id });
  };

  const handleCreateTask = () => {
    navigation.navigate('AcademicTaskForm', { taskId: undefined });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FadeSlideIn index={0}>
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Text style={[styles.title, { color: colors.text }]}>Academic</Text>
          <AnimatedPressable
            style={[styles.addButton, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
            onPress={handleCreateTask}
            accessibilityRole="button"
            accessibilityLabel="Create academic task"
          >
            <IconPlus size={16} color="#fff" />
            <Text style={styles.addButtonText}>New</Text>
          </AnimatedPressable>
        </View>

        <View style={[styles.searchContainer, { backgroundColor: colors.surfaceVariant, borderRadius: borderRadius.md }]}>
          <IconSearch size={18} color={colors.textTertiary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search academic tasks..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={handleSearch}
          />
        </View>
      </FadeSlideIn>

      {isLoading ? (
        <ScreenSkeleton count={3} />
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <FadeSlideIn index={index}>
              <AcademicTaskCard task={item} onPress={handleTaskPress} />
            </FadeSlideIn>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <IconBrain size={48} color={colors.textTertiary} accessibilityLabel="No academic tasks" />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No academic tasks yet
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
                Create your first academic task to get AI-powered insights
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
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
});

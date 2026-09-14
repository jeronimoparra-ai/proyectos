import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../hooks';
import { useAcademicTaskStore } from '../store/useAcademicTaskStore';
import { AcademicTaskCard } from '../components/academic/AcademicTaskCard';
import type { AcademicTask } from '../types';
import type { TabScreenProps } from '../navigation/types';

export function AcademicScreen({ navigation }: TabScreenProps<'Academic'>) {
  const { colors, borderRadius } = useTheme();
  const { tasks, isLoading, filters, setFilters, loadTasks } = useAcademicTaskStore();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadTasks();
  }, []);

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
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Academic</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
          onPress={handleCreateTask}
        >
          <Text style={styles.addButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.searchContainer, { backgroundColor: colors.surfaceVariant, borderRadius: borderRadius.md }]}>
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search academic tasks..."
          placeholderTextColor={colors.textTertiary}
          value={searchQuery}
          onChangeText={handleSearch}
        />
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <AcademicTaskCard task={item} onPress={handleTaskPress} />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
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
    paddingTop: 60,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  searchContainer: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  searchInput: {
    height: 44,
    paddingHorizontal: 16,
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

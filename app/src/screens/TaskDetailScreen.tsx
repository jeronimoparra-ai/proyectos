import { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../hooks';
import { useTaskStore } from '../store/useTaskStore';
import { Countdown } from '../components/tasks/Countdown';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'TaskDetail'>;

const priorityColors: Record<string, string> = {
  low: '#10B981',
  medium: '#F59E0B',
  high: '#F97316',
  urgent: '#EF4444',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  postponed: 'Postponed',
  cancelled: 'Cancelled',
};

export function TaskDetailScreen({ navigation, route }: Props) {
  const { taskId } = route.params;
  const { colors, borderRadius } = useTheme();
  const { selectedTask, isLoading, loadTask, updateTask, deleteTask, clearSelectedTask } = useTaskStore();

  useEffect(() => {
    loadTask(taskId);
    return () => clearSelectedTask();
  }, [taskId]);

  const handleStatusChange = async (status: 'pending' | 'in_progress' | 'completed') => {
    await updateTask(taskId, { status });
  };

  const handleDelete = () => {
    Alert.alert('Delete Task', 'Are you sure you want to delete this task?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTask(taskId);
          navigation.goBack();
        },
      },
    ]);
  };

  const handleEdit = () => {
    navigation.navigate('TaskForm', { taskId });
  };

  if (isLoading || !selectedTask) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const hasDeadline = selectedTask.due_date && selectedTask.status !== 'completed';
  const isOverdue = selectedTask.due_date && new Date(selectedTask.due_date) < new Date() && selectedTask.status !== 'completed';

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backButton, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.text }]}>{selectedTask.title}</Text>
          <View style={[styles.priorityBadge, { backgroundColor: priorityColors[selectedTask.priority] + '20' }]}>
            <Text style={[styles.priorityText, { color: priorityColors[selectedTask.priority] }]}>
              {selectedTask.priority}
            </Text>
          </View>
        </View>

        {selectedTask.description && (
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {selectedTask.description}
          </Text>
        )}

        {hasDeadline && (
          <View style={[styles.countdownCard, { backgroundColor: colors.surface, borderRadius: borderRadius.lg }]}>
            <Text style={[styles.countdownLabel, { color: colors.textSecondary }]}>
              {isOverdue ? 'Overdue by' : 'Time remaining'}
            </Text>
            <Countdown
              targetDate={selectedTask.due_date!}
              targetTime={selectedTask.due_time ?? undefined}
            />
            {selectedTask.due_time && (
              <Text style={[styles.deadlineTime, { color: colors.textTertiary }]}>
                Due: {selectedTask.due_date} at {selectedTask.due_time}
              </Text>
            )}
          </View>
        )}

        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderRadius: borderRadius.lg }]}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Status</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{statusLabels[selectedTask.status]}</Text>
          </View>
          {selectedTask.categories && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Category</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{selectedTask.categories.name}</Text>
            </View>
          )}
          {selectedTask.estimated_minutes && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Estimated</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{selectedTask.estimated_minutes} min</Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          {selectedTask.status !== 'completed' && (
            <>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
                onPress={() => handleStatusChange('in_progress')}
              >
                <Text style={styles.actionButtonText}>Start</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.success, borderRadius: borderRadius.md }]}
                onPress={() => handleStatusChange('completed')}
              >
                <Text style={styles.actionButtonText}>Complete</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.surfaceVariant, borderRadius: borderRadius.md }]}
            onPress={handleEdit}
          >
            <Text style={[styles.actionButtonText, { color: colors.text }]}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.errorLight, borderRadius: borderRadius.md }]}
            onPress={handleDelete}
          >
            <Text style={[styles.actionButtonText, { color: colors.error }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 8,
  },
  backButton: {
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    padding: 16,
    gap: 20,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  countdownCard: {
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  countdownLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  deadlineTime: {
    fontSize: 12,
  },
  infoCard: {
    padding: 16,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    minWidth: 100,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks';
import { Countdown } from './Countdown';
import type { Task } from '../../types';

interface TaskCardProps {
  task: Task;
  onPress: (task: Task) => void;
  onComplete: (task: Task) => void;
}

const priorityColors: Record<string, string> = {
  low: '#10B981',
  medium: '#F59E0B',
  high: '#F97316',
  urgent: '#EF4444',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Done',
  postponed: 'Postponed',
  cancelled: 'Cancelled',
};

export function TaskCard({ task, onPress, onComplete }: TaskCardProps) {
  const { colors, borderRadius } = useTheme();

  const hasDeadline = task.due_date && task.status !== 'completed';
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.lg,
          borderLeftColor: task.color ?? priorityColors[task.priority] ?? colors.primary,
        },
      ]}
      onPress={() => onPress(task)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <TouchableOpacity
            style={[
              styles.checkbox,
              {
                borderColor: isOverdue ? colors.error : colors.border,
                backgroundColor: task.status === 'completed' ? colors.success : 'transparent',
              },
            ]}
            onPress={() => onComplete(task)}
          >
            {task.status === 'completed' && (
              <Text style={styles.checkmark}>✓</Text>
            )}
          </TouchableOpacity>
          <Text
            style={[
              styles.title,
              {
                color: task.status === 'completed' ? colors.textTertiary : colors.text,
                textDecorationLine: task.status === 'completed' ? 'line-through' : 'none',
              },
            ]}
            numberOfLines={1}
          >
            {task.title}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: priorityColors[task.priority] + '20' }]}>
          <Text style={[styles.badgeText, { color: priorityColors[task.priority] }]}>
            {task.priority}
          </Text>
        </View>
      </View>

      {task.description ? (
        <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
          {task.description}
        </Text>
      ) : null}

      <View style={styles.footer}>
        <Text style={[styles.statusText, { color: colors.textTertiary }]}>
          {statusLabels[task.status]}
        </Text>
        {hasDeadline && (
          <View style={styles.deadline}>
            {isOverdue && (
              <Text style={[styles.overdueText, { color: colors.error }]}>Overdue</Text>
            )}
            <Countdown targetDate={task.due_date!} targetTime={task.due_time ?? undefined} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
    marginLeft: 34,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginLeft: 34,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  deadline: {
    alignItems: 'flex-end',
    gap: 4,
  },
  overdueText: {
    fontSize: 11,
    fontWeight: '600',
  },
});

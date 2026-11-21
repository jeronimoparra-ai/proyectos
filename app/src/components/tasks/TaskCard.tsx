import { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks';
import { cardStyles } from '../../theme/cardStyles';
import { Countdown } from './Countdown';
import { AnimatedPressable } from '../AnimatedPressable';
import { IconCheck } from '../icons';
import type { Task } from '../../types';

export interface TaskCardProps {
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

function areTaskCardPropsEqual(prev: TaskCardProps, next: TaskCardProps): boolean {
  if (prev.task === next.task && prev.onPress === next.onPress && prev.onComplete === next.onComplete) {
    return true;
  }
  return (
    prev.task.id === next.task.id &&
    prev.task.title === next.task.title &&
    prev.task.status === next.task.status &&
    prev.task.priority === next.task.priority &&
    prev.task.due_date === next.task.due_date &&
    prev.task.due_time === next.task.due_time &&
    prev.task.color === next.task.color &&
    prev.task.description === next.task.description &&
    prev.onPress === next.onPress &&
    prev.onComplete === next.onComplete
  );
}

export const TaskCard = memo(function TaskCard({ task, onPress, onComplete }: TaskCardProps) {
  const { colors, borderRadius } = useTheme();

  const hasDeadline = task.due_date && task.status !== 'completed';
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';

  return (
    <AnimatedPressable
      style={[
        cardStyles.cardContainer,
        cardStyles.cardBorderLeft,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.lg,
          borderLeftColor: task.color ?? priorityColors[task.priority] ?? colors.primary,
        },
      ]}
      onPress={() => onPress(task)}
      accessibilityRole="button"
      accessibilityLabel={`Task: ${task.title}`}
    >
      <View style={cardStyles.headerRow}>
        <View style={cardStyles.titleRow}>
          <TouchableOpacity
            style={[
              styles.checkbox,
              {
                borderColor: isOverdue ? colors.error : colors.border,
                backgroundColor: task.status === 'completed' ? colors.success : 'transparent',
              },
            ]}
            onPress={() => onComplete(task)}
            hitSlop={{ top: 11, bottom: 11, left: 11, right: 11 }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: task.status === 'completed' }}
            accessibilityLabel={task.status === 'completed' ? 'Mark task as incomplete' : 'Mark task as complete'}
          >
            {task.status === 'completed' && (
              <IconCheck size={13} color="#fff" accessibilityLabel="Completed" />
            )}
          </TouchableOpacity>
          <Text
            style={[
              cardStyles.titleText,
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
        <View style={[cardStyles.badgeBase, { backgroundColor: priorityColors[task.priority] + '20' }]}>
          <Text style={[cardStyles.badgeTextBase, { color: priorityColors[task.priority] }]}>
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
            <Countdown
              targetDate={task.due_date!}
              targetTime={task.due_time ?? undefined}
              precision="minute"
            />
          </View>
        )}
      </View>
    </AnimatedPressable>
  );
}, areTaskCardPropsEqual);

const styles = StyleSheet.create({
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
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

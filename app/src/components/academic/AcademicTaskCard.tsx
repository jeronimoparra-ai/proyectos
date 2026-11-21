import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks';
import { cardStyles } from '../../theme/cardStyles';
import { AnimatedPressable } from '../AnimatedPressable';
import { IconBrain } from '../icons';
import type { AcademicTask } from '../../types';

export interface AcademicTaskCardProps {
  task: AcademicTask;
  onPress: (task: AcademicTask) => void;
}

function areAcademicTaskCardPropsEqual(
  prev: AcademicTaskCardProps,
  next: AcademicTaskCardProps
): boolean {
  if (prev.task === next.task && prev.onPress === next.onPress) {
    return true;
  }
  return (
    prev.task.id === next.task.id &&
    prev.task.title === next.task.title &&
    prev.task.subject === next.task.subject &&
    prev.task.summary === next.task.summary &&
    prev.task.ai_processed_at === next.task.ai_processed_at &&
    prev.task.key_ideas?.length === next.task.key_ideas?.length &&
    prev.task.materials?.length === next.task.materials?.length &&
    prev.onPress === next.onPress
  );
}

export const AcademicTaskCard = memo(function AcademicTaskCard({ task, onPress }: AcademicTaskCardProps) {
  const { colors, borderRadius } = useTheme();

  const hasAIResult = !!task.ai_processed_at;

  return (
    <AnimatedPressable
      style={[
        cardStyles.cardContainer,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.lg,
        },
      ]}
      onPress={() => onPress(task)}
      accessibilityRole="button"
      accessibilityLabel={`Academic task: ${task.title}`}
    >
      <View style={cardStyles.headerRow}>
        <Text style={[cardStyles.titleText, { color: colors.text }]} numberOfLines={1}>
          {task.title}
        </Text>
        {hasAIResult && (
          <View style={[styles.aiBadge, { backgroundColor: colors.success + '20' }]}>
            <IconBrain size={12} color={colors.success} style={{ marginRight: 4 }} />
            <Text style={[styles.aiBadgeText, { color: colors.success }]}>AI</Text>
          </View>
        )}
      </View>

      {task.subject && (
        <Text style={[styles.subject, { color: colors.primary }]}>{task.subject}</Text>
      )}

      {task.summary && (
        <Text style={[styles.summary, { color: colors.textSecondary }]} numberOfLines={2}>
          {task.summary}
        </Text>
      )}

      <View style={styles.footer}>
        {task.key_ideas && task.key_ideas.length > 0 && (
          <Text style={[styles.meta, { color: colors.textTertiary }]}>
            {task.key_ideas.length} key ideas
          </Text>
        )}
        {task.materials && task.materials.length > 0 && (
          <Text style={[styles.meta, { color: colors.textTertiary }]}>
            {task.materials.length} materials
          </Text>
        )}
      </View>
    </AnimatedPressable>
  );
}, areAcademicTaskCardPropsEqual);

const styles = StyleSheet.create({
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  aiBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  subject: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
  },
  summary: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    gap: 16,
  },
  meta: {
    fontSize: 12,
  },
});

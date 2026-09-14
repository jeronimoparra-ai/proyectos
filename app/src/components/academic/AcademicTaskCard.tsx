import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks';
import type { AcademicTask } from '../../types';

interface AcademicTaskCardProps {
  task: AcademicTask;
  onPress: (task: AcademicTask) => void;
}

export function AcademicTaskCard({ task, onPress }: AcademicTaskCardProps) {
  const { colors, borderRadius } = useTheme();

  const hasAIResult = !!task.ai_processed_at;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.lg,
        },
      ]}
      onPress={() => onPress(task)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {task.title}
        </Text>
        {hasAIResult && (
          <View style={[styles.aiBadge, { backgroundColor: colors.success + '20' }]}>
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
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  aiBadge: {
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

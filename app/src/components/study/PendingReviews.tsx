/**
 * PendingReviews
 *
 * Shows tasks due for SM-2 review from useReviewStore.dueReviews.
 * Does NOT modify the SM-2 logic — that lives in ReviewDetailScreen.
 * This component is purely a visual summary widget with a navigation shortcut.
 *
 * Design decisions:
 *  - Loads on mount; re-loads if the user returns while the list is empty.
 *  - No skeleton: show a compact loading line instead (1 line; not a full skeleton panel).
 *  - Zero state: EmptyStateView-style inline notice.
 *  - Each row is tappable → navigates to the review detail.
 *  - Shows at most MAX_PREVIEW rows; a "Show all (n)" button opens the full list.
 */

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useReviewStore } from '../../store/useReviewStore';
import { AnimatedPressable } from '../AnimatedPressable';
import { MilestoneBadge } from '../brand';
import { touchTarget, shadows } from '../../theme';
import { IconBrain } from '../icons';
import type { AcademicTask } from '../../types';

const MAX_PREVIEW = 3;

interface PendingReviewsProps {
  onReviewPress: (task: AcademicTask) => void;
}

export function PendingReviews({ onReviewPress }: PendingReviewsProps) {
  const { colors, borderRadius, isDark } = useTheme();
  const { dueReviews, isLoading, loadDueReviews } = useReviewStore();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadDueReviews();
  }, [loadDueReviews]);

  const count = dueReviews.length;
  const visible = expanded ? dueReviews : dueReviews.slice(0, MAX_PREVIEW);
  const hasMore = count > MAX_PREVIEW && !expanded;

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: borderRadius.lg,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <IconBrain size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>Pending Reviews</Text>
        </View>
        {count > 0 && !isLoading && (
          <MilestoneBadge
            variant={count >= 5 ? 'error' : 'amber'}
            size="sm"
            label={`${count} due`}
          />
        )}
        {count === 0 && !isLoading && (
          <MilestoneBadge variant="success" size="sm" label="All caught up" />
        )}
      </View>

      {/* Loading state */}
      {isLoading && (
        <Text style={[styles.loadingText, { color: colors.textTertiary }]}>
          Loading reviews…
        </Text>
      )}

      {/* Empty state */}
      {!isLoading && count === 0 && (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No reviews due right now. Keep up the good work!
        </Text>
      )}

      {/* Review list */}
      {!isLoading && visible.map((task, index) => (
        <ReviewRow
          key={task.id}
          task={task}
          onPress={onReviewPress}
          colors={colors}
          borderRadius={borderRadius}
          isDark={isDark}
          hasDivider={index < visible.length - 1 || hasMore}
        />
      ))}

      {/* Show all */}
      {hasMore && (
        <AnimatedPressable
          style={[
            styles.showAllButton,
            {
              backgroundColor: isDark ? colors.surfaceVariant : colors.inkMuted,
              borderColor: colors.border,
              borderRadius: borderRadius.md,
              minHeight: touchTarget.min,
            },
          ]}
          onPress={() => setExpanded(true)}
          accessibilityRole="button"
          accessibilityLabel={`Show all ${count} pending reviews`}
        >
          <Text style={[styles.showAllText, { color: colors.primary }]}>
            Show all ({count})
          </Text>
        </AnimatedPressable>
      )}
    </View>
  );
}

// ─── ReviewRow ────────────────────────────────────────────────────────────────

type Colors = ReturnType<typeof useTheme>['colors'];
type BR = ReturnType<typeof useTheme>['borderRadius'];

interface ReviewRowProps {
  task: AcademicTask;
  onPress: (task: AcademicTask) => void;
  colors: Colors;
  borderRadius: BR;
  isDark: boolean;
  hasDivider: boolean;
}

function ReviewRow({ task, onPress, colors, borderRadius, isDark, hasDivider }: ReviewRowProps) {
  const subjectColor = isDark ? colors.primary : colors.secondary;

  return (
    <AnimatedPressable
      style={[
        styles.reviewRow,
        hasDivider && { borderBottomWidth: 1, borderBottomColor: colors.border },
        {
          backgroundColor: isDark ? colors.surfaceVariant : colors.background,
          borderRadius: borderRadius.md,
        },
      ]}
      onPress={() => onPress(task)}
      accessibilityRole="button"
      accessibilityLabel={`Review: ${task.title}${task.subject ? `, ${task.subject}` : ''}`}
    >
      {/* Priority indicator */}
      <View
        style={[
          styles.priorityDot,
          {
            backgroundColor:
              task.priority === 'urgent'
                ? colors.error
                : task.priority === 'high'
                ? colors.warning
                : colors.primary,
          },
        ]}
      />

      <View style={styles.reviewRowContent}>
        <Text style={[styles.reviewTitle, { color: colors.text }]} numberOfLines={1}>
          {task.title}
        </Text>
        {task.subject && (
          <Text style={[styles.reviewSubject, { color: subjectColor }]} numberOfLines={1}>
            {task.subject}
          </Text>
        )}
        {task.key_ideas && task.key_ideas.length > 0 && (
          <Text style={[styles.reviewMeta, { color: colors.textTertiary }]}>
            {task.key_ideas.length} key idea{task.key_ideas.length !== 1 ? 's' : ''}
          </Text>
        )}
      </View>

      <Text style={[styles.chevron, { color: colors.textTertiary }]}>›</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  loadingText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  reviewRowContent: {
    flex: 1,
    gap: 2,
  },
  reviewTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  reviewSubject: {
    fontSize: 12,
    fontWeight: '500',
  },
  reviewMeta: {
    fontSize: 11,
  },
  chevron: {
    fontSize: 20,
    fontWeight: '300',
  },
  showAllButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginTop: 2,
    paddingVertical: 10,
  },
  showAllText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

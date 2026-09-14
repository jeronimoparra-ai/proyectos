import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../hooks';
import { useReviewStore } from '../store/useReviewStore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ReviewDetail'>;

const QUALITY_OPTIONS = [
  { value: 0, label: 'Complete blackout', color: '#FF3B30' },
  { value: 1, label: 'Incorrect, remembered', color: '#FF9500' },
  { value: 2, label: 'Incorrect, seemed easy', color: '#FFCC00' },
  { value: 3, label: 'Correct with difficulty', color: '#34C759' },
  { value: 4, label: 'Correct with hesitation', color: '#007AFF' },
  { value: 5, label: 'Perfect recall', color: '#5856D6' },
];

export function ReviewDetailScreen({ navigation, route }: Props) {
  const { taskId } = route.params;
  const { colors, borderRadius } = useTheme();
  const {
    dueReviews,
    reviewHistory,
    isLoading,
    isSubmitting,
    loadDueReviews,
    loadReviewHistory,
    submitReview,
  } = useReviewStore();
  const [selectedQuality, setSelectedQuality] = useState<number | null>(null);

  const currentTask = dueReviews.find((t) => t.id === taskId);

  useEffect(() => {
    loadDueReviews(20);
    loadReviewHistory(taskId);
  }, [taskId]);

  const handleSubmit = async () => {
    if (selectedQuality === null) return;

    try {
      await submitReview({
        academic_task_id: taskId,
        quality: selectedQuality,
        time_spent_seconds: 60,
      });
      setSelectedQuality(null);
      loadDueReviews(20);
      loadReviewHistory(taskId);
      if (dueReviews.length > 0) {
        const nextTask = dueReviews.find((t) => t.id !== taskId);
        if (nextTask) {
          navigation.replace('ReviewDetail', { taskId: nextTask.id });
        }
      }
    } catch (error) {
      console.error('Error submitting review:', error);
    }
  };

  if (isLoading || !currentTask) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backButton, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Review</Text>
        <Text style={[styles.remaining, { color: colors.textTertiary }]}>
          {dueReviews.length} remaining
        </Text>
      </View>

      <View style={styles.content}>
        <View style={[styles.taskCard, { backgroundColor: colors.surface, borderRadius: borderRadius.lg }]}>
          {currentTask.subject && (
            <Text style={[styles.subject, { color: colors.primary }]}>{currentTask.subject}</Text>
          )}
          <Text style={[styles.title, { color: colors.text }]}>{currentTask.title}</Text>
          {currentTask.content && (
            <Text style={[styles.taskContent, { color: colors.textSecondary }]} numberOfLines={5}>
              {currentTask.content}
            </Text>
          )}
          {currentTask.summary && (
            <View style={styles.summaryContainer}>
              <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>AI Summary:</Text>
              <Text style={[styles.summary, { color: colors.textSecondary }]} numberOfLines={5}>
                {currentTask.summary}
              </Text>
            </View>
          )}
          {currentTask.key_ideas && currentTask.key_ideas.length > 0 && (
            <View style={styles.ideasContainer}>
              <Text style={[styles.ideasLabel, { color: colors.textTertiary }]}>Key Ideas:</Text>
              {currentTask.key_ideas.slice(0, 3).map((idea, index) => (
                <Text key={index} style={[styles.idea, { color: colors.textSecondary }]}>
                  • {idea}
                </Text>
              ))}
            </View>
          )}
        </View>

        <Text style={[styles.questionLabel, { color: colors.text }]}>
          How well did you remember this?
        </Text>

        <View style={styles.qualityContainer}>
          {QUALITY_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.qualityOption,
                {
                  backgroundColor:
                    selectedQuality === option.value ? option.color + '20' : colors.surface,
                  borderColor: selectedQuality === option.value ? option.color : colors.border,
                  borderRadius: borderRadius.md,
                },
              ]}
              onPress={() => setSelectedQuality(option.value)}
            >
              <View style={[styles.qualityDot, { backgroundColor: option.color }]} />
              <Text
                style={[
                  styles.qualityLabel,
                  {
                    color: selectedQuality === option.value ? option.color : colors.text,
                  },
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[
            styles.submitButton,
            {
              backgroundColor: selectedQuality !== null ? colors.primary : colors.surfaceVariant,
              borderRadius: borderRadius.md,
            },
          ]}
          onPress={handleSubmit}
          disabled={selectedQuality === null || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text
              style={[
                styles.submitText,
                { color: selectedQuality !== null ? '#fff' : colors.textTertiary },
              ]}
            >
              Submit Review
            </Text>
          )}
        </TouchableOpacity>

        {reviewHistory.length > 0 && (
          <View style={styles.historySection}>
            <Text style={[styles.historyTitle, { color: colors.text }]}>Review History</Text>
            {reviewHistory.slice(0, 5).map((review) => (
              <View
                key={review.id}
                style={[styles.historyItem, { borderBottomColor: colors.border }]}
              >
                <View style={styles.historyRow}>
                  <Text style={[styles.historyQuality, { color: colors.text }]}>
                    Quality: {review.quality}/5
                  </Text>
                  <Text style={[styles.historyDate, { color: colors.textTertiary }]}>
                    {new Date(review.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={[styles.historyInterval, { color: colors.textSecondary }]}>
                  Interval: {review.interval} days | Ease: {review.ease_factor}
                </Text>
              </View>
            ))}
          </View>
        )}
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
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    fontSize: 16,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  remaining: {
    fontSize: 14,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  taskCard: {
    padding: 16,
    gap: 12,
  },
  subject: {
    fontSize: 14,
    fontWeight: '500',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  taskContent: {
    fontSize: 14,
    lineHeight: 22,
  },
  summaryContainer: {
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  summary: {
    fontSize: 14,
    lineHeight: 20,
  },
  ideasContainer: {
    marginTop: 8,
  },
  ideasLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  idea: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  questionLabel: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  qualityContainer: {
    gap: 8,
  },
  qualityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    gap: 12,
  },
  qualityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  qualityLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  submitButton: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    fontSize: 16,
    fontWeight: '600',
  },
  historySection: {
    marginTop: 8,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  historyItem: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  historyQuality: {
    fontSize: 14,
    fontWeight: '500',
  },
  historyDate: {
    fontSize: 13,
  },
  historyInterval: {
    fontSize: 13,
  },
});

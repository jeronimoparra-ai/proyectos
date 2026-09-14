import { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';
import { useReviewStore } from '../store/useReviewStore';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type HomeNavProp = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen() {
  const navigation = useNavigation<HomeNavProp>();
  const { colors, borderRadius } = useTheme();
  const {
    dueReviews,
    reviewStats,
    feedback,
    recommendations,
    loadDueReviews,
    loadReviewStats,
    loadFeedback,
    loadRecommendations,
  } = useReviewStore();

  useEffect(() => {
    loadDueReviews(5);
    loadReviewStats();
    loadFeedback();
    loadRecommendations();
  }, []);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.greeting, { color: colors.text }]}>Welcome back!</Text>
      </View>

      {reviewStats && (
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderRadius: borderRadius.lg }]}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{reviewStats.totalTasks}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Tasks</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderRadius: borderRadius.lg }]}>
            <Text style={[styles.statValue, { color: colors.warning }]}>{reviewStats.dueToday}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Due Today</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderRadius: borderRadius.lg }]}>
            <Text style={[styles.statValue, { color: colors.success }]}>{reviewStats.totalReviews}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Reviews</Text>
          </View>
        </View>
      )}

      {dueReviews.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.surface, borderRadius: borderRadius.lg }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Reviews Due</Text>
          {dueReviews.slice(0, 3).map((task) => (
            <TouchableOpacity
              key={task.id}
              style={[styles.reviewItem, { borderBottomColor: colors.border }]}
              onPress={() => navigation.navigate('ReviewDetail', { taskId: task.id })}
            >
              <View style={styles.reviewContent}>
                <Text style={[styles.reviewTitle, { color: colors.text }]} numberOfLines={1}>
                  {task.title}
                </Text>
                {task.subject && (
                  <Text style={[styles.reviewSubject, { color: colors.primary }]}>{task.subject}</Text>
                )}
              </View>
              <Text style={[styles.reviewArrow, { color: colors.primary }]}>→</Text>
            </TouchableOpacity>
          ))}
          {dueReviews.length > 3 && (
            <Text style={[styles.moreText, { color: colors.primary }]}>
              +{dueReviews.length - 3} more
            </Text>
          )}
        </View>
      )}

      {feedback && (
        <View style={[styles.section, { backgroundColor: colors.surface, borderRadius: borderRadius.lg }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Weekly Summary</Text>
          <View style={styles.feedbackRow}>
            <View style={styles.feedbackItem}>
              <Text style={[styles.feedbackValue, { color: colors.success }]}>{feedback.tasksCompleted}</Text>
              <Text style={[styles.feedbackLabel, { color: colors.textSecondary }]}>Completed</Text>
            </View>
            <View style={styles.feedbackItem}>
              <Text style={[styles.feedbackValue, { color: colors.warning }]}>{feedback.tasksPending}</Text>
              <Text style={[styles.feedbackLabel, { color: colors.textSecondary }]}>Pending</Text>
            </View>
            <View style={styles.feedbackItem}>
              <Text style={[styles.feedbackValue, { color: colors.error }]}>{feedback.tasksOverdue}</Text>
              <Text style={[styles.feedbackLabel, { color: colors.textSecondary }]}>Overdue</Text>
            </View>
            <View style={styles.feedbackItem}>
              <Text style={[styles.feedbackValue, { color: colors.primary }]}>{feedback.studyHours}h</Text>
              <Text style={[styles.feedbackLabel, { color: colors.textSecondary }]}>Study</Text>
            </View>
          </View>
        </View>
      )}

      {recommendations.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.surface, borderRadius: borderRadius.lg }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recommendations</Text>
          {recommendations.slice(0, 3).map((rec, index) => (
            <View key={index} style={[styles.recItem, { borderBottomColor: colors.border }]}>
              <Text style={[styles.recBullet, { color: colors.primary }]}>•</Text>
              <Text style={[styles.recText, { color: colors.textSecondary }]}>{rec}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  reviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  reviewContent: {
    flex: 1,
    gap: 4,
  },
  reviewTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  reviewSubject: {
    fontSize: 12,
  },
  reviewArrow: {
    fontSize: 16,
    fontWeight: '500',
  },
  moreText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  feedbackRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  feedbackItem: {
    alignItems: 'center',
    gap: 4,
  },
  feedbackValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  feedbackLabel: {
    fontSize: 11,
  },
  recItem: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    gap: 8,
  },
  recBullet: {
    fontSize: 16,
    fontWeight: '700',
  },
  recText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
});

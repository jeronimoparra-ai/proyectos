import { supabase } from '../../database/supabase';
import { createAppError } from '../../middleware/error.middleware';
import { aiService } from '../ai/ai.service';

interface FeedbackData {
  tasksCompleted: number;
  tasksPending: number;
  tasksOverdue: number;
  studyHours: number;
  topicsStudied: string[];
  recentActivity: string[];
  recommendations: string[];
}

export class FeedbackService {
  async getWeeklyFeedback(userId: string): Promise<FeedbackData> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const { data: completedTasks } = await supabase
      .from('tasks')
      .select('id, title, completed_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('updated_at', weekAgo.toISOString());

    const { data: pendingTasks } = await supabase
      .from('tasks')
      .select('id, title')
      .eq('user_id', userId)
      .in('status', ['pending', 'in_progress'])
      .is('deleted_at', null);

    const today = now.toISOString().split('T')[0];
    const { data: overdueTasks } = await supabase
      .from('tasks')
      .select('id, title')
      .eq('user_id', userId)
      .neq('status', 'completed')
      .neq('status', 'cancelled')
      .lt('due_date', today)
      .is('deleted_at', null);

    const { data: academicTasks } = await supabase
      .from('academic_tasks')
      .select('subject, topics (*)')
      .eq('user_id', userId)
      .gte('created_at', weekAgo.toISOString())
      .is('deleted_at', null);

    const topicsStudied = new Set<string>();
    (academicTasks ?? []).forEach((task) => {
      if (task.subject) topicsStudied.add(task.subject);
      task.topics?.forEach((topic) => topicsStudied.add(topic.name));
    });

    const { data: reviews } = await supabase
      .from('reviews')
      .select('time_spent_seconds, created_at')
      .eq('user_id', userId)
      .gte('created_at', weekAgo.toISOString());

    const totalSeconds = (reviews ?? []).reduce(
      (sum, r) => sum + (r.time_spent_seconds ?? 0),
      0
    );
    const studyHours = Math.round((totalSeconds / 3600) * 10) / 10;

    const feedback: FeedbackData = {
      tasksCompleted: completedTasks?.length ?? 0,
      tasksPending: pendingTasks?.length ?? 0,
      tasksOverdue: overdueTasks?.length ?? 0,
      studyHours,
      topicsStudied: Array.from(topicsStudied),
      recentActivity: (completedTasks ?? []).slice(0, 5).map((t) => `Completed: ${t.title}`),
      recommendations: [],
    };

    if (feedback.tasksOverdue > 0) {
      feedback.recommendations.push(
        `You have ${feedback.tasksOverdue} overdue task${feedback.tasksOverdue > 1 ? 's' : ''}. Consider prioritizing them.`
      );
    }

    if (feedback.tasksCompleted > 5) {
      feedback.recommendations.push(
        `Great job! You completed ${feedback.tasksCompleted} tasks this week.`
      );
    }

    if (feedback.studyHours > 0) {
      feedback.recommendations.push(
        `You studied for ${feedback.studyHours} hours this week. Keep it up!`
      );
    }

    return feedback;
  }

  async getAIRecommendations(userId: string): Promise<string[]> {
    const feedback = await this.getWeeklyFeedback(userId);

    if (feedback.topicsStudied.length === 0 && feedback.tasksCompleted === 0) {
      return ['Start by creating some tasks or academic content to track your progress.'];
    }

    const prompt = `Based on this student's weekly data, provide 3 brief, actionable recommendations:
- Tasks completed: ${feedback.tasksCompleted}
- Tasks pending: ${feedback.tasksPending}
- Overdue tasks: ${feedback.tasksOverdue}
- Study hours: ${feedback.studyHours}
- Topics studied: ${feedback.topicsStudied.join(', ') || 'None'}

Provide recommendations as a JSON array of strings:
["recommendation 1", "recommendation 2", "recommendation 3"]`;

    try {
      const response = await aiService.explainConcept(
        'weekly study recommendations',
        prompt
      );

      const cleaned = response.explanation.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleaned) as string[];
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Fallback to basic recommendations
    }

    const recommendations: string[] = [];

    if (feedback.tasksOverdue > 0) {
      recommendations.push(`Focus on completing your ${feedback.tasksOverdue} overdue tasks first.`);
    }

    if (feedback.topicsStudied.length > 0) {
      recommendations.push(
        `Continue reviewing: ${feedback.topicsStudied.slice(0, 3).join(', ')}.`
      );
    }

    if (feedback.studyHours < 5) {
      recommendations.push('Try to study a bit more each day for better retention.');
    }

    return recommendations.length > 0
      ? recommendations
      : ['Keep up your current study routine!'];
  }
}

export const feedbackService = new FeedbackService();

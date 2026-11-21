import { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';
import { useReviewStore } from '../store/useReviewStore';
import { useAuthStore } from '../store/useAuthStore';
import { taskService } from '../services/task';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { ScreenSkeleton } from '../components/Skeleton';
import { QuickActionStrip } from '../components/brand';
import { spacing, typography, touchTarget } from '../theme';
import type { Task } from '../types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

// Three entries keep each dashboard section scannable; the full list stays one tap away.
const PREVIEW_LIMIT = 3;
const MORNING_END = 12;
const AFTERNOON_END = 18;

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors, borderRadius, insets } = useTheme();
  const userId = useAuthStore(state => state.user?.id);
  const { dueReviews, reviewStats, feedback, recommendations, error: reviewError,
    loadDueReviews, loadReviewStats, loadFeedback, loadRecommendations } = useReviewStore();
  const [summary, setSummary] = useState<{ total: number; completed: number; today: Task[]; upcoming: Task[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const generation = ++request.current;
    setLoading(true);
    setError(false);
    // Local calendar date avoids moving deadlines to the previous day in Colombia.
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const summaryRequest = async () => {
      try {
        const [all, completed, pending, ongoing, postponed, upcoming] = await Promise.all([
          taskService.list({ limit: 1 }), taskService.list({ status: 'completed', limit: 1 }),
          taskService.list({ status: 'pending', due_before: today, limit: PREVIEW_LIMIT }),
          taskService.list({ status: 'in_progress', due_before: today, limit: PREVIEW_LIMIT }),
          taskService.list({ status: 'postponed', due_before: today, limit: PREVIEW_LIMIT }),
          taskService.getUpcoming(),
        ]);
        if (generation !== request.current || userId !== useAuthStore.getState().user?.id) return;
        setSummary({ total: all.total, completed: completed.total,
          today: [...pending.tasks, ...ongoing.tasks, ...postponed.tasks].sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? '')),
          upcoming: upcoming.filter(task => task.status !== 'completed' && task.status !== 'cancelled' && (task.due_date ?? '').slice(0, 10) > today)
            .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? '')) });
      } catch {
        if (generation === request.current) setError(true);
      }
    };
    await Promise.all([summaryRequest(), loadDueReviews(), loadReviewStats(), loadFeedback(), loadRecommendations()]);
    if (generation === request.current) setLoading(false);
  }, [userId, loadDueReviews, loadReviewStats, loadFeedback, loadRecommendations]);
  useFocusEffect(useCallback(() => {
    setSummary(null);
    void refresh();
    return () => { request.current++; };
  }, [refresh]));

  const hour = new Date().getHours();
  const greeting = hour < MORNING_END ? 'Buenos días' : hour < AFTERNOON_END ? 'Buenas tardes' : 'Buenas noches';
  const panel = [styles.panel, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: borderRadius.lg }];
  const heading = [styles.heading, { color: colors.text }];
  const body = { color: colors.textSecondary };
  const openTasks = () => navigation.navigate('Main', { screen: 'Tasks' });
  const renderTasks = (tasks: Task[]) => tasks.slice(0, PREVIEW_LIMIT).map(task => (
    <AnimatedPressable key={task.id} style={[styles.row, { borderBottomColor: colors.border }]} onPress={() => navigation.navigate('TaskDetail', { taskId: task.id })} accessibilityLabel={`Abrir tarea: ${task.title}`}>
      <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={2}>{task.title}</Text>
      <Text style={body}>{task.due_date?.slice(0, 10)} · Ver tarea ›</Text>
    </AnimatedPressable>
  ));
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl }} refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}>
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>STUDIA · TU JORNADA</Text>
        <Text style={[styles.title, { color: colors.text }]}>{greeting}</Text>
        <Text style={body}>{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
      </View>
      {loading && !summary ? <ScreenSkeleton count={PREVIEW_LIMIT} /> : (
        <View style={panel}>
          <Text style={heading}>¿Qué tengo que hacer hoy?</Text>
          {error ? <Text style={body}>No pudimos actualizar tu jornada. Desliza hacia abajo para reintentar.</Text> : summary?.total === 0 && !reviewStats?.totalTasks ? (
            <><Text style={heading}>Tu primer paso empieza aquí</Text><Text style={body}>Crea una tarea con fecha para organizar tu día. Añade material de estudio para programar tus repasos.</Text></>
          ) : summary && summary.total > 0 && summary.completed === summary.total && !dueReviews.length && !reviewError ? (
            <><Text style={[styles.heading, { color: colors.success }]}>Todo completado. Bien hecho.</Text><Text style={body}>Has terminado tus tareas y repasos pendientes. Puedes descansar o preparar tu siguiente objetivo.</Text></>
          ) : summary?.today.length ? renderTasks(summary.today) : (
            <Text style={body}>{dueReviews.length ? 'Hoy puedes avanzar con tus repasos pendientes.' : 'No tienes tareas con vencimiento para hoy. Elige tu siguiente paso.'}</Text>
          )}
          <AnimatedPressable style={[styles.action, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]} onPress={summary?.total ? openTasks : () => navigation.navigate('TaskForm', {})}>
            <Text style={{ color: colors.inkMuted, fontWeight: '700' }}>{summary?.total ? 'Ver mis tareas' : 'Crear mi primera tarea'}</Text>
          </AnimatedPressable>
        </View>
      )}
      <Text style={[heading, styles.sectionTitle]}>Acciones rápidas</Text>
      <QuickActionStrip onCreateTask={() => navigation.navigate('TaskForm', {})} onCreateAcademic={() => navigation.navigate('AcademicTaskForm', {})} onCreateEvent={() => navigation.navigate('EventForm', {})} />
      {summary && <View style={panel}>
        <Text style={heading}>Resumen de progreso</Text>
        <Text style={{ color: colors.success }}>{summary.completed} de {summary.total} tareas completadas</Text>
        {feedback && <Text style={body}>{feedback.studyHours} h de estudio · {feedback.tasksCompleted} actividades completadas esta semana</Text>}
        {reviewStats && <Text style={body}>{reviewStats.totalReviews} repasos realizados</Text>}
      </View>}
      <View style={panel}>
        <Text style={heading}>Próximos vencimientos</Text>
        {summary?.upcoming.length ? renderTasks(summary.upcoming) : <Text style={body}>{error ? 'Vencimientos no disponibles.' : loading ? 'Consultando vencimientos…' : 'Sin vencimientos en los próximos siete días.'}</Text>}
      </View>
      <View style={panel}>
        <Text style={heading}>Repasos pendientes</Text>
        {reviewError && <Text accessibilityRole="alert" style={body}>No pudimos actualizar los repasos. Desliza para reintentar.</Text>}
        {!dueReviews.length && !reviewError && <Text style={body}>{loading ? 'Consultando repasos…' : 'Tus repasos están al día.'}</Text>}
        {dueReviews.slice(0, PREVIEW_LIMIT).map(task => <AnimatedPressable key={task.id} style={styles.row} onPress={() => navigation.navigate('ReviewDetail', { taskId: task.id })} accessibilityLabel={`Repasar ${task.title}`}>
          <Text style={[styles.rowTitle, { color: colors.text }]}>{task.title}</Text><Text style={{ color: colors.accent }}>{task.subject || 'Sin materia'} · Repasar ›</Text>
        </AnimatedPressable>)}
        <AnimatedPressable style={styles.action} onPress={() => navigation.navigate('Main', { screen: 'Academic' })}><Text style={{ color: colors.primary }}>Ir a Académico ›</Text></AnimatedPressable>
      </View>
      {!!recommendations.length && <View style={panel}><Text style={heading}>Sugerencias de estudio</Text>{recommendations.slice(0, PREVIEW_LIMIT).map((text, index) => <Text key={index} style={body}>{text}</Text>)}</View>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.xl },
  eyebrow: { fontSize: typography.sizes.xs, fontWeight: '700' },
  title: { fontSize: typography.sizes['3xl'], fontWeight: '700' },
  heading: { fontSize: typography.sizes.lg, fontWeight: '700' },
  sectionTitle: { marginHorizontal: spacing.lg },
  panel: { marginHorizontal: spacing.lg, marginBottom: spacing.lg, padding: spacing.lg, gap: spacing.md, borderWidth: StyleSheet.hairlineWidth },
  row: { minHeight: touchTarget.comfortable, paddingVertical: spacing.sm, gap: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  rowTitle: { fontSize: typography.sizes.md, fontWeight: '600' },
  action: { minHeight: touchTarget.comfortable, justifyContent: 'center', alignItems: 'center', padding: spacing.sm },
});

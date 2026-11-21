import { useCallback, useRef, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../hooks';
import { useSharedTimer } from '../hooks/useSharedTimer';
import { useAcademicTaskStore } from '../store/useAcademicTaskStore';
import { useReviewStore } from '../store/useReviewStore';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { ScreenSkeleton } from '../components/Skeleton';
import { spacing, typography, touchTarget } from '../theme';
import type { TabScreenProps } from '../navigation/types';

const SECTIONS = ['Académico', 'Materias', 'Repasos'] as const;
// Duration conversion for the existing local focus timer (not persisted study statistics).
const SECOND_MS = 1000;
const MINUTE_SECONDS = 60;

export function AcademicScreen({ navigation }: TabScreenProps<'Academic'>) {
  const { colors, borderRadius, insets } = useTheme();
  const { tasks, total, isLoading, error, filters, setFilters, loadTasks } = useAcademicTaskStore();
  const { dueReviews, isLoading: reviewsLoading, error: reviewError, loadDueReviews } = useReviewStore();
  const [section, setSection] = useState<typeof SECTIONS[number]>('Académico');
  const [subject, setSubject] = useState<string | null>(null);
  const [reviewSearch, setReviewSearch] = useState('');
  const [running, setRunning] = useState(false);
  const [accumulated, setAccumulated] = useState(0);
  const startedAt = useRef(0);
  useSharedTimer('second');
  const elapsed = accumulated + (running ? Math.floor((Date.now() - startedAt.current) / SECOND_MS) : 0);
  const duration = `${Math.floor(elapsed / MINUTE_SECONDS)}:${String(elapsed % MINUTE_SECONDS).padStart(2, '0')}`;
  useFocusEffect(useCallback(() => { void loadTasks(); void loadDueReviews(); }, [loadTasks, loadDueReviews]));

  const subjects = [...new Set(tasks.map(task => task.subject || 'Sin materia'))].sort((a, b) => a.localeCompare(b, 'es'));
  const isReviews = section === 'Repasos';
  const data = isReviews ? dueReviews.filter(task => `${task.title} ${task.subject ?? ''}`.toLocaleLowerCase('es').includes(reviewSearch.toLocaleLowerCase('es')))
    : section === 'Materias' && subject ? tasks.filter(task => (task.subject || 'Sin materia') === subject) : tasks;
  const loading = isReviews ? reviewsLoading : isLoading;
  const failure = isReviews ? reviewError : error;
  const refresh = () => { if (isReviews) void loadDueReviews(); else void loadTasks(); };
  const card = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: borderRadius.lg }];
  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + spacing.lg }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Académico</Text>
        <AnimatedPressable style={[styles.button, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]} onPress={() => navigation.navigate('AcademicTaskForm', {})} accessibilityLabel="Crear tarea académica">
          <Text style={{ color: colors.inkMuted, fontWeight: '700' }}>+ Crear</Text>
        </AnimatedPressable>
      </View>
      <View style={styles.tabs}>
        {SECTIONS.map(label => <AnimatedPressable key={label} containerStyle={{ flex: 1 }} style={[styles.button, { borderRadius: borderRadius.md, backgroundColor: section === label ? colors.primary : colors.surfaceVariant }]} onPress={() => setSection(label)} accessibilityRole="tab" accessibilityState={{ selected: section === label }}>
          <Text style={{ color: section === label ? colors.inkMuted : colors.textSecondary }}>{label}</Text>
        </AnimatedPressable>)}
      </View>
      <TextInput style={[styles.search, { color: colors.text, backgroundColor: colors.surfaceVariant, borderRadius: borderRadius.md }]} placeholder={isReviews ? 'Buscar repasos…' : 'Buscar material de estudio…'} placeholderTextColor={colors.textSecondary} accessibilityLabel={isReviews ? 'Buscar repasos' : 'Buscar material de estudio'} value={isReviews ? reviewSearch : filters.search ?? ''} onChangeText={text => { if (isReviews) setReviewSearch(text); else setFilters({ ...filters, search: text || undefined }); }} />
      {loading && !data.length ? <ScreenSkeleton count={3} /> : <FlatList
        data={section === 'Materias' && !subject ? [] : data}
        keyExtractor={item => item.id} refreshing={loading} onRefresh={refresh} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
        ListHeaderComponent={<>
          {section === 'Académico' && <View style={card}>
            <Text style={[styles.heading, { color: colors.text }]}>Sesión de concentración</Text>
            <Text accessibilityRole="timer" style={[styles.title, { color: colors.primary }]}>{duration}</Text>
            <Text style={{ color: colors.textSecondary }}>{running ? 'En marcha' : accumulated ? 'En pausa' : 'Elige un tema y empieza a estudiar'}</Text>
            <View style={styles.tabs}>
              <AnimatedPressable style={styles.button} onPress={() => { if (running) { setAccumulated(elapsed); setRunning(false); } else { startedAt.current = Date.now(); setRunning(true); } }}><Text style={{ color: colors.primary }}>{running ? 'Pausar' : accumulated ? 'Continuar' : 'Empezar'}</Text></AnimatedPressable>
              {(running || accumulated > 0) && <AnimatedPressable style={styles.button} onPress={() => { setRunning(false); setAccumulated(0); startedAt.current = 0; }}><Text style={{ color: colors.error }}>Terminar</Text></AnimatedPressable>}
            </View>
          </View>}
          {!!failure && <View style={card}><Text accessibilityRole="alert" style={{ color: colors.error }}>No se pudo actualizar esta sección.</Text><AnimatedPressable style={styles.button} onPress={refresh}><Text style={{ color: colors.primary }}>Reintentar</Text></AnimatedPressable></View>}
          {section === 'Materias' && <View style={card}>
            <Text style={[styles.heading, { color: colors.text }]}>{subject || 'Tus materias'}</Text>
            <Text style={{ color: colors.textSecondary }}>Materias del material cargado ({tasks.length} de {total}). Usa el buscador para encontrar más material.</Text>
            {subject ? <AnimatedPressable style={styles.button} onPress={() => setSubject(null)}><Text style={{ color: colors.primary }}>← Ver materias</Text></AnimatedPressable> : subjects.map(name => <AnimatedPressable key={name} style={styles.subject} onPress={() => setSubject(name)}><Text style={{ color: colors.text }}>{name}</Text><Text style={{ color: colors.primary }}>{tasks.filter(task => (task.subject || 'Sin materia') === name).length} temas ›</Text></AnimatedPressable>)}
          </View>}
          {isReviews && <Text style={[styles.caption, { color: colors.textSecondary }]}>Repasos programados para reforzar lo aprendido.</Text>}
        </>}
        renderItem={({ item }) => <AnimatedPressable style={card} onPress={() => navigation.navigate(isReviews ? 'ReviewDetail' : 'AcademicTaskDetail', { taskId: item.id })} accessibilityLabel={`${isReviews ? 'Repasar' : 'Abrir'} ${item.title}`}>
          <Text style={[styles.heading, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
          <Text style={{ color: colors.primary }}>{item.subject || 'Sin materia'}</Text>
          {!!item.summary && <Text numberOfLines={2} style={{ color: colors.textSecondary }}>{item.summary}</Text>}
          <Text style={{ color: isReviews ? colors.accent : colors.textSecondary }}>{isReviews ? 'Empezar repaso ›' : `${item.key_ideas?.length ?? 0} ideas clave · ${item.materials?.length ?? 0} materiales`}</Text>
        </AnimatedPressable>}
        ListEmptyComponent={!(section === 'Materias' && !subject && subjects.length) && !failure ? <View style={card}>
          <Text style={[styles.heading, { color: colors.text }]}>{isReviews ? (reviewSearch ? 'Sin coincidencias' : 'Repasos al día') : 'Sin material en esta vista'}</Text>
          <Text style={{ color: colors.textSecondary }}>{isReviews ? 'Prueba otra búsqueda o vuelve cuando tengas nuevos repasos.' : 'Prueba otra búsqueda o crea una tarea académica con su materia.'}</Text>
        </View> : null}
      />}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  title: { fontSize: typography.sizes['3xl'], fontWeight: '700' },
  heading: { fontSize: typography.sizes.md, fontWeight: '600' },
  tabs: { flexDirection: 'row', gap: spacing.sm, marginHorizontal: spacing.lg, marginBottom: spacing.md },
  button: { minHeight: touchTarget.min, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.md },
  search: { minHeight: touchTarget.comfortable, marginHorizontal: spacing.lg, marginBottom: spacing.md, paddingHorizontal: spacing.md, fontSize: typography.sizes.md },
  card: { marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.lg, gap: spacing.sm, borderWidth: StyleSheet.hairlineWidth },
  subject: { minHeight: touchTarget.comfortable, justifyContent: 'center', gap: spacing.xs },
  caption: { marginHorizontal: spacing.lg, marginBottom: spacing.md },
});

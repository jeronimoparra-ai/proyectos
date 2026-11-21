import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../hooks';
import { useTaskStore } from '../store/useTaskStore';
import DateTimePicker from '@react-native-community/datetimepicker';
import { spacing, touchTarget, typography } from '../theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

// Matches createTaskSchema/updateTaskSchema on the backend.
const TITLE_MAX_LENGTH = 255;

type Props = NativeStackScreenProps<RootStackParamList, 'TaskForm'>;

function parseDateOrNull(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  // Parse date-only and time-only API values in local time, preserving the chosen day.
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? `${dateStr}T00:00:00` : /^\d{2}:\d{2}/.test(dateStr) ? `2000-01-01T${dateStr}` : dateStr;
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toTimeString(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function TaskFormScreen({ navigation, route }: Props) {
  const { taskId } = route.params ?? {};
  const { colors, borderRadius, insets } = useTheme();
  const { selectedTask, loadTask, createTask, updateTask, clearSelectedTask, error: loadError } = useTaskStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const titleInput = useRef<TextInput>(null);
  const savingRef = useRef(false);
  const [titleError, setTitleError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [dueTime, setDueTime] = useState<Date | null>(null);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');

  useEffect(() => {
    if (taskId) {
      setIsLoading(true);
      loadTask(taskId).finally(() => setIsLoading(false));
    }
    return () => clearSelectedTask();
  }, [taskId, loadTask, clearSelectedTask]);

  useEffect(() => {
    if (selectedTask && selectedTask.id === taskId) {
      setTitle(selectedTask.title);
      setDescription(selectedTask.description ?? '');
      setDueDate(parseDateOrNull(selectedTask.due_date));
      setDueTime(parseDateOrNull(selectedTask.due_time));
      setPriority(selectedTask.priority);
    }
  }, [selectedTask, taskId]);

  const handleSave = async () => {
    if (savingRef.current || (taskId && selectedTask?.id !== taskId)) return;
    if (!title.trim()) {
      setTitleError('Escribe un título para tu tarea.');
      titleInput.current?.focus();
      return;
    }

    if (title.trim().length > TITLE_MAX_LENGTH) {
      setTitleError(`Usa un máximo de ${TITLE_MAX_LENGTH} caracteres.`);
      titleInput.current?.focus();
      return;
    }
    savingRef.current = true;
    setSaveError('');
    setIsSaving(true);
    try {
      if (taskId) {
        await updateTask(taskId, {
          title: title.trim(),
          description: description.trim() || undefined,
          due_date: dueDate ? toDateString(dueDate) : undefined,
          due_time: dueTime ? toTimeString(dueTime) : undefined,
          priority,
        });
      } else {
        await createTask({
          title: title.trim(),
          description: description.trim() || undefined,
          due_date: dueDate ? toDateString(dueDate) : undefined,
          due_time: dueTime ? toTimeString(dueTime) : undefined,
          priority,
        });
      }
      navigation.goBack();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'No se pudo guardar. Inténtalo de nuevo.');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backButton, { color: colors.primary }]}>← Volver</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>
          {taskId ? 'Editar tarea' : 'Nueva tarea'}
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Título *</Text>
          <TextInput
            style={[styles.input, {
              backgroundColor: colors.surfaceVariant,
              color: colors.text,
              borderColor: titleError ? colors.error : colors.border,
              borderRadius: borderRadius.md,
            }]}
            ref={titleInput}
            value={title}
            onChangeText={value => { setTitle(value); if (value.trim()) setTitleError(''); }}
            editable={!isSaving}
            accessibilityLabel="Título obligatorio"
            returnKeyType="done"
            placeholder="¿Qué necesitas hacer?"
            placeholderTextColor={colors.textTertiary}
          />
          {!!titleError && <Text accessibilityRole="alert" style={{ color: colors.error }}>{titleError}</Text>}
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Descripción (opcional)</Text>
          <TextInput
            style={[styles.textArea, {
              backgroundColor: colors.surfaceVariant,
              color: colors.text,
              borderColor: colors.border,
              borderRadius: borderRadius.md,
            }]}
            value={description}
            editable={!isSaving}
            accessibilityLabel="Descripción opcional"
            onChangeText={setDescription}
            placeholder="Añade los detalles que necesites…"
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.row}>
          {(['date', 'time'] as const).map(mode => <View key={mode} style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{mode === 'date' ? 'Fecha límite' : 'Hora'}</Text>
            <TouchableOpacity disabled={isSaving} accessibilityRole="button" onPress={() => setPicker(mode)} style={[styles.dateButton, { backgroundColor: colors.surfaceVariant, borderRadius: borderRadius.md }]}>
              <Text style={{ color: colors.text }}>{mode === 'date' ? dueDate?.toLocaleDateString('es-ES') || 'Sin fecha' : dueTime?.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) || 'Sin hora'}</Text>
            </TouchableOpacity>
          </View>)}
        </View>
        {picker && <View>
          <DateTimePicker value={(picker === 'date' ? dueDate : dueTime) ?? new Date()} mode={picker} display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_event, date) => { if (date) { if (picker === 'date') setDueDate(date); else setDueTime(date); } if (Platform.OS !== 'ios') setPicker(null); }} />
          {Platform.OS === 'ios' && <TouchableOpacity accessibilityRole="button" style={styles.dateButton} onPress={() => setPicker(null)}><Text style={{ color: colors.primary }}>Listo</Text></TouchableOpacity>}
        </View>}

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Prioridad</Text>
          <View style={styles.priorityRow}>
            {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
              <TouchableOpacity
                key={p}
                style={[
                  styles.priorityChip,
                  {
                    backgroundColor: priority === p ? colors.primary : colors.surfaceVariant,
                    borderRadius: borderRadius.md,
                  },
                ]}
                onPress={() => setPriority(p)}
                disabled={isSaving}
                accessibilityRole="radio"
                accessibilityState={{ selected: priority === p }}
              >
                <Text
                  style={[
                    styles.priorityChipText,
                    { color: priority === p ? colors.inkMuted : colors.textSecondary },
                  ]}
                >
                  {({ low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' })[p]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {!!saveError && <Text accessibilityRole="alert" style={{ color: colors.error }}>{saveError}</Text>}
        {taskId && !selectedTask && !isLoading && <View>
          <Text accessibilityRole="alert" style={{ color: colors.error }}>{loadError || 'No se pudo cargar la tarea.'}</Text>
          <TouchableOpacity style={styles.dateButton} onPress={() => { setIsLoading(true); void loadTask(taskId).finally(() => setIsLoading(false)); }}><Text style={{ color: colors.primary }}>Reintentar</Text></TouchableOpacity>
        </View>}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ disabled: isSaving || !!taskId && selectedTask?.id !== taskId, busy: isSaving }}
          style={[styles.saveButton, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
          onPress={handleSave}
          disabled={isSaving || !!taskId && selectedTask?.id !== taskId}
        >
          {isSaving ? (
            <View style={styles.row}><ActivityIndicator color={colors.inkMuted} /><Text accessibilityLiveRegion="polite" style={{ color: colors.inkMuted }}>Guardando…</Text></View>
          ) : (
            <Text style={[styles.saveButtonText, { color: colors.inkMuted }]}>{taskId ? 'Guardar cambios' : 'Crear tarea'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  dateButton: { minHeight: touchTarget.comfortable, justifyContent: 'center', paddingHorizontal: spacing.md },
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  backButton: {
    fontSize: typography.sizes['md'],
    fontWeight: '500',
    marginBottom: spacing.sm,
    minHeight: touchTarget.min,
  },
  title: {
    fontSize: typography.sizes['3xl'],
    fontWeight: '700',
  },
  form: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    fontSize: typography.sizes['sm'],
    fontWeight: '500',
  },
  input: {
    minHeight: touchTarget.comfortable,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    fontSize: typography.sizes['md'],
  },
  textArea: {
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.sizes['md'],
    minHeight: touchTarget.comfortable * 2, // Two input rows keep optional notes compact.
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  priorityChip: {
    minHeight: touchTarget.min,
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  priorityChipText: {
    fontSize: typography.sizes['sm'],
    fontWeight: '600',
  },
  saveButton: {
    minHeight: touchTarget.comfortable,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: typography.sizes['md'],
    fontWeight: '600',
  },
});

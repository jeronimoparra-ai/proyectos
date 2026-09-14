import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../hooks';
import { useTaskStore } from '../store/useTaskStore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'TaskForm'>;

export function TaskFormScreen({ navigation, route }: Props) {
  const { taskId } = route.params ?? {};
  const { colors, borderRadius } = useTheme();
  const { selectedTask, loadTask, createTask, updateTask, clearSelectedTask } = useTaskStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');

  useEffect(() => {
    if (taskId) {
      setIsLoading(true);
      loadTask(taskId).finally(() => setIsLoading(false));
    }
    return () => clearSelectedTask();
  }, [taskId]);

  useEffect(() => {
    if (selectedTask && taskId) {
      setTitle(selectedTask.title);
      setDescription(selectedTask.description ?? '');
      setDueDate(selectedTask.due_date ?? '');
      setDueTime(selectedTask.due_time ?? '');
      setPriority(selectedTask.priority);
    }
  }, [selectedTask, taskId]);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Title is required');
      return;
    }

    setIsSaving(true);
    try {
      if (taskId) {
        await updateTask(taskId, {
          title: title.trim(),
          description: description.trim() || undefined,
          due_date: dueDate || undefined,
          due_time: dueTime || undefined,
          priority,
        });
      } else {
        await createTask({
          title: title.trim(),
          description: description.trim() || undefined,
          due_date: dueDate || undefined,
          due_time: dueTime || undefined,
          priority,
        });
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    } finally {
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
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backButton, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>
          {taskId ? 'Edit Task' : 'New Task'}
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Title *</Text>
          <TextInput
            style={[styles.input, {
              backgroundColor: colors.surfaceVariant,
              color: colors.text,
              borderColor: colors.border,
              borderRadius: borderRadius.md,
            }]}
            value={title}
            onChangeText={setTitle}
            placeholder="Enter task title"
            placeholderTextColor={colors.textTertiary}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Description</Text>
          <TextInput
            style={[styles.textArea, {
              backgroundColor: colors.surfaceVariant,
              color: colors.text,
              borderColor: colors.border,
              borderRadius: borderRadius.md,
            }]}
            value={description}
            onChangeText={setDescription}
            placeholder="Add description..."
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Due Date</Text>
            <TextInput
              style={[styles.input, {
                backgroundColor: colors.surfaceVariant,
                color: colors.text,
                borderColor: colors.border,
                borderRadius: borderRadius.md,
              }]}
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numbers-and-punctuation"
            />
          </View>

          <View style={[styles.field, { flex: 1 }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Due Time</Text>
            <TextInput
              style={[styles.input, {
                backgroundColor: colors.surfaceVariant,
                color: colors.text,
                borderColor: colors.border,
                borderRadius: borderRadius.md,
              }]}
              value={dueTime}
              onChangeText={setDueTime}
              placeholder="HH:MM"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numbers-and-punctuation"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Priority</Text>
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
              >
                <Text
                  style={[
                    styles.priorityChipText,
                    { color: priority === p ? '#fff' : colors.textSecondary },
                  ]}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>{taskId ? 'Update Task' : 'Create Task'}</Text>
          )}
        </TouchableOpacity>
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
  },
  backButton: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  form: {
    padding: 16,
    gap: 20,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    height: 48,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 100,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  priorityChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  saveButton: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

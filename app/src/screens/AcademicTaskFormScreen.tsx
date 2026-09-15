import { useState } from 'react';
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
import { useAcademicTaskStore } from '../store/useAcademicTaskStore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AcademicTaskForm'>;

interface Material {
  type: 'text';
  content: string;
}

export function AcademicTaskFormScreen({ navigation }: Props) {
  const { colors, borderRadius, insets } = useTheme();
  const { createTask } = useAcademicTaskStore();
  const [isSaving, setIsSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);

  const addMaterial = () => {
    setMaterials([...materials, { type: 'text', content: '' }]);
  };

  const updateMaterial = (index: number, value: string) => {
    const updated = [...materials];
    updated[index] = { type: 'text', content: value };
    setMaterials(updated);
  };

  const removeMaterial = (index: number) => {
    setMaterials(materials.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Title is required');
      return;
    }

    setIsSaving(true);
    try {
      await createTask({
        title: title.trim(),
        subject: subject.trim() || undefined,
        content: content.trim() || undefined,
        materials: materials.filter((m) => m.content.trim()).map((m) => ({
          type: m.type,
          content: m.content.trim(),
        })),
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backButton, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>New Academic Task</Text>
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
            placeholder="e.g., Chapter 5: Data Structures"
            placeholderTextColor={colors.textTertiary}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Subject</Text>
          <TextInput
            style={[styles.input, {
              backgroundColor: colors.surfaceVariant,
              color: colors.text,
              borderColor: colors.border,
              borderRadius: borderRadius.md,
            }]}
            value={subject}
            onChangeText={setSubject}
            placeholder="e.g., Computer Science"
            placeholderTextColor={colors.textTertiary}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Content</Text>
          <TextInput
            style={[styles.textArea, {
              backgroundColor: colors.surfaceVariant,
              color: colors.text,
              borderColor: colors.border,
              borderRadius: borderRadius.md,
            }]}
            value={content}
            onChangeText={setContent}
            placeholder="Enter the content you want to study..."
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.field}>
          <View style={styles.materialsHeader}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Additional Materials</Text>
            <TouchableOpacity onPress={addMaterial}>
              <Text style={[styles.addMaterialText, { color: colors.primary }]}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {materials.map((material, index) => (
            <View key={index} style={styles.materialItem}>
              <TextInput
                style={[styles.materialInput, {
                  backgroundColor: colors.surfaceVariant,
                  color: colors.text,
                  borderColor: colors.border,
                  borderRadius: borderRadius.md,
                }]}
                value={material.content}
                onChangeText={(value) => updateMaterial(index, value)}
                placeholder="Add notes, text, or content..."
                placeholderTextColor={colors.textTertiary}
                multiline
              />
              <TouchableOpacity
                style={styles.removeMaterialBtn}
                onPress={() => removeMaterial(index)}
              >
                <Text style={{ color: colors.error }}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Create Academic Task</Text>
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
  header: {
    paddingHorizontal: 16,
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
    minHeight: 150,
  },
  materialsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addMaterialText: {
    fontSize: 14,
    fontWeight: '500',
  },
  materialItem: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  materialInput: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    minHeight: 60,
  },
  removeMaterialBtn: {
    padding: 8,
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

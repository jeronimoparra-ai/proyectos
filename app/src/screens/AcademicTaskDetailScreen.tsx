import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Linking,
} from 'react-native';
import { useTheme } from '../hooks';
import { useAcademicTaskStore } from '../store/useAcademicTaskStore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AcademicTaskDetail'>;

export function AcademicTaskDetailScreen({ navigation, route }: Props) {
  const { taskId } = route.params;
  const { colors, borderRadius } = useTheme();
  const {
    selectedTask,
    isLoading,
    isProcessing,
    isSearching,
    searchResults,
    loadTask,
    deleteTask,
    processWithAI,
    researchTopic,
    clearSearchResults,
    clearSelectedTask,
  } = useAcademicTaskStore();
  const [researchQuery, setResearchQuery] = useState('');

  useEffect(() => {
    loadTask(taskId);
    return () => clearSelectedTask();
  }, [taskId]);

  const handleProcess = async () => {
    Alert.alert(
      'Process with AI',
      'This will analyze your content and generate a summary, key ideas, and concepts. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Process', onPress: () => processWithAI(taskId) },
      ]
    );
  };

  const handleResearch = async () => {
    const query = researchQuery.trim() || selectedTask?.title || '';
    if (!query) {
      Alert.alert('Error', 'Enter a topic to research');
      return;
    }
    await researchTopic(query, selectedTask?.subject ?? undefined);
  };

  const handleOpenLink = (url: string) => {
    Linking.openURL(url);
  };

  const handleDelete = () => {
    Alert.alert('Delete', 'Are you sure you want to delete this academic task?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTask(taskId);
          navigation.goBack();
        },
      },
    ]);
  };

  if (isLoading || !selectedTask) {
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
      </View>

      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>{selectedTask.title}</Text>

        {selectedTask.subject && (
          <Text style={[styles.subject, { color: colors.primary }]}>{selectedTask.subject}</Text>
        )}

        {selectedTask.content && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: borderRadius.lg }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Content</Text>
            <Text style={[styles.cardContent, { color: colors.textSecondary }]}>
              {selectedTask.content}
            </Text>
          </View>
        )}

        {selectedTask.summary && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: borderRadius.lg }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>AI Summary</Text>
            <Text style={[styles.cardContent, { color: colors.textSecondary }]}>
              {selectedTask.summary}
            </Text>
          </View>
        )}

        {selectedTask.key_ideas && selectedTask.key_ideas.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: borderRadius.lg }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Key Ideas</Text>
            {selectedTask.key_ideas.map((idea, index) => (
              <View key={index} style={styles.listItem}>
                <Text style={[styles.listBullet, { color: colors.primary }]}>•</Text>
                <Text style={[styles.listText, { color: colors.textSecondary }]}>{idea}</Text>
              </View>
            ))}
          </View>
        )}

        {selectedTask.concepts && selectedTask.concepts.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: borderRadius.lg }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Concepts</Text>
            <View style={styles.conceptsContainer}>
              {selectedTask.concepts.map((concept, index) => (
                <View
                  key={index}
                  style={[styles.conceptChip, { backgroundColor: colors.primary + '20', borderRadius: borderRadius.full }]}
                >
                  <Text style={[styles.conceptText, { color: colors.primary }]}>{concept}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {selectedTask.questions && selectedTask.questions.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: borderRadius.lg }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Review Questions</Text>
            {selectedTask.questions.map((question, index) => (
              <Text key={index} style={[styles.questionText, { color: colors.textSecondary }]}>
                {index + 1}. {question}
              </Text>
            ))}
          </View>
        )}

        <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: borderRadius.lg }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Web Research</Text>
          <View style={styles.researchRow}>
            <TextInput
              style={[styles.researchInput, {
                backgroundColor: colors.surfaceVariant,
                color: colors.text,
                borderColor: colors.border,
                borderRadius: borderRadius.md,
              }]}
              value={researchQuery}
              onChangeText={setResearchQuery}
              placeholder={selectedTask.title}
              placeholderTextColor={colors.textTertiary}
            />
            <TouchableOpacity
              style={[styles.researchBtn, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
              onPress={handleResearch}
              disabled={isSearching}
            >
              {isSearching ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.researchBtnText}>Search</Text>
              )}
            </TouchableOpacity>
          </View>

          {searchResults.length > 0 && (
            <View style={styles.searchResults}>
              {searchResults.map((result, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.searchResult, { borderBottomColor: colors.border }]}
                  onPress={() => handleOpenLink(result.url)}
                >
                  <Text style={[styles.searchResultTitle, { color: colors.primary }]} numberOfLines={1}>
                    {result.title}
                  </Text>
                  <Text style={[styles.searchResultDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                    {result.description}
                  </Text>
                  <Text style={[styles.searchResultUrl, { color: colors.textTertiary }]} numberOfLines={1}>
                    {result.url}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {selectedTask.ai_processed_at && (
          <Text style={[styles.processedAt, { color: colors.textTertiary }]}>
            Last AI analysis: {new Date(selectedTask.ai_processed_at).toLocaleString()}
          </Text>
        )}

        <View style={styles.actions}>
          {!selectedTask.ai_processed_at && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
              onPress={handleProcess}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.actionButtonText}>Process with AI</Text>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.errorLight, borderRadius: borderRadius.md }]}
            onPress={handleDelete}
          >
            <Text style={[styles.actionButtonText, { color: colors.error }]}>Delete</Text>
          </TouchableOpacity>
        </View>
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
    paddingBottom: 8,
  },
  backButton: {
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subject: {
    fontSize: 16,
    fontWeight: '500',
  },
  card: {
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardContent: {
    fontSize: 14,
    lineHeight: 22,
  },
  listItem: {
    flexDirection: 'row',
    gap: 8,
  },
  listBullet: {
    fontSize: 16,
    fontWeight: '700',
  },
  listText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  conceptsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  conceptChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  conceptText: {
    fontSize: 13,
    fontWeight: '500',
  },
  questionText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  researchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  researchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  researchBtn: {
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  researchBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  searchResults: {
    gap: 8,
  },
  searchResult: {
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  searchResultTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  searchResultDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  searchResultUrl: {
    fontSize: 11,
  },
  processedAt: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

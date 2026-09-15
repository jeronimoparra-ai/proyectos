import { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../hooks';
import { useEventStore } from '../store/useEventStore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'EventDetail'>;

const sourceLabels: Record<string, string> = {
  local: 'Local',
  google: 'Google Calendar',
};

export function EventDetailScreen({ navigation, route }: Props) {
  const { eventId } = route.params;
  const { colors, borderRadius, insets } = useTheme();
  const { selectedEvent, isLoading, loadEvent, deleteEvent, clearSelectedEvent } = useEventStore();

  useEffect(() => {
    loadEvent(eventId);
    return () => clearSelectedEvent();
  }, [eventId, loadEvent, clearSelectedEvent]);

  const handleDelete = () => {
    Alert.alert('Delete Event', 'Are you sure you want to delete this event?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteEvent(eventId);
          navigation.goBack();
        },
      },
    ]);
  };

  const handleEdit = () => {
    navigation.navigate('EventForm', { eventId });
  };

  if (isLoading || !selectedEvent) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const startDate = new Date(selectedEvent.start_date);
  const endDate = new Date(selectedEvent.end_date);

  const formatDate = (date: Date) =>
    date.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backButton, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.text }]}>{selectedEvent.title}</Text>
          <View style={[styles.sourceBadge, { backgroundColor: (selectedEvent.source === 'google' ? '#EA4335' : colors.primary) + '20' }]}>
            <Text style={[styles.sourceText, { color: selectedEvent.source === 'google' ? '#EA4335' : colors.primary }]}>
              {sourceLabels[selectedEvent.source]}
            </Text>
          </View>
        </View>

        {selectedEvent.description && (
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {selectedEvent.description}
          </Text>
        )}

        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderRadius: borderRadius.lg }]}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Date</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{formatDate(startDate)}</Text>
          </View>
          {!selectedEvent.all_day && (
            <>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Start</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{formatTime(startDate)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>End</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{formatTime(endDate)}</Text>
              </View>
            </>
          )}
          {selectedEvent.all_day && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Duration</Text>
              <Text style={[styles.infoValue, { color: colors.primary }]}>All Day</Text>
            </View>
          )}
          {selectedEvent.location && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Location</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{selectedEvent.location}</Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
            onPress={handleEdit}
          >
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>
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
    paddingBottom: 8,
  },
  backButton: {
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    padding: 16,
    gap: 20,
  },
  titleRow: {
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  sourceBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sourceText: {
    fontSize: 12,
    fontWeight: '600',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  infoCard: {
    padding: 16,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    maxWidth: '60%',
    textAlign: 'right',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
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

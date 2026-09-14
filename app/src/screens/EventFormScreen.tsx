import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../hooks';
import { useEventStore } from '../store/useEventStore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'EventForm'>;

export function EventFormScreen({ navigation, route }: Props) {
  const { eventId } = route.params ?? {};
  const { colors, borderRadius } = useTheme();
  const { selectedEvent, loadEvent, createEvent, updateEvent, clearSelectedEvent } = useEventStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState('');

  useEffect(() => {
    if (eventId) {
      setIsLoading(true);
      loadEvent(eventId).finally(() => setIsLoading(false));
    }
    return () => clearSelectedEvent();
  }, [eventId]);

  useEffect(() => {
    if (selectedEvent && eventId) {
      setTitle(selectedEvent.title);
      setDescription(selectedEvent.description ?? '');
      setAllDay(selectedEvent.all_day);
      setLocation(selectedEvent.location ?? '');

      const start = new Date(selectedEvent.start_date);
      const end = new Date(selectedEvent.end_date);

      setStartDate(start.toISOString().split('T')[0]);
      setStartTime(start.toTimeString().slice(0, 5));
      setEndDate(end.toISOString().split('T')[0]);
      setEndTime(end.toTimeString().slice(0, 5));
    }
  }, [selectedEvent, eventId]);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Title is required');
      return;
    }
    if (!startDate) {
      Alert.alert('Error', 'Start date is required');
      return;
    }

    const startDateTime = allDay
      ? `${startDate}T00:00:00.000Z`
      : `${startDate}T${startTime || '00:00'}:00.000Z`;
    const endDateTime = allDay
      ? `${endDate || startDate}T23:59:59.000Z`
      : `${endDate || startDate}T${endTime || '23:59'}:00.000Z`;

    setIsSaving(true);
    try {
      if (eventId) {
        await updateEvent(eventId, {
          title: title.trim(),
          description: description.trim() || undefined,
          start_date: startDateTime,
          end_date: endDateTime,
          all_day: allDay,
          location: location.trim() || undefined,
        });
      } else {
        await createEvent({
          title: title.trim(),
          description: description.trim() || undefined,
          start_date: startDateTime,
          end_date: endDateTime,
          all_day: allDay,
          location: location.trim() || undefined,
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
          {eventId ? 'Edit Event' : 'New Event'}
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
            placeholder="Event title"
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
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>All Day</Text>
          <Switch
            value={allDay}
            onValueChange={setAllDay}
            trackColor={{ false: colors.border, true: colors.primary + '80' }}
            thumbColor={allDay ? colors.primary : colors.surfaceVariant}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Start Date *</Text>
            <TextInput
              style={[styles.input, {
                backgroundColor: colors.surfaceVariant,
                color: colors.text,
                borderColor: colors.border,
                borderRadius: borderRadius.md,
              }]}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numbers-and-punctuation"
            />
          </View>
          {!allDay && (
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Start Time</Text>
              <TextInput
                style={[styles.input, {
                  backgroundColor: colors.surfaceVariant,
                  color: colors.text,
                  borderColor: colors.border,
                  borderRadius: borderRadius.md,
                }]}
                value={startTime}
                onChangeText={setStartTime}
                placeholder="HH:MM"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          )}
        </View>

        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>End Date</Text>
            <TextInput
              style={[styles.input, {
                backgroundColor: colors.surfaceVariant,
                color: colors.text,
                borderColor: colors.border,
                borderRadius: borderRadius.md,
              }]}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numbers-and-punctuation"
            />
          </View>
          {!allDay && (
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>End Time</Text>
              <TextInput
                style={[styles.input, {
                  backgroundColor: colors.surfaceVariant,
                  color: colors.text,
                  borderColor: colors.border,
                  borderRadius: borderRadius.md,
                }]}
                value={endTime}
                onChangeText={setEndTime}
                placeholder="HH:MM"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          )}
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Location</Text>
          <TextInput
            style={[styles.input, {
              backgroundColor: colors.surfaceVariant,
              color: colors.text,
              borderColor: colors.border,
              borderRadius: borderRadius.md,
            }]}
            value={location}
            onChangeText={setLocation}
            placeholder="Add location..."
            placeholderTextColor={colors.textTertiary}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>{eventId ? 'Update Event' : 'Create Event'}</Text>
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
    minHeight: 80,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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

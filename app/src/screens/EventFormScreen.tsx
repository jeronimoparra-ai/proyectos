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
import { DateInput } from '../components/DateInput';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'EventForm'>;

function toISOString(date: Date, time: Date | null, allDay: boolean): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  if (allDay) return `${y}-${m}-${d}T00:00:00.000Z`;
  const h = String(time?.getHours() ?? 0).padStart(2, '0');
  const min = String(time?.getMinutes() ?? 0).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}:00.000Z`;
}

function toEndISOString(date: Date, time: Date | null, allDay: boolean): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  if (allDay) return `${y}-${m}-${d}T23:59:59.000Z`;
  const h = String(time?.getHours() ?? 23).padStart(2, '0');
  const min = String(time?.getMinutes() ?? 59).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}:00.000Z`;
}

export function EventFormScreen({ navigation, route }: Props) {
  const { eventId } = route.params ?? {};
  const { colors, borderRadius, insets } = useTheme();
  const { selectedEvent, loadEvent, createEvent, updateEvent, clearSelectedEvent } = useEventStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState('');

  useEffect(() => {
    if (eventId) {
      setIsLoading(true);
      loadEvent(eventId).finally(() => setIsLoading(false));
    }
    return () => clearSelectedEvent();
  }, [eventId, loadEvent, clearSelectedEvent]);

  useEffect(() => {
    if (selectedEvent && eventId) {
      setTitle(selectedEvent.title);
      setDescription(selectedEvent.description ?? '');
      setAllDay(selectedEvent.all_day);
      setLocation(selectedEvent.location ?? '');

      const start = new Date(selectedEvent.start_date);
      const end = new Date(selectedEvent.end_date);

      setStartDate(start);
      setStartTime(allDay ? null : start);
      setEndDate(end);
      setEndTime(allDay ? null : end);
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

    setIsSaving(true);
    try {
      const startISO = toISOString(startDate, startTime, allDay);
      const endISO = toISOString(endDate ?? startDate, endTime, allDay);

      if (eventId) {
        await updateEvent(eventId, {
          title: title.trim(),
          description: description.trim() || undefined,
          start_date: startISO,
          end_date: allDay ? toEndISOString(endDate ?? startDate, null, true) : endISO,
          all_day: allDay,
          location: location.trim() || undefined,
        });
      } else {
        await createEvent({
          title: title.trim(),
          description: description.trim() || undefined,
          start_date: startISO,
          end_date: allDay ? toEndISOString(endDate ?? startDate, null, true) : endISO,
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
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
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
          <View style={{ flex: 1 }}>
            <DateInput
              label="Start Date *"
              value={startDate}
              onChange={setStartDate}
              mode="date"
              placeholder="Select date"
            />
          </View>
          {!allDay && (
            <View style={{ flex: 1 }}>
              <DateInput
                label="Start Time"
                value={startTime}
                onChange={setStartTime}
                mode="time"
                placeholder="Select time"
              />
            </View>
          )}
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <DateInput
              label="End Date"
              value={endDate}
              onChange={setEndDate}
              mode="date"
              placeholder="Select date"
              minimumDate={startDate ?? undefined}
            />
          </View>
          {!allDay && (
            <View style={{ flex: 1 }}>
              <DateInput
                label="End Time"
                value={endTime}
                onChange={setEndTime}
                mode="time"
                placeholder="Select time"
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

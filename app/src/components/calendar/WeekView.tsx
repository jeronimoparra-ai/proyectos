import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { useTheme } from '../../hooks';
import type { Event } from '../../types';

interface WeekViewProps {
  selectedDate: Date;
  events: Event[];
  onDatePress: (date: Date) => void;
  onEventPress: (event: Event) => void;
}

function getWeekDays(date: Date): Date[] {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    days.push(day);
  }
  return days;
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function WeekView({ selectedDate, events, onDatePress, onEventPress }: WeekViewProps) {
  const { colors, borderRadius } = useTheme();

  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);
  const today = new Date();

  const eventsByDay = useMemo(() => {
    const map = new Map<string, typeof events>();
    for (const event of events) {
      const key = event.start_date.split('T')[0];
      const existing = map.get(key) ?? [];
      existing.push(event);
      map.set(key, existing);
    }
    return map;
  }, [events]);

  return (
    <View style={styles.container}>
      <View style={styles.dayRow}>
        {weekDays.map((day, index) => {
          const isToday = formatDateKey(day) === formatDateKey(today);
          const isSelected = formatDateKey(day) === formatDateKey(selectedDate);
          const dayEvents = eventsByDay.get(formatDateKey(day)) ?? [];

          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.dayColumn,
                isSelected && { backgroundColor: colors.primary + '15', borderRadius: borderRadius.md },
              ]}
              onPress={() => onDatePress(day)}
            >
              <Text style={[styles.dayLabel, { color: colors.textTertiary }]}>
                {DAY_LABELS[index]}
              </Text>
              <View
                style={[
                  styles.dayNumber,
                  isToday && { backgroundColor: colors.primary, borderRadius: borderRadius.full },
                ]}
              >
                <Text
                  style={[
                    styles.dayNumberText,
                    { color: isToday ? '#fff' : colors.text },
                  ]}
                >
                  {day.getDate()}
                </Text>
              </View>
              {dayEvents.length > 0 && (
                <View style={styles.eventsIndicator}>
                  {dayEvents.slice(0, 3).map((event, i) => (
                    <View
                      key={i}
                      style={[
                        styles.eventDot,
                        { backgroundColor: event.color ?? colors.primary },
                      ]}
                    />
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={events.filter((e) => {
          const eventDate = e.start_date.split('T')[0];
          return weekDays.some((d) => formatDateKey(d) === eventDate);
        })}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const startTime = new Date(item.start_date).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });
          return (
            <TouchableOpacity
              style={[styles.eventRow, { borderBottomColor: colors.border }]}
              onPress={() => onEventPress(item)}
            >
              <View style={[styles.eventIndicator, { backgroundColor: item.color ?? colors.primary }]} />
              <View style={styles.eventInfo}>
                <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.eventTime, { color: colors.textSecondary }]}>{startTime}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
            No events this week
          </Text>
        }
        contentContainerStyle={styles.eventsList}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dayRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  dayColumn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  dayNumber: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberText: {
    fontSize: 15,
    fontWeight: '600',
  },
  eventsIndicator: {
    flexDirection: 'row',
    gap: 3,
  },
  eventDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  eventsList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 12,
  },
  eventIndicator: {
    width: 4,
    height: 32,
    borderRadius: 2,
  },
  eventInfo: {
    flex: 1,
    gap: 2,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  eventTime: {
    fontSize: 12,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 14,
  },
});

import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks';

interface CalendarGridProps {
  selectedDate: Date;
  currentDate: Date;
  events: Array<{ start_date: string }>;
  onDatePress: (date: Date) => void;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function CalendarGrid({ selectedDate, currentDate, events, onDatePress }: CalendarGridProps) {
  const { colors, borderRadius } = useTheme();

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const days: Array<{ date: Date; isCurrentMonth: boolean; isToday: boolean; isSelected: boolean; hasEvents: boolean }> = [];

    const eventDates = new Set(events.map((e) => e.start_date.split('T')[0]));

    for (let i = 0; i < firstDay; i++) {
      const prevMonthDate = new Date(year, month, -firstDay + i + 1);
      days.push({
        date: prevMonthDate,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
        hasEvents: false,
      });
    }

    const today = new Date();
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      days.push({
        date,
        isCurrentMonth: true,
        isToday: formatDate(date) === formatDate(today),
        isSelected: formatDate(date) === formatDate(selectedDate),
        hasEvents: eventDates.has(formatDate(date)),
      });
    }

    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const nextMonthDate = new Date(year, month + 1, i);
      days.push({
        date: nextMonthDate,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
        hasEvents: false,
      });
    }

    return days;
  }, [currentDate, selectedDate, events]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.monthTitle, { color: colors.text }]}>
          {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
        </Text>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((day) => (
          <Text key={day} style={[styles.weekday, { color: colors.textTertiary }]}>
            {day}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {calendarDays.map((day, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.dayCell,
              day.isSelected && { backgroundColor: colors.primary, borderRadius: borderRadius.full },
              day.isToday && !day.isSelected && { borderColor: colors.primary },
            ]}
            onPress={() => onDatePress(day.date)}
          >
            <Text
              style={[
                styles.dayText,
                {
                  color: day.isSelected
                    ? '#fff'
                    : day.isCurrentMonth
                    ? colors.text
                    : colors.textTertiary,
                  fontWeight: day.isToday || day.isSelected ? '700' : '400',
                },
              ]}
            >
              {day.date.getDate()}
            </Text>
            {day.hasEvents && (
              <View
                style={[
                  styles.eventDot,
                  { backgroundColor: day.isSelected ? '#fff' : colors.primary },
                ]}
              />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dayText: {
    fontSize: 14,
  },
  eventDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    position: 'absolute',
    bottom: 4,
  },
});

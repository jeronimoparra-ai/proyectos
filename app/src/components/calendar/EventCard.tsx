import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks';
import type { Event } from '../../types';

interface EventCardProps {
  event: Event;
  onPress: (event: Event) => void;
}

const sourceColors: Record<string, string> = {
  local: '#4A90D9',
  google: '#EA4335',
};

export function EventCard({ event, onPress }: EventCardProps) {
  const { colors, borderRadius } = useTheme();

  const startTime = new Date(event.start_date);
  const endTime = new Date(event.end_date);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isAllDay = event.all_day;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          borderLeftColor: event.color ?? sourceColors[event.source] ?? colors.primary,
        },
      ]}
      onPress={() => onPress(event)}
      activeOpacity={0.7}
    >
      <View style={styles.timeColumn}>
        {isAllDay ? (
          <Text style={[styles.timeText, { color: colors.primary }]}>All Day</Text>
        ) : (
          <>
            <Text style={[styles.timeText, { color: colors.text }]}>{formatTime(startTime)}</Text>
            <Text style={[styles.timeText, { color: colors.textTertiary }]}>→ {formatTime(endTime)}</Text>
          </>
        )}
      </View>

      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {event.title}
        </Text>
        {event.location && (
          <Text style={[styles.location, { color: colors.textSecondary }]} numberOfLines={1}>
            📍 {event.location}
          </Text>
        )}
      </View>

      {event.source === 'google' && (
        <View style={[styles.sourceBadge, { backgroundColor: sourceColors.google + '20' }]}>
          <Text style={[styles.sourceText, { color: sourceColors.google }]}>G</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 4,
    borderLeftWidth: 3,
    gap: 12,
  },
  timeColumn: {
    minWidth: 70,
    gap: 2,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  location: {
    fontSize: 12,
  },
  sourceBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks';
import { AnimatedPressable } from '../AnimatedPressable';
import { IconLocation } from '../icons';
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
    <AnimatedPressable
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          borderLeftColor: event.color ?? sourceColors[event.source] ?? colors.primary,
        },
      ]}
      onPress={() => onPress(event)}
      accessibilityRole="button"
      accessibilityLabel={`Event: ${event.title}`}
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
          <View style={styles.locationRow}>
            <IconLocation size={13} color={colors.textSecondary} />
            <Text style={[styles.location, { color: colors.textSecondary }]} numberOfLines={1}>
              {event.location}
            </Text>
          </View>
        )}
      </View>

      {event.source === 'google' && (
        <View style={[styles.sourceBadge, { backgroundColor: sourceColors.google + '20' }]}>
          <Text style={[styles.sourceText, { color: sourceColors.google }]}>G</Text>
        </View>
      )}
    </AnimatedPressable>
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
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  location: {
    fontSize: 12,
    flex: 1,
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

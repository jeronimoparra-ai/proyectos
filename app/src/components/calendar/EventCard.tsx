import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks';
import { cardStyles } from '../../theme/cardStyles';
import { AnimatedPressable } from '../AnimatedPressable';
import { IconLocation } from '../icons';
import type { Event } from '../../types';

export interface EventCardProps {
  event: Event;
  onPress: (event: Event) => void;
}

const sourceColors: Record<string, string> = {
  local: '#4A90D9',
  google: '#EA4335',
};

function areEventCardPropsEqual(prev: EventCardProps, next: EventCardProps): boolean {
  if (prev.event === next.event && prev.onPress === next.onPress) {
    return true;
  }
  return (
    prev.event.id === next.event.id &&
    prev.event.title === next.event.title &&
    prev.event.start_date === next.event.start_date &&
    prev.event.end_date === next.event.end_date &&
    prev.event.all_day === next.event.all_day &&
    prev.event.color === next.event.color &&
    prev.event.source === next.event.source &&
    prev.event.location === next.event.location &&
    prev.onPress === next.onPress
  );
}

export const EventCard = memo(function EventCard({ event, onPress }: EventCardProps) {
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
        cardStyles.cardContainer,
        cardStyles.cardBorderLeftThin,
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
}, areEventCardPropsEqual);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginVertical: 4,
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

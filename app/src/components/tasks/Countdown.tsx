import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, useSharedTimer } from '../../hooks';
import type { TimerPrecision } from '../../hooks/useSharedTimer';

export interface CountdownProps {
  targetDate: string;
  targetTime?: string;
  precision?: TimerPrecision;
  showSeconds?: boolean;
}

export interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
}

export function calculateTimeLeft(targetDate: string, targetTime?: string): TimeLeft {
  const dateStr = targetTime ? `${targetDate}T${targetTime}` : targetDate;
  const target = new Date(dateStr).getTime();
  const now = Date.now();
  const diff = target - now;

  if (isNaN(target) || diff <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isPast: true,
    };
  }

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
    isPast: false,
  };
}

export const Countdown = memo(function Countdown({
  targetDate,
  targetTime,
  precision = 'second',
  showSeconds,
}: CountdownProps) {
  const { colors } = useTheme();
  useSharedTimer(precision);

  const timeLeft = calculateTimeLeft(targetDate, targetTime);
  const displaySeconds = showSeconds ?? (precision === 'second');

  if (timeLeft.isPast) {
    return (
      <View
        style={styles.container}
        accessible={true}
        accessibilityRole="timer"
        accessibilityLabel="Expired deadline"
      >
        <Text style={[styles.label, { color: colors.error }]}>Expired</Text>
      </View>
    );
  }

  const labelParts: string[] = [];
  if (timeLeft.days > 0) labelParts.push(`${timeLeft.days} days`);
  labelParts.push(`${timeLeft.hours} hours`);
  labelParts.push(`${timeLeft.minutes} minutes`);
  if (displaySeconds) labelParts.push(`${timeLeft.seconds} seconds`);

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityRole="timer"
      accessibilityLabel={`Time remaining: ${labelParts.join(', ')}`}
    >
      {timeLeft.days > 0 && (
        <>
          <View style={styles.unit}>
            <Text style={[styles.value, { color: colors.text }]}>{timeLeft.days}</Text>
            <Text style={[styles.label, { color: colors.textSecondary }]}>DAYS</Text>
          </View>
          <Text style={[styles.separator, { color: colors.textTertiary }]}>:</Text>
        </>
      )}
      <View style={styles.unit}>
        <Text style={[styles.value, { color: colors.text }]}>
          {String(timeLeft.hours).padStart(2, '0')}
        </Text>
        <Text style={[styles.label, { color: colors.textSecondary }]}>HRS</Text>
      </View>
      <Text style={[styles.separator, { color: colors.textTertiary }]}>:</Text>
      <View style={styles.unit}>
        <Text style={[styles.value, { color: colors.text }]}>
          {String(timeLeft.minutes).padStart(2, '0')}
        </Text>
        <Text style={[styles.label, { color: colors.textSecondary }]}>MIN</Text>
      </View>
      {displaySeconds && (
        <>
          <Text style={[styles.separator, { color: colors.textTertiary }]}>:</Text>
          <View style={styles.unit}>
            <Text style={[styles.value, { color: colors.text }]}>
              {String(timeLeft.seconds).padStart(2, '0')}
            </Text>
            <Text style={[styles.label, { color: colors.textSecondary }]}>SEC</Text>
          </View>
        </>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  unit: {
    alignItems: 'center',
    minWidth: 40,
  },
  value: {
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  separator: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: -12,
  },
});

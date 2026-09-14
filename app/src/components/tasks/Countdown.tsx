import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks';

interface CountdownProps {
  targetDate: string;
  targetTime?: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calculateTimeLeft(targetDate: string, targetTime?: string): TimeLeft {
  const dateStr = targetTime ? `${targetDate}T${targetTime}` : targetDate;
  const target = new Date(dateStr).getTime();
  const now = Date.now();
  const diff = Math.max(0, target - now);

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
  };
}

export function Countdown({ targetDate, targetTime }: CountdownProps) {
  const { colors, typography } = useTheme();
  const [timeLeft, setTimeLeft] = useState(() => calculateTimeLeft(targetDate, targetTime));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(targetDate, targetTime));
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate, targetTime]);

  const isPast = timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0;

  if (isPast) {
    return (
      <View style={styles.container}>
        <Text style={[styles.label, { color: colors.error }]}>Expired</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {timeLeft.days > 0 && (
        <View style={styles.unit}>
          <Text style={[styles.value, { color: colors.text }]}>{timeLeft.days}</Text>
          <Text style={[styles.label, { color: colors.textSecondary }]}>DAYS</Text>
        </View>
      )}
      {timeLeft.days > 0 && <Text style={[styles.separator, { color: colors.textTertiary }]}>:</Text>}
      <View style={styles.unit}>
        <Text style={[styles.value, { color: colors.text }]}>{String(timeLeft.hours).padStart(2, '0')}</Text>
        <Text style={[styles.label, { color: colors.textSecondary }]}>HRS</Text>
      </View>
      <Text style={[styles.separator, { color: colors.textTertiary }]}>:</Text>
      <View style={styles.unit}>
        <Text style={[styles.value, { color: colors.text }]}>{String(timeLeft.minutes).padStart(2, '0')}</Text>
        <Text style={[styles.label, { color: colors.textSecondary }]}>MIN</Text>
      </View>
      <Text style={[styles.separator, { color: colors.textTertiary }]}>:</Text>
      <View style={styles.unit}>
        <Text style={[styles.value, { color: colors.text }]}>{String(timeLeft.seconds).padStart(2, '0')}</Text>
        <Text style={[styles.label, { color: colors.textSecondary }]}>SEC</Text>
      </View>
    </View>
  );
}

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

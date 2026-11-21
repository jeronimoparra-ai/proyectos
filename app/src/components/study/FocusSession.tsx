/**
 * FocusSession
 *
 * A simple, self-contained study timer with three states: idle, running, paused.
 * Uses useSharedTimer (second precision) so it shares the interval with other
 * components that might be live-ticking, rather than spinning up a new setInterval.
 *
 * Design decisions:
 *  - No external state store: local only. Session length is not persisted.
 *  - reduceMotion: pulse ring is disabled; only the counter updates.
 *  - Tap targets ≥ 44 dp throughout.
 *  - Three clearly labelled actions: Start, Pause/Resume, End.
 *  - "End" is only visible once a session has started, so it cannot be tapped by accident.
 */

import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useSharedTimer } from '../../hooks/useSharedTimer';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { AnimatedPressable } from '../AnimatedPressable';
import { MilestoneBadge } from '../brand';
import { touchTarget, shadows, animation } from '../../theme';

type SessionState = 'idle' | 'running' | 'paused';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function FocusSession() {
  const { colors, borderRadius, isDark } = useTheme();
  const reduceMotion = useReducedMotion();
  const tick = useSharedTimer('second');

  const [status, setStatus] = useState<SessionState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const startedAtRef = useRef<number>(0);
  const accumulatedRef = useRef<number>(0);

  // Pulse animation for the ring (skipped with reduceMotion)
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (status === 'running' && !reduceMotion) {
      pulseLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.06,
            duration: animation.duration.slow,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: animation.duration.slow,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoopRef.current.start();
    } else {
      pulseLoopRef.current?.stop();
      pulseLoopRef.current = null;
      pulseAnim.setValue(1);
    }
    return () => {
      pulseLoopRef.current?.stop();
      pulseLoopRef.current = null;
    };
  }, [status, reduceMotion, pulseAnim]);

  // Tick handler: only accumulate while running
  useEffect(() => {
    if (status === 'running') {
      const now = Date.now();
      const liveElapsed = accumulatedRef.current + Math.floor((now - startedAtRef.current) / 1000);
      setElapsed(liveElapsed);
    }
  }, [tick, status]);

  const handleStart = () => {
    startedAtRef.current = Date.now();
    setStatus('running');
  };

  const handlePause = () => {
    accumulatedRef.current = elapsed;
    setStatus('paused');
  };

  const handleResume = () => {
    startedAtRef.current = Date.now();
    setStatus('running');
  };

  const handleEnd = () => {
    // Reset everything; caller could lift this up if they want to record the session
    setStatus('idle');
    setElapsed(0);
    accumulatedRef.current = 0;
    startedAtRef.current = 0;
  };

  const badgeVariant = status === 'running' ? 'success' : status === 'paused' ? 'amber' : 'ink';
  const badgeLabel = status === 'running' ? 'Focusing' : status === 'paused' ? 'Paused' : 'Ready';

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: borderRadius.lg,
        },
      ]}
      accessible
      accessibilityRole="timer"
      accessibilityLabel={`Focus session. ${badgeLabel}. Elapsed: ${formatDuration(elapsed)}`}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Focus Session</Text>
        <MilestoneBadge variant={badgeVariant} size="sm" label={badgeLabel} />
      </View>

      {/* Timer display */}
      <Animated.View
        style={[
          styles.timerRing,
          {
            backgroundColor: isDark ? colors.surfaceVariant : colors.inkMuted,
            borderColor:
              status === 'running'
                ? colors.success
                : status === 'paused'
                ? colors.warning
                : colors.border,
            transform: [{ scale: reduceMotion ? 1 : pulseAnim }],
          },
        ]}
        accessible
        accessibilityLabel={`${formatDuration(elapsed)} elapsed`}
        accessibilityLiveRegion={status === 'running' ? 'none' : 'polite'}
      >
        <Text
          style={[
            styles.timerText,
            {
              color:
                status === 'running'
                  ? colors.success
                  : status === 'paused'
                  ? colors.warning
                  : colors.textSecondary,
            },
          ]}
          accessibilityElementsHidden
        >
          {formatDuration(elapsed)}
        </Text>
        {status !== 'idle' && (
          <Text style={[styles.timerLabel, { color: colors.textTertiary }]}>
            {status === 'running' ? 'elapsed' : 'paused'}
          </Text>
        )}
      </Animated.View>

      {/* Controls */}
      <View style={styles.controls}>
        {status === 'idle' && (
          <AnimatedPressable
            style={[
              styles.primaryButton,
              {
                backgroundColor: colors.primary,
                borderColor: colors.primaryDark,
                borderRadius: borderRadius.md,
                minHeight: touchTarget.comfortable,
              },
            ]}
            onPress={handleStart}
            accessibilityRole="button"
            accessibilityLabel="Start focus session"
          >
            <Text style={[styles.primaryButtonText, { color: '#FFFFFF' }]}>Start</Text>
          </AnimatedPressable>
        )}

        {status === 'running' && (
          <>
            <AnimatedPressable
              style={[
                styles.secondaryButton,
                {
                  backgroundColor: isDark ? colors.surfaceVariant : colors.amberMuted,
                  borderColor: colors.warning,
                  borderRadius: borderRadius.md,
                  minHeight: touchTarget.comfortable,
                  flex: 1,
                },
              ]}
              onPress={handlePause}
              accessibilityRole="button"
              accessibilityLabel="Pause focus session"
            >
              <Text style={[styles.secondaryButtonText, { color: colors.warning }]}>Pause</Text>
            </AnimatedPressable>
            <AnimatedPressable
              style={[
                styles.ghostButton,
                {
                  borderColor: colors.error,
                  borderRadius: borderRadius.md,
                  minHeight: touchTarget.comfortable,
                  flex: 1,
                },
              ]}
              onPress={handleEnd}
              accessibilityRole="button"
              accessibilityLabel="End focus session"
            >
              <Text style={[styles.ghostButtonText, { color: colors.error }]}>End</Text>
            </AnimatedPressable>
          </>
        )}

        {status === 'paused' && (
          <>
            <AnimatedPressable
              style={[
                styles.primaryButton,
                {
                  backgroundColor: colors.primary,
                  borderColor: colors.primaryDark,
                  borderRadius: borderRadius.md,
                  minHeight: touchTarget.comfortable,
                  flex: 1,
                },
              ]}
              onPress={handleResume}
              accessibilityRole="button"
              accessibilityLabel="Resume focus session"
            >
              <Text style={[styles.primaryButtonText, { color: '#FFFFFF' }]}>Resume</Text>
            </AnimatedPressable>
            <AnimatedPressable
              style={[
                styles.ghostButton,
                {
                  borderColor: colors.error,
                  borderRadius: borderRadius.md,
                  minHeight: touchTarget.comfortable,
                  flex: 1,
                },
              ]}
              onPress={handleEnd}
              accessibilityRole="button"
              accessibilityLabel="End focus session"
            >
              <Text style={[styles.ghostButtonText, { color: colors.error }]}>End</Text>
            </AnimatedPressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  timerRing: {
    alignSelf: 'center',
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  timerText: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  timerLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  controls: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  ghostButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  ghostButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});

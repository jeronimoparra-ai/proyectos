/**
 * AutomationsSection
 *
 * Controls for the useAutomationStore contract:
 *  - Enable/disable reminders (global kill-switch)
 *  - Silent hours window (start / end)
 *  - Snooze duration
 *
 * Rules:
 *  - Every Switch is functional — no decorative state.
 *  - When reminders are off, silent-hours and snooze rows are visually muted
 *    and their controls are disabled.
 *  - Tap targets ≥ 44 dp; reduceMotion-aware animation via AnimatedPressable.
 */

import { View, Text, Switch, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useAutomationStore } from '../../store/useAutomationStore';
import { AnimatedPressable } from '../AnimatedPressable';
import { touchTarget, shadows } from '../../theme';
import { MilestoneBadge } from '../brand';

const SNOOZE_OPTIONS = [5, 10, 15, 30] as const;
type SnoozeOption = (typeof SNOOZE_OPTIONS)[number];

export function AutomationsSection() {
  const { colors, borderRadius, isDark } = useTheme();
  const {
    remindersEnabled,
    silentStart,
    silentEnd,
    snoozeMinutes,
    setRemindersEnabled,
    setSilentHours,
    setSnoozeMinutes,
  } = useAutomationStore();

  const dimmed = !remindersEnabled;

  // Cycle through preset snooze values
  const handleSnoozeNext = () => {
    const idx = SNOOZE_OPTIONS.indexOf(snoozeMinutes as SnoozeOption);
    const next = SNOOZE_OPTIONS[(idx + 1) % SNOOZE_OPTIONS.length];
    setSnoozeMinutes(next);
  };

  const switchTrackColor = {
    false: isDark ? colors.surfaceVariant : colors.border,
    true: colors.primary,
  };
  const switchThumbColor = Platform.OS === 'android' ? (remindersEnabled ? colors.primary : colors.textTertiary) : '#FFFFFF';

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
    >
      {/* Section header */}
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          REMINDERS & AUTOMATION
        </Text>
        <MilestoneBadge
          variant={remindersEnabled ? 'success' : 'error'}
          size="sm"
          label={remindersEnabled ? 'On' : 'Off'}
        />
      </View>

      {/* Master toggle */}
      <View
        style={[
          styles.row,
          { borderBottomColor: colors.border },
        ]}
        accessible
        accessibilityRole="none"
      >
        <View style={styles.rowLeft}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>Enable reminders</Text>
          <Text style={[styles.rowHint, { color: colors.textTertiary }]}>
            Push notifications for tasks and reviews
          </Text>
        </View>
        <Switch
          value={remindersEnabled}
          onValueChange={setRemindersEnabled}
          trackColor={switchTrackColor}
          thumbColor={switchThumbColor}
          accessibilityLabel="Enable reminders"
          accessibilityRole="switch"
          accessibilityState={{ checked: remindersEnabled }}
          style={styles.switchControl}
        />
      </View>

      {/* Silent hours */}
      <View
        style={[
          styles.row,
          { borderBottomColor: colors.border, opacity: dimmed ? 0.45 : 1 },
        ]}
        accessible
        accessibilityRole="none"
      >
        <View style={styles.rowLeft}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>Silent hours</Text>
          <Text style={[styles.rowHint, { color: colors.textTertiary }]}>
            No reminders between {silentStart} – {silentEnd}
          </Text>
        </View>
        <View style={styles.timeRow}>
          <TimeChip
            value={silentStart}
            label="Start"
            disabled={dimmed}
            onChange={(v) => setSilentHours(v, silentEnd)}
            colors={colors}
            borderRadius={borderRadius}
            isDark={isDark}
          />
          <Text style={[styles.timeSeparator, { color: colors.textTertiary }]}>–</Text>
          <TimeChip
            value={silentEnd}
            label="End"
            disabled={dimmed}
            onChange={(v) => setSilentHours(silentStart, v)}
            colors={colors}
            borderRadius={borderRadius}
            isDark={isDark}
          />
        </View>
      </View>

      {/* Snooze */}
      <View
        style={[
          styles.snoozeRow,
          { opacity: dimmed ? 0.45 : 1 },
        ]}
        accessible
        accessibilityRole="none"
      >
        <View style={styles.rowLeft}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>Snooze duration</Text>
          <Text style={[styles.rowHint, { color: colors.textTertiary }]}>
            Tap to cycle through presets
          </Text>
        </View>
        <View style={styles.snoozeChips}>
          {SNOOZE_OPTIONS.map((opt) => {
            const isActive = snoozeMinutes === opt;
            return (
              <AnimatedPressable
                key={opt}
                style={[
                  styles.snoozeChip,
                  {
                    backgroundColor: isActive
                      ? colors.primary
                      : isDark
                      ? colors.surfaceVariant
                      : colors.inkMuted,
                    borderColor: isActive ? colors.primaryDark : colors.border,
                    borderRadius: borderRadius.md,
                    minHeight: touchTarget.min,
                    minWidth: touchTarget.min,
                  },
                ]}
                disabled={dimmed}
                onPress={() => setSnoozeMinutes(opt)}
                accessibilityRole="button"
                accessibilityLabel={`Snooze ${opt} minutes`}
                accessibilityState={{ selected: isActive, disabled: dimmed }}
              >
                <Text
                  style={[
                    styles.snoozeChipText,
                    { color: isActive ? '#FFFFFF' : colors.textSecondary },
                  ]}
                >
                  {opt}m
                </Text>
              </AnimatedPressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ─── TimeChip ─────────────────────────────────────────────────────────────────
// Simple read-only display chip; a real time-picker would be a modal (out of scope).
// Tapping shows an Alert, so the UI is never decorative.

import { Alert } from 'react-native';
import type { ColorToken } from '../../theme/colors';

type Colors = Record<ColorToken, string>;

interface TimeChipProps {
  value: string;
  label: string;
  disabled: boolean;
  onChange: (v: string) => void;
  colors: Colors;
  borderRadius: Record<string, number>;
  isDark: boolean;
}

function TimeChip({ value, label, disabled, onChange, colors, borderRadius, isDark }: TimeChipProps) {
  const handlePress = () => {
    // TODO: replace with DateTimePicker modal when implemented
    Alert.prompt(
      `${label} time`,
      'Enter time in HH:MM format (24-hour)',
      (input) => {
        if (input && /^\d{2}:\d{2}$/.test(input)) {
          onChange(input);
        }
      },
      'plain-text',
      value,
    );
  };

  return (
    <AnimatedPressable
      style={[
        styles.timeChip,
        {
          backgroundColor: isDark ? colors.surfaceVariant : colors.inkMuted,
          borderColor: colors.border,
          borderRadius: borderRadius.md,
          minHeight: touchTarget.min,
        },
      ]}
      disabled={disabled}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value}`}
      accessibilityState={{ disabled }}
    >
      <Text style={[styles.timeChipText, { color: disabled ? colors.textTertiary : colors.text }]}>
        {value}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  snoozeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowLeft: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowHint: {
    fontSize: 12,
    lineHeight: 17,
  },
  switchControl: {
    // force hit area compliance on iOS
    transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }],
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeSeparator: {
    fontSize: 14,
    fontWeight: '500',
  },
  timeChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  snoozeChips: {
    flexDirection: 'row',
    gap: 6,
  },
  snoozeChip: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  snoozeChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

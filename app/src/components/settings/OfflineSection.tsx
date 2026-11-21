/**
 * OfflineSection
 *
 * Shows sync state from useOfflineStore:
 *  - Pending changes count (with zero-state)
 *  - Last sync timestamp (human-readable)
 *  - Sync Now button (disabled while syncing)
 *  - Conflict resolution panel (only when conflict exists)
 *
 * Design decisions:
 *  - No skeletons; the initial state is enough (pending=0, lastSyncAt=null).
 *  - The conflict panel appears inline — no modal — to keep the user in context.
 *  - isSyncing uses a spinner inline, not a full-screen overlay.
 */

import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useOfflineStore } from '../../store/useOfflineStore';
import { AnimatedPressable } from '../AnimatedPressable';
import { MilestoneBadge } from '../brand';
import { touchTarget, shadows } from '../../theme';

function formatSyncTime(timestamp: number | null): string {
  if (!timestamp) return 'Never synced';
  const date = new Date(timestamp);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function OfflineSection() {
  const { colors, borderRadius, isDark } = useTheme();
  const { pending, isSyncing, lastSyncAt, conflict, syncNow, resolveConflict } = useOfflineStore();

  const pendingCount = Array.isArray(pending) ? pending.length : 0;
  const hasPending = pendingCount > 0;
  const hasConflict = conflict !== null;

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
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          SYNC & OFFLINE
        </Text>
        {hasConflict && (
          <MilestoneBadge variant="amber" size="sm" label="Conflict" />
        )}
        {!hasConflict && hasPending && (
          <MilestoneBadge variant="ink" size="sm" label={`${pendingCount} pending`} />
        )}
        {!hasConflict && !hasPending && (
          <MilestoneBadge variant="success" size="sm" label="Up to date" />
        )}
      </View>

      {/* Status row */}
      <View style={[styles.statusRow, { borderColor: colors.border }]}>
        <View style={styles.statusLeft}>
          <Text style={[styles.statusLabel, { color: colors.text }]}>Last sync</Text>
          <Text style={[styles.statusValue, { color: colors.textSecondary }]}>
            {formatSyncTime(lastSyncAt)}
          </Text>
        </View>
        {hasPending && (
          <View style={[styles.pendingPill, { backgroundColor: isDark ? colors.amberMuted : '#FEF3C7', borderColor: isDark ? 'rgba(245,158,11,0.35)' : '#FDE68A' }]}>
            <Text style={[styles.pendingText, { color: isDark ? '#FBBF24' : '#92400E' }]}>
              {pendingCount} unsent
            </Text>
          </View>
        )}
      </View>

      {/* Sync button */}
      <AnimatedPressable
        style={[
          styles.syncButton,
          {
            backgroundColor: isSyncing
              ? isDark
                ? colors.surfaceVariant
                : colors.inkMuted
              : colors.primary,
            borderColor: isSyncing ? colors.border : colors.primaryDark,
            borderRadius: borderRadius.md,
            minHeight: touchTarget.comfortable,
          },
        ]}
        disabled={isSyncing}
        onPress={syncNow}
        accessibilityRole="button"
        accessibilityLabel={isSyncing ? 'Syncing now, please wait' : 'Sync now'}
        accessibilityState={{ disabled: isSyncing, busy: isSyncing }}
      >
        {isSyncing ? (
          <ActivityIndicator color={colors.textSecondary} size="small" style={styles.spinner} />
        ) : null}
        <Text
          style={[
            styles.syncButtonText,
            { color: isSyncing ? colors.textSecondary : '#FFFFFF' },
          ]}
        >
          {isSyncing ? 'Syncing…' : 'Sync Now'}
        </Text>
      </AnimatedPressable>

      {/* Conflict resolution panel */}
      {hasConflict && conflict && (
        <View
          style={[
            styles.conflictPanel,
            {
              backgroundColor: isDark ? colors.warningLight : '#FFFBEB',
              borderColor: isDark ? 'rgba(245,158,11,0.35)' : '#FDE68A',
              borderRadius: borderRadius.md,
            },
          ]}
          accessibilityLiveRegion="polite"
          accessibilityLabel="Conflict detected, choose resolution"
        >
          <Text style={[styles.conflictTitle, { color: isDark ? '#FBBF24' : '#92400E' }]}>
            Conflict detected
          </Text>
          <Text style={[styles.conflictDesc, { color: isDark ? '#FBBF24' : '#78350F' }]}>
            {`${conflict.method} ${conflict.endpoint}`}
          </Text>
          <View style={styles.conflictActions}>
            <ConflictButton
              label="Keep local"
              onPress={() => resolveConflict(conflict.id, 'local')}
              colors={colors}
              borderRadius={borderRadius}
              variant="primary"
            />
            <ConflictButton
              label="Use server"
              onPress={() => resolveConflict(conflict.id, 'remote')}
              colors={colors}
              borderRadius={borderRadius}
              variant="secondary"
            />
            <ConflictButton
              label="Retry"
              onPress={() => resolveConflict(conflict.id, 'retry')}
              colors={colors}
              borderRadius={borderRadius}
              variant="tertiary"
            />
          </View>
        </View>
      )}
    </View>
  );
}

// ─── ConflictButton ───────────────────────────────────────────────────────────

type Colors = ReturnType<typeof useTheme>['colors'];
type BR = ReturnType<typeof useTheme>['borderRadius'];

interface ConflictButtonProps {
  label: string;
  onPress: () => void;
  colors: Colors;
  borderRadius: BR;
  variant: 'primary' | 'secondary' | 'tertiary';
}

function ConflictButton({ label, onPress, colors, borderRadius, variant }: ConflictButtonProps) {
  const bg =
    variant === 'primary'
      ? colors.primary
      : variant === 'secondary'
      ? colors.surfaceVariant
      : 'transparent';
  const textColor =
    variant === 'primary'
      ? '#FFFFFF'
      : colors.textSecondary;

  return (
    <AnimatedPressable
      style={[
        styles.conflictBtn,
        {
          backgroundColor: bg,
          borderColor: variant === 'tertiary' ? colors.border : colors.primaryDark,
          borderRadius: borderRadius.sm,
          minHeight: touchTarget.min,
          flex: 1,
        },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.conflictBtnText, { color: textColor }]}>{label}</Text>
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusLeft: {
    gap: 2,
  },
  statusLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  statusValue: {
    fontSize: 13,
  },
  pendingPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  pendingText: {
    fontSize: 12,
    fontWeight: '700',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    gap: 8,
  },
  spinner: {
    marginRight: 4,
  },
  syncButtonText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  conflictPanel: {
    padding: 14,
    borderWidth: 1,
    gap: 10,
  },
  conflictTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  conflictDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  conflictActions: {
    flexDirection: 'row',
    gap: 8,
  },
  conflictBtn: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conflictBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

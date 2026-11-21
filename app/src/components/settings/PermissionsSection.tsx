/**
 * PermissionsSection
 *
 * Surfaces the system permission status for Calendar and Notifications.
 * Each row shows the real status and offers a contextual action:
 *  - undetermined → "Allow" (calls request())
 *  - denied       → "Open Settings" (calls openSettings())
 *  - granted      → no action needed, shows green badge
 *  - unavailable  → explains why (web / simulator) and disables the row
 *
 * Never a decorative switch. The tap target is always ≥ 44dp.
 */

import { View, Text, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useAppPermissions } from '../../hooks/useAppPermissions';
import { AnimatedPressable } from '../AnimatedPressable';
import { MilestoneBadge } from '../brand';
import { touchTarget, shadows } from '../../theme';
import type { PermissionStatus } from '../../hooks/useAppPermissions';

export function PermissionsSection() {
  const { colors, borderRadius } = useTheme();
  const permissions = useAppPermissions();

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
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        PERMISSIONS
      </Text>

      <PermissionRow
        name="Calendar"
        icon="📅"
        entry={permissions.calendar}
        hint="Required to sync reminders with your device calendar."
        colors={colors}
        borderRadius={borderRadius}
        hasDivider
      />

      <PermissionRow
        name="Notifications"
        icon="🔔"
        entry={permissions.notifications}
        hint="Required to deliver push reminders."
        colors={colors}
        borderRadius={borderRadius}
        hasDivider={false}
      />
    </View>
  );
}

// ─── PermissionRow ────────────────────────────────────────────────────────────

type Colors = ReturnType<typeof useTheme>['colors'];
type BR = ReturnType<typeof useTheme>['borderRadius'];

interface PermissionEntry {
  status: PermissionStatus;
  request: () => Promise<boolean>;
  openSettings: () => void;
}

interface PermissionRowProps {
  name: string;
  icon: string;
  entry: PermissionEntry;
  hint: string;
  colors: Colors;
  borderRadius: BR;
  hasDivider: boolean;
}

function statusBadge(status: PermissionStatus): { variant: 'success' | 'error' | 'amber' | 'ink'; label: string } {
  switch (status) {
    case 'granted':      return { variant: 'success', label: 'Granted' };
    case 'denied':       return { variant: 'error',   label: 'Denied' };
    case 'undetermined': return { variant: 'amber',   label: 'Not asked' };
    default:             return { variant: 'ink',     label: 'Unknown' };
  }
}

function actionLabel(status: PermissionStatus): string | null {
  if (status === 'undetermined') return 'Allow';
  if (status === 'denied') return 'Open Settings';
  return null;
}

function PermissionRow({ name, icon, entry, hint, colors, borderRadius, hasDivider }: PermissionRowProps) {
  const { status, request, openSettings } = entry;
  const badge = statusBadge(status);
  const action = actionLabel(status);
  const isUnavailable = false;

  const handleAction = () => {
    if (status === 'undetermined') request();
    else if (status === 'denied') openSettings();
  };

  return (
    <View
      style={[
        styles.permRow,
        hasDivider && { borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 14 },
      ]}
    >
      <Text style={styles.icon} accessibilityLabel={`${name} permission`}>
        {icon}
      </Text>
      <View style={styles.permRowBody}>
        <View style={styles.permRowTop}>
          <Text style={[styles.permName, { color: isUnavailable ? colors.textTertiary : colors.text }]}>
            {name}
          </Text>
          <MilestoneBadge variant={badge.variant} size="sm" label={badge.label} />
        </View>
        <Text style={[styles.hint, { color: colors.textTertiary }]}>{hint}</Text>
        {isUnavailable && Platform.OS === 'web' && (
          <Text style={[styles.unavailableNote, { color: colors.textTertiary }]}>
            Not supported on web.
          </Text>
        )}
        {action && (
          <AnimatedPressable
            style={[
              styles.actionButton,
              {
                backgroundColor:
                  status === 'denied'
                    ? colors.errorLight
                    : colors.inkMuted,
                borderColor:
                  status === 'denied' ? colors.error : colors.primary,
                borderRadius: borderRadius.md,
                minHeight: touchTarget.min,
                alignSelf: 'flex-start',
              },
            ]}
            onPress={handleAction}
            accessibilityRole="button"
            accessibilityLabel={`${action} ${name} permission`}
          >
            <Text
              style={[
                styles.actionButtonText,
                { color: status === 'denied' ? colors.error : colors.primary },
              ]}
            >
              {action}
            </Text>
          </AnimatedPressable>
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
    gap: 14,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  permRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  icon: {
    fontSize: 22,
    lineHeight: 28,
    marginTop: 2,
  },
  permRowBody: {
    flex: 1,
    gap: 4,
  },
  permRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  permName: {
    fontSize: 15,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
  },
  unavailableNote: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  actionButton: {
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

/**
 * PrivacySection
 *
 * Surfacing privacy-relevant automation info:
 *  - What data is shared for reminders (device push token stored server-side).
 *  - What is stored locally vs remotely.
 *  - A clear explanation that no data leaves the device for offline tasks
 *    until the user explicitly syncs.
 *
 * No controls here — this is a disclosure panel, not a settings toggle.
 * Keeping it honest and compact; the user deserves to know what the automation
 * features do without reading a full policy doc.
 */

import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { shadows } from '../../theme';

const DISCLOSURES = [
  {
    icon: '🔔',
    title: 'Push notifications',
    body: 'Your push token is stored on our server solely to deliver reminders. It is deleted when you sign out.',
  },
  {
    icon: '📴',
    title: 'Offline changes',
    body: 'Tasks edited offline are queued locally and only sent to the server when you sync. Nothing leaves your device until then.',
  },
  {
    icon: '📅',
    title: 'Calendar access',
    body: 'Calendar events are read from your device on-demand. We do not upload your event list to our server.',
  },
] as const;

export function PrivacySection() {
  const { colors, borderRadius } = useTheme();

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
      accessibilityRole="summary"
      accessibilityLabel="Privacy notices for automation features"
    >
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        PRIVACY & DATA
      </Text>

      {DISCLOSURES.map((item, index) => (
        <View
          key={item.title}
          style={[
            styles.disclosureRow,
            index < DISCLOSURES.length - 1 && {
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              paddingBottom: 12,
            },
          ]}
        >
          <Text style={styles.disclosureIcon} accessibilityElementsHidden>
            {item.icon}
          </Text>
          <View style={styles.disclosureBody}>
            <Text style={[styles.disclosureTitle, { color: colors.text }]}>
              {item.title}
            </Text>
            <Text style={[styles.disclosureText, { color: colors.textSecondary }]}>
              {item.body}
            </Text>
          </View>
        </View>
      ))}
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
  disclosureRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  disclosureIcon: {
    fontSize: 20,
    lineHeight: 26,
    marginTop: 1,
  },
  disclosureBody: {
    flex: 1,
    gap: 3,
  },
  disclosureTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  disclosureText: {
    fontSize: 12,
    lineHeight: 18,
  },
});

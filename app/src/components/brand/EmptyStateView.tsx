import { View, Text, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { AnimatedPressable } from '../AnimatedPressable';
import { IconEmptyState } from '../icons';
import { useTheme } from '../../hooks';
import { touchTarget } from '../../theme';

interface EmptyStateViewProps {
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function EmptyStateView({
  title,
  subtitle,
  actionLabel,
  onAction,
  style,
}: EmptyStateViewProps) {
  const { colors, borderRadius, isDark } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: borderRadius.lg,
        },
        style,
      ]}
      accessible
      accessibilityRole="text"
    >
      <View style={styles.iconWrapper}>
        <IconEmptyState size={40} color={colors.accent} accessibilityLabel="Estado vacío" />
      </View>

      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {subtitle}
      </Text>

      {actionLabel && onAction ? (
        <AnimatedPressable
          style={[
            styles.actionButton,
            {
              backgroundColor: isDark ? colors.surfaceVariant : colors.primary,
              borderColor: isDark ? colors.borderFocus : colors.primaryDark,
              borderRadius: borderRadius.md,
              minHeight: touchTarget.min,
            },
          ]}
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text
            style={[
              styles.actionButtonText,
              { color: isDark ? colors.primary : '#FFFFFF' },
            ]}
          >
            {actionLabel}
          </Text>
        </AnimatedPressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    gap: 10,
  },
  iconWrapper: {
    marginBottom: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 280,
  },
  actionButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});

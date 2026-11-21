import { View, Text, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from '../../hooks';

export type MilestoneVariant = 'amber' | 'ink' | 'success' | 'error';

interface MilestoneBadgeProps {
  label: string;
  count?: number | string;
  variant?: MilestoneVariant;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}

export function MilestoneBadge({
  label,
  count,
  variant = 'amber',
  size = 'md',
  style,
}: MilestoneBadgeProps) {
  const { colors, borderRadius, isDark } = useTheme();

  const getVariantStyles = () => {
    switch (variant) {
      case 'amber':
        return {
          bg: isDark ? 'rgba(245, 158, 11, 0.16)' : '#FEF3C7',
          border: isDark ? 'rgba(245, 158, 11, 0.35)' : '#FDE68A',
          text: isDark ? '#FBBF24' : '#92400E',
          indicator: colors.accent,
        };
      case 'ink':
        return {
          bg: isDark ? 'rgba(122, 162, 227, 0.16)' : '#EBF1FA',
          border: isDark ? 'rgba(122, 162, 227, 0.35)' : '#D6E2F5',
          text: isDark ? '#9BBBF0' : '#1A365D',
          indicator: colors.primary,
        };
      case 'success':
        return {
          bg: isDark ? 'rgba(16, 185, 129, 0.16)' : '#DCFCE7',
          border: isDark ? 'rgba(16, 185, 129, 0.35)' : '#BBF7D0',
          text: isDark ? '#34D399' : '#065F46',
          indicator: colors.success,
        };
      case 'error':
        return {
          bg: isDark ? 'rgba(239, 68, 68, 0.16)' : '#FEE2E2',
          border: isDark ? 'rgba(239, 68, 68, 0.35)' : '#FECACA',
          text: isDark ? '#F87171' : '#991B1B',
          indicator: colors.error,
        };
    }
  };

  const vStyle = getVariantStyles();
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: vStyle.bg,
          borderColor: vStyle.border,
          borderRadius: borderRadius.md,
          paddingVertical: isSmall ? 3 : 5,
          paddingHorizontal: isSmall ? 8 : 10,
        },
        style,
      ]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${label}${count !== undefined ? `: ${count}` : ''}`}
    >
      <View style={[styles.dot, { backgroundColor: vStyle.indicator }]} />
      <Text
        style={[
          styles.labelText,
          {
            color: vStyle.text,
            fontSize: isSmall ? 11 : 12,
            fontWeight: '600',
          },
        ]}
      >
        {label}
      </Text>
      {count !== undefined && (
        <Text
          style={[
            styles.countText,
            {
              color: vStyle.text,
              fontSize: isSmall ? 11 : 12,
              fontWeight: '700',
            },
          ]}
        >
          {count}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  labelText: {
    letterSpacing: 0.2,
  },
  countText: {
    marginLeft: 2,
  },
});

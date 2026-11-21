import { View, Text, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks';
import { shadows } from '../../theme';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
}

export function BrandLogo({
  size = 'md',
  showWordmark = true,
  subtitle,
  style,
}: BrandLogoProps) {
  const { colors, borderRadius, isDark } = useTheme();

  const iconDimensions = {
    sm: { box: 34, icon: 18, radius: borderRadius.md },
    md: { box: 44, icon: 24, radius: borderRadius.lg },
    lg: { box: 56, icon: 30, radius: borderRadius.xl },
  }[size];

  return (
    <View
      style={[styles.container, style]}
      accessible
      accessibilityRole="header"
      accessibilityLabel="Studia — Gestión Académica"
    >
      <View
        style={[
          styles.emblemContainer,
          shadows.sm,
          {
            width: iconDimensions.box,
            height: iconDimensions.box,
            borderRadius: iconDimensions.radius,
            backgroundColor: isDark ? colors.surfaceVariant : colors.primary,
            borderColor: isDark ? colors.borderFocus : colors.primaryLight,
          },
        ]}
      >
        <Ionicons
          name="book-outline"
          size={iconDimensions.icon}
          color={isDark ? colors.primary : '#FFFFFF'}
        />
        <View
          style={[
            styles.beaconDot,
            {
              backgroundColor: colors.accent,
              borderColor: isDark ? colors.surfaceVariant : colors.primary,
            },
          ]}
        />
      </View>

      {showWordmark && (
        <View style={styles.textBlock}>
          <Text
            style={[
              styles.wordmark,
              {
                color: colors.text,
                fontSize: size === 'lg' ? 22 : size === 'md' ? 18 : 15,
              },
            ]}
          >
            STUDIA
          </Text>
          {subtitle ? (
            <Text
              style={[
                styles.subtitle,
                {
                  color: colors.textSecondary,
                  fontSize: size === 'lg' ? 12 : 11,
                },
              ]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emblemContainer: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  beaconDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1,
  },
  textBlock: {
    justifyContent: 'center',
  },
  wordmark: {
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  subtitle: {
    fontWeight: '500',
    letterSpacing: 0.4,
    marginTop: 1,
  },
});

import { View, Text, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from '../../hooks';
import { shadows } from '../../theme';

interface AcademicHeroCardProps {
  dateLabel?: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function AcademicHeroCard({
  dateLabel,
  title,
  subtitle,
  children,
  style,
}: AcademicHeroCardProps) {
  const { colors, borderRadius, isDark } = useTheme();

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
        style,
      ]}
      accessible
      accessibilityRole="summary"
    >
      {/* Folio binding left spine accent */}
      <View
        style={[
          styles.spineIndicator,
          {
            backgroundColor: isDark ? colors.borderFocus : colors.primary,
          },
        ]}
      >
        <View style={[styles.amberKnot, { backgroundColor: colors.accent }]} />
      </View>

      <View style={styles.cardContent}>
        {dateLabel ? (
          <Text style={[styles.dateText, { color: colors.textSecondary }]}>
            {dateLabel}
          </Text>
        ) : null}

        <Text style={[styles.titleText, { color: colors.text }]}>
          {title}
        </Text>

        {subtitle ? (
          <Text style={[styles.subtitleText, { color: colors.textSecondary }]}>
            {subtitle}
          </Text>
        ) : null}

        {children ? <View style={styles.bodySection}>{children}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    flexDirection: 'row',
  },
  spineIndicator: {
    width: 5,
    justifyContent: 'flex-start',
    paddingTop: 16,
    alignItems: 'center',
  },
  amberKnot: {
    width: 5,
    height: 18,
    borderRadius: 1,
  },
  cardContent: {
    flex: 1,
    padding: 16,
    gap: 6,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  titleText: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bodySection: {
    marginTop: 10,
    gap: 8,
  },
});

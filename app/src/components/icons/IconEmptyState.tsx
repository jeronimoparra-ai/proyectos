import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks';
import type { IconProps } from './types';

export function IconEmptyState({
  size = 52,
  color,
  accessibilityLabel = 'Empty state',
  style,
}: IconProps) {
  const { colors, borderRadius } = useTheme();
  const iconColor = color ?? colors.primary;
  const containerSize = size * 1.5;

  return (
    <View
      style={[
        styles.container,
        {
          width: containerSize,
          height: containerSize,
          borderRadius: borderRadius.full,
          backgroundColor: colors.surfaceVariant,
          borderColor: colors.border,
        },
        style,
      ]}
      accessible={!!accessibilityLabel}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons name="clipboard-outline" size={size} color={iconColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks';
import type { IconProps } from './types';

export function IconCheck({
  size = 14,
  color,
  accessibilityLabel = 'Checked',
  style,
}: IconProps) {
  const { colors } = useTheme();
  const iconColor = color ?? colors.surface;

  return (
    <View
      style={style}
      accessible={!!accessibilityLabel}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons name="checkmark" size={size} color={iconColor} />
    </View>
  );
}

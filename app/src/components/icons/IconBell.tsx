import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks';
import type { IconProps } from './types';

export function IconBell({
  size = 20,
  color,
  accessibilityLabel = 'Notifications',
  style,
}: IconProps) {
  const { colors } = useTheme();
  const iconColor = color ?? colors.textSecondary;

  return (
    <View
      style={style}
      accessible={!!accessibilityLabel}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons name="notifications-outline" size={size} color={iconColor} />
    </View>
  );
}

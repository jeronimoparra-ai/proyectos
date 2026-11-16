import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks';
import type { IconProps } from './types';

export function IconSearch({
  size = 18,
  color,
  accessibilityLabel = 'Search',
  style,
}: IconProps) {
  const { colors } = useTheme();
  const iconColor = color ?? colors.textTertiary;

  return (
    <View
      style={style}
      accessible={!!accessibilityLabel}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons name="search-outline" size={size} color={iconColor} />
    </View>
  );
}

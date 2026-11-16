import type { StyleProp, ViewStyle } from 'react-native';

export interface IconProps {
  size?: number;
  color?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export interface IconChevronProps extends IconProps {
  direction?: 'up' | 'down' | 'left' | 'right';
}

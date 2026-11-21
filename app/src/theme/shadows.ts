import { Platform, type ViewStyle } from 'react-native';

export const shadows: Record<'none' | 'sm' | 'md' | 'lg', ViewStyle> = {
  none: {
    elevation: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  sm: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#14171F',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
    },
    android: {
      elevation: 2,
    },
    default: {
      shadowColor: '#14171F',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
    },
  })!,
  md: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#14171F',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
    },
    android: {
      elevation: 4,
    },
    default: {
      shadowColor: '#14171F',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
    },
  })!,
  lg: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#14171F',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
    },
    android: {
      elevation: 8,
    },
    default: {
      shadowColor: '#14171F',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
    },
  })!,
};

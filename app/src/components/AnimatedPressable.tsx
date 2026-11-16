import { useRef, useEffect, useState, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  AccessibilityInfo,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
  type Insets,
  type AccessibilityRole,
  type AccessibilityState,
} from 'react-native';
import { animation } from '../theme/animation';

export interface AnimatedPressableProps {
  onPress?: (event: GestureResponderEvent) => void;
  onPressIn?: (event: GestureResponderEvent) => void;
  onPressOut?: (event: GestureResponderEvent) => void;
  scaleTo?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  // Estilo del Pressable exterior: util para layout (flex) sin animar el fondo.
  containerStyle?: StyleProp<ViewStyle>;
  hitSlop?: Insets | number;
  accessible?: boolean;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
  children: ReactNode;
}

export function AnimatedPressable({
  onPress,
  onPressIn,
  onPressOut,
  scaleTo = animation.scale.pressed,
  disabled = false,
  style,
  containerStyle,
  hitSlop,
  accessible,
  accessibilityRole = 'button',
  accessibilityLabel,
  accessibilityState,
  children,
}: AnimatedPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let isMounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (isMounted) setReduceMotion(enabled);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
      scale.stopAnimation();
    };
  }, [scale]);

  const handlePressIn = (event: GestureResponderEvent) => {
    if (!disabled && !reduceMotion) {
      Animated.spring(scale, {
        toValue: scaleTo,
        tension: animation.spring.press.tension,
        friction: animation.spring.press.friction,
        useNativeDriver: true,
      }).start();
    }
    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    if (!disabled && !reduceMotion) {
      Animated.spring(scale, {
        toValue: animation.scale.normal,
        tension: animation.spring.press.tension,
        friction: animation.spring.press.friction,
        useNativeDriver: true,
      }).start();
    }
    onPressOut?.(event);
  };

  return (
    <Pressable
      style={containerStyle}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      hitSlop={hitSlop}
      accessible={accessible ?? !!accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState ?? { disabled }}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

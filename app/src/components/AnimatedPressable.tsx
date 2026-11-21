import { useRef, useEffect, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
  type Insets,
  type AccessibilityRole,
  type AccessibilityState,
} from 'react-native';
import { animation } from '../theme/animation';
import { useReducedMotion } from '../hooks';

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
  const scaleRef = useRef<Animated.Value | null>(null);
  if (!scaleRef.current) {
    scaleRef.current = new Animated.Value(1);
  }
  const scale = scaleRef.current;

  const activeAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    return () => {
      if (activeAnimRef.current) {
        activeAnimRef.current.stop();
        activeAnimRef.current = null;
      }
      scale.stopAnimation();
    };
  }, [scale]);

  const handlePressIn = (event: GestureResponderEvent) => {
    if (!disabled && !reduceMotion) {
      if (activeAnimRef.current) {
        activeAnimRef.current.stop();
      }
      activeAnimRef.current = Animated.spring(scale, {
        toValue: scaleTo,
        tension: animation.spring.press.tension,
        friction: animation.spring.press.friction,
        useNativeDriver: true,
      });
      activeAnimRef.current.start(() => {
        activeAnimRef.current = null;
      });
    }
    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    if (!disabled && !reduceMotion) {
      if (activeAnimRef.current) {
        activeAnimRef.current.stop();
      }
      activeAnimRef.current = Animated.spring(scale, {
        toValue: animation.scale.normal,
        tension: animation.spring.press.tension,
        friction: animation.spring.press.friction,
        useNativeDriver: true,
      });
      activeAnimRef.current.start(() => {
        activeAnimRef.current = null;
      });
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

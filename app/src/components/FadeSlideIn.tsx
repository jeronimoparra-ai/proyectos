import { useRef, useEffect, type ReactNode } from 'react';
import {
  Animated,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { animation } from '../theme/animation';
import { useReducedMotion } from '../hooks';

export interface FadeSlideInProps {
  index?: number;
  delay?: number;
  duration?: number;
  slideDistance?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

// Limitar animaciones simultaneas masivas en listados largos
const MAX_ANIMATED_INDEX = 8;

export function FadeSlideIn({
  index = 0,
  delay,
  duration = animation.duration.normal,
  slideDistance = 16,
  direction = 'up',
  style,
  children,
}: FadeSlideInProps) {
  const initialOffset =
    direction === 'up' || direction === 'left' ? slideDistance : -slideDistance;

  // Lazy init de Animated.Value
  const opacityRef = useRef<Animated.Value | null>(null);
  if (!opacityRef.current) {
    opacityRef.current = new Animated.Value(0);
  }
  const opacity = opacityRef.current;

  const translateRef = useRef<Animated.Value | null>(null);
  if (!translateRef.current) {
    translateRef.current = new Animated.Value(initialOffset);
  }
  const translate = translateRef.current;

  const reduceMotion = useReducedMotion();
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    // Si reduce motion esta activo o el indice supera el limite de concurrencia,
    // mostrar directamente sin disparar animaciones masivas
    if (reduceMotion || index > MAX_ANIMATED_INDEX) {
      opacity.setValue(1);
      translate.setValue(0);
      return;
    }

    const computedDelay =
      delay !== undefined
        ? delay
        : Math.min(index * animation.staggerDelay, 250);

    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay: computedDelay,
        useNativeDriver: true,
      }),
      Animated.spring(translate, {
        toValue: 0,
        delay: computedDelay,
        tension: animation.spring.gentle.tension,
        friction: animation.spring.gentle.friction,
        useNativeDriver: true,
      }),
    ]);
    animRef.current = anim;

    anim.start(() => {
      animRef.current = null;
    });

    return () => {
      if (animRef.current) {
        animRef.current.stop();
        animRef.current = null;
      }
      opacity.stopAnimation();
      translate.stopAnimation();
    };
  }, [index, delay, duration, opacity, translate, reduceMotion]);

  const isHorizontal = direction === 'left' || direction === 'right';
  const transform = isHorizontal
    ? [{ translateX: translate }]
    : [{ translateY: translate }];

  return (
    <Animated.View style={[{ opacity, transform }, style]}>
      {children}
    </Animated.View>
  );
}

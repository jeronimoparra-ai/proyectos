import { useRef, useEffect, type ReactNode } from 'react';
import {
  Animated,
  AccessibilityInfo,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { animation } from '../theme/animation';

export interface FadeSlideInProps {
  index?: number;
  delay?: number;
  duration?: number;
  slideDistance?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

export function FadeSlideIn({
  index = 0,
  delay,
  duration = animation.duration.normal,
  slideDistance = 16,
  direction = 'up',
  style,
  children,
}: FadeSlideInProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const initialOffset =
    direction === 'up' || direction === 'left' ? slideDistance : -slideDistance;
  const translate = useRef(new Animated.Value(initialOffset)).current;

  useEffect(() => {
    let isMounted = true;
    let anim: Animated.CompositeAnimation | null = null;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (!isMounted) return;
        if (reduced) {
          opacity.setValue(1);
          translate.setValue(0);
          return;
        }

        const computedDelay =
          delay !== undefined
            ? delay
            : Math.min(index * animation.staggerDelay, 300);

        anim = Animated.parallel([
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

        anim.start();
      })
      .catch(() => {
        if (!isMounted) return;
        opacity.setValue(1);
        translate.setValue(0);
      });

    return () => {
      isMounted = false;
      if (anim) {
        anim.stop();
      }
      opacity.stopAnimation();
      translate.stopAnimation();
    };
  }, [index, delay, duration, opacity, translate]);

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

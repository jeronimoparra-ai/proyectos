export const animation = {
  duration: {
    fast: 150,
    normal: 250,
    slow: 400,
    shimmer: 850,
  },
  spring: {
    press: {
      tension: 120,
      friction: 8,
      useNativeDriver: true,
    },
    gentle: {
      tension: 70,
      friction: 10,
      useNativeDriver: true,
    },
  },
  scale: {
    pressed: 0.97,
    normal: 1,
  },
  staggerDelay: 50,
} as const;

export type AnimationConfig = typeof animation;

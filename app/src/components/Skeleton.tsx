import { useRef, useEffect, useState } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  AccessibilityInfo,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../hooks';
import { animation } from '../theme/animation';

export interface SkeletonBoxProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export function SkeletonBox({
  width = '100%',
  height = 16,
  borderRadius: customRadius,
  style,
}: SkeletonBoxProps) {
  const { colors, borderRadius } = useTheme();
  const opacity = useRef(new Animated.Value(0.35)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let loopAnim: Animated.CompositeAnimation | null = null;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (!isMounted) return;
        if (reduced) {
          setReduceMotion(true);
          opacity.setValue(0.6);
          return;
        }

        loopAnim = Animated.loop(
          Animated.sequence([
            Animated.timing(opacity, {
              toValue: 0.85,
              duration: animation.duration.shimmer,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0.35,
              duration: animation.duration.shimmer,
              useNativeDriver: true,
            }),
          ])
        );
        loopAnim.start();
      })
      .catch(() => {
        if (!isMounted) return;
        opacity.setValue(0.6);
      });

    return () => {
      isMounted = false;
      if (loopAnim) {
        loopAnim.stop();
      }
      opacity.stopAnimation();
    };
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: customRadius ?? borderRadius.sm,
          backgroundColor: colors.surfaceVariant,
          opacity: reduceMotion ? 0.6 : opacity,
        },
        style,
      ]}
    />
  );
}

export interface SkeletonCardProps {
  style?: StyleProp<ViewStyle>;
}

export function SkeletonCard({ style }: SkeletonCardProps) {
  const { colors, borderRadius } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.lg,
          borderLeftColor: colors.border,
        },
        style,
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <SkeletonBox width={22} height={22} borderRadius={borderRadius.full} />
          <SkeletonBox width="60%" height={16} />
        </View>
        <SkeletonBox width={50} height={20} borderRadius={borderRadius.sm} />
      </View>
      <View style={styles.cardBody}>
        <SkeletonBox width="80%" height={12} />
        <SkeletonBox width="45%" height={12} />
      </View>
      <View style={styles.cardFooter}>
        <SkeletonBox width={60} height={12} />
        <SkeletonBox width={80} height={12} />
      </View>
    </View>
  );
}

export interface ScreenSkeletonProps {
  count?: number;
  style?: StyleProp<ViewStyle>;
}

export function ScreenSkeleton({ count = 3, style }: ScreenSkeletonProps) {
  return (
    <View style={[styles.skeletonContainer, style]}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    borderLeftWidth: 4,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  cardBody: {
    gap: 6,
    marginLeft: 34,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginLeft: 34,
  },
  skeletonContainer: {
    paddingTop: 8,
  },
});

import { useEffect } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  AppState,
  type AppStateStatus,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme, useReducedMotion } from '../hooks';
import { animation } from '../theme/animation';
import { cardStyles } from '../theme/cardStyles';

// Controlador compartido de Shimmer para evitar decenas de loops concurrentes
class SharedShimmerController {
  private loopAnim: Animated.CompositeAnimation | null = null;
  private subscriberCount = 0;
  private appStateSubscription: { remove: () => void } | null = null;
  private isAppActive = true;
  private opacityValue: Animated.Value | null = null;

  // Lazy init de Animated.Value
  get opacity(): Animated.Value {
    if (!this.opacityValue) {
      this.opacityValue = new Animated.Value(0.35);
    }
    return this.opacityValue;
  }

  private start() {
    if (this.loopAnim !== null || !this.isAppActive || this.subscriberCount === 0) {
      return;
    }

    this.loopAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(this.opacity, {
          toValue: 0.85,
          duration: animation.duration.shimmer,
          useNativeDriver: true,
        }),
        Animated.timing(this.opacity, {
          toValue: 0.35,
          duration: animation.duration.shimmer,
          useNativeDriver: true,
        }),
      ])
    );
    this.loopAnim.start();
  }

  private stop() {
    if (this.loopAnim) {
      this.loopAnim.stop();
      this.loopAnim = null;
    }
    if (this.opacityValue) {
      this.opacityValue.stopAnimation();
    }
  }

  handleAppStateChange = (nextState: AppStateStatus) => {
    const isNowActive = nextState === 'active';
    if (isNowActive && !this.isAppActive) {
      this.isAppActive = true;
      if (this.subscriberCount > 0) {
        this.start();
      }
    } else if (!isNowActive && this.isAppActive) {
      this.isAppActive = false;
      this.stop();
    }
  };

  subscribe(reduceMotion: boolean): () => void {
    if (reduceMotion) {
      return () => {};
    }

    this.subscriberCount++;
    if (this.subscriberCount === 1) {
      this.isAppActive = AppState.currentState === 'active';
      this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
      if (this.isAppActive) {
        this.start();
      }
    }

    return () => {
      this.subscriberCount--;
      if (this.subscriberCount <= 0) {
        this.subscriberCount = 0;
        this.stop();
        if (this.appStateSubscription) {
          this.appStateSubscription.remove();
          this.appStateSubscription = null;
        }
      }
    };
  }

  getSubscriberCount(): number {
    return this.subscriberCount;
  }

  isRunning(): boolean {
    return this.loopAnim !== null;
  }

  reset() {
    this.stop();
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.subscriberCount = 0;
    this.isAppActive = true;
  }
}

export const sharedShimmer = new SharedShimmerController();

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
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    return sharedShimmer.subscribe(reduceMotion);
  }, [reduceMotion]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: customRadius ?? borderRadius.sm,
          backgroundColor: colors.surfaceVariant,
          opacity: reduceMotion ? 0.6 : sharedShimmer.opacity,
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
        cardStyles.cardContainer,
        cardStyles.cardBorderLeft,
        styles.cardPadding,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.lg,
          borderLeftColor: colors.border,
        },
        style,
      ]}
    >
      <View style={cardStyles.headerRow}>
        <View style={cardStyles.titleRow}>
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
  cardPadding: {
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

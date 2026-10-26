import * as Haptics from 'expo-haptics';
import { ReactNode } from 'react';
import { Platform, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type Weight = 'light' | 'medium' | 'heavy' | 'select' | 'none';

/** Haptics throw on web, so every call goes through this guard. */
export function haptic(weight: Weight = 'light') {
  if (Platform.OS === 'web' || weight === 'none') return;
  if (weight === 'select') {
    void Haptics.selectionAsync();
    return;
  }
  const style =
    weight === 'heavy'
      ? Haptics.ImpactFeedbackStyle.Heavy
      : weight === 'medium'
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light;
  void Haptics.impactAsync(style);
}

export function notify(type: 'success' | 'warning' | 'error' = 'success') {
  if (Platform.OS === 'web') return;
  const map = {
    success: Haptics.NotificationFeedbackType.Success,
    warning: Haptics.NotificationFeedbackType.Warning,
    error: Haptics.NotificationFeedbackType.Error,
  } as const;
  void Haptics.notificationAsync(map[type]);
}

type TapProps = Omit<PressableProps, 'style'> & {
  children: ReactNode;
  /** Accepts the usual falsy-entry arrays so callers can inline conditionals. */
  style?: StyleProp<ViewStyle>;
  /** How far it compresses. Big surfaces should move less than small ones. */
  scale?: number;
  weight?: Weight;
};

/**
 * A pressable that physically responds.
 *
 * Springs down on touch and overshoots very slightly on release, the thing
 * that separates an app that feels alive from one that feels like a web page.
 */
export function Tap({
  children,
  style,
  scale = 0.96,
  weight = 'light',
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: TapProps) {
  const s = useSharedValue(1);
  const dim = useSharedValue(1);

  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: s.value }],
    opacity: dim.value,
  }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        s.value = withSpring(scale, { damping: 18, stiffness: 420, mass: 0.5 });
        dim.value = withTiming(0.82, { duration: 90 });
        haptic(weight);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.value = withSpring(1, { damping: 12, stiffness: 320, mass: 0.6 });
        dim.value = withTiming(1, { duration: 160 });
        onPressOut?.(e);
      }}
      style={[style, anim, disabled ? { opacity: 0.4 } : null]}>
      {children}
    </AnimatedPressable>
  );
}

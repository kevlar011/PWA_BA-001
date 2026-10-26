import { ReactNode, useEffect, useRef, useState } from 'react';
import { View, ViewProps } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

/* -------------------------------------------------------------------------- */
/* Entrances                                                                  */
/* -------------------------------------------------------------------------- */

/** Content that slides up as it appears. Stagger with `delay`. */
export function Rise({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode;
  delay?: number;
  style?: ViewProps['style'];
}) {
  return (
    <Animated.View entering={FadeInDown.duration(340).delay(delay).springify().damping(18)} style={style}>
      {children}
    </Animated.View>
  );
}

export function Fade({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode;
  delay?: number;
  style?: ViewProps['style'];
}) {
  return (
    <Animated.View entering={FadeIn.duration(300).delay(delay)} style={style}>
      {children}
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/* Rolling numbers                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Eases a number toward its target so balances roll rather than snap.
 *
 * Driven on the JS thread with rAF rather than Reanimated: animating the
 * *text content* of a node needs the value back in JS anyway, and this keeps
 * it readable on web and native alike.
 */
export function useRolling(target: number, ms = 550): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const origin = from.current;
    const delta = target - origin;
    if (delta === 0) return;

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      // easeOutCubic, fast to start, settles gently.
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(origin + delta * eased);
      setValue(next);
      from.current = next;
      if (t < 1) raf.current = requestAnimationFrame(step);
    };

    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [target, ms]);

  return value;
}

/* -------------------------------------------------------------------------- */
/* Ambient motion                                                             */
/* -------------------------------------------------------------------------- */

/** Slow vertical bob. Used to stop panels feeling nailed down. */
export function Bob({
  children,
  distance = 3,
  ms = 2600,
  style,
}: {
  children: ReactNode;
  distance?: number;
  ms?: number;
  style?: ViewProps['style'];
}) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withRepeat(
      withSequence(
        withTiming(-distance, { duration: ms, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: ms, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, [y, distance, ms]);

  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

/** Pulsing opacity, for anything that wants attention without shouting. */
export function Pulse({
  children,
  min = 0.45,
  ms = 1100,
  style,
}: {
  children: ReactNode;
  min?: number;
  ms?: number;
  style?: ViewProps['style'];
}) {
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = withRepeat(
      withSequence(withTiming(min, { duration: ms }), withTiming(1, { duration: ms })),
      -1,
      false
    );
  }, [o, min, ms]);

  const anim = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

/**
 * A bar sweeping back and forth inside a track, like a radar returning.
 *
 * Used instead of a pulse where something should read as *actively looking*
 * rather than merely waiting.
 */
export function Scan({
  width,
  tone,
  height = 2,
  ms = 1700,
}: {
  width: number;
  tone: string;
  height?: number;
  ms?: number;
}) {
  const head = width * 0.34;
  const x = useSharedValue(0);

  useEffect(() => {
    x.value = withRepeat(
      withSequence(
        withTiming(width - head, { duration: ms, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: ms, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, [x, width, head, ms]);

  const anim = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={{ width, height, backgroundColor: `${tone}30`, overflow: 'hidden' }}>
      <Animated.View style={[{ width: head, height, backgroundColor: tone }, anim]} />
    </View>
  );
}

/** Types a string out one character at a time. */
export function useTypewriter(text: string, cps = 55): string {
  const [shown, setShown] = useState('');
  useEffect(() => {
    setShown('');
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 1000 / cps);
    return () => clearInterval(id);
  }, [text, cps]);
  return shown;
}

export { Animated, View as PlainView };

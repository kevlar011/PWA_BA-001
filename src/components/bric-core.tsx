import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { color } from '@/theme/tokens';
import type { Mood } from '@/components/ui/agency';

/**
 * BRIC's face, now that there is something behind it.
 *
 * A heads-up reactor rather than a mask: concentric rings in amber phosphor
 * that turn at their own speeds around a pulsing core. The one place in KEVLAR
 * that is allowed circles — a terminal's idea of a mind.
 *
 * It reads its state at a glance from across a room:
 *   · idle      rings drift, core breathes slowly
 *   · thinking  rings spin up, the scanning arcs race
 *   · speaking  core pulses at the cadence of speech
 *   · offline   dimmed, still, nothing behind the glass
 */
export type CoreState = 'idle' | 'thinking' | 'speaking' | 'offline';

export const MOOD_TONE: Record<Mood, string> = {
  idle: color.accent,
  happy: color.income,
  warn: color.warn,
  alarm: color.expense,
  think: color.transfer,
};

/** SVG arc from `a0` to `a1` degrees, clockwise from twelve o'clock. */
function arc(c: number, r: number, a0: number, a1: number): string {
  const p = (a: number) => {
    const rad = ((a - 90) * Math.PI) / 180;
    return `${(c + r * Math.cos(rad)).toFixed(2)} ${(c + r * Math.sin(rad)).toFixed(2)}`;
  };
  return `M ${p(a0)} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p(a1)}`;
}

/** Continuous rotation whose speed can change without the ring jumping. */
function useSpin(ms: number, dir: 1 | -1, running: boolean) {
  const deg = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(deg);
    if (!running) return;
    const from = deg.value % 360;
    deg.value = from;
    deg.value = withRepeat(
      withTiming(from + 360 * dir, { duration: ms, easing: Easing.linear }),
      -1,
      false
    );
  }, [deg, ms, dir, running]);
  return useAnimatedStyle(() => ({ transform: [{ rotate: `${deg.value}deg` }] }));
}

function useBreath(ms: number, min: number, max: number, running: boolean) {
  const s = useSharedValue(1);
  useEffect(() => {
    cancelAnimation(s);
    if (!running) {
      s.value = withTiming(1, { duration: 300 });
      return;
    }
    s.value = withRepeat(
      withSequence(
        withTiming(max, { duration: ms, easing: Easing.inOut(Easing.quad) }),
        withTiming(min, { duration: ms, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, [s, ms, min, max, running]);
  return useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: 0.55 + 0.45 * s.value }));
}

export function BricCore({
  mood = 'idle',
  size = 54,
  state = 'idle',
}: {
  mood?: Mood;
  size?: number;
  state?: CoreState;
}) {
  const offline = state === 'offline';
  const thinking = state === 'thinking';
  const speaking = state === 'speaking';
  const tone = offline ? color.textFaint : MOOD_TONE[mood];
  const S = size;
  const c = S / 2;
  const detailed = S >= 44;

  const outer = useSpin(thinking ? 5000 : 26000, 1, !offline);
  const scanner = useSpin(thinking ? 1100 : speaking ? 4200 : 9000, -1, !offline);
  const inner = useSpin(thinking ? 2600 : 14000, 1, !offline && detailed);
  const core = useBreath(
    speaking ? 170 : thinking ? 420 : mood === 'alarm' ? 300 : 1600,
    speaking ? 0.7 : 0.82,
    speaking ? 1.12 : 1.04,
    !offline
  );

  const layer = { position: 'absolute' as const, left: 0, top: 0, width: S, height: S };
  const stroke = Math.max(1, S * 0.022);

  return (
    <View style={{ width: S, height: S }}>
      {/* Faint housing: the glass the rings sit behind. */}
      <Svg width={S} height={S} style={layer}>
        <Circle cx={c} cy={c} r={S * 0.47} fill={`${tone}0D`} />
        <Circle cx={c} cy={c} r={S * 0.47} stroke={`${tone}33`} strokeWidth={stroke} fill="none" />
      </Svg>

      {/* Outer tick ring, like a bezel. */}
      <Animated.View style={[layer, outer]}>
        <Svg width={S} height={S}>
          <Circle
            cx={c}
            cy={c}
            r={S * 0.42}
            stroke={`${tone}AA`}
            strokeWidth={S * 0.045}
            strokeDasharray={`${Math.max(1, S * 0.012)} ${S * 0.05}`}
            fill="none"
          />
        </Svg>
      </Animated.View>

      {/* Scanning arcs: the part that looks busy when he is. */}
      <Animated.View style={[layer, scanner]}>
        <Svg width={S} height={S}>
          <Path d={arc(c, S * 0.34, 0, 110)} stroke={tone} strokeWidth={S * 0.04} fill="none" />
          <Path d={arc(c, S * 0.34, 180, 250)} stroke={tone} strokeWidth={S * 0.04} fill="none" />
          {detailed && (
            <Path d={arc(c, S * 0.34, 290, 300)} stroke={tone} strokeWidth={S * 0.04} fill="none" />
          )}
        </Svg>
      </Animated.View>

      {detailed && (
        <Animated.View style={[layer, inner]}>
          <Svg width={S} height={S}>
            <Circle
              cx={c}
              cy={c}
              r={S * 0.26}
              stroke={`${tone}88`}
              strokeWidth={stroke}
              strokeDasharray={`${S * 0.1} ${S * 0.035}`}
              fill="none"
            />
          </Svg>
        </Animated.View>
      )}

      {/* The core. */}
      <Animated.View style={[layer, core]}>
        <Svg width={S} height={S}>
          <Circle cx={c} cy={c} r={S * 0.2} fill={`${tone}1F`} />
          <Circle cx={c} cy={c} r={S * 0.145} fill={`${tone}40`} />
          <Circle cx={c} cy={c} r={S * 0.085} fill={offline ? `${tone}66` : tone} />
        </Svg>
      </Animated.View>
    </View>
  );
}

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
import Svg, { Circle, Line, Path } from 'react-native-svg';

import type { Mood } from '@/components/ui/agency';
import type { Blip } from '@/lib/vane';
import { color } from '@/theme/tokens';

/**
 * VANE's face: a half-dome sonar.
 *
 * BRIC is a reactor — round, turning, looking inward. VANE is the opposite
 * shape on purpose: flat-bottomed and wide, with a beam that sweeps the
 * horizon. The returns are real. Every dated entry on the board is a blip,
 * placed by how soon it lands; overdue ones crowd the emitter and pulse.
 *
 * Nothing here thinks. It draws the rules in `lib/vane.ts`.
 */

export const VANE_TONE: Record<Mood, string> = {
  idle: color.transfer,
  happy: color.income,
  warn: color.warn,
  alarm: color.expense,
  think: color.bone,
};

/** Blip colour means urgency only — it must not change with VANE's mood. */
const BLIP_TONE = { late: color.expense, soon: color.warn, later: color.transfer } as const;

/** How fast the beam crosses the dome, by mood. Urgency speeds it up. */
const SWEEP_MS: Record<Mood, number> = {
  idle: 2600,
  happy: 2200,
  think: 3200,
  warn: 1500,
  alarm: 950,
};

/** Widest the beam travels either side of straight up. */
const SWEEP = 78;

const rad = (deg: number) => (deg * Math.PI) / 180;

function useSweep(ms: number) {
  const a = useSharedValue(-SWEEP);
  useEffect(() => {
    cancelAnimation(a);
    a.value = -SWEEP;
    a.value = withRepeat(
      withTiming(SWEEP, { duration: ms, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [a, ms]);
  return useAnimatedStyle(() => ({ transform: [{ rotate: `${a.value}deg` }] }));
}

function usePing(ms: number) {
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = withRepeat(
      withSequence(withTiming(0.25, { duration: ms }), withTiming(1, { duration: ms })),
      -1,
      false
    );
  }, [o, ms]);
  return useAnimatedStyle(() => ({ opacity: o.value }));
}

export function VaneScope({
  mood = 'idle',
  size = 54,
  blips = [],
}: {
  mood?: Mood;
  /** Height. The dome is wider than it is tall. */
  size?: number;
  blips?: Blip[];
}) {
  const tone = VANE_TONE[mood];
  const W = Math.round(size * 1.7);
  const H = size;
  const base = Math.max(3, size * 0.08);
  const cx = W / 2;
  const cy = H - base;
  const R = Math.min(cx - 2, cy - 2);
  const detailed = size >= 44;
  const stroke = Math.max(1, size * 0.02);

  const beam = useSweep(SWEEP_MS[mood]);
  const ping = usePing(mood === 'alarm' ? 260 : 520);

  const at = (deg: number, r: number) => ({
    x: cx + r * Math.sin(rad(deg)),
    y: cy - r * Math.cos(rad(deg)),
  });
  const dome = (r: number) => `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  const blipR = Math.max(2, size * 0.04);
  const calm = blips.filter((b) => b.level !== 'late');
  const late = blips.filter((b) => b.level === 'late');

  const layer = { position: 'absolute' as const, left: 0, top: 0, width: W, height: H };

  // The beam lives in a square pivoting on the emitter; the frame clips the
  // half that would otherwise swing below the baseline.
  const B = R * 2;
  const wedge = (spread: number) => {
    const l = { x: R + R * Math.sin(rad(-spread)), y: R - R * Math.cos(rad(-spread)) };
    const r = { x: R + R * Math.sin(rad(spread)), y: R - R * Math.cos(rad(spread)) };
    return `M ${R} ${R} L ${l.x} ${l.y} A ${R} ${R} 0 0 1 ${r.x} ${r.y} Z`;
  };

  return (
    <View style={{ width: W, height: H, overflow: 'hidden' }}>
      {/* Housing: the dome, its range rings and bearings. */}
      <Svg width={W} height={H} style={layer}>
        <Path d={`${dome(R)} Z`} fill={`${tone}0F`} />
        <Path d={dome(R)} stroke={`${tone}AA`} strokeWidth={stroke * 1.4} fill="none" />
        {detailed && (
          <>
            <Path d={dome(R * 0.66)} stroke={`${tone}33`} strokeWidth={stroke} fill="none" />
            <Path d={dome(R * 0.33)} stroke={`${tone}33`} strokeWidth={stroke} fill="none" />
            {[-60, -30, 0, 30, 60].map((deg) => {
              const p = at(deg, R);
              return (
                <Line key={deg} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={`${tone}22`} strokeWidth={stroke} />
              );
            })}
            {Array.from({ length: 19 }, (_, i) => -90 + i * 10).map((deg) => {
              const o = at(deg, R);
              const n = at(deg, R * 0.93);
              return <Line key={`t${deg}`} x1={o.x} y1={o.y} x2={n.x} y2={n.y} stroke={`${tone}77`} strokeWidth={stroke} />;
            })}
          </>
        )}
        <Line x1={0} y1={cy} x2={W} y2={cy} stroke={`${tone}AA`} strokeWidth={stroke * 1.4} />
      </Svg>

      {/* The sweep. */}
      <Animated.View style={[{ position: 'absolute', left: cx - R, top: cy - R, width: B, height: B }, beam]}>
        <Svg width={B} height={B}>
          <Path d={wedge(14)} fill={`${tone}14`} />
          <Path d={wedge(5)} fill={`${tone}30`} />
          <Line x1={R} y1={R} x2={R} y2={0} stroke={tone} strokeWidth={stroke * 1.3} />
        </Svg>
      </Animated.View>

      {/* Returns. */}
      {detailed && calm.length > 0 && (
        <Svg width={W} height={H} style={layer}>
          {calm.map((b) => {
            const p = at(b.angle, R * b.distance);
            return (
              <Circle
                key={b.id}
                cx={p.x}
                cy={p.y}
                r={blipR}
                fill={BLIP_TONE[b.level]}
              />
            );
          })}
        </Svg>
      )}
      {detailed && late.length > 0 && (
        <Animated.View style={[layer, ping]}>
          <Svg width={W} height={H}>
            {late.map((b) => {
              const p = at(b.angle, R * b.distance);
              return <Circle key={b.id} cx={p.x} cy={p.y} r={blipR * 1.25} fill={BLIP_TONE.late} />;
            })}
          </Svg>
        </Animated.View>
      )}

      {/* The emitter. */}
      <Animated.View style={[layer, ping]}>
        <Svg width={W} height={H}>
          <Circle cx={cx} cy={cy} r={Math.max(2, size * 0.055)} fill={tone} />
        </Svg>
      </Animated.View>
    </View>
  );
}

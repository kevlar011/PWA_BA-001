import { ReactNode, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BricCore, MOOD_TONE, type CoreState } from '@/components/bric-core';
import { useBric } from '@/lib/bric-store';
import { useStore } from '@/lib/store';
import { color, glyph, mono, radius, space } from '@/theme/tokens';
import { Bob, Pulse, Scan } from './motion';
import { Row, Txt } from './primitives';

/* -------------------------------------------------------------------------- */
/* Agency furniture                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Document header. Every screen is a form issued by an authority that takes
 * itself far too seriously, which is the joke.
 */
export function FileHeader({
  title,
  code,
  subtitle,
  right,
}: {
  title: string;
  code: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View style={{ marginBottom: space.lg }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Txt variant="micro" spaced tone={color.rust} weight="bold">
            {`FORM ${code}`}
          </Txt>
          <Txt variant="title" weight="bold" spaced style={{ marginTop: 2 }}>
            {title.toUpperCase()}
          </Txt>
          {subtitle ? (
            <Txt variant="micro" faint style={{ marginTop: 3 }}>
              {subtitle}
            </Txt>
          ) : null}
        </View>
        {right}
      </Row>
      <View style={s.doubleRule}>
        <View style={s.ruleThick} />
        <View style={s.ruleThin} />
      </View>
    </View>
  );
}

/**
 * A form row with dotted leaders running from label to value, the way a
 * printed ledger does it.
 */
export function LeaderRow({
  label,
  value,
  tone,
  bold,
}: {
  label: string;
  value: string;
  tone?: string;
  bold?: boolean;
}) {
  return (
    <Row style={{ marginVertical: 3 }}>
      <Txt variant="caption" dim numberOfLines={1}>
        {label.toUpperCase()}
      </Txt>
      <View style={s.leader}>
        <Txt variant="caption" tone={color.surfacePress} numberOfLines={1}>
          {'.'.repeat(60)}
        </Txt>
      </View>
      <Txt variant="caption" weight={bold ? 'bold' : 'medium'} tone={tone}>
        {value}
      </Txt>
    </Row>
  );
}

/** Rubber stamp. Slightly rotated, outlined, deliberately imperfect. */
export function Stamp({
  text,
  tone = color.stamp,
  angle = -8,
}: {
  text: string;
  tone?: string;
  angle?: number;
}) {
  return (
    <View style={[s.stamp, { borderColor: tone, transform: [{ rotate: `${angle}deg` }] }]}>
      <Txt variant="micro" weight="bold" spaced tone={tone}>
        {text.toUpperCase()}
      </Txt>
    </View>
  );
}

/** Small caps field label used above inputs on form-like screens. */
export function FieldLabel({ children }: { children: string }) {
  return (
    <Txt variant="micro" spaced tone={color.boneDim} weight="bold" style={{ marginBottom: space.sm }}>
      {`${children.toUpperCase()} ${glyph.rule.repeat(2)}`}
    </Txt>
  );
}

/* -------------------------------------------------------------------------- */
/* Mascot                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The units. Original constructs, not licensed characters.
 *
 * KEVLAR runs one per subsystem, and they must be tellable apart at a glance
 * from across a room:
 *
 *   · BRIC — banking. A live intelligence, drawn as a HUD reactor of turning
 *     rings (`bric-core.tsx`). Spins up when he thinks.
 *   · VANE — the docket. A wide ASCII sensor housing. Does not blink; it sweeps.
 */
export type Mood = 'idle' | 'happy' | 'warn' | 'alarm' | 'think';

type UnitSpec = {
  faces: Record<Mood, string>;
  tones: Record<Mood, string>;
  /** Shown for a beat when the unit blinks. Absent means it never does. */
  blink?: string;
  /** Width as a multiple of height. Silhouette does most of the identifying. */
  ratio: number;
  /** What sits below the eyes: a static bar, or a moving sweep. */
  jaw: 'bar' | 'scan';
};

const VANE_SPEC: UnitSpec = {
  // Chevrons rather than dots: BRIC watches you, VANE watches the horizon.
  faces: { idle: '▸ ◂', happy: '▴ ▴', warn: '▾ ▾', alarm: '▮ ▮', think: '· ▸' },
  tones: {
    idle: color.transfer,
    happy: color.income,
    warn: color.warn,
    alarm: color.expense,
    think: color.bone,
  },
  ratio: 1.25,
  jaw: 'scan',
};

function Unit({ spec, mood, size }: { spec: UnitSpec; mood: Mood; size: number }) {
  const tone = spec.tones[mood];
  const [blinking, setBlinking] = useState(false);
  const width = size * spec.ratio;

  // Irregular blinks read as alive; a fixed interval reads as a loading spinner.
  useEffect(() => {
    if (!spec.blink) return;
    let timeout: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timeout = setTimeout(
        () => {
          setBlinking(true);
          setTimeout(() => {
            setBlinking(false);
            schedule();
          }, 120);
        },
        2200 + Math.random() * 2600
      );
    };
    schedule();
    return () => clearTimeout(timeout);
  }, [spec.blink]);

  const body = (
    <View
      style={[
        s.unit,
        { width, height: size, borderColor: tone, backgroundColor: `${tone}14` },
      ]}>
      <Txt
        style={{
          fontFamily: mono,
          fontSize: size * 0.26,
          color: tone,
          letterSpacing: -1,
        }}>
        {blinking && spec.blink ? spec.blink : spec.faces[mood]}
      </Txt>
      {spec.jaw === 'scan' ? (
        // Frozen mid-sweep when something is wrong: a unit that is alarmed is
        // not still calmly scanning the horizon.
        mood === 'alarm' ? (
          <View style={{ width: width * 0.55, height: 2, backgroundColor: tone }} />
        ) : (
          <Scan width={width * 0.55} tone={tone} ms={mood === 'think' ? 900 : 1700} />
        )
      ) : (
        <View
          style={[s.jawBar, { backgroundColor: tone, width: size * (mood === 'happy' ? 0.42 : 0.32) }]}
        />
      )}
    </View>
  );

  // Alarm jitters instead of bobbing — it shouldn't look relaxed.
  if (mood === 'alarm') return <Pulse min={0.55} ms={620}>{body}</Pulse>;
  return <Bob distance={2.5} ms={2400}>{body}</Bob>;
}

/**
 * BRIC as he is right now. Every core on screen follows the one neural link,
 * so the whole terminal visibly thinks while he does. `state` overrides it.
 */
export function Bric({
  mood = 'idle',
  size = 54,
  state,
}: {
  mood?: Mood;
  size?: number;
  state?: CoreState;
}) {
  const linked = useStore((s) => !!s.settings.aiKey);
  const link = useBric((s) => s.link);
  const live: CoreState = !linked
    ? 'offline'
    : link === 'thinking'
      ? 'thinking'
      : link === 'speaking'
        ? 'speaking'
        : 'idle';
  const shown = state ?? live;
  return (
    <BricCore
      mood={shown !== 'offline' && link === 'error' && mood === 'idle' ? 'warn' : mood}
      size={size}
      state={shown}
    />
  );
}

export function Vane({ mood = 'idle', size = 54 }: { mood?: Mood; size?: number }) {
  return <Unit spec={VANE_SPEC} mood={mood} size={size} />;
}

/** Tone a unit is currently showing, for panels that need to match it. */
export const bricTone = (mood: Mood): string => MOOD_TONE[mood];
export const vaneTone = (mood: Mood): string => VANE_SPEC.tones[mood];

function Says({
  unit,
  mood,
  children,
  compact,
}: {
  unit: 'bric' | 'vane';
  mood: Mood;
  children: ReactNode;
  compact?: boolean;
}) {
  const tone = unit === 'bric' ? MOOD_TONE[mood] : VANE_SPEC.tones[mood];
  const size = compact ? 38 : 50;

  return (
    <Row style={{ alignItems: 'flex-start', gap: space.md }}>
      {unit === 'bric' ? (
        <Bric mood={mood} size={size + 4} />
      ) : (
        <Unit spec={VANE_SPEC} mood={mood} size={size} />
      )}
      <View style={[s.bubble, { borderColor: `${tone}55` }]}>
        <View style={[s.tail, { borderRightColor: `${tone}55` }]} />
        {typeof children === 'string' ? (
          <Txt variant="caption" style={{ lineHeight: 19 }}>
            {children}
          </Txt>
        ) : (
          children
        )}
      </View>
    </Row>
  );
}

/** A speech panel from BRIC. */
export function BricSays(props: { mood?: Mood; children: ReactNode; compact?: boolean }) {
  return <Says unit="bric" mood={props.mood ?? 'idle'} compact={props.compact}>{props.children}</Says>;
}

/** A speech panel from VANE. */
export function VaneSays(props: { mood?: Mood; children: ReactNode; compact?: boolean }) {
  return <Says unit="vane" mood={props.mood ?? 'idle'} compact={props.compact}>{props.children}</Says>;
}

const s = StyleSheet.create({
  doubleRule: { marginTop: space.sm },
  ruleThick: { height: 2, backgroundColor: color.accent },
  ruleThin: { height: 1, backgroundColor: color.border, marginTop: 2 },
  leader: { flex: 1, overflow: 'hidden', marginHorizontal: 4 },
  stamp: {
    borderWidth: 2,
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    opacity: 0.9,
  },
  unit: {
    borderWidth: 2,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  jawBar: { height: 2, opacity: 0.8 },
  bubble: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    padding: space.md,
  },
  tail: {
    position: 'absolute',
    left: -7,
    top: 14,
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderRightWidth: 7,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
});

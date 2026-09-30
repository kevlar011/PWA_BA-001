import { ReactNode, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { BricCore, MOOD_TONE, type CoreState } from '@/components/bric-core';
import { useBric } from '@/lib/bric-store';
import { useStore } from '@/lib/store';
import { VANE_TONE, VaneScope } from '@/components/vane-scope';
import { scopeBlips, type Blip } from '@/lib/vane';
import { color, glyph, radius, space } from '@/theme/tokens';
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
 *   · VANE — the docket. A half-dome sonar (`vane-scope.tsx`) whose blips are
 *     the board's real deadlines. Rules only; she never calls out.
 */
export type Mood = 'idle' | 'happy' | 'warn' | 'alarm' | 'think';

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

/**
 * VANE as the board stands. Without `blips` she reads the docket herself, so
 * every scope on screen shows the same returns.
 */
export function Vane({ mood = 'idle', size = 54, blips }: { mood?: Mood; size?: number; blips?: Blip[] }) {
  const tasks = useStore((s) => s.tasks);
  const settings = useStore((s) => s.settings);
  const live = useMemo(
    () => (blips ? null : scopeBlips({ tasks: tasks.filter((t) => !t.deletedAt), settings })),
    [blips, tasks, settings]
  );
  return <VaneScope mood={mood} size={size} blips={blips ?? live ?? []} />;
}

/** Tone a unit is currently showing, for panels that need to match it. */
export const bricTone = (mood: Mood): string => MOOD_TONE[mood];
export const vaneTone = (mood: Mood): string => VANE_TONE[mood];

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
  const tone = unit === 'bric' ? MOOD_TONE[mood] : VANE_TONE[mood];
  const size = compact ? 38 : 50;

  return (
    <Row style={{ alignItems: 'flex-start', gap: space.md }}>
      {unit === 'bric' ? (
        <Bric mood={mood} size={size + 4} />
      ) : (
        <Vane mood={mood} size={size - 12} />
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

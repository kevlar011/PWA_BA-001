import { ReactNode, useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  PressableProps,
  ScrollView,
  StyleSheet,
  Text,
  TextProps,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color, font, glyph, mono, radius, space } from '@/theme/tokens';
import { useRolling } from './motion';
import { Tap } from './press';

/* -------------------------------------------------------------------------- */
/* CRT furniture                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Scanlines. Pure decoration, and deliberately cheap: one absolutely
 * positioned layer with a repeating gradient, no per-line views.
 * Web-only — React Native has no repeating-gradient primitive.
 */
export function Scanlines() {
  if (Platform.OS !== 'web') return null;
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        // `backgroundImage` is a web-only style React Native's types don't know.
        {
          zIndex: 999,
          backgroundImage: `repeating-linear-gradient(0deg, ${color.scanline} 0px, ${color.scanline} 1px, transparent 1px, transparent 3px)`,
        } as ViewStyle,
      ]}
    />
  );
}

/** Blinking block cursor, the way a terminal waits for you. */
export function Cursor({ tone = color.accent }: { tone?: string }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setOn((v) => !v), 530);
    return () => clearInterval(t);
  }, []);
  return (
    <Text style={{ fontFamily: mono, color: on ? tone : 'transparent', fontSize: font.size.body }}>
      {glyph.cursor}
    </Text>
  );
}

/* -------------------------------------------------------------------------- */
/* Screen                                                                     */
/* -------------------------------------------------------------------------- */

export function Screen({
  children,
  scroll = true,
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  style?: ViewProps['style'];
}) {
  const insets = useSafeAreaInsets();
  const pad = { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + 96 };

  const body = !scroll ? (
    <View style={[s.screen, pad, style]}>{children}</View>
  ) : (
    <ScrollView
      style={s.screen}
      contentContainerStyle={[pad, style]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      {body}
      <Scanlines />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Text                                                                       */
/* -------------------------------------------------------------------------- */

type TxtProps = TextProps & {
  variant?: 'hero' | 'display' | 'title' | 'lead' | 'body' | 'caption' | 'micro';
  dim?: boolean;
  faint?: boolean;
  weight?: keyof typeof font.weight;
  tone?: string;
  /** Adds the wide letter-spacing that makes terminal labels read as labels. */
  spaced?: boolean;
};

export function Txt({
  variant = 'body',
  dim,
  faint,
  weight,
  tone,
  spaced,
  style,
  ...rest
}: TxtProps) {
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: mono,
          fontSize: font.size[variant],
          color: tone ?? (faint ? color.textFaint : dim ? color.textDim : color.text),
          fontWeight: weight ? font.weight[weight] : '400',
          letterSpacing: spaced ? 1.6 : 0,
        },
        style,
      ]}
    />
  );
}

/** Monospace is already tabular, so amounts never jitter. */
export function Amount({
  children,
  variant = 'body',
  tone,
  weight = 'bold',
  style,
}: {
  children: ReactNode;
  variant?: TxtProps['variant'];
  tone?: string;
  weight?: keyof typeof font.weight;
  style?: TextProps['style'];
}) {
  return (
    <Txt variant={variant} weight={weight} tone={tone} style={style}>
      {children}
    </Txt>
  );
}

/* -------------------------------------------------------------------------- */
/* Frame (card)                                                               */
/* -------------------------------------------------------------------------- */

/**
 * A panel with an optional label notched into its top border, the way old
 * TUI dialogs did it. `Card` is kept as an alias so screens can adopt it
 * gradually.
 */
export function Frame({
  children,
  label,
  tint = color.border,
  style,
  ...rest
}: ViewProps & { children: ReactNode; label?: string; tint?: string }) {
  return (
    <View {...rest} style={[s.frame, { borderColor: tint }, style]}>
      {label ? (
        <View style={s.frameLabel}>
          <Txt variant="micro" spaced weight="bold" tone={tint === color.border ? color.textDim : tint}>
            {` ${label.toUpperCase()} `}
          </Txt>
        </View>
      ) : null}
      {children}
    </View>
  );
}

export const Card = Frame;

/* -------------------------------------------------------------------------- */
/* Buttons                                                                    */
/* -------------------------------------------------------------------------- */

type BtnProps = PressableProps & {
  label: string;
  kind?: 'primary' | 'ghost' | 'danger';
  full?: boolean;
};

export function Button({ label, kind = 'primary', full, style, disabled, ...rest }: BtnProps) {
  const tone =
    kind === 'primary' ? color.accentText : kind === 'danger' ? color.danger : color.text;
  return (
    <Tap
      {...rest}
      disabled={disabled}
      scale={0.97}
      weight={kind === 'danger' ? 'heavy' : 'medium'}
      style={[
        s.btn,
        kind === 'primary' ? { backgroundColor: color.accent, borderColor: color.accent } : null,
        kind === 'ghost' ? { backgroundColor: color.surfaceHi, borderColor: color.borderHi } : null,
        kind === 'danger' ? { backgroundColor: 'transparent', borderColor: color.danger } : null,
        full ? { alignSelf: 'stretch' } : null,
        typeof style === 'function' ? null : (style as ViewStyle),
      ].filter(Boolean) as ViewStyle[]}>
      <Txt variant="body" weight="bold" spaced tone={tone}>
        {`[ ${label.toUpperCase()} ]`}
      </Txt>
    </Tap>
  );
}

/* -------------------------------------------------------------------------- */
/* Layout bits                                                                */
/* -------------------------------------------------------------------------- */

export function Row({ children, style, ...rest }: ViewProps & { children: ReactNode }) {
  return (
    <View {...rest} style={[s.row, style]}>
      {children}
    </View>
  );
}

/** Square glyph tile. Terminals had no circles. */
export function Bubble({ icon, tint, size = 40 }: { icon: string; tint: string; size?: number }) {
  return (
    <View
      style={[
        s.bubble,
        { width: size, height: size, backgroundColor: `${tint}1A`, borderColor: `${tint}66` },
      ]}>
      <Text style={{ fontSize: size * 0.42 }}>{icon}</Text>
    </View>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginBottom: space.md, marginTop: space.xl }}>
      <Row style={{ gap: space.sm, flex: 1 }}>
        <Txt variant="micro" weight="bold" tone={color.accent}>
          {glyph.arrow}
        </Txt>
        <Txt variant="caption" weight="bold" spaced dim>
          {typeof children === 'string' ? children.toUpperCase() : children}
        </Txt>
      </Row>
      {action}
    </Row>
  );
}

export function Empty({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <View style={s.empty}>
      <Txt variant="display" style={{ marginBottom: space.md }}>
        {icon}
      </Txt>
      <Txt variant="body" weight="bold" spaced style={{ marginBottom: space.sm }}>
        {title.toUpperCase()}
      </Txt>
      <Txt variant="caption" dim style={{ textAlign: 'center', maxWidth: 280, lineHeight: 19 }}>
        {body}
      </Txt>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Meters                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Blocky segmented meter — ▓ for filled, ░ for empty. Reads as a progress bar
 * but looks like it was drawn in codepage 437.
 */
export function Bar({
  pct,
  tint,
  segments = 24,
}: {
  pct: number;
  tint: string;
  segments?: number;
}) {
  const clamped = Math.min(1, Math.max(0, pct));
  // Fills block by block rather than appearing complete.
  const filled = Math.round((useRolling(Math.round(clamped * segments * 100), 700) / 100));
  return (
    <Row>
      <Txt variant="caption" tone={tint} style={{ letterSpacing: -0.5 }}>
        {glyph.bulletOn.repeat(filled)}
      </Txt>
      <Txt variant="caption" tone={color.surfacePress} style={{ letterSpacing: -0.5 }}>
        {glyph.bulletOff.repeat(Math.max(0, segments - filled))}
      </Txt>
    </Row>
  );
}

/** Horizontal ASCII divider. */
export function Rule({ tone = color.border, heavy = false }: { tone?: string; heavy?: boolean }) {
  return (
    <View style={{ height: 1, backgroundColor: tone, marginVertical: space.md, opacity: heavy ? 1 : 0.7 }} />
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space.lg },
  frame: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.lg,
    marginTop: space.sm,
  },
  frameLabel: {
    position: 'absolute',
    top: -7,
    left: space.md,
    backgroundColor: color.bg,
    paddingHorizontal: 2,
  },
  btn: {
    height: 46,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  bubble: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: radius.md },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: space.xxxl },
});

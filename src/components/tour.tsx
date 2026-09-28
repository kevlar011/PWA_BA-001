import { usePathname, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bric, Vane } from '@/components/ui/agency';
import { Fade, useTypewriter } from '@/components/ui/motion';
import { Tap } from '@/components/ui/press';
import { Row, Txt } from '@/components/ui/primitives';
import { useStore } from '@/lib/store';
import { color, radius, space } from '@/theme/tokens';
import type { Mood } from '@/components/ui/agency';

/** Height reserved for the tab bar so the panel never hides behind it. */
const TABBAR = 92;

type Step = {
  route: string;
  mood: Mood;
  says: string;
  /** Who is talking. Each subsystem is introduced by its own unit. */
  unit: 'bric' | 'vane';
  /** Spotlight position as a fraction of the viewport height. */
  top: number;
  height: number;
};

const STEPS: Step[] = [
  {
    route: '/',
    unit: 'bric',
    mood: 'happy',
    says: "I'm BRIC. This is the mainframe — KEVLAR is a shell, and everything it runs is listed here.",
    top: 0.22,
    height: 0.16,
  },
  {
    route: '/',
    unit: 'bric',
    mood: 'idle',
    says: 'Two subsystems at present. Banking is mine. The docket belongs to VANE, and you will meet her shortly.',
    top: 0.38,
    height: 0.34,
  },
  {
    route: '/bank',
    unit: 'bric',
    mood: 'idle',
    says: 'Banking. Your balance — everything you have, one figure. Drag it sideways for euros, dinars, wherever you are standing.',
    top: 0.2,
    height: 0.22,
  },
  {
    route: '/bank',
    unit: 'bric',
    mood: 'idle',
    says: 'Quick log. Tap a category, enter the amount, done. That is the entire daily routine.',
    top: 0.5,
    height: 0.14,
  },
  {
    route: '/bank/log',
    unit: 'bric',
    mood: 'idle',
    says: 'Everything you record lands here. Search it, filter it, long-press to remove.',
    top: 0.14,
    height: 0.22,
  },
  {
    route: '/bank/budgets',
    unit: 'bric',
    mood: 'think',
    says: 'Set a cap per category. The meter turns amber near the line and red past it. No cap, no nagging.',
    top: 0.14,
    height: 0.26,
  },
  {
    route: '/bank/advisor',
    unit: 'bric',
    mood: 'warn',
    says: 'The advisory. Link me in Settings and I write this up myself, zakat included — or open a channel from Banking and simply talk to me.',
    top: 0.14,
    height: 0.26,
  },
  {
    route: '/desk',
    unit: 'vane',
    mood: 'idle',
    says: "VANE. I keep the docket — notes, plans, anything you'd otherwise carry in your head. BRIC handles what you spend. I handle what you write down.",
    top: 0.14,
    height: 0.28,
  },
  {
    route: '/desk',
    unit: 'vane',
    mood: 'idle',
    says: 'Type in that box and hit plus. That is the whole thing. A deadline, a checklist, a status — all optional, and most entries need none of it.',
    top: 0.44,
    height: 0.16,
  },
  {
    route: '/desk',
    unit: 'vane',
    mood: 'idle',
    says: 'Open any entry for the full body. Search reaches into it, so writing at length costs you nothing later.',
    top: 0.62,
    height: 0.2,
  },
  {
    route: '/desk/brief',
    unit: 'vane',
    mood: 'warn',
    says: "And this is where I tell you what's slipping. Overdue, gone cold, too many things started at once. Rules over your notes, nothing more.",
    top: 0.14,
    height: 0.26,
  },
  {
    route: '/',
    unit: 'bric',
    mood: 'happy',
    says: 'That is the whole machine, sir. Record something, or put something on the board, and we shall start earning our keep.',
    top: 0.38,
    height: 0.34,
  },
];

export function Tour() {
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();

  const hydrated = useStore((s) => s.hydrated);
  const onboarded = useStore((s) => s.settings.onboarded);
  const tourDone = useStore((s) => s.settings.tourDone);
  const updateSettings = useStore((s) => s.updateSettings);

  const [step, setStep] = useState(0);

  const active = hydrated && onboarded && !tourDone && segments[0] !== 'onboarding';
  const current = STEPS[step];

  // Only navigate when the step actually wants a different screen. Replacing
  // on every step re-mounts the screen underneath and makes it flicker.
  useEffect(() => {
    if (!active || !current) return;
    if (pathname !== current.route) router.replace(current.route as never);
  }, [active, current, pathname, router]);

  const typed = useTypewriter(active && current ? current.says : '', 68);

  // Breathing spotlight so the eye knows where to land.
  const glow = useSharedValue(1);
  useEffect(() => {
    glow.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, [glow]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  if (!active || !current) return null;

  const spotTop = Math.max(insets.top, screenH * current.top);
  const spotHeight = screenH * current.height;
  const spotBottom = spotTop + spotHeight;

  // Panel sits below the spotlight unless that would push it into the tab bar.
  const panelEstimate = 190;
  const roomBelow = screenH - spotBottom - TABBAR - insets.bottom;
  const below = roomBelow >= panelEstimate;

  const finish = () => {
    updateSettings({ tourDone: true });
    router.replace('/');
  };
  const next = () => (step >= STEPS.length - 1 ? finish() : setStep(step + 1));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Scrim above and below, leaving the real UI visible in between */}
      <Tap style={[s.scrim, { height: spotTop }]} onPress={next} scale={1} weight="none">
        <View />
      </Tap>
      <Tap
        style={[s.scrim, { top: spotBottom, height: screenH - spotBottom }]}
        onPress={next}
        scale={1}
        weight="none">
        <View />
      </Tap>

      <Animated.View
        pointerEvents="none"
        style={[s.spot, { top: spotTop, height: spotHeight }, glowStyle]}
      />

      <Fade
        key={step}
        style={[
          s.panelWrap,
          below
            ? { top: spotBottom + space.md }
            : { bottom: Math.max(TABBAR + insets.bottom, screenH - spotTop + space.md) },
        ]}>
        <View style={s.panel}>
          <Row style={{ gap: space.md, alignItems: 'flex-start' }}>
            {current.unit === 'bric' ? (
              <Bric mood={current.mood} size={46} />
            ) : (
              <Vane mood={current.mood} size={42} />
            )}
            <View style={{ flex: 1 }}>
              <Txt variant="micro" spaced weight="bold" tone={color.rust}>
                {`${current.unit.toUpperCase()} · ${step + 1} OF ${STEPS.length}`}
              </Txt>
              <Txt variant="caption" style={{ marginTop: 4, lineHeight: 19, minHeight: 76 }}>
                {typed}
              </Txt>
            </View>
          </Row>

          <Row style={{ justifyContent: 'space-between', marginTop: space.sm }}>
            <Tap onPress={finish} hitSlop={12} weight="light" style={s.plain}>
              <Txt variant="micro" spaced faint>
                SKIP
              </Txt>
            </Tap>
            <Row style={{ gap: space.md }}>
              {step > 0 && (
                <Tap onPress={() => setStep(step - 1)} hitSlop={12} style={s.plain}>
                  <Txt variant="micro" spaced dim weight="bold">
                    BACK
                  </Txt>
                </Tap>
              )}
              <Tap onPress={next} hitSlop={12} weight="medium" style={s.next}>
                <Txt variant="micro" spaced weight="bold" tone={color.accentText}>
                  {step >= STEPS.length - 1 ? 'DONE' : 'NEXT'}
                </Txt>
              </Tap>
            </Row>
          </Row>
        </View>
      </Fade>

      <Row style={[s.pips, { bottom: insets.bottom + space.sm }]}>
        {STEPS.map((_, i) => (
          <View
            key={i}
            style={[
              s.pip,
              i === step && { backgroundColor: color.accent, width: 18 },
              i < step && { backgroundColor: color.accentDim },
            ]}
          />
        ))}
      </Row>
    </View>
  );
}

const s = StyleSheet.create({
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: 'rgba(11,10,7,0.9)',
  },
  spot: {
    position: 'absolute',
    left: space.sm,
    right: space.sm,
    borderWidth: 2,
    borderColor: color.accent,
    borderRadius: radius.md,
  },
  panelWrap: { position: 'absolute', left: space.lg, right: space.lg },
  panel: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.borderHi,
    borderRadius: radius.md,
    padding: space.lg,
  },
  plain: { paddingVertical: 4 },
  next: {
    backgroundColor: color.accent,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  pips: { position: 'absolute', left: 0, right: 0, justifyContent: 'center', gap: 5 },
  pip: { width: 6, height: 4, borderRadius: 2, backgroundColor: color.surfacePress },
});

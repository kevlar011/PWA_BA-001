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

import { Bric } from '@/components/ui/agency';
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
  /** Spotlight position as a fraction of the viewport height. */
  top: number;
  height: number;
};

const STEPS: Step[] = [
  {
    route: '/bank',
    mood: 'happy',
    says: "I'm BRIC, sir. I keep your ledger. This is your balance, all your money in one number. Swipe it sideways to see it in other currencies.",
    top: 0.2,
    height: 0.22,
  },
  {
    route: '/bank',
    mood: 'idle',
    says: "To log something, tap a category and type the amount. That's all you need to do day to day.",
    top: 0.5,
    height: 0.14,
  },
  {
    route: '/bank/log',
    mood: 'idle',
    says: 'Everything you log ends up here. You can search it, filter it, or long-press an entry to delete it.',
    top: 0.14,
    height: 0.22,
  },
  {
    route: '/bank/budgets',
    mood: 'think',
    says: "Give a category a monthly limit. The bar turns amber as you get close and red once you go over. If you don't set one, I won't nag.",
    top: 0.14,
    height: 0.26,
  },
  {
    route: '/bank/goals',
    mood: 'idle',
    says: "Your savings goals, bills and debts live here. Tell me what you owe and I'll work out the quickest way to pay it off.",
    top: 0.14,
    height: 0.26,
  },
  {
    route: '/bank/advisor',
    mood: 'warn',
    says: "This is my report. I look for subscriptions you've forgotten and spending that's creeping up, and I keep an eye on zakat. Link me in Settings and you can talk to me from the home screen too.",
    top: 0.14,
    height: 0.26,
  },
  {
    route: '/bank',
    mood: 'happy',
    says: "That's everything, sir. Log your first entry whenever you're ready.",
    top: 0.2,
    height: 0.22,
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
    router.replace('/bank');
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
            <Bric mood={current.mood} size={46} />
            <View style={{ flex: 1 }}>
              <Txt variant="micro" spaced weight="bold" tone={color.rust}>
                {`BRIC · ${step + 1} OF ${STEPS.length}`}
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

import { useRouter } from 'expo-router';
import { ReactNode, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SyncPip } from '@/components/sync-pip';
import { Tap } from '@/components/ui/press';
import { Txt, Row } from '@/components/ui/primitives';
import { color, space } from '@/theme/tokens';

/**
 * The terminal's masthead.
 *
 * There is nothing left to switch between, so the bar no longer pretends to
 * be a breadcrumb. It says whose machine this is, and keeps sync state and
 * settings within a thumb's reach.
 */
export function SystemBar() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.bar, { paddingTop: insets.top + space.xs }]}>
      <Txt variant="micro" weight="bold" spaced tone={color.accent}>
        KEVLAR
      </Txt>

      <Row style={{ gap: space.md, alignItems: 'center' }}>
        <SyncPip />
        <Tap
          scale={0.9}
          weight="light"
          hitSlop={12}
          onPress={() => router.push('/settings')}
          style={{ paddingHorizontal: 2 }}>
          <Txt variant="lead" dim>
            ⚙
          </Txt>
        </Tap>
      </Row>
    </View>
  );
}

/**
 * Wraps the tabs so they lay out beneath the bar.
 *
 * `Screen` pads itself by the top safe-area inset, which is correct when it is
 * the topmost thing on screen and wrong once the bar has already eaten that
 * space. Rather than teach every screen about the bar, the inset is overridden
 * for everything below it, the bar consumed it, so as far as the children are
 * concerned there is no notch left to avoid.
 */
export function Frame({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const consumed = useMemo(() => ({ ...insets, top: 0 }), [insets]);

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SystemBar />
      <SafeAreaInsetsContext.Provider value={consumed}>
        <View style={{ flex: 1 }}>{children}</View>
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    backgroundColor: color.surface,
    borderBottomWidth: 1,
    borderBottomColor: `${color.accent}55`,
  },
});

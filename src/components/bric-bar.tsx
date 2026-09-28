import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bric, Vane } from '@/components/ui/agency';
import { Pulse, useTypewriter } from '@/components/ui/motion';
import { Tap, notify } from '@/components/ui/press';
import { Cursor, Row, Txt } from '@/components/ui/primitives';
import { bricSay } from '@/lib/bric';
import { useSession } from '@/lib/session';
import { color, radius, space } from '@/theme/tokens';

/** How long a remark stays before it withdraws. */
const LINGER = 4600;
/** How long a receipt waits for BRIC to finish composing before giving up. */
const PENDING_LINGER = 10_000;

/**
 * The units' transient voice — confirmations, corrections, undo.
 *
 * Sits above the tab bar so it never covers the thing you just acted on, and
 * withdraws on its own. Anything reversible gets an UNDO on the right. BRIC's
 * remarks arrive a beat after the system receipt and type themselves over it.
 */
export function BricBar() {
  const toast = useSession((s) => s.toast);
  const dismiss = useSession((s) => s.dismiss);
  const say = useSession((s) => s.say);
  const insets = useSafeAreaInsets();

  // Restart the timer whenever the remark changes — including when BRIC's
  // own line replaces the receipt, so it gets its full time on screen.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismiss, toast.pending ? PENDING_LINGER : LINGER);
    return () => clearTimeout(t);
  }, [toast, dismiss]);

  const typed = useTypewriter(toast && !toast.pending ? toast.text : '', 90);

  if (!toast) return null;

  const isBric = toast.unit === 'bric';
  // Receipts (uppercase system text) print at once; spoken lines type out.
  const spoken = !toast.pending && toast.text !== toast.text.toUpperCase();
  const shown = spoken ? typed : toast.text;

  return (
    <Animated.View
      key={toast.id}
      entering={FadeInDown.duration(240).springify().damping(18)}
      exiting={FadeOutDown.duration(180)}
      pointerEvents="box-none"
      style={[s.wrap, { bottom: insets.bottom + 96 }]}>
      <View style={[s.bar, isBric && { borderColor: color.accentDim }]}>
        {isBric ? <Bric mood={toast.mood} size={40} /> : <Vane mood={toast.mood} size={30} />}
        <View style={{ flex: 1, marginLeft: space.md }}>
          <Txt
            variant={spoken ? 'caption' : 'micro'}
            weight={spoken ? 'regular' : 'bold'}
            spaced={!spoken}
            tone={spoken ? color.text : color.textDim}
            style={{ lineHeight: spoken ? 18 : 16 }}>
            {shown}
            {spoken && typed.length < toast.text.length ? <Cursor /> : null}
          </Txt>
          {toast.pending && (
            <Pulse min={0.25} ms={420}>
              <Txt variant="micro" weight="bold" spaced tone={color.transfer} style={{ marginTop: 2 }}>
                BRIC COMPOSING…
              </Txt>
            </Pulse>
          )}
        </View>

        {toast.undo ? (
          <Tap
            weight="medium"
            style={s.undo}
            onPress={() => {
              toast.undo?.();
              notify('warning');
              if (isBric) bricSay('REVERSED', { type: 'undo' }, { mood: 'idle' });
              else say('Reversed.', { mood: 'idle', unit: 'vane' });
            }}>
            <Txt variant="micro" weight="bold" spaced tone={color.accentText}>
              UNDO
            </Txt>
          </Tap>
        ) : (
          <Tap weight="light" onPress={dismiss} style={s.close}>
            <Txt variant="caption" faint>
              ✕
            </Txt>
          </Tap>
        )}
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: space.lg, right: space.lg, zIndex: 500 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surfaceHi,
    borderWidth: 1,
    borderColor: color.borderHi,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  undo: {
    backgroundColor: color.accent,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.md,
    marginLeft: space.sm,
  },
  close: { paddingHorizontal: space.sm, paddingVertical: 4 },
});

/** Quiet banner offering to reload once a new build has been cached. */
export function UpdateBanner() {
  const ready = useSession((s) => s.updateReady);
  const insets = useSafeAreaInsets();
  if (!ready) return null;

  return (
    <Animated.View entering={FadeInDown.duration(300)} style={[u.wrap, { top: insets.top + space.sm }]}>
      <Tap
        weight="medium"
        style={u.bar}
        onPress={() => {
          if (typeof window !== 'undefined') window.location.reload();
        }}>
        <Row style={{ gap: space.sm, alignItems: 'center' }}>
          <Txt variant="micro" weight="bold" spaced tone={color.accentText}>
            NEW BUILD CACHED · TAP TO APPLY
          </Txt>
        </Row>
      </Tap>
    </Animated.View>
  );
}

const u = StyleSheet.create({
  wrap: { position: 'absolute', left: space.lg, right: space.lg, zIndex: 600 },
  bar: {
    backgroundColor: color.accent,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    alignItems: 'center',
  },
});

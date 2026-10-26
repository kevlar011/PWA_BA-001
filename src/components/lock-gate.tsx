import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Bric } from '@/components/ui/agency';
import { Fade, Rise, useTypewriter } from '@/components/ui/motion';
import { notify } from '@/components/ui/press';
import { Button, Cursor, Row, Screen, Txt } from '@/components/ui/primitives';
import { checkPassphrase, hasPasskey, verifyPasskey } from '@/lib/lock';
import { useSession } from '@/lib/session';
import { useStore } from '@/lib/store';
import { color, radius, space } from '@/theme/tokens';

/**
 * Covers the app until you prove who you are.
 *
 * Rendered above everything rather than as a route, so there is no navigation
 * trick that gets past it and no flash of the balance before it appears.
 */
export function LockGate() {
  const hydrated = useStore((s) => s.hydrated);
  const settings = useStore((s) => s.settings);
  const unlocked = useSession((s) => s.unlocked);
  const setUnlocked = useSession((s) => s.setUnlocked);

  const [entry, setEntry] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tried = useRef(false);

  const locked = hydrated && settings.lockEnabled && !unlocked;
  const greeting = useTypewriter(locked ? 'KEVLAR LOCKED. IDENTIFY YOURSELF.' : '', 45);

  /* Offer the biometric prompt straight away, one less tap in the common case. */
  useEffect(() => {
    if (!locked || tried.current || !hasPasskey()) return;
    tried.current = true;
    void (async () => {
      if (await verifyPasskey()) {
        notify('success');
        setUnlocked(true);
      }
    })();
  }, [locked, setUnlocked]);

  if (!locked) return null;

  async function byPasskey() {
    setBusy(true);
    const ok = await verifyPasskey();
    setBusy(false);
    if (ok) {
      notify('success');
      setUnlocked(true);
    } else {
      setError('Not recognised.');
    }
  }

  async function byPassphrase() {
    setBusy(true);
    const ok = await checkPassphrase(entry, settings.passphraseCheck);
    setBusy(false);
    if (ok) {
      notify('success');
      setEntry('');
      setError(null);
      setUnlocked(true);
    } else {
      notify('error');
      setError('That is not the passphrase.');
      setEntry('');
    }
  }

  return (
    <View style={s.overlay}>
      <Screen scroll={false}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Rise>
            <Row style={{ gap: space.md, marginBottom: space.xl }}>
              <Bric mood={error ? 'alarm' : 'idle'} size={56} />
              <View style={{ flex: 1 }}>
                <Txt variant="micro" spaced weight="bold" tone={color.rust}>
                  ACCESS CONTROL
                </Txt>
                <Row>
                  <Txt variant="caption" dim style={{ marginTop: 2 }}>
                    {greeting}
                  </Txt>
                  <Cursor />
                </Row>
              </View>
            </Row>
          </Rise>

          <Rise delay={80}>
            <TextInput
              value={entry}
              onChangeText={(v) => {
                setEntry(v);
                setError(null);
              }}
              placeholder="Passphrase"
              placeholderTextColor={color.textFaint}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={[s.input, error ? { borderColor: color.danger } : null]}
              onSubmitEditing={byPassphrase}
              returnKeyType="go"
            />

            {error && (
              <Fade>
                <Txt variant="micro" tone={color.danger} style={{ marginTop: space.sm }}>
                  {error}
                </Txt>
              </Fade>
            )}

            <Button
              label={busy ? 'Checking…' : 'Unlock'}
              full
              disabled={busy || !entry}
              style={{ marginTop: space.lg }}
              onPress={byPassphrase}
            />

            {hasPasskey() && (
              <Button
                label="Use Face ID"
                kind="ghost"
                full
                disabled={busy}
                style={{ marginTop: space.sm }}
                onPress={byPasskey}
              />
            )}
          </Rise>

          <Txt variant="micro" faint style={{ textAlign: 'center', marginTop: space.xxl, lineHeight: 16 }}>
            Everything stays on this device. If you forget the passphrase, there's no way back
          in.
          </Txt>
        </View>
      </Screen>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    // Written out rather than spreading StyleSheet.absoluteFill, which is a
    // registered style id, spreading it silently produces an empty object
    // and the gate ends up rendering below the app instead of over it.
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.bg,
    zIndex: 1000,
  },
  input: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: color.surfaceHi,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space.md,
    color: color.text,
    fontSize: 18,
  },
});

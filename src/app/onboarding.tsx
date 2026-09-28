import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Bric } from '@/components/ui/agency';
import { Fade, Rise } from '@/components/ui/motion';
import { Button, Card, Cursor, Row, Screen, Txt } from '@/components/ui/primitives';
import { CURRENCIES } from '@/lib/currency';
import { parseAmount } from '@/lib/money';
import { useStore } from '@/lib/store';
import { color, radius, space } from '@/theme/tokens';

/* -------------------------------------------------------------------------- */
/* Boot                                                                       */
/* -------------------------------------------------------------------------- */

const BOOT = [
  'KEVLAR MAINFRAME',
  'FIRMWARE v2.0 · AMBER PHOSPHOR',
  '',
  'MEMORY CHECK .............. OK',
  'LOCAL STORE ............... OK',
  'NETWORK INTERFACE ......... ON REQUEST',
  'ENCRYPTION ................ ON DEVICE',
  '',
  'BNK-001 [BANKING] ......... ONLINE',
  '  UNIT [BRIC] ............. DORMANT',
  'DKT-002 [DOCKET] .......... ONLINE',
  '  UNIT [VANE] ............. ONLINE',
  'SLOT 003 .................. UNASSIGNED',
  '',
  'YOUR DATA STAYS ON THIS DEVICE.',
  'NOTHING LEAVES WITHOUT YOUR SAY.',
  '',
  'READY.',
];

function Boot({ onDone }: { onDone: () => void }) {
  const [lines, setLines] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let i = 0;
    const tick = () => {
      i += 1;
      setLines(BOOT.slice(0, i));
      if (i < BOOT.length) {
        timer.current = setTimeout(tick, BOOT[i] === '' ? 55 : 120);
      }
    };
    tick();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const done = lines.length >= BOOT.length;

  // Skip the theatre if you've seen it once and just want in.
  return (
    <Screen scroll={false}>
      <Pressable style={{ flex: 1, justifyContent: 'center' }} onPress={done ? onDone : undefined}>
        {lines.map((l, i) => (
          <Row key={i}>
            <Txt
              variant="caption"
              tone={l.includes('DATA') || l.includes('YOUR SAY') ? color.accent : color.textDim}>
              {l || ' '}
            </Txt>
            {i === lines.length - 1 && !done ? <Cursor /> : null}
          </Row>
        ))}
        {done && (
          <Fade style={{ marginTop: space.xl }}>
            <Button label="Continue" full onPress={onDone} />
          </Fade>
        )}
      </Pressable>
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */
/* Setup                                                                      */
/* -------------------------------------------------------------------------- */

export default function Onboarding() {
  const router = useRouter();
  const updateSettings = useStore((s) => s.updateSettings);

  const [booted, setBooted] = useState(false);
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [currency, setCurrency] = useState('USD');

  if (!booted) return <Boot onDone={() => setBooted(true)} />;

  function begin() {
    // Only record what was actually filled in. Stamping a blank name here
    // would mark it as a deliberate choice, and it would then beat a real
    // name already synced from another device.
    const patch: Parameters<typeof updateSettings>[0] = {
      onboarded: true,
      tourDone: false,
    };
    if (name.trim()) patch.name = name.trim();
    if (start.trim()) patch.openingBalance = parseAmount(start);
    if (currency !== 'USD') patch.currency = currency;

    updateSettings(patch);
    router.replace('/');
  }

  return (
    <Screen>
      <Rise>
        <Row style={{ gap: space.md, marginBottom: space.lg, marginTop: space.lg }}>
          <Bric mood="happy" size={52} />
          <View style={{ flex: 1 }}>
            <Txt variant="micro" spaced weight="bold" tone={color.rust}>
              SETUP
            </Txt>
            <Txt variant="title" weight="bold" spaced>
              TWO THINGS
            </Txt>
          </View>
        </Row>
      </Rise>

      <Rise delay={80}>
        <Txt variant="caption" dim style={{ lineHeight: 19 }}>
          A name, and roughly what you have right now. That is the whole setup — no accounts, no
          logins. BRIC can be woken later from Settings.
        </Txt>
      </Rise>

      <Rise delay={160}>
        <Card label="what should I call you" style={{ marginTop: space.xl }}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={color.textFaint}
            style={s.input}
            autoFocus
            returnKeyType="next"
          />
        </Card>
      </Rise>

      <Rise delay={220}>
        <Card label="what you have right now" style={{ marginTop: space.lg }}>
          <Row style={{ gap: space.sm }}>
            <View style={s.symbol}>
              <Txt variant="lead" weight="bold" tone={color.accent}>
                {CURRENCIES.find((c) => c.code === currency)?.symbol ?? '$'}
              </Txt>
            </View>
            <TextInput
              value={start}
              onChangeText={setStart}
              placeholder="0.00"
              placeholderTextColor={color.textFaint}
              keyboardType="decimal-pad"
              inputMode="decimal"
              style={[s.input, { flex: 1 }]}
            />
          </Row>
          <Txt variant="micro" faint style={{ marginTop: space.sm, lineHeight: 16 }}>
            Everything you log adds or subtracts from this. Rough is fine — you can change it later.
          </Txt>
        </Card>
      </Rise>

      <Rise delay={280}>
        <Card label="currency" style={{ marginTop: space.lg }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {CURRENCIES.map((c) => {
              const on = c.code === currency;
              return (
                <Pressable
                  key={c.code}
                  onPress={() => setCurrency(c.code)}
                  style={[s.chip, on && { borderColor: color.accent, backgroundColor: color.glow }]}>
                  <Txt variant="micro" weight="bold" tone={on ? color.accent : color.textFaint}>
                    {c.symbol} {c.code}
                  </Txt>
                </Pressable>
              );
            })}
          </ScrollView>
        </Card>
      </Rise>

      <Rise delay={340}>
        <Button label="Start" full style={{ marginTop: space.xl }} onPress={begin} />
        <Pressable onPress={begin} style={{ marginTop: space.lg, alignItems: 'center' }}>
          <Txt variant="micro" spaced faint>
            SKIP FOR NOW
          </Txt>
        </Pressable>
      </Rise>
    </Screen>
  );
}

const s = StyleSheet.create({
  input: {
    height: 50,
    borderRadius: radius.md,
    backgroundColor: color.surfaceHi,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space.md,
    color: color.text,
    fontSize: 18,
  },
  symbol: {
    width: 50,
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    paddingHorizontal: space.md,
    height: 34,
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
});

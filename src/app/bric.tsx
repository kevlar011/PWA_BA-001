import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LinkStatus } from '@/components/link-status';
import { Bric } from '@/components/ui/agency';
import { Fade, Pulse, Rise } from '@/components/ui/motion';
import { notify, Tap } from '@/components/ui/press';
import { Button, Cursor, Row, Scanlines, Txt } from '@/components/ui/primitives';
import { sendChat } from '@/lib/bric';
import { useBric, type ChatMsg } from '@/lib/bric-store';
import { formatIn } from '@/lib/currency';
import { balance, monthTotals, useData } from '@/lib/store';
import { color, glyph, radius, space } from '@/theme/tokens';

/**
 * The open channel.
 *
 * Everything else in Banking is BRIC commenting on a screen. This is the one
 * place you simply talk to him — the reactor front and centre, live readouts
 * either side, and a transcript that streams in as he composes it.
 */

const clock = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Corner brackets, like a targeting reticle around the core. */
function Reticle({ size, tone }: { size: number; tone: string }) {
  const arm = size * 0.16;
  const corner = (pos: object, h: 'Left' | 'Right', v: 'Top' | 'Bottom') => (
    <View
      style={[
        s.corner,
        pos,
        {
          width: arm,
          height: arm,
          borderColor: tone,
          [`border${v}Width`]: 2,
          [`border${h}Width`]: 2,
        },
      ]}
    />
  );
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill]}>
      {corner({ top: 0, left: 0 }, 'Left', 'Top')}
      {corner({ top: 0, right: 0 }, 'Right', 'Top')}
      {corner({ bottom: 0, left: 0 }, 'Left', 'Bottom')}
      {corner({ bottom: 0, right: 0 }, 'Right', 'Bottom')}
    </View>
  );
}

function Readout({ label, value, tone, right }: { label: string; value: string; tone?: string; right?: boolean }) {
  return (
    <View style={{ marginBottom: space.sm, alignItems: right ? 'flex-end' : 'flex-start' }}>
      <Txt variant="micro" spaced tone={color.rust} weight="bold">
        {label}
      </Txt>
      <Txt variant="caption" weight="bold" tone={tone ?? color.text} numberOfLines={1}>
        {value}
      </Txt>
    </View>
  );
}

function Message({ m, streaming }: { m: ChatMsg; streaming: boolean }) {
  if (m.role === 'user') {
    return (
      <Rise style={s.userWrap}>
        <Txt variant="micro" spaced faint style={{ textAlign: 'right', marginBottom: 3 }}>
          {`YOU · ${clock(m.at)}`}
        </Txt>
        <View style={s.user}>
          <Txt variant="caption" dim style={{ lineHeight: 20 }}>
            {m.text}
          </Txt>
        </View>
      </Rise>
    );
  }

  const tone = m.failed ? color.expense : color.text;
  return (
    <Fade style={s.bricWrap}>
      <View style={[s.bricRail, { backgroundColor: m.failed ? color.expense : color.accent }]} />
      <View style={{ flex: 1 }}>
        <Txt variant="micro" spaced weight="bold" tone={color.rust} style={{ marginBottom: 3 }}>
          {`BRIC ${glyph.arrow} ${clock(m.at)}`}
        </Txt>
        {m.text ? (
          <Txt variant="caption" tone={tone} style={{ lineHeight: 21 }}>
            {m.text}
            {streaming ? <Cursor /> : null}
          </Txt>
        ) : (
          <Pulse min={0.3} ms={420}>
            <Txt variant="micro" weight="bold" spaced tone={color.transfer}>
              {`${glyph.bulletOn}${glyph.bulletOn}${glyph.bulletOff} PROCESSING`}
            </Txt>
          </Pulse>
        )}
      </View>
    </Fade>
  );
}

export default function BricChannel() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const data = useData();
  const messages = useBric((st) => st.messages);
  const streamingId = useBric((st) => st.streamingId);
  const clearChat = useBric((st) => st.clearChat);
  const linked = !!data.settings.aiKey;

  const [draft, setDraft] = useState('');
  const scroller = useRef<ScrollView>(null);

  const { currency, islamicMode } = data.settings;
  const month = monthTotals(data);
  const bal = balance(data);
  const talking = messages.length > 0;
  const core = talking ? 96 : 148;

  const suggestions = [
    'How am I doing this month?',
    'Where is my money actually going?',
    'What should I fix first?',
    islamicMode ? 'Where do I stand on zakat?' : 'How long would my savings last?',
  ];

  function send(text = draft) {
    const said = text.trim();
    if (!said || streamingId) return;
    setDraft('');
    notify('success');
    void sendChat(said);
  }

  return (
    <View style={[s.root, { paddingTop: insets.top + space.sm }]}>
      {/* Header */}
      <Row style={s.header}>
        <View style={{ flex: 1 }}>
          <Txt variant="micro" spaced weight="bold" tone={color.rust}>
            FORM K-00 / DIRECT CHANNEL
          </Txt>
          <Txt variant="title" weight="bold" spaced tone={color.accent}>
            BRIC
          </Txt>
        </View>
        <Row style={{ gap: space.lg }}>
          {talking && !streamingId && (
            <Pressable hitSlop={12} onPress={clearChat}>
              <Txt variant="micro" weight="bold" spaced faint>
                PURGE
              </Txt>
            </Pressable>
          )}
          <Pressable hitSlop={14} onPress={() => router.back()}>
            <Txt variant="lead" dim>
              ✕
            </Txt>
          </Pressable>
        </Row>
      </Row>

      {/* HUD */}
      <Rise>
        <Row style={s.hud}>
          <View style={s.hudSide}>
            <Readout label="BALANCE" value={formatIn(bal, currency)} tone={bal < 0 ? color.expense : undefined} />
            <Readout
              label="MONTH NET"
              value={formatIn(month.net, currency)}
              tone={month.net >= 0 ? color.income : color.expense}
            />
          </View>

          <View style={{ width: core + 28, height: core + 28, alignItems: 'center', justifyContent: 'center' }}>
            <Reticle size={core + 28} tone={`${color.accent}88`} />
            <Bric mood={messages.at(-1)?.failed ? 'warn' : 'idle'} size={core} />
          </View>

          <View style={[s.hudSide, { alignItems: 'flex-end' }]}>
            <Readout label="RECORDS" value={String(data.transactions.length)} right />
            <Readout label="MEMORY" value={`${messages.length} MSG`} right />
          </View>
        </Row>
        <LinkStatus align="center" />
        <View style={s.rule} />
      </Rise>

      {!linked ? (
        <Fade style={s.dormant}>
          <Txt variant="body" weight="bold" spaced tone={color.textDim} style={{ textAlign: 'center' }}>
            NEURAL LINK OFFLINE
          </Txt>
          <Txt variant="caption" faint style={{ textAlign: 'center', marginTop: space.sm, lineHeight: 20 }}>
            BRIC thinks with a DeepSeek model. Add your API key in Settings — it stays on this device.
          </Txt>
          <Button
            label="Link BRIC"
            full
            style={{ marginTop: space.xl }}
            onPress={() => router.replace('/settings')}
          />
        </Fade>
      ) : (
        <>
          <ScrollView
            ref={scroller}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingVertical: space.md }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}>
            {!talking ? (
              <Fade>
                <Txt variant="micro" spaced faint style={{ textAlign: 'center', marginBottom: space.md }}>
                  CHANNEL OPEN · SUGGESTED QUERIES
                </Txt>
                {suggestions.map((q, i) => (
                  <Rise key={q} delay={80 + i * 60}>
                    <Tap scale={0.98} weight="light" style={s.chip} onPress={() => send(q)}>
                      <Txt variant="caption" tone={color.textDim}>
                        {`${glyph.arrow} ${q}`}
                      </Txt>
                    </Tap>
                  </Rise>
                ))}
              </Fade>
            ) : (
              messages.map((m) => <Message key={m.id} m={m} streaming={m.id === streamingId} />)
            )}
          </ScrollView>

          <Row style={[s.inputRow, { paddingBottom: insets.bottom + space.md }]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={streamingId ? 'BRIC is speaking…' : 'Speak to BRIC'}
              placeholderTextColor={color.textFaint}
              style={s.input}
              multiline
              maxLength={1200}
              onKeyPress={(e) => {
                // Enter sends on a keyboard; Shift+Enter still breaks the line.
                const ev = e.nativeEvent as { key: string; shiftKey?: boolean };
                if (ev.key === 'Enter' && !ev.shiftKey) {
                  (e as unknown as { preventDefault?: () => void }).preventDefault?.();
                  send();
                }
              }}
            />
            <Tap
              weight="medium"
              scale={0.92}
              disabled={!draft.trim() || !!streamingId}
              style={s.send}
              onPress={() => send()}>
              <Txt variant="micro" weight="bold" spaced tone={color.accentText}>
                SEND
              </Txt>
            </Tap>
          </Row>
        </>
      )}

      <Scanlines />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg, paddingHorizontal: space.lg },
  header: { justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: space.sm },
  hud: { justifyContent: 'space-between', alignItems: 'center', marginVertical: space.sm },
  hudSide: { flex: 1 },
  corner: { position: 'absolute' },
  rule: { height: 1, backgroundColor: color.border, marginTop: space.md },
  dormant: { flex: 1, justifyContent: 'center', paddingHorizontal: space.lg },
  chip: {
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    marginBottom: space.sm,
  },
  userWrap: { alignSelf: 'flex-end', maxWidth: '86%', marginBottom: space.lg },
  user: {
    borderWidth: 1,
    borderColor: color.borderHi,
    backgroundColor: color.surfaceHi,
    borderRadius: radius.md,
    padding: space.md,
  },
  bricWrap: { flexDirection: 'row', gap: space.md, marginBottom: space.lg, maxWidth: '94%' },
  bricRail: { width: 2, alignSelf: 'stretch' },
  inputRow: { gap: space.sm, alignItems: 'flex-end', paddingTop: space.sm },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.borderHi,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    color: color.text,
    fontSize: 16,
  },
  send: {
    height: 46,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { LinkStatus } from '@/components/link-status';
import { Bric } from '@/components/ui/agency';
import { notify } from '@/components/ui/press';
import { Button, Card, Row, Txt } from '@/components/ui/primitives';
import { useBric } from '@/lib/bric-store';
import { AI_MODELS, DEFAULT_MODEL, testKey, type AiModel } from '@/lib/deepseek';
import { useStore } from '@/lib/store';
import { color, radius, space } from '@/theme/tokens';

/**
 * Where BRIC is woken up.
 *
 * The key is proven with one tiny request before it is saved, so a typo shows
 * up here rather than as a mysteriously silent BRIC later.
 */
export function NeuralLink() {
  const aiKey = useStore((s) => s.settings.aiKey);
  const aiModel = useStore((s) => s.settings.aiModel) ?? DEFAULT_MODEL;
  const updateSettings = useStore((s) => s.updateSettings);
  const forget = useBric((s) => s.forget);
  const setLink = useBric((s) => s.setLink);

  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null);

  const linked = !!aiKey;

  async function link() {
    const key = draft.trim();
    if (!key) {
      setStatus({ text: 'Paste your DeepSeek API key first.', ok: false });
      return;
    }
    setBusy(true);
    setStatus({ text: 'Establishing link…', ok: true });
    setLink({ link: 'thinking' });
    const res = await testKey(key, aiModel);
    setBusy(false);
    if (!res.ok) {
      setLink({ link: 'error', lastError: res.error });
      setStatus({ text: res.error, ok: false });
      notify('error');
      return;
    }
    updateSettings({ aiKey: key, aiModel });
    setLink({ link: 'idle', lastError: null, latency: res.ms });
    setDraft('');
    setStatus({ text: `Link established · ${res.ms}ms round trip.`, ok: true });
    notify('success');
  }

  function unlink() {
    updateSettings({ aiKey: undefined });
    setLink({ link: 'idle', lastError: null, latency: null });
    setStatus({ text: 'Key removed from this device. BRIC is dormant.', ok: true });
  }

  return (
    <Card label={linked ? 'linked' : 'dormant'} tint={linked ? color.accentDim : color.border}>
      <Row style={{ gap: space.md }}>
        <Bric size={56} state={busy ? 'thinking' : undefined} />
        <View style={{ flex: 1 }}>
          <LinkStatus />
          <Txt variant="micro" faint style={{ marginTop: 4, lineHeight: 16 }}>
            {linked
              ? 'BRIC is awake. Every word he says is composed live.'
              : 'BRIC thinks with a DeepSeek model. Paste an API key from platform.deepseek.com to wake him.'}
          </Txt>
        </View>
      </Row>

      <Txt variant="micro" faint style={{ marginTop: space.lg, marginBottom: space.sm }}>
        {linked ? 'REPLACE KEY' : 'DEEPSEEK API KEY'}
      </Txt>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder={linked ? 'Stored on this device · paste to replace' : 'sk-…'}
        placeholderTextColor={color.textFaint}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        style={s.input}
      />

      <Txt variant="micro" faint style={{ marginTop: space.md, marginBottom: space.sm }}>
        MODEL
      </Txt>
      <Row style={{ gap: space.sm }}>
        {AI_MODELS.map((m) => {
          const on = m.id === aiModel;
          return (
            <Pressable
              key={m.id}
              onPress={() => updateSettings({ aiModel: m.id as AiModel })}
              style={[s.model, on && { borderColor: color.accent, backgroundColor: color.glow }]}>
              <Txt variant="micro" weight="bold" spaced tone={on ? color.accent : color.textDim}>
                {m.label}
              </Txt>
              <Txt variant="micro" faint style={{ marginTop: 2, lineHeight: 15 }}>
                {m.note}
              </Txt>
            </Pressable>
          );
        })}
      </Row>

      <Button
        label={busy ? 'Linking…' : linked ? 'Test & replace key' : 'Test & link'}
        full
        disabled={busy || !draft.trim()}
        style={{ marginTop: space.lg }}
        onPress={link}
      />

      {linked && (
        <Row style={{ justifyContent: 'space-between', marginTop: space.md }}>
          <Pressable hitSlop={8} onPress={unlink}>
            <Txt variant="micro" weight="bold" spaced tone={color.danger}>
              REMOVE KEY
            </Txt>
          </Pressable>
          <Pressable
            hitSlop={8}
            onPress={() => {
              forget();
              setStatus({ text: "BRIC's memory of your conversations is cleared.", ok: true });
            }}>
            <Txt variant="micro" weight="bold" spaced faint>
              WIPE BRIC&apos;S MEMORY
            </Txt>
          </Pressable>
        </Row>
      )}

      {status && (
        <Txt
          variant="micro"
          tone={status.ok ? color.income : color.warn}
          style={{ marginTop: space.md, textAlign: 'center', lineHeight: 16 }}>
          {status.text}
        </Txt>
      )}

      <Txt variant="micro" faint style={{ marginTop: space.lg, lineHeight: 16 }}>
        The key is stored only on this device. It is never synced, never put in a backup and never
        sent anywhere except DeepSeek. While linked, each time BRIC thinks he sends DeepSeek a
        summary of your ledger — balances, categories, recent entries and their notes. Your docket
        is never sent. Arm the app lock if anyone else uses this device.
      </Txt>
    </Card>
  );
}

const s = StyleSheet.create({
  input: {
    height: 46,
    borderRadius: radius.md,
    backgroundColor: color.surfaceHi,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space.md,
    color: color.text,
    fontSize: 16,
  },
  model: {
    flex: 1,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    padding: space.sm,
  },
});

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { FileHeader, LeaderRow } from '@/components/ui/agency';
import { Rise } from '@/components/ui/motion';
import { notify } from '@/components/ui/press';
import { Button, Card, Row, Rule, Screen, SectionTitle, Txt } from '@/components/ui/primitives';
import { runSync } from '@/lib/autosync';
import { fingerprint } from '@/lib/crypto';
import { useStore } from '@/lib/store';
import { pullOnly, testConnection } from '@/lib/sync';
import { color, radius, space } from '@/theme/tokens';

export default function Sync() {
  const router = useRouter();
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const replaceAll = useStore((s) => s.replaceAll);

  const [url, setUrl] = useState(settings.syncUrl ?? '');
  const [key, setKey] = useState(settings.syncKey ?? '');
  const [phrase, setPhrase] = useState(settings.passphrase ?? '');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const configured = !!settings.syncUrl && !!settings.syncKey;

  async function save() {
    if (!url.trim() || !key.trim()) {
      setStatus('Both the URL and the key are needed.');
      return;
    }
    setBusy(true);
    setStatus('Testing…');
    const res = await testConnection({ url: url.trim(), key: key.trim() });
    setBusy(false);
    if (!res.ok) {
      setStatus(res.error ?? 'Could not connect.');
      return;
    }
    updateSettings({ syncUrl: url.trim(), syncKey: key.trim() });
    setStatus('Connected.');
    notify('success');
  }

  async function run() {
    const pass = phrase.trim();
    if (!pass) {
      setStatus('Enter your passphrase.');
      return;
    }
    if (!settings.syncUrl || !settings.syncKey) {
      setStatus('Connect to a server first.');
      return;
    }

    setBusy(true);
    setStatus('Syncing…');

    // Persist it first: runSync reads the passphrase from settings, and this
    // is also what lets sync happen unattended from here on.
    updateSettings({ passphrase: pass });

    const result = await runSync('manual');

    setBusy(false);
    if (!result.ok) {
      setStatus(result.error ?? 'Sync failed.');
      notify('error');
      return;
    }

    setStatus(null);
    notify('success');
    router.back();
  }

  /** Take the server copy wholesale. For adopting a freshly installed device. */
  async function adopt() {
    const pass = phrase.trim();
    if (!pass) {
      setStatus('Enter your passphrase.');
      return;
    }
    if (!settings.syncUrl || !settings.syncKey) {
      setStatus('Connect to a server first.');
      return;
    }

    setBusy(true);
    setStatus('Downloading…');

    const res = await pullOnly(pass, { url: settings.syncUrl, key: settings.syncKey });
    setBusy(false);

    if (!res.ok) {
      setStatus(res.error);
      notify('error');
      return;
    }

    replaceAll({
      ...res.data,
      settings: {
        ...res.data.settings,
        syncUrl: settings.syncUrl,
        syncKey: settings.syncKey,
        passphrase: pass,
        passphraseCheck: await fingerprint(pass),
        aiKey: settings.aiKey,
        syncedAt: Date.now(),
      },
    });

    setStatus(null);
    notify('success');
    router.replace('/');
  }

  return (
    <Screen>
      <Rise>
        <FileHeader
          title="Sync"
          code="K-08 / TRANSFER"
          subtitle="ENCRYPTED ON DEVICE BEFORE TRANSMISSION"
          right={
            <Pressable onPress={() => router.back()} hitSlop={14}>
              <Txt variant="title" dim>
                ✕
              </Txt>
            </Pressable>
          }
        />
      </Rise>

      <Rise delay={60}>
        <Card tint={color.border}>
          <Txt variant="caption" dim style={{ lineHeight: 19 }}>
            Your ledger is encrypted here before it goes anywhere. The server holds a blob it cannot
            read, under an identifier it cannot reverse. Lose the passphrase and the data is gone
            for good — there is no reset, by design.
          </Txt>
        </Card>
      </Rise>

      <Rise delay={120}>
        <SectionTitle>Passphrase</SectionTitle>
        <Card label="the only secret">
          <TextInput
            value={phrase}
            onChangeText={setPhrase}
            placeholder="Something long you will not forget"
            placeholderTextColor={color.textFaint}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            style={s.input}
          />
          <Txt variant="micro" faint style={{ marginTop: space.sm, lineHeight: 16 }}>
            Use the same phrase on every device. A few unrelated words beats a short complicated
            one. It is never transmitted and never stored anywhere but here.
          </Txt>
        </Card>
      </Rise>

      <Rise delay={180}>
        <SectionTitle>Server</SectionTitle>
        <Card label={configured ? 'connected' : 'not configured'}>
          <Txt variant="micro" faint style={{ marginBottom: space.sm }}>
            PROJECT URL
          </Txt>
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="https://xxxx.supabase.co"
            placeholderTextColor={color.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            style={s.input}
          />

          <Txt variant="micro" faint style={{ marginTop: space.md, marginBottom: space.sm }}>
            PUBLISHABLE KEY
          </Txt>
          <TextInput
            value={key}
            onChangeText={setKey}
            placeholder="anon key"
            placeholderTextColor={color.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            style={s.input}
          />

          <Button
            label={busy ? 'Working…' : 'Test and save'}
            kind="ghost"
            full
            disabled={busy}
            style={{ marginTop: space.md }}
            onPress={save}
          />
        </Card>
      </Rise>

      <Rise delay={240}>
        <SectionTitle>Status</SectionTitle>
        <Card>
          <LeaderRow label="Server" value={configured ? 'connected' : 'not set'} />
          <LeaderRow
            label="Last sync"
            value={settings.syncedAt ? new Date(settings.syncedAt).toLocaleString() : 'never'}
          />
          <Rule />
          <Button
            label={busy ? 'Syncing…' : 'Sync now'}
            full
            disabled={busy || !configured}
            onPress={run}
          />
          <Button
            label="Replace this device from server"
            kind="ghost"
            full
            disabled={busy || !configured}
            style={{ marginTop: space.sm }}
            onPress={adopt}
          />
          <Txt variant="micro" faint style={{ marginTop: space.sm, lineHeight: 16 }}>
            Use this when setting up a new device. It discards whatever is on this one and takes
            the server copy exactly, rather than merging.
          </Txt>

          {status && (
            <Txt
              variant="micro"
              tone={status.includes('Connected') ? color.income : color.warn}
              style={{ marginTop: space.md, textAlign: 'center', lineHeight: 16 }}>
              {status}
            </Txt>
          )}
        </Card>
      </Rise>

      <Rise delay={300}>
        <SectionTitle>Setting up the shelf</SectionTitle>
        <Card>
          <Txt variant="caption" dim style={{ lineHeight: 19 }}>
            One-time, about three minutes:
          </Txt>
          {[
            'Create a free project at supabase.com',
            'Open the SQL editor and run the snippet below',
            'Settings → API: copy the Project URL and the anon key into the fields above',
            'Enter the same passphrase on both devices and hit Sync now',
          ].map((step, i) => (
            <Row key={step} style={{ gap: space.sm, marginTop: space.md, alignItems: 'flex-start' }}>
              <Txt variant="caption" tone={color.accent} weight="bold">
                {i + 1}.
              </Txt>
              <Txt variant="caption" dim style={{ flex: 1, lineHeight: 18 }}>
                {step}
              </Txt>
            </Row>
          ))}

          <View style={s.code}>
            <Txt variant="micro" tone={color.textDim} style={{ lineHeight: 17 }}>
              {`create table kevlar_sync (
  id text primary key,
  blob jsonb not null,
  updated_at timestamptz default now()
);
alter table kevlar_sync enable row level security;
create policy "blobs are opaque" on kevlar_sync
  for all using (true) with check (true);`}
            </Txt>
          </View>

          <Txt variant="micro" faint style={{ marginTop: space.md, lineHeight: 16 }}>
            That policy is deliberately open — the row id is unguessable and the contents are
            encrypted, so access control is your passphrase rather than the database.
          </Txt>
        </Card>
      </Rise>
    </Screen>
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
  code: {
    marginTop: space.md,
    padding: space.md,
    backgroundColor: color.bg,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
  },
});

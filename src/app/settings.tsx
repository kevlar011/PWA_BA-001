import * as FileSystem from 'expo-file-system';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { FileHeader } from '@/components/ui/agency';
import { Rise } from '@/components/ui/motion';
import { Button, Card, Row, Screen, SectionTitle, Txt } from '@/components/ui/primitives';
import { CURRENCIES, byCode } from '@/lib/currency';
import { parseAmount } from '@/lib/money';
import { NeuralLink } from '@/components/neural-link';
import { bricSay } from '@/lib/bric';
import { useBric } from '@/lib/bric-store';
import { fingerprint } from '@/lib/crypto';
import { checkPassphrase, enrolPasskey, forgetPasskey, hasPasskey } from '@/lib/lock';
import { useData, useStore } from '@/lib/store';
import type { KevlarData } from '@/lib/types';
import { color, radius, space, swatch } from '@/theme/tokens';

export default function Settings() {
  const router = useRouter();
  const data = useData();
  const updateSettings = useStore((s) => s.updateSettings);
  const addCategory = useStore((s) => s.addCategory);
  const removeCategory = useStore((s) => s.removeCategory);
  const resetAll = useStore((s) => s.resetAll);
  const restore = useStore((s) => s.restore);

  const [newCat, setNewCat] = useState('');
  const [newIcon, setNewIcon] = useState('🏷️');
  const [status, setStatus] = useState<string | null>(null);

  // Erase is a two-stage action: reveal, then prove it's really you.
  const [armed, setArmed] = useState(false);
  const [lockPhrase, setLockPhrase] = useState('');
  const [passkeyOn, setPasskeyOn] = useState(hasPasskey());
  const [arming, setArming] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [typed, setTyped] = useState('');

  const activeCats = data.categories.filter((c) => !c.archived);
  const { settings } = data;

  async function exportData() {
    const payload: KevlarData = {
      version: data.version,
      categories: data.categories,
      transactions: data.transactions,
      budgets: data.budgets,
      goals: data.goals,
      recurring: data.recurring,
      tasks: data.tasks,
      // A backup file gets emailed, uploaded, left in Downloads. The API key
      // has no business being in one.
      settings: { ...data.settings, aiKey: undefined },
    };
    const json = JSON.stringify(payload, null, 2);
    const filename = `kevlar-backup-${new Date().toISOString().slice(0, 10)}.json`;

    try {
      if (Platform.OS === 'web') {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const file = new FileSystem.File(FileSystem.Paths.cache, filename);
        file.create({ overwrite: true });
        file.write(json);
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json' });
      }
      updateSettings({ lastBackupAt: Date.now() });
      setStatus('Backup saved.');
    } catch (e) {
      setStatus(`Export failed: ${String(e)}`);
    }
  }

  /**
   * Reads an exported backup and replaces everything.
   *
   * Web-only for now: the PWA is the shipping target, and a native build would
   * want expo-document-picker rather than a DOM file input.
   */
  function importData() {
    if (Platform.OS !== 'web') {
      setStatus('Restore is available in the installed web app.');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        const result = restore(parsed);
        if (!result.ok) {
          setStatus(result.error ?? 'That file could not be read.');
          return;
        }
        const count = Array.isArray(parsed?.transactions) ? parsed.transactions.length : 0;
        bricSay(`RESTORED · ${count} ENTRIES`, { type: 'restore', count }, { mood: 'happy' });
        setStatus(null);
        router.replace('/');
      } catch {
        setStatus('That file is not valid JSON.');
      }
    };
    input.click();
  }

  function wipe() {
    resetAll();
    useBric.getState().forget();
    setArmed(false);
    setTyped('');
    router.replace('/onboarding');
  }

  /** Face ID / Touch ID where the device supports it. */
  async function eraseWithBiometrics() {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !enrolled) {
        setStatus('No biometrics enrolled — type ERASE to confirm instead.');
        return;
      }
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirm you want to erase everything',
        cancelLabel: 'Cancel',
      });
      if (res.success) wipe();
      else setStatus('Cancelled. Nothing was erased.');
    } catch {
      setStatus('Biometrics unavailable — type ERASE to confirm instead.');
    }
  }

  return (
    <Screen>
      <Rise>
        <FileHeader
          title="Configuration"
          code="K-09 / SETTINGS"
          subtitle="ALL VALUES STORED ON THIS DEVICE"
          right={
            <Pressable onPress={() => router.back()} hitSlop={14}>
              <Txt variant="title" dim>
                ✕
              </Txt>
            </Pressable>
          }
        />
      </Rise>

      {/* You */}
      <Rise delay={50}>
        <SectionTitle>You</SectionTitle>
        <Card>
          <Txt variant="micro" faint style={{ marginBottom: space.sm }}>
            NAME
          </Txt>
          <TextInput
            defaultValue={settings.name}
            onEndEditing={(e) => updateSettings({ name: e.nativeEvent.text.trim() })}
            placeholder="Your name"
            placeholderTextColor={color.textFaint}
            style={s.input}
          />

          <Txt variant="micro" faint style={{ marginTop: space.lg, marginBottom: space.sm }}>
            STARTING BALANCE ({settings.currency})
          </Txt>
          <TextInput
            defaultValue={String(settings.openingBalance / 100)}
            onEndEditing={(e) =>
              updateSettings({ openingBalance: parseAmount(e.nativeEvent.text) })
            }
            keyboardType="decimal-pad"
            inputMode="decimal"
            style={s.input}
          />
          <Txt variant="micro" faint style={{ marginTop: space.sm, lineHeight: 16 }}>
            Your balance is this number plus everything you've logged since.
          </Txt>
        </Card>
      </Rise>

      {/* BRIC */}
      <Rise delay={75}>
        <SectionTitle>BRIC · Neural link</SectionTitle>
        <NeuralLink />
      </Rise>

      {/* Currency */}
      <Rise delay={100}>
        <SectionTitle>Currency</SectionTitle>
        <Card>
          <Row style={{ flexWrap: 'wrap', gap: space.sm }}>
            {CURRENCIES.map((c) => {
              const on = c.code === settings.currency;
              return (
                <Pressable
                  key={c.code}
                  onPress={() => updateSettings({ currency: c.code })}
                  style={[s.chip, on && { borderColor: color.accent, backgroundColor: color.glow }]}>
                  <Txt variant="micro" weight="bold" tone={on ? color.accent : color.textDim}>
                    {c.symbol} {c.code}
                  </Txt>
                </Pressable>
              );
            })}
          </Row>
        </Card>
      </Rise>

      {/* Balance strip */}
      <Rise delay={140}>
        <SectionTitle>Balance strip</SectionTitle>
        <Card label="swipe order">
          <Txt variant="micro" dim style={{ marginBottom: space.md, lineHeight: 16 }}>
            Currencies you can swipe your balance through on the home screen.
          </Txt>
          <Row style={{ flexWrap: 'wrap', gap: space.sm }}>
            {CURRENCIES.map((c) => {
              const on = (settings.travelCurrencies ?? []).includes(c.code);
              return (
                <Pressable
                  key={c.code}
                  onPress={() => {
                    const cur = settings.travelCurrencies ?? [];
                    updateSettings({
                      travelCurrencies: on ? cur.filter((x) => x !== c.code) : [...cur, c.code],
                    });
                  }}
                  style={[s.chip, on && { borderColor: color.accent, backgroundColor: color.glow }]}>
                  <Txt variant="micro" weight="bold" tone={on ? color.accent : color.textFaint}>
                    {c.code}
                  </Txt>
                </Pressable>
              );
            })}
          </Row>
        </Card>
      </Rise>

      {/* Rates */}
      <Rise delay={180}>
        <SectionTitle>Exchange rates</SectionTitle>
        <Card label="units per 1 USD">
          <Txt variant="micro" dim style={{ marginBottom: space.md, lineHeight: 16 }}>
            KEVLAR is offline, so it can't fetch live rates. Correct any you care about.
          </Txt>
          {(settings.travelCurrencies ?? [])
            .filter((code) => code !== 'USD')
            .map((code) => {
              const c = byCode(code);
              return (
                <Row key={code} style={{ gap: space.md, marginBottom: space.sm }}>
                  <Txt variant="caption" weight="bold" style={{ width: 44 }}>
                    {code}
                  </Txt>
                  <Txt variant="micro" faint style={{ flex: 1 }} numberOfLines={1}>
                    {c.name}
                  </Txt>
                  <TextInput
                    defaultValue={String(settings.rateOverrides?.[code] ?? c.perUsd)}
                    onEndEditing={(e) => {
                      const v = Number.parseFloat(e.nativeEvent.text);
                      if (!Number.isFinite(v) || v <= 0) return;
                      updateSettings({
                        rateOverrides: { ...(settings.rateOverrides ?? {}), [code]: v },
                        ratesSetAt: Date.now(),
                      });
                    }}
                    keyboardType="decimal-pad"
                    inputMode="decimal"
                    style={[s.input, { width: 96, height: 36, textAlign: 'right' }]}
                  />
                </Row>
              );
            })}
        </Card>
      </Rise>

      {/* Categories */}
      <Rise delay={220}>
        <SectionTitle>Categories</SectionTitle>
        <Card>
          <Row style={{ gap: space.sm }}>
            <TextInput
              value={newIcon}
              onChangeText={setNewIcon}
              style={[s.input, { width: 56, textAlign: 'center' }]}
              maxLength={2}
            />
            <TextInput
              value={newCat}
              onChangeText={setNewCat}
              placeholder="New category"
              placeholderTextColor={color.textFaint}
              style={[s.input, { flex: 1 }]}
            />
            <Pressable
              hitSlop={8}
              style={{ justifyContent: 'center' }}
              onPress={() => {
                const nm = newCat.trim();
                if (!nm) return;
                addCategory({
                  name: nm,
                  icon: newIcon || '🏷️',
                  kind: 'expense',
                  color: swatch[data.categories.length % swatch.length],
                });
                setNewCat('');
                setNewIcon('🏷️');
              }}>
              <Txt variant="caption" weight="bold" tone={color.accent}>
                ADD
              </Txt>
            </Pressable>
          </Row>

          <View style={{ marginTop: space.lg, gap: space.sm }}>
            {activeCats.map((c) => (
              <Row key={c.id} style={{ gap: space.md }}>
                <Txt variant="lead">{c.icon}</Txt>
                <View style={{ flex: 1 }}>
                  <Txt variant="caption" weight="bold">
                    {c.name}
                  </Txt>
                  <Txt variant="micro" faint>
                    {c.kind.toUpperCase()}
                  </Txt>
                </View>
                <Pressable hitSlop={8} onPress={() => removeCategory(c.id)}>
                  <Txt variant="micro" tone={color.textFaint}>
                    ARCHIVE
                  </Txt>
                </Pressable>
              </Row>
            ))}
          </View>
        </Card>
      </Rise>

      {/* Islamic finance */}
      <Rise delay={260}>
        <SectionTitle>Islamic finance</SectionTitle>
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1, marginRight: space.md }}>
              <Txt variant="body" weight="bold">
                Halal mode
              </Txt>
              <Txt variant="micro" faint style={{ marginTop: 2, lineHeight: 16 }}>
                Zakat tracking, riba warnings, and halal screening principles in the advisory.
              </Txt>
            </View>
            <Switch
              value={settings.islamicMode}
              onValueChange={(v) => updateSettings({ islamicMode: v })}
              trackColor={{ true: color.accentDim, false: color.surfacePress }}
              thumbColor={settings.islamicMode ? color.accent : color.textFaint}
            />
          </Row>

          {settings.islamicMode && (
            <>
              <Txt variant="micro" faint style={{ marginTop: space.lg, marginBottom: space.sm }}>
                GOLD PRICE PER GRAM ({settings.currency}) — SETS THE NISAB
              </Txt>
              <TextInput
                defaultValue={
                  settings.goldPricePerGram ? String(settings.goldPricePerGram / 100) : ''
                }
                onEndEditing={(e) =>
                  updateSettings({ goldPricePerGram: parseAmount(e.nativeEvent.text) })
                }
                placeholder="e.g. 85.00"
                placeholderTextColor={color.textFaint}
                keyboardType="decimal-pad"
                inputMode="decimal"
                style={s.input}
              />
            </>
          )}
        </Card>
      </Rise>

      {/* Lock */}
      <Rise delay={250}>
        <SectionTitle>Access</SectionTitle>
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1, marginRight: space.md }}>
              <Txt variant="body" weight="bold">
                Lock KEVLAR
              </Txt>
              <Txt variant="micro" faint style={{ marginTop: 2, lineHeight: 16 }}>
                {settings.passphraseCheck
                  ? 'Asks for your passphrase, or Face ID, every launch.'
                  : 'Set a passphrase below before this can be switched on.'}
              </Txt>
            </View>
            <Switch
              value={settings.lockEnabled}
              disabled={!settings.passphraseCheck}
              onValueChange={(v) => {
                // Turning it off is safe. Turning it on is not, until the
                // passphrase has been proven against the stored fingerprint —
                // otherwise a bad fingerprint locks you out of your own data
                // with no way back in on a phone.
                if (!v) {
                  updateSettings({ lockEnabled: false });
                  setArming(false);
                  return;
                }
                setArming(true);
                setStatus(null);
              }}
              trackColor={{ true: color.accentDim, false: color.surfacePress }}
              thumbColor={settings.lockEnabled ? color.accent : color.textFaint}
            />
          </Row>

          {arming && !settings.lockEnabled && (
            <>
              <Txt variant="micro" faint style={{ marginTop: space.lg, marginBottom: space.sm }}>
                CONFIRM YOUR PASSPHRASE TO ARM THE LOCK
              </Txt>
              <TextInput
                value={confirmPhrase}
                onChangeText={setConfirmPhrase}
                placeholder="Passphrase"
                placeholderTextColor={color.textFaint}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                style={s.input}
              />
              <Row style={{ gap: space.sm, marginTop: space.sm }}>
                <Button
                  label="Cancel"
                  kind="ghost"
                  style={{ flex: 1 }}
                  onPress={() => {
                    setArming(false);
                    setConfirmPhrase('');
                  }}
                />
                <Button
                  label="Arm lock"
                  style={{ flex: 1 }}
                  onPress={async () => {
                    const ok = await checkPassphrase(confirmPhrase, settings.passphraseCheck);
                    if (!ok) {
                      setStatus('That does not match. Lock not enabled.');
                      return;
                    }
                    updateSettings({ lockEnabled: true });
                    setArming(false);
                    setConfirmPhrase('');
                    setStatus('Lock armed.');
                  }}
                />
              </Row>
            </>
          )}

          {!settings.passphraseCheck && (
            <>
              <Txt variant="micro" faint style={{ marginTop: space.lg, marginBottom: space.sm }}>
                SET A PASSPHRASE
              </Txt>
              <TextInput
                value={lockPhrase}
                onChangeText={setLockPhrase}
                placeholder="Same one you use for sync"
                placeholderTextColor={color.textFaint}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                style={s.input}
              />
              <Button
                label="Save passphrase"
                kind="ghost"
                full
                style={{ marginTop: space.sm }}
                onPress={async () => {
                  const v = lockPhrase.trim();
                  if (v.length < 6) {
                    setStatus('Use at least six characters.');
                    return;
                  }
                  updateSettings({ passphrase: v, passphraseCheck: await fingerprint(v) });
                  setLockPhrase('');
                  setStatus('Passphrase set.');
                }}
              />
            </>
          )}

          <Button
            label={passkeyOn ? 'Re-enrol Face ID' : 'Enable Face ID'}
            kind="ghost"
            full
            style={{ marginTop: space.md }}
            onPress={async () => {
              const res = await enrolPasskey(settings.name || 'KEVLAR');
              setPasskeyOn(hasPasskey());
              setStatus(res.ok ? 'Face ID enrolled.' : (res.error ?? 'Could not enrol.'));
            }}
          />
          {passkeyOn && (
            <Pressable
              style={{ marginTop: space.md, alignItems: 'center' }}
              onPress={() => {
                forgetPasskey();
                setPasskeyOn(false);
                setStatus('Face ID removed.');
              }}>
              <Txt variant="micro" spaced faint>
                REMOVE FACE ID
              </Txt>
            </Pressable>
          )}
        </Card>
      </Rise>

      {/* Sync */}
      <Rise delay={290}>
        <SectionTitle>Sync</SectionTitle>
        <Card>
          <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1, marginRight: space.md }}>
              <Txt variant="body" weight="bold">
                Encrypted sync
              </Txt>
              <Txt variant="micro" faint style={{ marginTop: 2, lineHeight: 16 }}>
                {settings.syncUrl
                  ? settings.syncedAt
                    ? `Last synced ${new Date(settings.syncedAt).toLocaleDateString()}`
                    : 'Connected, never synced'
                  : 'Keep this device and your phone in step'}
              </Txt>
            </View>
            <Pressable hitSlop={8} onPress={() => router.push('/sync')}>
              <Txt variant="caption" weight="bold" spaced tone={color.accent}>
                OPEN
              </Txt>
            </Pressable>
          </Row>
        </Card>
      </Rise>

      {/* Tour */}
      <Rise delay={300}>
        <SectionTitle>Orientation</SectionTitle>
        <Card>
          <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1, marginRight: space.md }}>
              <Txt variant="body" weight="bold">
                Replay the tour
              </Txt>
              <Txt variant="micro" faint style={{ marginTop: 2 }}>
                BRIC walks you through the app again.
              </Txt>
            </View>
            <Pressable
              hitSlop={8}
              onPress={() => {
                updateSettings({ tourDone: false });
                router.replace('/');
              }}>
              <Txt variant="caption" weight="bold" spaced tone={color.accent}>
                RUN
              </Txt>
            </Pressable>
          </Row>
        </Card>
      </Rise>

      {/* Data */}
      <Rise delay={340}>
        <SectionTitle>Your data</SectionTitle>
        <Card>
          <Txt variant="caption" dim style={{ marginBottom: space.md, lineHeight: 19 }}>
            Your ledger lives on this device. If sync is on, it also lives encrypted on your
            server — unreadable without your passphrase. A backup is still the only copy you
            control outright.
          </Txt>
          {settings.lastBackupAt && (
            <Txt variant="micro" faint style={{ marginBottom: space.md }}>
              LAST BACKUP {new Date(settings.lastBackupAt).toLocaleDateString()}
            </Txt>
          )}
          <Button label="Export backup" full onPress={exportData} />
          <Button
            label="Restore from backup"
            kind="ghost"
            full
            style={{ marginTop: space.sm }}
            onPress={importData}
          />

          {!armed ? (
            <Button
              label="Erase everything"
              kind="danger"
              full
              style={{ marginTop: space.sm }}
              onPress={() => {
                setArmed(true);
                setStatus(null);
              }}
            />
          ) : (
            <Card tint={color.danger} style={{ marginTop: space.md }}>
              <Txt variant="caption" weight="bold" tone={color.danger}>
                This wipes every transaction, budget and goal. It cannot be undone.
              </Txt>

              {Platform.OS !== 'web' && (
                <Button
                  label="Confirm with Face ID"
                  full
                  style={{ marginTop: space.md }}
                  onPress={eraseWithBiometrics}
                />
              )}

              <Txt variant="micro" faint style={{ marginTop: space.md, marginBottom: space.sm }}>
                {Platform.OS === 'web' ? 'TYPE ERASE TO CONFIRM' : 'OR TYPE ERASE TO CONFIRM'}
              </Txt>
              <TextInput
                value={typed}
                onChangeText={setTyped}
                placeholder="ERASE"
                placeholderTextColor={color.textFaint}
                autoCapitalize="characters"
                style={s.input}
              />
              <Row style={{ gap: space.sm, marginTop: space.md }}>
                <Button
                  label="Cancel"
                  kind="ghost"
                  style={{ flex: 1 }}
                  onPress={() => {
                    setArmed(false);
                    setTyped('');
                  }}
                />
                <Button
                  label="Erase"
                  kind="danger"
                  style={{ flex: 1 }}
                  disabled={typed.trim().toUpperCase() !== 'ERASE'}
                  onPress={wipe}
                />
              </Row>
            </Card>
          )}

          {status && (
            <Txt variant="micro" tone={color.accent} style={{ marginTop: space.md, textAlign: 'center' }}>
              {status}
            </Txt>
          )}
        </Card>
      </Rise>

      <Txt variant="micro" faint style={{ textAlign: 'center', marginTop: space.xl }}>
        KEVLAR · BUILT FOR ONE PERSON
      </Txt>
    </Screen>
  );
}

const s = StyleSheet.create({
  chip: {
    paddingHorizontal: space.md,
    height: 34,
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  input: {
    height: 46,
    borderRadius: radius.md,
    backgroundColor: color.surfaceHi,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space.md,
    color: color.text,
    fontSize: 18,
  },
});

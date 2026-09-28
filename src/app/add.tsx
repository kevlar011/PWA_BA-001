import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Keypad } from '@/components/ui/keypad';
import { notify } from '@/components/ui/press';
import { Button, Row, Txt } from '@/components/ui/primitives';
import { bricSay } from '@/lib/bric';
import { byCode, formatIn } from '@/lib/currency';
import { DAY, shortDate, startOfDay } from '@/lib/date';
import { parseAmount } from '@/lib/money';
import { useData, useStore } from '@/lib/store';
import type { TxKind } from '@/lib/types';
import { color, radius, space } from '@/theme/tokens';

export default function AddTransaction() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string; id?: string }>();

  const data = useData();
  const addTransaction = useStore((s) => s.addTransaction);
  const updateTransaction = useStore((s) => s.updateTransaction);
  const removeTransaction = useStore((s) => s.removeTransaction);
  const undeleteTransaction = useStore((s) => s.undeleteTransaction);
  const { currency } = data.settings;

  // Editing an existing entry rather than creating one.
  const editing = data.transactions.find((t) => t.id === params.id);
  const preset = data.categories.find((c) => c.id === params.category);

  const [kind, setKind] = useState<TxKind>(editing?.kind ?? preset?.kind ?? 'expense');
  const [raw, setRaw] = useState(editing ? String(editing.amount / 100) : '');
  const [categoryId, setCategoryId] = useState<string | undefined>(
    editing?.categoryId ?? preset?.id
  );
  const [date, setDate] = useState(() => editing?.date ?? startOfDay(Date.now()));
  const [note, setNote] = useState(editing?.note ?? '');

  const cents = parseAmount(raw);
  const cats = useMemo(
    () => data.categories.filter((c) => !c.archived && c.kind === kind),
    [data.categories, kind]
  );

  const tint = kind === 'income' ? color.income : color.expense;
  const canSave = cents > 0;

  function save() {
    if (!canSave) return;

    if (editing) {
      // Snapshot the old values so the undo can put them back exactly.
      const before = { ...editing };
      updateTransaction(editing.id, {
        kind,
        amount: cents,
        categoryId,
        note: note.trim() || undefined,
        date,
      });
      notify('success');
      bricSay('ENTRY AMENDED', { type: 'edit' }, {
        mood: 'idle',
        undo: () => updateTransaction(before.id, before),
      });
    } else {
      const trimmed = note.trim() || undefined;
      const id = addTransaction({ kind, amount: cents, categoryId, note: trimmed, date });
      notify('success');
      const cat = data.categories.find((c) => c.id === categoryId);
      bricSay(
        `LOGGED ${kind === 'income' ? '+' : '−'}${formatIn(cents, currency)}${cat ? ` · ${cat.name.toUpperCase()}` : ''}`,
        { type: 'log', kind, amount: cents, categoryId, note: trimmed },
        { mood: kind === 'income' ? 'happy' : 'idle', undo: () => removeTransaction(id) }
      );
    }

    router.back();
  }

  return (
    <View style={[s.root, { paddingTop: insets.top + space.md }]}>
      <Row style={{ justifyContent: 'space-between', marginBottom: space.md }}>
        <Txt variant="lead" weight="bold" spaced>
          {editing ? 'EDIT ENTRY' : 'NEW ENTRY'}
        </Txt>
        <Row style={{ gap: space.lg }}>
          {editing && (
            <Pressable
              hitSlop={14}
              onPress={() => {
                const id = editing.id;
                removeTransaction(id);
                notify('warning');
                bricSay('ENTRY STRUCK', { type: 'delete' }, { mood: 'warn', undo: () => undeleteTransaction(id) });
                router.back();
              }}>
              <Txt variant="caption" weight="bold" tone={color.danger}>
                DELETE
              </Txt>
            </Pressable>
          )}
          <Pressable onPress={() => router.back()} hitSlop={14}>
            <Txt variant="lead" dim>
              ✕
            </Txt>
          </Pressable>
        </Row>
      </Row>

      {/* Direction */}
      <Row style={s.segment}>
        {(['expense', 'income'] as TxKind[]).map((k) => {
          const active = k === kind;
          const c = k === 'income' ? color.income : color.expense;
          return (
            <Pressable
              key={k}
              onPress={() => {
                setKind(k);
                setCategoryId(undefined);
              }}
              style={[s.segItem, active && { backgroundColor: `${c}22`, borderColor: c }]}>
              <Txt variant="caption" weight="bold" spaced tone={active ? c : color.textDim}>
                {k === 'income' ? 'MONEY IN' : 'MONEY OUT'}
              </Txt>
            </Pressable>
          );
        })}
      </Row>

      {/* Amount */}
      <View style={s.amountBox}>
        <Txt variant="hero" weight="bold" tone={raw ? tint : color.textFaint}>
          {kind === 'income' ? '+' : '−'}
          {byCode(currency).symbol}
          {raw || '0'}
        </Txt>
      </View>

      {/* Categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space.sm, paddingBottom: space.md }}
        style={{ flexGrow: 0 }}>
        {cats.map((c) => {
          const active = c.id === categoryId;
          return (
            <Pressable
              key={c.id}
              onPress={() => setCategoryId(active ? undefined : c.id)}
              style={[s.chip, active && { backgroundColor: `${c.color}25`, borderColor: c.color }]}>
              <Txt variant="body">{c.icon}</Txt>
              <Txt variant="micro" weight="bold" tone={active ? c.color : color.textDim}>
                {c.name.toUpperCase()}
              </Txt>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* When */}
      <Row style={{ gap: space.sm, marginBottom: space.sm }}>
        {(
          [
            ['TODAY', startOfDay(Date.now())],
            ['YESTERDAY', startOfDay(Date.now()) - DAY],
          ] as const
        ).map(([label, ts]) => (
          <Pressable
            key={label}
            onPress={() => setDate(ts)}
            style={[s.day, date === ts && { borderColor: color.accent, backgroundColor: color.glow }]}>
            <Txt variant="micro" weight="bold" tone={date === ts ? color.accent : color.textDim}>
              {label}
            </Txt>
          </Pressable>
        ))}
        <Pressable onPress={() => setDate((d) => d - DAY)} style={s.day}>
          <Txt variant="micro" weight="bold" tone={color.textDim}>
            ◂ {shortDate(date - DAY).toUpperCase()}
          </Txt>
        </Pressable>
      </Row>

      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Note (optional)"
        placeholderTextColor={color.textFaint}
        style={s.note}
        returnKeyType="done"
      />

      <View style={{ marginTop: 'auto', paddingBottom: insets.bottom + space.md }}>
        <Keypad value={raw} onChange={setRaw} />
        <Button
          label={canSave ? (editing ? 'Save changes' : 'Save') : 'Enter an amount'}
          full
          disabled={!canSave}
          onPress={save}
          style={{ marginTop: space.md }}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg, paddingHorizontal: space.lg },
  segment: { backgroundColor: color.surface, padding: 4, gap: 4, borderRadius: radius.md },
  segItem: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radius.md,
  },
  amountBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: space.xl },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    height: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  day: {
    paddingHorizontal: space.md,
    height: 32,
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  note: {
    height: 44,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space.md,
    color: color.text,
    fontSize: 16,
    marginBottom: space.sm,
  },
});

import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { FileHeader } from '@/components/ui/agency';
import { Rise } from '@/components/ui/motion';
import { Amount, Card, Empty, Row, Screen, Txt } from '@/components/ui/primitives';
import { formatIn } from '@/lib/currency';
import { dayLabel, startOfDay } from '@/lib/date';
import { useSession } from '@/lib/session';
import { useData, useStore } from '@/lib/store';
import type { Transaction, TxKind } from '@/lib/types';
import { color, radius, space } from '@/theme/tokens';

type Filter = 'all' | TxKind;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'expense', label: 'OUT' },
  { key: 'income', label: 'IN' },
];

export default function Log() {
  const router = useRouter();
  const data = useData();
  const removeTransaction = useStore((s) => s.removeTransaction);
  const undeleteTransaction = useStore((s) => s.undeleteTransaction);
  const say = useSession((s) => s.say);
  const { currency } = data.settings;

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const catById = useMemo(
    () => new Map(data.categories.map((c) => [c.id, c])),
    [data.categories]
  );

  /** Filter, then group by day so the list reads like a statement. */
  const sections = useMemo(() => {
    const money = (c: number) => formatIn(c, currency);
    const q = query.trim().toLowerCase();
    const matched = data.transactions.filter((t) => {
      if (filter !== 'all' && t.kind !== filter) return false;
      if (!q) return true;
      const cat = t.categoryId ? catById.get(t.categoryId)?.name ?? '' : '';
      return (
        (t.note ?? '').toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q) ||
        money(t.amount).toLowerCase().includes(q)
      );
    });

    const groups = new Map<number, Transaction[]>();
    for (const t of matched) {
      const day = startOfDay(t.date);
      const list = groups.get(day);
      if (list) list.push(t);
      else groups.set(day, [t]);
    }
    return [...groups.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([day, items]) => ({
        day,
        items: items.sort((a, b) => b.createdAt - a.createdAt),
        net: items.reduce((sum, t) => sum + (t.kind === 'income' ? t.amount : -t.amount), 0),
      }));
  }, [data.transactions, filter, query, catById, currency]);

  const total = sections.reduce((n, s) => n + s.items.length, 0);
  const money = (c: number) => formatIn(c, currency);

  return (
    <Screen>
      <Rise>
        <FileHeader
          title="Ledger"
          code="K-02 / ENTRIES"
          subtitle={`${data.transactions.length} RECORDS ON FILE`}
        />
      </Rise>

      <Rise delay={60}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search notes, categories, amounts…"
          placeholderTextColor={color.textFaint}
          style={s.search}
          returnKeyType="search"
        />

        <Row style={{ gap: space.sm, marginTop: space.md, marginBottom: space.lg }}>
          {FILTERS.map((f) => {
            const active = f.key === filter;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[s.tab, active && { backgroundColor: color.glow, borderColor: color.accent }]}>
                <Txt variant="micro" weight="bold" spaced tone={active ? color.accent : color.textDim}>
                  {f.label}
                </Txt>
              </Pressable>
            );
          })}
        </Row>
      </Rise>

      {total === 0 ? (
        <Empty
          icon="▤"
          title={data.transactions.length === 0 ? 'Nothing logged yet' : 'No matches'}
          body={
            data.transactions.length === 0
              ? 'Tap a category on the home screen, punch in the amount, and it lands here.'
              : 'Try a different search or filter.'
          }
        />
      ) : (
        sections.map((section, si) => (
          <Rise key={section.day} delay={Math.min(si * 40, 200)}>
            <View style={{ marginBottom: space.lg }}>
              <Row style={{ justifyContent: 'space-between', marginBottom: space.sm }}>
                <Txt variant="micro" weight="bold" spaced dim>
                  {dayLabel(section.day).toUpperCase()}
                </Txt>
                <Amount variant="micro" tone={section.net >= 0 ? color.income : color.textFaint}>
                  {section.net >= 0 ? '+' : ''}
                  {money(section.net)}
                </Amount>
              </Row>

              <Card style={{ padding: 0 }}>
                {section.items.map((t, i) => {
                  const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => router.push({ pathname: '/add', params: { id: t.id } })}
                      onLongPress={() => {
                        removeTransaction(t.id);
                        say('Deleted.', { mood: 'warn', undo: () => undeleteTransaction(t.id) });
                      }}
                      style={({ pressed }) => [
                        s.row,
                        i > 0 && { borderTopWidth: 1, borderTopColor: color.border },
                        pressed && { backgroundColor: color.surfacePress },
                      ]}>
                      <Txt variant="title">{cat?.icon ?? '▦'}</Txt>
                      <View style={{ flex: 1, marginLeft: space.md }}>
                        <Txt variant="caption" weight="bold" numberOfLines={1}>
                          {t.note || cat?.name || 'Unfiled'}
                        </Txt>
                        <Txt variant="micro" faint style={{ marginTop: 2 }} numberOfLines={1}>
                          {(cat?.name ?? 'No category').toUpperCase()}
                        </Txt>
                      </View>
                      <Amount
                        variant="caption"
                        tone={t.kind === 'income' ? color.income : color.text}>
                        {t.kind === 'income' ? '+' : '−'}
                        {money(t.amount)}
                      </Amount>
                    </Pressable>
                  );
                })}
              </Card>
            </View>
          </Rise>
        ))
      )}

      {total > 0 && (
        <Txt variant="micro" faint style={{ textAlign: 'center', marginTop: space.md }}>
          TAP TO EDIT · LONG-PRESS TO DELETE
        </Txt>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  search: {
    height: 48,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space.md,
    color: color.text,
    fontSize: 18,
  },
  tab: {
    flex: 1,
    height: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', padding: space.md },
});

import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { LinkStatus } from '@/components/link-status';
import { Bric, LeaderRow } from '@/components/ui/agency';
import { CurrencyStrip } from '@/components/ui/currency-strip';
import { Rise, useRolling, useTypewriter } from '@/components/ui/motion';
import { Tap } from '@/components/ui/press';
import { Amount, Card, Cursor, Row, Rule, Screen, SectionTitle, Txt } from '@/components/ui/primitives';
import { useBriefing, type BriefTone } from '@/lib/bric';
import { useBric } from '@/lib/bric-store';
import { formatIn } from '@/lib/currency';
import { dayLabel } from '@/lib/date';
import { balance, monthTotals, useData } from '@/lib/store';
import { color, glyph, radius, space } from '@/theme/tokens';

const TONE: Record<BriefTone, string> = {
  urgent: color.expense,
  warn: color.warn,
  info: color.transfer,
  good: color.income,
};

export default function Home() {
  const router = useRouter();
  const data = useData();
  const { currency, travelCurrencies, rateOverrides, ratesSetAt } = data.settings;

  const total = balance(data);
  const rolled = useRolling(total);
  const month = monthTotals(data);
  const recent = data.transactions.slice(0, 4);
  const catById = new Map(data.categories.map((c) => [c.id, c]));
  const money = (c: number) => formatIn(c, currency);

  const { briefing: brief, live, linked } = useBriefing(data);
  const faulted = useBric((s) => s.link === 'error');
  // BRIC's greeting types itself out, so opening the app feels like he is
  // addressing you rather than a label being rendered.
  const greeting = useTypewriter(brief.greeting, 72);

  const quick = data.categories.filter((c) => !c.archived && c.kind === 'expense').slice(0, 6);

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        {/* BRIC leads. Everything else is his supporting material. */}
        <Rise delay={40}>
          <Card label="bric · neural link" tint={TONE[brief.items[0]?.tone ?? 'good']}>
            <Row style={{ gap: space.md, alignItems: 'flex-start' }}>
              <Tap scale={0.94} weight="medium" onPress={() => router.push(linked ? '/bric' : '/settings')}>
                <Bric mood={brief.mood} size={68} />
              </Tap>
              <View style={{ flex: 1 }}>
                <LinkStatus />
                {live ? (
                  <Row style={{ flexWrap: 'wrap' }}>
                    <Txt variant="caption" style={{ lineHeight: 19, minHeight: 38 }}>
                      {greeting}
                      {greeting.length < brief.greeting.length ? <Cursor /> : null}
                    </Txt>
                  </Row>
                ) : (
                  <Txt variant="micro" faint style={{ lineHeight: 16, marginTop: 4 }}>
                    {!linked
                      ? 'BRIC is dormant. Link a DeepSeek key and he wakes. Telemetry below.'
                      : faulted
                        ? 'Link fault — showing raw telemetry. Tap the core to retry in the channel.'
                        : 'Composing… showing raw telemetry meanwhile.'}
                  </Txt>
                )}
              </View>
            </Row>

            <Rule />

            {brief.items.map((item, i) => (
              <Tap
                key={item.id}
                scale={0.99}
                weight="light"
                style={[s.briefRow, i > 0 ? { borderTopWidth: 1, borderTopColor: color.border } : null]}
                onPress={() => item.href && router.push(item.href as never)}>
                <View style={[s.dot, { backgroundColor: TONE[item.tone] }]} />
                <Txt variant="caption" style={{ flex: 1, marginLeft: space.sm, lineHeight: 17 }}>
                  {item.text}
                </Txt>
                <Txt variant="caption" tone={color.textFaint}>
                  {glyph.arrow}
                </Txt>
              </Tap>
            ))}

            <Tap
              scale={0.98}
              weight="medium"
              style={s.talk}
              onPress={() => router.push(linked ? '/bric' : '/settings')}>
              <Txt variant="micro" weight="bold" spaced tone={color.accent}>
                {linked ? `${glyph.arrow} OPEN CHANNEL TO BRIC` : `${glyph.arrow} LINK BRIC`}
              </Txt>
            </Tap>
          </Card>
        </Rise>

        {/* Balance — swipe sideways for other currencies */}
        <Rise delay={100}>
          <Card label="balance" tint={color.accent} style={{ paddingVertical: space.xl }}>
            <CurrencyStrip
              cents={rolled}
              base={currency}
              codes={travelCurrencies ?? []}
              overrides={rateOverrides ?? {}}
              ratesSetAt={ratesSetAt}
            />
            <Rule />
            <LeaderRow label="In this month" value={money(month.income)} tone={color.income} />
            <LeaderRow label="Out this month" value={money(month.expense)} tone={color.expense} />
            <LeaderRow
              label="Net"
              value={money(month.net)}
              tone={month.net >= 0 ? color.income : color.expense}
              bold
            />
          </Card>
        </Rise>

        {/* Two taps to log anything */}
        <Rise delay={160}>
          <SectionTitle>Quick log</SectionTitle>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: space.sm, paddingRight: space.lg }}>
            {quick.map((c) => (
              <Tap
                key={c.id}
                weight="medium"
                style={[s.quick, { borderColor: `${c.color}66` }]}
                onPress={() => router.push({ pathname: '/add', params: { category: c.id } })}>
                <Txt variant="title">{c.icon}</Txt>
                <Txt variant="micro" tone={c.color} weight="bold" numberOfLines={1}>
                  {c.name.toUpperCase()}
                </Txt>
              </Tap>
            ))}
          </ScrollView>
        </Rise>

        {/* Recent */}
        <Rise delay={220}>
          <SectionTitle
            action={
              <Pressable hitSlop={8} onPress={() => router.push('/bank/log')}>
                <Txt variant="micro" weight="bold" spaced tone={color.accent}>
                  ALL
                </Txt>
              </Pressable>
            }>
            Recent
          </SectionTitle>

          {recent.length === 0 ? (
            <Card>
              <Txt variant="caption" dim style={{ textAlign: 'center', lineHeight: 19 }}>
                Nothing logged yet. Tap a category above, enter the amount, done.
              </Txt>
            </Card>
          ) : (
            <Card style={{ padding: 0 }}>
              {recent.map((t, i) => {
                const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
                return (
                  <Tap
                    key={t.id}
                    scale={0.99}
                    weight="light"
                    style={[
                      s.txRow,
                      i > 0 ? { borderTopWidth: 1, borderTopColor: color.border } : null,
                    ]}
                    onPress={() => router.push({ pathname: '/add', params: { id: t.id } })}>
                    <Txt variant="title">{cat?.icon ?? '▦'}</Txt>
                    <View style={{ flex: 1, marginLeft: space.md }}>
                      <Txt variant="caption" weight="bold" numberOfLines={1}>
                        {t.note || cat?.name || 'Unfiled'}
                      </Txt>
                      <Txt variant="micro" faint style={{ marginTop: 2 }}>
                        {dayLabel(t.date).toUpperCase()}
                      </Txt>
                    </View>
                    <Amount
                      variant="caption"
                      tone={t.kind === 'income' ? color.income : color.text}>
                      {t.kind === 'income' ? '+' : '−'}
                      {money(t.amount)}
                    </Amount>
                  </Tap>
                );
              })}
            </Card>
          )}
        </Rise>
      </Screen>

      <Tap
        weight="heavy"
        scale={0.9}
        style={s.fab}
        onPress={() => router.push('/add')}>
        <Txt variant="title" weight="bold" tone={color.accentText}>
          +
        </Txt>
      </Tap>
    </View>
  );
}

const s = StyleSheet.create({
  briefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.sm,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  talk: {
    marginTop: space.sm,
    borderWidth: 1,
    borderColor: color.accentDim,
    backgroundColor: color.glow,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    alignItems: 'center',
  },
  quick: {
    width: 84,
    height: 76,
    borderWidth: 1,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  txRow: { flexDirection: 'row', alignItems: 'center', padding: space.md },
  fab: {
    position: 'absolute',
    right: space.lg,
    bottom: 100,
    width: 56,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: color.accentDim,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

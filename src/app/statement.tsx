import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { BricSays, FileHeader, LeaderRow, Stamp } from '@/components/ui/agency';
import { Bar, Button, Card, Row, Rule, Screen, SectionTitle, Txt } from '@/components/ui/primitives';
import { Pulse, Rise } from '@/components/ui/motion';
import { fingerprint, statementPrompt, useRemark } from '@/lib/bric';
import { formatIn } from '@/lib/currency';
import { monthLabel, startOfBudgetMonth } from '@/lib/date';
import { monthHistory, spendByCategoryIn, useData, useStore } from '@/lib/store';
import { color, space } from '@/theme/tokens';

/**
 * The closing statement for the month that just ended.
 *
 * Deliberately formal — this is the one moment KEVLAR stops being a logging
 * tool and hands you a verdict.
 */
export default function Statement() {
  const router = useRouter();
  const data = useData();
  const updateSettings = useStore((s) => s.updateSettings);
  const { currency, monthStartDay } = data.settings;
  const money = (c: number) => formatIn(c, currency);

  // The month before the one currently running.
  const thisStart = startOfBudgetMonth(Date.now(), monthStartDay);
  const closedStart = startOfBudgetMonth(thisStart - 1, monthStartDay);

  const history = useMemo(() => monthHistory(data, 3), [data]);
  const closed = history[history.length - 2];
  const prior = history[history.length - 3];

  const spend = useMemo(() => spendByCategoryIn(data, closedStart), [data, closedStart]);
  const ranked = useMemo(
    () =>
      [...spend.entries()]
        .map(([id, amount]) => ({ cat: data.categories.find((c) => c.id === id), amount }))
        .filter((r) => !!r.cat)
        .sort((a, b) => b.amount - a.amount),
    [spend, data.categories]
  );

  const income = closed?.income ?? 0;
  const expense = closed?.expense ?? 0;
  const net = closed?.net ?? 0;
  const rate = income > 0 ? net / income : null;
  const change = prior && prior.expense > 0 ? (expense - prior.expense) / prior.expense : null;

  const surplus = net >= 0;
  const verdict = !closed || (income === 0 && expense === 0)
    ? 'no activity'
    : surplus
      ? 'surplus'
      : 'deficit';

  // BRIC's verdict, composed once per closed month and ledger state.
  const linked = !!data.settings.aiKey;
  const remark = useRemark(
    `statement:${closedStart}:${fingerprint(data)}`,
    verdict === 'no activity' ? null : statementPrompt(data),
    data
  );

  function acknowledge() {
    updateSettings({ lastStatementFor: closedStart });
    router.back();
  }

  return (
    <Screen>
      <Rise>
        <FileHeader
          title="Closing statement"
          code="K-07 / MONTHLY"
          subtitle={`PERIOD ENDING ${monthLabel(closedStart).toUpperCase()}`}
          right={
            <Pressable onPress={() => router.back()} hitSlop={14}>
              <Txt variant="title" dim>
                ✕
              </Txt>
            </Pressable>
          }
        />
      </Rise>

      {linked && verdict !== 'no activity' && (
        <Rise delay={60}>
          <BricSays mood={surplus ? 'happy' : 'warn'}>
            {remark ?? (
              <Pulse min={0.3} ms={420}>
                <Txt variant="micro" weight="bold" spaced tone={color.transfer}>
                  BRIC IS REVIEWING THE MONTH…
                </Txt>
              </Pulse>
            )}
          </BricSays>
        </Rise>
      )}

      <Rise delay={120}>
        <SectionTitle>The figures</SectionTitle>
        <Card label={monthLabel(closedStart).toLowerCase()}>
          <LeaderRow label="Received" value={money(income)} tone={color.income} />
          <LeaderRow label="Disbursed" value={money(expense)} tone={color.expense} />
          <Rule />
          <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Txt variant="caption" dim>
              NET POSITION
            </Txt>
            <Txt variant="title" weight="bold" tone={surplus ? color.income : color.expense}>
              {net >= 0 ? '+' : ''}
              {money(net)}
            </Txt>
          </Row>

          {rate !== null && (
            <LeaderRow
              label="Kept from income"
              value={`${Math.round(rate * 100)}%`}
              tone={rate > 0.1 ? color.income : color.warn}
            />
          )}
          {change !== null && (
            <LeaderRow
              label="Against prior month"
              value={`${change >= 0 ? '+' : ''}${Math.round(change * 100)}%`}
              tone={change > 0 ? color.warn : color.income}
            />
          )}

          <Row style={{ justifyContent: 'center', marginTop: space.lg }}>
            <Stamp
              text={verdict}
              tone={verdict === 'surplus' ? color.stampOk : verdict === 'deficit' ? color.stamp : color.textFaint}
              angle={-6}
            />
          </Row>
        </Card>
      </Rise>

      <Rise delay={180}>
        <SectionTitle>Where it went</SectionTitle>
        {ranked.length === 0 ? (
          <Card>
            <Txt variant="caption" dim style={{ textAlign: 'center' }}>
              No categorised spending in this period.
            </Txt>
          </Card>
        ) : (
          <Card>
            {ranked.map((r, i) => {
              const share = expense > 0 ? r.amount / expense : 0;
              return (
                <View key={r.cat!.id} style={{ marginTop: i === 0 ? 0 : space.md }}>
                  <Row style={{ justifyContent: 'space-between', marginBottom: 5 }}>
                    <Txt variant="caption" weight="medium">
                      {r.cat!.icon} {r.cat!.name}
                    </Txt>
                    <Row style={{ gap: space.sm }}>
                      <Txt variant="micro" faint>
                        {Math.round(share * 100)}%
                      </Txt>
                      <Txt variant="caption" weight="bold">
                        {money(r.amount)}
                      </Txt>
                    </Row>
                  </Row>
                  <Bar pct={share} tint={r.cat!.color} />
                </View>
              );
            })}
          </Card>
        )}
      </Rise>

      <Rise delay={240}>
        <Button label="Acknowledge" full style={{ marginTop: space.xl }} onPress={acknowledge} />
        <Txt variant="micro" faint style={{ textAlign: 'center', marginTop: space.md }}>
          FIGURES COMPUTED ON DEVICE
        </Txt>
      </Rise>
    </Screen>
  );
}

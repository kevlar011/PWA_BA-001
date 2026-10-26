import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { FileHeader } from '@/components/ui/agency';
import { Amount, Bar, Bubble, Card, Empty, Row, Rule, Screen, SectionTitle, Txt } from '@/components/ui/primitives';
import { TrendChart } from '@/components/ui/trend-chart';
import { endOfBudgetMonth, monthLabel, startOfBudgetMonth } from '@/lib/date';
import { formatMoney, parseAmount } from '@/lib/money';
import { monthHistory, monthTotals, spendByCategory, useData, useStore } from '@/lib/store';
import { color, radius, space } from '@/theme/tokens';

export default function Budgets() {
  const data = useData();
  const setBudget = useStore((s) => s.setBudget);
  const removeBudget = useStore((s) => s.removeBudget);
  const { currency, monthStartDay } = data.settings;

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const now = Date.now();
  const spend = useMemo(() => spendByCategory(data, now), [data, now]);
  const history = useMemo(() => monthHistory(data, 6, now), [data, now]);
  const month = monthTotals(data, now);

  const expenseCats = data.categories.filter((c) => !c.archived && c.kind === 'expense');
  const budgetByCat = new Map(data.budgets.map((b) => [b.categoryId, b]));

  const budgeted = data.budgets.reduce((n, b) => n + b.limit, 0);
  const spentOnBudgeted = data.budgets.reduce((n, b) => n + (spend.get(b.categoryId) ?? 0), 0);

  /** Categories with real spending this month, biggest first. */
  const breakdown = useMemo(
    () =>
      [...spend.entries()]
        .map(([id, amount]) => ({ cat: data.categories.find((c) => c.id === id), amount }))
        .filter((r) => !!r.cat)
        .sort((a, b) => b.amount - a.amount),
    [spend, data.categories]
  );

  const daysLeft = Math.max(
    0,
    Math.ceil((endOfBudgetMonth(now, monthStartDay) - now) / 86_400_000)
  );

  function commit(categoryId: string) {
    const cents = parseAmount(draft);
    if (cents > 0) setBudget(categoryId, cents);
    else {
      const existing = budgetByCat.get(categoryId);
      if (existing) removeBudget(existing.id);
    }
    setEditing(null);
    setDraft('');
  }

  return (
    <Screen>
      <FileHeader
        title="Allocations"
        code="K-03 / BUDGET"
        subtitle={`${monthLabel(startOfBudgetMonth(now, monthStartDay)).toUpperCase()} · ${daysLeft} DAYS REMAINING`}
      />

      {/* Month summary */}
      <Card style={{ marginTop: space.lg }}>
        <Row style={{ justifyContent: 'space-between', marginBottom: space.md }}>
          <View>
            <Txt variant="micro" dim style={{ letterSpacing: 1.2 }}>
              SPENT THIS MONTH
            </Txt>
            <Amount variant="display" weight="heavy" style={{ marginTop: space.xs }}>
              {formatMoney(month.expense, currency)}
            </Amount>
          </View>
        </Row>

        {budgeted > 0 ? (
          <>
            <Bar
              pct={spentOnBudgeted / budgeted}
              tint={spentOnBudgeted > budgeted ? color.danger : color.accent}
            />
            <Row style={{ justifyContent: 'space-between', marginTop: space.sm }}>
              <Txt variant="micro" dim>
                {formatMoney(spentOnBudgeted, currency)} of {formatMoney(budgeted, currency)} budgeted
              </Txt>
              <Amount
                variant="micro"
                tone={budgeted - spentOnBudgeted < 0 ? color.danger : color.income}>
                {formatMoney(budgeted - spentOnBudgeted, currency, { signed: true })}
              </Amount>
            </Row>
          </>
        ) : (
          <Txt variant="caption" dim>
            Set a cap on any category below to start tracking against a budget.
          </Txt>
        )}
      </Card>

      {/* Per-category caps */}
      <SectionTitle>Category caps</SectionTitle>

      {expenseCats.map((c) => {
        const b = budgetByCat.get(c.id);
        const spent = spend.get(c.id) ?? 0;
        const pct = b ? spent / b.limit : 0;
        const over = b ? spent > b.limit : false;
        const isEditing = editing === c.id;

        return (
          <Card key={c.id} style={{ marginBottom: space.sm, padding: space.md }}>
            <Row>
              <Bubble icon={c.icon} tint={c.color} size={36} />
              <View style={{ flex: 1, marginLeft: space.md }}>
                <Txt variant="body" weight="semibold">
                  {c.name}
                </Txt>
                <Txt variant="micro" faint style={{ marginTop: 2 }}>
                  {b ? `${formatMoney(spent, currency)} of ${formatMoney(b.limit, currency)}` : `${formatMoney(spent, currency)} spent · no cap`}
                </Txt>
              </View>

              {isEditing ? (
                <Row style={{ gap: space.sm }}>
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="0.00"
                    placeholderTextColor={color.textFaint}
                    keyboardType="decimal-pad"
                    inputMode="decimal"
                    autoFocus
                    style={s.capInput}
                    onSubmitEditing={() => commit(c.id)}
                  />
                  <Pressable onPress={() => commit(c.id)} hitSlop={8}>
                    <Txt variant="caption" weight="semibold" tone={color.accent}>
                      Save
                    </Txt>
                  </Pressable>
                </Row>
              ) : (
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    setEditing(c.id);
                    setDraft(b ? (b.limit / 100).toFixed(2) : '');
                  }}>
                  <Txt variant="caption" weight="semibold" tone={b ? color.textDim : color.accent}>
                    {b ? 'Edit' : 'Set cap'}
                  </Txt>
                </Pressable>
              )}
            </Row>

            {b && (
              <View style={{ marginTop: space.md }}>
                <Bar pct={pct} tint={over ? color.danger : pct > 0.85 ? color.warn : c.color} />
                {over && (
                  <Txt variant="micro" tone={color.danger} style={{ marginTop: space.xs }}>
                    Over by {formatMoney(spent - b.limit, currency)}
                  </Txt>
                )}
              </View>
            )}
          </Card>
        );
      })}

      {/* Where it actually went */}
      <SectionTitle>Where it went</SectionTitle>

      {breakdown.length === 0 ? (
        <Empty icon="📊" title="No spending yet" body="Log a few expenses and the breakdown appears here." />
      ) : (
        <Card>
          {breakdown.map((r, i) => {
            const share = month.expense > 0 ? r.amount / month.expense : 0;
            return (
              <View key={r.cat!.id} style={{ marginTop: i === 0 ? 0 : space.md }}>
                <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                  <Txt variant="caption" weight="medium">
                    {r.cat!.icon} {r.cat!.name}
                  </Txt>
                  <Row style={{ gap: space.sm }}>
                    <Txt variant="micro" faint>
                      {Math.round(share * 100)}%
                    </Txt>
                    <Amount variant="caption">{formatMoney(r.amount, currency)}</Amount>
                  </Row>
                </Row>
                <Bar pct={share} tint={r.cat!.color} />
              </View>
            );
          })}
        </Card>
      )}

      {/* Trend across recent months */}
      <SectionTitle>Trend</SectionTitle>
      {history.every((m) => m.income === 0 && m.expense === 0) ? (
        <Card>
          <Txt variant="caption" dim style={{ textAlign: 'center', lineHeight: 19 }}>
            Not enough history yet. Give it a full month and your spending will show up here.
          </Txt>
        </Card>
      ) : (
        <Card label="last 6 months">
          <TrendChart months={history} format={(c) => formatMoney(c, currency, { compact: true })} />
          <Rule />
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="micro" faint>
              AVERAGE OUT
            </Txt>
            <Amount variant="caption" tone={color.expense}>
              {formatMoney(
                Math.round(history.reduce((n, m) => n + m.expense, 0) / history.length),
                currency
              )}
            </Amount>
          </Row>
          <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
            <Txt variant="micro" faint>
              BEST MONTH
            </Txt>
            <Amount variant="caption" tone={color.income}>
              {formatMoney(Math.max(...history.map((m) => m.net)), currency, { signed: true })}
            </Amount>
          </Row>
        </Card>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  capInput: {
    width: 86,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: color.surfaceHi,
    borderWidth: 1,
    borderColor: color.borderHi,
    paddingHorizontal: space.sm,
    color: color.text,
    fontSize: 16,
    textAlign: 'right',
  },
});

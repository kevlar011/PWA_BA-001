import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { DebtsSection } from '@/components/debts';
import { FileHeader } from '@/components/ui/agency';
import { Amount, Bar, Bubble, Button, Card, Empty, Row, Screen, SectionTitle, Txt } from '@/components/ui/primitives';
import { advance, dueLabel, shortDate } from '@/lib/date';
import { isDebt } from '@/lib/debt';
import { formatMoney, parseAmount } from '@/lib/money';
import { useData, useStore } from '@/lib/store';
import type { RecurrenceUnit } from '@/lib/types';
import { color, radius, space, swatch } from '@/theme/tokens';

const GOAL_ICONS = ['🎯', '🏝️', '🚗', '🏠', '💻', '🎓', '💍', '🛟'];
const UNITS: { key: RecurrenceUnit; label: string }[] = [
  { key: 'week', label: 'Weekly' },
  { key: 'month', label: 'Monthly' },
  { key: 'year', label: 'Yearly' },
];

export default function Goals() {
  const data = useData();
  const { currency } = data.settings;

  const addGoal = useStore((s) => s.addGoal);
  const removeGoal = useStore((s) => s.removeGoal);
  const contributeToGoal = useStore((s) => s.contributeToGoal);
  const addRecurring = useStore((s) => s.addRecurring);
  const removeRecurring = useStore((s) => s.removeRecurring);
  const payRecurring = useStore((s) => s.payRecurring);

  const [goalForm, setGoalForm] = useState(false);
  const [gName, setGName] = useState('');
  const [gTarget, setGTarget] = useState('');
  const [gIcon, setGIcon] = useState(GOAL_ICONS[0]);

  const [billForm, setBillForm] = useState(false);
  const [bName, setBName] = useState('');
  const [bAmount, setBAmount] = useState('');
  const [bUnit, setBUnit] = useState<RecurrenceUnit>('month');

  const [topUp, setTopUp] = useState<{ id: string; value: string } | null>(null);

  // Debts share the goals list; they get their own section below.
  const savings = data.goals.filter((g) => !isDebt(g));
  const bills = [...data.recurring].sort((a, b) => a.nextDue - b.nextDue);

  /** What the subscriptions cost you across a year, normalised to a month. */
  const monthlyBillLoad = bills
    .filter((b) => b.active)
    .reduce((sum, b) => {
      const perYear = b.unit === 'week' ? 52 / b.every : b.unit === 'month' ? 12 / b.every : 1 / b.every;
      return sum + (b.amount * perYear) / 12;
    }, 0);

  function createGoal() {
    const name = gName.trim();
    const target = parseAmount(gTarget);
    if (!name || target <= 0) return;
    addGoal({
      name,
      icon: gIcon,
      target,
      color: swatch[data.goals.length % swatch.length],
    });
    setGName('');
    setGTarget('');
    setGoalForm(false);
  }

  function createBill() {
    const name = bName.trim();
    const amount = parseAmount(bAmount);
    if (!name || amount <= 0) return;
    addRecurring({
      name,
      amount,
      every: 1,
      unit: bUnit,
      nextDue: advance(Date.now(), 1, bUnit),
      color: swatch[data.recurring.length % swatch.length],
    });
    setBName('');
    setBAmount('');
    setBillForm(false);
  }

  return (
    <Screen>
      <FileHeader
        title="Objectives"
        code="K-05 / TARGETS"
        subtitle="SAVINGS, DEBTS & STANDING COMMITMENTS"
      />

      {/* Savings goals */}
      <SectionTitle
        action={
          <Pressable hitSlop={8} onPress={() => setGoalForm((v) => !v)}>
            <Txt variant="caption" weight="semibold" tone={color.accent}>
              {goalForm ? 'Cancel' : '+ New'}
            </Txt>
          </Pressable>
        }>
        Saving for
      </SectionTitle>

      {goalForm && (
        <Card style={{ marginBottom: space.md }}>
          <TextInput
            value={gName}
            onChangeText={setGName}
            placeholder="What are you saving for?"
            placeholderTextColor={color.textFaint}
            style={s.input}
            autoFocus
          />
          <TextInput
            value={gTarget}
            onChangeText={setGTarget}
            placeholder="Target amount"
            placeholderTextColor={color.textFaint}
            keyboardType="decimal-pad"
            inputMode="decimal"
            style={[s.input, { marginTop: space.sm }]}
          />
          <Row style={{ flexWrap: 'wrap', gap: space.sm, marginTop: space.md }}>
            {GOAL_ICONS.map((ic) => (
              <Pressable
                key={ic}
                onPress={() => setGIcon(ic)}
                style={[s.iconPick, gIcon === ic && { borderColor: color.accent, backgroundColor: `${color.accent}20` }]}>
                <Txt variant="lead">{ic}</Txt>
              </Pressable>
            ))}
          </Row>
          <Button label="Create goal" full style={{ marginTop: space.lg }} onPress={createGoal} />
        </Card>
      )}

      {savings.length === 0 && !goalForm ? (
        <Empty icon="🎯" title="No goals yet" body="Set a target and watch the bar fill up." />
      ) : (
        savings.map((g) => {
          const pct = g.target > 0 ? g.saved / g.target : 0;
          const done = g.saved >= g.target;
          const isTopping = topUp?.id === g.id;
          return (
            <Card key={g.id} style={{ marginBottom: space.md }}>
              <Row>
                <Bubble icon={g.icon} tint={g.color} />
                <View style={{ flex: 1, marginLeft: space.md }}>
                  <Txt variant="body" weight="semibold">
                    {g.name}
                  </Txt>
                  <Txt variant="micro" faint style={{ marginTop: 2 }}>
                    {formatMoney(g.saved, currency)} of {formatMoney(g.target, currency)}
                    {done ? ' · done 🎉' : ''}
                  </Txt>
                </View>
                <Amount variant="lead" weight="bold" tone={done ? color.income : color.text}>
                  {Math.round(pct * 100)}%
                </Amount>
              </Row>

              <View style={{ marginTop: space.md }}>
                <Bar pct={pct} tint={done ? color.income : g.color} />
              </View>

              {isTopping ? (
                <Row style={{ gap: space.sm, marginTop: space.md }}>
                  <TextInput
                    value={topUp.value}
                    onChangeText={(v) => setTopUp({ id: g.id, value: v })}
                    placeholder="Amount"
                    placeholderTextColor={color.textFaint}
                    keyboardType="decimal-pad"
                    inputMode="decimal"
                    autoFocus
                    style={[s.input, { flex: 1, height: 40 }]}
                  />
                  <Pressable
                    hitSlop={8}
                    onPress={() => {
                      contributeToGoal(g.id, parseAmount(topUp.value));
                      setTopUp(null);
                    }}>
                    <Txt variant="caption" weight="semibold" tone={color.income}>
                      Add
                    </Txt>
                  </Pressable>
                  <Pressable hitSlop={8} onPress={() => setTopUp(null)}>
                    <Txt variant="caption" dim>
                      Cancel
                    </Txt>
                  </Pressable>
                </Row>
              ) : (
                <Row style={{ gap: space.lg, marginTop: space.md }}>
                  <Pressable hitSlop={8} onPress={() => setTopUp({ id: g.id, value: '' })}>
                    <Txt variant="caption" weight="semibold" tone={color.accent}>
                      + Add money
                    </Txt>
                  </Pressable>
                  <Pressable hitSlop={8} onPress={() => contributeToGoal(g.id, -g.saved)}>
                    <Txt variant="caption" dim>
                      Reset
                    </Txt>
                  </Pressable>
                  <Pressable hitSlop={8} onPress={() => removeGoal(g.id)}>
                    <Txt variant="caption" tone={color.textFaint}>
                      Delete
                    </Txt>
                  </Pressable>
                </Row>
              )}
            </Card>
          );
        })
      )}

      <DebtsSection />

      {/* Recurring bills */}
      <SectionTitle
        action={
          <Pressable hitSlop={8} onPress={() => setBillForm((v) => !v)}>
            <Txt variant="caption" weight="semibold" tone={color.accent}>
              {billForm ? 'Cancel' : '+ New'}
            </Txt>
          </Pressable>
        }>
        Recurring
      </SectionTitle>

      {monthlyBillLoad > 0 && (
        <Card style={{ marginBottom: space.md, paddingVertical: space.md }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="caption" dim>
              Costing you per month
            </Txt>
            <Amount variant="lead" weight="bold" tone={color.warn}>
              {formatMoney(Math.round(monthlyBillLoad), currency)}
            </Amount>
          </Row>
        </Card>
      )}

      {billForm && (
        <Card style={{ marginBottom: space.md }}>
          <TextInput
            value={bName}
            onChangeText={setBName}
            placeholder="Name (e.g. Spotify)"
            placeholderTextColor={color.textFaint}
            style={s.input}
            autoFocus
          />
          <TextInput
            value={bAmount}
            onChangeText={setBAmount}
            placeholder="Amount"
            placeholderTextColor={color.textFaint}
            keyboardType="decimal-pad"
            inputMode="decimal"
            style={[s.input, { marginTop: space.sm }]}
          />
          <Row style={{ gap: space.sm, marginTop: space.md }}>
            {UNITS.map((u) => (
              <Pressable
                key={u.key}
                onPress={() => setBUnit(u.key)}
                style={[s.unit, bUnit === u.key && { borderColor: color.accent, backgroundColor: color.glow }]}>
                <Txt variant="caption" tone={bUnit === u.key ? color.accent : color.textDim}>
                  {u.label}
                </Txt>
              </Pressable>
            ))}
          </Row>
          <Button label="Add bill" full style={{ marginTop: space.lg }} onPress={createBill} />
        </Card>
      )}

      {bills.length === 0 && !billForm ? (
        <Empty icon="🔁" title="No recurring bills" body="Add subscriptions and rent so they stop surprising you." />
      ) : (
        bills.map((b) => {
          const late = b.nextDue < Date.now();
          return (
            <Card key={b.id} style={{ marginBottom: space.sm, padding: space.md }}>
              <Row>
                <Bubble icon="🔁" tint={b.color} size={36} />
                <View style={{ flex: 1, marginLeft: space.md }}>
                  <Txt variant="body" weight="semibold">
                    {b.name}
                  </Txt>
                  <Txt variant="micro" tone={late ? color.warn : color.textFaint} style={{ marginTop: 2 }}>
                    {shortDate(b.nextDue)} · {dueLabel(b.nextDue)}
                  </Txt>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Amount variant="body" weight="bold">
                    {formatMoney(b.amount, currency)}
                  </Amount>
                  <Row style={{ gap: space.md, marginTop: 4 }}>
                    <Pressable hitSlop={8} onPress={() => payRecurring(b.id)}>
                      <Txt variant="micro" weight="semibold" tone={color.accent}>
                        Log it
                      </Txt>
                    </Pressable>
                    <Pressable hitSlop={8} onPress={() => removeRecurring(b.id)}>
                      <Txt variant="micro" tone={color.textFaint}>
                        Delete
                      </Txt>
                    </Pressable>
                  </Row>
                </View>
              </Row>
            </Card>
          );
        })
      )}
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
    fontSize: 18,
  },
  iconPick: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unit: {
    flex: 1,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

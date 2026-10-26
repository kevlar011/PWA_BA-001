import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { LeaderRow } from '@/components/ui/agency';
import { Amount, Bar, Bubble, Button, Card, Empty, Row, SectionTitle, Txt } from '@/components/ui/primitives';
import { bricSay } from '@/lib/bric';
import { comparePlans, isDebt, minimumsTotal, owed } from '@/lib/debt';
import { formatMoney, parseAmount } from '@/lib/money';
import { useData, useStore } from '@/lib/store';
import { color, radius, space } from '@/theme/tokens';

/**
 * The "Paying off" section of the goals tab.
 *
 * Debts are goals with a `debt` block (see `lib/debt.ts`), so adding one is
 * `addGoal` and paying one is `contributeToGoal`, plus a real expense in the
 * ledger, because a payment is money leaving whether or not it feels like
 * spending.
 */
export function DebtsSection() {
  const data = useData();
  const { currency } = data.settings;
  const money = (c: number) => formatMoney(c, currency);

  const addGoal = useStore((s) => s.addGoal);
  const removeGoal = useStore((s) => s.removeGoal);
  const contributeToGoal = useStore((s) => s.contributeToGoal);
  const addTransaction = useStore((s) => s.addTransaction);
  const updateSettings = useStore((s) => s.updateSettings);

  const [form, setForm] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('');
  const [min, setMin] = useState('');
  const [payment, setPayment] = useState<{ id: string; value: string } | null>(null);
  const [extra, setExtra] = useState(() =>
    data.settings.debtExtra ? (data.settings.debtExtra / 100).toFixed(2) : ''
  );

  const debts = data.goals.filter(isDebt);
  const live = debts.filter((d) => owed(d) > 0);
  const total = live.reduce((n, d) => n + owed(d), 0);
  const plans = live.length > 0 ? comparePlans(live, data.settings.debtExtra ?? 0) : null;

  function create() {
    const label = name.trim();
    const cents = parseAmount(amount);
    if (!label || cents <= 0) return;
    // Typed as a percentage, stored in basis points so it stays an integer.
    const bps = Math.round(parseFloat(rate.replace(',', '.') || '0') * 100);
    addGoal({
      name: label,
      icon: '🧾',
      target: cents,
      color: color.expense,
      debt: { aprBps: Number.isFinite(bps) ? Math.max(0, bps) : 0, minPayment: parseAmount(min) },
    });
    bricSay(`DEBT ON FILE · ${label.toUpperCase()}`, { type: 'debt-added', name: label }, { mood: 'think' });
    setName('');
    setAmount('');
    setRate('');
    setMin('');
    setForm(false);
  }

  function pay(id: string, label: string, remaining: number, raw: string) {
    const cents = Math.min(parseAmount(raw), remaining);
    if (cents <= 0) return;
    contributeToGoal(id, cents);
    addTransaction({ kind: 'expense', amount: cents, note: `Debt payment · ${label}`, date: Date.now() });
    const cleared = cents >= remaining;
    bricSay(
      cleared ? `${label.toUpperCase()} CLEARED` : `PAID ${money(cents)} · ${label.toUpperCase()}`,
      { type: 'debt-paid', name: label, amount: cents, cleared },
      { mood: cleared ? 'happy' : 'idle' }
    );
    setPayment(null);
  }

  const saveExtra = () => updateSettings({ debtExtra: parseAmount(extra) });

  return (
    <>
      <SectionTitle
        action={
          <Pressable hitSlop={8} onPress={() => setForm((v) => !v)}>
            <Txt variant="caption" weight="semibold" tone={color.accent}>
              {form ? 'Cancel' : '+ New'}
            </Txt>
          </Pressable>
        }>
        Paying off
      </SectionTitle>

      {form && (
        <Card style={{ marginBottom: space.md }}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Who or what (e.g. Car loan)"
            placeholderTextColor={color.textFaint}
            style={s.input}
            autoFocus
          />
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="Amount owed now"
            placeholderTextColor={color.textFaint}
            keyboardType="decimal-pad"
            inputMode="decimal"
            style={[s.input, { marginTop: space.sm }]}
          />
          <Row style={{ gap: space.sm, marginTop: space.sm }}>
            <TextInput
              value={rate}
              onChangeText={setRate}
              placeholder="Rate % (0 if none)"
              placeholderTextColor={color.textFaint}
              keyboardType="decimal-pad"
              inputMode="decimal"
              style={[s.input, { flex: 1 }]}
            />
            <TextInput
              value={min}
              onChangeText={setMin}
              placeholder="Min / month"
              placeholderTextColor={color.textFaint}
              keyboardType="decimal-pad"
              inputMode="decimal"
              style={[s.input, { flex: 1 }]}
            />
          </Row>
          <Button label="Add debt" full style={{ marginTop: space.lg }} onPress={create} />
        </Card>
      )}

      {debts.length === 0 && !form ? (
        <Empty icon="🧾" title="No debts on file" body="Add a loan or a card and BRIC works out the quickest way to pay it off." />
      ) : (
        <>
          {plans && (
            <Card label="payoff plan" tint={color.warn} style={{ marginBottom: space.md }}>
              <LeaderRow label="Owed" value={money(total)} tone={color.expense} bold />
              <LeaderRow label="Minimums" value={`${money(minimumsTotal(live))}/mo`} />
              <Row style={{ gap: space.sm, alignItems: 'center', marginTop: space.sm }}>
                <Txt variant="caption" dim style={{ flex: 1 }}>
                  Extra each month
                </Txt>
                <TextInput
                  value={extra}
                  onChangeText={setExtra}
                  onBlur={saveExtra}
                  onSubmitEditing={saveExtra}
                  placeholder="0"
                  placeholderTextColor={color.textFaint}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  style={[s.input, { width: 120, height: 40, textAlign: 'right' }]}
                />
              </Row>
              {plans.map((p, i) => (
                <View key={p.strategy} style={[s.plan, i === 0 && { borderColor: color.income }]}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Txt variant="micro" weight="bold" spaced tone={i === 0 ? color.income : color.textDim}>
                      {`${p.strategy === 'avalanche' ? 'HIGHEST RATE FIRST' : 'SMALLEST FIRST'}${i === 0 ? ' · BEST' : ''}`}
                    </Txt>
                    <Txt variant="micro" weight="bold" tone={i === 0 ? color.income : color.textDim}>
                      {p.months === null ? 'NEVER' : `${p.months} MO`}
                    </Txt>
                  </Row>
                  <Txt variant="micro" faint style={{ marginTop: 4, lineHeight: 16 }}>
                    {p.months === null
                      ? 'At this rate the interest grows faster than you pay. Add more each month.'
                      : `${p.interest > 0 ? `${money(p.interest)} interest · ` : ''}${p.order.join(' → ')}`}
                  </Txt>
                </View>
              ))}
            </Card>
          )}

          {debts.map((d) => {
            const left = owed(d);
            const apr = (d.debt?.aprBps ?? 0) / 100;
            const paying = payment?.id === d.id;
            return (
              <Card key={d.id} style={{ marginBottom: space.md }}>
                <Row>
                  <Bubble icon={d.icon} tint={left > 0 ? color.expense : color.income} />
                  <View style={{ flex: 1, marginLeft: space.md }}>
                    <Txt variant="body" weight="semibold">
                      {d.name}
                    </Txt>
                    <Txt variant="micro" faint style={{ marginTop: 2 }}>
                      {apr > 0 ? `${apr.toFixed(2)}%` : 'no interest'}
                      {d.debt?.minPayment ? ` · min ${money(d.debt.minPayment)}` : ''}
                      {left === 0 ? ' · cleared ✓' : ''}
                    </Txt>
                  </View>
                  <Amount variant="lead" weight="bold" tone={left > 0 ? color.expense : color.income}>
                    {money(left)}
                  </Amount>
                </Row>

                <View style={{ marginTop: space.md }}>
                  <Bar pct={d.target > 0 ? d.saved / d.target : 0} tint={left > 0 ? color.warn : color.income} />
                </View>

                {paying ? (
                  <Row style={{ gap: space.sm, marginTop: space.md }}>
                    <TextInput
                      value={payment.value}
                      onChangeText={(v) => setPayment({ id: d.id, value: v })}
                      placeholder="Amount paid"
                      placeholderTextColor={color.textFaint}
                      keyboardType="decimal-pad"
                      inputMode="decimal"
                      autoFocus
                      style={[s.input, { flex: 1, height: 40 }]}
                    />
                    <Pressable hitSlop={8} onPress={() => pay(d.id, d.name, left, payment.value)}>
                      <Txt variant="caption" weight="semibold" tone={color.income}>
                        Pay
                      </Txt>
                    </Pressable>
                    <Pressable hitSlop={8} onPress={() => setPayment(null)}>
                      <Txt variant="caption" dim>
                        Cancel
                      </Txt>
                    </Pressable>
                  </Row>
                ) : (
                  <Row style={{ gap: space.lg, marginTop: space.md }}>
                    {left > 0 && (
                      <Pressable hitSlop={8} onPress={() => setPayment({ id: d.id, value: '' })}>
                        <Txt variant="caption" weight="semibold" tone={color.accent}>
                          + Log payment
                        </Txt>
                      </Pressable>
                    )}
                    <Pressable hitSlop={8} onPress={() => removeGoal(d.id)}>
                      <Txt variant="caption" tone={color.textFaint}>
                        Delete
                      </Txt>
                    </Pressable>
                  </Row>
                )}
              </Card>
            );
          })}
        </>
      )}
    </>
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
  plan: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    padding: space.sm,
    marginTop: space.sm,
  },
});

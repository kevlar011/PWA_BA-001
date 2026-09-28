import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { LinkStatus } from '@/components/link-status';
import { Bric, BricSays, FileHeader, LeaderRow, Stamp } from '@/components/ui/agency';
import { Fade, Pulse, Rise } from '@/components/ui/motion';
import { Amount, Bar, Button, Card, Row, Rule, Screen, SectionTitle, Txt } from '@/components/ui/primitives';
import { HAWL_DAYS, hawlCompletesOn, settleZakat } from '@/lib/zakat';
import { buildFindings, computeMetrics, computeZakat, type Severity } from '@/lib/advisor';
import { bricSay, useAdvisory } from '@/lib/bric';
import { useBric } from '@/lib/bric-store';
import { formatIn } from '@/lib/currency';
import { useData, useStore } from '@/lib/store';
import { color, glyph, space } from '@/theme/tokens';

const TONE: Record<Severity, string> = {
  good: color.income,
  info: color.transfer,
  warn: color.warn,
  alarm: color.expense,
};

/** What the terminal prints while BRIC reads — real counts, not flavour text. */
function Analysing({ records, budgets, bills }: { records: number; budgets: number; bills: number }) {
  const lines = [
    `PARSING ${records} LEDGER RECORDS`,
    `CROSS-REFERENCING ${budgets} BUDGET CAPS`,
    `PROJECTING ${bills} STANDING PAYMENTS`,
    'COMPOSING REPORT',
  ];
  return (
    <Card label="analysis in progress" tint={color.transfer}>
      <Row style={{ gap: space.lg }}>
        <Bric mood="think" size={72} state="thinking" />
        <View style={{ flex: 1 }}>
          {lines.map((l, i) => (
            <Fade key={l} delay={i * 450}>
              <Txt variant="micro" weight="bold" spaced tone={i === lines.length - 1 ? color.transfer : color.textDim}>
                {`${glyph.arrow} ${l}`}
              </Txt>
            </Fade>
          ))}
        </View>
      </Row>
    </Card>
  );
}

export default function Advisor() {
  const router = useRouter();
  const data = useData();
  const updateSettings = useStore((s) => s.updateSettings);
  const { currency } = data.settings;

  const now = Date.now();
  const m = useMemo(() => computeMetrics(data, now), [data, now]);
  const zakat = useMemo(() => computeZakat(data), [data]);
  const telemetry = useMemo(() => buildFindings(data), [data]);
  const { advisory, fresh, linked, refresh } = useAdvisory(data);
  const faulted = useBric((s) => s.link === 'error');

  const money = (c: number) => formatIn(c, currency);
  const worst = advisory?.findings[0]?.severity ?? telemetry[0]?.severity ?? 'good';
  const mood = worst === 'alarm' ? 'alarm' : worst === 'warn' ? 'warn' : worst === 'info' ? 'think' : 'happy';

  return (
    <Screen>
      <FileHeader
        title="Advisory"
        code="K-04 / ANALYSIS"
        subtitle={linked ? 'WRITTEN BY BRIC FROM FIGURES COMPUTED ON THIS DEVICE' : 'RAW TELEMETRY · BRIC OFFLINE'}
      />

      <Rise>
        {!linked ? (
          <Card tint={color.border}>
            <Row style={{ gap: space.md }}>
              <Bric size={52} />
              <View style={{ flex: 1 }}>
                <LinkStatus />
                <Txt variant="micro" faint style={{ marginTop: 4, lineHeight: 16 }}>
                  Without a link, this is the device's raw analysis. Link BRIC and he writes it up
                  properly.
                </Txt>
              </View>
            </Row>
            <Button label="Link BRIC" kind="ghost" full style={{ marginTop: space.md }} onPress={() => router.push('/settings')} />
          </Card>
        ) : advisory ? (
          <BricSays mood={mood}>{advisory.opening}</BricSays>
        ) : faulted ? (
          <Card tint={color.expense}>
            <Row style={{ gap: space.md }}>
              <Bric size={52} mood="warn" />
              <View style={{ flex: 1 }}>
                <LinkStatus />
                <Txt variant="micro" faint style={{ marginTop: 4, lineHeight: 16 }}>
                  BRIC could not complete the analysis. Raw telemetry below.
                </Txt>
              </View>
            </Row>
            <Button label="Retry" kind="ghost" full style={{ marginTop: space.md }} onPress={() => void refresh()} />
          </Card>
        ) : (
          <Analysing
            records={data.transactions.length}
            budgets={data.budgets.length}
            bills={data.recurring.length}
          />
        )}
      </Rise>

      {/* Vitals */}
      <SectionTitle>Vitals</SectionTitle>
      <Card label="this month">
        <LeaderRow label="Income" value={money(m.income)} tone={color.income} />
        <LeaderRow label="Spent" value={money(m.expense)} tone={color.expense} />
        <LeaderRow label="Net" value={money(m.net)} tone={m.net >= 0 ? color.income : color.expense} bold />
        <Rule />
        <LeaderRow
          label="Savings rate"
          value={m.savingsRate === null ? '—' : `${Math.round(m.savingsRate * 100)}%`}
        />
        <LeaderRow label="Daily burn" value={money(Math.round(m.dailyBurn))} />
        <LeaderRow
          label="Projected month"
          value={money(m.projectedSpend)}
          tone={m.prevExpense && m.projectedSpend > m.prevExpense ? color.warn : undefined}
        />
        <LeaderRow
          label="Runway"
          value={m.runwayDays === null ? '—' : `${m.runwayDays} days`}
          tone={m.runwayDays !== null && m.runwayDays < 30 ? color.expense : undefined}
        />
        <LeaderRow
          label="Emergency cover"
          value={m.emergencyMonths === null ? '—' : `${m.emergencyMonths.toFixed(1)} months`}
          tone={
            m.emergencyMonths === null
              ? undefined
              : m.emergencyMonths < 1
                ? color.expense
                : m.emergencyMonths < 3
                  ? color.warn
                  : color.income
          }
        />
        <LeaderRow label="Committed monthly" value={money(Math.round(m.recurringMonthly))} />

        {m.emergencyMonths !== null && (
          <View style={{ marginTop: space.md }}>
            <Txt variant="micro" faint style={{ marginBottom: 4 }}>
              EMERGENCY COVER · TARGET 3 MONTHS
            </Txt>
            <Bar
              pct={m.emergencyMonths / 3}
              tint={m.emergencyMonths < 1 ? color.expense : m.emergencyMonths < 3 ? color.warn : color.income}
            />
          </View>
        )}
      </Card>

      {/* Zakat */}
      {data.settings.islamicMode && (
        <>
          <SectionTitle>Zakat</SectionTitle>
          <Card label="2.5% · nisab 85g gold" tint={color.mustard}>
            <LeaderRow label="Qualifying wealth" value={money(zakat.base)} />
            <LeaderRow
              label="Nisab threshold"
              value={zakat.nisab === null ? 'set gold price' : money(zakat.nisab)}
            />
            <LeaderRow
              label="Hawl status"
              value={
                zakat.needsGoldPrice
                  ? '—'
                  : !zakat.aboveNisab
                    ? 'not running'
                    : zakat.payable
                      ? 'complete'
                      : `${zakat.daysRemaining} days left`
              }
              tone={zakat.payable ? color.mustard : undefined}
            />
            {zakat.hawlStartedAt && (
              <LeaderRow
                label="Due on"
                value={new Date(hawlCompletesOn(zakat.hawlStartedAt)).toLocaleDateString()}
              />
            )}

            {zakat.hawlStartedAt && zakat.daysRemaining !== null && (
              <View style={{ marginTop: space.md }}>
                <Bar
                  pct={1 - zakat.daysRemaining / HAWL_DAYS}
                  tint={zakat.payable ? color.mustard : color.accentDim}
                />
              </View>
            )}

            <Rule />
            <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <Txt variant="caption" dim>
                {zakat.payable ? 'DUE NOW' : 'WOULD BE DUE'}
              </Txt>
              <Amount variant="title" tone={color.mustard}>
                {zakat.due === null ? '—' : money(zakat.due)}
              </Amount>
            </Row>

            {zakat.payable && (
              <Button
                label="Mark zakat paid"
                full
                style={{ marginTop: space.md }}
                onPress={() => {
                  updateSettings(settleZakat(data));
                  bricSay('ZAKAT SETTLED · NEW HAWL BEGINS', { type: 'zakat-paid' }, { mood: 'happy' });
                }}
              />
            )}

            <Txt variant="micro" faint style={{ marginTop: space.md, lineHeight: 16 }}>
              Estimate based on logged balances only. Excludes gold, property, business assets and
              debts owed. The hawl resets if your wealth falls below the nisab. Confirm with a
              scholar.
            </Txt>
          </Card>
        </>
      )}

      {/* Findings */}
      <SectionTitle
        action={
          linked && advisory ? (
            fresh || faulted ? (
              <Pressable hitSlop={8} onPress={() => void refresh()}>
                <Txt variant="micro" weight="bold" spaced tone={color.accent}>
                  RE-RUN
                </Txt>
              </Pressable>
            ) : (
              <Pulse min={0.3} ms={500}>
                <Txt variant="micro" weight="bold" spaced tone={color.transfer}>
                  RECALIBRATING
                </Txt>
              </Pulse>
            )
          ) : undefined
        }>
        Findings
      </SectionTitle>

      {advisory
        ? advisory.findings.map((f, i) => (
            <Rise key={f.id} delay={Math.min(i * 60, 300)}>
              <Card tint={`${TONE[f.severity]}55`} style={{ marginBottom: space.md }}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, marginRight: space.md }}>
                    <Stamp text={f.tag} tone={TONE[f.severity]} angle={-3} />
                    <Txt variant="body" weight="bold" style={{ marginTop: space.md }}>
                      {f.title}
                    </Txt>
                  </View>
                  {f.metric ? (
                    <Amount variant="title" tone={TONE[f.severity]}>
                      {f.metric}
                    </Amount>
                  ) : null}
                </Row>
                <Txt variant="caption" dim style={{ marginTop: space.md, lineHeight: 19 }}>
                  {f.body}
                </Txt>
              </Card>
            </Rise>
          ))
        : telemetry.map((f, i) => (
            <Rise key={f.id} delay={Math.min(i * 40, 240)}>
              <View style={[s.tele, { borderLeftColor: TONE[f.severity] }]}>
                <View style={{ flex: 1 }}>
                  <Txt variant="micro" weight="bold" spaced tone={TONE[f.severity]}>
                    {f.tag.toUpperCase()}
                  </Txt>
                  <Txt variant="caption" style={{ marginTop: 2, lineHeight: 18 }}>
                    {f.readout}
                  </Txt>
                </View>
                {f.metric ? (
                  <Amount variant="lead" tone={TONE[f.severity]}>
                    {f.metric}
                  </Amount>
                ) : null}
              </View>
            </Rise>
          ))}

      {linked && (
        <Button
          label="Discuss with BRIC"
          kind="ghost"
          full
          style={{ marginTop: space.md }}
          onPress={() => router.push('/bric')}
        />
      )}

      <Card style={{ marginTop: space.lg }} tint={color.border}>
        <Txt variant="micro" faint style={{ lineHeight: 16 }}>
          The figures are computed on your device. When BRIC is linked, a summary of them is sent to
          DeepSeek so he can write this up. He is not a licensed financial adviser and will not
          recommend specific investments. Religious rulings are summarised for orientation only —
          take them to a qualified scholar.
        </Txt>
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  tele: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: color.surface,
    borderLeftWidth: 3,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    marginBottom: space.sm,
  },
});

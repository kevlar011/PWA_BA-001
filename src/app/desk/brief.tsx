import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ScanStatus } from '@/components/scan-status';
import { FileHeader, Stamp, Vane, VaneSays } from '@/components/ui/agency';
import { Rise, useRolling, useTypewriter } from '@/components/ui/motion';
import { Tap } from '@/components/ui/press';
import { Card, Empty, Row, Rule, Screen, SectionTitle, Txt } from '@/components/ui/primitives';
import { completedSince, openTasks, overdueTasks, useDocket } from '@/lib/store';
import { DAY, dueLabel } from '@/lib/date';
import {
  blipLevel,
  buildSignals,
  deadlineStrip,
  scopeBlips,
  streak,
  vaneBriefing,
  vaneSignoff,
  type BlipLevel,
  type Severity,
} from '@/lib/vane';
import type { Task } from '@/lib/types';
import { color, glyph, radius, space, subsystem } from '@/theme/tokens';

const TONE: Record<Severity, string> = {
  alarm: color.expense,
  warn: color.warn,
  info: color.transfer,
  good: color.income,
};

const LABEL: Record<Severity, string> = {
  alarm: 'act now',
  warn: 'watch',
  info: 'noted',
  good: 'clear',
};

const LEVEL_TONE: Record<BlipLevel, string> = {
  late: color.expense,
  soon: color.warn,
  later: subsystem.desk,
};

const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** A big rolling number with a small label under it — one gauge on the HUD. */
function Gauge({ label, value, tone }: { label: string; value: number; tone?: string }) {
  const shown = useRolling(value, 700);
  return (
    <View style={s.gauge}>
      <Txt variant="display" weight="bold" tone={tone ?? color.text}>
        {String(shown).padStart(2, '0')}
      </Txt>
      <Txt variant="micro" spaced faint>
        {label}
      </Txt>
    </View>
  );
}

/**
 * Fourteen days as columns, overdue as a column of its own on the left. Each
 * entry is a block in its day; tap a day to open the first thing due in it.
 */
function DeadlineStrip({ onOpen }: { onOpen: (t: Task) => void }) {
  const docket = useDocket();
  const { late, days } = useMemo(() => deadlineStrip(docket), [docket]);
  const today = new Date().getDate();

  const column = (key: string, tasks: Task[], label: string, sub: string, level: BlipLevel, isToday = false) => (
    <Tap
      key={key}
      scale={0.9}
      weight="light"
      disabled={tasks.length === 0}
      style={[s.col, isToday && { borderColor: subsystem.desk, backgroundColor: `${subsystem.desk}14` }]}
      onPress={() => tasks[0] && onOpen(tasks[0])}>
      <View style={s.stack}>
        {tasks.slice(0, 4).map((t) => (
          <View key={t.id} style={[s.block, { backgroundColor: LEVEL_TONE[level] }]} />
        ))}
        {tasks.length > 4 && (
          <Txt variant="micro" tone={LEVEL_TONE[level]} style={{ fontSize: 9 }}>
            +{tasks.length - 4}
          </Txt>
        )}
      </View>
      <Txt variant="micro" weight="bold" tone={isToday ? subsystem.desk : tasks.length ? color.text : color.textFaint} style={{ fontSize: 11 }}>
        {label}
      </Txt>
      <Txt variant="micro" faint style={{ fontSize: 9 }}>
        {sub}
      </Txt>
    </Tap>
  );

  return (
    <Row style={{ alignItems: 'stretch', gap: 2 }}>
      {column('late', late, '!!', 'LATE', 'late')}
      <View style={s.divider} />
      {days.map((d, i) => {
        const date = new Date(d.day);
        return column(
          String(d.day),
          d.tasks,
          String(date.getDate()),
          WEEKDAY[date.getDay()],
          i <= 3 ? 'soon' : 'later',
          date.getDate() === today && i === 0
        );
      })}
    </Row>
  );
}

export default function Brief() {
  const router = useRouter();
  const docket = useDocket();

  const signals = buildSignals(docket);
  const brief = vaneBriefing(docket);
  const greeting = useTypewriter(brief.greeting, 76);
  const blips = useMemo(() => scopeBlips(docket), [docket]);

  const open = openTasks(docket);
  const late = overdueTasks(docket);
  const week = completedSince(docket, Date.now() - 7 * DAY);
  const run = streak(docket);

  // Overdue sorts first on its own, since its due date is the earliest.
  const upcoming = open
    .filter((t) => t.due !== undefined && (t.due as number) <= Date.now() + 14 * DAY)
    .sort((a, b) => (a.due ?? 0) - (b.due ?? 0))
    .slice(0, 5);

  const openTask = (t: Task) => router.push({ pathname: '/task', params: { id: t.id } });

  return (
    <Screen>
      <Rise>
        <FileHeader title="Brief" code="DKT-002/B" subtitle="EVERYTHING VANE CAN TELL FROM YOUR NOTES" />
      </Rise>

      {/* The scope is the brief. Everything below explains what it shows. */}
      <Rise delay={40}>
        <View style={s.hud}>
          <View style={[s.corner, { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 }]} />
          <View style={[s.corner, { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 }]} />
          <View style={[s.corner, { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 }]} />
          <View style={[s.corner, { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 }]} />

          <Vane mood={brief.mood} size={128} blips={blips} />
          <View style={{ marginTop: space.md }}>
            <ScanStatus docket={docket} align="center" />
          </View>
          <Row style={{ gap: space.lg, marginTop: space.sm, justifyContent: 'center' }}>
            {(
              [
                ['late', 'OVERDUE'],
                ['soon', '≤ 3 DAYS'],
                ['later', '≤ 14 DAYS'],
              ] as const
            ).map(([level, label]) => (
              <Row key={level} style={{ gap: 5 }}>
                <View style={[s.key, { backgroundColor: LEVEL_TONE[level] }]} />
                <Txt variant="micro" faint>
                  {label}
                </Txt>
              </Row>
            ))}
          </Row>
        </View>
      </Rise>

      <Rise delay={90}>
        <View style={{ marginTop: space.lg }}>
          <VaneSays mood={brief.mood}>{greeting}</VaneSays>
        </View>
      </Rise>

      <Rise delay={130}>
        <Row style={s.gauges}>
          <Gauge label="OPEN" value={open.length} />
          <Gauge label="OVERDUE" value={late.length} tone={late.length > 0 ? color.expense : color.textFaint} />
          <Gauge label="CLOSED 7D" value={week.length} tone={week.length > 0 ? color.income : color.textFaint} />
          <Gauge label="STREAK" value={run} tone={run >= 3 ? color.income : undefined} />
        </Row>
      </Rise>

      <Rise delay={170}>
        <SectionTitle>Next fourteen days</SectionTitle>
        <Card style={{ paddingHorizontal: space.sm }}>
          <DeadlineStrip onOpen={openTask} />
          {upcoming.length > 0 && (
            <>
              <Rule />
              {upcoming.map((t) => {
                const level = blipLevel(t.due as number);
                return (
                  <Tap key={t.id} scale={0.99} weight="light" style={s.upcoming} onPress={() => openTask(t)}>
                    <View style={[s.key, { backgroundColor: LEVEL_TONE[level] }]} />
                    <Txt variant="caption" numberOfLines={1} style={{ flex: 1, marginLeft: space.sm }}>
                      {t.title}
                    </Txt>
                    <Txt variant="micro" weight="bold" tone={LEVEL_TONE[level]}>
                      {dueLabel(t.due as number).toUpperCase()}
                    </Txt>
                  </Tap>
                );
              })}
            </>
          )}
          {upcoming.length === 0 && (
            <Txt variant="micro" faint style={{ textAlign: 'center', marginTop: space.md }}>
              Nothing dated in the next two weeks. Give an entry a deadline and it lands here.
            </Txt>
          )}
        </Card>
      </Rise>

      <Rise delay={210}>
        <SectionTitle>{`${signals.length} signal${signals.length === 1 ? '' : 's'}`}</SectionTitle>

        {signals.length === 0 ? (
          <Empty
            icon="◠"
            title="Nothing on the scope"
            body="No deadlines, no drift, nothing gone cold. Write more down and she will have more to say."
          />
        ) : (
          signals.map((sig) => (
            <Tap
              key={sig.id}
              scale={0.99}
              weight="light"
              style={[s.signal, { borderLeftColor: TONE[sig.severity] }]}
              onPress={() => sig.href && router.push(sig.href as never)}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Stamp text={LABEL[sig.severity]} tone={TONE[sig.severity]} angle={-3} />
                <Txt variant="caption" tone={color.textFaint}>
                  {glyph.arrow}
                </Txt>
              </Row>
              <Txt variant="caption" weight="bold" style={{ marginTop: space.md }}>
                {sig.title}
              </Txt>
              <Txt variant="caption" dim style={{ marginTop: 4, lineHeight: 19 }}>
                {sig.detail}
              </Txt>
            </Tap>
          ))
        )}
      </Rise>

      <Rise delay={250}>
        <Rule />
        <Txt variant="micro" faint style={{ textAlign: 'center', lineHeight: 17 }}>
          {vaneSignoff()}
        </Txt>
        <Txt variant="micro" faint style={{ textAlign: 'center', lineHeight: 17, marginTop: space.sm }}>
          VANE is a rules engine, not a model. She reads what you have written down and nothing
          else — no connection, no lookups.
        </Txt>
      </Rise>
    </Screen>
  );
}

const s = StyleSheet.create({
  hud: {
    alignItems: 'center',
    paddingVertical: space.lg,
    paddingHorizontal: space.md,
    backgroundColor: color.surface,
  },
  corner: { position: 'absolute', width: 18, height: 18, borderColor: `${subsystem.desk}99` },
  key: { width: 7, height: 7, borderRadius: 4 },
  gauges: {
    marginTop: space.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: color.border,
    paddingVertical: space.md,
    justifyContent: 'space-between',
  },
  gauge: { flex: 1, alignItems: 'center' },
  col: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radius.sm,
    gap: 2,
  },
  stack: { height: 40, justifyContent: 'flex-end', alignItems: 'center', gap: 2 },
  block: { width: 10, height: 6 },
  divider: { width: 1, backgroundColor: color.border, marginHorizontal: 2 },
  upcoming: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  signal: {
    borderLeftWidth: 3,
    backgroundColor: color.surface,
    padding: space.lg,
    marginBottom: space.sm,
  },
});

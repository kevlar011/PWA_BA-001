import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SyncPip } from '@/components/sync-pip';
import { Bric, LeaderRow, Vane } from '@/components/ui/agency';
import { Fade, Rise } from '@/components/ui/motion';
import { Tap } from '@/components/ui/press';
import { Row, Screen, SectionTitle, Txt } from '@/components/ui/primitives';
import { useBriefing } from '@/lib/bric';
import { formatIn } from '@/lib/currency';
import { dueLabel } from '@/lib/date';
import { useSession } from '@/lib/session';
import { balance, openTasks, overdueTasks, useData, useDocket } from '@/lib/store';
import { vaneBriefing } from '@/lib/vane';
import { color, glyph, radius, space, subsystem } from '@/theme/tokens';
import type { BriefTone } from '@/lib/brief';
import type { Mood } from '@/components/ui/agency';

const TONE: Record<BriefTone, string> = {
  urgent: color.expense,
  warn: color.warn,
  info: color.transfer,
  good: color.income,
};

/* -------------------------------------------------------------------------- */
/* Boot                                                                       */
/* -------------------------------------------------------------------------- */

const boot = (linked: boolean) => [
  'KEVLAR MAINFRAME',
  'POST .................. OK',
  'LOCAL STORE ........... MOUNTED',
  'CIPHER ................ AES-GCM',
  'BNK-001 ............... ONLINE',
  `  NEURAL LINK ......... ${linked ? 'ESTABLISHED' : 'OFFLINE'}`,
  'DKT-002 ............... ONLINE',
  'READY',
];

/**
 * Cold-start sequence.
 *
 * Pure theatre, and kept short enough to stay charming — it runs once per
 * launch, not once per visit, so backing out of a subsystem never makes him
 * sit through it again.
 */
function BootSequence({ onDone, linked }: { onDone: () => void; linked: boolean }) {
  const [line, setLine] = useState(0);
  const BOOT = boot(linked);

  useEffect(() => {
    if (line >= BOOT.length) {
      const end = setTimeout(onDone, 260);
      return () => clearTimeout(end);
    }
    const id = setTimeout(() => setLine((n) => n + 1), line === 0 ? 190 : 95);
    return () => clearTimeout(id);
  }, [line, onDone, BOOT.length]);

  return (
    <View style={s.boot}>
      {BOOT.slice(0, line).map((text, i) => (
        <Fade key={text}>
          <Txt
            variant="caption"
            weight={i === 0 ? 'bold' : 'regular'}
            tone={i === 0 ? color.accent : color.textDim}
            style={{ marginBottom: 3 }}>
            {text}
          </Txt>
        </Fade>
      ))}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Clock                                                                      */
/* -------------------------------------------------------------------------- */

/** Isolated so the ticking second does not re-render the whole launcher. */
function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <LeaderRow
      label="Local time"
      value={now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Tiles                                                                      */
/* -------------------------------------------------------------------------- */

function Module({
  code,
  name,
  tone,
  unit,
  headline,
  status,
  statusTone,
  onPress,
}: {
  code: string;
  name: string;
  tone: string;
  unit: 'bric' | 'vane';
  /** The subsystem's single most important number, in its own words. */
  headline: string;
  status: string;
  statusTone: string;
  onPress: () => void;
}) {
  return (
    <Tap scale={0.98} weight="medium" style={[s.module, { borderColor: `${tone}66` }]} onPress={onPress}>
      <Row style={{ justifyContent: 'space-between', marginBottom: space.sm }}>
        <Txt variant="micro" weight="bold" spaced tone={color.rust}>
          {code}
        </Txt>
        <Row style={{ gap: 5, alignItems: 'center' }}>
          <View style={[s.led, { backgroundColor: tone }]} />
          <Txt variant="micro" weight="bold" spaced tone={color.textFaint}>
            ONLINE
          </Txt>
        </Row>
      </Row>

      <Row style={{ gap: space.md, alignItems: 'center' }}>
        {unit === 'bric' ? <Bric mood="idle" size={44} /> : <Vane mood="idle" size={40} />}
        <View style={{ flex: 1 }}>
          <Txt variant="lead" weight="bold" spaced tone={tone}>
            {name.toUpperCase()}
          </Txt>
          <Txt variant="caption" dim style={{ marginTop: 2 }} numberOfLines={1}>
            {headline}
          </Txt>
        </View>
        <Txt variant="title" tone={`${tone}99`}>
          {glyph.arrow}
        </Txt>
      </Row>

      <View style={[s.statusStrip, { borderTopColor: color.border }]}>
        <View style={[s.dot, { backgroundColor: statusTone }]} />
        <Txt variant="micro" dim style={{ flex: 1, marginLeft: space.sm, lineHeight: 16 }} numberOfLines={2}>
          {status}
        </Txt>
      </View>
    </Tap>
  );
}

/* -------------------------------------------------------------------------- */
/* Screen                                                                     */
/* -------------------------------------------------------------------------- */

export default function Mainframe() {
  const router = useRouter();
  const data = useData();
  const docket = useDocket();

  const booted = useSession((s) => s.booted);
  const setBooted = useSession((s) => s.setBooted);

  const { briefing: bank } = useBriefing(data);
  const desk = vaneBriefing(docket);

  const open = openTasks(docket);
  const late = overdueTasks(docket);
  // Anything already overdue is reported as overdue rather than as the "next"
  // deadline — "next 2 days late" is not a sentence.
  const next = open
    .filter((t) => t.due !== undefined && (t.due as number) >= Date.now())
    .sort((a, b) => (a.due ?? 0) - (b.due ?? 0))[0];

  if (!booted) return <BootSequence linked={!!data.settings.aiKey} onDone={() => setBooted(true)} />;

  const deskHeadline =
    open.length === 0
      ? 'Nothing written down'
      : late.length > 0
        ? `${open.length} open · ${late.length} overdue`
        : next
          ? `${open.length} open · next ${dueLabel(next.due as number)}`
          : `${open.length} open · no deadlines`;

  return (
    <Screen>
      <Rise>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Txt variant="display" weight="bold" spaced tone={color.accent}>
              KEVLAR
            </Txt>
            <Txt variant="micro" spaced tone={color.rust} weight="bold" style={{ marginTop: 2 }}>
              MAINFRAME · TERMINAL 01
            </Txt>
          </View>
          <Row style={{ gap: space.md, alignItems: 'center', paddingTop: 6 }}>
            <SyncPip />
            <Tap scale={0.9} weight="light" hitSlop={12} onPress={() => router.push('/settings')}>
              <Txt variant="title" dim>
                ⚙
              </Txt>
            </Tap>
          </Row>
        </Row>
        <View style={s.rule} />
      </Rise>

      <Rise delay={50}>
        <View style={s.panel}>
          <LeaderRow label="Operator" value={data.settings.name || 'UNNAMED'} />
          <Clock />
          <LeaderRow label="Subsystems" value="2 ONLINE" tone={color.income} />
          <LeaderRow
            label="BRIC"
            value={data.settings.aiKey ? 'NEURAL LINK' : 'DORMANT'}
            tone={data.settings.aiKey ? color.accent : color.textFaint}
          />
          <LeaderRow label="Data" value="LOCAL · ENCRYPTED" />
        </View>
      </Rise>

      <Rise delay={110}>
        <SectionTitle>Subsystems</SectionTitle>
      </Rise>

      <Rise delay={150}>
        <Module
          code="BNK-001"
          name="Banking"
          tone={subsystem.bank}
          unit="bric"
          headline={formatIn(balance(data), data.settings.currency)}
          status={bank.items[0]?.text ?? 'Nothing to report.'}
          statusTone={TONE[bank.items[0]?.tone ?? 'good']}
          onPress={() => router.navigate('/bank')}
        />
      </Rise>

      <Rise delay={210}>
        <Module
          code="DKT-002"
          name="Docket"
          tone={subsystem.desk}
          unit="vane"
          headline={deskHeadline}
          status={desk.items[0]?.text ?? 'Docket is clear.'}
          statusTone={TONE[desk.items[0]?.tone ?? 'good']}
          onPress={() => router.navigate('/desk')}
        />
      </Rise>

      {/* Space is deliberately left for whatever he decides to build next. */}
      <Rise delay={270}>
        <View style={s.slot}>
          <Txt variant="micro" weight="bold" spaced tone={color.textFaint}>
            SLOT 003 · UNASSIGNED
          </Txt>
          <Txt variant="micro" faint style={{ marginTop: 4, textAlign: 'center' }}>
            Reserved for the next subsystem.
          </Txt>
        </View>
      </Rise>
    </Screen>
  );
}

const s = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: color.bg,
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  rule: { height: 2, backgroundColor: color.accent, marginTop: space.sm, marginBottom: space.sm },
  panel: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  module: {
    borderWidth: 1,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    padding: space.lg,
    marginBottom: space.md,
  },
  led: { width: 6, height: 6, borderRadius: 3 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    marginTop: space.md,
    paddingTop: space.sm,
  },
  slot: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.border,
    borderRadius: radius.md,
    paddingVertical: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

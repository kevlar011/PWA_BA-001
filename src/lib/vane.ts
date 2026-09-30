/**
 * VANE's voice and judgement.
 *
 * The docket's unit, and deliberately nothing like BRIC. BRIC is staff: he
 * defers, he softens, he calls him sir. VANE is a colleague reading over your
 * notes — brisk, forward-facing, mildly impatient, and entirely uninterested
 * in flattering anyone. She reports what is closing and what has gone cold,
 * then gets out of the way.
 *
 * Fragments are intentional. So is the refusal to congratulate him for work he
 * has not finished.
 *
 * Like BRIC, every line is chosen by a real condition in the data. There is no
 * model here and no network call — this is rules over a local board.
 */

import { DAY } from './date';
import { completedSince, dueWithin, isDone, openTasks, overdueTasks } from './store';
import type { BriefItem, Briefing, BriefTone } from './brief';
import type { Mood } from '@/components/ui/agency';
import type { DocketData, Task } from './types';

/** Rotates by day so lines vary without flickering mid-session. */
function pick<T>(options: T[], salt = 0): T {
  const day = Math.floor(Date.now() / DAY);
  return options[(day + salt) % options.length];
}

/** She uses his name flat, with no honorific. That is the whole difference. */
const addr = (name: string): string => name || 'you';

const plural = (n: number, one: string, many = `${one}s`): string =>
  `${n} ${n === 1 ? one : many}`;

/** Whole days until `ts`, rounded up, so "tomorrow" is never reported as 0. */
const daysUntil = (ts: number, at = Date.now()): number => Math.ceil((ts - at) / DAY);

/* -------------------------------------------------------------------------- */
/* Greetings                                                                  */
/* -------------------------------------------------------------------------- */

export function vaneGreeting(d: DocketData): string {
  const name = addr(d.settings.name);
  const open = openTasks(d);
  const late = overdueTasks(d);
  const soon = dueWithin(d, 72);
  const h = new Date().getHours();

  if (late.length > 0) {
    return pick([
      `${plural(late.length, 'deadline')} already passed. Not going to pretend otherwise.`,
      `You're late on ${plural(late.length, 'item')}. Salvage what's salvageable, drop the rest.`,
      `Overdue: ${late.length}. Deal with the top one, then we talk about the rest.`,
    ]);
  }

  if (soon.length > 0) {
    const next = soon[0];
    const days = daysUntil(next.due ?? 0);
    return pick([
      `Clock's running. "${next.title}" is due ${days <= 1 ? 'today' : `in ${plural(days, 'day')}`}.`,
      `Next thing up: "${next.title}". ${days <= 1 ? 'Today.' : `${days} days.`} Start it now, not tonight.`,
    ]);
  }

  if (open.length === 0) {
    return pick([
      `Docket's empty, ${name}. Either you're between things or you've stopped writing them down.`,
      `Nothing written down. That's either discipline or avoidance — you'd know which.`,
      `Clear docket. Good time to put something on it while you're thinking about it.`,
    ]);
  }

  if (h < 5) {
    return pick([
      `It's late. ${plural(open.length, 'item')} on the board, none of it more urgent than sleep.`,
      `Still up? The board will keep. It's very good at keeping.`,
    ]);
  }

  if (h < 12) {
    return pick([
      `Morning. ${plural(open.length, 'item')} on the board, nothing on fire.`,
      `Board's steady — ${open.length} open. Pick the hardest one while you're fresh.`,
      `Morning, ${name}. Nothing closing this week. Use it.`,
    ]);
  }

  if (h < 18) {
    return pick([
      `${plural(open.length, 'item')} open, no deadlines biting. Quiet stretch.`,
      `Afternoon. Board's under control. Ship something small.`,
    ]);
  }

  return pick([
    `Evening. ${plural(open.length, 'item')} still open. None of it urgent.`,
    `Board unchanged since this morning. Not a criticism, just the readout.`,
  ]);
}

/* -------------------------------------------------------------------------- */
/* Reactions                                                                  */
/* -------------------------------------------------------------------------- */

export function vaneOnAdd(title: string, hasDue: boolean): string {
  if (!hasDue) {
    return pick([
      `"${title}" written down. No date on it, so it'll sit there quietly. Fine by me.`,
      `Noted. Give it a deadline if it needs one.`,
      `Got it — "${title}". Undated things have a way of staying undated.`,
    ]);
  }
  return pick([
    `"${title}" is down with a clock on it. Better.`,
    `Noted and dated. I'll start counting.`,
    `Got it. Dated entries are the only ones I can actually chase you about.`,
  ]);
}

export function vaneOnDone(title: string, streak: number): string {
  if (streak >= 5) {
    return pick([
      `"${title}" cleared. That's ${streak} this week. You're on a run — don't narrate it, just keep going.`,
      `Done. ${streak} closed in seven days. This is what momentum looks like.`,
    ]);
  }
  return pick([
    `"${title}" cleared. Next.`,
    `Closed. Docket's lighter.`,
    `Done. I'd say well played, but you'd get complacent.`,
  ]);
}

export function vaneOnUndo(title: string): string {
  return pick([
    `"${title}" is back. No judgement.`,
    `Reopened. Happens.`,
    `Un-done. The clock resumes.`,
  ]);
}

/* -------------------------------------------------------------------------- */
/* Signals — the rules engine                                                 */
/* -------------------------------------------------------------------------- */

export type Severity = 'alarm' | 'warn' | 'info' | 'good';

export type Signal = {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  href?: string;
};

/**
 * Open, undated, untouched and old.
 *
 * Note that a *note* going untouched is not a problem — plenty of things are
 * written down purely to stop carrying them in your head. This only fires on
 * entries with a checklist started and abandoned, or nothing done at all,
 * which is the shape of an intention that quietly died.
 */
const STALE_DAYS = 21;
/** More than this many at once and nothing is actually getting finished. */
const WIP_LIMIT = 6;
/** Waiting on someone else for longer than this deserves a chase. */
const BLOCKED_DAYS = 7;

export function buildSignals(d: DocketData, at = Date.now()): Signal[] {
  const out: Signal[] = [];
  const open = openTasks(d);
  const late = overdueTasks(d, at);
  const week = dueWithin(d, 24 * 7, at);
  const threeDays = dueWithin(d, 72, at);

  /* --- Deadlines ------------------------------------------------------- */

  if (late.length > 0) {
    const worst = late[0];
    out.push({
      id: 'overdue',
      severity: 'alarm',
      title: `${plural(late.length, 'entry', 'entries')} past deadline`,
      detail: `"${worst.title}" was due ${plural(Math.abs(daysUntil(worst.due ?? at, at)), 'day')} ago. If it is genuinely gone, close it and stop carrying it. If it is not, it is the only thing that matters today.`,
      href: '/desk',
    });
  }

  if (threeDays.length > 0) {
    const next = threeDays[0];
    const days = daysUntil(next.due ?? at, at);
    out.push({
      id: 'closing',
      // Only today and tomorrow warrant the full alarm. Shouting about
      // everything three days out just teaches him to ignore me.
      severity: days <= 1 ? 'alarm' : 'warn',
      title: `"${next.title}" ${days <= 1 ? 'is due today' : `is due in ${plural(days, 'day')}`}`,
      detail:
        days <= 1
          ? `Nothing else here outranks it. If it has a specific hour attached, check which — days are not deadlines.`
          : `Enough time if you start now, not enough if you start the night before.`,
      href: '/desk',
    });
  } else if (week.length > 0) {
    out.push({
      id: 'this-week',
      severity: 'warn',
      title: `${plural(week.length, 'deadline')} inside seven days`,
      detail: `"${week[0].title}" is the nearest. A week is enough time if you start now and not enough if you start Thursday.`,
      href: '/desk',
    });
  }

  /* --- Drift ------------------------------------------------------------ */

  const stale = open.filter(
    (t) =>
      t.due === undefined &&
      at - t.createdAt > STALE_DAYS * DAY &&
      t.steps.filter((s) => s.done).length === 0
  );
  if (stale.length > 0) {
    out.push({
      id: 'stale',
      severity: 'warn',
      title: `${plural(stale.length, 'entry has', 'entries have')} gone cold`,
      detail: `Open for over ${STALE_DAYS} days with no step completed and no deadline — starting with "${stale[0].title}". Give each one a date or delete it. Carrying it costs you attention either way.`,
      href: '/desk',
    });
  }

  const active = open.filter((t) => t.status === 'active');
  if (active.length > WIP_LIMIT) {
    out.push({
      id: 'wip',
      severity: 'warn',
      title: `${active.length} things marked active`,
      detail: `That is not ${active.length} projects, it is one project being done ${active.length} times slower. Pick three, put the rest back to open.`,
      href: '/desk',
    });
  }

  const blocked = open.filter(
    (t) => t.status === 'blocked' && at - t.updatedAt > BLOCKED_DAYS * DAY
  );
  if (blocked.length > 0) {
    out.push({
      id: 'blocked',
      severity: 'warn',
      title: `${plural(blocked.length, 'entry', 'entries')} blocked over a week`,
      detail: `"${blocked[0].title}" has been waiting on someone else since before last week. Chase it or unblock it yourself — nobody else is tracking this.`,
      href: '/desk',
    });
  }

  /* --- Shape of the docket ---------------------------------------------- */

  if (open.length === 0) {
    out.push({
      id: 'empty',
      severity: 'info',
      title: 'Nothing written down',
      detail: `An empty docket is only good news if it is true. Anything you are holding in your head right now belongs here instead — it does not need a deadline to be worth writing down.`,
      href: '/desk',
    });
  } else if (open.every((t) => t.due === undefined)) {
    out.push({
      id: 'no-dates',
      severity: 'info',
      title: 'Nothing here has a date',
      detail: `${plural(open.length, 'open entry', 'open entries')}, not one with a deadline. That is fine for notes. For anything that actually has to happen, I cannot chase what has no clock.`,
      href: '/desk',
    });
  }

  /* --- Momentum --------------------------------------------------------- */

  const doneWeek = completedSince(d, at - 7 * DAY);
  if (doneWeek.length >= 3) {
    out.push({
      id: 'momentum',
      severity: 'good',
      title: `${plural(doneWeek.length, 'entry', 'entries')} cleared this week`,
      detail: `That is a real rate. The thing that kills it is starting something large before the current run ends — finish what is open first.`,
      href: '/desk',
    });
  } else if (late.length === 0 && open.length > 0 && week.length === 0) {
    out.push({
      id: 'steady',
      severity: 'good',
      title: 'Nothing overdue, nothing closing',
      detail: `Quiet weeks are when the work you actually care about gets done. Deadlines will not give you this window again for a while.`,
      href: '/desk',
    });
  }

  const rank: Record<Severity, number> = { alarm: 0, warn: 1, info: 2, good: 3 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/* -------------------------------------------------------------------------- */
/* Briefing                                                                   */
/* -------------------------------------------------------------------------- */

const TONE_MOOD: Record<BriefTone, Mood> = {
  urgent: 'alarm',
  warn: 'warn',
  info: 'think',
  good: 'happy',
};

const SEVERITY_TONE: Record<Severity, BriefTone> = {
  alarm: 'urgent',
  warn: 'warn',
  info: 'info',
  good: 'good',
};

/** What VANE leads with, ordered by what will actually bite first. */
export function vaneBriefing(d: DocketData, at = Date.now()): Briefing {
  const signals = buildSignals(d, at);

  const items: BriefItem[] = signals.slice(0, 4).map((sig) => ({
    id: sig.id,
    text: sig.title,
    tone: SEVERITY_TONE[sig.severity],
    href: sig.href,
  }));

  if (items.length === 0) {
    items.push({ id: 'clear', text: 'Docket is clear.', tone: 'good', href: '/desk' });
  }

  return {
    greeting: vaneGreeting(d),
    items,
    mood: TONE_MOOD[items[0].tone],
  };
}

export function vaneSignoff(): string {
  return pick([
    'All of this is computed here. Nothing left the device to produce it.',
    'No network, no lookups. Just your notes and a set of rules.',
    'I only know what you have written down. Write more down.',
  ]);
}

/** Longest run of consecutive days with at least one task closed, ending today. */
export function streak(d: DocketData, at = Date.now()): number {
  const days = new Set(
    d.tasks
      .filter((t) => isDone(t) && t.completedAt)
      .map((t) => Math.floor((t.completedAt as number) / DAY))
  );
  let cursor = Math.floor(at / DAY);
  // Today not being closed yet should not break a run built yesterday.
  if (!days.has(cursor)) cursor -= 1;

  let n = 0;
  while (days.has(cursor)) {
    n += 1;
    cursor -= 1;
  }
  return n;
}

/* -------------------------------------------------------------------------- */
/* Scope                                                                      */
/* -------------------------------------------------------------------------- */

/** How far ahead the scope and the deadline strip look. */
export const HORIZON_DAYS = 14;

export type BlipLevel = 'late' | 'soon' | 'later';

/** One dated entry as it appears on VANE's sonar. */
export type Blip = {
  id: string;
  level: BlipLevel;
  /** Degrees from straight up, −75 (left) to 75 (right). */
  angle: number;
  /** 0 at the emitter, 1 at the rim. Nearer means sooner. */
  distance: number;
};

/** Stable spread across the dome, so a blip does not jump between renders. */
const bearing = (id: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193);
  // Final mix, so ids differing only in their last character still scatter.
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return ((h >>> 0) % 150) - 75;
};

export const blipLevel = (due: number, at = Date.now()): BlipLevel =>
  due < at ? 'late' : due - at <= 3 * DAY ? 'soon' : 'later';

/**
 * The board, as sonar returns: every open entry due inside the horizon, placed
 * by how soon it lands. Overdue entries crowd the emitter, where they belong.
 */
export function scopeBlips(d: DocketData, at = Date.now()): Blip[] {
  const limit = at + HORIZON_DAYS * DAY;
  return openTasks(d)
    .filter((t) => t.due !== undefined && t.due <= limit)
    .sort((a, b) => (a.due ?? 0) - (b.due ?? 0))
    .slice(0, 16)
    .map((t) => {
      const due = t.due as number;
      const level = blipLevel(due, at);
      return {
        id: t.id,
        level,
        angle: bearing(t.id),
        distance: level === 'late' ? 0.14 : 0.24 + 0.72 * Math.min(1, (due - at) / (HORIZON_DAYS * DAY)),
      };
    });
}

export type StripDay = {
  /** Start of the day, or 0 for the overdue bucket. */
  day: number;
  tasks: Task[];
};

/** Overdue first, then each of the next fourteen days, for the deadline strip. */
export function deadlineStrip(d: DocketData, at = Date.now()): { late: Task[]; days: StripDay[] } {
  const today = new Date(at);
  today.setHours(0, 0, 0, 0);
  const start = today.getTime();

  const open = openTasks(d).filter((t) => t.due !== undefined);
  const days: StripDay[] = Array.from({ length: HORIZON_DAYS }, (_, i) => {
    const day = new Date(start);
    day.setDate(day.getDate() + i);
    const from = day.getTime();
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    return {
      day: from,
      tasks: open.filter((t) => (t.due as number) >= Math.max(from, at) && (t.due as number) < to.getTime()),
    };
  });
  // Something due earlier today but already past counts as late, not today.
  return { late: overdueTasks(d, at), days };
}

/** One line of machine state, the way a scanner labels its sweep. */
export function scanReadout(d: DocketData, at = Date.now()): { text: string; level: BlipLevel | 'clear' } {
  const open = openTasks(d);
  const late = overdueTasks(d, at);
  const soon = dueWithin(d, 72, at);
  if (late.length > 0) return { text: `CONTACT · ${late.length} OVERDUE`, level: 'late' };
  if (open.length === 0) return { text: 'SWEEP CLEAR · NOTHING ON THE BOARD', level: 'clear' };
  if (soon.length > 0) return { text: `SCANNING · ${open.length} OPEN · ${soon.length} CLOSING`, level: 'soon' };
  return { text: `SCANNING · ${open.length} OPEN`, level: 'later' };
}

/** Tasks closed in the last seven days, for VANE's reaction when one lands. */
export const weeklyRate = (d: DocketData, at = Date.now()): number =>
  completedSince(d, at - 7 * DAY).length;

export type { Task };

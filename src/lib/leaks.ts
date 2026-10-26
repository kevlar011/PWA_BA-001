/**
 * The leak scan.
 *
 * Money rarely disappears in one dramatic purchase. It goes in charges nobody
 * remembers agreeing to, and in categories that creep up a little each month
 * until the creep is the budget. Both are visible in the ledger long before
 * they are visible in the balance, so this looks for them there.
 *
 * Pure arithmetic over the user's own entries, like the rest of the advisor —
 * BRIC is handed the results, never asked to find them.
 */

import { DAY, startOfBudgetMonth } from './date';
import { spendByCategoryIn } from './store';
import type { KevlarData, RecurrenceUnit, Transaction } from './types';

export type Leak =
  | {
      kind: 'repeat';
      key: string;
      /** What to call it — the note if there is one, else the category. */
      name: string;
      categoryId?: string;
      /** Typical charge, cents. */
      amount: number;
      unit: RecurrenceUnit;
      /** What it costs across a year at that rhythm, cents. */
      yearly: number;
      count: number;
      lastDate: number;
    }
  | {
      kind: 'creep';
      key: string;
      name: string;
      categoryId: string;
      /** Last closed month, cents. */
      latest: number;
      /** Average of the three months before it, cents. */
      baseline: number;
      /** What the rise costs across a year if it holds, cents. */
      yearly: number;
    };

/** "Netflix 03/24", "NETFLIX.COM #8812" and "netflix" are the same thing. */
const normalise = (note: string): string =>
  note
    .toLowerCase()
    .replace(/[0-9#*./\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/** Gap in days → billing rhythm, or null if it is no rhythm a biller uses. */
function rhythm(gapDays: number): RecurrenceUnit | null {
  if (gapDays >= 5 && gapDays <= 9) return 'week';
  if (gapDays >= 25 && gapDays <= 35) return 'month';
  if (gapDays >= 350 && gapDays <= 380) return 'year';
  return null;
}

const PER_YEAR: Record<RecurrenceUnit, number> = { week: 52, month: 12, year: 1 };

/**
 * Charges that keep coming back at a biller's rhythm but are not on the
 * recurring list — the subscriptions nobody wrote down.
 */
function repeats(data: KevlarData, at: number): Leak[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of data.transactions) {
    if (t.kind !== 'expense') continue;
    // With no note, the same exact amount in the same category is the best
    // fingerprint a hand-kept ledger offers.
    const note = t.note ? normalise(t.note) : '';
    const key = note ? `n:${note}` : t.categoryId ? `c:${t.categoryId}:${t.amount}` : '';
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }

  const tracked = data.recurring.filter((r) => r.active).map((r) => normalise(r.name));
  const out: Leak[] = [];

  for (const [key, list] of groups) {
    if (list.length < 3) continue;
    const sorted = [...list].sort((a, b) => a.date - b.date);
    const gaps = sorted.slice(1).map((t, i) => (t.date - sorted[i].date) / DAY);
    const unit = rhythm(median(gaps));
    if (!unit) continue;

    // A subscription charges about the same each time; groceries do not.
    const amount = Math.round(median(sorted.map((t) => t.amount)));
    if (sorted.some((t) => Math.abs(t.amount - amount) > amount * 0.15)) continue;

    // Something that stopped two cycles ago is a past habit, not a leak.
    const last = sorted[sorted.length - 1].date;
    const cycle = unit === 'week' ? 7 : unit === 'month' ? 31 : 366;
    if (at - last > cycle * 2 * DAY) continue;

    const cat = data.categories.find((c) => c.id === sorted[0].categoryId);
    // Drop the reference numbers billers stamp on each charge ("#8812", "03/24").
    const note = sorted[sorted.length - 1].note?.replace(/\S*\d\S*/g, '').replace(/\s+/g, ' ').trim();
    const name = note || cat?.name || 'Unlabelled';
    const n = normalise(name);
    // Already on the recurring list: written down, so not a leak.
    if (tracked.some((r) => r && (r.includes(n) || n.includes(r)))) continue;

    out.push({
      kind: 'repeat',
      key,
      name,
      categoryId: sorted[0].categoryId,
      amount,
      unit,
      yearly: amount * PER_YEAR[unit],
      count: sorted.length,
      lastDate: last,
    });
  }
  return out;
}

/**
 * Categories whose last closed month ran well above the three before it.
 *
 * Needs four closed months to say anything; one bad month is a month, not a
 * trend, and the threshold is deliberately loose enough to ignore noise.
 */
function creep(data: KevlarData, at: number): Leak[] {
  const { monthStartDay } = data.settings;
  const months: Map<string, number>[] = [];
  let cursor = startOfBudgetMonth(at, monthStartDay) - 1;
  for (let i = 0; i < 4; i++) {
    months.push(spendByCategoryIn(data, cursor));
    cursor = startOfBudgetMonth(cursor, monthStartDay) - 1;
  }
  // The ledger has to reach back into the oldest of those months, or the
  // "baseline" is just the months before he started logging.
  const oldest = startOfBudgetMonth(cursor + 1, monthStartDay);
  if (!data.transactions.some((t) => t.date < oldest + 15 * DAY)) return [];

  const [latest, ...before] = months;
  const out: Leak[] = [];
  for (const [categoryId, now] of latest) {
    const baseline = before.reduce((n, m) => n + (m.get(categoryId) ?? 0), 0) / before.length;
    // Ignore pocket change: a category going from 4 to 8 is 100% and nothing.
    if (baseline <= 0 || now - baseline < 2000) continue;
    if (now < baseline * 1.25) continue;
    const cat = data.categories.find((c) => c.id === categoryId);
    out.push({
      kind: 'creep',
      key: `creep:${categoryId}`,
      name: cat?.name ?? 'Unlabelled',
      categoryId,
      latest: now,
      baseline: Math.round(baseline),
      yearly: Math.round((now - baseline) * 12),
    });
  }
  return out;
}

/** Everything the scan found, most expensive first. */
export function scanLeaks(data: KevlarData, at = Date.now()): Leak[] {
  return [...repeats(data, at), ...creep(data, at)].sort((a, b) => b.yearly - a.yearly);
}

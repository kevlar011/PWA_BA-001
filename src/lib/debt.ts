/**
 * Debt payoff planning.
 *
 * Debts live on the goals list as goals with a `debt` block: `target` is what
 * was owed when it was entered and `saved` is how much has been paid off.
 * That keeps them inside a list that already syncs, merges and backs up,
 * instead of adding another list to the document for one feature.
 *
 * The planner simulates month by month, in cents, for the two standard
 * orders, smallest balance first (snowball) and highest rate first
 * (avalanche), and reports which gets out sooner and cheaper. Arithmetic
 * only. It never suggests borrowing to pay borrowing.
 */

import type { Goal } from './types';

export type Strategy = 'snowball' | 'avalanche';

export type Plan = {
  strategy: Strategy;
  /** Months to clear everything, or null if the payments never catch up. */
  months: number | null;
  /** Interest paid along the way, cents. */
  interest: number;
  /** Names in the order they get cleared. */
  order: string[];
};

/** A month cap well past any sane plan; beyond it the answer is "never". */
const MAX_MONTHS = 600;

export const isDebt = (g: Goal): boolean => !!g.debt;
export const owed = (g: Goal): number => Math.max(0, g.target - g.saved);

/** Sum of every live minimum payment, cents a month. */
export const minimumsTotal = (debts: Goal[]): number =>
  debts.reduce((n, d) => n + (owed(d) > 0 ? (d.debt?.minPayment ?? 0) : 0), 0);

export function simulate(debts: Goal[], extra: number, strategy: Strategy): Plan {
  const live = debts
    .filter((d) => owed(d) > 0)
    .map((d) => ({
      name: d.name,
      balance: owed(d),
      rate: (d.debt?.aprBps ?? 0) / 10_000 / 12,
      min: d.debt?.minPayment ?? 0,
    }));

  const order: string[] = [];
  let interest = 0;
  // The monthly budget stays constant: a cleared debt's minimum rolls onto
  // the next target rather than quietly drifting back into spending.
  const budget = live.reduce((n, d) => n + d.min, 0) + Math.max(0, extra);
  if (budget <= 0) return { strategy, months: live.length ? null : 0, interest, order };

  for (let month = 1; month <= MAX_MONTHS; month++) {
    const open = live.filter((d) => d.balance > 0);
    if (open.length === 0) return { strategy, months: month - 1, interest, order };

    for (const d of open) {
      const charge = Math.round(d.balance * d.rate);
      d.balance += charge;
      interest += charge;
    }

    let pot = budget;
    for (const d of open) {
      const pay = Math.min(d.min, d.balance, pot);
      d.balance -= pay;
      pot -= pay;
    }

    const targets = open
      .filter((d) => d.balance > 0)
      .sort((a, b) =>
        strategy === 'snowball' ? a.balance - b.balance : b.rate - a.rate || a.balance - b.balance
      );
    for (const d of targets) {
      if (pot <= 0) break;
      const pay = Math.min(pot, d.balance);
      d.balance -= pay;
      pot -= pay;
    }

    for (const d of open) if (d.balance <= 0 && !order.includes(d.name)) order.push(d.name);
  }
  return { strategy, months: null, interest, order };
}

/** Both orders, best first: sooner wins, then cheaper. */
export function comparePlans(debts: Goal[], extra: number): [Plan, Plan] {
  const a = simulate(debts, extra, 'avalanche');
  const b = simulate(debts, extra, 'snowball');
  const score = (p: Plan) => (p.months === null ? Infinity : p.months * 1e12 + p.interest);
  return score(a) <= score(b) ? [a, b] : [b, a];
}

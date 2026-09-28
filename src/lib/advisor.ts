/**
 * The facts BRIC reasons from.
 *
 * This file used to hold BRIC's voice as well. It no longer does: BRIC is now a
 * model, and he writes his own sentences. What stays here is the arithmetic —
 * every conclusion is still computed on the device from the user's own ledger,
 * so the model is handed findings it can trust rather than asked to add up.
 *
 * Each finding carries a terse `readout`, the line a terminal would print. It
 * is what the screens show when the neural link is down, and what BRIC is
 * given to talk about when it is up.
 *
 * Hard rule, unchanged: nothing here or in BRIC's prompt names an investment.
 */

import { formatIn } from './currency';
import { DAY, dueLabel, endOfBudgetMonth, monthLabel, startOfBudgetMonth } from './date';
import { balance, dueSoon, monthTotals, spendByCategory } from './store';
import type { KevlarData } from './types';
import { SEVERITY_RANK, type Severity } from './brief';

export type { Severity } from './brief';

export type Finding = {
  id: string;
  severity: Severity;
  /** Rubber-stamp label, a couple of lowercase words. */
  tag: string;
  /** Terminal readout. Uppercase, terse, figures only — no personality. */
  readout: string;
  metric?: string;
  href: string;
};

const pct = (n: number): string => `${Math.round(n * 100)}%`;

/* -------------------------------------------------------------------------- */
/* Core metrics                                                               */
/* -------------------------------------------------------------------------- */

export type Metrics = {
  income: number;
  expense: number;
  net: number;
  savingsRate: number | null;
  dailyBurn: number;
  runwayDays: number | null;
  liquid: number;
  monthProgress: number;
  daysElapsed: number;
  daysLeft: number;
  projectedSpend: number;
  prevExpense: number | null;
  recurringMonthly: number;
  emergencyMonths: number | null;
};

export function computeMetrics(data: KevlarData, at = Date.now()): Metrics {
  const { monthStartDay } = data.settings;
  const start = startOfBudgetMonth(at, monthStartDay);
  const end = endOfBudgetMonth(at, monthStartDay);

  const { income, expense, net } = monthTotals(data, at);

  const daysElapsed = Math.max(1, Math.ceil((at - start) / DAY));
  const totalDays = Math.max(1, Math.round((end - start) / DAY));
  const daysLeft = Math.max(0, totalDays - daysElapsed);
  const monthProgress = Math.min(1, daysElapsed / totalDays);

  const dailyBurn = expense / daysElapsed;
  const projectedSpend = Math.round(dailyBurn * totalDays);

  const liquid = balance(data);
  const runwayDays = dailyBurn > 0 ? Math.floor(liquid / dailyBurn) : null;

  const prevAt = start - 1;
  const prevStart = startOfBudgetMonth(prevAt, monthStartDay);
  const hasPrev = data.transactions.some((t) => t.date >= prevStart && t.date <= prevAt);
  const prevExpense = hasPrev ? monthTotals(data, prevAt).expense : null;

  const recurringMonthly = data.recurring
    .filter((r) => r.active)
    .reduce((sum, r) => {
      const perYear =
        r.unit === 'week' ? 52 / r.every : r.unit === 'month' ? 12 / r.every : 1 / r.every;
      return sum + (r.amount * perYear) / 12;
    }, 0);

  const avgMonthlySpend = prevExpense ? (prevExpense + projectedSpend) / 2 : projectedSpend;
  const emergencyMonths = avgMonthlySpend > 0 ? liquid / avgMonthlySpend : null;

  return {
    income,
    expense,
    net,
    savingsRate: income > 0 ? net / income : null,
    dailyBurn,
    runwayDays,
    liquid,
    monthProgress,
    daysElapsed,
    daysLeft,
    projectedSpend,
    prevExpense,
    recurringMonthly,
    emergencyMonths,
  };
}

/* -------------------------------------------------------------------------- */
/* Zakat                                                                      */
/* -------------------------------------------------------------------------- */

import { computeZakat } from './zakat';

export { computeZakat, HAWL_DAYS, NISAB_GOLD_GRAMS, ZAKAT_RATE } from './zakat';
export type { ZakatState } from './zakat';

/* -------------------------------------------------------------------------- */
/* Findings                                                                   */
/* -------------------------------------------------------------------------- */

/** Start of the budget month that most recently closed. */
export function lastClosedMonth(data: KevlarData, at = Date.now()): number {
  const { monthStartDay } = data.settings;
  return startOfBudgetMonth(startOfBudgetMonth(at, monthStartDay) - 1, monthStartDay);
}

export function buildFindings(data: KevlarData, at = Date.now()): Finding[] {
  const m = computeMetrics(data, at);
  const out: Finding[] = [];
  const money = (c: number) => formatIn(c, data.settings.currency);
  const advisor = '/bank/advisor';

  if (data.transactions.length === 0) {
    return [
      {
        id: 'nodata',
        severity: 'info',
        tag: 'standby',
        readout: 'LEDGER EMPTY · NO ENTRIES ON FILE',
        href: '/bank',
      },
    ];
  }

  /* Overdrawn ------------------------------------------------------------- */
  if (m.liquid < 0) {
    out.push({
      id: 'overdrawn',
      severity: 'alarm',
      tag: data.settings.islamicMode ? 'riba risk' : 'overdrawn',
      readout: `BALANCE ${money(m.liquid)} · BELOW ZERO`,
      metric: money(Math.abs(m.liquid)),
      href: advisor,
    });
  }

  /* Payments landing ------------------------------------------------------ */
  const soon = dueSoon(data, 48);
  if (soon.length > 0) {
    const overdue = soon.filter((r) => r.nextDue <= at);
    const list = overdue.length > 0 ? overdue : soon;
    out.push({
      id: 'bills',
      severity: overdue.length > 0 ? 'alarm' : 'warn',
      tag: overdue.length > 0 ? 'overdue' : 'due soon',
      readout:
        list.length === 1
          ? `${list[0].name.toUpperCase()} ${money(list[0].amount)} · ${dueLabel(list[0].nextDue).toUpperCase()}`
          : `${list.length} PAYMENTS ${overdue.length > 0 ? 'OVERDUE' : 'DUE WITHIN 48H'}`,
      href: '/bank/goals',
    });
  }

  /* A month closed and has not been reviewed ------------------------------ */
  const closed = lastClosedMonth(data, at);
  if (
    data.transactions.some((t) => t.date >= closed) &&
    data.settings.lastStatementFor !== closed
  ) {
    out.push({
      id: 'statement',
      severity: 'info',
      tag: 'statement',
      readout: `${monthLabel(closed).toUpperCase()} CLOSED · STATEMENT READY`,
      href: '/statement',
    });
  }

  /* Savings rate ---------------------------------------------------------- */
  if (m.savingsRate !== null) {
    const r = m.savingsRate;
    if (r < 0) {
      out.push({
        id: 'rate-negative',
        severity: 'alarm',
        tag: 'deficit',
        readout: `OUT EXCEEDS IN BY ${money(Math.abs(m.net))} THIS MONTH`,
        metric: pct(r),
        href: advisor,
      });
    } else if (r < 0.1) {
      out.push({
        id: 'rate-thin',
        severity: 'warn',
        tag: 'thin margin',
        readout: `KEEPING ${pct(r)} OF INCOME · TARGET 10%`,
        metric: pct(r),
        href: advisor,
      });
    } else {
      out.push({
        id: r < 0.25 ? 'rate-ok' : 'rate-strong',
        severity: 'good',
        tag: r < 0.25 ? 'on track' : 'excellent',
        readout: `KEEPING ${pct(r)} OF INCOME`,
        metric: pct(r),
        href: advisor,
      });
    }
  }

  /* Pace ------------------------------------------------------------------ */
  const budgeted = data.budgets.reduce((n, b) => n + b.limit, 0);
  const spend = spendByCategory(data, at);
  if (budgeted > 0) {
    const spentBudgeted = data.budgets.reduce((n, b) => n + (spend.get(b.categoryId) ?? 0), 0);
    const consumed = spentBudgeted / budgeted;
    if (consumed > m.monthProgress + 0.15) {
      out.push({
        id: 'pace-hot',
        severity: 'warn',
        tag: 'ahead of pace',
        readout: `${pct(m.monthProgress)} THROUGH MONTH · ${pct(consumed)} OF BUDGET GONE`,
        metric: pct(consumed),
        href: '/bank/budgets',
      });
    } else if (consumed < m.monthProgress - 0.15) {
      out.push({
        id: 'pace-cool',
        severity: 'good',
        tag: 'under pace',
        readout: `${pct(m.monthProgress)} THROUGH MONTH · ONLY ${pct(consumed)} OF BUDGET USED`,
        metric: pct(consumed),
        href: '/bank/budgets',
      });
    }
  }

  /* Per-category overspend ------------------------------------------------ */
  for (const b of data.budgets) {
    const cat = data.categories.find((c) => c.id === b.categoryId);
    if (!cat) continue;
    const spent = spend.get(b.categoryId) ?? 0;
    if (spent > b.limit) {
      out.push({
        id: `over-${b.id}`,
        severity: 'warn',
        tag: 'over cap',
        readout: `${cat.name.toUpperCase()} OVER CAP · ${money(spent)} OF ${money(b.limit)}`,
        metric: money(spent - b.limit),
        href: '/bank/budgets',
      });
    }
  }

  /* Trend ----------------------------------------------------------------- */
  if (m.prevExpense && m.prevExpense > 0) {
    const change = (m.projectedSpend - m.prevExpense) / m.prevExpense;
    if (change > 0.2) {
      out.push({
        id: 'trend-up',
        severity: 'warn',
        tag: 'rising',
        readout: `TRACKING ${money(m.projectedSpend)} VS ${money(m.prevExpense)} LAST MONTH`,
        metric: `+${pct(change)}`,
        href: '/bank/budgets',
      });
    } else if (change < -0.15) {
      out.push({
        id: 'trend-down',
        severity: 'good',
        tag: 'improving',
        readout: `TRACKING ${money(m.projectedSpend)} VS ${money(m.prevExpense)} LAST MONTH`,
        metric: `-${pct(Math.abs(change))}`,
        href: '/bank/budgets',
      });
    }
  }

  /* Concentration --------------------------------------------------------- */
  const ranked = [...spend.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length > 0 && m.expense > 0) {
    const [topId, topAmount] = ranked[0];
    const cat = data.categories.find((c) => c.id === topId);
    const share = topAmount / m.expense;
    if (cat && share > 0.35) {
      out.push({
        id: 'concentrated',
        severity: 'info',
        tag: 'concentrated',
        readout: `${cat.name.toUpperCase()} = ${pct(share)} OF ALL SPENDING`,
        metric: pct(share),
        href: '/bank/budgets',
      });
    }
  }

  /* Recurring load -------------------------------------------------------- */
  if (m.recurringMonthly > 0 && m.income > 0) {
    const share = m.recurringMonthly / m.income;
    if (share > 0.3) {
      out.push({
        id: 'subs-heavy',
        severity: 'warn',
        tag: 'locked in',
        readout: `${money(Math.round(m.recurringMonthly))}/MO COMMITTED · ${pct(share)} OF INCOME`,
        metric: pct(share),
        href: '/bank/goals',
      });
    }
  }

  /* Buffer ---------------------------------------------------------------- */
  if (m.emergencyMonths !== null) {
    const months = `${m.emergencyMonths.toFixed(1)}m`;
    if (m.emergencyMonths < 1) {
      out.push({
        id: 'buffer-none',
        severity: 'alarm',
        tag: 'exposed',
        readout: `${m.emergencyMonths.toFixed(1)} MONTHS OF COVER · TARGET 3`,
        metric: months,
        href: advisor,
      });
    } else if (m.emergencyMonths < 3) {
      out.push({
        id: 'buffer-thin',
        severity: 'warn',
        tag: 'building',
        readout: `${m.emergencyMonths.toFixed(1)} MONTHS OF COVER · TARGET 3`,
        metric: months,
        href: advisor,
      });
    } else {
      out.push({
        id: 'buffer-ok',
        severity: 'good',
        tag: 'covered',
        readout: `${m.emergencyMonths.toFixed(1)} MONTHS OF COVER`,
        metric: months,
        href: advisor,
      });
    }
  }

  /* Runway ---------------------------------------------------------------- */
  if (m.runwayDays !== null && m.runwayDays < 45 && m.dailyBurn > 0) {
    out.push({
      id: 'runway',
      severity: m.runwayDays < 20 ? 'alarm' : 'warn',
      tag: 'runway',
      readout: `${m.runwayDays} DAYS OF RUNWAY AT ${money(Math.round(m.dailyBurn))}/DAY`,
      metric: `${m.runwayDays}d`,
      href: advisor,
    });
  }

  if (data.settings.islamicMode) out.push(...islamicFindings(data, money));

  return out.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

function islamicFindings(data: KevlarData, money: (c: number) => string): Finding[] {
  const out: Finding[] = [];
  const advisor = '/bank/advisor';

  const interestish = data.transactions.filter(
    (t) => t.kind === 'income' && /interest|riba|apy|savings bonus/i.test(t.note ?? '')
  );
  if (interestish.length > 0) {
    out.push({
      id: 'riba-income',
      severity: 'warn',
      tag: 'review',
      readout: `${interestish.length} INCOME ${interestish.length === 1 ? 'ENTRY MENTIONS' : 'ENTRIES MENTION'} INTEREST`,
      href: advisor,
    });
  }

  const z = computeZakat(data);
  if (z.needsGoldPrice) {
    out.push({
      id: 'zakat-setup',
      severity: 'info',
      tag: 'zakat',
      readout: 'NISAB UNKNOWN · SET GOLD PRICE IN SETTINGS',
      href: '/settings',
    });
  } else if (z.payable && z.due) {
    out.push({
      id: 'zakat-payable',
      severity: 'alarm',
      tag: 'zakat due',
      readout: `HAWL COMPLETE · ZAKAT ${money(z.due)} DUE`,
      metric: money(z.due),
      href: advisor,
    });
  } else if (z.aboveNisab && z.daysRemaining !== null) {
    out.push({
      id: 'zakat-counting',
      severity: 'info',
      tag: 'hawl running',
      readout: `ABOVE NISAB · ZAKAT ~${money(z.due ?? 0)} IN ${z.daysRemaining} DAYS`,
      metric: `${z.daysRemaining}d`,
      href: advisor,
    });
  } else if (z.aboveNisab) {
    out.push({
      id: 'zakat-started',
      severity: 'info',
      tag: 'zakat',
      readout: `ABOVE NISAB ${money(z.nisab!)} · HAWL STARTS TODAY`,
      href: advisor,
    });
  } else {
    out.push({
      id: 'zakat-below',
      severity: 'good',
      tag: 'zakat',
      readout: `BELOW NISAB ${money(z.nisab!)} · NOTHING DUE`,
      href: advisor,
    });
  }

  return out;
}

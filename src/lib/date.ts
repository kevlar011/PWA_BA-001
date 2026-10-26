/** Date helpers. All timestamps are epoch ms in local time. */

export const DAY = 86_400_000;

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Start of the budget month containing `ts`.
 * `monthStartDay` lets the budget cycle track payday instead of the 1st.
 */
export function startOfBudgetMonth(ts: number, monthStartDay = 1): number {
  const d = new Date(ts);
  if (d.getDate() < monthStartDay) d.setMonth(d.getMonth() - 1);
  d.setDate(monthStartDay);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfBudgetMonth(ts: number, monthStartDay = 1): number {
  const start = new Date(startOfBudgetMonth(ts, monthStartDay));
  start.setMonth(start.getMonth() + 1);
  return start.getTime() - 1;
}

export function addMonths(ts: number, n: number): number {
  const d = new Date(ts);
  d.setMonth(d.getMonth() + n);
  return d.getTime();
}

export function advance(ts: number, every: number, unit: 'week' | 'month' | 'year'): number {
  const d = new Date(ts);
  if (unit === 'week') d.setDate(d.getDate() + 7 * every);
  else if (unit === 'month') d.setMonth(d.getMonth() + every);
  else d.setFullYear(d.getFullYear() + every);
  return d.getTime();
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const monthLabel = (ts: number): string => {
  const d = new Date(ts);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

/** `Today` / `Yesterday` / `Mon 4 Aug`, used as transaction list section headers. */
export function dayLabel(ts: number): string {
  const today = startOfDay(Date.now());
  const day = startOfDay(ts);
  if (day === today) return 'Today';
  if (day === today - DAY) return 'Yesterday';
  const d = new Date(ts);
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  const suffix = day > today - 300 * DAY ? '' : ` ${d.getFullYear()}`;
  return `${wd} ${d.getDate()} ${MONTHS[d.getMonth()]}${suffix}`;
}

export const shortDate = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

/** Human countdown for bills: `in 3 days`, `today`, `2 days late`. */
export function dueLabel(ts: number): string {
  const days = Math.round((startOfDay(ts) - startOfDay(Date.now())) / DAY);
  if (days === 0) return 'due today';
  if (days === 1) return 'due tomorrow';
  if (days > 1) return `in ${days} days`;
  if (days === -1) return '1 day late';
  return `${Math.abs(days)} days late`;
}

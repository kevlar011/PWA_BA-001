/**
 * What BRIC may do to the ledger from the direct channel.
 *
 * He does not get the store. He ends a reply with `ACTION {json}` lines, and
 * the device decides whether each one is sane, carries it out with the same
 * store actions the screens use, and pins a receipt with an UNDO to his
 * message. A model that misreads "twelve" as "1200" should cost one tap, not
 * a reconciliation.
 *
 * Three verbs, matching what a person would ask a butler to do with a ledger:
 * write an entry down, put a recurring charge on the bills list, and record a
 * payment against a debt. Nothing here deletes or edits existing entries.
 */

import { advance } from './date';
import { isDebt, owed } from './debt';
import { formatIn } from './currency';
import { scanLeaks } from './leaks';
import { useStore } from './store';
import type { KevlarData, TxKind } from './types';
import { swatch } from '@/theme/tokens';

/** A carried-out action, kept on the chat message. Plain data, so it persists. */
export type ChatAction = {
  /** Uppercase receipt, e.g. `LOGGED $12.00 OUT · FOOD`. */
  label: string;
  undo: { tx?: string[]; recurring?: string; goal?: { id: string; cents: number } };
  undone?: boolean;
};

/** Upper bound on any single amount BRIC can write: one million, in cents. */
const MAX_CENTS = 100_000_000;
/** A reply that wants to do more than this has misunderstood something. */
const MAX_ACTIONS = 5;

export const ACTION_RULES = `

You can act on the ledger. Only when the user clearly asks you to record something, end your reply with one line per action, each exactly:
ACTION {"type":"log","kind":"expense"|"income","amount":12.5,"category":"<one of categoriesForLogging>","note":"<short>","date":"YYYY-MM-DD"}
ACTION {"type":"track","name":"<a leak name from leaks>"}
ACTION {"type":"pay_debt","debt":"<a debt name from debts>","amount":50}
Rules: amounts are plain numbers in the ledger's currency and major units (12.5, not "12.50" or 1250). "date" and "note" are optional; omit date for today. Use only category, leak and debt names that appear in the ledger; leave category out if none fits. Never invent an amount the user did not give. You cannot delete or edit entries; for that, tell them where in KEVLAR to do it. Say your reply first, as if it's already done. The device carries out the actions and shows a receipt with UNDO. Never mention the ACTION lines.`;

/**
 * Splits a reply into what BRIC said and what he asked for.
 *
 * Also used mid-stream, so a half-written ACTION line never flashes on
 * screen: everything from the first `ACTION {` on is withheld.
 */
export function splitActions(text: string): { speech: string; actions: unknown[] } {
  const at = text.search(/(^|\n)\s*ACTION\s*\{/);
  if (at < 0) return { speech: text, actions: [] };
  const actions: unknown[] = [];
  for (const line of text.slice(at).split('\n')) {
    const m = line.match(/^\s*ACTION\s*(\{.*\})\s*$/);
    if (!m) continue;
    try {
      actions.push(JSON.parse(m[1]));
    } catch {
      // A malformed line is dropped rather than guessed at.
    }
  }
  return { speech: text.slice(0, at).trim(), actions: actions.slice(0, MAX_ACTIONS) };
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** A plain positive number of major units → cents, or null if it is anything else. */
function cents(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  const c = Math.round(v * 100);
  return c > 0 && c <= MAX_CENTS ? c : null;
}

/** `YYYY-MM-DD` → local noon that day. Rejects anything in the future. */
function day(v: unknown): number | null {
  if (v === undefined) return Date.now();
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [y, m, d] = v.split('-').map(Number);
  const ts = new Date(y, m - 1, d, 12).getTime();
  return Number.isFinite(ts) && ts <= Date.now() + 86_400_000 ? Math.min(ts, Date.now()) : null;
}

/** Carries out one requested action, or explains in a receipt why not. */
export function runAction(raw: unknown, data: KevlarData): ChatAction {
  const store = useStore.getState();
  const money = (c: number) => formatIn(c, data.settings.currency);
  const refuse = (why: string): ChatAction => ({ label: `NOT DONE · ${why}`, undo: {} });
  const a = (raw ?? {}) as Record<string, unknown>;

  if (a.type === 'log') {
    const kind: TxKind | null = a.kind === 'income' ? 'income' : a.kind === 'expense' ? 'expense' : null;
    const amount = cents(a.amount);
    const date = day(a.date);
    if (!kind || !amount || date === null) return refuse('ENTRY UNCLEAR');
    const cat =
      typeof a.category === 'string'
        ? data.categories.find((c) => !c.archived && c.kind === kind && same(c.name, a.category as string))
        : undefined;
    const note = typeof a.note === 'string' ? a.note.trim().slice(0, 120) || undefined : undefined;
    const id = store.addTransaction({ kind, amount, categoryId: cat?.id, note, date });
    return {
      label: `LOGGED ${money(amount)} ${kind === 'income' ? 'IN' : 'OUT'}${cat ? ` · ${cat.name.toUpperCase()}` : ''}`,
      undo: { tx: [id] },
    };
  }

  if (a.type === 'track') {
    const leak = scanLeaks(data).find(
      (l) => l.kind === 'repeat' && typeof a.name === 'string' && same(l.name, a.name)
    );
    if (!leak || leak.kind !== 'repeat') return refuse('NO SUCH LEAK');
    const id = store.addRecurring({
      name: leak.name,
      amount: leak.amount,
      categoryId: leak.categoryId,
      every: 1,
      unit: leak.unit,
      nextDue: advance(leak.lastDate, 1, leak.unit),
      color: swatch[data.recurring.length % swatch.length],
    });
    return { label: `${leak.name.toUpperCase()} ADDED TO BILLS`, undo: { recurring: id } };
  }

  if (a.type === 'pay_debt') {
    const debt = data.goals.find(
      (g) => isDebt(g) && owed(g) > 0 && typeof a.debt === 'string' && same(g.name, a.debt)
    );
    const asked = cents(a.amount);
    if (!debt || !asked) return refuse('NO SUCH DEBT OR AMOUNT');
    const amount = Math.min(asked, owed(debt));
    store.contributeToGoal(debt.id, amount);
    const tx = store.addTransaction({
      kind: 'expense',
      amount,
      note: `Debt payment · ${debt.name}`,
      date: Date.now(),
    });
    return {
      label: `PAID ${money(amount)} · ${debt.name.toUpperCase()}${amount >= owed(debt) ? ' · CLEARED' : ''}`,
      undo: { tx: [tx], goal: { id: debt.id, cents: amount } },
    };
  }

  return refuse('UNKNOWN REQUEST');
}

/** Reverses a receipt. Deletes are tombstones, like everywhere else. */
export function undoAction(action: ChatAction): void {
  const store = useStore.getState();
  for (const id of action.undo.tx ?? []) store.removeTransaction(id);
  if (action.undo.recurring) store.removeRecurring(action.undo.recurring);
  if (action.undo.goal) store.contributeToGoal(action.undo.goal.id, -action.undo.goal.cents);
}

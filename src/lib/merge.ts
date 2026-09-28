/**
 * Three-way-ish merge for two copies of the ledger.
 *
 * Both devices edit freely offline, so this has to reconcile without a server
 * arbitrating. The rules are deliberately boring:
 *
 *   · records are unioned by id, never matched by content
 *   · when both sides have a record, the newer `updatedAt` wins outright
 *   · a tombstone is just another record, so deletions propagate like edits
 *
 * Boring is the point. Anything cleverer would occasionally resurrect a
 * deleted entry or silently drop one, and this is a ledger.
 */

import type {
  Budget,
  Category,
  Goal,
  KevlarData,
  Recurring,
  Settings,
  Task,
  Transaction,
} from './types';

type WithId = { id: string; updatedAt: number; deletedAt?: number };

function mergeList<T extends WithId>(local: T[], remote: T[]): T[] {
  const byId = new Map<string, T>();

  for (const rec of local) byId.set(rec.id, rec);

  for (const rec of remote) {
    const mine = byId.get(rec.id);
    if (!mine) {
      byId.set(rec.id, rec);
      continue;
    }
    // Ties go to the remote copy: arbitrary, but it has to be deterministic
    // or the two devices would flip-flop forever.
    if ((rec.updatedAt ?? 0) >= (mine.updatedAt ?? 0)) byId.set(rec.id, rec);
  }

  return [...byId.values()];
}

/** Never travels: how *this* device reaches the server is its own business. */
const DEVICE_ONLY = [
  'syncUrl',
  'syncKey',
  'passphrase',
  'passphraseCheck',
  'syncedAt',
  'aiKey',
] as const;

/** Treats blank strings and undefined as "never actually set". */
function isBlank(v: unknown): boolean {
  return v === undefined || v === null || v === '';
}

/**
 * Reconciles settings key by key.
 *
 * The ordering deliberately does NOT fall back to a whole-object timestamp.
 * A freshly installed device stamps itself "now" during onboarding, so any
 * coarse comparison hands it the win and its empty name overwrites a real
 * ledger. Only an explicit per-field stamp counts as intent.
 */
function mergeSettings(local: Settings, remote: Settings): Settings {
  const lt = local.fieldTimes ?? {};
  const rt = remote.fieldTimes ?? {};

  const keys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  const out = { ...local } as Record<string, unknown>;

  for (const key of keys) {
    if ((DEVICE_ONLY as readonly string[]).includes(key)) continue;
    if (key === 'fieldTimes' || key === 'settingsUpdatedAt') continue;

    const lVal = (local as Record<string, unknown>)[key];
    const rVal = (remote as Record<string, unknown>)[key];
    const lTime = lt[key];
    const rTime = rt[key];

    // Both sides set it deliberately: newest wins, ties to remote so the two
    // devices converge on the same answer rather than ping-ponging.
    if (lTime !== undefined && rTime !== undefined) {
      if (rTime >= lTime) out[key] = rVal;
      continue;
    }

    // Only one side ever set it on purpose. That side wins outright.
    if (rTime !== undefined && lTime === undefined) {
      out[key] = rVal;
      continue;
    }
    if (lTime !== undefined && rTime === undefined) continue;

    // Neither was set explicitly — prefer whichever actually holds a value.
    if (isBlank(lVal) && !isBlank(rVal)) out[key] = rVal;
  }

  for (const key of DEVICE_ONLY) {
    out[key] = (local as Record<string, unknown>)[key];
  }

  const times: Record<string, number> = { ...rt, ...lt };
  for (const key of keys) {
    const t = Math.max(lt[key] ?? 0, rt[key] ?? 0);
    if (t) times[key] = t;
  }
  out.fieldTimes = times;
  out.settingsUpdatedAt = Math.max(local.settingsUpdatedAt ?? 0, remote.settingsUpdatedAt ?? 0);

  return out as Settings;
}

export function mergeData(local: KevlarData, remote: KevlarData): KevlarData {
  return {
    version: Math.max(local.version ?? 1, remote.version ?? 1),
    categories: mergeList<Category>(local.categories, remote.categories),
    transactions: mergeList<Transaction>(local.transactions, remote.transactions),
    budgets: mergeList<Budget>(local.budgets, remote.budgets),
    goals: mergeList<Goal>(local.goals, remote.goals),
    recurring: mergeList<Recurring>(local.recurring, remote.recurring),
    // A device still running a pre-docket build sends no `tasks` key at all,
    // which must read as "nothing to contribute" rather than "delete his notes".
    tasks: mergeList<Task>(local.tasks ?? [], remote.tasks ?? []),
    settings: mergeSettings(local.settings, remote.settings),
  };
}

/** Live records only — tombstones are an implementation detail of sync. */
export const alive = <T extends { deletedAt?: number }>(list: T[]): T[] =>
  list.filter((r) => !r.deletedAt);

/**
 * Drops tombstones that everyone has certainly seen by now.
 *
 * Without this the ledger grows forever. A year is far longer than any
 * realistic gap between two devices syncing.
 */
export function pruneTombstones(data: KevlarData, olderThanMs = 365 * 86_400_000): KevlarData {
  const cutoff = Date.now() - olderThanMs;
  const keep = <T extends { deletedAt?: number }>(list: T[]) =>
    list.filter((r) => !r.deletedAt || r.deletedAt > cutoff);

  return {
    ...data,
    categories: keep(data.categories),
    transactions: keep(data.transactions),
    budgets: keep(data.budgets),
    goals: keep(data.goals),
    recurring: keep(data.recurring),
    tasks: keep(data.tasks ?? []),
  };
}

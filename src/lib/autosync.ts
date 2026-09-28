/**
 * Automatic reconciliation.
 *
 * KEVLAR has no background process, so sync happens at the only three moments
 * it can: when the app opens, when it comes back to the foreground, and a few
 * seconds after you stop making changes.
 *
 * The awkward part is not the triggering — it is making sure a sync, which
 * writes to the store, does not immediately look like a change worth syncing.
 * `inFlight` guards that.
 */

import { fingerprint } from './crypto';
import { useSession } from './session';
import { useStore } from './store';
import { syncNow } from './sync';
import type { KevlarData } from './types';

/** Module-level rather than React state: this must be shared by every caller. */
let inFlight = false;
let debounce: ReturnType<typeof setTimeout> | null = null;
let lastRunAt = 0;

/** Don't hammer the server when the app is being opened and closed rapidly. */
const MIN_GAP_MS = 20_000;
/** How long to wait after the last edit before pushing. */
const SETTLE_MS = 6_000;

export type SyncReason = 'open' | 'foreground' | 'changes' | 'manual';

function snapshot(): KevlarData {
  const s = useStore.getState();
  return {
    version: s.version,
    categories: s.categories,
    transactions: s.transactions,
    budgets: s.budgets,
    goals: s.goals,
    recurring: s.recurring,
    tasks: s.tasks,
    settings: s.settings,
  };
}

/**
 * Runs one reconciliation. Safe to call from anywhere; concurrent calls and
 * calls that arrive too soon after the last one are dropped.
 */
export async function runSync(
  reason: SyncReason = 'manual'
): Promise<{ ok: boolean; error?: string }> {
  const { settings } = useStore.getState();
  const { syncUrl, syncKey, passphrase } = settings;

  if (!syncUrl || !syncKey || !passphrase) return { ok: false, error: 'Sync is not set up.' };
  if (inFlight) return { ok: false, error: 'Already syncing.' };
  // Polling and foreground events can arrive together; the throttle keeps
  // that from turning into a burst of requests.
  if (reason !== 'manual' && Date.now() - lastRunAt < MIN_GAP_MS) {
    return { ok: false, error: 'Too soon.' };
  }

  inFlight = true;
  lastRunAt = Date.now();
  const session = useSession.getState();
  session.setSyncing(true);

  try {
    const result = await syncNow(snapshot(), passphrase, { url: syncUrl, key: syncKey });

    if (!result.ok) {
      session.setLastSyncError(result.error);
      // Only interrupt for a manual run. A failed background sync while you
      // are on a train is not worth a popup.
      if (reason === 'manual') session.say(result.error, { mood: 'warn' });
      return { ok: false, error: result.error };
    }

    const local = useStore.getState().settings;
    useStore.getState().replaceAll({
      ...result.merged,
      settings: {
        ...result.merged.settings,
        // Connection details and the passphrase belong to this device.
        syncUrl: local.syncUrl,
        syncKey: local.syncKey,
        passphrase: local.passphrase,
        passphraseCheck: await fingerprint(passphrase),
        syncedAt: Date.now(),
      },
    });

    session.setLastSyncError(null);
    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    session.setLastSyncError(error);
    return { ok: false, error };
  } finally {
    inFlight = false;
    useSession.getState().setSyncing(false);
  }
}

/**
 * Polls while the app is on screen.
 *
 * Foreground and open events cover switching between devices, but not the
 * case where both are open at once — the PC sitting there while something is
 * logged on the phone. A slow poll makes that feel continuous without
 * hammering the server.
 */
export function startPolling(everyMs = 45_000): () => void {
  const tick = () => {
    if (typeof document !== 'undefined' && document.hidden) return;
    void runSync('changes');
  };
  const id = setInterval(tick, everyMs);
  return () => clearInterval(id);
}

/** Cheap fingerprint of the data, used to notice real edits. */
function signature(): string {
  const s = useStore.getState();
  const newest = (arr: { updatedAt?: number }[]) =>
    arr.reduce((m, r) => Math.max(m, r.updatedAt ?? 0), 0);
  return [
    s.transactions.length,
    s.budgets.length,
    s.goals.length,
    s.recurring.length,
    s.categories.length,
    s.tasks.length,
    newest(s.transactions),
    newest(s.budgets),
    newest(s.goals),
    newest(s.recurring),
    newest(s.tasks),
    newest(s.categories),
    s.settings.settingsUpdatedAt ?? 0,
  ].join(':');
}

/**
 * Watches the store and schedules a sync once edits stop landing.
 * Returns an unsubscribe.
 */
export function watchForChanges(): () => void {
  let last = signature();

  return useStore.subscribe(() => {
    const next = signature();

    // Writes made *by* a sync still move the baseline forward, otherwise the
    // next genuine edit would be compared against a pre-merge signature and
    // trigger a redundant round trip.
    if (inFlight) {
      last = next;
      return;
    }

    if (next === last) return;
    last = next;

    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => {
      void runSync('changes');
    }, SETTLE_MS);
  });
}

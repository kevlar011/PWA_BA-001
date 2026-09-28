import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { runSync, startPolling, watchForChanges } from '@/lib/autosync';
import { bricSay } from '@/lib/bric';
import { useSession } from '@/lib/session';
import { dueSoon, useStore } from '@/lib/store';
import { reconcileHawl } from '@/lib/zakat';

/**
 * Everything KEVLAR does on its own, once per launch.
 *
 * There is no server and no background process, so this is the only moment
 * housekeeping can happen: standing payments post themselves, the zakat clock
 * advances, and the icon badge is brought up to date.
 */
export function AppTick() {
  const hydrated = useStore((s) => s.hydrated);
  const postDueRecurring = useStore((s) => s.postDueRecurring);
  const updateSettings = useStore((s) => s.updateSettings);
  const recurring = useStore((s) => s.recurring);
  const say = useSession((s) => s.say);
  const setUpdateReady = useSession((s) => s.setUpdateReady);

  const ranOnce = useRef(false);

  /* Housekeeping, once per launch. */
  useEffect(() => {
    if (!hydrated || ranOnce.current) return;
    ranOnce.current = true;

    const state = useStore.getState();

    // Names have to be captured before posting, because posting moves nextDue.
    const overdue = state.recurring.filter((r) => r.active && r.nextDue <= Date.now());
    const posted = postDueRecurring();
    if (posted > 0) {
      const names = overdue.map((r) => r.name);
      bricSay(
        `AUTO-POSTED · ${names.length === 1 ? names[0].toUpperCase() : `${names.length} STANDING PAYMENTS`}`,
        { type: 'bills', names },
        { mood: 'idle' }
      );
    }

    const patch = reconcileHawl(useStore.getState());
    if (patch) updateSettings(patch);
  }, [hydrated, postDueRecurring, updateSettings, say]);

  /* Icon badge: how many payments are due or overdue. iOS 16.4+ honours this
     for installed web apps, and it is the closest thing to a notification
     available without a push server. */
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined') return;
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (!nav.setAppBadge) return;

    const count = dueSoon(useStore.getState(), 24).length;
    if (count > 0) void nav.setAppBadge(count).catch(() => {});
    else void nav.clearAppBadge?.().catch(() => {});
  }, [recurring, hydrated]);

  /* Sync on open, on return to the foreground, and after edits settle. */
  useEffect(() => {
    if (!hydrated) return;

    void runSync('open');
    const unwatch = watchForChanges();
    const stopPolling = startPolling();

    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return () => {
        unwatch();
        stopPolling();
      };
    }

    const onVisible = () => {
      if (!document.hidden) void runSync('foreground');
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      unwatch();
      stopPolling();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [hydrated]);

  /* A newer build finished caching in the background. */
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    let cancelled = false;

    navigator.serviceWorker.ready
      .then((reg) => {
        if (cancelled) return;
        if (reg.waiting) setUpdateReady(true);

        reg.addEventListener('updatefound', () => {
          const next = reg.installing;
          if (!next) return;
          next.addEventListener('statechange', () => {
            // `controller` being present means this is a replacement rather
            // than the very first install.
            if (next.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateReady(true);
            }
          });
        });

        void reg.update().catch(() => {});
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [setUpdateReady]);

  return null;
}

import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Pulse } from '@/components/ui/motion';
import { Tap } from '@/components/ui/press';
import { Row, Txt } from '@/components/ui/primitives';
import { useSession } from '@/lib/session';
import { useStore } from '@/lib/store';
import { color, space } from '@/theme/tokens';

/** `14:32`, enough to know it is current without cluttering the header. */
function clock(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString();
}

/**
 * Sync state, visible at a glance.
 *
 * Background failures are deliberately quiet so a dropped connection does not
 * interrupt you, but silence is indistinguishable from "it never ran", which
 * is exactly the confusion this exists to remove.
 */
export function SyncPip() {
  const router = useRouter();
  const syncUrl = useStore((s) => s.settings.syncUrl);
  const syncedAt = useStore((s) => s.settings.syncedAt);
  const syncing = useSession((s) => s.syncing);
  const error = useSession((s) => s.lastSyncError);

  if (!syncUrl) return null;

  const state = syncing ? 'busy' : error ? 'error' : 'ok';
  const tone =
    state === 'busy' ? color.transfer : state === 'error' ? color.expense : color.textFaint;
  const label =
    state === 'busy'
      ? 'SYNCING'
      : state === 'error'
        ? 'SYNC FAILED'
        : syncedAt
          ? clock(syncedAt)
          : 'NOT SYNCED';

  const dot = <View style={[s.dot, { backgroundColor: tone }]} />;

  return (
    <Tap
      scale={0.97}
      weight="light"
      style={s.wrap}
      onPress={() => router.push('/sync')}>
      <Row style={{ gap: 5, alignItems: 'center' }}>
        {state === 'busy' ? <Pulse min={0.25} ms={620}>{dot}</Pulse> : dot}
        <Txt variant="micro" weight="bold" tone={tone}>
          {label}
        </Txt>
      </Row>
    </Tap>
  );
}

const s = StyleSheet.create({
  wrap: { paddingVertical: 2, paddingHorizontal: space.xs },
  dot: { width: 6, height: 6, borderRadius: 3 },
});

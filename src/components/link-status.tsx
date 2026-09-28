import { StyleSheet, View } from 'react-native';

import { Pulse } from '@/components/ui/motion';
import { Row, Txt } from '@/components/ui/primitives';
import { useBric } from '@/lib/bric-store';
import { useStore } from '@/lib/store';
import { color } from '@/theme/tokens';

/**
 * One line of machine state for BRIC's link, the way a HUD labels a system:
 * `LINK ▸ FLASH · 412MS`. Honest about faults rather than quietly stale.
 */
export function LinkStatus({ align = 'left' }: { align?: 'left' | 'center' }) {
  const linked = useStore((s) => !!s.settings.aiKey);
  const model = useStore((s) => s.settings.aiModel);
  const link = useBric((s) => s.link);
  const latency = useBric((s) => s.latency);
  const error = useBric((s) => s.lastError);

  const modelLabel = model === 'deepseek-v4-pro' ? 'PRO' : 'FLASH';

  const [tone, label] = !linked
    ? [color.textFaint, 'NEURAL LINK · OFFLINE']
    : link === 'thinking'
      ? [color.transfer, 'PROCESSING']
      : link === 'speaking'
        ? [color.accent, 'TRANSMITTING']
        : link === 'error'
          ? [color.expense, `FAULT · ${(error ?? 'unknown').toUpperCase()}`]
          : [color.income, `LINK ▸ ${modelLabel}${latency ? ` · ${latency}MS` : ''}`];

  const busy = link === 'thinking' || link === 'speaking';
  const dot = <View style={[s.dot, { backgroundColor: tone }]} />;

  return (
    <Row style={{ gap: 6, justifyContent: align === 'center' ? 'center' : 'flex-start' }}>
      {busy ? <Pulse min={0.2} ms={380}>{dot}</Pulse> : dot}
      <Txt variant="micro" weight="bold" spaced tone={tone} numberOfLines={1} style={{ flexShrink: 1 }}>
        {label}
      </Txt>
    </Row>
  );
}

const s = StyleSheet.create({
  dot: { width: 6, height: 6, borderRadius: 3 },
});

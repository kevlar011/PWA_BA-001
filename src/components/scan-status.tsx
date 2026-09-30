import { StyleSheet, View } from 'react-native';

import { Pulse } from '@/components/ui/motion';
import { Row, Txt } from '@/components/ui/primitives';
import { scanReadout } from '@/lib/vane';
import type { DocketData } from '@/lib/types';
import { color } from '@/theme/tokens';

const TONE = {
  late: color.expense,
  soon: color.warn,
  later: color.transfer,
  clear: color.income,
} as const;

/** VANE's one line of machine state: `SCANNING · 7 OPEN · 2 CLOSING`. */
export function ScanStatus({ docket, align = 'left' }: { docket: DocketData; align?: 'left' | 'center' }) {
  const { text, level } = scanReadout(docket);
  const tone = TONE[level];
  const dot = <View style={[s.dot, { backgroundColor: tone }]} />;

  return (
    <Row style={{ gap: 6, justifyContent: align === 'center' ? 'center' : 'flex-start' }}>
      {level === 'late' ? <Pulse min={0.2} ms={300}>{dot}</Pulse> : dot}
      <Txt variant="micro" weight="bold" spaced tone={tone} numberOfLines={1} style={{ flexShrink: 1 }}>
        {text}
      </Txt>
    </Row>
  );
}

const s = StyleSheet.create({
  dot: { width: 6, height: 6, borderRadius: 3 },
});

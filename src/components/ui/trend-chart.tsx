import { StyleSheet, View } from 'react-native';

import type { MonthSlice } from '@/lib/store';
import { color, radius, space } from '@/theme/tokens';
import { Row, Txt } from './primitives';

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/**
 * Monthly in/out as paired columns.
 *
 * Hard-edged and unrounded on purpose, this should read as something a
 * terminal plotted, not as a modern charting library.
 */
export function TrendChart({
  months,
  format,
  height = 108,
}: {
  months: MonthSlice[];
  format: (cents: number) => string;
  height?: number;
}) {
  const peak = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));
  const latest = months[months.length - 1];

  return (
    <View>
      <Row style={{ alignItems: 'flex-end', height, gap: space.sm }}>
        {months.map((m) => {
          const inH = Math.max(2, (m.income / peak) * height);
          const outH = Math.max(2, (m.expense / peak) * height);
          const isLatest = m.start === latest?.start;
          return (
            <View key={m.start} style={s.col}>
              <Row style={{ alignItems: 'flex-end', gap: 3, height }}>
                <View
                  style={[
                    s.bar,
                    { height: inH, backgroundColor: isLatest ? color.income : `${color.income}66` },
                  ]}
                />
                <View
                  style={[
                    s.bar,
                    {
                      height: outH,
                      backgroundColor: isLatest ? color.expense : `${color.expense}66`,
                    },
                  ]}
                />
              </Row>
            </View>
          );
        })}
      </Row>

      {/* Axis */}
      <Row style={{ gap: space.sm, marginTop: 6 }}>
        {months.map((m) => {
          const d = new Date(m.start);
          const isLatest = m.start === latest?.start;
          return (
            <View key={m.start} style={s.col}>
              <Txt
                variant="micro"
                weight="bold"
                tone={isLatest ? color.accent : color.textFaint}
                style={{ textAlign: 'center' }}>
                {MONTHS[d.getMonth()]}
              </Txt>
            </View>
          );
        })}
      </Row>

      <Row style={{ gap: space.lg, marginTop: space.md }}>
        <Row style={{ gap: 5, alignItems: 'center' }}>
          <View style={[s.key, { backgroundColor: color.income }]} />
          <Txt variant="micro" faint>
            IN
          </Txt>
        </Row>
        <Row style={{ gap: 5, alignItems: 'center' }}>
          <View style={[s.key, { backgroundColor: color.expense }]} />
          <Txt variant="micro" faint>
            OUT
          </Txt>
        </Row>
        <Txt variant="micro" faint style={{ marginLeft: 'auto' }}>
          PEAK {format(peak)}
        </Txt>
      </Row>
    </View>
  );
}

const s = StyleSheet.create({
  col: { flex: 1, alignItems: 'center' },
  bar: { width: 9, borderRadius: radius.sm },
  key: { width: 8, height: 8 },
});

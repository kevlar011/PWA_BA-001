import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { color, radius, space } from '@/theme/tokens';
import { Txt } from './primitives';

/** Haptics throw on web, so every tap goes through this guard. */
function tap(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS === 'web') return;
  void Haptics.impactAsync(style);
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'] as const;

/**
 * Appends a keypress to an amount string, rejecting anything that would make
 * it unparseable, a second decimal point, or a third decimal place.
 */
export function applyKey(current: string, key: string): string {
  if (key === '⌫') return current.slice(0, -1);
  if (key === '.') {
    if (current.includes('.')) return current;
    return current === '' ? '0.' : `${current}.`;
  }
  const [, decimals] = current.split('.');
  if (decimals !== undefined && decimals.length >= 2) return current;
  if (current === '0') return key;
  // Keep amounts sane; nobody is logging a trillion-dollar coffee.
  if (current.replace('.', '').length >= 12) return current;
  return current + key;
}

export function Keypad({
  onChange,
  value,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <View style={s.grid}>
      {KEYS.map((k) => (
        <Pressable
          key={k}
          onPress={() => {
            tap(k === '⌫' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
            onChange(applyKey(value, k));
          }}
          onLongPress={() => {
            if (k !== '⌫') return;
            tap(Haptics.ImpactFeedbackStyle.Heavy);
            onChange('');
          }}
          style={({ pressed }) => [s.key, pressed && { backgroundColor: color.surfacePress }]}>
          <Txt variant="title" weight="medium" tone={k === '⌫' ? color.textDim : color.text}>
            {k}
          </Txt>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  key: {
    // Three per row, accounting for the two 8pt gaps between them.
    width: '31.7%',
    flexGrow: 1,
    height: 58,
    borderRadius: radius.md,
    backgroundColor: color.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

import { Platform, View } from 'react-native';

import { Txt } from '@/components/ui/primitives';
import { color } from '@/theme/tokens';

/**
 * Tab bar furniture.
 *
 * Terminals navigated by function key, so the tab bar is an F1..F5 strip with
 * a filled block on the active one rather than icons.
 */
export function FnKey({
  n,
  label,
  focused,
  tone,
}: {
  n: number;
  label: string;
  focused: boolean;
  tone: string;
}) {
  return (
    <View style={{ alignItems: 'center', gap: 2, paddingTop: 2 }}>
      <Txt
        variant="micro"
        weight="bold"
        tone={focused ? color.accentText : color.textFaint}
        style={{
          backgroundColor: focused ? tone : 'transparent',
          paddingHorizontal: 5,
          paddingVertical: 1,
          overflow: 'hidden',
        }}>
        {`F${n}`}
      </Txt>
      <Txt variant="micro" weight="bold" spaced tone={focused ? tone : color.textFaint}>
        {label}
      </Txt>
    </View>
  );
}

/** The strip itself, tinted to the caller's phosphor. */
export const fnTabBarStyle = (tone: string) => ({
  backgroundColor: color.surface,
  borderTopColor: tone,
  borderTopWidth: 2,
  height: Platform.OS === 'web' ? 60 : 84,
  paddingTop: 6,
});

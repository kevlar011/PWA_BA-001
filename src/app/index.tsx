import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Fade } from '@/components/ui/motion';
import { Txt } from '@/components/ui/primitives';
import { useSession } from '@/lib/session';
import { useStore } from '@/lib/store';
import { color, space } from '@/theme/tokens';

const boot = (linked: boolean) => [
  'KEVLAR',
  'POST .................. OK',
  'LOCAL STORE ........... MOUNTED',
  'CIPHER ................ AES-GCM',
  `NEURAL LINK ........... ${linked ? 'ESTABLISHED' : 'OFFLINE'}`,
  'READY',
];

/**
 * Cold-start sequence, then straight to the ledger.
 *
 * Pure theatre, and kept short enough to stay charming — it runs once per
 * launch, so anything that routes back to `/` lands on banking without
 * sitting through it again.
 */
export default function Boot() {
  const booted = useSession((s) => s.booted);
  const setBooted = useSession((s) => s.setBooted);
  const linked = useStore((s) => !!s.settings.aiKey);
  const [line, setLine] = useState(0);
  const BOOT = boot(linked);

  useEffect(() => {
    if (booted) return;
    if (line >= BOOT.length) {
      const end = setTimeout(() => setBooted(true), 260);
      return () => clearTimeout(end);
    }
    const id = setTimeout(() => setLine((n) => n + 1), line === 0 ? 190 : 95);
    return () => clearTimeout(id);
  }, [booted, line, setBooted, BOOT.length]);

  if (booted) return <Redirect href="/bank" />;

  return (
    <View style={s.boot}>
      {BOOT.slice(0, line).map((text, i) => (
        <Fade key={text}>
          <Txt
            variant="caption"
            weight={i === 0 ? 'bold' : 'regular'}
            tone={i === 0 ? color.accent : color.textDim}
            style={{ marginBottom: 3 }}>
            {text}
          </Txt>
        </Fade>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: color.bg,
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
});

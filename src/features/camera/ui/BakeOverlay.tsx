import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Text } from '@/shared/ui/text';

type Props = {
  label: string | null;
};

function formatElapsed(seconds: number): string {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/** Full-bleed dim + spinner for look bake / stylize (capture, re-bake, import). */
export function BakeOverlay({ label }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!label) {
      setElapsed(0);
      return;
    }
    setElapsed(0);
    const timer = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [label]);

  if (!label) return null;

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      className="items-center justify-center bg-black/35"
    >
      <View className="items-center gap-3 rounded-2xl bg-black/55 px-6 py-5">
        <ActivityIndicator color="#FBBF24" size="large" />
        <Text className="text-center text-sm font-semibold text-white">{label}</Text>
        {elapsed > 0 ? (
          <Text className="text-[11px] font-medium text-white/55">{formatElapsed(elapsed)}</Text>
        ) : null}
      </View>
    </View>
  );
}

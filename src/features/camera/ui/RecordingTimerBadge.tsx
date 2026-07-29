import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/shared/ui/text';

type Props = {
  active: boolean;
};

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function RecordingTimerBadge({ active }: Props) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!active) {
      setElapsedSeconds(0);
      return;
    }

    const startedAt = Date.now();
    setElapsedSeconds(0);

    const id = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => clearInterval(id);
  }, [active]);

  if (!active) return null;

  return (
    <View pointerEvents="none" className="rounded-md bg-red-500 px-2.5 py-1">
      <Text className="text-[13px] font-semibold tabular-nums text-white">
        {formatElapsed(elapsedSeconds)}
      </Text>
    </View>
  );
}

import { StyleSheet, View } from 'react-native';

import { Text } from '@/shared/ui/text';

type Props = {
  seconds: number | null;
};

export function CountdownOverlay({ seconds }: Props) {
  if (seconds == null || seconds <= 0) return null;

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      className="items-center justify-center bg-black/35"
    >
      <Text className="text-8xl font-semibold text-white">{seconds}</Text>
    </View>
  );
}

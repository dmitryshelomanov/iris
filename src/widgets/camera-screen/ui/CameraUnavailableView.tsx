import { ActivityIndicator, View } from 'react-native';

import { Text } from '@/shared/ui/text';

export function CameraUnavailableView() {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-black">
      <ActivityIndicator color="#fff" />
      <Text className="text-white/70">Looking for a camera…</Text>
      <Text className="px-8 text-center text-xs text-white/40">
        Simulator has no camera. Run on a physical iPhone with a Dev Client build.
      </Text>
    </View>
  );
}

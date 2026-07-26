import { Pressable, View } from 'react-native';

import { Text } from '@/shared/ui/text';
import type { CameraPreset } from '../model/capturePresets';
import { cn } from '@/shared/lib/utils';
import { hapticSelect } from '../model/haptics';

const QUICK_NAMES = ['Street', 'Portrait', 'Night'] as const;

type Props = {
  presets: CameraPreset[];
  onApply: (preset: CameraPreset) => void;
  onOpenAll: () => void;
};

export function ScenePresetChips({ presets, onApply, onOpenAll }: Props) {
  const quick = QUICK_NAMES.map((name) =>
    presets.find((p) => p.name.toLowerCase() === name.toLowerCase()),
  ).filter(Boolean) as CameraPreset[];

  if (quick.length === 0) return null;

  return (
    <View className="flex-row items-center gap-1.5">
      {quick.map((preset) => (
        <Pressable
          key={preset.id}
          onPress={() => {
            void hapticSelect();
            onApply(preset);
          }}
          className="rounded-full border border-white/15 bg-black/40 px-2.5 py-1"
        >
          <Text className="text-[11px] font-semibold text-white">{preset.name}</Text>
        </Pressable>
      ))}
      <Pressable onPress={onOpenAll} className={cn('rounded-full bg-white/10 px-2 py-1')}>
        <Text className="text-[10px] font-semibold text-white/60">All</Text>
      </Pressable>
    </View>
  );
}

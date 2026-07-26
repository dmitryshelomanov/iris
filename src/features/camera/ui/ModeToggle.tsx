import { Pressable, View } from 'react-native';

import { Text } from '@/shared/ui/text';
import type { CaptureMode } from '../model';
import { cn } from '@/shared/lib/utils';

type Props = {
  mode: CaptureMode;
  onChange: (mode: CaptureMode) => void;
};

const MODES: CaptureMode[] = ['photo', 'video'];

export function ModeToggle({ mode, onChange }: Props) {
  return (
    <View className="flex-row items-center gap-2.5">
      {MODES.map((m) => {
        const active = m === mode;
        return (
          <Pressable key={m} onPress={() => onChange(m)} hitSlop={8}>
            <Text
              className={cn(
                'text-[11px] font-semibold uppercase tracking-wider',
                active ? 'text-amber-400' : 'text-white/50',
              )}
            >
              {m}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

import { Pressable, View } from 'react-native';

import { cn } from '@/shared/lib/utils';
import type { CaptureMode } from '../model';

type Props = {
  mode: CaptureMode;
  isRecording?: boolean;
  disabled?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
};

export function CaptureButton({ mode, isRecording, disabled, onPress, onLongPress }: Props) {
  const video = mode === 'video';

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={
        video ? (isRecording ? 'Stop recording' : 'Start recording') : 'Take photo'
      }
      className={cn(
        'h-16 w-16 items-center justify-center rounded-full border-[3px] border-white/90',
        disabled && 'opacity-40',
      )}
    >
      <View
        className={cn(
          'items-center justify-center',
          isRecording
            ? 'h-6 w-6 rounded-md bg-red-500'
            : video
              ? 'h-11 w-11 rounded-full bg-red-500'
              : 'h-11 w-11 rounded-full bg-white',
        )}
      />
    </Pressable>
  );
}

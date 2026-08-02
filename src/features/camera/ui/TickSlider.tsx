import { useCallback, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { Text } from '@/shared/ui/text';
import { cn } from '@/shared/lib/utils';

import { clamp01, progressFromValue, valueFromProgress } from './tickMath';

type Props = {
  value: number;
  min: number;
  max: number;
  /** Discrete step; continuous if omitted */
  step?: number;
  label?: string;
  formatValue?: (value: number) => string;
  disabled?: boolean;
  onChange: (value: number) => void;
  className?: string;
  /** Hide the amber fill/thumb labels row */
  showHeader?: boolean;
};

const TICK_COUNT = 41;

/**
 * Horizontal tick slider — relative pan from onBegin (no jump-to-finger).
 */
export function TickSlider({
  value,
  min,
  max,
  step,
  label,
  formatValue,
  disabled = false,
  onChange,
  className,
  showHeader = true,
}: Props) {
  const width = useSharedValue(1);
  const progress = useSharedValue(progressFromValue(value, min, max));
  const startProgress = useSharedValue(progress.value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    progress.value = progressFromValue(value, min, max);
  }, [value, min, max, progress]);

  const emitFromProgress = useCallback(
    (p: number) => {
      onChangeRef.current(valueFromProgress(p, min, max, step));
    },
    [max, min, step],
  );

  const gesture = Gesture.Pan()
    .enabled(!disabled)
    .onBegin(() => {
      startProgress.value = progress.value;
    })
    .onUpdate((e) => {
      const delta = e.translationX / width.value;
      const p = clamp01(startProgress.value + delta);
      progress.value = p;
      runOnJS(emitFromProgress)(p);
    });

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    left: `${progress.value * 100}%`,
  }));

  const display = formatValue ? formatValue(value) : value.toFixed(2);

  return (
    <View className={cn('w-full gap-1', disabled && 'opacity-40', className)}>
      {showHeader ? (
        <View className="flex-row items-center justify-between px-0.5">
          {label ? (
            <Text className="text-[10px] font-semibold uppercase tracking-wide text-white/55">
              {label}
            </Text>
          ) : (
            <View />
          )}
          <Text className="text-[11px] font-semibold text-amber-300">{display}</Text>
        </View>
      ) : null}
      <GestureDetector gesture={gesture}>
        <View
          className="h-9 justify-center"
          onLayout={(e) => {
            width.value = Math.max(1, e.nativeEvent.layout.width);
          }}
        >
          <View className="h-5 flex-row items-end justify-between overflow-hidden">
            {Array.from({ length: TICK_COUNT }).map((_, i) => {
              const major = i % 10 === 0;
              return (
                <View
                  key={i}
                  className={cn('w-px rounded-full bg-white/25', major ? 'h-4' : 'h-2.5')}
                />
              );
            })}
          </View>
          <Animated.View
            pointerEvents="none"
            className="absolute bottom-2 left-0 h-1 overflow-hidden rounded-full bg-amber-400/90"
            style={fillStyle}
          />
          <Animated.View
            pointerEvents="none"
            className="absolute bottom-0.5 -ml-1.5 h-0 w-0 border-l-[6px] border-r-[6px] border-t-[7px] border-l-transparent border-r-transparent border-t-amber-400"
            style={thumbStyle}
          />
        </View>
      </GestureDetector>
    </View>
  );
}

import { useCallback, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { cn } from '@/shared/lib/utils';

import { clamp01, progressFromValue, valueFromProgress } from './tickMath';

type Props = {
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  className?: string;
  height?: number;
};

const TICK_COUNT = 33;

/**
 * Vertical tick dial — drag up/down to change value (top = max).
 * Relative pan from onBegin (no jump-to-finger).
 */
export function TickWheel({
  value,
  min,
  max,
  step,
  disabled = false,
  onChange,
  className,
  height = 180,
}: Props) {
  const wheelHeight = useSharedValue(height);
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
    .activeOffsetY([-3, 3])
    .onBegin(() => {
      startProgress.value = progress.value;
    })
    .onUpdate((e) => {
      // Up increases value (top = max).
      const delta = -e.translationY / wheelHeight.value;
      const p = clamp01(startProgress.value + delta);
      progress.value = p;
      runOnJS(emitFromProgress)(p);
    });

  const thumbStyle = useAnimatedStyle(() => ({
    top: `${(1 - progress.value) * 100}%`,
  }));

  const fillStyle = useAnimatedStyle(() => ({
    height: `${progress.value * 100}%`,
    top: `${(1 - progress.value) * 100}%`,
  }));

  return (
    <View className={cn(disabled && 'opacity-40', className)} style={{ height }}>
      <GestureDetector gesture={gesture}>
        <View
          className="h-full w-11 items-center justify-center"
          onLayout={(e) => {
            wheelHeight.value = Math.max(1, e.nativeEvent.layout.height);
          }}
        >
          <View className="absolute inset-y-0 right-3 w-1 overflow-hidden rounded-full bg-white/15">
            <Animated.View className="absolute left-0 right-0 bg-amber-400/90" style={fillStyle} />
          </View>
          <View className="h-full w-7 justify-between py-0.5">
            {Array.from({ length: TICK_COUNT }).map((_, i) => {
              const major = i % 4 === 0;
              return (
                <View
                  key={i}
                  className={cn(
                    'self-end rounded-full bg-white/35',
                    major ? 'h-0.5 w-5' : 'h-px w-3',
                  )}
                />
              );
            })}
          </View>
          <Animated.View
            pointerEvents="none"
            className="absolute right-1.5 -mt-1.5 h-0 w-0 border-b-[6px] border-l-[7px] border-t-[6px] border-b-transparent border-l-amber-400 border-t-transparent"
            style={thumbStyle}
          />
        </View>
      </GestureDetector>
    </View>
  );
}

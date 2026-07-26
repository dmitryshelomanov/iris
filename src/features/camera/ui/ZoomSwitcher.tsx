import { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { CameraDevice } from 'react-native-vision-camera';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { Text } from '@/shared/ui/text';
import { formatZoomFactor, formatZoomLabel, formatZoomMm } from '../model';
import { hapticSelect } from '../model/haptics';

type Props = {
  majors: number[];
  zoom: number;
  zoomSV: SharedValue<number>;
  device: CameraDevice | undefined;
  wideFocalMm: number;
  minZoom: number;
  maxZoom: number;
  /** Throttled React state sync (labels / presets). */
  onChange: (zoom: number) => void;
  /** Every-frame native zoom (no React re-render). */
  onLiveZoom?: (zoom: number) => void;
};

const DIAL_HEIGHT = 48;
/** Horizontal px spanning the full log zoom range. */
const TRACK = 520;
const TICK_COUNT = 48;
const YELLOW = '#F5C518';
/** Sync React labels / presets at most ~20fps while scrubbing. */
const JS_SYNC_MS = 50;

function clamp(n: number, min: number, max: number) {
  'worklet';
  return Math.min(max, Math.max(min, n));
}

function zoomToT(zoom: number, min: number, max: number) {
  'worklet';
  if (max <= min * 1.001) return 0;
  return (Math.log(Math.max(zoom, min)) - Math.log(min)) / (Math.log(max) - Math.log(min));
}

function tToZoom(t: number, min: number, max: number) {
  'worklet';
  if (max <= min * 1.001) return min;
  return Math.exp(Math.log(min) + clamp(t, 0, 1) * (Math.log(max) - Math.log(min)));
}

export function ZoomSwitcher({
  majors,
  zoom,
  zoomSV,
  device,
  wideFocalMm,
  minZoom,
  maxZoom,
  onChange,
  onLiveZoom,
}: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const width = screenWidth - 24;
  const lastHapticMajor = useRef<number | null>(null);
  const lastJsSync = useRef(0);

  const scrollX = useSharedValue(-zoomToT(zoom, minZoom, maxZoom) * TRACK);
  const startX = useSharedValue(0);
  const minSV = useSharedValue(minZoom);
  const maxSV = useSharedValue(maxZoom);

  const canZoom = maxZoom > minZoom * 1.05;
  const marks = useMemo(
    () => (majors.length > 0 ? majors : [Number(minZoom.toFixed(2))]),
    [majors, minZoom],
  );
  const markTs = useMemo(
    () => marks.map((m) => zoomToT(m, minZoom, maxZoom)),
    [marks, minZoom, maxZoom],
  );

  useEffect(() => {
    minSV.value = minZoom;
    maxSV.value = maxZoom;
  }, [minZoom, maxZoom, minSV, maxSV]);

  // Keep dial aligned when zoom changes from outside (lens / preset / pinch end).
  useEffect(() => {
    scrollX.value = -zoomToT(zoom, minZoom, maxZoom) * TRACK;
  }, [zoom, minZoom, maxZoom, scrollX]);

  const ticks = useMemo(() => {
    const items: { t: number; major: boolean; medium: boolean }[] = [];
    for (let i = 0; i <= TICK_COUNT; i++) {
      const t = i / TICK_COUNT;
      const nearMajor = markTs.some((mt) => Math.abs(mt - t) < 0.012);
      items.push({ t, major: false, medium: !nearMajor && i % 4 === 0 });
    }
    for (const t of markTs) {
      items.push({ t, major: true, medium: false });
    }
    return items;
  }, [markTs]);

  const syncJs = useCallback(
    (next: number, haptic: boolean) => {
      onChange(next);
      if (!haptic) return;
      const hit = marks.find((m) => Math.abs(m - next) < 0.07);
      if (hit != null && lastHapticMajor.current !== hit) {
        lastHapticMajor.current = hit;
        void hapticSelect();
      } else if (hit == null) {
        lastHapticMajor.current = null;
      }
    },
    [marks, onChange],
  );

  const syncJsThrottled = useCallback(
    (next: number) => {
      const now = Date.now();
      if (now - lastJsSync.current < JS_SYNC_MS) return;
      lastJsSync.current = now;
      syncJs(next, true);
    },
    [syncJs],
  );

  const applyLive = useCallback(
    (next: number) => {
      onLiveZoom?.(next);
    },
    [onLiveZoom],
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-2, 2])
        .onBegin(() => {
          startX.value = scrollX.value;
        })
        .onUpdate((e) => {
          const nextX = clamp(startX.value + e.translationX, -TRACK, 0);
          scrollX.value = nextX;
          const t = clamp(-nextX / TRACK, 0, 1);
          const z = tToZoom(t, minSV.value, maxSV.value);
          zoomSV.value = z;
          runOnJS(applyLive)(z);
          runOnJS(syncJsThrottled)(z);
        })
        .onEnd(() => {
          runOnJS(syncJs)(zoomSV.value, true);
        }),
    [applyLive, maxSV, minSV, scrollX, startX, syncJs, syncJsThrottled, zoomSV],
  );

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: scrollX.value + width / 2 }],
  }));

  const activeOwner = useMemo(() => {
    let owner = marks[0] ?? zoom;
    for (const m of marks) {
      if (m <= zoom + 0.05) owner = m;
    }
    return owner;
  }, [marks, zoom]);

  const liveFactor = formatZoomLabel(zoom, device);
  const liveMm = formatZoomMm(zoom, device, wideFocalMm);

  if (!canZoom) return null;

  return (
    <View style={styles.wrap}>
      <GestureDetector gesture={panGesture}>
        <View style={[styles.dial, { width }]}>
          <Animated.View style={[styles.track, trackStyle]}>
            {ticks.map((tick, i) => {
              const h = tick.major ? 11 : tick.medium ? 8 : 5;
              return (
                <View
                  key={`${tick.major ? 'M' : 't'}-${i}`}
                  style={[
                    styles.tick,
                    {
                      left: tick.t * TRACK - 0.6,
                      height: h,
                      top: 3 + (11 - h),
                      opacity: tick.major ? 0.95 : tick.medium ? 0.5 : 0.28,
                      width: tick.major ? 1.5 : 1.25,
                    },
                  ]}
                />
              );
            })}
            {marks.map((m, idx) => {
              const hide = Math.abs(m - activeOwner) < 0.04 && Math.abs(zoom - m) < 0.14;
              if (hide) return null;
              return (
                <View
                  key={m}
                  style={[styles.label, { left: markTs[idx]! * TRACK - 20 }]}
                >
                  <Text style={styles.labelFactor}>{formatZoomFactor(m, device)}</Text>
                  <Text style={styles.labelMm}>{formatZoomMm(m, device, wideFocalMm)}</Text>
                </View>
              );
            })}
          </Animated.View>

          <View pointerEvents="none" style={styles.caretWrap}>
            <View style={styles.caret} />
          </View>

          <View pointerEvents="none" style={styles.activeReadout}>
            <Text style={styles.activeFactor}>{liveFactor}</Text>
            <Text style={styles.activeMm}>{liveMm}</Text>
          </View>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  dial: {
    height: DIAL_HEIGHT,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    overflow: 'hidden',
  },
  track: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: TRACK + 40,
  },
  tick: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 1,
  },
  label: {
    position: 'absolute',
    top: 16,
    width: 40,
    alignItems: 'center',
  },
  labelFactor: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 13,
    textAlign: 'center',
  },
  labelMm: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 0.3,
    lineHeight: 10,
    textAlign: 'center',
  },
  caretWrap: {
    position: 'absolute',
    top: 1,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 4,
  },
  caret: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: YELLOW,
  },
  activeReadout: {
    position: 'absolute',
    top: 15,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 3,
  },
  activeFactor: {
    color: YELLOW,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
    textAlign: 'center',
  },
  activeMm: {
    color: YELLOW,
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 0.4,
    lineHeight: 10,
    textAlign: 'center',
    opacity: 0.95,
  },
});

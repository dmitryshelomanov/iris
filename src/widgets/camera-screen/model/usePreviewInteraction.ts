import { useCallback, useMemo, useState, type RefObject } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS, type SharedValue } from 'react-native-reanimated';
import type { CameraRef } from 'react-native-vision-camera';

import { hapticFocusLock, type FocusReticleState } from '@/features/camera';
import { errorMessage } from '@/shared/lib/errorMessage';

import { canPreviewInteract } from './captureGuards';

const LONG_PRESS_MS = 380;

const FOCUS_OPTIONS_CONTINUOUS = {
  responsiveness: 'snappy' as const,
  adaptiveness: 'continuous' as const,
  autoResetAfter: 4,
};

const FOCUS_OPTIONS_LOCKED = {
  responsiveness: 'snappy' as const,
  adaptiveness: 'locked' as const,
  autoResetAfter: null,
};

type Options = {
  cameraRef: RefObject<CameraRef | null>;
  manualEnabled: boolean;
  countdown: number | null;
  isCapturing: boolean;
  setStatus: (status: string | null) => void;
  zoomSV: SharedValue<number>;
  pinchStartZoom: SharedValue<number>;
  minZoomSV: SharedValue<number>;
  maxZoomSV: SharedValue<number>;
  applyLiveZoom: (next: number) => void;
  syncZoomFromPinchThrottled: (next: number) => void;
  syncZoomFromGesture: (next: number) => void;
};

export function usePreviewInteraction({
  cameraRef,
  manualEnabled,
  countdown,
  isCapturing,
  setStatus,
  zoomSV,
  pinchStartZoom,
  minZoomSV,
  maxZoomSV,
  applyLiveZoom,
  syncZoomFromPinchThrottled,
  syncZoomFromGesture,
}: Options) {
  const [focusReticle, setFocusReticle] = useState<FocusReticleState>(null);
  const [aeAfLocked, setAeAfLocked] = useState(false);

  const onPreviewTap = useCallback(
    async (locationX: number, locationY: number) => {
      if (!canPreviewInteract({ manualEnabled, countdown, isCapturing })) return;
      setFocusReticle({ x: locationX, y: locationY, locked: false });
      setAeAfLocked(false);
      try {
        await cameraRef.current?.focusTo({ x: locationX, y: locationY }, FOCUS_OPTIONS_CONTINUOUS);
      } catch (error) {
        setStatus(errorMessage(error, 'Focus failed'));
      }
    },
    [cameraRef, countdown, isCapturing, manualEnabled, setStatus],
  );

  const onPreviewLongPress = useCallback(
    async (locationX: number, locationY: number) => {
      if (!canPreviewInteract({ manualEnabled, countdown, isCapturing })) return;
      setFocusReticle({ x: locationX, y: locationY, locked: true });
      setAeAfLocked(true);
      hapticFocusLock();
      setStatus('AE/AF locked');
      try {
        await cameraRef.current?.focusTo({ x: locationX, y: locationY }, FOCUS_OPTIONS_LOCKED);
      } catch (error) {
        setStatus(errorMessage(error, 'Lock failed'));
      }
    },
    [cameraRef, countdown, isCapturing, manualEnabled, setStatus],
  );

  const previewGestures = useMemo(() => {
    const tap = Gesture.Tap().onEnd((e) => {
      runOnJS(onPreviewTap)(e.x, e.y);
    });

    const longPress = Gesture.LongPress()
      .minDuration(LONG_PRESS_MS)
      .onStart((e) => {
        runOnJS(onPreviewLongPress)(e.x, e.y);
      });

    const pinch = Gesture.Pinch()
      .onBegin(() => {
        pinchStartZoom.value = zoomSV.value;
      })
      .onUpdate((e) => {
        const next = Math.min(
          maxZoomSV.value,
          Math.max(minZoomSV.value, pinchStartZoom.value * e.scale),
        );
        zoomSV.value = next;
        runOnJS(applyLiveZoom)(next);
        runOnJS(syncZoomFromPinchThrottled)(Number(next.toFixed(3)));
      })
      .onEnd(() => {
        runOnJS(syncZoomFromGesture)(Number(zoomSV.value.toFixed(3)));
      });

    return Gesture.Simultaneous(pinch, Gesture.Exclusive(longPress, tap));
  }, [
    applyLiveZoom,
    maxZoomSV,
    minZoomSV,
    onPreviewLongPress,
    onPreviewTap,
    pinchStartZoom,
    syncZoomFromGesture,
    syncZoomFromPinchThrottled,
    zoomSV,
  ]);

  const unlockAeAf = useCallback(async () => {
    if (!aeAfLocked) return;
    setAeAfLocked(false);
    setFocusReticle(null);
    try {
      await cameraRef.current?.resetFocus();
      setStatus('AE/AF unlocked');
    } catch {
      // ignore
    }
  }, [aeAfLocked, cameraRef, setStatus]);

  return {
    focusReticle,
    aeAfLocked,
    previewGestures,
    unlockAeAf,
  };
}

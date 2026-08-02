import { useCallback, useMemo, useState, type RefObject } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import type { CameraRef } from 'react-native-vision-camera';

import {
  hapticFocusLock,
  isCameraControlCanceled,
  type FocusReticleState,
} from '@/features/camera';
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
  countdown: number | null;
  isCapturing: boolean;
  /** When Pro manual is on, tap-to-focus should pause lens-position locks. */
  onTapFocusWhileManual?: () => void;
  manualEnabled: boolean;
  setStatus: (status: string | null) => void;
};

export function usePreviewInteraction({
  cameraRef,
  countdown,
  isCapturing,
  onTapFocusWhileManual,
  manualEnabled,
  setStatus,
}: Options) {
  const [focusReticle, setFocusReticle] = useState<FocusReticleState>(null);
  const [aeAfLocked, setAeAfLocked] = useState(false);

  const focusAtPoint = useCallback(
    async (locationX: number, locationY: number, lock: boolean) => {
      if (!canPreviewInteract({ countdown, isCapturing })) return;
      if (manualEnabled) onTapFocusWhileManual?.();
      setFocusReticle({ x: locationX, y: locationY, locked: lock });
      setAeAfLocked(lock);
      if (lock) {
        hapticFocusLock();
        setStatus('AE/AF locked');
      }
      try {
        await cameraRef.current?.focusTo(
          { x: locationX, y: locationY },
          lock ? FOCUS_OPTIONS_LOCKED : FOCUS_OPTIONS_CONTINUOUS,
        );
      } catch (error) {
        setStatus(errorMessage(error, lock ? 'Lock failed' : 'Focus failed'));
      }
    },
    [
      cameraRef,
      countdown,
      isCapturing,
      manualEnabled,
      onTapFocusWhileManual,
      setStatus,
    ],
  );

  const onPreviewTap = useCallback(
    (locationX: number, locationY: number) => {
      void focusAtPoint(locationX, locationY, false);
    },
    [focusAtPoint],
  );

  const onPreviewLongPress = useCallback(
    (locationX: number, locationY: number) => {
      void focusAtPoint(locationX, locationY, true);
    },
    [focusAtPoint],
  );

  const previewGestures = useMemo(() => {
    // Native zoom gesture on Camera must run alongside JS tap / long-press.
    const native = Gesture.Native();

    const tap = Gesture.Tap().onEnd((e) => {
      runOnJS(onPreviewTap)(e.x, e.y);
    });

    const longPress = Gesture.LongPress()
      .minDuration(LONG_PRESS_MS)
      .onStart((e) => {
        runOnJS(onPreviewLongPress)(e.x, e.y);
      });

    return Gesture.Simultaneous(native, Gesture.Exclusive(longPress, tap));
  }, [onPreviewLongPress, onPreviewTap]);

  const unlockAeAf = useCallback(async () => {
    if (!aeAfLocked) return;
    setAeAfLocked(false);
    setFocusReticle(null);
    try {
      await cameraRef.current?.resetFocus();
      setStatus('AE/AF unlocked');
    } catch (error) {
      // Android CameraX cancels when session is briefly inactive after capture.
      if (isCameraControlCanceled(error)) return;
    }
  }, [aeAfLocked, cameraRef, setStatus]);

  return {
    focusReticle,
    aeAfLocked,
    previewGestures,
    unlockAeAf,
  };
}

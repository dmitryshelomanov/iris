import { useCallback, useEffect, useState, type RefObject } from 'react';
import type { CameraRef } from 'react-native-vision-camera';

import {
  applyLookToManual,
  applyManualToController,
  DEFAULT_MANUAL_STATE,
  isCameraControlCanceled,
  seedManualFromController,
  type LookPresetId,
  type ManualControlsState,
} from '@/features/camera';
import { errorMessage } from '@/shared/lib/errorMessage';

type Options = {
  cameraRef: RefObject<CameraRef | null>;
  device: { id: string } | undefined;
  sessionReady: boolean;
  controllerReady: number;
  lookId: LookPresetId;
  /** When true, skip controller apply; re-run after capture/bake ends. */
  isCapturing: boolean;
  setStatus: (status: string | null) => void;
  patchSettings: (patch: { lookId: LookPresetId }) => void;
};

export function useCameraManual({
  cameraRef,
  device,
  sessionReady,
  controllerReady,
  lookId,
  isCapturing,
  setStatus,
  patchSettings,
}: Options) {
  const [manual, setManualState] = useState<ManualControlsState>(DEFAULT_MANUAL_STATE);
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    if (isCapturing || !sessionReady) return;
    const controller = cameraRef.current?.controller;
    if (!controller || !device) return;

    let cancelled = false;
    (async () => {
      try {
        await applyManualToController(controller, manual, {
          lockWhiteBalance: lookId !== 'none' || manual.enabled,
        });
      } catch (error) {
        if (cancelled || isCameraControlCanceled(error)) return;
        setStatus(errorMessage(error, 'Control failed'));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    cameraRef,
    controllerReady,
    device,
    isCapturing,
    lookId,
    manual,
    sessionReady,
    setStatus,
  ]);

  const onManualChange = useCallback(
    (next: ManualControlsState) => {
      const controller = cameraRef.current?.controller;
      if (next.enabled && !manual.enabled && controller) {
        setManualState(seedManualFromController(controller, next));
        return;
      }
      setManualState(next);
    },
    [cameraRef, manual.enabled],
  );

  const onLookChange = useCallback(
    (nextLookId: LookPresetId) => {
      patchSettings({ lookId: nextLookId });
      setManualState((prev) => applyLookToManual(prev, nextLookId));
    },
    [patchSettings],
  );

  return {
    manual,
    showManual,
    setShowManual,
    onManualChange,
    onLookChange,
  };
}

import { useCallback, useEffect, useState, type RefObject } from 'react';
import type { CameraRef } from 'react-native-vision-camera';

import {
  applyLookToManual,
  applyManualToController,
  DEFAULT_MANUAL_STATE,
  seedManualFromController,
  type LookPresetId,
  type ManualControlsState,
} from '@/features/camera';

type Options = {
  cameraRef: RefObject<CameraRef | null>;
  device: { id: string } | undefined;
  sessionReady: boolean;
  controllerReady: number;
  lookId: LookPresetId;
  isCapturingRef: RefObject<boolean>;
  setStatus: (status: string | null) => void;
  patchSettings: (patch: { lookId: LookPresetId }) => void;
};

export function useCameraManual({
  cameraRef,
  device,
  sessionReady,
  controllerReady,
  lookId,
  isCapturingRef,
  setStatus,
  patchSettings,
}: Options) {
  const [manual, setManual] = useState<ManualControlsState>(DEFAULT_MANUAL_STATE);
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    if (isCapturingRef.current) return;
    const controller = cameraRef.current?.controller;
    if (!controller || !device || !sessionReady) return;

    let cancelled = false;
    (async () => {
      try {
        await applyManualToController(controller, manual, {
          lockWhiteBalance: lookId !== 'none' || manual.enabled,
        });
      } catch (error) {
        if (!cancelled) {
          setStatus(error instanceof Error ? error.message : 'Control failed');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cameraRef, controllerReady, device, isCapturingRef, lookId, manual, sessionReady, setStatus]);

  const onManualChange = useCallback(
    (next: ManualControlsState) => {
      const controller = cameraRef.current?.controller;
      if (next.enabled && !manual.enabled && controller) {
        setManual(seedManualFromController(controller, next));
        return;
      }
      setManual(next);
    },
    [cameraRef, manual.enabled],
  );

  const onLookChange = useCallback(
    (nextLookId: LookPresetId) => {
      patchSettings({ lookId: nextLookId });
      setManual((prev) => applyLookToManual(prev, nextLookId));
    },
    [patchSettings],
  );

  return {
    manual,
    setManual,
    showManual,
    setShowManual,
    onManualChange,
    onLookChange,
  };
}

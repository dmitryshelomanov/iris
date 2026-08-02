import { useEffect, useState, type RefObject } from 'react';
import type { CameraRef } from 'react-native-vision-camera';

import {
  lensToUiFocus,
  peakingIntensity,
  type CaptureSettings,
  type ManualControlsState,
} from '@/features/camera';

const PEAKING_POLL_MS = 350;

type Options = {
  cameraRef: RefObject<CameraRef | null>;
  settings: CaptureSettings;
  sessionReady: boolean;
  manual: ManualControlsState;
  aeAfLocked: boolean;
};

function readLiveFocus(cameraRef: RefObject<CameraRef | null>, manual: ManualControlsState) {
  const controller = cameraRef.current?.controller;
  if (manual.enabled) return manual.focus;
  const lens = controller?.lensPosition;
  if (controller && Number.isFinite(lens)) return lensToUiFocus(lens as number);
  return manual.focus;
}

/** Telemetry-only assist overlays (no frame-processor / VideoDataOutput). */
export function useLiveOverlays({
  cameraRef,
  settings,
  sessionReady,
  manual,
  aeAfLocked,
}: Options) {
  const [peakIntensity, setPeakIntensity] = useState(0);

  useEffect(() => {
    if (!settings.showPeaking || !sessionReady) return;

    const tick = () => {
      const focus = readLiveFocus(cameraRef, manual);
      setPeakIntensity(peakingIntensity(focus, aeAfLocked || manual.enabled));
    };

    tick();
    const id = setInterval(tick, PEAKING_POLL_MS);
    return () => clearInterval(id);
  }, [aeAfLocked, cameraRef, manual, sessionReady, settings.showPeaking]);

  return {
    peakIntensity,
  };
}

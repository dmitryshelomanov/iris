import { useEffect, useMemo, useState, type RefObject } from 'react';
import type { CameraRef } from 'react-native-vision-camera';

import {
  peakingIntensity,
  synthesizeLiveHistogram,
  zebraIntensityFromExposure,
  type CaptureSettings,
  type ManualControlsState,
} from '@/features/camera';

type Options = {
  cameraRef: RefObject<CameraRef | null>;
  settings: CaptureSettings;
  sessionReady: boolean;
  manual: ManualControlsState;
  aeAfLocked: boolean;
  lastShotHistogram: number[] | null | undefined;
  lastShotId: string | undefined;
};

export function useLiveOverlays({
  cameraRef,
  settings,
  sessionReady,
  manual,
  aeAfLocked,
  lastShotHistogram,
  lastShotId,
}: Options) {
  const [histogram, setHistogram] = useState<number[] | null>(lastShotHistogram ?? null);
  const [liveHistogram, setLiveHistogram] = useState<number[] | null>(null);

  useEffect(() => {
    if (lastShotHistogram) setHistogram(lastShotHistogram);
  }, [lastShotId, lastShotHistogram]);

  useEffect(() => {
    if (!settings.showHistogram || !sessionReady) return;
    const id = setInterval(() => {
      const controller = cameraRef.current?.controller;
      if (!controller) return;
      const iso = controller.iso > 0 ? controller.iso : manual.iso;
      const shutter =
        controller.exposureDuration > 0 ? controller.exposureDuration : manual.shutter;
      const ev = manual.enabled ? manual.ev : controller.exposureBias;
      setLiveHistogram(synthesizeLiveHistogram({ iso, shutter, ev }));
    }, 400);
    return () => clearInterval(id);
  }, [
    cameraRef,
    manual.enabled,
    manual.ev,
    manual.iso,
    manual.shutter,
    sessionReady,
    settings.showHistogram,
  ]);

  const zebraIntensity = useMemo(() => {
    if (!settings.showZebras) return 0;
    const iso = manual.enabled ? manual.iso : 400;
    return zebraIntensityFromExposure(manual.ev, iso);
  }, [manual.enabled, manual.ev, manual.iso, settings.showZebras]);

  const peakIntensity = useMemo(() => {
    if (!settings.showPeaking) return 0;
    return peakingIntensity(manual.focus, aeAfLocked || manual.enabled);
  }, [aeAfLocked, manual.enabled, manual.focus, settings.showPeaking]);

  const displayHistogram = liveHistogram ?? histogram;

  return {
    histogram,
    setHistogram,
    liveHistogram,
    displayHistogram,
    zebraIntensity,
    peakIntensity,
  };
}

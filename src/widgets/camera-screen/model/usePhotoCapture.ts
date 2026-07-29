import { useCallback, type RefObject } from 'react';
import type { CameraRef, usePhotoOutput } from 'react-native-vision-camera';

import { persistPhotoMaster, savePhotoToLibrary } from '@/entities/capture';
import type { RecentCapture } from '@/entities/capture';
import {
  bakeLookIntoPhoto,
  hapticShutter,
  type LookPreset,
  type CaptureMode,
  type CaptureSettings,
  type LensOption,
  type ManualControlsState,
} from '@/features/camera';
import { errorMessage } from '@/shared/lib/errorMessage';

import { captureStatus } from './captureStatus';
import { useCaptureLock } from './useCaptureLock';

type PhotoOutput = ReturnType<typeof usePhotoOutput>;

type Options = {
  cameraRef: RefObject<CameraRef | null>;
  mode: CaptureMode;
  settings: CaptureSettings;
  sessionReady: boolean;
  look: LookPreset;
  activeLens: LensOption | undefined;
  capabilities: { hasFlash: boolean };
  wideFocalMm: number;
  manual: ManualControlsState;
  photoOutput: PhotoOutput;
  isCapturingRef: RefObject<boolean>;
  setStatus: (status: string | null) => void;
  addCapture: (entry: Omit<RecentCapture, 'id' | 'createdAt'> & { id?: string }) => Promise<void>;
  setPostCaptureOpen: (open: boolean) => void;
};

export function usePhotoCapture({
  cameraRef,
  mode,
  settings,
  sessionReady,
  look,
  activeLens,
  capabilities,
  wideFocalMm,
  manual,
  photoOutput,
  isCapturingRef,
  setStatus,
  addCapture,
  setPostCaptureOpen,
}: Options) {
  const { isCapturing, beginCapture, endCapture } = useCaptureLock(isCapturingRef);

  const takePhotoOnce = useCallback(async () => {
    const flashMode =
      activeLens?.position === 'front' || !capabilities.hasFlash ? 'off' : settings.flashMode;

    const { filePath } = await photoOutput.capturePhotoToFile(
      {
        flashMode,
        enableShutterSound: settings.shutterSound,
      },
      {},
    );

    const masterUri = await persistPhotoMaster(filePath);
    const baked = await bakeLookIntoPhoto(masterUri, look.overlay, {
      strength: settings.lookStrength,
      jpegQuality: settings.jpegQuality,
    });

    const asset = await savePhotoToLibrary(baked.uri);

    const controller = cameraRef.current?.controller;
    const iso =
      manual.enabled || !controller || !(controller.iso > 0) ? manual.iso : controller.iso;
    const shutter =
      manual.enabled || !controller || !(controller.exposureDuration > 0)
        ? manual.shutter
        : controller.exposureDuration;
    const ev = manual.enabled ? manual.ev : (controller?.exposureBias ?? manual.ev);

    await addCapture({
      uri: baked.uri,
      rawUri: masterUri,
      libraryAssetId: asset.id,
      kind: 'photo',
      lookId: settings.lookId,
      lookStrength: settings.lookStrength,
      histogram: baked.histogram,
      meta: {
        lensLabel: activeLens?.label,
        focalLengthMm: activeLens?.focalLengthMm ?? wideFocalMm,
        iso,
        shutter,
        ev,
        wbKelvin: manual.wbKelvin,
      },
    });

    return baked;
  }, [
    activeLens?.focalLengthMm,
    activeLens?.label,
    activeLens?.position,
    addCapture,
    cameraRef,
    capabilities.hasFlash,
    look.overlay,
    manual.enabled,
    manual.ev,
    manual.iso,
    manual.shutter,
    manual.wbKelvin,
    photoOutput,
    settings.flashMode,
    settings.jpegQuality,
    settings.lookId,
    settings.lookStrength,
    settings.shutterSound,
    wideFocalMm,
  ]);

  const takePhoto = useCallback(async () => {
    if (isCapturingRef.current || isCapturing) return;
    if (!sessionReady) {
      setStatus(captureStatus.cameraWarmingUp());
      return;
    }

    beginCapture();
    const burst = mode === 'photo' ? settings.burstCount : 1;
    setStatus(burst > 1 ? captureStatus.burstStart(burst) : captureStatus.capturingPhoto());
    hapticShutter();

    try {
      for (let i = 0; i < burst; i += 1) {
        if (burst > 1) setStatus(captureStatus.burstProgress(i + 1, burst));
        else setStatus(captureStatus.applyingLook());
        await takePhotoOnce();
      }
      setStatus(captureStatus.savedPhoto(burst, look));
      setPostCaptureOpen(true);
    } catch (error) {
      const message = errorMessage(error, 'Capture failed');
      console.warn('[iris] capture failed', error);
      setStatus(message);
    } finally {
      endCapture();
    }
  }, [
    beginCapture,
    endCapture,
    isCapturing,
    isCapturingRef,
    look.hint,
    look.label,
    mode,
    sessionReady,
    setPostCaptureOpen,
    setStatus,
    settings.burstCount,
    takePhotoOnce,
  ]);

  return {
    isCapturing,
    takePhoto,
  };
}

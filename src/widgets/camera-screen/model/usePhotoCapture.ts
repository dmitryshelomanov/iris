import { useCallback, useState, type RefObject } from 'react';
import type { CameraRef, usePhotoOutput } from 'react-native-vision-camera';

import { persistPhotoMaster, savePhotoToLibrary } from '@/entities/capture';
import type { RecentCapture } from '@/entities/capture';
import {
  bakePhotoWithLook,
  hapticShutter,
  type LookPreset,
  type CaptureMode,
  type CaptureSettings,
  type LensOption,
  type ManualControlsState,
} from '@/features/camera';
import { errorMessage } from '@/shared/lib/errorMessage';

import { captureStatus, type BakePhase } from './captureStatus';
import { useCaptureLock } from './useCaptureLock';

type PhotoOutput = ReturnType<typeof usePhotoOutput>;

type CaptureMeta = NonNullable<RecentCapture['meta']>;

type CapturedMaster = {
  masterUri: string;
  meta: CaptureMeta;
};

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
  onCapturingChange?: (capturing: boolean) => void;
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
  onCapturingChange,
  setStatus,
  addCapture,
  setPostCaptureOpen,
}: Options) {
  const { isCapturing, beginCapture, endCapture } = useCaptureLock({
    isCapturingRef,
    onChange: onCapturingChange,
  });
  const [bakePhase, setBakePhase] = useState<BakePhase | null>(null);

  const captureMaster = useCallback(async (): Promise<CapturedMaster> => {
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

    const controller = cameraRef.current?.controller;
    const iso =
      manual.enabled || !controller || !(controller.iso > 0) ? manual.iso : controller.iso;
    const shutter =
      manual.enabled || !controller || !(controller.exposureDuration > 0)
        ? manual.shutter
        : controller.exposureDuration;
    const ev = manual.enabled ? manual.ev : (controller?.exposureBias ?? manual.ev);

    return {
      masterUri,
      meta: {
        lensLabel: activeLens?.label,
        focalLengthMm: activeLens?.focalLengthMm ?? wideFocalMm,
        iso,
        shutter,
        ev,
        wbKelvin: manual.wbKelvin,
      },
    };
  }, [
    activeLens?.focalLengthMm,
    activeLens?.label,
    activeLens?.position,
    cameraRef,
    capabilities.hasFlash,
    manual.enabled,
    manual.ev,
    manual.iso,
    manual.shutter,
    manual.wbKelvin,
    photoOutput,
    settings.flashMode,
    settings.shutterSound,
    wideFocalMm,
  ]);

  const bakeAndSaveMaster = useCallback(
    async (captured: CapturedMaster, phase?: BakePhase) => {
      setBakePhase(
        phase ?? (look.mlStyle ? { id: 'applyingAnime' } : { id: 'applyingLook' }),
      );

      const { baked, bakeStrength } = await bakePhotoWithLook(captured.masterUri, {
        lookId: settings.lookId,
        lookStrength: settings.lookStrength,
        jpegQuality: settings.jpegQuality,
      });

      setBakePhase({ id: 'saving' });
      const asset = await savePhotoToLibrary(baked.uri);

      await addCapture({
        uri: baked.uri,
        rawUri: captured.masterUri,
        libraryAssetId: asset.id,
        kind: 'photo',
        lookId: settings.lookId,
        lookStrength: bakeStrength,
        histogram: baked.histogram,
        meta: captured.meta,
      });

      return baked;
    },
    [
      addCapture,
      look.mlStyle,
      settings.jpegQuality,
      settings.lookId,
      settings.lookStrength,
    ],
  );

  const takePhoto = useCallback(async () => {
    if (isCapturingRef.current || isCapturing) return;
    if (!sessionReady) {
      setStatus(captureStatus.cameraWarmingUp());
      return;
    }

    beginCapture();
    const burst = mode === 'photo' ? settings.burstCount : 1;
    const isMlBurst = Boolean(look.mlStyle) && burst > 1;
    setBakePhase(burst > 1 ? { id: 'burst', index: 1, total: burst } : { id: 'capturing' });
    setStatus(null);
    hapticShutter();

    let saved = 0;
    try {
      if (isMlBurst) {
        const masters: CapturedMaster[] = [];
        for (let i = 0; i < burst; i += 1) {
          setBakePhase({ id: 'burst', index: i + 1, total: burst });
          masters.push(await captureMaster());
        }
        for (let i = 0; i < masters.length; i += 1) {
          const animePhase: BakePhase = {
            id: 'applyingAnime',
            index: i + 1,
            total: masters.length,
          };
          await bakeAndSaveMaster(masters[i], animePhase);
          saved += 1;
        }
      } else {
        for (let i = 0; i < burst; i += 1) {
          if (burst > 1) setBakePhase({ id: 'burst', index: i + 1, total: burst });
          const master = await captureMaster();
          await bakeAndSaveMaster(master);
          saved += 1;
        }
      }
      setBakePhase(null);
      setStatus(captureStatus.savedPhoto(saved, look));
      setPostCaptureOpen(true);
    } catch (error) {
      const message = errorMessage(error, 'Capture failed');
      console.warn('[iris] capture failed', error);
      setBakePhase(null);
      if (saved > 0) {
        setStatus(`${message} · saved ${saved}/${burst}`);
        setPostCaptureOpen(true);
      } else {
        setStatus(message);
      }
    } finally {
      endCapture();
    }
  }, [
    bakeAndSaveMaster,
    beginCapture,
    captureMaster,
    endCapture,
    isCapturing,
    isCapturingRef,
    look,
    mode,
    sessionReady,
    setPostCaptureOpen,
    setStatus,
    settings.burstCount,
  ]);

  return {
    isCapturing,
    bakePhase,
    takePhoto,
  };
}

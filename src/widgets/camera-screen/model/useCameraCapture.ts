import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { CameraRef, Recorder } from 'react-native-vision-camera';

import { persistPhotoMaster, savePhotoToLibrary, saveVideoToLibrary } from '@/entities/capture';
import type { RecentCapture } from '@/entities/capture';
import {
  bakeLookIntoPhoto,
  bakeLookIntoVideo,
  getLookPreset,
  hapticRecordStart,
  hapticRecordStop,
  hapticShutter,
  type CaptureMode,
  type CaptureSettings,
  type LensOption,
  type ManualControlsState,
} from '@/features/camera';

type MicPermission = {
  hasPermission: boolean;
  canRequestPermission: boolean;
  requestPermission: () => Promise<boolean>;
};

type Options = {
  cameraRef: RefObject<CameraRef | null>;
  mode: CaptureMode;
  settings: CaptureSettings;
  sessionReady: boolean;
  activeLens: LensOption | undefined;
  capabilities: { hasFlash: boolean };
  wideFocalMm: number;
  manual: ManualControlsState;
  photoOutput: {
    capturePhotoToFile: (
      options: { flashMode: CaptureSettings['flashMode']; enableShutterSound: boolean },
      overrides: object,
    ) => Promise<{ filePath: string }>;
  };
  videoOutput: {
    createRecorder: (options: object) => Promise<Recorder>;
  };
  mic: MicPermission;
  isCapturingRef: RefObject<boolean>;
  setStatus: (status: string | null) => void;
  addCapture: (entry: Omit<RecentCapture, 'id' | 'createdAt'> & { id?: string }) => Promise<void>;
  setHistogram: (bins: number[] | null) => void;
  setPostCaptureOpen: (open: boolean) => void;
};

export function useCameraCapture({
  cameraRef,
  mode,
  settings,
  sessionReady,
  activeLens,
  capabilities,
  wideFocalMm,
  manual,
  photoOutput,
  videoOutput,
  mic,
  isCapturingRef,
  setStatus,
  addCapture,
  setHistogram,
  setPostCaptureOpen,
}: Options) {
  const [isRecording, setIsRecording] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const recorderRef = useRef<Recorder | null>(null);
  const stoppingRef = useRef(false);
  const cancelCountdownRef = useRef(false);

  const look = getLookPreset(settings.lookId);

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
    setHistogram(baked.histogram);

    await savePhotoToLibrary(baked.uri);

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
    setHistogram,
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
      setStatus('Camera warming up…');
      return;
    }

    isCapturingRef.current = true;
    setIsCapturing(true);
    const burst = mode === 'photo' ? settings.burstCount : 1;
    setStatus(burst > 1 ? `Burst ${burst}×…` : 'Capturing…');
    hapticShutter();

    try {
      for (let i = 0; i < burst; i += 1) {
        if (burst > 1) setStatus(`Burst ${i + 1}/${burst}…`);
        else setStatus('Applying look…');
        await takePhotoOnce();
      }
      setStatus(
        burst > 1
          ? `Saved ${burst} · ${look.label} · ${look.hint}`
          : `Saved · ${look.label} · ${look.hint}`,
      );
      setPostCaptureOpen(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Capture failed';
      console.warn('[iris] capture failed', error);
      setStatus(message);
    } finally {
      isCapturingRef.current = false;
      setIsCapturing(false);
    }
  }, [
    isCapturing,
    look.hint,
    look.label,
    mode,
    sessionReady,
    setPostCaptureOpen,
    settings.burstCount,
    takePhotoOnce,
  ]);

  const finishRecording = useCallback(
    async (filePath: string) => {
      try {
        let outPath = filePath;
        let uri = filePath.startsWith('file://') ? filePath : `file://${filePath}`;

        if (settings.lookId !== 'none') {
          setStatus('Applying look…');
          const baked = await bakeLookIntoVideo(filePath, look.overlay, {
            strength: settings.lookStrength,
          });
          outPath = baked.path;
          uri = baked.uri;
        }

        setStatus('Saving video…');
        await saveVideoToLibrary(outPath);
        await addCapture({ uri, kind: 'video', lookId: settings.lookId });
        setStatus(
          settings.lookId === 'none' ? 'Saved to Photos' : `Saved · ${look.label} · ${look.hint}`,
        );
        setPostCaptureOpen(true);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Save failed';
        console.warn('[iris] video save failed', error);
        setStatus(message);
      } finally {
        recorderRef.current = null;
        stoppingRef.current = false;
        setIsRecording(false);
      }
    },
    [
      addCapture,
      look.hint,
      look.label,
      look.overlay,
      setPostCaptureOpen,
      settings.lookId,
      settings.lookStrength,
    ],
  );

  const startRecording = useCallback(async () => {
    if (!sessionReady || isRecording || stoppingRef.current) {
      if (!sessionReady) setStatus('Camera warming up…');
      return;
    }

    if (!mic.hasPermission) {
      if (!mic.canRequestPermission) {
        setStatus('Enable microphone in Settings');
        return;
      }
      const granted = await mic.requestPermission();
      if (!granted) {
        setStatus('Microphone needed for video');
        return;
      }
      setStatus('Mic ready — audio on · tap to record');
      return;
    }

    try {
      setStatus('Recording… · tap to stop');
      hapticRecordStart();
      const recorder = await videoOutput.createRecorder({});
      recorderRef.current = recorder;
      setIsRecording(true);

      await recorder.startRecording(
        (filePath) => {
          finishRecording(filePath).catch((error) => {
            console.warn('[iris] finishRecording failed', error);
          });
        },
        (error) => {
          console.warn('[iris] recording error', error);
          setStatus(error.message || 'Recording failed');
          recorderRef.current = null;
          stoppingRef.current = false;
          setIsRecording(false);
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not start recording';
      console.warn('[iris] startRecording failed', error);
      setStatus(message);
      recorderRef.current = null;
      setIsRecording(false);
    }
  }, [
    finishRecording,
    isRecording,
    mic.canRequestPermission,
    mic.hasPermission,
    mic.requestPermission,
    sessionReady,
    videoOutput,
  ]);

  const stopRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || stoppingRef.current) return;

    stoppingRef.current = true;
    setStatus('Stopping…');
    hapticRecordStop();
    try {
      await recorder.stopRecording();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Stop failed';
      console.warn('[iris] stopRecording failed', error);
      setStatus(message);
      recorderRef.current = null;
      stoppingRef.current = false;
      setIsRecording(false);
    }
  }, []);

  const onCapture = useCallback(async () => {
    if (mode === 'video') {
      if (isRecording) {
        await stopRecording();
      } else {
        await startRecording();
      }
      return;
    }

    if (isCapturing || countdown != null) return;

    const delay = settings.timerSeconds;
    if (delay > 0) {
      cancelCountdownRef.current = false;
      for (let s = delay; s > 0; s -= 1) {
        if (cancelCountdownRef.current) {
          setCountdown(null);
          setStatus('Timer cancelled');
          return;
        }
        setCountdown(s);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      setCountdown(null);
      if (cancelCountdownRef.current) return;
    }

    await takePhoto();
  }, [
    countdown,
    isCapturing,
    isRecording,
    mode,
    settings.timerSeconds,
    startRecording,
    stopRecording,
    takePhoto,
  ]);

  const cancelCountdown = useCallback(() => {
    cancelCountdownRef.current = true;
  }, []);

  useEffect(() => {
    if (mode !== 'video' && isRecording) {
      stopRecording().catch((error) => {
        console.warn('[iris] stopRecording effect failed', error);
      });
    }
  }, [isRecording, mode, stopRecording]);

  return {
    look,
    isCapturing,
    isRecording,
    countdown,
    cancelCountdown,
    onCapture,
  };
}

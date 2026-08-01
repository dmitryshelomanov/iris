import { useCallback, useRef, useState, type RefObject } from 'react';
import type { CameraRef, usePhotoOutput, useVideoOutput } from 'react-native-vision-camera';

import type { RecentCapture } from '@/entities/capture';
import {
  getLookPreset,
  type CaptureMode,
  type CaptureSettings,
  type LensOption,
  type ManualControlsState,
} from '@/features/camera';

import { captureStatus } from './captureStatus';
import { usePhotoCapture } from './usePhotoCapture';
import { useVideoCapture } from './useVideoCapture';

type PhotoOutput = ReturnType<typeof usePhotoOutput>;
type VideoOutput = ReturnType<typeof useVideoOutput>;

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
  photoOutput: PhotoOutput;
  videoOutput: VideoOutput;
  mic: MicPermission;
  /** Sync gate for manual apply — mirrored into React state as isCapturing. */
  isCapturingRef: RefObject<boolean>;
  setStatus: (status: string | null) => void;
  addCapture: (entry: Omit<RecentCapture, 'id' | 'createdAt'> & { id?: string }) => Promise<void>;
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
  setPostCaptureOpen,
}: Options) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const cancelCountdownRef = useRef(false);
  const look = getLookPreset(settings.lookId);

  const photo = usePhotoCapture({
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
  });

  const video = useVideoCapture({
    settings,
    look,
    sessionReady,
    videoOutput,
    mic,
    isCapturingRef,
    setStatus,
    addCapture,
    setPostCaptureOpen,
    shouldStopOnInactive: mode !== 'video',
  });
  const isCapturing = photo.isCapturing || video.isCapturing;
  const bakePhase = photo.bakePhase ?? video.bakePhase;

  const onCapture = useCallback(async () => {
    if (mode === 'video') {
      if (video.isRecording) {
        await video.stopRecording();
      } else {
        await video.startRecording();
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
          setStatus(captureStatus.timerCancelled());
          return;
        }
        setCountdown(s);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      setCountdown(null);
      if (cancelCountdownRef.current) return;
    }

    await photo.takePhoto();
  }, [
    countdown,
    isCapturing,
    mode,
    photo.takePhoto,
    setStatus,
    settings.timerSeconds,
    video.isRecording,
    video.startRecording,
    video.stopRecording,
  ]);

  const cancelCountdown = useCallback(() => {
    cancelCountdownRef.current = true;
  }, []);

  return {
    look,
    isCapturing,
    bakePhase,
    isRecording: video.isRecording,
    countdown,
    cancelCountdown,
    onCapture,
  };
}

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Recorder, useVideoOutput } from 'react-native-vision-camera';

import { persistVideoMaster, saveVideoToLibrary } from '@/entities/capture';
import type { RecentCapture } from '@/entities/capture';
import {
  bakeLookIntoVideo,
  cancelBakeLookIntoVideo,
  hapticRecordStart,
  hapticRecordStop,
  toFileUri,
  toPath,
  type CaptureSettings,
  type LookPreset,
} from '@/features/camera';
import { errorMessage } from '@/shared/lib/errorMessage';

import { captureStatus } from './captureStatus';
import { useCaptureLock } from './useCaptureLock';

type VideoOutput = ReturnType<typeof useVideoOutput>;

type MicPermission = {
  hasPermission: boolean;
  canRequestPermission: boolean;
  requestPermission: () => Promise<boolean>;
};

type Options = {
  settings: CaptureSettings;
  look: LookPreset;
  sessionReady: boolean;
  videoOutput: VideoOutput;
  mic: MicPermission;
  isCapturingRef: RefObject<boolean>;
  setStatus: (status: string | null) => void;
  addCapture: (entry: Omit<RecentCapture, 'id' | 'createdAt'> & { id?: string }) => Promise<void>;
  setPostCaptureOpen: (open: boolean) => void;
  /** When true, stop any in-progress recording (e.g. mode flipped away from video). */
  shouldStopOnInactive: boolean;
};
type VideoCapturePhase = 'idle' | 'recording' | 'stopping' | 'processing';

export function useVideoCapture({
  settings,
  look,
  sessionReady,
  videoOutput,
  mic,
  isCapturingRef,
  setStatus,
  addCapture,
  setPostCaptureOpen,
  shouldStopOnInactive,
}: Options) {
  const [phase, setPhase] = useState<VideoCapturePhase>('idle');
  const recorderRef = useRef<Recorder | null>(null);
  const stoppingRef = useRef(false);
  const { isCapturing, beginCapture, endCapture } = useCaptureLock(isCapturingRef);
  const isRecording = phase === 'recording';

  const finishRecording = useCallback(
    async (filePath: string, lookPreset: LookPreset) => {
      beginCapture();
      setPhase('processing');

      try {
        const masterUri = await persistVideoMaster(filePath);
        let outPath = toPath(filePath);
        let uri = toFileUri(filePath);
        let lookApplied = settings.lookId === 'none';

        if (settings.lookId !== 'none') {
          setStatus(captureStatus.applyingLook());
          const baked = await bakeLookIntoVideo(masterUri, lookPreset.overlay, {
            strength: settings.lookStrength,
          });
          outPath = baked.path;
          uri = baked.uri;
          lookApplied = baked.baked;
        } else {
          uri = masterUri;
          outPath = toPath(masterUri);
        }

        setStatus(captureStatus.savingVideo());
        await saveVideoToLibrary(outPath);
        await addCapture({
          uri,
          rawUri: masterUri,
          kind: 'video',
          lookId: settings.lookId,
          lookStrength: settings.lookStrength,
        });
        if (settings.lookId === 'none') {
          setStatus(captureStatus.savedVideoNoLook());
        } else if (lookApplied) {
          setStatus(captureStatus.savedVideoWithLook(lookPreset));
        } else {
          setStatus(captureStatus.savedVideoLookSkipped(lookPreset));
        }
        setPostCaptureOpen(true);
      } catch (error) {
        const message = errorMessage(error, 'Save failed');
        console.warn('[iris] video save failed', error);
        setStatus(message);
      } finally {
        recorderRef.current = null;
        stoppingRef.current = false;
        endCapture();
        setPhase('idle');
      }
    },
    [
      addCapture,
      beginCapture,
      endCapture,
      setPostCaptureOpen,
      setStatus,
      settings.lookId,
      settings.lookStrength,
    ],
  );

  const startRecording = useCallback(async () => {
    if (!sessionReady || phase !== 'idle' || stoppingRef.current) {
      if (!sessionReady) setStatus(captureStatus.cameraWarmingUp());
      return;
    }

    if (!mic.hasPermission) {
      if (!mic.canRequestPermission) {
        setStatus(captureStatus.enableMicrophoneInSettings());
        return;
      }
      const granted = await mic.requestPermission();
      if (!granted) {
        setStatus(captureStatus.microphoneNeededForVideo());
        return;
      }
      // Mic was just granted — ask the user to tap again so audio is wired.
      setStatus(captureStatus.microphoneReadyTapToRecord());
      return;
    }

    try {
      setStatus(captureStatus.recordingTapToStop());
      hapticRecordStart();
      const recorder = await videoOutput.createRecorder({});
      recorderRef.current = recorder;
      setPhase('recording');

      await recorder.startRecording(
        (filePath) => {
          finishRecording(filePath, look).catch((error) => {
            console.warn('[iris] finishRecording failed', error);
          });
        },
        (error) => {
          console.warn('[iris] recording error', error);
          setStatus(error.message || 'Recording failed');
          recorderRef.current = null;
          stoppingRef.current = false;
          endCapture();
          setPhase('idle');
        },
      );
    } catch (error) {
      const message = errorMessage(error, 'Could not start recording');
      console.warn('[iris] startRecording failed', error);
      setStatus(message);
      recorderRef.current = null;
      endCapture();
      setPhase('idle');
    }
  }, [
    endCapture,
    finishRecording,
    look,
    mic.canRequestPermission,
    mic.hasPermission,
    mic.requestPermission,
    phase,
    sessionReady,
    setStatus,
    videoOutput,
  ]);

  const stopRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || stoppingRef.current || phase !== 'recording') return;

    stoppingRef.current = true;
    setPhase('stopping');
    beginCapture();
    setStatus(captureStatus.stoppingRecording());
    hapticRecordStop();
    try {
      await recorder.stopRecording();
    } catch (error) {
      const message = errorMessage(error, 'Stop failed');
      console.warn('[iris] stopRecording failed', error);
      setStatus(message);
      recorderRef.current = null;
      stoppingRef.current = false;
      endCapture();
      setPhase('idle');
    }
  }, [beginCapture, endCapture, phase, setStatus]);

  useEffect(() => {
    if (shouldStopOnInactive && isRecording) {
      stopRecording().catch((error) => {
        console.warn('[iris] stopRecording effect failed', error);
      });
    }
  }, [isRecording, shouldStopOnInactive, stopRecording]);

  useEffect(() => {
    return () => {
      cancelBakeLookIntoVideo();
    };
  }, []);

  return {
    isCapturing,
    isRecording,
    startRecording,
    stopRecording,
  };
}

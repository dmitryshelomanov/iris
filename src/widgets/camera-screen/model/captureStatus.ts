import type { LookPreset } from '@/features/camera';

export const captureStatus = {
  cameraWarmingUp: () => 'Camera warming up…',
  capturingPhoto: () => 'Capturing…',
  applyingLook: () => 'Applying look…',
  burstStart: (burstCount: number) => `Burst ${burstCount}×…`,
  burstProgress: (index: number, total: number) => `Burst ${index}/${total}…`,
  savedPhoto: (burstCount: number, look: LookPreset) =>
    burstCount > 1
      ? `Saved ${burstCount} · ${look.label} · ${look.hint}`
      : `Saved · ${look.label} · ${look.hint}`,
  timerCancelled: () => 'Timer cancelled',
  enableMicrophoneInSettings: () => 'Enable microphone in Settings',
  microphoneNeededForVideo: () => 'Microphone needed for video',
  microphoneReadyTapToRecord: () => 'Mic ready — audio on · tap to record',
  recordingTapToStop: () => 'Recording… · tap to stop',
  stoppingRecording: () => 'Stopping…',
  savingVideo: () => 'Saving video…',
  savedVideoNoLook: () => 'Saved to Photos',
  savedVideoWithLook: (look: LookPreset) => `Saved · ${look.label} · ${look.hint}`,
  savedVideoLookSkipped: (look: LookPreset) => `Saved · look skipped (${look.label})`,
} as const;

import type { LookPreset } from '@/features/camera';

/** Structured bake / capture processing phase for BakeOverlay. */
export type BakePhase =
  | { id: 'capturing' }
  | { id: 'burst'; index: number; total: number }
  | { id: 'applyingLook' }
  | { id: 'applyingAnime'; index?: number; total?: number }
  | { id: 'saving' };

export function bakePhaseLabel(phase: BakePhase): string {
  switch (phase.id) {
    case 'capturing':
      return 'Capturing…';
    case 'burst':
      return `Burst ${phase.index}/${phase.total}…`;
    case 'applyingLook':
      return 'Applying look…';
    case 'applyingAnime':
      return phase.index != null && phase.total != null
        ? `Anime stylizing ${phase.index}/${phase.total}…`
        : 'Anime stylizing…';
    case 'saving':
      return 'Saving…';
  }
}

export const captureStatus = {
  cameraWarmingUp: () => 'Camera warming up…',
  capturingPhoto: () => 'Capturing…',
  applyingLook: () => 'Applying look…',
  applyingAnimeLook: () => 'Anime stylizing…',
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
  animeMlPhotoOnly: () => 'Anime ML is photo only',
} as const;

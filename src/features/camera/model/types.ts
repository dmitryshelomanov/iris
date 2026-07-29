import type {
  DeviceType,
  FlashMode,
  MirrorMode,
  QualityPrioritization,
} from 'react-native-vision-camera';
import type { CameraDevice } from 'react-native-vision-camera';

export type CaptureMode = 'photo' | 'video';

export type ManualControlId = 'iso' | 'shutter' | 'wb' | 'tint' | 'focus' | 'ev';

export type AspectRatio = '4:3' | '16:9';

export type TimerSeconds = 0 | 3 | 10;

/** Explicit FPS or highest supported ≤ 60 (avoids slo-mo 120/240 formats). */
export type VideoFpsOption = 30 | 60 | 'max';

export type LookPresetId =
  'none' | 'kp' | 'kg' | 'ke' | 'fs' | 'fp' | 'ag' | 'as' | 'pd' | 'tc' | 'tx' | 'tn' | 'cm' | 'pp';

export type LensKind = 'optical' | 'crop' | 'front' | 'multi';

export type LensId = string;

export interface LensOption {
  id: LensId;
  /** Chip label, e.g. `24mm` or `Front` */
  label: string;
  hint: string;
  device: CameraDevice;
  /** Zoom to apply when selecting this lens option */
  zoom: number;
  position: 'front' | 'back';
  deviceType: DeviceType;
  focalLengthMm?: number;
  kind: LensKind;
  /** True when this is the sensor's native (uncropped) focal length */
  isNative: boolean;
}

export interface ManualControlsState {
  enabled: boolean;
  activeControl: ManualControlId;
  iso: number;
  /** Shutter speed in seconds (e.g. 1/60 ≈ 0.0167) */
  shutter: number;
  /** White balance temperature Kelvin */
  wbKelvin: number;
  /** Green/magenta tint (−150…150) */
  wbTint: number;
  /** Manual focus lens position 0..1 */
  focus: number;
  /** Exposure bias in EV */
  ev: number;
}

export const DEFAULT_MANUAL_STATE: ManualControlsState = {
  enabled: false,
  activeControl: 'ev',
  iso: 100,
  shutter: 1 / 60,
  wbKelvin: 5500,
  wbTint: 0,
  focus: 0.5,
  ev: 0,
};

export interface CaptureSettings {
  flashMode: FlashMode;
  torchOn: boolean;
  timerSeconds: TimerSeconds;
  aspect: AspectRatio;
  lookId: LookPresetId;
  /** 0…1 look overlay strength (baked into files) */
  lookStrength: number;
  qualityPrioritization: QualityPrioritization;
  jpegQuality: number;
  mirrorMode: MirrorMode;
  lowLightBoost: boolean;
  photoHDR: boolean;
  shutterSound: boolean;
  distortionCorrection: boolean;
  /** System EIS for video capture (strongest supported VisionCamera mode). */
  videoStabilization: boolean;
  /** Target video frame rate (applied as VisionCamera `{ fps }` constraint). */
  videoFps: VideoFpsOption;
  showCrosshair: boolean;
  showGrid: boolean;
  showLevel: boolean;
  showPeaking: boolean;
  volumeShutter: boolean;
  /** Photo burst count when shutter is held / burst mode (1 = single). */
  burstCount: 1 | 3 | 5;
  /** Show aspect crop mask on preview */
  showAspectCrop: boolean;
}

export const DEFAULT_CAPTURE_SETTINGS: CaptureSettings = {
  flashMode: 'off',
  torchOn: false,
  timerSeconds: 0,
  aspect: '4:3',
  lookId: 'none',
  lookStrength: 1,
  qualityPrioritization: 'quality',
  jpegQuality: 0.95,
  mirrorMode: 'auto',
  lowLightBoost: false,
  photoHDR: false,
  shutterSound: true,
  distortionCorrection: false,
  videoStabilization: true,
  videoFps: 'max',
  showCrosshair: false,
  showGrid: false,
  showLevel: false,
  showPeaking: false,
  volumeShutter: true,
  burstCount: 1,
  showAspectCrop: true,
};

/** Keys persisted across launches (session flash/torch stay ephemeral). */
export const PERSISTED_CAPTURE_KEYS = [
  'timerSeconds',
  'aspect',
  'lookId',
  'lookStrength',
  'qualityPrioritization',
  'jpegQuality',
  'mirrorMode',
  'lowLightBoost',
  'photoHDR',
  'shutterSound',
  'distortionCorrection',
  'videoStabilization',
  'videoFps',
  'showCrosshair',
  'showGrid',
  'showLevel',
  'showPeaking',
  'volumeShutter',
  'burstCount',
  'showAspectCrop',
] as const satisfies readonly (keyof CaptureSettings)[];

export interface CameraCapabilities {
  minZoom: number;
  maxZoom: number;
  hasFlash: boolean;
  hasTorch: boolean;
  supportsManualISO: boolean;
  supportsManualShutter: boolean;
  supportsManualFocus: boolean;
  supportsWhiteBalance: boolean;
  supportsExposureBias: boolean;
  supportsLowLightBoost: boolean;
  supportsDistortionCorrection: boolean;
  supportsPhotoHDR: boolean;
  supportsVideoStabilization: boolean;
  supportsSpeedQuality: boolean;
  minExposureBias: number;
  maxExposureBias: number;
}

export function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || (min === 0 && max === 0)) {
    return value;
  }
  return Math.min(max, Math.max(min, value));
}

export { clamp, DEFAULT_MANUAL_STATE, DEFAULT_CAPTURE_SETTINGS } from './types';
export type {
  CameraCapabilities,
  CaptureMode,
  CaptureSettings,
  AspectRatio,
  TimerSeconds,
  VideoFpsOption,
  LensId,
  LensKind,
  LensOption,
  LookPresetId,
  ManualControlId,
  ManualControlsState,
} from './types';
export {
  buildCapabilities,
  buildLensCatalog,
  buildZoomDialMajors,
  buildZoomSnapPoints,
  buildZoomSteps,
  displayBaseZoom,
  formatZoomFactor,
  formatZoomLabel,
  formatZoomMm,
  pickPrimaryBackDevice,
  toDisplayZoom,
  zoomRange,
  ZOOM_UI_MAX,
} from './lenses';
export { resolveVideoFps } from './videoFps';
export {
  LOOK_PRESETS,
  getLookPreset,
  applyLookToManual,
  formatLookStampDate,
  isLookPresetId,
} from './presets';
export type { LookPreset, LookOverlay } from './presets';
export { applyManualToController, seedManualFromController } from './applyManual';
export {
  defaultPresetName,
  deleteCapturePreset,
  ensureScenePresets,
  loadCapturePresets,
  renameCapturePreset,
  saveCapturePreset,
} from './capturePresets';
export type { CameraPreset } from './capturePresets';
export { CaptureSettingsProvider, useCaptureSettings } from './CaptureSettingsContext';
export { resolutionForAspect, videoResolutionForAspect } from './resolutions';
export { bakeLookIntoPhoto } from './bakeLook';
export type { BakeLookResult } from './bakeLook';
export { bakeLookIntoVideo } from './bakeLookVideo';
export type { BakeVideoLookResult } from './bakeLookVideo';
export { buildGradeMatrix } from './gradeMatrix';
export { needsToonPass } from './toonBake';
export { peakingIntensity } from './liveMetering';
export { LOOK_SCENES, looksForScene } from './lookScenes';
export type { LookSceneId } from './lookScenes';
export { useVolumeShutter } from './useVolumeShutter';
export {
  hapticShutter,
  hapticFocusLock,
  hapticRecordStart,
  hapticRecordStop,
  hapticSelect,
  hapticLevelSnap,
} from './haptics';

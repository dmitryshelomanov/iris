export { clamp, DEFAULT_MANUAL_STATE, DEFAULT_CAPTURE_SETTINGS } from './model/types';
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
} from './model/types';
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
} from './model/lenses';
export { resolveVideoFps } from './model/videoFps';
export {
  LOOK_PRESETS,
  getLookPreset,
  applyLookToManual,
  formatLookStampDate,
  isLookPresetId,
} from './model/presets';
export type { LookPreset, LookOverlay as LookOverlayConfig } from './model/presets';
export { applyManualToController, seedManualFromController } from './model/applyManual';
export {
  defaultPresetName,
  deleteCapturePreset,
  ensureScenePresets,
  loadCapturePresets,
  renameCapturePreset,
  saveCapturePreset,
} from './model/capturePresets';
export type { CameraPreset } from './model/capturePresets';
export { CaptureSettingsProvider, useCaptureSettings } from './model/CaptureSettingsContext';
export { resolutionForAspect, videoResolutionForAspect } from './model/resolutions';
export { bakeLookIntoPhoto } from './model/bakeLook';
export type { BakeLookResult } from './model/bakeLook';
export { bakeLookIntoVideo } from './model/bakeLookVideo';
export type { BakeVideoLookResult } from './model/bakeLookVideo';
export { peakingIntensity } from './model/liveMetering';
export { LOOK_SCENES, looksForScene } from './model/lookScenes';
export type { LookSceneId } from './model/lookScenes';
export { useVolumeShutter } from './model/useVolumeShutter';
export {
  hapticShutter,
  hapticFocusLock,
  hapticRecordStart,
  hapticRecordStop,
  hapticSelect,
  hapticLevelSnap,
} from './model/haptics';

export { CaptureButton } from './ui/CaptureButton';
export { CameraPresetsDialog } from './ui/CameraPresetsDialog';
export { CaptureToolbar } from './ui/CaptureToolbar';
export { CountdownOverlay } from './ui/CountdownOverlay';
export { GridOverlay } from './ui/GridOverlay';
export { LensSwitcher } from './ui/LensSwitcher';
export { LevelOverlay } from './ui/LevelOverlay';
export { LookOverlay } from './ui/LookOverlay';
export { LookPresets, LookStrengthSlider } from './ui/LookPresets';
export { ManualControls } from './ui/ManualControls';
export { ModeToggle } from './ui/ModeToggle';
export { StabilizationCrosshairOverlay } from './ui/StabilizationCrosshairOverlay';
export { ZoomSwitcher } from './ui/ZoomSwitcher';
export { AspectCropOverlay } from './ui/AspectCropOverlay';
export { FocusReticle } from './ui/FocusReticle';
export type { FocusReticleState } from './ui/FocusReticle';
export { PeakingOverlay } from './ui/PeakingOverlay';
export { ScenePresetChips } from './ui/ScenePresetChips';

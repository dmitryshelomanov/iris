import type { CameraDevice, TargetStabilizationMode } from 'react-native-vision-camera';

/** Strongest → weakest video EIS. Never use `auto` — on Android it leaves EIS unspecified. */
const VIDEO_STAB_PRIORITY = [
  'cinematic-extended-enhanced',
  'cinematic-extended',
  'cinematic',
  'standard',
] as const satisfies readonly TargetStabilizationMode[];

/** Preview-friendly modes (not cinematic — those add heavy latency to the live view). */
const PREVIEW_STAB_PRIORITY = [
  'preview-optimized',
  'standard',
] as const satisfies readonly TargetStabilizationMode[];

/**
 * Best video stabilization mode for recording, or `undefined` if none are supported.
 */
export function resolveVideoStabilizationMode(
  device: CameraDevice | undefined,
): TargetStabilizationMode | undefined {
  if (!device) return undefined;
  for (const mode of VIDEO_STAB_PRIORITY) {
    if (device.supportsVideoStabilizationMode(mode)) return mode;
  }
  return undefined;
}

/**
 * Best preview stabilization mode, or `undefined` if none are supported.
 */
export function resolvePreviewStabilizationMode(
  device: CameraDevice | undefined,
): TargetStabilizationMode | undefined {
  if (!device) return undefined;
  for (const mode of PREVIEW_STAB_PRIORITY) {
    if (device.supportsPreviewStabilizationMode(mode)) return mode;
  }
  return undefined;
}

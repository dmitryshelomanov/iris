import type { CameraDevice } from 'react-native-vision-camera';

import type { VideoFpsOption } from './types';

/** Cap "max" at cinematic/video rates — higher ranges are usually slo-mo only. */
const VIDEO_FPS_CAP = 60;

type ResolveVideoFpsOptions = {
  /**
   * When true and preference is `'max'`, prefer 30 over 60 so cinematic EIS
   * stays available (strong modes often drop out at 60 fps).
   */
  preferStabilization?: boolean;
};

/**
 * Resolve a VisionCamera `{ fps }` target from settings + device ranges.
 * Returns `undefined` when nothing sensible can be requested.
 */
export function resolveVideoFps(
  device: CameraDevice | undefined,
  preference: VideoFpsOption,
  options?: ResolveVideoFpsOptions,
): number | undefined {
  if (!device) return undefined;

  if (preference !== 'max') {
    if (device.supportsFPS(preference)) return preference;
    // Fall through to best available if the preferred rate isn't listed alone.
  }

  const candidates =
    preference === 'max' && options?.preferStabilization
      ? ([30, 24, 60] as const)
      : ([60, 30, 24] as const);
  for (const fps of candidates) {
    if (fps > VIDEO_FPS_CAP) continue;
    if (preference !== 'max' && fps > preference) continue;
    if (device.supportsFPS(fps)) return fps;
  }

  let best = 0;
  for (const range of device.supportedFPSRanges) {
    const hi = Math.min(Math.floor(range.max), VIDEO_FPS_CAP);
    if (hi > best) best = hi;
  }
  return best > 0 ? best : undefined;
}

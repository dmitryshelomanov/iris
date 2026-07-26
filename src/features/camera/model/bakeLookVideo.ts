import { Platform } from 'react-native';

import IrisLookBake from '../../../../modules/iris-look-bake';
import type { LookOverlay } from './presets';
import { formatLookStampDate } from './presets';
import { buildGradeMatrix, hexToRgbaTuple, needsLookBake } from './gradeMatrix';

export type BakeVideoLookResult = {
  path: string;
  uri: string;
  baked: boolean;
};

function toPath(path: string) {
  return path.replace(/^file:\/\//, '');
}

function toFileUri(path: string) {
  return path.startsWith('file://') ? path : `file://${path}`;
}

/**
 * Bake the active look into a recorded video (AVFoundation + Core Image on iOS).
 * Returns the original file when Native / strength is zero, or on unsupported platforms.
 */
export async function bakeLookIntoVideo(
  inputPath: string,
  overlay: LookOverlay,
  options: { strength?: number } = {},
): Promise<BakeVideoLookResult> {
  const strength = options.strength ?? 1;
  const path = toPath(inputPath);
  const uri = toFileUri(path);

  if (!needsLookBake(overlay, strength)) {
    return { path, uri, baked: false };
  }

  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return { path, uri, baked: false };
  }

  const matrix = buildGradeMatrix(overlay, strength);
  const result = await IrisLookBake.bakeLookIntoVideo(path, {
    matrix,
    tint: hexToRgbaTuple(overlay.color, overlay.opacity * strength),
    shadows: hexToRgbaTuple(overlay.shadows, overlay.shadowsOpacity * strength),
    highlights: hexToRgbaTuple(overlay.highlights, overlay.highlightsOpacity * strength),
    vignette: overlay.vignette * strength,
    grain: overlay.grain * strength,
    bloom: overlay.bloom * strength,
    leak: overlay.leak * strength,
    stamp: overlay.stamp * strength,
    stampText: formatLookStampDate(),
  });

  return {
    path: toPath(result.path),
    uri: toFileUri(result.uri ?? result.path),
    baked: result.baked ?? true,
  };
}

import { Platform } from 'react-native';

import IrisLookBake from '../../../../modules/iris-look-bake';
import type { AnimeMlStyle } from '../../../../modules/iris-look-bake';

import { toFileUri, toPath } from './bakeLookVideo';
import type { LookMlStyle } from './types';

export type StylizePhotoResult = {
  path: string;
  uri: string;
};

const LOOK_ML_STYLES: readonly LookMlStyle[] = ['animegan-v3-shinkai', 'animegan-v3-hayao'];

/** Legacy AnimeGANv2 ids → current v3 (Paprika folded into Shinkai). */
const LEGACY_ML_STYLES: Record<string, LookMlStyle> = {
  'animegan-v2-shinkai': 'animegan-v3-shinkai',
  'animegan-v2-hayao': 'animegan-v3-hayao',
  'animegan-v2-paprika': 'animegan-v3-shinkai',
};

export function isLookMlStyle(value: unknown): value is LookMlStyle {
  if (typeof value !== 'string') return false;
  if ((LOOK_ML_STYLES as readonly string[]).includes(value)) return true;
  return value in LEGACY_ML_STYLES;
}

function resolveMlStyle(style: LookMlStyle | AnimeMlStyle | string): AnimeMlStyle {
  if ((LOOK_ML_STYLES as readonly string[]).includes(style)) {
    return style as AnimeMlStyle;
  }
  return LEGACY_ML_STYLES[style] ?? 'animegan-v3-shinkai';
}

/**
 * On-device AnimeGANv3 photo stylization (native ONNX).
 * Passthrough on web / unsupported platforms.
 */
export async function stylizePhotoWithMl(
  inputPath: string,
  options: { style: LookMlStyle | AnimeMlStyle; strength?: number },
): Promise<StylizePhotoResult> {
  const path = toPath(inputPath);
  const uri = toFileUri(path);
  const strength = options.strength ?? 1;

  if (strength <= 0.01 || Platform.OS === 'web') {
    return { path, uri };
  }

  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return { path, uri };
  }

  const result = await IrisLookBake.stylizePhoto(path, {
    style: resolveMlStyle(options.style),
    strength,
  });
  return {
    path: toPath(result.path),
    uri: toFileUri(result.uri ?? result.path),
  };
}

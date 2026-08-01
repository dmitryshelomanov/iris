import { bakeLookIntoPhoto, type BakeLookResult } from './bakeLook';
import {
  bakeStrengthForLook,
  getLookPreset,
  resolveLookPresetId,
  type LookPreset,
} from './presets';
import type { LookPresetId } from './types';

export type BakePhotoWithLookOptions = {
  lookId: LookPresetId | string;
  lookStrength: number;
  jpegQuality?: number;
};

export type BakePhotoWithLookResult = {
  baked: BakeLookResult;
  lookId: LookPresetId;
  bakeStrength: number;
  look: LookPreset;
};

/**
 * Resolve look → strength → bakeLookIntoPhoto.
 * Shared by capture, rebake, and gallery import.
 */
export async function bakePhotoWithLook(
  masterUri: string,
  options: BakePhotoWithLookOptions,
): Promise<BakePhotoWithLookResult> {
  const lookId = resolveLookPresetId(options.lookId);
  if (!lookId) {
    throw new Error('Unknown look');
  }

  const look = getLookPreset(lookId);
  const bakeStrength = bakeStrengthForLook(look, options.lookStrength);
  const baked = await bakeLookIntoPhoto(masterUri, look.overlay, {
    strength: bakeStrength,
    jpegQuality: options.jpegQuality ?? 0.95,
    mlStyle: look.mlStyle ?? null,
  });

  return { baked, lookId, bakeStrength, look };
}

import {
  fileUriExists,
  loadRecents,
  savePhotoToLibrary,
  updateRecent,
  type RecentCapture,
} from '@/entities/capture';
import {
  bakeLookIntoPhoto,
  getLookPreset,
  isLookPresetId,
  type LookPresetId,
} from '@/features/camera';

export type RebakeLookOptions = {
  lookId: LookPresetId;
  lookStrength: number;
  jpegQuality?: number;
};

/**
 * Re-grade a photo recent from its durable master and update the recents index.
 * Saves a new Photos asset; keeps the same master for further A/B / re-bake.
 */
export async function rebakeLook(
  recentId: string,
  options: RebakeLookOptions,
): Promise<RecentCapture> {
  const list = await loadRecents();
  const entry = list.find((r) => r.id === recentId);
  if (!entry) throw new Error('Capture not found');
  if (entry.kind !== 'photo') throw new Error('Re-bake is photo-only');
  if (!entry.rawUri || !fileUriExists(entry.rawUri)) {
    throw new Error('Master missing — cannot re-bake');
  }
  if (!isLookPresetId(options.lookId)) {
    throw new Error('Unknown look');
  }

  const look = getLookPreset(options.lookId);
  const baked = await bakeLookIntoPhoto(entry.rawUri, look.overlay, {
    strength: options.lookStrength,
    jpegQuality: options.jpegQuality ?? 0.95,
  });

  await savePhotoToLibrary(baked.uri);

  const nextList = await updateRecent(recentId, {
    uri: baked.uri,
    lookId: options.lookId,
    lookStrength: options.lookStrength,
    histogram: baked.histogram,
  });

  const updated = nextList.find((r) => r.id === recentId);
  if (!updated) throw new Error('Failed to update capture');
  return updated;
}

import {
  deleteLibraryAssets,
  fileUriExists,
  loadRecents,
  savePhotoToLibrary,
  saveVideoToLibrary,
  updateRecent,
  type RecentCapture,
} from '@/entities/capture';
import {
  bakeLookIntoPhoto,
  bakeLookIntoVideo,
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
 * Re-grade a recent from its durable master and update the recents index.
 * Photos: Skia bake → new Photos asset.
 * Videos: native bake → new Photos asset.
 * Keeps the same master for further A/B / re-bake.
 */
export async function rebakeLook(
  recentId: string,
  options: RebakeLookOptions,
): Promise<RecentCapture> {
  const list = await loadRecents();
  const entry = list.find((r) => r.id === recentId);
  if (!entry) throw new Error('Capture not found');
  if (!entry.rawUri || !fileUriExists(entry.rawUri)) {
    throw new Error('Master missing — cannot re-bake');
  }
  if (!isLookPresetId(options.lookId)) {
    throw new Error('Unknown look');
  }

  const look = getLookPreset(options.lookId);
  const previousLibraryAssetId = entry.libraryAssetId;

  if (entry.kind === 'photo') {
    const baked = await bakeLookIntoPhoto(entry.rawUri, look.overlay, {
      strength: options.lookStrength,
      jpegQuality: options.jpegQuality ?? 0.95,
    });
    const asset = await savePhotoToLibrary(baked.uri);
    const nextList = await updateRecent(recentId, {
      uri: baked.uri,
      libraryAssetId: asset.id,
      lookId: options.lookId,
      lookStrength: options.lookStrength,
      histogram: baked.histogram,
    });
    if (previousLibraryAssetId && previousLibraryAssetId !== asset.id) {
      await deleteLibraryAssets([previousLibraryAssetId]);
    }
    const updated = nextList.find((r) => r.id === recentId);
    if (!updated) throw new Error('Failed to update capture');
    return updated;
  }

  if (entry.kind === 'video') {
    const baked = await bakeLookIntoVideo(entry.rawUri, look.overlay, {
      strength: options.lookStrength,
    });
    if (options.lookId !== 'none' && !baked.baked) {
      throw new Error('Video look bake failed');
    }
    const asset = await saveVideoToLibrary(baked.path);
    const nextList = await updateRecent(recentId, {
      uri: baked.uri,
      libraryAssetId: asset.id,
      lookId: options.lookId,
      lookStrength: options.lookStrength,
    });
    if (previousLibraryAssetId && previousLibraryAssetId !== asset.id) {
      await deleteLibraryAssets([previousLibraryAssetId]);
    }
    const updated = nextList.find((r) => r.id === recentId);
    if (!updated) throw new Error('Failed to update capture');
    return updated;
  }

  throw new Error('Unsupported capture kind');
}

import {
  fileUriExists,
  loadRecents,
  pushRecent,
  savePhotoToLibrary,
  saveVideoToLibrary,
  type RecentCapture,
} from '@/entities/capture';
import {
  bakeLookIntoVideo,
  bakePhotoWithLook,
  bakeStrengthForLook,
  getLookPreset,
  isAnimeMlLook,
  resolveLookPresetId,
  type LookPresetId,
} from '@/features/camera';

export type RebakeLookOptions = {
  lookId: LookPresetId;
  lookStrength: number;
  jpegQuality?: number;
};

/**
 * Re-grade a recent from its durable master and append a new gallery entry.
 * Keeps the source capture + Photos asset; shares the same master for A/B / further re-bake.
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
  const lookId = resolveLookPresetId(options.lookId);
  if (!lookId) {
    throw new Error('Unknown look');
  }

  const look = getLookPreset(lookId);
  const bakeStrength = bakeStrengthForLook(look, options.lookStrength);

  if (entry.kind === 'photo') {
    const {
      baked,
      lookId: resolvedLookId,
      bakeStrength: resolvedStrength,
    } = await bakePhotoWithLook(entry.rawUri, {
      lookId,
      lookStrength: options.lookStrength,
      jpegQuality: options.jpegQuality,
    });
    const asset = await savePhotoToLibrary(baked.uri);
    const nextList = await pushRecent({
      uri: baked.uri,
      rawUri: entry.rawUri,
      libraryAssetId: asset.id,
      kind: 'photo',
      lookId: resolvedLookId,
      lookStrength: resolvedStrength,
      histogram: baked.histogram,
      meta: entry.meta,
    });
    const created = nextList[0];
    if (!created || created.uri !== baked.uri) throw new Error('Failed to save re-bake');
    return created;
  }

  if (entry.kind === 'video') {
    if (isAnimeMlLook(look)) {
      throw new Error('Anime ML is photo only');
    }
    const baked = await bakeLookIntoVideo(entry.rawUri, look.overlay, {
      strength: bakeStrength,
    });
    if (lookId !== 'none' && !baked.baked) {
      throw new Error('Video look bake failed');
    }
    const asset = await saveVideoToLibrary(baked.path);
    const nextList = await pushRecent({
      uri: baked.uri,
      rawUri: entry.rawUri,
      libraryAssetId: asset.id,
      kind: 'video',
      lookId,
      lookStrength: bakeStrength,
      meta: entry.meta,
    });
    const created = nextList[0];
    if (!created || created.uri !== baked.uri) throw new Error('Failed to save re-bake');
    return created;
  }

  throw new Error('Unsupported capture kind');
}

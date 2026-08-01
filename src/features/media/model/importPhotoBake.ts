import * as ImagePicker from 'expo-image-picker';

import { persistPhotoMaster, savePhotoToLibrary, type RecentCapture } from '@/entities/capture';
import { bakePhotoWithLook, type LookPresetId } from '@/features/camera';

export type ImportPhotoBakeOptions = {
  lookId: LookPresetId;
  lookStrength: number;
  jpegQuality?: number;
};

export type ImportedPhotoCapture = Omit<RecentCapture, 'id' | 'createdAt'> & { id: string };

/**
 * Open the system photo library and return a local file URI, or null if cancelled.
 */
export async function pickLibraryPhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photos permission is required to import');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
    exif: false,
  });

  if (result.canceled || !result.assets[0]?.uri) return null;
  return result.assets[0].uri;
}

/**
 * Copy a picked photo into a durable master, bake a look, and save to the Photos library.
 * Returns fields ready for `addCapture` (including a pre-generated id).
 */
export async function bakeImportedPhoto(
  sourceUri: string,
  options: ImportPhotoBakeOptions,
): Promise<ImportedPhotoCapture> {
  const masterUri = await persistPhotoMaster(sourceUri);
  const { baked, lookId, bakeStrength } = await bakePhotoWithLook(masterUri, {
    lookId: options.lookId,
    lookStrength: options.lookStrength,
    jpegQuality: options.jpegQuality,
  });
  const asset = await savePhotoToLibrary(baked.uri);

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    uri: baked.uri,
    rawUri: masterUri,
    libraryAssetId: asset.id,
    kind: 'photo',
    lookId,
    lookStrength: bakeStrength,
    histogram: baked.histogram,
    meta: { lensLabel: 'Import' },
  };
}

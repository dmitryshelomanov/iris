import AsyncStorage from '@react-native-async-storage/async-storage';
import { Album, Asset, getPermissionsAsync, requestPermissionsAsync } from 'expo-media-library';

const IRIS_ALBUM = 'Iris';
const IRIS_ALBUM_ID_KEY = 'iris.album.id';

function toFileUri(path: string) {
  return path.startsWith('file://') ? path : `file://${path}`;
}

async function ensureLibraryPermission() {
  // Full library access — needed to delete assets and check whether they still exist.
  // Album id is still cached to avoid relying on Album.get(title).
  const permission = await requestPermissionsAsync(false);
  if (!permission.granted) {
    throw new Error('Allow Photos access to save captures');
  }
  return permission;
}

/** Full read access is required for reliable asset-existence pruning. */
export async function hasFullLibraryAccess(): Promise<boolean> {
  try {
    const permission = await getPermissionsAsync(false);
    if (!permission.granted) return false;
    const access = (permission as { accessPrivileges?: string }).accessPrivileges;
    // Older platforms may not report accessPrivileges.
    return access == null || access === 'all';
  } catch {
    return false;
  }
}

async function saveToIrisAlbum(uri: string): Promise<Asset> {
  const cachedId = await AsyncStorage.getItem(IRIS_ALBUM_ID_KEY);
  if (cachedId) {
    try {
      return await Asset.create(uri, new Album(cachedId));
    } catch {
      await AsyncStorage.removeItem(IRIS_ALBUM_ID_KEY);
    }
  }

  try {
    const album = await Album.create(IRIS_ALBUM, [uri]);
    await AsyncStorage.setItem(IRIS_ALBUM_ID_KEY, album.id);
    const assets = await album.getAssets();
    if (assets[0]) return assets[0];
  } catch {
    // Album may already exist from a prior install without cached id.
  }

  return Asset.create(uri);
}

/** Save into Photos, preferring the Iris album when possible. */
export async function savePhotoToLibrary(filePath: string): Promise<Asset> {
  await ensureLibraryPermission();
  return saveToIrisAlbum(toFileUri(filePath));
}

/** Save a recorded video into the Iris album / Photos library. */
export async function saveVideoToLibrary(filePath: string): Promise<Asset> {
  await ensureLibraryPermission();
  return saveToIrisAlbum(toFileUri(filePath));
}

/** Best-effort delete of Photos assets by id (missing permission / already gone = no-op). */
export async function deleteLibraryAssets(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return;
  try {
    await Asset.delete(unique.map((id) => new Asset(id)));
  } catch {
    // Permission denied, asset already gone, or limited library — ignore.
  }
}

/** Whether a Photos asset still exists and is readable by this app. */
export async function libraryAssetExists(id: string): Promise<boolean> {
  if (!id) return false;
  try {
    await new Asset(id).getFilename();
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    // "Missing" is expected and should prune; permission/system failures should bubble.
    if (
      message.includes('not found') ||
      message.includes('does not exist') ||
      message.includes('no asset')
    ) {
      return false;
    }
    throw error;
  }
}

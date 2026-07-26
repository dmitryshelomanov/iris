import AsyncStorage from '@react-native-async-storage/async-storage';
import { Album, Asset, requestPermissionsAsync } from 'expo-media-library';

const IRIS_ALBUM = 'Iris';
const IRIS_ALBUM_ID_KEY = 'iris.album.id';

function toFileUri(path: string) {
  return path.startsWith('file://') ? path : `file://${path}`;
}

async function ensureLibraryWritePermission() {
  // writeOnly — enough to add to the Camera Roll / create albums from file paths.
  // Avoid Album.get(title) under write-only; we cache album id instead.
  const permission = await requestPermissionsAsync(true);
  if (!permission.granted) {
    throw new Error('Allow Photos access to save captures');
  }
  return permission;
}

async function saveToIrisAlbum(uri: string) {
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
export async function savePhotoToLibrary(filePath: string) {
  await ensureLibraryWritePermission();
  return saveToIrisAlbum(toFileUri(filePath));
}

/** Save a recorded video into the Iris album / Photos library. */
export async function saveVideoToLibrary(filePath: string) {
  await ensureLibraryWritePermission();
  return saveToIrisAlbum(toFileUri(filePath));
}

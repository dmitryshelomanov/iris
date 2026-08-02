import AsyncStorage from '@react-native-async-storage/async-storage';

import { deleteLibraryAssets, hasFullLibraryAccess, libraryAssetExists } from '../api/library';
import { deleteAppDocumentFile } from '../api/masters';

const RECENTS_KEY_V1 = 'iris.recents.v1';
const RECENTS_KEY = 'iris.recents.v2';
const MAX_RECENTS = 40;

export type CaptureMeta = {
  lensLabel?: string;
  focalLengthMm?: number;
  iso?: number;
  shutter?: number;
  ev?: number;
  wbKelvin?: number;
};

export type RecentCapture = {
  id: string;
  uri: string;
  /** Durable pre-bake master for before/after + re-bake (photo JPEG / video MP4). */
  rawUri?: string;
  /** Photos / MediaLibrary asset id from the last export (for bidirectional delete sync). */
  libraryAssetId?: string;
  kind: 'photo' | 'video';
  createdAt: number;
  lookId?: string;
  lookStrength?: number;
  /** Custom grain / diffusion dials from last bake (hydrates LookBakeSheet). */
  overlayPatch?: {
    grain?: number;
    grainSize?: number;
    grainTexture?: number;
    grainBlur?: number;
  };
  histogram?: number[];
  favorite?: boolean;
  meta?: CaptureMeta;
};

function normalizeEntry(raw: Partial<RecentCapture> & { uri?: string }): RecentCapture | null {
  if (!raw?.uri || (raw.kind !== 'photo' && raw.kind !== 'video')) return null;
  return {
    id: raw.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    uri: raw.uri,
    rawUri: raw.rawUri,
    libraryAssetId: raw.libraryAssetId,
    kind: raw.kind,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    lookId: raw.lookId,
    lookStrength: raw.lookStrength,
    overlayPatch: raw.overlayPatch,
    histogram: raw.histogram,
    favorite: raw.favorite,
    meta: raw.meta,
  };
}

async function persistList(list: RecentCapture[]) {
  await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(list));
}

export async function loadRecents(): Promise<RecentCapture[]> {
  try {
    let raw = await AsyncStorage.getItem(RECENTS_KEY);
    if (!raw) {
      raw = await AsyncStorage.getItem(RECENTS_KEY_V1);
      if (raw) {
        const migrated = parseList(raw);
        await persistList(migrated);
        await AsyncStorage.removeItem(RECENTS_KEY_V1);
        return migrated;
      }
      return [];
    }
    return parseList(raw);
  } catch {
    return [];
  }
}

function parseList(raw: string): RecentCapture[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeEntry(item as Partial<RecentCapture>))
      .filter((item): item is RecentCapture => item != null);
  } catch {
    return [];
  }
}

function deleteOwnedFiles(entry: RecentCapture, kept: RecentCapture[] = []) {
  // Masters can be shared across re-bakes — only unlink when unused.
  const rawStillUsed =
    !!entry.rawUri && kept.some((r) => r.rawUri === entry.rawUri || r.uri === entry.rawUri);
  if (entry.rawUri && !rawStillUsed) {
    deleteAppDocumentFile(entry.rawUri);
  }
  if (entry.uri !== entry.rawUri) {
    const uriStillUsed = kept.some((r) => r.uri === entry.uri || r.rawUri === entry.uri);
    if (!uriStillUsed) deleteAppDocumentFile(entry.uri);
  }
}

function collectLibraryAssetIds(entries: RecentCapture[]) {
  return entries
    .map((e) => e.libraryAssetId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
}

export async function pushRecent(entry: Omit<RecentCapture, 'id' | 'createdAt'> & { id?: string }) {
  const next = normalizeEntry({
    ...entry,
    id: entry.id,
    createdAt: Date.now(),
  });
  if (!next) throw new Error('Invalid recent capture');

  const prev = await loadRecents();
  const evicted = prev.filter((r) => r.uri === next.uri || r.id === next.id);
  const libraryIdsToDelete: string[] = [];
  const kept = prev.filter((r) => r.uri !== next.uri && r.id !== next.id);
  for (const old of evicted) {
    // Don't delete files still referenced by kept entries or the new entry.
    deleteOwnedFiles(old, [next, ...kept]);
    if (old.libraryAssetId && old.libraryAssetId !== next.libraryAssetId) {
      libraryIdsToDelete.push(old.libraryAssetId);
    }
  }

  const merged = [next, ...kept];
  const list = merged.slice(0, MAX_RECENTS);
  const overflow = merged.slice(MAX_RECENTS);
  for (const old of overflow) {
    deleteOwnedFiles(old, list);
  }
  libraryIdsToDelete.push(...collectLibraryAssetIds(overflow));
  await deleteLibraryAssets(libraryIdsToDelete);

  await persistList(list);
  return list;
}

export async function updateRecent(
  id: string,
  patch: Partial<Omit<RecentCapture, 'id' | 'createdAt'>>,
): Promise<RecentCapture[]> {
  const prev = await loadRecents();
  const list = prev.map((r) => {
    if (r.id !== id) return r;
    const previousUri = r.uri;
    const next: RecentCapture = {
      ...r,
      ...patch,
      id: r.id,
      createdAt: r.createdAt,
    };
    if (patch.uri && patch.uri !== previousUri && previousUri !== next.rawUri) {
      deleteAppDocumentFile(previousUri);
    }
    return next;
  });
  await persistList(list);
  return list;
}

export async function removeRecent(id: string) {
  return removeRecents([id]);
}

export async function removeRecents(ids: string[]) {
  if (ids.length === 0) return loadRecents();
  const idSet = new Set(ids);
  const prev = await loadRecents();
  const removed = prev.filter((r) => idSet.has(r.id));
  const list = prev.filter((r) => !idSet.has(r.id));
  await deleteLibraryAssets(collectLibraryAssetIds(removed));
  for (const entry of removed) {
    deleteOwnedFiles(entry, list);
  }
  await persistList(list);
  return list;
}

/**
 * Drop recents whose Photos assets were deleted outside the app.
 * Only clears sandbox + AsyncStorage — does not call Asset.delete.
 */
export async function pruneRecentsMissingLibraryAssets(): Promise<RecentCapture[]> {
  const prev = await loadRecents();
  // Limited/no Photos access cannot distinguish "deleted" from "not readable".
  if (!(await hasFullLibraryAccess())) return prev;

  const missingIds: string[] = [];

  try {
    await Promise.all(
      prev.map(async (entry) => {
        if (!entry.libraryAssetId) return;
        const exists = await libraryAssetExists(entry.libraryAssetId);
        if (!exists) missingIds.push(entry.id);
      }),
    );
  } catch {
    // Fail-open: permission/runtime hiccups should not wipe recents.
    return prev;
  }

  if (missingIds.length === 0) return prev;

  const missingSet = new Set(missingIds);
  const list = prev.filter((r) => !missingSet.has(r.id));
  for (const entry of prev) {
    if (missingSet.has(entry.id)) deleteOwnedFiles(entry, list);
  }
  await persistList(list);
  return list;
}

/**
 * Remove recents that match deleted Photos asset ids (from MediaLibrary listener).
 * Sandbox only — no Asset.delete.
 */
export async function removeRecentsByLibraryAssetIds(
  libraryAssetIds: string[],
): Promise<RecentCapture[]> {
  if (libraryAssetIds.length === 0) return loadRecents();
  const libSet = new Set(libraryAssetIds);
  const prev = await loadRecents();
  const removed = prev.filter((r) => r.libraryAssetId != null && libSet.has(r.libraryAssetId));
  if (removed.length === 0) return prev;
  const removedIds = new Set(removed.map((r) => r.id));
  const list = prev.filter((r) => !removedIds.has(r.id));
  for (const entry of removed) {
    deleteOwnedFiles(entry, list);
  }
  await persistList(list);
  return list;
}

export async function toggleFavoriteRecent(id: string) {
  const prev = await loadRecents();
  const list = prev.map((r) => (r.id === id ? { ...r, favorite: !r.favorite } : r));
  await persistList(list);
  return list;
}

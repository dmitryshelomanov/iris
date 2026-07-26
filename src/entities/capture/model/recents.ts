import AsyncStorage from '@react-native-async-storage/async-storage';

const RECENTS_KEY = 'iris.recents.v1';
const MAX_RECENTS = 40;

export type RecentCapture = {
  id: string;
  uri: string;
  /** Pre-bake original for before/after compare (photos). */
  rawUri?: string;
  kind: 'photo' | 'video';
  createdAt: number;
  lookId?: string;
  histogram?: number[];
  favorite?: boolean;
};

export async function loadRecents(): Promise<RecentCapture[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentCapture[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function pushRecent(entry: Omit<RecentCapture, 'id' | 'createdAt'> & { id?: string }) {
  const next: RecentCapture = {
    id: entry.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    uri: entry.uri,
    rawUri: entry.rawUri,
    kind: entry.kind,
    createdAt: Date.now(),
    lookId: entry.lookId,
    histogram: entry.histogram,
    favorite: entry.favorite,
  };
  const prev = await loadRecents();
  const list = [next, ...prev.filter((r) => r.uri !== next.uri)].slice(0, MAX_RECENTS);
  await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(list));
  return list;
}

export async function removeRecent(id: string) {
  const prev = await loadRecents();
  const list = prev.filter((r) => r.id !== id);
  await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(list));
  return list;
}

export async function toggleFavoriteRecent(id: string) {
  const prev = await loadRecents();
  const list = prev.map((r) => (r.id === id ? { ...r, favorite: !r.favorite } : r));
  await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(list));
  return list;
}

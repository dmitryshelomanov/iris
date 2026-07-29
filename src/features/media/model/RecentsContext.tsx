import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { addListener } from 'expo-media-library';

import {
  pruneRecentsMissingLibraryAssets,
  pushRecent,
  removeRecent,
  removeRecents,
  removeRecentsByLibraryAssetIds,
  updateRecent,
  type RecentCapture,
} from '@/entities/capture';

type RecentsContextValue = {
  ready: boolean;
  recents: RecentCapture[];
  lastShot: RecentCapture | null;
  addCapture: (entry: Omit<RecentCapture, 'id' | 'createdAt'> & { id?: string }) => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  dismissMany: (ids: string[]) => Promise<void>;
  patchCapture: (
    id: string,
    patch: Partial<Omit<RecentCapture, 'id' | 'createdAt'>>,
  ) => Promise<void>;
  refresh: () => Promise<void>;
};

const RecentsContext = createContext<RecentsContextValue | null>(null);

export function RecentsProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [recents, setRecents] = useState<RecentCapture[]>([]);

  const refresh = useCallback(async () => {
    const pruned = await pruneRecentsMissingLibraryAssets();
    setRecents(pruned);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        void refresh();
      }
    };
    const appSub = AppState.addEventListener('change', onAppState);

    const librarySub = addListener((event) => {
      void (async () => {
        if (event.hasIncrementalChanges && event.deletedAssets?.length) {
          const list = await removeRecentsByLibraryAssetIds(event.deletedAssets);
          setRecents(list);
          return;
        }
        // Android always reports non-incremental; iOS may too for large changes.
        const list = await pruneRecentsMissingLibraryAssets();
        setRecents(list);
      })();
    });

    return () => {
      appSub.remove();
      librarySub.remove();
    };
  }, [refresh]);

  const addCapture = useCallback(
    async (entry: Omit<RecentCapture, 'id' | 'createdAt'> & { id?: string }) => {
      const list = await pushRecent(entry);
      setRecents(list);
    },
    [],
  );

  const dismiss = useCallback(async (id: string) => {
    const list = await removeRecent(id);
    setRecents(list);
  }, []);

  const dismissMany = useCallback(async (ids: string[]) => {
    const list = await removeRecents(ids);
    setRecents(list);
  }, []);

  const patchCapture = useCallback(
    async (id: string, patch: Partial<Omit<RecentCapture, 'id' | 'createdAt'>>) => {
      const list = await updateRecent(id, patch);
      setRecents(list);
    },
    [],
  );

  const value = useMemo<RecentsContextValue>(
    () => ({
      ready,
      recents,
      lastShot: recents[0] ?? null,
      addCapture,
      dismiss,
      dismissMany,
      patchCapture,
      refresh,
    }),
    [ready, recents, addCapture, dismiss, dismissMany, patchCapture, refresh],
  );

  return <RecentsContext.Provider value={value}>{children}</RecentsContext.Provider>;
}

export function useRecents() {
  const ctx = useContext(RecentsContext);
  if (!ctx) throw new Error('useRecents must be used within RecentsProvider');
  return ctx;
}

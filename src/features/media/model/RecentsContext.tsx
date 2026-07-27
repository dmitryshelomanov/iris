import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  loadRecents,
  pushRecent,
  removeRecent,
  updateRecent,
  type RecentCapture,
} from '@/entities/capture';

type RecentsContextValue = {
  ready: boolean;
  recents: RecentCapture[];
  lastShot: RecentCapture | null;
  addCapture: (entry: Omit<RecentCapture, 'id' | 'createdAt'> & { id?: string }) => Promise<void>;
  dismiss: (id: string) => Promise<void>;
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
    const list = await loadRecents();
    setRecents(list);
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
      patchCapture,
      refresh,
    }),
    [ready, recents, addCapture, dismiss, patchCapture, refresh],
  );

  return <RecentsContext.Provider value={value}>{children}</RecentsContext.Provider>;
}

export function useRecents() {
  const ctx = useContext(RecentsContext);
  if (!ctx) throw new Error('useRecents must be used within RecentsProvider');
  return ctx;
}

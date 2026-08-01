import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { resolveLookPresetId } from './presets';
import { DEFAULT_CAPTURE_SETTINGS, PERSISTED_CAPTURE_KEYS, type CaptureSettings } from './types';

const SETTINGS_KEY = 'iris.captureSettings.v1';

type CaptureSettingsContextValue = {
  settings: CaptureSettings;
  ready: boolean;
  patchSettings: (patch: Partial<CaptureSettings>) => void;
  setSettings: (next: CaptureSettings) => void;
};

const CaptureSettingsContext = createContext<CaptureSettingsContextValue | null>(null);

function pickPersisted(settings: CaptureSettings): Partial<CaptureSettings> {
  const out: Partial<CaptureSettings> = {};
  for (const key of PERSISTED_CAPTURE_KEYS) {
    Object.assign(out, { [key]: settings[key] });
  }
  return out;
}

function mergeStored(raw: string | null): CaptureSettings {
  if (!raw) return DEFAULT_CAPTURE_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<CaptureSettings>;
    const merged = {
      ...DEFAULT_CAPTURE_SETTINGS,
      ...pickPersisted({ ...DEFAULT_CAPTURE_SETTINGS, ...parsed }),
    };
    const resolvedLook = resolveLookPresetId(merged.lookId);
    merged.lookId = resolvedLook ?? DEFAULT_CAPTURE_SETTINGS.lookId;
    if (merged.videoFps !== 'max' && merged.videoFps !== 30 && merged.videoFps !== 60) {
      merged.videoFps = DEFAULT_CAPTURE_SETTINGS.videoFps;
    }
    return merged;
  } catch {
    return DEFAULT_CAPTURE_SETTINGS;
  }
}

export function CaptureSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<CaptureSettings>(DEFAULT_CAPTURE_SETTINGS);
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_KEY);
        const merged = mergeStored(raw);
        if (!cancelled) setSettingsState(merged);
        // Self-heal stale / legacy lookId so storage matches resolved presets.
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Partial<CaptureSettings>;
            if (parsed.lookId !== merged.lookId) {
              await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(pickPersisted(merged)));
            }
          } catch {
            // ignore malformed payload — mergeStored already fell back to defaults
          }
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((next: CaptureSettings) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(pickPersisted(next))).catch(() => {});
    }, 200);
  }, []);

  const setSettings = useCallback(
    (next: CaptureSettings) => {
      setSettingsState(next);
      persist(next);
    },
    [persist],
  );

  const patchSettings = useCallback(
    (patch: Partial<CaptureSettings>) => {
      setSettingsState((prev) => {
        const next = { ...prev, ...patch };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const value = useMemo<CaptureSettingsContextValue>(
    () => ({ settings, ready, setSettings, patchSettings }),
    [settings, ready, setSettings, patchSettings],
  );

  return (
    <CaptureSettingsContext.Provider value={value}>{children}</CaptureSettingsContext.Provider>
  );
}

export function useCaptureSettings() {
  const ctx = useContext(CaptureSettingsContext);
  if (!ctx) {
    throw new Error('useCaptureSettings must be used within CaptureSettingsProvider');
  }
  return ctx;
}

import AsyncStorage from '@react-native-async-storage/async-storage';

import { resolveLookPresetId } from './presets';
import {
  DEFAULT_CAPTURE_SETTINGS,
  DEFAULT_MANUAL_STATE,
  type CaptureMode,
  type CaptureSettings,
  type LensId,
  type ManualControlsState,
} from './types';

const PRESETS_KEY = 'iris.capturePresets.v1';
const MAX_PRESETS = 24;

export type CameraPreset = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  settings: CaptureSettings;
  mode: CaptureMode;
  manual: ManualControlsState;
  zoom: number;
  activeLensId: LensId | null;
};

type CameraPresetDraft = Omit<CameraPreset, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
  createdAt?: number;
};

function normalizeName(name: string) {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : defaultPresetName();
}

function normalizeSettings(settings: CaptureSettings): CaptureSettings {
  const next = { ...DEFAULT_CAPTURE_SETTINGS, ...settings };
  next.lookId = resolveLookPresetId(next.lookId) ?? DEFAULT_CAPTURE_SETTINGS.lookId;
  return next;
}

function normalizeManual(manual: ManualControlsState): ManualControlsState {
  return {
    ...DEFAULT_MANUAL_STATE,
    ...manual,
  };
}

function normalizePreset(input: Partial<CameraPreset> & Pick<CameraPreset, 'id'>): CameraPreset {
  return {
    id: input.id,
    name: normalizeName(input.name ?? ''),
    createdAt: typeof input.createdAt === 'number' ? input.createdAt : Date.now(),
    updatedAt: typeof input.updatedAt === 'number' ? input.updatedAt : Date.now(),
    mode: input.mode === 'video' ? 'video' : 'photo',
    settings: normalizeSettings(input.settings ?? DEFAULT_CAPTURE_SETTINGS),
    manual: normalizeManual(input.manual ?? DEFAULT_MANUAL_STATE),
    zoom:
      typeof input.zoom === 'number' && Number.isFinite(input.zoom) ? Math.max(1, input.zoom) : 1,
    activeLensId: input.activeLensId ?? null,
  };
}

function buildPreset(draft: CameraPresetDraft): CameraPreset {
  const now = Date.now();
  return normalizePreset({
    id: draft.id ?? `${now}-${Math.random().toString(36).slice(2, 8)}`,
    name: normalizeName(draft.name),
    createdAt: draft.createdAt ?? now,
    updatedAt: now,
    settings: draft.settings,
    mode: draft.mode,
    manual: draft.manual,
    zoom: draft.zoom,
    activeLensId: draft.activeLensId ?? null,
  });
}

export function defaultPresetName(now = new Date()) {
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `Preset ${hh}:${mm}`;
}

export async function loadCapturePresets(): Promise<CameraPreset[]> {
  try {
    const raw = await AsyncStorage.getItem(PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is Partial<CameraPreset> & Pick<CameraPreset, 'id'> =>
          typeof item === 'object' &&
          item != null &&
          typeof (item as { id?: unknown }).id === 'string',
      )
      .map((item) => normalizePreset(item))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

async function writeCapturePresets(list: CameraPreset[]) {
  await AsyncStorage.setItem(PRESETS_KEY, JSON.stringify(list));
  return list;
}

export async function saveCapturePreset(draft: CameraPresetDraft) {
  const preset = buildPreset(draft);
  const prev = await loadCapturePresets();
  const list = [preset, ...prev.filter((item) => item.id !== preset.id)]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_PRESETS);
  return writeCapturePresets(list);
}

export async function renameCapturePreset(id: string, name: string) {
  const prev = await loadCapturePresets();
  const list = prev.map((item) =>
    item.id === id ? { ...item, name: normalizeName(name), updatedAt: Date.now() } : item,
  );
  return writeCapturePresets(list.sort((a, b) => b.updatedAt - a.updatedAt));
}

export async function deleteCapturePreset(id: string) {
  const prev = await loadCapturePresets();
  return writeCapturePresets(prev.filter((item) => item.id !== id));
}

/** Seed Street / Portrait / Night quick chips once if the library is empty. */
export async function ensureScenePresets(): Promise<CameraPreset[]> {
  const existing = await loadCapturePresets();
  if (existing.length > 0) return existing;

  const now = Date.now();
  const seeds: CameraPreset[] = [
    buildPreset({
      id: `seed-street-${now}`,
      name: 'Street',
      mode: 'photo',
      zoom: 1,
      activeLensId: null,
      manual: { ...DEFAULT_MANUAL_STATE },
      settings: {
        ...DEFAULT_CAPTURE_SETTINGS,
        lookId: 'fs',
        lookStrength: 0.75,
        aspect: '4:3',
        showGrid: true,
      },
    }),
    buildPreset({
      id: `seed-portrait-${now}`,
      name: 'Portrait',
      mode: 'photo',
      zoom: 1,
      activeLensId: null,
      manual: { ...DEFAULT_MANUAL_STATE, ev: 0.3 },
      settings: {
        ...DEFAULT_CAPTURE_SETTINGS,
        lookId: 'kp',
        lookStrength: 0.75,
        aspect: '4:3',
      },
    }),
    buildPreset({
      id: `seed-night-${now}`,
      name: 'Night',
      mode: 'photo',
      zoom: 1,
      activeLensId: null,
      manual: { ...DEFAULT_MANUAL_STATE, ev: 0.5 },
      settings: {
        ...DEFAULT_CAPTURE_SETTINGS,
        lookId: 'tc',
        lookStrength: 0.75,
        lowLightBoost: true,
        aspect: '16:9',
      },
    }),
  ];

  return writeCapturePresets(seeds);
}

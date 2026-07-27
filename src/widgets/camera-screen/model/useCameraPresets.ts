import { useCallback, useEffect, useState } from 'react';

import {
  deleteCapturePreset,
  ensureScenePresets,
  renameCapturePreset,
  saveCapturePreset,
  type CameraPreset,
  type CaptureMode,
  type CaptureSettings,
  type LensId,
  type LensOption,
  type ManualControlsState,
} from '@/features/camera';

type Options = {
  settings: CaptureSettings;
  mode: CaptureMode;
  manual: ManualControlsState;
  zoom: number;
  activeLens: LensOption | undefined;
  lenses: LensOption[];
  setSettings: (settings: CaptureSettings) => void;
  setMode: (mode: CaptureMode) => void;
  setManual: (manual: ManualControlsState) => void;
  setZoom: (zoom: number) => void;
  setActiveLensId: (id: LensId) => void;
  setStatus: (status: string | null) => void;
  patchSettings: (patch: Partial<CaptureSettings>) => void;
};

export function useCameraPresets({
  settings,
  mode,
  manual,
  zoom,
  activeLens,
  lenses,
  setSettings,
  setMode,
  setManual,
  setZoom,
  setActiveLensId,
  setStatus,
  patchSettings,
}: Options) {
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [presets, setPresets] = useState<CameraPreset[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await ensureScenePresets();
      if (!cancelled) setPresets(list);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyCameraPreset = useCallback(
    (preset: CameraPreset) => {
      const nextSettings = { ...preset.settings };

      setSettings(nextSettings);
      setMode(preset.mode);
      setManual(preset.manual);
      setZoom(preset.zoom);

      const nextLens = preset.activeLensId
        ? (lenses.find((lens) => lens.id === preset.activeLensId) ?? null)
        : null;
      const effectiveLens = nextLens ?? activeLens ?? null;

      if (nextLens) {
        setActiveLensId(nextLens.id);
      }

      if (nextSettings.torchOn && effectiveLens?.position === 'front') {
        patchSettings({ torchOn: false });
      }

      if (!nextLens && preset.activeLensId) {
        setPresetsOpen(false);
        setStatus('Preset applied · saved lens unavailable');
        return;
      }

      setPresetsOpen(false);
      setStatus(`Preset applied · ${preset.name}`);
    },
    [
      activeLens,
      lenses,
      patchSettings,
      setActiveLensId,
      setManual,
      setMode,
      setSettings,
      setStatus,
      setZoom,
    ],
  );

  const saveCurrentPreset = useCallback(
    async (name: string) => {
      const list = await saveCapturePreset({
        name,
        settings,
        mode,
        manual,
        zoom,
        activeLensId: activeLens?.id ?? null,
      });
      setPresets(list);
      setStatus('Preset saved');
    },
    [activeLens?.id, manual, mode, settings, setStatus, zoom],
  );

  const renamePreset = useCallback(
    async (preset: CameraPreset, name: string) => {
      const list = await renameCapturePreset(preset.id, name);
      setPresets(list);
      setStatus('Preset renamed');
    },
    [setStatus],
  );

  const removePreset = useCallback(
    async (preset: CameraPreset) => {
      const list = await deleteCapturePreset(preset.id);
      setPresets(list);
      setStatus('Preset deleted');
    },
    [setStatus],
  );

  return {
    presets,
    presetsOpen,
    setPresetsOpen,
    applyCameraPreset,
    saveCurrentPreset,
    renamePreset,
    removePreset,
  };
}

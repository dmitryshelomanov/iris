import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useCameraDevices,
  usePhotoOutput,
  useVideoOutput,
  type CameraRef,
  type Constraint,
} from 'react-native-vision-camera';

import {
  buildCapabilities,
  buildLensCatalog,
  pickManualFocusLens,
  resolutionForAspect,
  resolvePreviewStabilizationMode,
  resolveVideoFps,
  resolveVideoStabilizationMode,
  videoResolutionForAspect,
  zoomRange,
  type CaptureMode,
  type CaptureSettings,
  type LensId,
  type LensOption,
} from '@/features/camera';

function pickFlipTarget(
  lenses: LensOption[],
  targetPosition: 'front' | 'back',
): LensOption | undefined {
  if (targetPosition === 'back') {
    const multi = lenses.find((l) => l.position === 'back' && l.kind === 'multi');
    if (multi) return multi;
  }
  return (
    lenses.find((l) => l.position === targetPosition && l.isNative) ??
    lenses.find((l) => l.position === targetPosition)
  );
}

function pickPreferredLens(lenses: LensOption[]): LensOption {
  return (
    lenses.find((l) => l.kind === 'multi') ??
    lenses.find((l) => l.position === 'back' && l.deviceType === 'wide-angle' && l.isNative) ??
    lenses.find((l) => l.position === 'back' && l.isNative) ??
    lenses[0]
  );
}

type Options = {
  mode: CaptureMode;
  settings: CaptureSettings;
  /** Vision Camera throws if enableAudio while mic is not authorized. */
  hasMicrophonePermission: boolean;
  setZoom: (next: number | ((prev: number) => number)) => void;
  setStatus: (status: string | null) => void;
  patchSettings: (patch: Partial<CaptureSettings>) => void;
};

export function useCameraSession({
  mode,
  settings,
  hasMicrophonePermission,
  setZoom,
  setStatus,
  patchSettings,
}: Options) {
  const cameraRef = useRef<CameraRef>(null);
  const devices = useCameraDevices();
  const lenses = useMemo(() => buildLensCatalog(devices), [devices]);
  const [activeLensId, setActiveLensId] = useState<LensId | undefined>(undefined);
  /** Bump counter — re-run manual apply when the camera controller attaches after session start. */
  const [controllerReady, setControllerReady] = useState(0);
  const [sessionReady, setSessionReady] = useState(false);

  const activeLens = useMemo(
    () => lenses.find((l) => l.id === activeLensId) ?? lenses[0],
    [activeLensId, lenses],
  );
  const device = activeLens?.device;
  const capabilities = useMemo(() => buildCapabilities(device), [device]);
  const { min: minZoom, max: maxZoom } = useMemo(() => zoomRange(device), [device]);
  const wideFocalMm = useMemo(() => {
    if (activeLens?.focalLengthMm && activeLens.kind === 'multi') return activeLens.focalLengthMm;
    if (activeLens?.isNative && activeLens.focalLengthMm) return activeLens.focalLengthMm;
    const wide = devices.find(
      (d) => d.position === 'back' && !d.isVirtualDevice && d.type === 'wide-angle',
    );
    return Math.round(wide?.focalLength ?? activeLens?.focalLengthMm ?? device?.focalLength ?? 24);
  }, [activeLens, device, devices]);

  const photoOutput = usePhotoOutput({
    targetResolution: resolutionForAspect(settings.aspect),
    containerFormat: 'jpeg',
    quality: settings.jpegQuality,
    qualityPrioritization:
      settings.qualityPrioritization === 'speed' && !capabilities.supportsSpeedQuality
        ? 'balanced'
        : settings.qualityPrioritization,
  });

  // Only enable audio after mic is authorized — iOS throws
  // "Audio Permission not yet granted!" otherwise. After grant, the
  // session reconfigures; recording is still gated in useCameraCapture.
  const videoOutput = useVideoOutput({
    targetResolution: videoResolutionForAspect(settings.aspect),
    enableAudio: hasMicrophonePermission,
    fileType: 'mp4',
  });

  const constraints = useMemo<Constraint[]>(() => {
    const list: Constraint[] = [{ resolutionBias: mode === 'video' ? videoOutput : photoOutput }];
    if (settings.photoHDR && capabilities.supportsPhotoHDR && mode === 'photo') {
      list.push({ photoHDR: true });
    }
    if (mode === 'video' && settings.videoStabilization) {
      const videoStab = resolveVideoStabilizationMode(device);
      if (videoStab != null) {
        list.push({ videoStabilizationMode: videoStab });
      }
      const previewStab = resolvePreviewStabilizationMode(device);
      if (previewStab != null) {
        list.push({ previewStabilizationMode: previewStab });
      }
    }
    if (mode === 'video') {
      const fps = resolveVideoFps(device, settings.videoFps, {
        preferStabilization: settings.videoStabilization,
      });
      if (fps != null) list.push({ fps });
    }
    return list;
  }, [
    mode,
    photoOutput,
    videoOutput,
    settings.photoHDR,
    settings.videoStabilization,
    settings.videoFps,
    capabilities.supportsPhotoHDR,
    device,
  ]);

  const onSessionConfigured = useCallback(() => {
    setSessionReady(true);
    photoOutput
      .prepareSettings([
        { flashMode: 'off', enableShutterSound: true },
        { flashMode: 'on', enableShutterSound: true },
        { flashMode: 'auto', enableShutterSound: true },
      ])
      .catch(() => {});
  }, [photoOutput]);

  const lensIdBeforeManualRef = useRef<LensId | null>(null);

  const selectLens = useCallback(
    (lens: LensOption, options?: { silent?: boolean }) => {
      if (lens.id === activeLensId) return;
      const deviceChanged = lens.device.id !== activeLens?.device.id;
      if (deviceChanged) {
        setSessionReady(false);
      }
      setActiveLensId(lens.id);
      setZoom(lens.zoom);
      if (settings.torchOn && lens.position === 'front') {
        patchSettings({ torchOn: false });
      }
      if (!options?.silent) {
        setStatus(lens.isNative ? lens.label : `${lens.label} · ${lens.hint}`);
      }
    },
    [activeLens?.device.id, activeLensId, patchSettings, setStatus, setZoom, settings.torchOn],
  );

  /** Switch to a physical lens that can lock focus (Pro dial). */
  const ensureManualFocusLens = useCallback((): 'ready' | 'switched' | 'unavailable' => {
    if (device?.supportsFocusLocking) return 'ready';
    const next = pickManualFocusLens(lenses);
    if (!next) return 'unavailable';
    if (activeLensId && lensIdBeforeManualRef.current == null) {
      lensIdBeforeManualRef.current = activeLensId;
    }
    selectLens(next, { silent: true });
    return 'switched';
  }, [activeLensId, device?.supportsFocusLocking, lenses, selectLens]);

  /** Restore Multi / previous lens after leaving Pro manual. */
  const restoreLensAfterManual = useCallback(() => {
    const prevId = lensIdBeforeManualRef.current;
    lensIdBeforeManualRef.current = null;
    if (prevId == null || prevId === activeLensId) return;
    const prev = lenses.find((l) => l.id === prevId);
    // Never restore across front/back after a flip.
    if (prev && prev.position === activeLens?.position) {
      selectLens(prev, { silent: true });
    }
  }, [activeLens?.position, activeLensId, lenses, selectLens]);

  const onFlip = useCallback(() => {
    // Invalidate Pro→Multi restore — saved lens belongs to the other side.
    lensIdBeforeManualRef.current = null;
    if (lenses.length === 0) return;
    const current = activeLens;
    const targetPosition = current?.position === 'front' ? 'back' : 'front';
    const next = pickFlipTarget(lenses, targetPosition);
    if (next) selectLens(next);
  }, [activeLens, lenses, selectLens]);

  useEffect(() => {
    if (lenses.length === 0) return;
    const stillValid = activeLensId != null && lenses.some((l) => l.id === activeLensId);
    if (stillValid) return;

    const preferred = pickPreferredLens(lenses);
    setActiveLensId(preferred.id);
    setZoom(preferred.zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lenses, activeLensId]);

  useEffect(() => {
    setSessionReady(false);
  }, [device?.id, photoOutput, videoOutput]);

  useEffect(() => {
    if (!activeLens || !device) return;
    if (activeLens.device.id !== device.id) return;
    setZoom(activeLens.zoom);
    // Intentionally keyed on lens id — mirrors prior CameraScreen behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLens?.id]);

  return {
    cameraRef,
    lenses,
    activeLens,
    activeLensId,
    setActiveLensId,
    device,
    capabilities,
    minZoom,
    maxZoom,
    wideFocalMm,
    photoOutput,
    videoOutput,
    constraints,
    sessionReady,
    controllerReady,
    setControllerReady,
    onSessionConfigured,
    onSelectLens: selectLens,
    ensureManualFocusLens,
    restoreLensAfterManual,
    onFlip,
  };
}

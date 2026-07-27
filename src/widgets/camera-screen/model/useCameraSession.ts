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
  buildZoomDialMajors,
  resolutionForAspect,
  videoResolutionForAspect,
  zoomRange,
  type CaptureMode,
  type CaptureSettings,
  type LensId,
  type LensOption,
} from '@/features/camera';

type MicPermission = {
  hasPermission: boolean;
};

type Options = {
  mode: CaptureMode;
  settings: CaptureSettings;
  mic: MicPermission;
  setZoom: (next: number | ((prev: number) => number)) => void;
  setStatus: (status: string | null) => void;
  patchSettings: (patch: Partial<CaptureSettings>) => void;
};

export function useCameraSession({
  mode,
  settings,
  mic,
  setZoom,
  setStatus,
  patchSettings,
}: Options) {
  const cameraRef = useRef<CameraRef>(null);
  const devices = useCameraDevices();
  const lenses = useMemo(() => buildLensCatalog(devices), [devices]);
  const [activeLensId, setActiveLensId] = useState<LensId | undefined>(undefined);
  const [controllerReady, setControllerReady] = useState(0);
  const [sessionReady, setSessionReady] = useState(false);

  const activeLens = useMemo(
    () => lenses.find((l) => l.id === activeLensId) ?? lenses[0],
    [activeLensId, lenses],
  );
  const device = activeLens?.device;
  const capabilities = useMemo(() => buildCapabilities(device), [device]);
  const zoomMajors = useMemo(() => buildZoomDialMajors(device), [device]);
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

  const videoOutput = useVideoOutput({
    targetResolution: videoResolutionForAspect(settings.aspect),
    enableAudio: mic.hasPermission,
    fileType: 'mp4',
  });

  const constraints = useMemo<Constraint[]>(() => {
    const list: Constraint[] = [{ resolutionBias: mode === 'video' ? videoOutput : photoOutput }];
    if (settings.photoHDR && capabilities.supportsPhotoHDR && mode === 'photo') {
      list.push({ photoHDR: true });
    }
    return list;
  }, [mode, photoOutput, videoOutput, settings.photoHDR, capabilities.supportsPhotoHDR]);

  useEffect(() => {
    if (lenses.length === 0) return;
    const stillValid = activeLensId != null && lenses.some((l) => l.id === activeLensId);
    if (stillValid) return;

    const preferred =
      lenses.find((l) => l.kind === 'multi') ??
      lenses.find((l) => l.position === 'back' && l.deviceType === 'wide-angle' && l.isNative) ??
      lenses.find((l) => l.position === 'back' && l.isNative) ??
      lenses[0];
    setActiveLensId(preferred.id);
    setZoom(preferred.zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lenses, activeLensId]);

  useEffect(() => {
    setSessionReady(false);
  }, [device?.id]);

  useEffect(() => {
    setSessionReady(false);
  }, [photoOutput, videoOutput]);

  useEffect(() => {
    if (!activeLens || !device) return;
    if (activeLens.device.id !== device.id) return;
    setZoom(activeLens.zoom);
    // Intentionally keyed on lens id — mirrors prior CameraScreen behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLens?.id]);

  const onSessionConfigured = useCallback(() => {
    setSessionReady(true);
    void photoOutput
      .prepareSettings([
        { flashMode: 'off', enableShutterSound: true },
        { flashMode: 'on', enableShutterSound: true },
        { flashMode: 'auto', enableShutterSound: true },
      ])
      .catch(() => {});
  }, [photoOutput]);

  const onSelectLens = useCallback(
    (lens: LensOption) => {
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
      setStatus(lens.isNative ? lens.label : `${lens.label} · ${lens.hint}`);
    },
    [activeLens?.device.id, activeLensId, patchSettings, setStatus, setZoom, settings.torchOn],
  );

  const onFlip = useCallback(() => {
    if (lenses.length === 0) return;
    const current = activeLens;
    const targetPosition = current?.position === 'front' ? 'back' : 'front';
    const next =
      (targetPosition === 'back'
        ? lenses.find((l) => l.position === 'back' && l.deviceType === 'wide-angle' && l.isNative)
        : undefined) ??
      lenses.find((l) => l.position === targetPosition && l.isNative) ??
      lenses.find((l) => l.position === targetPosition);
    if (next) onSelectLens(next);
  }, [activeLens, lenses, onSelectLens]);

  return {
    cameraRef,
    lenses,
    activeLens,
    activeLensId,
    setActiveLensId,
    device,
    capabilities,
    zoomMajors,
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
    onSelectLens,
    onFlip,
  };
}

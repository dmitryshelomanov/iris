import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useIsFocused, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import {
  Camera,
  useCameraDevices,
  useCameraPermission,
  useMicrophonePermission,
  usePhotoOutput,
  useVideoOutput,
  type CameraRef,
  type Constraint,
  type Recorder,
} from 'react-native-vision-camera';
import {
  Bookmark,
  FlipHorizontal2,
  Images,
  Settings,
  SlidersHorizontal,
} from 'lucide-react-native';
import { File } from 'expo-file-system';

import { savePhotoToLibrary, saveVideoToLibrary, toggleFavoriteRecent } from '@/entities/capture';
import {
  AspectCropOverlay,
  CameraPresetsDialog,
  CaptureButton,
  CaptureToolbar,
  CountdownOverlay,
  DEFAULT_MANUAL_STATE,
  FocusReticle,
  GridOverlay,
  HistogramOverlay,
  LensSwitcher,
  LevelOverlay,
  LookOverlay,
  LookPresets,
  LookStrengthSlider,
  ManualControls,
  ModeToggle,
  PeakingOverlay,
  ScenePresetChips,
  StabilizationCrosshairOverlay,
  ZebraOverlay,
  ZoomSwitcher,
  applyLookToManual,
  applyManualToController,
  bakeLookIntoPhoto,
  bakeLookIntoVideo,
  buildCapabilities,
  buildLensCatalog,
  buildZoomDialMajors,
  zoomRange,
  defaultPresetName,
  deleteCapturePreset,
  ensureScenePresets,
  getLookPreset,
  hapticFocusLock,
  hapticRecordStart,
  hapticRecordStop,
  hapticShutter,
  peakingIntensity,
  renameCapturePreset,
  resolutionForAspect,
  saveCapturePreset,
  seedManualFromController,
  synthesizeLiveHistogram,
  useCaptureSettings,
  useVolumeShutter,
  videoResolutionForAspect,
  zebraIntensityFromExposure,
  type CameraPreset,
  type CaptureMode,
  type FocusReticleState,
  type LensId,
  type LensOption,
  type LookPresetId,
  type LookSceneId,
  type ManualControlsState,
} from '@/features/camera';
import { LastShotButton, ReviewModal, useRecents } from '@/features/media';
import { Icon } from '@/shared/ui/icon';
import { Text } from '@/shared/ui/text';

export function CameraScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const cameraRef = useRef<CameraRef>(null);
  const { settings, patchSettings, setSettings } = useCaptureSettings();
  const { lastShot, recents, addCapture, dismiss, refresh } = useRecents();

  const { hasPermission, requestPermission, canRequestPermission } = useCameraPermission();
  const mic = useMicrophonePermission();

  const devices = useCameraDevices();
  const lenses = useMemo(() => buildLensCatalog(devices), [devices]);
  const [activeLensId, setActiveLensId] = useState<LensId | undefined>(undefined);

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

  const [zoom, setZoomState] = useState(1);
  const zoomSV = useSharedValue(1);
  const pinchStartZoom = useSharedValue(1);
  const minZoomSV = useSharedValue(1);
  const maxZoomSV = useSharedValue(1);
  const lastPinchJsSync = useRef(0);

  const setZoom = useCallback(
    (next: number | ((prev: number) => number)) => {
      setZoomState((prev) => {
        const value = typeof next === 'function' ? next(prev) : next;
        const clamped = Math.min(maxZoom, Math.max(minZoom, value));
        zoomSV.value = clamped;
        return clamped;
      });
    },
    [maxZoom, minZoom, zoomSV],
  );

  useEffect(() => {
    minZoomSV.value = minZoom;
    maxZoomSV.value = maxZoom;
  }, [minZoom, maxZoom, minZoomSV, maxZoomSV]);

  const [mode, setMode] = useState<CaptureMode>('photo');
  const [manual, setManual] = useState<ManualControlsState>(DEFAULT_MANUAL_STATE);
  const [showManual, setShowManual] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [controllerReady, setControllerReady] = useState(0);
  const [sessionReady, setSessionReady] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [postCaptureOpen, setPostCaptureOpen] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [presets, setPresets] = useState<CameraPreset[]>([]);
  const [histogram, setHistogram] = useState<number[] | null>(lastShot?.histogram ?? null);
  const [liveHistogram, setLiveHistogram] = useState<number[] | null>(null);
  const [lookScene, setLookScene] = useState<LookSceneId>('all');
  const [focusReticle, setFocusReticle] = useState<FocusReticleState>(null);
  const [aeAfLocked, setAeAfLocked] = useState(false);
  const capturingRef = useRef(false);
  const recorderRef = useRef<Recorder | null>(null);
  const stoppingRef = useRef(false);
  const cancelCountdownRef = useRef(false);

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

  const look = getLookPreset(settings.lookId);

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
  }, [activeLens?.id]);

  useEffect(() => {
    setZoom((z) => Math.min(maxZoom, Math.max(minZoom, z)));
  }, [minZoom, maxZoom]);

  useEffect(() => {
    if (capturingRef.current) return;
    const controller = cameraRef.current?.controller;
    if (!controller || !device || !sessionReady) return;

    let cancelled = false;
    (async () => {
      try {
        await applyManualToController(controller, manual, {
          lockWhiteBalance: settings.lookId !== 'none' || manual.enabled,
        });
      } catch (error) {
        if (!cancelled) {
          setStatus(error instanceof Error ? error.message : 'Control failed');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [manual, settings.lookId, device, controllerReady, sessionReady]);

  useEffect(() => {
    if (lastShot?.histogram) setHistogram(lastShot.histogram);
  }, [lastShot?.id]);

  useEffect(() => {
    if (!settings.showHistogram || !sessionReady) return;
    const id = setInterval(() => {
      const controller = cameraRef.current?.controller;
      if (!controller) return;
      const iso = controller.iso > 0 ? controller.iso : manual.iso;
      const shutter =
        controller.exposureDuration > 0 ? controller.exposureDuration : manual.shutter;
      const ev = manual.enabled ? manual.ev : controller.exposureBias;
      setLiveHistogram(synthesizeLiveHistogram({ iso, shutter, ev }));
    }, 400);
    return () => clearInterval(id);
  }, [settings.showHistogram, sessionReady, manual.enabled, manual.ev, manual.iso, manual.shutter]);

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
    [activeLens?.device.id, activeLensId, patchSettings, settings.torchOn],
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

  const onManualChange = useCallback(
    (next: ManualControlsState) => {
      const controller = cameraRef.current?.controller;
      if (next.enabled && !manual.enabled && controller) {
        setManual(seedManualFromController(controller, next));
        return;
      }
      setManual(next);
    },
    [manual.enabled],
  );

  const onLookChange = useCallback(
    (lookId: LookPresetId) => {
      patchSettings({ lookId });
      setManual((prev) => applyLookToManual(prev, lookId));
    },
    [patchSettings],
  );

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
    [activeLens, lenses, patchSettings, setSettings],
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
    [activeLens?.id, manual, mode, settings, zoom],
  );

  const renamePreset = useCallback(async (preset: CameraPreset, name: string) => {
    const list = await renameCapturePreset(preset.id, name);
    setPresets(list);
    setStatus('Preset renamed');
  }, []);

  const removePreset = useCallback(async (preset: CameraPreset) => {
    const list = await deleteCapturePreset(preset.id);
    setPresets(list);
    setStatus('Preset deleted');
  }, []);

  const takePhotoOnce = useCallback(async () => {
    const flashMode =
      activeLens?.position === 'front' || !capabilities.hasFlash ? 'off' : settings.flashMode;

    const { filePath } = await photoOutput.capturePhotoToFile(
      {
        flashMode,
        enableShutterSound: settings.shutterSound,
      },
      {},
    );

    const rawUri = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
    const baked = await bakeLookIntoPhoto(filePath, look.overlay, {
      strength: settings.lookStrength,
      jpegQuality: settings.jpegQuality,
    });
    setHistogram(baked.histogram);

    await savePhotoToLibrary(baked.uri);

    let keepRaw: string | undefined;
    if (settings.lookId !== 'none' && baked.path !== filePath) {
      try {
        const cache = new File(rawUri);
        if (cache.exists) keepRaw = rawUri;
      } catch {
        keepRaw = undefined;
      }
    }

    await addCapture({
      uri: baked.uri,
      rawUri: keepRaw,
      kind: 'photo',
      lookId: settings.lookId,
      histogram: baked.histogram,
    });

    return baked;
  }, [
    activeLens?.position,
    addCapture,
    capabilities.hasFlash,
    look.overlay,
    photoOutput,
    settings.flashMode,
    settings.jpegQuality,
    settings.lookId,
    settings.lookStrength,
    settings.shutterSound,
  ]);

  const takePhoto = useCallback(async () => {
    if (capturingRef.current || isCapturing) return;
    if (!sessionReady) {
      setStatus('Camera warming up…');
      return;
    }

    capturingRef.current = true;
    setIsCapturing(true);
    const burst = mode === 'photo' ? settings.burstCount : 1;
    setStatus(burst > 1 ? `Burst ${burst}×…` : 'Capturing…');
    void hapticShutter();

    try {
      for (let i = 0; i < burst; i += 1) {
        if (burst > 1) setStatus(`Burst ${i + 1}/${burst}…`);
        else setStatus('Applying look…');
        await takePhotoOnce();
      }
      setStatus(
        burst > 1
          ? `Saved ${burst} · ${look.label} · ${look.hint}`
          : `Saved · ${look.label} · ${look.hint}`,
      );
      setPostCaptureOpen(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Capture failed';
      console.warn('[iris] capture failed', error);
      setStatus(message);
    } finally {
      capturingRef.current = false;
      setIsCapturing(false);
    }
  }, [isCapturing, look.hint, look.label, mode, sessionReady, settings.burstCount, takePhotoOnce]);

  const finishRecording = useCallback(
    async (filePath: string) => {
      try {
        let outPath = filePath;
        let uri = filePath.startsWith('file://') ? filePath : `file://${filePath}`;

        if (settings.lookId !== 'none') {
          setStatus('Applying look…');
          const baked = await bakeLookIntoVideo(filePath, look.overlay, {
            strength: settings.lookStrength,
          });
          outPath = baked.path;
          uri = baked.uri;
        }

        setStatus('Saving video…');
        await saveVideoToLibrary(outPath);
        await addCapture({ uri, kind: 'video', lookId: settings.lookId });
        setStatus(
          settings.lookId === 'none' ? 'Saved to Photos' : `Saved · ${look.label} · ${look.hint}`,
        );
        setPostCaptureOpen(true);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Save failed';
        console.warn('[iris] video save failed', error);
        setStatus(message);
      } finally {
        recorderRef.current = null;
        stoppingRef.current = false;
        setIsRecording(false);
      }
    },
    [addCapture, look.hint, look.label, look.overlay, settings.lookId, settings.lookStrength],
  );

  const startRecording = useCallback(async () => {
    if (!sessionReady || isRecording || stoppingRef.current) {
      if (!sessionReady) setStatus('Camera warming up…');
      return;
    }

    if (!mic.hasPermission) {
      if (!mic.canRequestPermission) {
        setStatus('Enable microphone in Settings');
        return;
      }
      const granted = await mic.requestPermission();
      if (!granted) {
        setStatus('Microphone needed for video');
        return;
      }
      setStatus('Mic ready — tap to record');
      return;
    }

    try {
      setStatus('Recording… · tap to stop');
      void hapticRecordStart();
      const recorder = await videoOutput.createRecorder({});
      recorderRef.current = recorder;
      setIsRecording(true);

      await recorder.startRecording(
        (filePath) => {
          void finishRecording(filePath);
        },
        (error) => {
          console.warn('[iris] recording error', error);
          setStatus(error.message || 'Recording failed');
          recorderRef.current = null;
          stoppingRef.current = false;
          setIsRecording(false);
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not start recording';
      console.warn('[iris] startRecording failed', error);
      setStatus(message);
      recorderRef.current = null;
      setIsRecording(false);
    }
  }, [
    finishRecording,
    isRecording,
    mic.canRequestPermission,
    mic.hasPermission,
    mic.requestPermission,
    sessionReady,
    videoOutput,
  ]);

  const stopRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || stoppingRef.current) return;

    stoppingRef.current = true;
    setStatus('Stopping…');
    void hapticRecordStop();
    try {
      await recorder.stopRecording();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Stop failed';
      console.warn('[iris] stopRecording failed', error);
      setStatus(message);
      recorderRef.current = null;
      stoppingRef.current = false;
      setIsRecording(false);
    }
  }, []);

  const onCapture = useCallback(async () => {
    if (mode === 'video') {
      if (isRecording) {
        await stopRecording();
      } else {
        await startRecording();
      }
      return;
    }

    if (isCapturing || countdown != null) return;

    const delay = settings.timerSeconds;
    if (delay > 0) {
      cancelCountdownRef.current = false;
      for (let s = delay; s > 0; s -= 1) {
        if (cancelCountdownRef.current) {
          setCountdown(null);
          setStatus('Timer cancelled');
          return;
        }
        setCountdown(s);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      setCountdown(null);
      if (cancelCountdownRef.current) return;
    }

    await takePhoto();
  }, [
    countdown,
    isCapturing,
    isRecording,
    mode,
    settings.timerSeconds,
    startRecording,
    stopRecording,
    takePhoto,
  ]);

  useVolumeShutter({
    enabled: isFocused && settings.volumeShutter && hasPermission && !!device,
    onShutter: () => {
      void onCapture();
    },
  });

  useEffect(() => {
    if (mode !== 'video' && isRecording) {
      void stopRecording();
    }
  }, [isRecording, mode, stopRecording]);

  const onPreviewTap = useCallback(
    async (locationX: number, locationY: number) => {
      if (manual.enabled || countdown != null || isCapturing) return;
      setFocusReticle({ x: locationX, y: locationY, locked: false });
      setAeAfLocked(false);
      try {
        await cameraRef.current?.focusTo(
          { x: locationX, y: locationY },
          { responsiveness: 'snappy', adaptiveness: 'continuous', autoResetAfter: 4 },
        );
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Focus failed');
      }
    },
    [countdown, isCapturing, manual.enabled],
  );

  const onPreviewLongPress = useCallback(
    async (locationX: number, locationY: number) => {
      if (manual.enabled || countdown != null || isCapturing) return;
      setFocusReticle({ x: locationX, y: locationY, locked: true });
      setAeAfLocked(true);
      void hapticFocusLock();
      setStatus('AE/AF locked');
      try {
        await cameraRef.current?.focusTo(
          { x: locationX, y: locationY },
          { responsiveness: 'snappy', adaptiveness: 'locked', autoResetAfter: null },
        );
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Lock failed');
      }
    },
    [countdown, isCapturing, manual.enabled],
  );

  const syncZoomFromGesture = useCallback((next: number) => {
    setZoomState(next);
  }, []);

  const applyLiveZoom = useCallback((next: number) => {
    const controller = cameraRef.current?.controller;
    if (!controller) return;
    void controller.setZoom(next);
  }, []);

  const syncZoomFromPinchThrottled = useCallback((next: number) => {
    const now = Date.now();
    if (now - lastPinchJsSync.current < 50) return;
    lastPinchJsSync.current = now;
    setZoomState(next);
  }, []);

  const previewGestures = useMemo(() => {
    const tap = Gesture.Tap().onEnd((e) => {
      runOnJS(onPreviewTap)(e.x, e.y);
    });

    const longPress = Gesture.LongPress()
      .minDuration(380)
      .onStart((e) => {
        runOnJS(onPreviewLongPress)(e.x, e.y);
      });

    const pinch = Gesture.Pinch()
      .onBegin(() => {
        pinchStartZoom.value = zoomSV.value;
      })
      .onUpdate((e) => {
        const next = Math.min(
          maxZoomSV.value,
          Math.max(minZoomSV.value, pinchStartZoom.value * e.scale),
        );
        zoomSV.value = next;
        runOnJS(applyLiveZoom)(next);
        runOnJS(syncZoomFromPinchThrottled)(Number(next.toFixed(3)));
      })
      .onEnd(() => {
        runOnJS(syncZoomFromGesture)(Number(zoomSV.value.toFixed(3)));
      });

    return Gesture.Simultaneous(pinch, Gesture.Exclusive(longPress, tap));
  }, [
    applyLiveZoom,
    maxZoomSV,
    minZoomSV,
    onPreviewLongPress,
    onPreviewTap,
    pinchStartZoom,
    syncZoomFromGesture,
    syncZoomFromPinchThrottled,
    zoomSV,
  ]);

  const unlockAeAf = useCallback(async () => {
    if (!aeAfLocked) return;
    setAeAfLocked(false);
    setFocusReticle(null);
    try {
      await cameraRef.current?.resetFocus();
      setStatus('AE/AF unlocked');
    } catch {
      // ignore
    }
  }, [aeAfLocked]);

  const zebraIntensity = useMemo(() => {
    if (!settings.showZebras) return 0;
    const iso = manual.enabled ? manual.iso : 400;
    return zebraIntensityFromExposure(manual.ev, iso);
  }, [manual.enabled, manual.ev, manual.iso, settings.showZebras]);

  const peakIntensity = useMemo(() => {
    if (!settings.showPeaking) return 0;
    return peakingIntensity(manual.focus, aeAfLocked || manual.enabled);
  }, [aeAfLocked, manual.enabled, manual.focus, settings.showPeaking]);

  if (!hasPermission) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-black px-8">
        <Text className="text-center text-xl font-semibold text-white">Camera access needed</Text>
        <Text className="text-center text-sm text-white/60">
          Iris needs the camera for photo and video. Microphone is used for video audio.
        </Text>
        {canRequestPermission ? (
          <Pressable
            onPress={async () => {
              await requestPermission();
              if (!mic.hasPermission && mic.canRequestPermission) {
                await mic.requestPermission();
              }
            }}
            className="rounded-full bg-white px-5 py-3"
          >
            <Text className="font-semibold text-black">Allow camera</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => router.push('/permissions')}
            className="rounded-full bg-white/15 px-5 py-3"
          >
            <Text className="font-semibold text-white">Open permissions help</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (!device) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-black">
        <ActivityIndicator color="#fff" />
        <Text className="text-white/70">Looking for a camera…</Text>
        <Text className="px-8 text-center text-xs text-white/40">
          Simulator has no camera. Run on a physical iPhone with a Dev Client build.
        </Text>
      </View>
    );
  }

  const displayHistogram = liveHistogram ?? histogram;

  return (
    <View className="flex-1 bg-black">
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isFocused}
        outputs={[photoOutput, videoOutput]}
        constraints={constraints}
        zoom={zoom}
        torchMode={capabilities.hasTorch ? (settings.torchOn ? 'on' : 'off') : undefined}
        mirrorMode={settings.mirrorMode}
        enableLowLightBoost={
          capabilities.supportsLowLightBoost ? settings.lowLightBoost : undefined
        }
        enableDistortionCorrection={
          capabilities.supportsDistortionCorrection ? settings.distortionCorrection : undefined
        }
        enableNativeTapToFocusGesture={false}
        enableNativeZoomGesture={false}
        onConfigured={onSessionConfigured}
        onStarted={() => setControllerReady((n) => n + 1)}
        onError={(error) => setStatus(error.message)}
      />

      <GestureDetector gesture={previewGestures}>
        <View style={StyleSheet.absoluteFill} collapsable={false} />
      </GestureDetector>

      {settings.showAspectCrop ? <AspectCropOverlay aspect={settings.aspect} /> : null}
      <LookOverlay overlay={look.overlay} strength={settings.lookStrength} />
      {settings.showCrosshair ? <StabilizationCrosshairOverlay /> : null}
      {settings.showGrid ? <GridOverlay /> : null}
      {settings.showLevel ? <LevelOverlay /> : null}
      {settings.showZebras ? <ZebraOverlay intensity={zebraIntensity} /> : null}
      {settings.showPeaking ? (
        <PeakingOverlay
          intensity={peakIntensity}
          focusY={
            focusReticle
              ? Math.min(0.95, Math.max(0.05, focusReticle.y / Math.max(1, insets.top + 700)))
              : 0.5
          }
        />
      ) : null}
      {settings.showHistogram ? <HistogramOverlay bins={displayHistogram} /> : null}
      <FocusReticle state={focusReticle} />
      <CountdownOverlay seconds={countdown} />
      {countdown != null ? (
        <Pressable
          onPress={() => {
            cancelCountdownRef.current = true;
          }}
          style={StyleSheet.absoluteFill}
          className="z-20"
        />
      ) : null}

      <View
        pointerEvents="box-none"
        className="absolute left-0 right-0 top-0 z-10 flex-row items-center px-3"
        style={{ paddingTop: insets.top + 4 }}
      >
        <View className="min-h-9 flex-1 flex-row items-center gap-2">
          <Pressable
            onPress={() => router.push('/settings')}
            className="h-9 w-9 items-center justify-center rounded-full bg-black/45"
          >
            <Icon as={Settings} className="text-white" size={18} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/gallery' as Href)}
            className="h-9 w-9 items-center justify-center rounded-full bg-black/45"
          >
            <Icon as={Images} className="text-white" size={18} />
          </Pressable>
        </View>
        <View className="items-center px-2">
          <ModeToggle mode={mode} onChange={setMode} />
          {activeLens ? (
            <Text className="mt-0.5 text-[10px] font-semibold text-sky-300">
              {activeLens.label}
              {activeLens.focalLengthMm && activeLens.position === 'back'
                ? ` · ${activeLens.hint}`
                : ''}
              {aeAfLocked ? ' · AE/AF Lock' : ''}
            </Text>
          ) : null}
        </View>
        <View className="min-h-9 flex-1 flex-row items-center justify-end">
          <Pressable
            onPress={aeAfLocked ? () => void unlockAeAf() : onFlip}
            className="h-9 w-9 items-center justify-center rounded-full bg-black/45"
          >
            <Icon as={FlipHorizontal2} className="text-white" size={18} />
          </Pressable>
        </View>
      </View>

      <View
        pointerEvents="box-none"
        className="absolute bottom-0 left-0 right-0 z-10 gap-1.5 px-3"
        style={{ paddingBottom: insets.bottom + 8 }}
      >
        {status ? <Text className="text-center text-[11px] text-white/70">{status}</Text> : null}

        <CaptureToolbar
          flashMode={settings.flashMode}
          torchOn={settings.torchOn}
          timerSeconds={settings.timerSeconds}
          aspect={settings.aspect}
          burstCount={settings.burstCount}
          capabilities={capabilities}
          onFlashChange={(flashMode) => patchSettings({ flashMode })}
          onTorchChange={(torchOn) => patchSettings({ torchOn })}
          onTimerChange={(timerSeconds) => patchSettings({ timerSeconds })}
          onAspectChange={(aspect) => patchSettings({ aspect })}
          onBurstChange={(burstCount) => patchSettings({ burstCount })}
        />

        <ScenePresetChips
          presets={presets}
          onApply={applyCameraPreset}
          onOpenAll={() => setPresetsOpen(true)}
        />

        <LookPresets
          activeId={settings.lookId}
          scene={lookScene}
          onSceneChange={setLookScene}
          onChange={onLookChange}
        />
        {settings.lookId !== 'none' ? (
          <LookStrengthSlider
            value={settings.lookStrength}
            onChange={(lookStrength) => patchSettings({ lookStrength })}
          />
        ) : null}

        <ZoomSwitcher
          majors={zoomMajors}
          zoom={zoom}
          zoomSV={zoomSV}
          device={device}
          wideFocalMm={wideFocalMm}
          minZoom={minZoom}
          maxZoom={maxZoom}
          onChange={setZoom}
          onLiveZoom={applyLiveZoom}
        />

        <LensSwitcher lenses={lenses} activeId={activeLens?.id} onChange={onSelectLens} />

        {showManual ? (
          <ManualControls value={manual} capabilities={capabilities} onChange={onManualChange} />
        ) : null}

        <View className="relative h-16 w-full items-center justify-center">
          <View className="absolute left-1 top-0 bottom-0 justify-center">
            <LastShotButton
              shot={lastShot}
              onPress={() => {
                setPostCaptureOpen(false);
                setReviewOpen(true);
              }}
            />
          </View>

          <CaptureButton
            mode={mode}
            isRecording={isRecording}
            onPress={onCapture}
            disabled={!sessionReady || isCapturing}
          />

          <View className="absolute right-1 top-0 bottom-0 flex-row items-center gap-2">
            <Pressable
              onPress={() => setPresetsOpen(true)}
              className="h-10 w-10 items-center justify-center rounded-xl bg-black/45"
            >
              <Icon as={Bookmark} size={18} className="text-white" />
            </Pressable>
            <Pressable
              onPress={() => setShowManual((v) => !v)}
              className="h-10 w-10 items-center justify-center rounded-xl bg-black/45"
            >
              <Icon
                as={SlidersHorizontal}
                size={18}
                className={showManual || manual.enabled ? 'text-amber-400' : 'text-white'}
              />
            </Pressable>
          </View>
        </View>
      </View>

      <ReviewModal
        visible={reviewOpen}
        recents={recents}
        initialId={lastShot?.id}
        onClose={() => setReviewOpen(false)}
        onDelete={async (id) => {
          await dismiss(id);
        }}
        onToggleFavorite={async (id) => {
          await toggleFavoriteRecent(id);
          await refresh();
        }}
      />

      <ReviewModal
        visible={postCaptureOpen}
        recents={recents}
        initialId={lastShot?.id}
        postCapture
        onClose={() => setPostCaptureOpen(false)}
        onToggleFavorite={async (id) => {
          await toggleFavoriteRecent(id);
          await refresh();
        }}
      />

      <CameraPresetsDialog
        visible={presetsOpen}
        presets={presets}
        suggestedName={defaultPresetName()}
        onClose={() => setPresetsOpen(false)}
        onSaveCurrent={(name) => void saveCurrentPreset(name)}
        onApply={applyCameraPreset}
        onRename={(preset, name) => void renamePreset(preset, name)}
        onDelete={(preset) => void removePreset(preset)}
      />
    </View>
  );
}

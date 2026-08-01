import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useIsFocused, useRouter, type Href } from 'expo-router';
import {
  Bookmark,
  FlipHorizontal2,
  Images,
  Settings,
  SlidersHorizontal,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Pressable,
  StyleSheet,
  View,
  type AppStateStatus,
  type LayoutChangeEvent,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, useCameraPermission, useMicrophonePermission } from 'react-native-vision-camera';

import { toggleFavoriteRecent } from '@/entities/capture';
import {
  AspectCropOverlay,
  BakeOverlay,
  CameraPresetsDialog,
  CaptureButton,
  CaptureToolbar,
  CountdownOverlay,
  FocusReticle,
  GridOverlay,
  LevelOverlay,
  LookOverlay,
  LookPresets,
  ManualControls,
  ModeToggle,
  PeakingOverlay,
  RecordingTimerBadge,
  ScenePresetChips,
  StabilizationCrosshairOverlay,
  aspectFrameLayout,
  bakeStrengthForLook,
  clamp,
  defaultPresetName,
  isAnimeMlLook,
  useCaptureSettings,
  useVolumeShutter,
  type CaptureMode,
  type LookPresetId,
  type LookSceneId,
} from '@/features/camera';
import { LastShotButton, ReviewModal, useRecents } from '@/features/media';
import { Icon } from '@/shared/ui/icon';
import { Text } from '@/shared/ui/text';

import {
  useCameraCapture,
  useCameraManual,
  useCameraPresets,
  useCameraSession,
  useCameraZoom,
  useLiveOverlays,
  usePreviewInteraction,
} from '../model';
import { bakePhaseLabel, captureStatus } from '../model/captureStatus';
import { CameraPermissionView } from './CameraPermissionView';
import { CameraUnavailableView } from './CameraUnavailableView';

export function CameraScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { settings, patchSettings, setSettings } = useCaptureSettings();
  const { lastShot, recents, addCapture, dismiss, refresh } = useRecents();

  const { hasPermission, requestPermission, canRequestPermission } = useCameraPermission();
  const mic = useMicrophonePermission();

  const [mode, setMode] = useState<CaptureMode>('photo');
  const [status, setStatus] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [postCaptureOpen, setPostCaptureOpen] = useState(false);
  const [lookScene, setLookScene] = useState<LookSceneId>('all');
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  // Sync gate for manual apply: ref for onStarted, state so useCameraManual can defer.
  const isCapturingRef = useRef(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const cameraActive = isFocused && appState === 'active';

  const onPreviewLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setPreviewSize((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  }, []);

  // Session needs setZoom before zoom hook exists — bridge via ref.
  const setZoomRef = useRef<(next: number | ((prev: number) => number)) => void>(() => {});
  const setZoom = useCallback((next: number | ((prev: number) => number)) => {
    setZoomRef.current(next);
  }, []);

  const session = useCameraSession({
    mode,
    settings,
    hasMicrophonePermission: mic.hasPermission,
    setZoom,
    setStatus,
    patchSettings,
  });

  const zoom = useCameraZoom({
    cameraRef: session.cameraRef,
    minZoom: session.minZoom,
    maxZoom: session.maxZoom,
  });
  setZoomRef.current = zoom.setZoom;

  const manual = useCameraManual({
    cameraRef: session.cameraRef,
    device: session.device,
    sessionReady: session.sessionReady,
    controllerReady: session.controllerReady,
    lookId: settings.lookId,
    isCapturing,
    setStatus,
    patchSettings,
  });

  const onModeChange = useCallback(
    (next: CaptureMode) => {
      // Keep lookId in store — video bake already skips Anime ML; restore on photo return.
      if (next === 'video' && isAnimeMlLook(settings.lookId)) {
        setStatus(captureStatus.animeMlPhotoOnly());
      }
      setMode(next);
    },
    [settings.lookId],
  );

  const onLookChange = useCallback(
    (nextLookId: LookPresetId) => {
      if (isAnimeMlLook(nextLookId) && mode === 'video') {
        setMode('photo');
      }
      manual.onLookChange(nextLookId);
    },
    [manual.onLookChange, mode],
  );

  const capture = useCameraCapture({
    cameraRef: session.cameraRef,
    mode,
    settings,
    sessionReady: session.sessionReady,
    activeLens: session.activeLens,
    capabilities: session.capabilities,
    wideFocalMm: session.wideFocalMm,
    manual: manual.manual,
    photoOutput: session.photoOutput,
    videoOutput: session.videoOutput,
    mic,
    isCapturingRef,
    onCapturingChange: setIsCapturing,
    setStatus,
    addCapture,
    setPostCaptureOpen,
  });

  const bakeOverlayLabel =
    capture.bakePhase && !capture.isRecording ? bakePhaseLabel(capture.bakePhase) : null;

  const preview = usePreviewInteraction({
    cameraRef: session.cameraRef,
    manualEnabled: manual.manual.enabled,
    countdown: capture.countdown,
    isCapturing: capture.isCapturing,
    setStatus,
  });

  const overlays = useLiveOverlays({
    cameraRef: session.cameraRef,
    settings,
    sessionReady: session.sessionReady,
    manual: manual.manual,
    aeAfLocked: preview.aeAfLocked,
  });

  const presets = useCameraPresets({
    settings,
    mode,
    manual: manual.manual,
    getZoom: zoom.getZoom,
    activeLens: session.activeLens,
    lenses: session.lenses,
    setSettings,
    setMode,
    onManualChange: manual.onManualChange,
    setZoom: zoom.setZoom,
    onSelectLens: session.onSelectLens,
    setStatus,
    patchSettings,
  });

  const onFlipOrUnlock = useCallback(async () => {
    if (preview.aeAfLocked) {
      if (isCapturingRef.current || capture.isCapturing) return;
      await preview.unlockAeAf();
      return;
    }
    session.onFlip();
  }, [capture.isCapturing, preview.aeAfLocked, preview.unlockAeAf, session.onFlip]);

  const onToggleFavorite = useCallback(
    async (id: string) => {
      await toggleFavoriteRecent(id);
      await refresh();
    },
    [refresh],
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', setAppState);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!cameraActive) return;
    activateKeepAwakeAsync('iris-camera');

    return () => {
      deactivateKeepAwake('iris-camera');
    };
  }, [cameraActive]);

  // Ask for mic early so video output can enableAudio before the first record.
  useEffect(() => {
    if (!hasPermission || mic.hasPermission || !mic.canRequestPermission) return;
    mic.requestPermission().catch(() => {});
  }, [hasPermission, mic.hasPermission, mic.canRequestPermission, mic.requestPermission]);

  useVolumeShutter({
    enabled: cameraActive && settings.volumeShutter && hasPermission && !!session.device,
    onShutter: capture.onCapture,
  });

  if (!hasPermission) {
    return (
      <CameraPermissionView
        canRequestPermission={canRequestPermission}
        requestPermission={requestPermission}
      />
    );
  }

  if (!session.device) {
    return <CameraUnavailableView />;
  }

  const device = session.device;
  const frame = aspectFrameLayout(previewSize.width, previewSize.height, settings.aspect);
  const hasFrame = frame.width > 0;
  const frameStyle = hasFrame
    ? {
        position: 'absolute' as const,
        top: frame.top,
        left: frame.left,
        width: frame.width,
        height: frame.height,
      }
    : null;
  const peakingFocusY = preview.focusReticle
    ? clamp(preview.focusReticle.y / frame.height, 0.05, 0.95)
    : 0.5;

  return (
    <View className="flex-1 bg-black" onLayout={onPreviewLayout}>
      {hasFrame && frameStyle ? (
        <View style={frameStyle}>
          <GestureDetector gesture={preview.previewGestures}>
            <Camera
              ref={session.cameraRef}
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={cameraActive}
              outputs={[session.photoOutput, session.videoOutput]}
              constraints={session.constraints}
              torchMode={
                session.capabilities.hasTorch ? (settings.torchOn ? 'on' : 'off') : undefined
              }
              mirrorMode={settings.mirrorMode}
              enableLowLightBoost={
                session.capabilities.supportsLowLightBoost ? settings.lowLightBoost : undefined
              }
              enableDistortionCorrection={
                session.capabilities.supportsDistortionCorrection
                  ? settings.distortionCorrection
                  : undefined
              }
              enableNativeTapToFocusGesture={false}
              enableNativeZoomGesture
              onConfigured={session.onSessionConfigured}
              onStarted={() => {
                // Android briefly restarts after takePicture — skip re-apply mid-bake.
                if (isCapturingRef.current) return;
                session.setControllerReady((n) => n + 1);
              }}
              onError={(error) => setStatus(error.message)}
            />
          </GestureDetector>

          <FocusReticle state={preview.focusReticle} />
        </View>
      ) : null}

      {settings.showAspectCrop ? (
        <AspectCropOverlay
          aspect={settings.aspect}
          width={previewSize.width}
          height={previewSize.height}
        />
      ) : null}
      {hasFrame && frameStyle ? (
        <View
          pointerEvents="none"
          style={{
            ...frameStyle,
            overflow: 'hidden',
          }}
        >
          <LookOverlay
            overlay={capture.look.overlay}
            strength={bakeStrengthForLook(capture.look, settings.lookStrength)}
            animeMl={isAnimeMlLook(capture.look)}
          />
          {settings.showPeaking ? (
            <PeakingOverlay intensity={overlays.peakIntensity} focusY={peakingFocusY} />
          ) : null}
        </View>
      ) : null}
      {settings.showCrosshair ? <StabilizationCrosshairOverlay active={cameraActive} /> : null}
      {settings.showGrid ? (
        <GridOverlay
          aspect={settings.aspect}
          width={previewSize.width}
          height={previewSize.height}
        />
      ) : null}
      {settings.showLevel ? <LevelOverlay active={cameraActive} /> : null}
      <CountdownOverlay seconds={capture.countdown} />
      <BakeOverlay label={bakeOverlayLabel} />
      {capture.countdown != null ? (
        <Pressable
          onPress={capture.cancelCountdown}
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
          <RecordingTimerBadge active={capture.isRecording} />
          {!capture.isRecording ? (
            <>
              <ModeToggle mode={mode} onChange={onModeChange} />
              {session.activeLens ? (
                <Text className="mt-0.5 text-[10px] font-semibold text-sky-300">
                  {session.activeLens.label}
                  {preview.aeAfLocked ? ' · AE/AF Lock' : ''}
                </Text>
              ) : null}
            </>
          ) : null}
        </View>
        <View className="min-h-9 flex-1 flex-row items-center justify-end">
          <Pressable
            onPress={onFlipOrUnlock}
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
        {status && !bakeOverlayLabel ? (
          <Text className="text-center text-[11px] text-white/70">{status}</Text>
        ) : null}

        <CaptureToolbar
          flashMode={settings.flashMode}
          torchOn={settings.torchOn}
          timerSeconds={settings.timerSeconds}
          aspect={settings.aspect}
          burstCount={settings.burstCount}
          capabilities={session.capabilities}
          onFlashChange={(flashMode) => patchSettings({ flashMode })}
          onTorchChange={(torchOn) => patchSettings({ torchOn })}
          onTimerChange={(timerSeconds) => patchSettings({ timerSeconds })}
          onAspectChange={(aspect) => patchSettings({ aspect })}
          onBurstChange={(burstCount) => patchSettings({ burstCount })}
        />

        <ScenePresetChips
          presets={presets.presets}
          onApply={presets.applyCameraPreset}
          onOpenAll={() => presets.setPresetsOpen(true)}
        />

        <LookPresets
          activeId={settings.lookId}
          scene={lookScene}
          mode={mode}
          onSceneChange={setLookScene}
          onChange={onLookChange}
        />

        {manual.showManual ? (
          <ManualControls
            value={manual.manual}
            capabilities={session.capabilities}
            onChange={manual.onManualChange}
          />
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
            isRecording={capture.isRecording}
            onPress={capture.onCapture}
            disabled={!session.sessionReady || capture.isCapturing}
          />

          <View className="absolute right-1 top-0 bottom-0 flex-row items-center gap-2">
            <Pressable
              onPress={() => presets.setPresetsOpen(true)}
              className="h-10 w-10 items-center justify-center rounded-xl bg-black/45"
            >
              <Icon as={Bookmark} size={18} className="text-white" />
            </Pressable>
            <Pressable
              onPress={() => manual.setShowManual((v) => !v)}
              className="h-10 w-10 items-center justify-center rounded-xl bg-black/45"
            >
              <Icon
                as={SlidersHorizontal}
                size={18}
                className={
                  manual.showManual || manual.manual.enabled ? 'text-amber-400' : 'text-white'
                }
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
        onToggleFavorite={onToggleFavorite}
      />

      <ReviewModal
        visible={postCaptureOpen}
        recents={recents}
        initialId={lastShot?.id}
        postCapture
        onClose={() => setPostCaptureOpen(false)}
        onToggleFavorite={onToggleFavorite}
      />

      <CameraPresetsDialog
        visible={presets.presetsOpen}
        presets={presets.presets}
        suggestedName={defaultPresetName()}
        onClose={() => presets.setPresetsOpen(false)}
        onSaveCurrent={presets.saveCurrentPreset}
        onApply={presets.applyCameraPreset}
        onRename={presets.renamePreset}
        onDelete={presets.removePreset}
      />
    </View>
  );
}

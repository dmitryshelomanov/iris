import { useIsFocused, useRouter, type Href } from 'expo-router';
import {
  Bookmark,
  FlipHorizontal2,
  Images,
  Settings,
  SlidersHorizontal,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, View, type AppStateStatus } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, useCameraPermission, useMicrophonePermission } from 'react-native-vision-camera';

import { toggleFavoriteRecent } from '@/entities/capture';
import {
  AspectCropOverlay,
  CameraPresetsDialog,
  CaptureButton,
  CaptureToolbar,
  CountdownOverlay,
  FocusReticle,
  GridOverlay,
  LensSwitcher,
  LevelOverlay,
  LookOverlay,
  LookPresets,
  LookStrengthSlider,
  ManualControls,
  ModeToggle,
  PeakingOverlay,
  RecordingTimerBadge,
  ScenePresetChips,
  StabilizationCrosshairOverlay,
  ZoomSwitcher,
  defaultPresetName,
  useCaptureSettings,
  useVolumeShutter,
  type CaptureMode,
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
import { CameraPermissionView } from './CameraPermissionView';
import { CameraUnavailableView } from './CameraUnavailableView';

/** Approximate preview height used to map focus reticle Y → peaking plane (0…1). */
const PREVIEW_HEIGHT_ESTIMATE = 700;

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
  // Sync gate for manual apply (ref) + UI disable (state via capture.isCapturing).
  const isCapturingRef = useRef(false);
  const cameraActive = isFocused && appState === 'active';

  // Session needs setZoom before zoom hook exists — bridge via ref.
  const setZoomRef = useRef<(next: number | ((prev: number) => number)) => void>(() => {});
  const setZoom = useCallback((next: number | ((prev: number) => number)) => {
    setZoomRef.current(next);
  }, []);

  const session = useCameraSession({
    mode,
    settings,
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
    isCapturingRef,
    setStatus,
    patchSettings,
  });

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
    setStatus,
    addCapture,
    setPostCaptureOpen,
  });

  const preview = usePreviewInteraction({
    cameraRef: session.cameraRef,
    manualEnabled: manual.manual.enabled,
    countdown: capture.countdown,
    isCapturing: capture.isCapturing,
    setStatus,
    zoomSV: zoom.zoomSV,
    pinchStartZoom: zoom.pinchStartZoom,
    minZoomSV: zoom.minZoomSV,
    maxZoomSV: zoom.maxZoomSV,
    applyLiveZoom: zoom.applyLiveZoom,
    syncZoomFromPinchThrottled: zoom.syncZoomFromPinchThrottled,
    syncZoomFromGesture: zoom.syncZoomFromGesture,
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
    zoom: zoom.zoom,
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
      await preview.unlockAeAf();
      return;
    }
    session.onFlip();
  }, [preview.aeAfLocked, preview.unlockAeAf, session.onFlip]);

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

  return (
    <View className="flex-1 bg-black">
      <Camera
        ref={session.cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={cameraActive}
        outputs={[session.photoOutput, session.videoOutput]}
        constraints={session.constraints}
        zoom={zoom.zoom}
        torchMode={session.capabilities.hasTorch ? (settings.torchOn ? 'on' : 'off') : undefined}
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
        enableNativeZoomGesture={false}
        onConfigured={session.onSessionConfigured}
        onStarted={() => session.setControllerReady((n) => n + 1)}
        onError={(error) => setStatus(error.message)}
      />

      <GestureDetector gesture={preview.previewGestures}>
        <View style={StyleSheet.absoluteFill} collapsable={false} />
      </GestureDetector>

      {settings.showAspectCrop ? <AspectCropOverlay aspect={settings.aspect} /> : null}
      <LookOverlay overlay={capture.look.overlay} strength={settings.lookStrength} />
      {settings.showCrosshair ? <StabilizationCrosshairOverlay active={cameraActive} /> : null}
      {settings.showGrid ? <GridOverlay /> : null}
      {settings.showLevel ? <LevelOverlay active={cameraActive} /> : null}
      {settings.showPeaking ? (
        <PeakingOverlay
          intensity={overlays.peakIntensity}
          focusY={
            preview.focusReticle
              ? Math.min(
                  0.95,
                  Math.max(
                    0.05,
                    preview.focusReticle.y / Math.max(1, insets.top + PREVIEW_HEIGHT_ESTIMATE),
                  ),
                )
              : 0.5
          }
        />
      ) : null}
      <FocusReticle state={preview.focusReticle} />
      <CountdownOverlay seconds={capture.countdown} />
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
              <ModeToggle mode={mode} onChange={setMode} />
              {session.activeLens ? (
                <Text className="mt-0.5 text-[10px] font-semibold text-sky-300">
                  {session.activeLens.label}
                  {session.activeLens.focalLengthMm && session.activeLens.position === 'back'
                    ? ` · ${session.activeLens.hint}`
                    : ''}
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
        {status ? <Text className="text-center text-[11px] text-white/70">{status}</Text> : null}

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
          onSceneChange={setLookScene}
          onChange={manual.onLookChange}
        />
        {settings.lookId !== 'none' ? (
          <LookStrengthSlider
            value={settings.lookStrength}
            onChange={(lookStrength) => patchSettings({ lookStrength })}
          />
        ) : null}

        <ZoomSwitcher
          majors={session.zoomMajors}
          zoom={zoom.zoom}
          zoomSV={zoom.zoomSV}
          device={device}
          wideFocalMm={session.wideFocalMm}
          minZoom={session.minZoom}
          maxZoom={session.maxZoom}
          onChange={zoom.setZoom}
          onLiveZoom={zoom.applyLiveZoom}
        />

        <LensSwitcher
          lenses={session.lenses}
          activeId={session.activeLens?.id}
          onChange={session.onSelectLens}
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

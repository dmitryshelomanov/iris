import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { CameraRef } from 'react-native-vision-camera';

import {
  applyLookToManual,
  applyManualToController,
  DEFAULT_EXPOSURE_UI_LIMITS,
  DEFAULT_MANUAL_STATE,
  exposureLimitsFromController,
  isCameraControlCanceled,
  seedManualFromController,
  type ExposureUiLimits,
  type LookPresetId,
  type ManualControlsState,
} from '@/features/camera';
import { errorMessage } from '@/shared/lib/errorMessage';

type Options = {
  cameraRef: RefObject<CameraRef | null>;
  device: { id: string } | undefined;
  sessionReady: boolean;
  controllerReady: number;
  lookId: LookPresetId;
  /** When true, skip controller apply; re-run after capture/bake ends. */
  isCapturing: boolean;
  /** Switch to a physical lens that can lock focus (Pro dial). */
  ensureManualFocusLens: () => 'ready' | 'switched' | 'unavailable';
  /** Restore Multi / previous lens after leaving Pro manual. */
  restoreLensAfterManual: () => void;
  setStatus: (status: string | null) => void;
  patchSettings: (patch: { lookId: LookPresetId }) => void;
};

type PendingApply = {
  state: ManualControlsState;
  requireFocusLock: boolean;
  requireExposureLock: boolean;
};

function resolveManualNext(
  prev: ManualControlsState,
  next: ManualControlsState,
  controller: NonNullable<CameraRef['controller']> | undefined,
  skipSeed: boolean,
): ManualControlsState {
  if (next.enabled && !prev.enabled && controller && !skipSeed) {
    const seeded = seedManualFromController(controller, next);
    const dialChanged =
      next.iso !== prev.iso ||
      next.shutter !== prev.shutter ||
      next.focus !== prev.focus ||
      next.ev !== prev.ev ||
      next.wbKelvin !== prev.wbKelvin ||
      next.wbTint !== prev.wbTint;
    // Tile-only enable → seed from live AE/AF. Wheel/dial → keep the new values.
    return dialChanged ? { ...seeded, ...next, enabled: true } : seeded;
  }
  return next;
}

/**
 * Latest-wins serial apply — pan gestures coalesce to one native lock pass so
 * AVCaptureDevice configuration locks are not flooded.
 */
export function useCameraManual({
  cameraRef,
  device,
  sessionReady,
  controllerReady,
  lookId,
  isCapturing,
  ensureManualFocusLens,
  restoreLensAfterManual,
  setStatus,
  patchSettings,
}: Options) {
  const [manual, setManualState] = useState<ManualControlsState>(DEFAULT_MANUAL_STATE);
  const [exposureLimits, setExposureLimits] =
    useState<ExposureUiLimits>(DEFAULT_EXPOSURE_UI_LIMITS);

  const manualRef = useRef(manual);
  manualRef.current = manual;

  const lookIdRef = useRef(lookId);
  lookIdRef.current = lookId;
  const isCapturingRef = useRef(isCapturing);
  isCapturingRef.current = isCapturing;
  const sessionReadyRef = useRef(sessionReady);
  sessionReadyRef.current = sessionReady;
  const deviceRef = useRef(device);
  deviceRef.current = device;

  const pendingRef = useRef<PendingApply | null>(null);
  const runningRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const applyGen = useRef(0);
  /** After tap-to-focus, skip setFocusLocked until the Focus dial moves again. */
  const afOverridesFocusLockRef = useRef(false);
  /** Seed from the new lens after Multi → physical switch (old controller is stale). */
  const needsReseedRef = useRef(false);

  const refreshExposureLimits = useCallback(() => {
    setExposureLimits(exposureLimitsFromController(cameraRef.current?.controller));
  }, [cameraRef]);

  const runApplyLoop = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      while (pendingRef.current) {
        const pending = pendingRef.current;

        // Keep pending (and sticky require* flags) until the session can apply.
        if (isCapturingRef.current || !sessionReadyRef.current) break;
        const controller = cameraRef.current?.controller;
        if (!controller || !deviceRef.current) break;

        pendingRef.current = null;

        const gen = ++applyGen.current;
        try {
          await applyManualToController(controller, pending.state, {
            lockWhiteBalance: lookIdRef.current !== 'none' || pending.state.enabled,
            requireFocusLock: pending.requireFocusLock,
            requireExposureLock: pending.requireExposureLock,
            skipFocusLock: afOverridesFocusLockRef.current,
          });
          if (gen === applyGen.current) {
            setExposureLimits(exposureLimitsFromController(controller));
          }
        } catch (error) {
          if (gen !== applyGen.current || isCameraControlCanceled(error)) continue;
          setStatus(errorMessage(error, 'Control failed'));
        }
      }
    } finally {
      runningRef.current = false;
      if (pendingRef.current) {
        void runApplyLoop();
      }
    }
  }, [cameraRef, setStatus]);

  const enqueueApply = useCallback(
    (
      state: ManualControlsState,
      flags: { requireFocusLock?: boolean; requireExposureLock?: boolean } = {},
    ) => {
      const prev = pendingRef.current;
      pendingRef.current = {
        state,
        requireFocusLock: Boolean(flags.requireFocusLock || prev?.requireFocusLock),
        requireExposureLock: Boolean(flags.requireExposureLock || prev?.requireExposureLock),
      };
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        void runApplyLoop();
      });
    },
    [runApplyLoop],
  );

  // Re-apply after session/controller/look/capture changes — dial ticks go through enqueueApply.
  useEffect(() => {
    if (isCapturing || !sessionReady || !device) return;

    const controller = cameraRef.current?.controller;
    if (needsReseedRef.current && controller && manualRef.current.enabled) {
      needsReseedRef.current = false;
      const seeded = seedManualFromController(controller, manualRef.current);
      manualRef.current = seeded;
      setManualState(seeded);
      setExposureLimits(exposureLimitsFromController(controller));
      enqueueApply(seeded);
      return;
    }

    refreshExposureLimits();
    enqueueApply(manualRef.current);
  }, [
    cameraRef,
    controllerReady,
    device,
    enqueueApply,
    isCapturing,
    lookId,
    refreshExposureLimits,
    sessionReady,
  ]);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      applyGen.current += 1;
      pendingRef.current = null;
    };
  }, []);

  const onManualChange = useCallback(
    (next: ManualControlsState) => {
      const controller = cameraRef.current?.controller;
      const prev = manualRef.current;
      let skipSeed = false;

      if (next.enabled && !prev.enabled) {
        const lensResult = ensureManualFocusLens();
        if (lensResult === 'unavailable') {
          // Still allow ISO/SS if exposure lock exists on current device.
          if (next.activeControl === 'focus') {
            setStatus('Manual focus not supported on this lens');
          }
        } else if (lensResult === 'switched') {
          // Old Multi controller is stale — seed after the new session attaches.
          skipSeed = true;
          needsReseedRef.current = true;
        }
      } else if (!next.enabled && prev.enabled) {
        restoreLensAfterManual();
        afOverridesFocusLockRef.current = false;
        needsReseedRef.current = false;
      }

      // Focus dial reclaims lens lock from tap-to-focus.
      if (next.enabled && next.focus !== prev.focus) {
        afOverridesFocusLockRef.current = false;
      }

      const resolved = resolveManualNext(prev, next, controller ?? undefined, skipSeed);
      manualRef.current = resolved;
      setManualState(resolved);

      // While session restarts after lens switch, enqueue still stores state;
      // effect re-applies when sessionReady / controllerReady bounce back.
      enqueueApply(resolved, {
        requireFocusLock: resolved.enabled && resolved.focus !== prev.focus,
        requireExposureLock:
          resolved.enabled && (resolved.iso !== prev.iso || resolved.shutter !== prev.shutter),
      });
    },
    [cameraRef, enqueueApply, ensureManualFocusLens, restoreLensAfterManual, setStatus],
  );

  /** Tap-to-focus while Pro is on — pause lens-position lock until Focus dial moves. */
  const onTapFocusWhileManual = useCallback(() => {
    if (!manualRef.current.enabled) return;
    afOverridesFocusLockRef.current = true;
  }, []);

  /** Clear after AE/AF unlock / flip so Focus dial can reclaim lens lock. */
  const clearAfFocusOverride = useCallback(() => {
    afOverridesFocusLockRef.current = false;
  }, []);

  const onLookChange = useCallback(
    (nextLookId: LookPresetId) => {
      patchSettings({ lookId: nextLookId });
      setManualState((prev) => {
        const next = applyLookToManual(prev, nextLookId);
        manualRef.current = next;
        return next;
      });
    },
    [patchSettings],
  );

  return {
    manual,
    exposureLimits,
    onManualChange,
    onLookChange,
    onTapFocusWhileManual,
    clearAfFocusOverride,
  };
}

import type { CameraController } from 'react-native-vision-camera';

import { clamp, type ManualControlsState } from './types';

/** Android CameraX cancels focus ops when the session is briefly inactive (e.g. after takePicture). */
export function isCameraControlCanceled(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /not active|canceled|cancelled/i.test(msg);
}

async function safeResetFocus(controller: CameraController): Promise<void> {
  try {
    await controller.resetFocus();
  } catch (error) {
    if (isCameraControlCanceled(error)) return;
    throw error;
  }
}

async function safeCall(label: string, fn: () => Promise<void>, errors: string[]): Promise<void> {
  try {
    await fn();
  } catch (error) {
    if (isCameraControlCanceled(error)) return;
    errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Ease UI focus toward macro so distant scenes soften earlier on large-DOF phone lenses.
 * UI 0 = far/infinity, 1 = near/macro. Exponent < 1 → mid dial already leans near.
 */
const FOCUS_UI_GAMMA = 0.55;

function uiFocusShape(uiFocus: number): number {
  return Math.pow(clamp(uiFocus, 0, 1), FOCUS_UI_GAMMA);
}

/**
 * UI Focus dial → VisionCamera lensPosition.
 * VisionCamera: 0 = closest, 1 = furthest (opposite of UI).
 */
export function uiFocusToLens(uiFocus: number): number {
  return clamp(1 - uiFocusShape(uiFocus), 0, 1);
}

export function lensToUiFocus(lens: number): number {
  const shaped = clamp(1 - lens, 0, 1);
  return clamp(Math.pow(shaped, 1 / FOCUS_UI_GAMMA), 0, 1);
}

export type ApplyManualOptions = {
  lockWhiteBalance: boolean;
  /** When Focus dial moved — fail loudly if lens lock unavailable. */
  requireFocusLock?: boolean;
  /** When ISO/SS dial moved — fail loudly if exposure lock unavailable. */
  requireExposureLock?: boolean;
  /** Tap-to-focus temporarily owns AF — do not re-lock lens position. */
  skipFocusLock?: boolean;
};

/**
 * Push Pro / look dials into VisionCamera's CameraController.
 * Manual on → lock ISO/shutter/focus/WB. Manual off → reset 3A, keep EV (+ optional WB for looks).
 *
 * Each lock is independent — exposure failure must not skip focus (live AF dial).
 */
export async function applyManualToController(
  controller: CameraController,
  state: ManualControlsState,
  options: ApplyManualOptions,
): Promise<void> {
  const device = controller.device;
  const errors: string[] = [];

  if (state.enabled) {
    // Focus first so the dial updates the live preview immediately.
    if (options.skipFocusLock) {
      // Tap-to-focus / AE-AF owns the lens — leave AF alone (keep ISO/SS/WB locks).
    } else if (device.supportsFocusLocking) {
      await safeCall(
        'Focus',
        () => controller.setFocusLocked(uiFocusToLens(state.focus)),
        errors,
      );
    } else if (options.requireFocusLock) {
      errors.push('Manual focus not supported on this lens');
    }

    if (device.supportsExposureLocking) {
      const duration = clamp(
        state.shutter,
        controller.minExposureDuration || state.shutter,
        controller.maxExposureDuration || state.shutter,
      );
      const iso = clamp(state.iso, controller.minISO || state.iso, controller.maxISO || state.iso);
      await safeCall('Exposure', () => controller.setExposureLocked(duration, iso), errors);
    } else if (options.requireExposureLock) {
      errors.push('Manual ISO / shutter not supported on this lens');
    } else if (device.supportsExposureBias) {
      await safeCall(
        'EV',
        () =>
          controller.setExposureBias(
            clamp(state.ev, device.minExposureBias, device.maxExposureBias),
          ),
        errors,
      );
    }

    if (device.supportsWhiteBalanceLocking) {
      const gains = controller.convertWhiteBalanceTemperatureAndTintValues({
        temperature: clamp(state.wbKelvin, 2500, 8000),
        tint: clamp(state.wbTint, -150, 150),
      });
      await safeCall('WB', () => controller.setWhiteBalanceLocked(gains), errors);
    }

    if (errors.length > 0) {
      throw new Error(errors.join(' · '));
    }
    return;
  }

  // Auto 3A — resetFocus unlocks AE/AF/AWB (including look Kelvin locks).
  await safeResetFocus(controller);

  if (device.supportsExposureBias) {
    await safeCall(
      'EV',
      () =>
        controller.setExposureBias(clamp(state.ev, device.minExposureBias, device.maxExposureBias)),
      errors,
    );
  }

  if (options.lockWhiteBalance && device.supportsWhiteBalanceLocking) {
    const gains = controller.convertWhiteBalanceTemperatureAndTintValues({
      temperature: clamp(state.wbKelvin, 2500, 8000),
      tint: clamp(state.wbTint, -150, 150),
    });
    await safeCall('WB', () => controller.setWhiteBalanceLocked(gains), errors);
  }

  if (errors.length > 0) {
    throw new Error(errors.join(' · '));
  }
}

export function seedManualFromController(
  controller: CameraController,
  previous: ManualControlsState,
): ManualControlsState {
  const iso = controller.iso > 0 ? controller.iso : previous.iso;
  const shutter = controller.exposureDuration > 0 ? controller.exposureDuration : previous.shutter;
  // 0.0 is a valid lens position (closest) — don't treat it as "unset".
  const lens = controller.lensPosition;
  const focus = Number.isFinite(lens) ? lensToUiFocus(lens) : previous.focus;
  return {
    ...previous,
    enabled: true,
    iso,
    shutter,
    focus,
    ev: controller.exposureBias,
  };
}

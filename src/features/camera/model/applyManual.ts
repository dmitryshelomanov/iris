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

/**
 * Push Pro / look dials into VisionCamera's CameraController.
 * Manual on → lock ISO/shutter/focus/WB. Manual off → reset 3A, keep EV (+ optional WB for looks).
 */
export async function applyManualToController(
  controller: CameraController,
  state: ManualControlsState,
  options: { lockWhiteBalance: boolean },
): Promise<void> {
  const device = controller.device;

  if (state.enabled) {
    if (device.supportsExposureLocking) {
      const duration = clamp(
        state.shutter,
        controller.minExposureDuration || state.shutter,
        controller.maxExposureDuration || state.shutter,
      );
      const iso = clamp(state.iso, controller.minISO || state.iso, controller.maxISO || state.iso);
      await controller.setExposureLocked(duration, iso);
    } else if (device.supportsExposureBias) {
      await controller.setExposureBias(
        clamp(state.ev, device.minExposureBias, device.maxExposureBias),
      );
    }

    if (device.supportsFocusLocking) {
      await controller.setFocusLocked(clamp(state.focus, 0, 1));
    }

    if (device.supportsWhiteBalanceLocking) {
      const gains = controller.convertWhiteBalanceTemperatureAndTintValues({
        temperature: clamp(state.wbKelvin, 2500, 8000),
        tint: clamp(state.wbTint, -150, 150),
      });
      await controller.setWhiteBalanceLocked(gains);
    }
    return;
  }

  // Auto 3A — resetFocus unlocks AE/AF/AWB (including look Kelvin locks).
  await safeResetFocus(controller);

  if (device.supportsExposureBias) {
    await controller.setExposureBias(
      clamp(state.ev, device.minExposureBias, device.maxExposureBias),
    );
  }

  if (options.lockWhiteBalance && device.supportsWhiteBalanceLocking) {
    const gains = controller.convertWhiteBalanceTemperatureAndTintValues({
      temperature: clamp(state.wbKelvin, 2500, 8000),
      tint: clamp(state.wbTint, -150, 150),
    });
    await controller.setWhiteBalanceLocked(gains);
  }
  // When lockWhiteBalance is false, leave continuous AWB after resetFocus —
  // do not re-lock previous look gains.
}

export function seedManualFromController(
  controller: CameraController,
  previous: ManualControlsState,
): ManualControlsState {
  const iso = controller.iso > 0 ? controller.iso : previous.iso;
  const shutter = controller.exposureDuration > 0 ? controller.exposureDuration : previous.shutter;
  const focus = controller.lensPosition > 0 ? controller.lensPosition : previous.focus;
  return {
    ...previous,
    enabled: true,
    iso,
    shutter,
    focus,
    ev: controller.exposureBias,
  };
}

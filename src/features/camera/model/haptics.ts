import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import IrisLookBake from '../../../../modules/iris-look-bake';

async function safe(run: () => Promise<void> | void) {
  try {
    await run();
  } catch {
    // haptics unavailable (sim / camera session)
  }
}

/** Camera-safe haptic: UIKit generators are muted while AVCapture is active on iOS. */
function cameraSafe(kind: 'peek' | 'pop' | 'nope', android: () => Promise<void>) {
  return safe(() => {
    if (Platform.OS === 'ios') {
      IrisLookBake.playSystemHaptic(kind);
      return;
    }
    return android();
  });
}

export function hapticShutter() {
  return cameraSafe('pop', () =>
    Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm),
  );
}

export function hapticFocusLock() {
  return cameraSafe('peek', () =>
    Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Long_Press),
  );
}

export function hapticRecordStart() {
  return cameraSafe('pop', () =>
    Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Toggle_On),
  );
}

export function hapticRecordStop() {
  return cameraSafe('peek', () =>
    Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Toggle_Off),
  );
}

export function hapticSelect() {
  return safe(() => Haptics.selectionAsync());
}

let lastLevelSnapAt = 0;
const LEVEL_SNAP_COOLDOWN_MS = 450;

/** Soft tick when level / crosshair guides snap into alignment. */
export function hapticLevelSnap() {
  const now = Date.now();
  if (now - lastLevelSnapAt < LEVEL_SNAP_COOLDOWN_MS) return Promise.resolve();
  lastLevelSnapAt = now;
  return cameraSafe('peek', () =>
    Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Clock_Tick),
  );
}

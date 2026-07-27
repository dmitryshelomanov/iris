import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

type Options = {
  enabled: boolean;
  onShutter: () => void;
};

/**
 * Volume buttons (and iPhone Camera Control) act as shutter while the camera is focused.
 * iOS via expo-hardware-buttons; no-op on Android/web.
 */
export function useVolumeShutter({ enabled, onShutter }: Options) {
  const shutterRef = useRef(onShutter);
  shutterRef.current = onShutter;

  useEffect(() => {
    if (!enabled || Platform.OS !== 'ios') return;

    let volumeSub: { remove: () => void } | undefined;
    let cameraSub: { remove: () => void } | undefined;
    let cancelled = false;

    (async () => {
      try {
        const HardwareButtons = (await import('expo-hardware-buttons')).default;
        if (cancelled) return;

        HardwareButtons.attachCameraButton?.();
        volumeSub = HardwareButtons.addListener('onVolumeButton', () => {
          shutterRef.current();
        });
        cameraSub = HardwareButtons.addListener('onCameraButton', (event: { action?: string }) => {
          if (event?.action === 'longPress') return;
          shutterRef.current();
        });
      } catch {
        // Module missing / simulator — ignore
      }
    })();

    return () => {
      cancelled = true;
      volumeSub?.remove();
      cameraSub?.remove();
      import('expo-hardware-buttons')
        .then((m) => m.default.detachCameraButton?.())
        .catch(() => {});
    };
  }, [enabled]);
}

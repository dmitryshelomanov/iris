import { useCallback, useEffect, useState, type RefObject } from 'react';
import type { CameraRef } from 'react-native-vision-camera';

type Options = {
  cameraRef: RefObject<CameraRef | null>;
  minZoom: number;
  maxZoom: number;
};

/**
 * Imperative zoom only — native pinch lives on `<Camera enableNativeZoomGesture />`.
 * Do not pass a controlled `zoom` prop while native zoom is enabled.
 */
export function useCameraZoom({ cameraRef, minZoom, maxZoom }: Options) {
  const [zoom, setZoomState] = useState(1);

  const clampZoom = useCallback(
    (value: number) => Math.min(maxZoom, Math.max(minZoom, value)),
    [maxZoom, minZoom],
  );

  const getZoom = useCallback(() => {
    const live = cameraRef.current?.controller?.zoom;
    if (typeof live === 'number' && Number.isFinite(live)) {
      return clampZoom(live);
    }
    return clampZoom(zoom);
  }, [cameraRef, clampZoom, zoom]);

  const setZoom = useCallback(
    (next: number | ((prev: number) => number)) => {
      setZoomState((prev) => {
        const value = typeof next === 'function' ? next(prev) : next;
        const clamped = clampZoom(value);
        const controller = cameraRef.current?.controller;
        controller?.setZoom(clamped).catch(() => {});
        return clamped;
      });
    },
    [cameraRef, clampZoom],
  );

  useEffect(() => {
    setZoom((z) => clampZoom(z));
  }, [clampZoom, setZoom]);

  return {
    zoom,
    getZoom,
    setZoom,
  };
}

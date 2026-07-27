import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import type { CameraRef } from 'react-native-vision-camera';

type Options = {
  cameraRef: RefObject<CameraRef | null>;
  minZoom: number;
  maxZoom: number;
};

export function useCameraZoom({ cameraRef, minZoom, maxZoom }: Options) {
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

  useEffect(() => {
    setZoom((z) => Math.min(maxZoom, Math.max(minZoom, z)));
  }, [minZoom, maxZoom, setZoom]);

  const syncZoomFromGesture = useCallback((next: number) => {
    setZoomState(next);
  }, []);

  const applyLiveZoom = useCallback(
    (next: number) => {
      const controller = cameraRef.current?.controller;
      if (!controller) return;
      void controller.setZoom(next);
    },
    [cameraRef],
  );

  const syncZoomFromPinchThrottled = useCallback((next: number) => {
    const now = Date.now();
    if (now - lastPinchJsSync.current < 50) return;
    lastPinchJsSync.current = now;
    setZoomState(next);
  }, []);

  return {
    zoom,
    setZoom,
    zoomSV,
    pinchStartZoom,
    minZoomSV,
    maxZoomSV,
    applyLiveZoom,
    syncZoomFromGesture,
    syncZoomFromPinchThrottled,
  };
}

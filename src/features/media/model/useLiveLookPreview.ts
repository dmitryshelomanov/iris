import { useEffect, useRef, useState } from 'react';

import { bakeLookIntoPhoto, type LookOverlayConfig } from '@/features/camera';

type Options = {
  enabled: boolean;
  masterUri: string | null | undefined;
  overlay: LookOverlayConfig;
  strength: number;
  /** When true, skip classical bake — Anime ML is too slow for live dials. */
  animeMl?: boolean;
  /** Stable cache filename stem */
  cacheKey?: string;
  debounceMs?: number;
};

/**
 * Debounced Skia bake of master → cache JPEG for live look dials.
 * Anime ML looks skip bake (caller should show grade overlay / badge instead).
 */
export function useLiveLookPreview({
  enabled,
  masterUri,
  overlay,
  strength,
  animeMl = false,
  cacheKey = 'review',
  debounceMs = 120,
}: Options) {
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const genRef = useRef(0);

  // Stabilize overlay identity — only re-bake when numeric fields change.
  const overlayKey = [
    overlay.contrast,
    overlay.saturation,
    overlay.brightness,
    overlay.warmth,
    overlay.opacity,
    overlay.shadowsOpacity,
    overlay.highlightsOpacity,
    overlay.vignette,
    overlay.mono,
    overlay.grain,
    overlay.grainSize,
    overlay.grainTexture,
    overlay.grainBlur,
    overlay.bloom,
    overlay.leak,
    overlay.stamp,
    overlay.smooth,
    overlay.posterize,
    overlay.edges,
    overlay.color,
    overlay.shadows,
    overlay.highlights,
  ].join('|');

  useEffect(() => {
    if (!enabled || !masterUri || animeMl) {
      setPreviewUri(null);
      setPending(false);
      return;
    }

    const gen = ++genRef.current;
    setPending(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const baked = await bakeLookIntoPhoto(masterUri, overlay, {
            strength,
            jpegQuality: 0.72,
            mlStyle: null,
            previewCacheKey: cacheKey,
          });
          if (gen !== genRef.current) return;
          setPreviewUri(baked.uri);
        } catch (error) {
          if (__DEV__) {
            console.warn('[useLiveLookPreview]', error);
          }
          // Keep last good frame; dials still update via next successful bake.
        } finally {
          if (gen === genRef.current) setPending(false);
        }
      })();
    }, debounceMs);

    return () => {
      clearTimeout(timer);
    };
    // overlayKey stands in for overlay field identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, masterUri, animeMl, overlayKey, strength, cacheKey, debounceMs]);

  useEffect(() => {
    return () => {
      genRef.current += 1;
    };
  }, []);

  return { previewUri, pending, gradeOnly: animeMl };
}

import { useCallback, useMemo, useState } from 'react';

import { getLookPreset, type LookOverlayConfig, type LookPresetId } from '@/features/camera';

import type { GrainOverlayPatch } from './grainOverlayPatch';
import type { LookParamId, LookParamValues } from '../ui/LookParamControls';

export function paramsFromLook(lookId: LookPresetId, strength: number): LookParamValues {
  const overlay = getLookPreset(lookId).overlay;
  return {
    strength,
    grain: overlay.grain,
    grainSize: overlay.grainSize,
    grainTexture: overlay.grainTexture,
    grainBlur: overlay.grainBlur,
  };
}

export function grainPatchFromParams(params: LookParamValues): GrainOverlayPatch {
  return {
    grain: params.grain,
    grainSize: params.grainSize,
    grainTexture: params.grainTexture,
    grainBlur: params.grainBlur,
  };
}

export function paramsFromCapture(
  lookId: LookPresetId,
  strength: number,
  overlayPatch?: GrainOverlayPatch | null,
): LookParamValues {
  const base = paramsFromLook(lookId, strength);
  if (!overlayPatch) return base;
  return {
    ...base,
    grain: overlayPatch.grain ?? base.grain,
    grainSize: overlayPatch.grainSize ?? base.grainSize,
    grainTexture: overlayPatch.grainTexture ?? base.grainTexture,
    grainBlur: overlayPatch.grainBlur ?? base.grainBlur,
  };
}

/**
 * Shared draft state for LookBakeSheet (review rebake + gallery import).
 */
export function useLookBakeDraft(initialLookId: LookPresetId = 'none', initialStrength = 1) {
  const [lookId, setLookId] = useState<LookPresetId>(initialLookId);
  const [params, setParams] = useState<LookParamValues>(() =>
    paramsFromLook(initialLookId, initialStrength),
  );
  const [activeParam, setActiveParam] = useState<LookParamId>('strength');

  const draftOverlay = useMemo((): LookOverlayConfig => {
    const base = getLookPreset(lookId).overlay;
    return {
      ...base,
      grain: params.grain,
      grainSize: params.grainSize,
      grainTexture: params.grainTexture,
      grainBlur: params.grainBlur,
    };
  }, [lookId, params]);

  const syncFromCapture = useCallback(
    (id: LookPresetId, strength: number, overlayPatch?: GrainOverlayPatch | null) => {
      setLookId(id);
      setParams(paramsFromCapture(id, strength, overlayPatch));
    },
    [],
  );

  const onLookChange = useCallback((id: LookPresetId) => {
    setLookId(id);
    setParams((prev) => paramsFromLook(id, prev.strength));
  }, []);

  const openSheet = useCallback(
    (id: LookPresetId, strength: number, overlayPatch?: GrainOverlayPatch | null) => {
      setLookId(id);
      setParams(paramsFromCapture(id, strength, overlayPatch));
      setActiveParam('strength');
    },
    [],
  );

  const grainPatch = useMemo(() => grainPatchFromParams(params), [params]);

  return {
    lookId,
    setLookId,
    params,
    setParams,
    activeParam,
    setActiveParam,
    draftOverlay,
    grainPatch,
    syncFromCapture,
    onLookChange,
    openSheet,
  };
}

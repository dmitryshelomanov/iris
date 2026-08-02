import type { LookOverlayConfig } from '@/features/camera';

/** Custom grain / diffusion overrides persisted on RecentCapture and passed into bake. */
export type GrainOverlayPatch = Partial<
  Pick<LookOverlayConfig, 'grain' | 'grainSize' | 'grainTexture' | 'grainBlur'>
>;

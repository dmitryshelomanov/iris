import type { LookPresetId } from './types';
import { LOOK_PRESETS } from './presets';

export type LookSceneId = 'all' | 'color' | 'mono';

export const LOOK_SCENES: { id: LookSceneId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'color', label: 'Color' },
  { id: 'mono', label: 'Mono' },
];

const SCENE_LOOKS: Record<Exclude<LookSceneId, 'all'>, LookPresetId[]> = {
  color: ['none', 'kp', 'kg', 'ke', 'fs', 'fp', 'ag', 'pd', 'tc'],
  mono: ['none', 'as', 'tx'],
};

export function looksForScene(scene: LookSceneId) {
  if (scene === 'all') return LOOK_PRESETS;
  const allowed = new Set(SCENE_LOOKS[scene]);
  return LOOK_PRESETS.filter((look) => allowed.has(look.id));
}

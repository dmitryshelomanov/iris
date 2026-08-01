import { LOOK_PRESETS } from './presets';
import type { LookPresetId } from './types';

export type LookSceneId = 'all' | 'color' | 'mono' | 'fx' | 'anime';

export const LOOK_SCENES: { id: LookSceneId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'color', label: 'Color' },
  { id: 'mono', label: 'Mono' },
  { id: 'fx', label: 'FX' },
  { id: 'anime', label: 'Anime ML' },
];

const SCENE_LOOKS: Record<Exclude<LookSceneId, 'all'>, LookPresetId[]> = {
  color: ['none', 'kp', 'kg', 'ke', 'fs', 'fp', 'ag', 'pd', 'tc'],
  mono: ['none', 'as', 'tx'],
  fx: ['none', 'tn', 'cm', 'pp'],
  anime: ['none', 'sk', 'hy'],
};

export function looksForScene(scene: LookSceneId) {
  if (scene === 'all') return LOOK_PRESETS;
  const allowed = new Set(SCENE_LOOKS[scene]);
  return LOOK_PRESETS.filter((look) => allowed.has(look.id));
}

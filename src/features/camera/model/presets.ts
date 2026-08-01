import type { LookMlStyle, LookPresetId, ManualControlsState } from './types';

/**
 * Film-style grade baked into stills (and approximated on the live preview).
 * Neutral = contrast/sat 1, everything else 0 / transparent.
 */
export type LookOverlay = {
  /** Midtone contrast; 1 = neutral */
  contrast: number;
  /** Color saturation; 1 = neutral */
  saturation: number;
  /** Lift / exposure bias in the matrix (−0.25…0.25 typical) */
  brightness: number;
  /** Amber ↔ teal matrix bias (−1…1) */
  warmth: number;
  /** Midtone color cast */
  color: string;
  opacity: number;
  /** Shadow split-tone */
  shadows: string;
  shadowsOpacity: number;
  /** Highlight split-tone */
  highlights: string;
  highlightsOpacity: number;
  /** Radial vignette 0…1 */
  vignette: number;
  /** Desaturate toward mono 0…1 */
  mono: number;
  /** Film grain 0…1 */
  grain: number;
  /** Soft flash highlight bloom 0…1 */
  bloom: number;
  /** Warm corner light leak 0…1 */
  leak: number;
  /** Orange digicam date stamp opacity 0…1 */
  stamp: number;
  /** Flatten / blur before posterize 0…1 (cartoon-ish) */
  smooth: number;
  /** Color quantization strength 0…1 (maps to ~32…4 levels) */
  posterize: number;
  /** Edge / ink line strength 0…1 */
  edges: number;
};

export type LookPreset = {
  id: LookPresetId;
  label: string;
  hint: string;
  /** Camera white balance + exposure applied for this look */
  camera: Partial<Pick<ManualControlsState, 'wbKelvin' | 'wbTint' | 'ev'>>;
  overlay: LookOverlay;
  /**
   * On-device ML style for photo bake (AnimeGANv3).
   * Video skips look bake entirely for these presets (photo-only).
   */
  mlStyle?: LookMlStyle;
};

const CLEAN: LookOverlay = {
  contrast: 1,
  saturation: 1,
  brightness: 0,
  warmth: 0,
  color: '#000000',
  opacity: 0,
  shadows: '#000000',
  shadowsOpacity: 0,
  highlights: '#ffffff',
  highlightsOpacity: 0,
  vignette: 0,
  mono: 0,
  grain: 0,
  bloom: 0,
  leak: 0,
  stamp: 0,
  smooth: 0,
  posterize: 0,
  edges: 0,
};

export const LOOK_PRESETS: LookPreset[] = [
  {
    id: 'none',
    label: 'Native',
    hint: 'Clean sensor',
    camera: { wbKelvin: 5500, wbTint: 0, ev: 0 },
    overlay: { ...CLEAN },
  },
  {
    id: 'kp',
    label: 'KP',
    hint: 'Kodak Portra',
    camera: { wbKelvin: 5750, wbTint: 18, ev: 0.35 },
    overlay: {
      contrast: 0.88,
      saturation: 0.82,
      brightness: 0.04,
      warmth: 0.42,
      color: '#E8B896',
      opacity: 0.2,
      shadows: '#3A2A28',
      shadowsOpacity: 0.18,
      highlights: '#FFF2E0',
      highlightsOpacity: 0.12,
      vignette: 0.3,
      mono: 0,
      grain: 0.3,
      bloom: 0,
      leak: 0,
      stamp: 0,
      smooth: 0,
      posterize: 0,
      edges: 0,
    },
  },
  {
    id: 'kg',
    label: 'KG',
    hint: 'Kodak Gold',
    camera: { wbKelvin: 4500, wbTint: 22, ev: 0.25 },
    overlay: {
      contrast: 1.12,
      saturation: 1.12,
      brightness: 0.03,
      warmth: 0.6,
      color: '#F0A030',
      opacity: 0.22,
      shadows: '#4A2010',
      shadowsOpacity: 0.16,
      highlights: '#FFE8A0',
      highlightsOpacity: 0.18,
      vignette: 0.34,
      mono: 0,
      grain: 0.34,
      bloom: 0,
      leak: 0,
      stamp: 0,
      smooth: 0,
      posterize: 0,
      edges: 0,
    },
  },
  {
    id: 'ke',
    label: 'KE',
    hint: 'Kodak Ektar',
    camera: { wbKelvin: 5300, wbTint: 8, ev: -0.08 },
    overlay: {
      contrast: 1.24,
      saturation: 1.38,
      brightness: 0.005,
      warmth: 0.22,
      color: '#E87840',
      opacity: 0.09,
      shadows: '#1A3048',
      shadowsOpacity: 0.1,
      highlights: '#FFF0D8',
      highlightsOpacity: 0.1,
      vignette: 0.18,
      mono: 0,
      grain: 0.18,
      bloom: 0,
      leak: 0,
      stamp: 0,
      smooth: 0,
      posterize: 0,
      edges: 0,
    },
  },
  {
    id: 'fs',
    label: 'FS',
    hint: 'Fuji Superia',
    camera: { wbKelvin: 6100, wbTint: 24, ev: 0.08 },
    overlay: {
      contrast: 1.05,
      saturation: 1.05,
      brightness: 0.015,
      warmth: -0.18,
      color: '#C8A0B8',
      opacity: 0.12,
      shadows: '#204838',
      shadowsOpacity: 0.22,
      highlights: '#F0D8E8',
      highlightsOpacity: 0.08,
      vignette: 0.26,
      mono: 0,
      grain: 0.36,
      bloom: 0,
      leak: 0,
      stamp: 0,
      smooth: 0,
      posterize: 0,
      edges: 0,
    },
  },
  {
    id: 'fp',
    label: 'FP',
    hint: 'Fuji Pro 400H',
    camera: { wbKelvin: 5450, wbTint: 16, ev: 0.4 },
    overlay: {
      contrast: 0.86,
      saturation: 0.78,
      brightness: 0.06,
      warmth: 0.28,
      color: '#E8D0C0',
      opacity: 0.18,
      shadows: '#485040',
      shadowsOpacity: 0.1,
      highlights: '#FFF8F0',
      highlightsOpacity: 0.14,
      vignette: 0.22,
      mono: 0,
      grain: 0.28,
      bloom: 0,
      leak: 0,
      stamp: 0,
      smooth: 0,
      posterize: 0,
      edges: 0,
    },
  },
  {
    id: 'ag',
    label: 'AG',
    hint: 'Agfa Vista',
    camera: { wbKelvin: 4800, wbTint: 10, ev: 0.15 },
    overlay: {
      contrast: 1.02,
      saturation: 0.98,
      brightness: 0.02,
      warmth: 0.32,
      color: '#D4A878',
      opacity: 0.18,
      shadows: '#304028',
      shadowsOpacity: 0.14,
      highlights: '#F5E8C8',
      highlightsOpacity: 0.12,
      vignette: 0.32,
      mono: 0,
      grain: 0.38,
      bloom: 0,
      leak: 0,
      stamp: 0,
      smooth: 0,
      posterize: 0,
      edges: 0,
    },
  },
  {
    id: 'as',
    label: 'AS',
    hint: 'Agfa Scala',
    camera: { wbKelvin: 6800, wbTint: -20, ev: -0.4 },
    overlay: {
      contrast: 1.28,
      saturation: 0.12,
      brightness: -0.04,
      warmth: -0.2,
      color: '#1A1E28',
      opacity: 0.08,
      shadows: '#050508',
      shadowsOpacity: 0.24,
      highlights: '#D8DCE8',
      highlightsOpacity: 0.1,
      vignette: 0.48,
      mono: 1,
      grain: 0.52,
      bloom: 0,
      leak: 0,
      stamp: 0,
      smooth: 0,
      posterize: 0,
      edges: 0,
    },
  },
  {
    id: 'pd',
    label: 'PD',
    hint: 'Polaroid',
    camera: { wbKelvin: 5200, wbTint: 12, ev: 0.5 },
    overlay: {
      contrast: 0.7,
      saturation: 0.74,
      brightness: 0.1,
      warmth: 0.16,
      color: '#E8D0B8',
      opacity: 0.24,
      shadows: '#7A8078',
      shadowsOpacity: 0.2,
      highlights: '#FFF5E8',
      highlightsOpacity: 0.14,
      vignette: 0.38,
      mono: 0.06,
      grain: 0.42,
      bloom: 0,
      leak: 0,
      stamp: 0,
      smooth: 0,
      posterize: 0,
      edges: 0,
    },
  },
  {
    id: 'tc',
    label: 'TC',
    hint: 'Cinestill 800T',
    camera: { wbKelvin: 3800, wbTint: 12, ev: -0.35 },
    overlay: {
      contrast: 1.18,
      saturation: 0.92,
      brightness: -0.04,
      warmth: 0.1,
      color: '#C87840',
      opacity: 0.14,
      shadows: '#0C3048',
      shadowsOpacity: 0.32,
      highlights: '#E8A060',
      highlightsOpacity: 0.16,
      vignette: 0.44,
      mono: 0.05,
      grain: 0.4,
      bloom: 0,
      leak: 0,
      stamp: 0,
      smooth: 0,
      posterize: 0,
      edges: 0,
    },
  },
  {
    id: 'tx',
    label: 'TX',
    hint: 'Kodak Tri‑X',
    camera: { wbKelvin: 5600, wbTint: -8, ev: -0.35 },
    overlay: {
      contrast: 1.45,
      saturation: 0.06,
      brightness: -0.03,
      warmth: -0.04,
      color: '#1C1C1A',
      opacity: 0.06,
      shadows: '#060606',
      shadowsOpacity: 0.3,
      highlights: '#E8E4DC',
      highlightsOpacity: 0.12,
      vignette: 0.46,
      mono: 1,
      grain: 0.62,
      bloom: 0,
      leak: 0,
      stamp: 0,
      smooth: 0,
      posterize: 0,
      edges: 0,
    },
  },
  {
    id: 'tn',
    label: 'TN',
    hint: 'Toon',
    camera: { wbKelvin: 5600, wbTint: 8, ev: 0.15 },
    overlay: {
      ...CLEAN,
      contrast: 1.15,
      saturation: 1.2,
      brightness: 0.02,
      warmth: 0.08,
      color: '#FFE566',
      opacity: 0.08,
      smooth: 0.55,
      posterize: 0.65,
      edges: 0.45,
    },
  },
  {
    id: 'cm',
    label: 'CM',
    hint: 'Comic',
    camera: { wbKelvin: 5400, wbTint: 0, ev: -0.1 },
    overlay: {
      ...CLEAN,
      contrast: 1.3,
      saturation: 0.95,
      brightness: 0.01,
      warmth: -0.05,
      color: '#1A1A1A',
      opacity: 0.06,
      smooth: 0.25,
      posterize: 0.8,
      edges: 0.85,
    },
  },
  {
    id: 'pp',
    label: 'PP',
    hint: 'Pop',
    camera: { wbKelvin: 5800, wbTint: 16, ev: 0.2 },
    overlay: {
      ...CLEAN,
      contrast: 1.2,
      saturation: 1.45,
      brightness: 0.03,
      warmth: 0.18,
      color: '#FF4FD8',
      opacity: 0.1,
      smooth: 0.15,
      posterize: 0.7,
      edges: 0.25,
    },
  },
  {
    id: 'sk',
    label: 'SK',
    hint: 'Shinkai',
    camera: { wbKelvin: 5800, wbTint: 10, ev: 0.15 },
    mlStyle: 'animegan-v3-shinkai',
    overlay: {
      ...CLEAN,
      // Mild post-ML nudge + live/video approx (toon stripped on ML bake).
      contrast: 1.06,
      saturation: 1.12,
      brightness: 0.01,
      warmth: 0.04,
      color: '#5EB0FF',
      opacity: 0.04,
      shadows: '#0E2A62',
      shadowsOpacity: 0.06,
      highlights: '#FFE6A0',
      highlightsOpacity: 0.08,
      bloom: 0.12,
      smooth: 0.22,
      posterize: 0.2,
      edges: 0.06,
    },
  },
  {
    id: 'hy',
    label: 'HY',
    hint: 'Hayao',
    camera: { wbKelvin: 5400, wbTint: 8, ev: 0.1 },
    mlStyle: 'animegan-v3-hayao',
    overlay: {
      ...CLEAN,
      contrast: 1.04,
      saturation: 1.1,
      brightness: 0.015,
      warmth: 0.1,
      color: '#7EC87A',
      opacity: 0.05,
      shadows: '#2A4020',
      shadowsOpacity: 0.05,
      highlights: '#FFF2C8',
      highlightsOpacity: 0.06,
      bloom: 0.08,
      smooth: 0.28,
      posterize: 0.22,
      edges: 0.05,
    },
  },
];

/** Legacy Anime look ids → current presets. */
const LEGACY_LOOK_IDS: Record<string, LookPresetId> = {
  an: 'sk',
  pk: 'sk',
};

export function resolveLookPresetId(id: unknown): LookPresetId | null {
  if (typeof id !== 'string') return null;
  if (LOOK_PRESETS.some((p) => p.id === id)) return id as LookPresetId;
  return LEGACY_LOOK_IDS[id] ?? null;
}

export function isLookPresetId(id: unknown): id is LookPresetId {
  return typeof id === 'string' && LOOK_PRESETS.some((p) => p.id === id);
}

/** Digicam / disposable LCD date: `YY MM DD`. */
export function formatLookStampDate(date: Date = new Date()) {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy} ${mm} ${dd}`;
}

export function getLookPreset(id: LookPresetId | string): LookPreset {
  const resolved = resolveLookPresetId(id) ?? 'none';
  return LOOK_PRESETS.find((p) => p.id === resolved) ?? LOOK_PRESETS[0];
}

/** Anime ML looks bake at fixed full strength — no user strength control. */
export function isAnimeMlLook(look: LookPreset | LookPresetId | string): boolean {
  const preset = typeof look === 'object' ? look : getLookPreset(look);
  return preset.mlStyle != null;
}

export function bakeStrengthForLook(look: LookPreset, requestedStrength: number): number {
  if (look.mlStyle) return 1;
  return requestedStrength;
}

/** Merge look camera knobs into manual state (does not force Manual on). */
export function applyLookToManual(
  state: ManualControlsState,
  lookId: LookPresetId,
): ManualControlsState {
  const look = getLookPreset(lookId);
  return {
    ...state,
    wbKelvin: look.camera.wbKelvin ?? state.wbKelvin,
    wbTint: look.camera.wbTint ?? state.wbTint,
    ev: look.camera.ev ?? state.ev,
  };
}

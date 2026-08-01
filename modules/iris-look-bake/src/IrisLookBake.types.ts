export type BakeLookVideoNativeOptions = {
  matrix: number[];
  tint: [number, number, number, number] | number[];
  shadows: [number, number, number, number] | number[];
  highlights: [number, number, number, number] | number[];
  vignette: number;
  grain: number;
  bloom: number;
  leak: number;
  stamp: number;
  stampText: string;
  smooth: number;
  posterize: number;
  edges: number;
};

export type BakeLookVideoNativeResult = {
  path: string;
  uri: string;
  baked?: boolean;
};

/** On-device AnimeGANv3 style id. */
export type AnimeMlStyle = 'animegan-v3-shinkai' | 'animegan-v3-hayao';

export type StylizePhotoNativeOptions = {
  style: AnimeMlStyle;
  /** Blend toward stylized result; 0 = original, 1 = full anime. */
  strength: number;
};

export type StylizePhotoNativeResult = {
  path: string;
  uri: string;
};

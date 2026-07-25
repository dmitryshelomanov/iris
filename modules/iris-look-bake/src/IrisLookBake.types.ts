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
};

export type BakeLookVideoNativeResult = {
  path: string;
  uri: string;
  baked?: boolean;
};

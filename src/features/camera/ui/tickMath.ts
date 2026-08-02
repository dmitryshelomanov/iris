/** Shared gesture math for TickWheel / TickSlider (Reanimated worklets). */

export function clamp01(n: number) {
  'worklet';
  return Math.min(1, Math.max(0, n));
}

export function snap(value: number, min: number, max: number, step?: number) {
  'worklet';
  if (step == null || step <= 0) return Math.min(max, Math.max(min, value));
  const snapped = Math.round((value - min) / step) * step + min;
  return Math.min(max, Math.max(min, Number(snapped.toFixed(6))));
}

export function progressFromValue(value: number, min: number, max: number) {
  'worklet';
  return (value - min) / Math.max(0.0001, max - min);
}

export function valueFromProgress(progress: number, min: number, max: number, step?: number) {
  'worklet';
  return snap(min + clamp01(progress) * (max - min), min, max, step);
}

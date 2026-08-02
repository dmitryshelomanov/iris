/** Default UI ranges when the live CameraController limits are not yet known. */
export const ISO_UI_FALLBACK = { min: 25, max: 12800 } as const;
export const SHUTTER_UI_FALLBACK = { min: 1 / 8000, max: 1 } as const;

export type ExposureUiLimits = {
  minISO: number;
  maxISO: number;
  minShutter: number;
  maxShutter: number;
};

export const DEFAULT_EXPOSURE_UI_LIMITS: ExposureUiLimits = {
  minISO: ISO_UI_FALLBACK.min,
  maxISO: ISO_UI_FALLBACK.max,
  minShutter: SHUTTER_UI_FALLBACK.min,
  maxShutter: SHUTTER_UI_FALLBACK.max,
};

export function formatShutter(seconds: number): string {
  if (!(seconds > 0)) return '—';
  if (seconds >= 1) return `${Number(seconds.toFixed(1))}s`;
  const denom = Math.max(1, Math.round(1 / seconds));
  return `1/${denom}`;
}

export function formatIso(iso: number): string {
  return String(Math.round(iso));
}

function logLerp(t: number, min: number, max: number): number {
  const minLog = Math.log2(Math.max(min, 1e-6));
  const maxLog = Math.log2(Math.max(max, min + 1e-6));
  return Math.pow(2, minLog + t * (maxLog - minLog));
}

function logProgress(value: number, min: number, max: number): number {
  const lo = Math.max(min, 1e-6);
  const hi = Math.max(max, lo + 1e-6);
  const clamped = Math.min(hi, Math.max(lo, value));
  const minLog = Math.log2(lo);
  const maxLog = Math.log2(hi);
  return (Math.log2(clamped) - minLog) / (maxLog - minLog);
}

export function shutterFromT(t: number, limits: ExposureUiLimits = DEFAULT_EXPOSURE_UI_LIMITS): number {
  return logLerp(t, limits.minShutter, limits.maxShutter);
}

export function shutterToT(
  shutter: number,
  limits: ExposureUiLimits = DEFAULT_EXPOSURE_UI_LIMITS,
): number {
  return logProgress(shutter, limits.minShutter, limits.maxShutter);
}

export function isoFromT(t: number, limits: ExposureUiLimits = DEFAULT_EXPOSURE_UI_LIMITS): number {
  return logLerp(t, limits.minISO, limits.maxISO);
}

export function isoToT(iso: number, limits: ExposureUiLimits = DEFAULT_EXPOSURE_UI_LIMITS): number {
  return logProgress(iso, limits.minISO, limits.maxISO);
}

/** Read live controller limits; fall back when unset / zero. */
export function exposureLimitsFromController(controller: {
  minISO: number;
  maxISO: number;
  minExposureDuration: number;
  maxExposureDuration: number;
} | null | undefined): ExposureUiLimits {
  if (!controller) return DEFAULT_EXPOSURE_UI_LIMITS;
  const minISO = controller.minISO > 0 ? controller.minISO : DEFAULT_EXPOSURE_UI_LIMITS.minISO;
  const maxISO =
    controller.maxISO > minISO ? controller.maxISO : Math.max(minISO, DEFAULT_EXPOSURE_UI_LIMITS.maxISO);
  const minShutter =
    controller.minExposureDuration > 0
      ? controller.minExposureDuration
      : DEFAULT_EXPOSURE_UI_LIMITS.minShutter;
  const maxShutter =
    controller.maxExposureDuration > minShutter
      ? controller.maxExposureDuration
      : Math.max(minShutter, DEFAULT_EXPOSURE_UI_LIMITS.maxShutter);
  return { minISO, maxISO, minShutter, maxShutter };
}

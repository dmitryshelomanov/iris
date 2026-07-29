import type { CameraDevice, DeviceType } from 'react-native-vision-camera';

import type { CameraCapabilities, LensKind, LensOption } from './types';

const PHYSICAL_LENS_TYPES: DeviceType[] = ['ultra-wide-angle', 'wide-angle', 'telephoto'];

/** Common cinematic / phone FOV targets (Blackmagic-style strip). */
const TARGET_FOCALS_MM = [13, 16, 18, 24, 28, 35, 48, 50, 65, 70, 85, 100, 120, 135, 200];

function fallbackMm(type: DeviceType): number {
  switch (type) {
    case 'ultra-wide-angle':
      return 13;
    case 'telephoto':
      return 77;
    case 'wide-angle':
    default:
      return 24;
  }
}

function typeHint(type: DeviceType): string {
  switch (type) {
    case 'ultra-wide-angle':
      return 'Ultra Wide';
    case 'telephoto':
      return 'Tele';
    case 'wide-angle':
      return 'Wide';
    default:
      return 'Lens';
  }
}

function kindForType(_type: DeviceType, isFront: boolean): LensKind {
  return isFront ? 'front' : 'optical';
}

function isPhysicalLens(device: CameraDevice): boolean {
  return !device.isVirtualDevice && PHYSICAL_LENS_TYPES.includes(device.type);
}

function nativeMm(device: CameraDevice): number {
  return Math.round(device.focalLength ?? fallbackMm(device.type));
}

function toOpticalOption(device: CameraDevice): LensOption {
  const mm = nativeMm(device);
  const isFront = device.position === 'front';
  return {
    id: `${device.id}@native`,
    label: isFront ? 'Front' : `${mm}mm`,
    hint: isFront ? 'Selfie' : typeHint(device.type),
    device,
    zoom: device.minZoom,
    position: isFront ? 'front' : 'back',
    deviceType: device.type,
    focalLengthMm: mm,
    kind: kindForType(device.type, isFront),
    isNative: true,
  };
}

/**
 * Prefer a multi-lens virtual back camera (used only as fallback source of physicalDevices).
 */
export function pickPrimaryBackDevice(devices: CameraDevice[]): CameraDevice | undefined {
  const back = devices.filter((d) => d.position === 'back');
  if (back.length === 0) return undefined;

  return [...back].sort((a, b) => {
    const score = (d: CameraDevice) => {
      let s = d.physicalDevices.length;
      if (d.isVirtualDevice) s += 3;
      if (PHYSICAL_LENS_TYPES.includes(d.type)) s += 1;
      return s;
    };
    return score(b) - score(a);
  })[0];
}

function collectPhysicalBack(devices: CameraDevice[]): CameraDevice[] {
  const direct = devices
    .filter((d) => d.position === 'back' && isPhysicalLens(d))
    .sort((a, b) => nativeMm(a) - nativeMm(b));

  if (direct.length > 0) {
    return dedupeDevices(direct);
  }

  const virtual = pickPrimaryBackDevice(devices);
  if (!virtual) return [];

  const parts =
    virtual.physicalDevices.length > 0
      ? virtual.physicalDevices.filter(isPhysicalLens)
      : isPhysicalLens(virtual)
        ? [virtual]
        : [];

  return dedupeDevices(parts.sort((a, b) => nativeMm(a) - nativeMm(b)));
}

function dedupeDevices(list: CameraDevice[]): CameraDevice[] {
  const seen = new Set<string>();
  return list.filter((d) => {
    const key = `${d.type}:${nativeMm(d)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Pick the physical camera that reaches `targetMm` with the least digital crop.
 */
function bestCropForTarget(
  physical: CameraDevice[],
  targetMm: number,
): { device: CameraDevice; zoom: number; cropFactor: number } | null {
  let best: { device: CameraDevice; zoom: number; cropFactor: number } | null = null;

  for (const device of physical) {
    const native = nativeMm(device);
    const cropFactor = targetMm / native;
    const zoom = device.minZoom * cropFactor;
    if (zoom < device.minZoom - 0.02 || zoom > device.maxZoom + 0.02) continue;

    if (!best || cropFactor < best.cropFactor) {
      best = { device, zoom: Number(zoom.toFixed(3)), cropFactor };
    }
  }

  return best;
}

/**
 * Blackmagic-style catalog: optical lenses + crop FOVs (35 / 50 / 100 / 200…) + Front + Multi.
 */
export function buildLensCatalog(devices: CameraDevice[]): LensOption[] {
  const physicalBack = collectPhysicalBack(devices);
  const opticalBack = physicalBack.map(toOpticalOption);

  const claimed = new Set<number>(
    opticalBack.map((l) => l.focalLengthMm).filter((mm): mm is number => mm != null),
  );

  const crops: LensOption[] = [];
  for (const targetMm of TARGET_FOCALS_MM) {
    if ([...claimed].some((mm) => Math.abs(mm - targetMm) <= 1)) continue;

    const match = bestCropForTarget(physicalBack, targetMm);
    if (!match || match.cropFactor < 1.12) continue;

    crops.push({
      id: `${match.device.id}@${targetMm}`,
      label: `${targetMm}mm`,
      hint: `${match.cropFactor.toFixed(1)}× crop`,
      device: match.device,
      zoom: match.zoom,
      position: 'back',
      deviceType: match.device.type,
      focalLengthMm: targetMm,
      kind: 'crop',
      isNative: false,
    });
    claimed.add(targetMm);
  }

  const backLenses = [...opticalBack, ...crops].sort(
    (a, b) => (a.focalLengthMm ?? 999) - (b.focalLengthMm ?? 999),
  );

  const result: LensOption[] = [];

  // Multi = virtual triple/dual cam (smooth lens transitions via system zoom).
  const multi = devices.find(
    (d) =>
      d.position === 'back' &&
      d.isVirtualDevice &&
      (d.type === 'triple' || d.type === 'dual' || d.type === 'dual-wide' || d.type === 'quad'),
  );
  if (multi) {
    const wide = devices.find(
      (d) => d.position === 'back' && !d.isVirtualDevice && d.type === 'wide-angle',
    );
    result.push({
      id: `${multi.id}@multi`,
      label: 'Multi',
      hint: 'Auto lenses',
      device: multi,
      // 1 = wide / "1×" on virtual devices (UW is typically ~0.5).
      zoom: 1,
      position: 'back',
      deviceType: multi.type,
      kind: 'multi',
      focalLengthMm: wide ? nativeMm(wide) : 24,
      isNative: true,
    });
  }

  const front =
    devices.find((d) => d.position === 'front' && !d.isVirtualDevice) ??
    devices.find((d) => d.position === 'front');
  if (front) {
    result.push(toOpticalOption(front));

    // Front portrait crop (~1.5–2×) when the selfie cam supports it.
    for (const factor of [1.5, 2]) {
      const zoom = front.minZoom * factor;
      if (zoom > front.maxZoom + 0.02) continue;
      const mm = Math.round(nativeMm(front) * factor);
      result.push({
        id: `${front.id}@${factor}`,
        label: `${mm}mm`,
        hint: 'Front crop',
        device: front,
        zoom: Number(zoom.toFixed(3)),
        position: 'front',
        deviceType: front.type,
        focalLengthMm: mm,
        kind: 'crop',
        isNative: false,
      });
    }
  }

  result.push(...backLenses);
  return result;
}

/** Soft UI ceiling matching iOS Camera continuous dial (~40×). */
export const ZOOM_UI_MAX = 40;

/**
 * Zoom value that means "1×" in the UI.
 * Virtual multi-cam: API zoom is already display-relative (0.5 UW / 1 wide).
 * Single physical lens: 1× = that device's minZoom.
 */
export function displayBaseZoom(device: CameraDevice | undefined): number {
  if (!device) return 1;
  return device.minZoom < 0.95 ? 1 : device.minZoom;
}

/** Usable zoom range for dial / pinch (device limits, soft-capped). */
export function zoomRange(device: CameraDevice | undefined): { min: number; max: number } {
  if (!device) return { min: 1, max: 1 };
  const min = device.minZoom;
  const max = Math.min(device.maxZoom, ZOOM_UI_MAX);
  return { min, max: Math.max(min, max) };
}

/** UI factor (0.5 / 1 / 2 / …) from Vision Camera zoom value. */
export function toDisplayZoom(zoom: number, device: CameraDevice | undefined): number {
  const base = displayBaseZoom(device);
  return zoom / Math.max(base, 0.01);
}

/** Digital zoom steps available on the active physical lens. */
export function buildZoomSteps(device: CameraDevice | undefined): number[] {
  const { min, max } = zoomRange(device);
  const relatives = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 8, 10, 15, 20, 25, 40];
  const base = displayBaseZoom(device);
  const steps = relatives
    .map((r) => base * r)
    .filter((z) => z >= min - 0.01 && z <= max + 0.01)
    .map((z) => Number(z.toFixed(2)));
  if (min < base * 0.95) steps.unshift(Number(min.toFixed(2)));
  const unique = [...new Set(steps)].sort((a, b) => a - b);
  return unique.length > 0 ? unique : [Number(min.toFixed(2))];
}

/** @deprecated Alias of buildZoomDialMajors — prefer that name for dial marks. */
export function buildZoomSnapPoints(device: CameraDevice | undefined): number[] {
  return buildZoomDialMajors(device);
}

/** Major dial marks in device zoom units (0.5×, 1×, 2×, 5×…). */
export function buildZoomDialMajors(device: CameraDevice | undefined): number[] {
  const { min, max } = zoomRange(device);
  const base = displayBaseZoom(device);
  // iOS Camera–style factors relative to wide = 1×.
  const displayFactors = [0.5, 1, 2, 5, 10, 20, 40];
  const points = displayFactors
    .map((f) => base * f)
    .filter((z) => z >= min - 0.02 && z <= max + 0.02)
    .map((z) => Number(z.toFixed(2)));
  // Always include true device min when it's the UW stop.
  if (min < base * 0.95) {
    points.unshift(Number(min.toFixed(2)));
  }
  const unique = [...new Set(points)].sort((a, b) => a - b);
  return unique.length > 0 ? unique : [Number(min.toFixed(2))];
}

export function formatZoomLabel(zoom: number, device: CameraDevice | undefined): string {
  const relative = toDisplayZoom(zoom, device);
  if (relative < 0.6) return '0,5×';
  if (relative < 1.05) return '1×';
  const rounded = relative >= 10 ? Math.round(relative) : Number(relative.toFixed(1));
  return `${rounded}×`;
}

/** Short dial factor without × suffix (iOS: "2", "0,5"). */
export function formatZoomFactor(zoom: number, device: CameraDevice | undefined): string {
  const relative = toDisplayZoom(zoom, device);
  if (relative < 0.6) return '0,5';
  if (relative < 1.05) return '1';
  if (relative >= 10) return `${Math.round(relative)}`;
  const rounded = Number(relative.toFixed(1));
  if (Number.isInteger(rounded)) return `${rounded}`;
  return String(rounded).replace('.', ',');
}

/** 35mm-equivalent FOV label from wide = 1× reference. */
export function formatZoomMm(
  zoom: number,
  device: CameraDevice | undefined,
  wideFocalMm: number,
): string {
  const relative = toDisplayZoom(zoom, device);
  const mm = Math.round(wideFocalMm * relative);
  return `${mm}MM`;
}

export function buildCapabilities(device: CameraDevice | undefined): CameraCapabilities {
  return {
    minZoom: device?.minZoom ?? 1,
    maxZoom: device?.maxZoom ?? 1,
    hasFlash: device?.hasFlash ?? false,
    hasTorch: device?.hasTorch ?? false,
    supportsManualISO: device?.supportsExposureLocking ?? false,
    supportsManualShutter: device?.supportsExposureLocking ?? false,
    supportsManualFocus: device?.supportsFocusLocking ?? false,
    supportsWhiteBalance: device?.supportsWhiteBalanceLocking ?? false,
    supportsExposureBias: device?.supportsExposureBias ?? false,
    supportsLowLightBoost: device?.supportsLowLightBoost ?? false,
    supportsDistortionCorrection: device?.supportsDistortionCorrection ?? false,
    supportsPhotoHDR: device?.supportsPhotoHDR ?? false,
    supportsVideoStabilization: device?.supportsVideoStabilizationMode('standard') ?? false,
    supportsSpeedQuality: device?.supportsSpeedQualityPrioritization ?? false,
    minExposureBias: device?.minExposureBias ?? -3,
    maxExposureBias: device?.maxExposureBias ?? 3,
  };
}

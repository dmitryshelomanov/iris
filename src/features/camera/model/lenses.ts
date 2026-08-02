import type { CameraDevice, DeviceType } from 'react-native-vision-camera';

import type { CameraCapabilities, LensOption } from './types';

const PHYSICAL_LENS_TYPES: DeviceType[] = ['ultra-wide-angle', 'wide-angle', 'telephoto'];

/** Soft ceiling for imperative zoom clamps (presets / lens select). */
const ZOOM_UI_MAX = 40;

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

function nativeMm(device: CameraDevice): number {
  return Math.round(device.focalLength ?? fallbackMm(device.type));
}

function toFrontOption(device: CameraDevice): LensOption {
  return {
    id: `${device.id}@native`,
    label: 'Front',
    hint: 'Selfie',
    device,
    zoom: device.minZoom,
    position: 'front',
    deviceType: device.type,
    focalLengthMm: nativeMm(device),
    kind: 'front',
    isNative: true,
  };
}

function toPhysicalBackOption(device: CameraDevice): LensOption {
  const mm = nativeMm(device);
  return {
    id: `${device.id}@native`,
    label: `${mm}mm`,
    hint: device.type === 'ultra-wide-angle' ? 'Ultra wide' : device.type === 'telephoto' ? 'Tele' : 'Wide',
    device,
    zoom: device.minZoom < 0.95 ? 1 : device.minZoom,
    position: 'back',
    deviceType: device.type,
    focalLengthMm: mm,
    kind: 'optical',
    isNative: true,
  };
}

function toBackFallbackOption(device: CameraDevice): LensOption {
  const mm = nativeMm(device);
  return {
    id: `${device.id}@native`,
    label: `${mm}mm`,
    hint: 'Back',
    device,
    zoom: device.minZoom < 0.95 ? 1 : device.minZoom,
    position: 'back',
    deviceType: device.type,
    focalLengthMm: mm,
    kind: 'optical',
    isNative: true,
  };
}

function pickPrimaryBackDevice(devices: CameraDevice[]): CameraDevice | undefined {
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

/** Physical back lenses in stable UW → wide → tele order. */
function physicalBackOptions(devices: CameraDevice[]): LensOption[] {
  const physical = devices.filter(
    (d) => d.position === 'back' && !d.isVirtualDevice && PHYSICAL_LENS_TYPES.includes(d.type),
  );
  const order: Record<string, number> = {
    'ultra-wide-angle': 0,
    'wide-angle': 1,
    telephoto: 2,
  };
  return [...physical]
    .sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9))
    .map(toPhysicalBackOption);
}

/** Multi + physical UW/wide/tele + Front; falls back to a single back device when multi is unavailable. */
export function buildLensCatalog(devices: CameraDevice[]): LensOption[] {
  const result: LensOption[] = [];

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
    result.push(...physicalBackOptions(devices));
  } else {
    const back = pickPrimaryBackDevice(devices);
    if (back) result.push(toBackFallbackOption(back));
    // Avoid duplicating the fallback if it is already a physical typed lens.
    for (const optical of physicalBackOptions(devices)) {
      if (!result.some((l) => l.id === optical.id)) result.push(optical);
    }
  }

  const front =
    devices.find((d) => d.position === 'front' && !d.isVirtualDevice) ??
    devices.find((d) => d.position === 'front');
  if (front) {
    result.push(toFrontOption(front));
  }

  return result;
}

/**
 * Prefer physical wide with focus lock; else any back lens that can lock focus.
 * Used when Pro Focus is enabled on a virtual Multi device.
 */
export function pickManualFocusLens(lenses: LensOption[]): LensOption | undefined {
  const back = lenses.filter((l) => l.position === 'back' && l.device.supportsFocusLocking);
  if (back.length === 0) return undefined;

  return (
    back.find((l) => l.deviceType === 'wide-angle' && !l.device.isVirtualDevice) ??
    back.find((l) => l.kind === 'optical' && !l.device.isVirtualDevice) ??
    back[0]
  );
}

/** True if any catalog lens can lock focus (e.g. physical wide while Multi is active). */
export function catalogSupportsManualFocus(lenses: LensOption[]): boolean {
  return lenses.some((l) => l.device.supportsFocusLocking);
}

/** True if any catalog lens can lock exposure (ISO/SS). */
export function catalogSupportsManualExposure(lenses: LensOption[]): boolean {
  return lenses.some((l) => l.device.supportsExposureLocking);
}

/** Usable zoom range for imperative setZoom clamps. */
export function zoomRange(device: CameraDevice | undefined): { min: number; max: number } {
  if (!device) return { min: 1, max: 1 };
  const min = device.minZoom;
  const max = Math.min(device.maxZoom, ZOOM_UI_MAX);
  return { min, max: Math.max(min, max) };
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

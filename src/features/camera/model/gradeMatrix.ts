import type { LookOverlay } from './presets';

function identityMatrix(): number[] {
  return [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
}

/** Multiply 4×5 color matrices: result = outer(inner(color)). */
function multiplyMatrices(outer: number[], inner: number[]): number[] {
  const out = new Array<number>(20);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += outer[row * 5 + k] * inner[k * 5 + col];
      }
      if (col === 4) {
        sum += outer[row * 5 + 4];
      }
      out[row * 5 + col] = sum;
    }
  }
  return out;
}

function contrastMatrix(amount: number): number[] {
  const c = amount;
  const t = (1 - c) * 0.5;
  return [c, 0, 0, 0, t, 0, c, 0, 0, t, 0, 0, c, 0, t, 0, 0, 0, 1, 0];
}

function saturationMatrix(amount: number): number[] {
  const s = amount;
  const inv = 1 - s;
  const r = 0.2126 * inv;
  const g = 0.7152 * inv;
  const b = 0.0722 * inv;
  return [r + s, g, b, 0, 0, r, g + s, b, 0, 0, r, g, b + s, 0, 0, 0, 0, 0, 1, 0];
}

function brightnessMatrix(amount: number): number[] {
  return [1, 0, 0, 0, amount, 0, 1, 0, 0, amount, 0, 0, 1, 0, amount, 0, 0, 0, 1, 0];
}

/** Positive warmth → amber; negative → teal/cyan. */
function warmthMatrix(amount: number): number[] {
  const w = Math.max(-1, Math.min(1, amount));
  if (Math.abs(w) < 0.001) return identityMatrix();
  const r = 1 + w * 0.12;
  const g = 1 + w * 0.04;
  const b = 1 - w * 0.14;
  return [r, 0, 0, 0, 0, 0, g, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, 1, 0];
}

function monoMatrix(amount: number): number[] {
  const a = Math.max(0, Math.min(1, amount));
  const inv = 1 - a;
  const r = 0.2126 * a;
  const g = 0.7152 * a;
  const b = 0.0722 * a;
  return [inv + r, g, b, 0, 0, r, inv + g, b, 0, 0, r, g, inv + b, 0, 0, 0, 0, 0, 1, 0];
}

/** Build the composed color matrix for a look at the given strength. */
export function buildGradeMatrix(overlay: LookOverlay, strength: number): number[] {
  const s = Math.max(0, Math.min(1, strength));
  const contrast = 1 + (overlay.contrast - 1) * s;
  const saturation = 1 + (overlay.saturation - 1) * s;
  const brightness = overlay.brightness * s;
  const warmth = overlay.warmth * s;
  const mono = overlay.mono * s;

  let m = identityMatrix();
  m = multiplyMatrices(warmthMatrix(warmth), m);
  m = multiplyMatrices(saturationMatrix(saturation), m);
  m = multiplyMatrices(contrastMatrix(contrast), m);
  m = multiplyMatrices(brightnessMatrix(brightness), m);
  if (mono > 0.01) {
    m = multiplyMatrices(monoMatrix(mono), m);
  }
  return m;
}

export function needsLookBake(overlay: LookOverlay, strength: number) {
  if (strength <= 0.01) return false;
  return (
    Math.abs(overlay.contrast - 1) > 0.01 ||
    Math.abs(overlay.saturation - 1) > 0.01 ||
    Math.abs(overlay.brightness) > 0.005 ||
    Math.abs(overlay.warmth) > 0.01 ||
    overlay.opacity > 0 ||
    overlay.shadowsOpacity > 0 ||
    overlay.highlightsOpacity > 0 ||
    overlay.vignette > 0 ||
    overlay.mono > 0 ||
    overlay.grain > 0 ||
    // Soft diffusion of the frame (independent of grain amount).
    overlay.grainBlur > 0.01 ||
    overlay.bloom > 0 ||
    overlay.leak > 0 ||
    overlay.stamp > 0 ||
    overlay.smooth > 0 ||
    overlay.posterize > 0 ||
    overlay.edges > 0
  );
}

export function hexToRgbaTuple(hex: string, alpha: number): [number, number, number, number] {
  const raw = hex.replace('#', '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  const n = Number.parseInt(full, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, alpha];
}

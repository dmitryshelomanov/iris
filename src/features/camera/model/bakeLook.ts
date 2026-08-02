import { Directory, File, Paths } from 'expo-file-system';
import {
  BlendMode,
  ImageFormat,
  matchFont,
  Skia,
  TileMode,
  type SkImage,
} from '@shopify/react-native-skia';

import type { LookOverlay } from './presets';
import { formatLookStampDate } from './presets';
import { toFileUri, toPath } from './bakeLookVideo';
import { buildGradeMatrix, hexToRgbaTuple, needsLookBake } from './gradeMatrix';
import { stylizePhotoWithMl } from './stylizePhoto';
import { applyToonPass, needsToonPass } from './toonBake';
import type { LookMlStyle } from './types';

export type BakeLookResult = {
  path: string;
  uri: string;
  /** 32-bin luminance histogram, normalized 0…1 */
  histogram: number[];
};

export type BakeLookPhotoOptions = {
  strength?: number;
  jpegQuality?: number;
  /** When set, run on-device AnimeGANv3 instead of classical toon. */
  mlStyle?: LookMlStyle | null;
  /**
   * Write to a stable cache file (overwrite) instead of documents/looks.
   * Use for ephemeral live previews so we don't fill storage.
   */
  previewCacheKey?: string;
};

function deleteQuietly(path: string) {
  try {
    const file = new File(toFileUri(path));
    if (file.exists) file.delete();
  } catch {
    // best-effort cleanup
  }
}

function hexToRgba(hex: string, alpha: number): Float32Array {
  const [r, g, b, a] = hexToRgbaTuple(hex, alpha);
  return Float32Array.of(r, g, b, a);
}

function computeHistogram(image: SkImage, bins = 32): number[] {
  const hist = new Array<number>(bins).fill(0);
  const pixels = image.readPixels();
  if (!pixels || !(pixels instanceof Uint8Array)) {
    return hist;
  }

  const width = image.width();
  const height = image.height();
  const stepX = Math.max(1, Math.floor(width / 96));
  const stepY = Math.max(1, Math.floor(height / 96));

  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const i = (y * width + x) * 4;
      if (i + 2 >= pixels.length) continue;
      const lum = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
      const bin = Math.min(bins - 1, Math.floor((lum / 255) * bins));
      hist[bin] += 1;
    }
  }

  const max = Math.max(1, ...hist);
  return hist.map((v) => v / max);
}

function stampFont(size: number) {
  for (const fontFamily of ['Courier New', 'Courier', 'Menlo', 'monospace']) {
    try {
      return matchFont({ fontFamily, fontSize: size, fontWeight: 'bold' });
    } catch {
      // try next family
    }
  }
  return Skia.Font(undefined, size);
}

/**
 * Bake preview look overlays into a JPEG so the saved file matches what the user saw.
 * Returns the original path when the look is Native / strength is zero.
 * ML looks (AnimeGANv3): stylize on-device, then Skia punch grade without classical toon.
 */
export async function bakeLookIntoPhoto(
  inputPath: string,
  overlay: LookOverlay,
  options: BakeLookPhotoOptions = {},
): Promise<BakeLookResult> {
  const strength = options.strength ?? 1;
  const quality = Math.round(Math.max(0.1, Math.min(1, options.jpegQuality ?? 0.95)) * 100);
  const mlStyle = options.mlStyle ?? null;

  let workingPath = inputPath;
  /** Grade applied in Skia — strip toon when post-processing ML output. */
  let gradeOverlay = overlay;
  /** ML intermediate under documents — delete after Skia re-encode (or on failure). */
  let disposableMlPath: string | null = null;
  if (mlStyle && strength > 0.01) {
    const stylized = await stylizePhotoWithMl(inputPath, { style: mlStyle, strength });
    workingPath = stylized.path;
    const inputNorm = toPath(inputPath);
    const workNorm = toPath(workingPath);
    if (workNorm !== inputNorm) {
      disposableMlPath = workNorm;
    }
    gradeOverlay = { ...overlay, smooth: 0, posterize: 0, edges: 0, bloom: 0 };
  }

  try {
    const inputUri = toFileUri(workingPath);
    const input = new File(inputUri);

    if (!needsLookBake(gradeOverlay, strength)) {
      // ML JPEG (or original) is the deliverable — keep it.
      disposableMlPath = null;
      const bytes = await input.bytes();
      const data = Skia.Data.fromBytes(bytes);
      const image = Skia.Image.MakeImageFromEncoded(data);
      const histogram = image ? computeHistogram(image) : new Array(32).fill(0);
      return { path: toPath(workingPath), uri: inputUri, histogram };
    }

    const bytes = await input.bytes();
    const data = Skia.Data.fromBytes(bytes);
    const source = Skia.Image.MakeImageFromEncoded(data);
    if (!source) {
      throw new Error('Could not decode photo for look bake');
    }

    const width = source.width();
    const height = source.height();
    // Prefer CPU surface for full-res stills; fall back to GPU offscreen if needed.
    const surface = Skia.Surface.Make(width, height) ?? Skia.Surface.MakeOffscreen(width, height);
    if (!surface) {
      throw new Error('Could not allocate bake surface');
    }

    const canvas = surface.getCanvas();
    const basePaint = Skia.Paint();
    basePaint.setColorFilter(Skia.ColorFilter.MakeMatrix(buildGradeMatrix(gradeOverlay, strength)));
    canvas.drawImage(source, 0, 0, basePaint);

    const shadowsOpacity = gradeOverlay.shadowsOpacity * strength;
    if (shadowsOpacity > 0.01) {
      const paint = Skia.Paint();
      paint.setColor(hexToRgba(gradeOverlay.shadows, shadowsOpacity));
      paint.setBlendMode(BlendMode.Multiply);
      canvas.drawRect(Skia.XYWHRect(0, 0, width, height), paint);
    }

    const colorOpacity = gradeOverlay.opacity * strength;
    if (colorOpacity > 0.01) {
      const tint = Skia.Paint();
      tint.setColor(hexToRgba(gradeOverlay.color, colorOpacity));
      tint.setBlendMode(BlendMode.SoftLight);
      canvas.drawRect(Skia.XYWHRect(0, 0, width, height), tint);
    }

    const highlightsOpacity = gradeOverlay.highlightsOpacity * strength;
    if (highlightsOpacity > 0.01) {
      const paint = Skia.Paint();
      paint.setColor(hexToRgba(gradeOverlay.highlights, highlightsOpacity));
      paint.setBlendMode(BlendMode.Screen);
      canvas.drawRect(Skia.XYWHRect(0, 0, width, height), paint);
    }

    if (needsToonPass(gradeOverlay, strength)) {
      const graded = surface.makeImageSnapshot();
      applyToonPass(canvas, graded, gradeOverlay, strength);
    }

    const vig = gradeOverlay.vignette * strength;
    if (vig > 0.01) {
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.hypot(cx, cy) * 1.05;
      const shader = Skia.Shader.MakeRadialGradient(
        Skia.Point(cx, cy),
        radius,
        [hexToRgba('#000000', 0), hexToRgba('#000000', Math.min(0.92, vig * 0.85))],
        [0.35, 1],
        TileMode.Clamp,
      );
      const paint = Skia.Paint();
      paint.setShader(shader);
      paint.setBlendMode(BlendMode.Multiply);
      canvas.drawRect(Skia.XYWHRect(0, 0, width, height), paint);
    }

    // Soft frame diffusion — Diffusion dial (works even when grain is 0).
    const softBlur = Math.min(1, Math.max(0, gradeOverlay.grainBlur)) * strength;
    if (softBlur > 0.02) {
      const snapshot = surface.makeImageSnapshot();
      const sigma = 1.2 + softBlur * Math.min(width, height) * 0.016;
      const paint = Skia.Paint();
      paint.setImageFilter(Skia.ImageFilter.MakeBlur(sigma, sigma, TileMode.Clamp));
      // Blend soft over sharp so low values stay readable and high values go milky.
      paint.setAlphaf(Math.min(1, 0.28 + softBlur * 0.72));
      canvas.drawImage(snapshot, 0, 0, paint);
    }

    const grain = gradeOverlay.grain * strength;
    if (grain > 0.01) {
      // Coarser turbulence + Overlay/Multiply — SoftLight alone washes out on phone screens.
      const size = Math.min(1, Math.max(0, gradeOverlay.grainSize));
      const texture = Math.min(1, Math.max(0, gradeOverlay.grainTexture));
      // Grain soften shares the Diffusion dial (lighter than full-frame softBlur).
      const blurAmt = Math.min(1, Math.max(0, gradeOverlay.grainBlur)) * 0.65;
      const tile = 48;
      const freq = 0.22 + size * 0.55;
      const octaves = texture > 0.65 ? 3 : 2;
      const noise = Skia.Shader.MakeTurbulence(freq, freq, octaves, 7, tile, tile);

      // Soft ↔ punchy: low texture = SoftLight heavy; high = Overlay/Multiply heavy.
      const softW = 1 - texture * 0.75;
      const punchW = 0.35 + texture * 0.65;
      const speckW = 0.25 + texture * 0.75;

      const drawGrainLayer = (
        blend: BlendMode,
        alpha: number,
        weight: number,
      ) => {
        if (alpha * weight < 0.01) return;
        const paint = Skia.Paint();
        paint.setShader(noise);
        paint.setAlphaf(Math.min(0.65, alpha * weight));
        paint.setBlendMode(blend);
        if (blurAmt > 0.02) {
          const sigma = 0.4 + blurAmt * 2.4;
          paint.setImageFilter(Skia.ImageFilter.MakeBlur(sigma, sigma, TileMode.Clamp));
        }
        canvas.drawRect(Skia.XYWHRect(0, 0, width, height), paint);
      };

      drawGrainLayer(BlendMode.SoftLight, Math.min(0.35, 0.1 + grain * 0.35), softW);
      drawGrainLayer(BlendMode.Overlay, Math.min(0.55, 0.12 + grain * 0.55), punchW);
      drawGrainLayer(BlendMode.Multiply, Math.min(0.55, 0.1 + grain * 0.55), speckW);
    }

    const bloom = gradeOverlay.bloom * strength;
    if (bloom > 0.01) {
      const glow = Skia.Shader.MakeRadialGradient(
        Skia.Point(width * 0.5, height * 0.42),
        Math.hypot(width, height) * 0.55,
        [
          hexToRgba('#FFF5E0', Math.min(0.55, bloom * 0.5)),
          hexToRgba('#FFB060', Math.min(0.28, bloom * 0.24)),
          hexToRgba('#FFB060', 0),
        ],
        [0, 0.4, 1],
        TileMode.Clamp,
      );
      const glowPaint = Skia.Paint();
      glowPaint.setShader(glow);
      glowPaint.setBlendMode(BlendMode.Screen);
      canvas.drawRect(Skia.XYWHRect(0, 0, width, height), glowPaint);

      const snapshot = surface.makeImageSnapshot();
      const sigma = Math.max(6, Math.min(width, height) * 0.012 * (0.6 + bloom));
      const blurPaint = Skia.Paint();
      blurPaint.setImageFilter(Skia.ImageFilter.MakeBlur(sigma, sigma, TileMode.Clamp));
      blurPaint.setAlphaf(Math.min(0.45, bloom * 0.45));
      blurPaint.setBlendMode(BlendMode.Screen);
      canvas.drawImage(snapshot, 0, 0, blurPaint);
    }

    const leak = gradeOverlay.leak * strength;
    if (leak > 0.01) {
      const shader = Skia.Shader.MakeLinearGradient(
        Skia.Point(width * 0.92, height * 0.02),
        Skia.Point(width * 0.45, height * 0.55),
        [hexToRgba('#FF6A20', Math.min(0.72, leak * 0.75)), hexToRgba('#FF6A20', 0)],
        [0, 1],
        TileMode.Clamp,
      );
      const paint = Skia.Paint();
      paint.setShader(shader);
      paint.setBlendMode(BlendMode.Screen);
      canvas.drawRect(Skia.XYWHRect(0, 0, width, height), paint);
    }

    const stamp = gradeOverlay.stamp * strength;
    if (stamp > 0.01) {
      const text = formatLookStampDate();
      const size = Math.max(18, Math.min(width, height) * 0.045);
      const font = stampFont(size);
      font.setScaleX(1.05);
      const metrics = font.measureText(text);
      const pad = Math.min(width, height) * 0.045;
      const x = width - pad - metrics.width;
      const y = height - pad;
      const paint = Skia.Paint();
      paint.setColor(hexToRgba('#FF9A1A', Math.min(0.95, stamp)));
      canvas.drawText(text, x, y, paint, font);
    }

    surface.flush();
    const snapshot = surface.makeImageSnapshot();
    // GPU snapshots must be copied to CPU memory before encodeToBytes.
    const baked = snapshot.makeNonTextureImage() ?? snapshot;
    const histogram = computeHistogram(baked);
    const encoded = baked.encodeToBytes(ImageFormat.JPEG, quality);
    if (!encoded || encoded.byteLength < 1024) {
      throw new Error('Could not encode looked photo');
    }

    // Persist under documents — cache can be purged and gallery would show a missing/raw file.
    // Preview bakes overwrite a single cache file to avoid filling looks/.
    const out = options.previewCacheKey
      ? (() => {
          const cacheDir = new Directory(Paths.cache, 'look-preview');
          if (!cacheDir.exists) {
            cacheDir.create({ intermediates: true, overwrite: false });
          }
          const safe = options.previewCacheKey.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
          return new File(cacheDir, `${safe || 'live'}.jpg`);
        })()
      : (() => {
          const looksDir = new Directory(Paths.document, 'looks');
          if (!looksDir.exists) {
            looksDir.create({ intermediates: true, overwrite: false });
          }
          return new File(looksDir, `iris-look-${Date.now()}.jpg`);
        })();
    out.create({ overwrite: true });
    // Copy into a plain ArrayBuffer-backed view so native write gets contiguous JPEG bytes.
    const jpegBytes = new Uint8Array(encoded);
    out.write(jpegBytes);

    if (!out.exists || (out.size ?? 0) < 1024) {
      throw new Error('Look bake failed to write JPEG');
    }

    return {
      path: toPath(out.uri),
      // Bust Image cache when overwriting the same preview path.
      uri: options.previewCacheKey ? `${out.uri}?t=${Date.now()}` : out.uri,
      histogram,
    };
  } finally {
    if (disposableMlPath) {
      deleteQuietly(disposableMlPath);
    }
  }
}

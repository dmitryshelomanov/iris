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
import { buildGradeMatrix, hexToRgbaTuple, needsLookBake } from './gradeMatrix';

export type BakeLookResult = {
  path: string;
  uri: string;
  /** 32-bin luminance histogram, normalized 0…1 */
  histogram: number[];
};

function toFileUri(path: string) {
  return path.startsWith('file://') ? path : `file://${path}`;
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
  const stepX = Math.max(1, Math.floor(width / 48));
  const stepY = Math.max(1, Math.floor(height / 48));

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
 */
export async function bakeLookIntoPhoto(
  inputPath: string,
  overlay: LookOverlay,
  options: { strength?: number; jpegQuality?: number } = {},
): Promise<BakeLookResult> {
  const strength = options.strength ?? 1;
  const quality = Math.round(Math.max(0.1, Math.min(1, options.jpegQuality ?? 0.95)) * 100);
  const inputUri = toFileUri(inputPath);
  const input = new File(inputUri);

  if (!needsLookBake(overlay, strength)) {
    const bytes = await input.bytes();
    const data = Skia.Data.fromBytes(bytes);
    const image = Skia.Image.MakeImageFromEncoded(data);
    const histogram = image ? computeHistogram(image) : new Array(32).fill(0);
    return { path: inputPath.replace(/^file:\/\//, ''), uri: inputUri, histogram };
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
  basePaint.setColorFilter(Skia.ColorFilter.MakeMatrix(buildGradeMatrix(overlay, strength)));
  canvas.drawImage(source, 0, 0, basePaint);

  const shadowsOpacity = overlay.shadowsOpacity * strength;
  if (shadowsOpacity > 0.01) {
    const paint = Skia.Paint();
    paint.setColor(hexToRgba(overlay.shadows, shadowsOpacity));
    paint.setBlendMode(BlendMode.Multiply);
    canvas.drawRect(Skia.XYWHRect(0, 0, width, height), paint);
  }

  const colorOpacity = overlay.opacity * strength;
  if (colorOpacity > 0.01) {
    const tint = Skia.Paint();
    tint.setColor(hexToRgba(overlay.color, colorOpacity));
    tint.setBlendMode(BlendMode.SoftLight);
    canvas.drawRect(Skia.XYWHRect(0, 0, width, height), tint);
  }

  const highlightsOpacity = overlay.highlightsOpacity * strength;
  if (highlightsOpacity > 0.01) {
    const paint = Skia.Paint();
    paint.setColor(hexToRgba(overlay.highlights, highlightsOpacity));
    paint.setBlendMode(BlendMode.Screen);
    canvas.drawRect(Skia.XYWHRect(0, 0, width, height), paint);
  }

  const vig = overlay.vignette * strength;
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

  const grain = overlay.grain * strength;
  if (grain > 0.01) {
    // Coarser turbulence + Overlay/Multiply — SoftLight alone washes out on phone screens.
    const tile = 48;
    const freq = 0.22 + grain * 0.55;
    const noise = Skia.Shader.MakeTurbulence(freq, freq, 2, 7, tile, tile);

    const soft = Skia.Paint();
    soft.setShader(noise);
    soft.setAlphaf(Math.min(0.35, 0.1 + grain * 0.35));
    soft.setBlendMode(BlendMode.SoftLight);
    canvas.drawRect(Skia.XYWHRect(0, 0, width, height), soft);

    const punch = Skia.Paint();
    punch.setShader(noise);
    punch.setAlphaf(Math.min(0.55, 0.12 + grain * 0.55));
    punch.setBlendMode(BlendMode.Overlay);
    canvas.drawRect(Skia.XYWHRect(0, 0, width, height), punch);

    const speck = Skia.Paint();
    speck.setShader(noise);
    speck.setAlphaf(Math.min(0.55, 0.1 + grain * 0.55));
    speck.setBlendMode(BlendMode.Multiply);
    canvas.drawRect(Skia.XYWHRect(0, 0, width, height), speck);
  }

  const bloom = overlay.bloom * strength;
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

  const leak = overlay.leak * strength;
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

  const stamp = overlay.stamp * strength;
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
  const looksDir = new Directory(Paths.document, 'looks');
  if (!looksDir.exists) {
    looksDir.create({ intermediates: true, overwrite: false });
  }
  const out = new File(looksDir, `iris-look-${Date.now()}.jpg`);
  out.create({ overwrite: true });
  // Copy into a plain ArrayBuffer-backed view so native write gets contiguous JPEG bytes.
  const jpegBytes = new Uint8Array(encoded);
  out.write(jpegBytes);

  if (!out.exists || (out.size ?? 0) < 1024) {
    throw new Error('Look bake failed to write JPEG');
  }

  return {
    path: out.uri.replace(/^file:\/\//, ''),
    uri: out.uri,
    histogram,
  };
}

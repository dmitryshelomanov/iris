import { Skia, TileMode, type SkCanvas, type SkImage } from '@shopify/react-native-skia';

import type { LookOverlay } from './presets';

const TOON_SKSL = `
uniform shader image;
uniform float levels;
uniform float edgeStrength;

half luma(half3 c) {
  return dot(c, half3(0.2126, 0.7152, 0.0722));
}

half4 main(float2 xy) {
  half4 src = image.eval(xy);
  float lv = max(levels, 2.0);
  half3 quantized = floor(src.rgb * lv + 0.5) / lv;

  half edge = 0.0;
  if (edgeStrength > 0.01) {
    half l = luma(image.eval(xy).rgb);
    half lxp = luma(image.eval(xy + float2(1.0, 0.0)).rgb);
    half lxm = luma(image.eval(xy + float2(-1.0, 0.0)).rgb);
    half lyp = luma(image.eval(xy + float2(0.0, 1.0)).rgb);
    half lym = luma(image.eval(xy + float2(0.0, -1.0)).rgb);
    half gx = lxp - lxm;
    half gy = lyp - lym;
    edge = clamp(length(half2(gx, gy)) * (1.2 + edgeStrength * 3.5), 0.0, 1.0);
    edge *= edgeStrength;
  }

  half3 ink = quantized * (1.0 - edge);
  return half4(ink, src.a);
}
`;

let cachedEffect: ReturnType<typeof Skia.RuntimeEffect.Make> | undefined;

function getToonEffect() {
  if (cachedEffect !== undefined) return cachedEffect;
  cachedEffect = Skia.RuntimeEffect.Make(TOON_SKSL);
  return cachedEffect;
}

export function needsToonPass(overlay: LookOverlay, strength: number) {
  if (strength <= 0.01) return false;
  return overlay.smooth > 0.01 || overlay.posterize > 0.01 || overlay.edges > 0.01;
}

/**
 * Replace the graded surface contents with smooth → posterize → edges.
 * Call after matrix / split-tone and before vignette / grain / bloom.
 */
export function applyToonPass(
  canvas: SkCanvas,
  graded: SkImage,
  overlay: LookOverlay,
  strength: number,
) {
  const s = Math.max(0, Math.min(1, strength));
  const smooth = overlay.smooth * s;
  const posterize = overlay.posterize * s;
  const edges = overlay.edges * s;
  if (smooth <= 0.01 && posterize <= 0.01 && edges <= 0.01) return;

  let filter = null as ReturnType<typeof Skia.ImageFilter.MakeBlur> | null;

  if (smooth > 0.01) {
    const sigma = 0.6 + smooth * 10;
    filter = Skia.ImageFilter.MakeBlur(sigma, sigma, TileMode.Clamp, null);
  }

  if (posterize > 0.01 || edges > 0.01) {
    const effect = getToonEffect();
    if (effect) {
      const builder = Skia.RuntimeShaderBuilder(effect);
      // posterize 0 → ~32 levels, 1 → ~4 levels
      const levels = 32 - posterize * 28;
      builder.setUniform('levels', [Math.max(2, levels)]);
      builder.setUniform('edgeStrength', [edges]);
      filter = Skia.ImageFilter.MakeRuntimeShader(builder, 'image', filter);
    }
  }

  canvas.clear(Skia.Color('transparent'));
  const paint = Skia.Paint();
  if (filter) paint.setImageFilter(filter);
  canvas.drawImage(graded, 0, 0, paint);
}

import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import {
  formatLookStampDate,
  buildGradeMatrix,
  type LookOverlay as LookOverlayConfig,
} from '../model';

type Props = {
  overlay: LookOverlayConfig;
  /** Bake strength — drives matrix-aligned preview intensity. */
  strength?: number;
};

function isActive(overlay: LookOverlayConfig) {
  return (
    Math.abs(overlay.contrast - 1) > 0.02 ||
    Math.abs(overlay.saturation - 1) > 0.02 ||
    Math.abs(overlay.brightness) > 0.01 ||
    Math.abs(overlay.warmth) > 0.02 ||
    overlay.opacity > 0 ||
    overlay.shadowsOpacity > 0 ||
    overlay.highlightsOpacity > 0 ||
    overlay.vignette > 0 ||
    overlay.mono > 0 ||
    overlay.grain > 0 ||
    overlay.bloom > 0 ||
    overlay.leak > 0 ||
    overlay.stamp > 0 ||
    overlay.smooth > 0 ||
    overlay.posterize > 0 ||
    overlay.edges > 0
  );
}

/** Read diagonal scale + bias from bake matrix to mirror contrast/brightness. */
function matrixPreview(matrix: number[]) {
  const rScale = matrix[0];
  const gScale = matrix[6];
  const bScale = matrix[12];
  const avgScale = (rScale + gScale + bScale) / 3;
  const bias = (matrix[4] + matrix[9] + matrix[14]) / 3;
  const warmth = rScale - bScale;
  const satProxy = Math.abs(matrix[1]) + Math.abs(matrix[2]) + Math.abs(matrix[5]);
  return { avgScale, bias, warmth, satProxy };
}

/**
 * Live preview grade — approximates bakeLookIntoPhoto using the same matrix math
 * and strength-scaled blend layers (Multiply / SoftLight / Screen opacities).
 */
export function LookOverlay({ overlay, strength = 1 }: Props) {
  const [stampText, setStampText] = useState(() => formatLookStampDate());
  const matrix = useMemo(() => buildGradeMatrix(overlay, strength), [overlay, strength]);
  const preview = useMemo(() => matrixPreview(matrix), [matrix]);

  const shadowsOpacity = overlay.shadowsOpacity * strength;
  const colorOpacity = overlay.opacity * strength;
  const highlightsOpacity = overlay.highlightsOpacity * strength;
  const vignette = overlay.vignette * strength;
  const mono = overlay.mono * strength;
  const grain = overlay.grain * strength;
  const bloom = overlay.bloom * strength;
  const leak = overlay.leak * strength;
  const stamp = overlay.stamp * strength;
  const toonPosterize = overlay.posterize * strength;
  const toonEdges = overlay.edges * strength;
  const toonSmooth = overlay.smooth * strength;
  const isToon = toonPosterize > 0.02 || toonEdges > 0.02 || toonSmooth > 0.02;

  useEffect(() => {
    if (stamp <= 0.01) return;
    setStampText(formatLookStampDate());
    const id = setInterval(() => setStampText(formatLookStampDate()), 60_000);
    return () => clearInterval(id);
  }, [stamp]);

  if (!isActive(overlay)) {
    return null;
  }

  const crush = Math.max(0, preview.avgScale - 1);
  const soft = Math.max(0, 1 - preview.avgScale);
  const cool = Math.max(0, -preview.warmth);
  const warm = Math.max(0, preview.warmth);
  const lift = Math.max(0, preview.bias);
  const crushBias = Math.max(0, -preview.bias);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {soft > 0.02 || lift > 0.005 ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: '#C8C0B4',
              opacity: soft * 0.3 + lift * 1.1,
            },
          ]}
        />
      ) : null}
      {crush > 0.02 || crushBias > 0.005 || toonPosterize > 0.05 ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: '#050508',
              opacity:
                crush * 0.24 +
                crushBias * 1.2 +
                (isToon ? toonPosterize * 0.18 + toonSmooth * 0.08 : 0),
            },
          ]}
        />
      ) : null}

      {isToon && overlay.saturation > 1.05 ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: overlay.color,
              opacity: Math.min(0.22, (overlay.saturation - 1) * 0.28 * strength),
            },
          ]}
        />
      ) : null}

      {/* Posterize wash — flat midtone bands approximating toonBake levels */}
      {isToon && toonPosterize > 0.08 ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: '#1A1816',
              opacity: Math.min(0.28, toonPosterize * 0.22),
            },
          ]}
        />
      ) : null}

      {warm > 0.015 ? (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: '#E8A040', opacity: warm * 0.55 }]}
        />
      ) : null}
      {cool > 0.015 ? (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: '#3080A8', opacity: cool * 0.55 }]}
        />
      ) : null}

      {/* Multiply-ish shadows (bake: BlendMode.Multiply) */}
      {shadowsOpacity > 0.01 ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: overlay.shadows, opacity: Math.min(0.92, shadowsOpacity * 0.9) },
          ]}
        />
      ) : null}

      {/* SoftLight tint (bake: BlendMode.SoftLight) */}
      {colorOpacity > 0.01 ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: overlay.color, opacity: Math.min(0.85, colorOpacity * 0.95) },
          ]}
        />
      ) : null}

      {/* Screen highlights (bake: BlendMode.Screen) */}
      {highlightsOpacity > 0.01 ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: overlay.highlights,
              opacity: Math.min(0.7, highlightsOpacity * 0.58),
            },
          ]}
        />
      ) : null}

      {mono > 0.01 ? (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: '#6E6E6E', opacity: mono * 0.62 }]}
        />
      ) : null}

      {overlay.saturation < 0.95 && mono < 0.5 ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: '#8A8680',
              opacity: (1 - overlay.saturation) * 0.28 * strength + preview.satProxy * 0.05,
            },
          ]}
        />
      ) : null}

      {toonEdges > 0.05 ? (
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="irisToonInk" cx="50%" cy="50%" rx="70%" ry="70%">
              <Stop offset="0" stopColor="#000" stopOpacity={0} />
              <Stop offset="0.45" stopColor="#000" stopOpacity={toonEdges * 0.06} />
              <Stop offset="0.75" stopColor="#000" stopOpacity={toonEdges * 0.18} />
              <Stop offset="1" stopColor="#000" stopOpacity={Math.min(0.55, toonEdges * 0.48)} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#irisToonInk)" />
          <Rect
            x="1.5%"
            y="1.5%"
            width="97%"
            height="97%"
            fill="none"
            stroke="#0A0A0A"
            strokeWidth={1.2 + toonEdges * 2.8}
            strokeOpacity={Math.min(0.6, toonEdges * 0.55)}
          />
        </Svg>
      ) : null}

      {vignette > 0.01 ? (
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="irisVignette" cx="50%" cy="48%" rx="72%" ry="72%">
              <Stop offset="0.35" stopColor="#000" stopOpacity={0} />
              <Stop offset="1" stopColor="#000" stopOpacity={Math.min(0.92, vignette * 0.85)} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#irisVignette)" />
        </Svg>
      ) : null}

      {/* Denser grain field approximating SoftLight+Overlay turbulence */}
      {grain > 0.03 ? (
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          {Array.from({ length: 520 }).map((_, i) => {
            const x = ((i * 67) % 97) + 1.5;
            const y = ((i * 41) % 97) + 1.5;
            const punch = i % 3 === 0;
            return (
              <Circle
                key={i}
                cx={`${x}%`}
                cy={`${y}%`}
                r={0.18 + (i % 4) * 0.09}
                fill={punch ? '#E8E4DC' : '#2A2824'}
                opacity={grain * (punch ? 0.14 + (i % 5) * 0.03 : 0.1 + (i % 5) * 0.025)}
              />
            );
          })}
        </Svg>
      ) : null}

      {bloom > 0.02 ? (
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="irisBloom" cx="50%" cy="42%" rx="58%" ry="58%">
              <Stop offset="0" stopColor="#FFF5E0" stopOpacity={Math.min(0.55, bloom * 0.5)} />
              <Stop offset="0.4" stopColor="#FFB060" stopOpacity={Math.min(0.28, bloom * 0.24)} />
              <Stop offset="1" stopColor="#FFB060" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#irisBloom)" />
        </Svg>
      ) : null}

      {leak > 0.02 ? (
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="irisLeak" x1="92%" y1="2%" x2="45%" y2="55%">
              <Stop offset="0" stopColor="#FF6A20" stopOpacity={Math.min(0.7, leak * 0.72)} />
              <Stop offset="1" stopColor="#FF6A20" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#irisLeak)" />
        </Svg>
      ) : null}

      {stamp > 0.02 ? (
        <Text style={[styles.stamp, { opacity: Math.min(0.95, stamp) }]}>{stampText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stamp: {
    position: 'absolute',
    right: '4.5%',
    bottom: '4.5%',
    color: '#FF9A1A',
    fontFamily: 'Courier',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1.5,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

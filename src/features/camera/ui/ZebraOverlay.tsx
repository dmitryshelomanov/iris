import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, Pattern, Rect, Line } from 'react-native-svg';

type Props = {
  /** 0…1 — how much of the frame shows zebra stripes (highlight warning). */
  intensity: number;
};

/**
 * Classic zebra stripes for highlight warning.
 * Intensity is driven by live exposure bias / ISO heuristics when true luma isn't available.
 */
export function ZebraOverlay({ intensity }: Props) {
  const cover = Math.max(0, Math.min(1, intensity));
  const { height } = useWindowDimensions();
  if (cover < 0.05) return null;

  const bandHeight = height * ((18 + cover * 42) / 100);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.band, { height: bandHeight, top: height * 0.08 }]}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <Pattern
              id="irisZebra"
              patternUnits="userSpaceOnUse"
              width="10"
              height="10"
              patternTransform="rotate(45)"
            >
              <Line x1="0" y1="0" x2="0" y2="10" stroke="rgba(255,255,255,0.55)" strokeWidth="5" />
            </Pattern>
          </Defs>
          <Rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="url(#irisZebra)"
            opacity={0.35 + cover * 0.35}
          />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
});

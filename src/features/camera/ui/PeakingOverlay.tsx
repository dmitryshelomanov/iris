import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

type Props = {
  /** 0…1 peaking strength — higher when focus is near critical / locked. */
  intensity: number;
  focusY?: number;
};

/**
 * Focus peaking assist — magenta edge wash near the focus plane.
 * Approximates peaking without a frame processor by concentrating on the focus band.
 */
export function PeakingOverlay({ intensity, focusY = 0.5 }: Props) {
  const amount = Math.max(0, Math.min(1, intensity));
  const { height } = useWindowDimensions();
  if (amount < 0.04) return null;

  const bandTop = Math.max(8, Math.min(height - 8, focusY * height));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="irisPeak" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FF2D55" stopOpacity={0} />
            <Stop offset="0.42" stopColor="#FF2D55" stopOpacity={Math.min(0.35, amount * 0.32)} />
            <Stop offset="0.5" stopColor="#FF5E7A" stopOpacity={Math.min(0.5, amount * 0.48)} />
            <Stop offset="0.58" stopColor="#FF2D55" stopOpacity={Math.min(0.35, amount * 0.32)} />
            <Stop offset="1" stopColor="#FF2D55" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#irisPeak)" />
      </Svg>
      <View
        style={[
          styles.band,
          {
            top: bandTop,
            opacity: 0.35 + amount * 0.45,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    position: 'absolute',
    left: '12%',
    right: '12%',
    height: 2,
    marginTop: -1,
    backgroundColor: '#FF2D55',
    shadowColor: '#FF2D55',
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
});

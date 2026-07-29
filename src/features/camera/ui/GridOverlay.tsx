import { StyleSheet, View } from 'react-native';

import { aspectFrameLayout } from '../model/aspectFrame';
import type { AspectRatio } from '../model/types';

type Props = {
  aspect: AspectRatio;
  /** Full preview container size (screen / camera root). */
  width: number;
  height: number;
};

/** Rule-of-thirds grid inside the capture aspect frame. */
export function GridOverlay({ aspect, width: w, height: h }: Props) {
  if (w <= 0 || h <= 0) return null;

  const frame = aspectFrameLayout(w, h, aspect);

  return (
    <View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          top: frame.top,
          left: frame.left,
          width: frame.width,
          height: frame.height,
        },
      ]}
    >
      <View style={[styles.lineH, { top: '33.333%' }]} />
      <View style={[styles.lineH, { top: '66.666%' }]} />
      <View style={[styles.lineV, { left: '33.333%' }]} />
      <View style={[styles.lineV, { left: '66.666%' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
  },
  lineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  lineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
});

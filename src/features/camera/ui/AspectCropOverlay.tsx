import { StyleSheet, View } from 'react-native';

import { aspectFrameLayout } from '../model/aspectFrame';
import type { AspectRatio } from '../model/types';

type Props = {
  aspect: AspectRatio;
  /** Full preview container size (screen / camera root). */
  width: number;
  height: number;
};

/**
 * Letterbox / pillarbox chrome around the capture frame.
 * Portrait-locked: 4:3 → 3:4 frame, 16:9 → 9:16 frame.
 */
export function AspectCropOverlay({ aspect, width: w, height: h }: Props) {
  if (w <= 0 || h <= 0) return null;

  const frame = aspectFrameLayout(w, h, aspect);
  const { top, bottom, left, right } = frame;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {top > 0.5 ? <View style={[styles.bar, { top: 0, left: 0, right: 0, height: top }]} /> : null}
      {bottom > 0.5 ? (
        <View style={[styles.bar, { bottom: 0, left: 0, right: 0, height: bottom }]} />
      ) : null}
      {left > 0.5 ? (
        <View style={[styles.bar, { top: 0, bottom: 0, left: 0, width: left }]} />
      ) : null}
      {right > 0.5 ? (
        <View style={[styles.bar, { top: 0, bottom: 0, right: 0, width: right }]} />
      ) : null}
      <View
        style={[
          styles.frame,
          {
            top,
            left,
            width: frame.width,
            height: frame.height,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  frame: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
  },
});

import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';

import type { AspectRatio } from '../model/types';

type Props = {
  aspect: AspectRatio;
};

/**
 * Letterbox / pillarbox mask so the visible frame matches the capture aspect.
 * Portrait-locked: 4:3 → 3:4 frame, 16:9 → 9:16 frame.
 */
export function AspectCropOverlay({ aspect }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  const { width: w, height: h } = size;
  let top = 0;
  let bottom = 0;
  let left = 0;
  let right = 0;

  if (w > 0 && h > 0) {
    const frameRatio = aspect === '16:9' ? 9 / 16 : 3 / 4; // width / height
    const screenRatio = w / h;

    if (screenRatio > frameRatio) {
      // Screen wider than frame → pillarbox
      const frameW = h * frameRatio;
      const bar = (w - frameW) / 2;
      left = bar;
      right = bar;
    } else {
      // Screen taller than frame → letterbox
      const frameH = w / frameRatio;
      const bar = (h - frameH) / 2;
      top = bar;
      bottom = bar;
    }
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout}>
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
      {w > 0 ? (
        <View
          style={[
            styles.frame,
            {
              top,
              bottom,
              left,
              right,
            },
          ]}
        />
      ) : null}
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

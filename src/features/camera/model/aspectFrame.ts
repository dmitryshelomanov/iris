import type { AspectRatio } from './types';

/** Centered capture frame within a portrait-locked screen layout. */
export type AspectFrameLayout = {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
};

/**
 * Portrait-locked: 4:3 → 3:4 frame, 16:9 → 9:16 frame.
 * Letterbox or pillarbox so the clear rect matches the save aspect.
 */
export function aspectFrameLayout(
  width: number,
  height: number,
  aspect: AspectRatio,
): AspectFrameLayout {
  if (width <= 0 || height <= 0) {
    return { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 };
  }

  const frameRatio = aspect === '16:9' ? 9 / 16 : 3 / 4; // width / height
  const screenRatio = width / height;

  if (screenRatio > frameRatio) {
    // Screen wider than frame → pillarbox
    const frameW = height * frameRatio;
    const bar = (width - frameW) / 2;
    return { top: 0, left: bar, width: frameW, height, bottom: 0, right: bar };
  }

  // Screen taller than frame → letterbox
  const frameH = width / frameRatio;
  const bar = (height - frameH) / 2;
  return { top: bar, left: 0, width, height: frameH, bottom: bar, right: 0 };
}

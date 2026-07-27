import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { DeviceMotion } from 'expo-sensors';
import { hapticLevelSnap } from '../model/haptics';

/** Snap to level within this many degrees. */
const LEVEL_THRESHOLD = 0.75;
/** Hide indicator when tilt is too steep (matches Camera.app). */
const VISIBLE_MAX = 14;
/** px offset per degree of roll for the moving segment. */
const OFFSET_PER_DEG = 1.6;
const MAX_OFFSET = 22;

const SEGMENT_W = 36;
const GAP = 5;
const MERGED_W = SEGMENT_W * 3 + GAP * 2;

type Props = {
  /** When false (background / left camera), pause motion + haptics. */
  active?: boolean;
};

/**
 * Native-style horizon level (iOS Camera):
 * fixed left/right ticks + a center segment that drifts with roll.
 * When level, segments merge into a single yellow line.
 */
export function LevelOverlay({ active = true }: Props) {
  const [roll, setRoll] = useState(0);
  const wasLeveled = useRef(false);

  useEffect(() => {
    if (!active) {
      wasLeveled.current = false;
      return;
    }

    let mounted = true;
    DeviceMotion.setUpdateInterval(50);
    const sub = DeviceMotion.addListener((data) => {
      if (!mounted) return;
      const gamma = data.rotation?.gamma ?? 0;
      const nextRoll = (gamma * 180) / Math.PI;
      const abs = Math.abs(nextRoll);
      const leveled = abs <= VISIBLE_MAX && abs < LEVEL_THRESHOLD;
      if (leveled && !wasLeveled.current) {
        hapticLevelSnap();
      }
      wasLeveled.current = leveled;
      setRoll(nextRoll);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, [active]);

  const abs = Math.abs(roll);
  if (abs > VISIBLE_MAX) return null;

  const leveled = abs < LEVEL_THRESHOLD;
  const offsetY = leveled ? 0 : Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, roll * OFFSET_PER_DEG));

  return (
    <View pointerEvents="none" style={styles.wrap}>
      {leveled ? (
        <View style={[styles.line, styles.merged]} />
      ) : (
        <View style={styles.row}>
          <View style={[styles.line, styles.segment]} />
          <View style={[styles.line, styles.segment, { transform: [{ translateY: offsetY }] }]} />
          <View style={[styles.line, styles.segment]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
  },
  line: {
    height: StyleSheet.hairlineWidth * 2,
    borderRadius: 1,
  },
  segment: {
    width: SEGMENT_W,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  merged: {
    width: MERGED_W,
    height: 1.5,
    backgroundColor: '#FFD60A',
  },
});

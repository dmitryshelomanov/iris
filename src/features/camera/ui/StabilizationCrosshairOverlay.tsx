import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { DeviceMotion } from 'expo-sensors';
import { hapticLevelSnap } from '../model/haptics';

/** Snap to level within this many degrees. */
const LEVEL_THRESHOLD = 0.9;
/** Hide tilt guides when phone is nearly flat / too steep. */
const VISIBLE_MAX = 18;
const OFFSET_PER_DEG = 1.4;
const MAX_OFFSET = 28;

type Props = {
  /** When false (background / left camera), pause motion + haptics. */
  active?: boolean;
};

/**
 * Center reticle with light roll guidance (distinct from the Pro horizon Level).
 */
export function StabilizationCrosshairOverlay({ active = true }: Props) {
  const [roll, setRoll] = useState(0);
  const [pitch, setPitch] = useState(0);
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
      const beta = data.rotation?.beta ?? 0;
      const nextRoll = (gamma * 180) / Math.PI;
      const nextPitch = (beta * 180) / Math.PI;
      const leveled = Math.abs(nextRoll) < LEVEL_THRESHOLD && Math.abs(nextPitch - 90) > 20;
      if (leveled && !wasLeveled.current) {
        hapticLevelSnap();
      }
      wasLeveled.current = leveled;
      setRoll(nextRoll);
      setPitch(nextPitch);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, [active]);

  const absRoll = Math.abs(roll);
  const showTilt = absRoll <= VISIBLE_MAX;
  const leveled = absRoll < LEVEL_THRESHOLD && Math.abs(pitch - 90) > 20;
  const offsetY = leveled ? 0 : Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, roll * OFFSET_PER_DEG));

  return (
    <View pointerEvents="none" style={styles.wrap}>
      {/* Fixed center reticle */}
      <View style={styles.reticle}>
        <View style={[styles.arm, styles.armH]} />
        <View style={[styles.arm, styles.armV]} />
        <View style={[styles.ring, leveled && styles.ringLevel]} />
        <View style={[styles.dot, leveled && styles.dotLevel]} />
      </View>

      {/* Soft tilt tick that drifts with roll */}
      {showTilt && !leveled ? (
        <View style={[styles.tiltTick, { transform: [{ translateY: offsetY }] }]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticle: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arm: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  armH: {
    width: 56,
    height: StyleSheet.hairlineWidth * 2,
  },
  armV: {
    width: StyleSheet.hairlineWidth * 2,
    height: 56,
  },
  ring: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  ringLevel: {
    borderColor: '#FFD60A',
  },
  dot: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  dotLevel: {
    backgroundColor: '#FFD60A',
  },
  tiltTick: {
    position: 'absolute',
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
});

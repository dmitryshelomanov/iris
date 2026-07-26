import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export type FocusReticleState = {
  x: number;
  y: number;
  locked: boolean;
} | null;

type Props = {
  state: FocusReticleState;
};

export function FocusReticle({ state }: Props) {
  const scale = useSharedValue(1.35);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!state) {
      opacity.value = withTiming(0, { duration: 180 });
      return;
    }
    opacity.value = withTiming(1, { duration: 80 });
    scale.value = withSequence(withTiming(1.25, { duration: 0 }), withTiming(1, { duration: 160 }));
    if (!state.locked) {
      const t = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 280 });
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [state?.x, state?.y, state?.locked, opacity, scale]);

  const anim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!state) return null;

  const color = state.locked ? '#FFD60A' : '#FFFFFF';

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        anim,
        {
          left: state.x - 28,
          top: state.y - 28,
          borderColor: color,
        },
      ]}
    >
      <View style={[styles.corner, styles.tl, { borderColor: color }]} />
      <View style={[styles.corner, styles.tr, { borderColor: color }]} />
      <View style={[styles.corner, styles.bl, { borderColor: color }]} />
      <View style={[styles.corner, styles.br, { borderColor: color }]} />
      {state.locked ? <View style={[styles.lockBar, { backgroundColor: color }]} /> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
    zIndex: 15,
  },
  corner: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderColor: '#fff',
  },
  tl: { top: -1, left: -1, borderTopWidth: 2, borderLeftWidth: 2 },
  tr: { top: -1, right: -1, borderTopWidth: 2, borderRightWidth: 2 },
  bl: { bottom: -1, left: -1, borderBottomWidth: 2, borderLeftWidth: 2 },
  br: { bottom: -1, right: -1, borderBottomWidth: 2, borderRightWidth: 2 },
  lockBar: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: -10,
    width: 18,
    height: 2,
    borderRadius: 1,
  },
});

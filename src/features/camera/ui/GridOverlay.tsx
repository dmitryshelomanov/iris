import { StyleSheet, View } from 'react-native';

/** Rule-of-thirds grid for composition. */
export function GridOverlay() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.lineH, { top: '33.333%' }]} />
      <View style={[styles.lineH, { top: '66.666%' }]} />
      <View style={[styles.lineV, { left: '33.333%' }]} />
      <View style={[styles.lineV, { left: '66.666%' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
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

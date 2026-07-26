import { StyleSheet, View } from 'react-native';

type Props = {
  bins: number[] | null | undefined;
};

/** Live exposure meter (synthesized) and/or last baked luminance histogram. */
export function HistogramOverlay({ bins }: Props) {
  if (!bins || bins.length === 0) {
    return (
      <View pointerEvents="none" style={styles.wrap}>
        <View style={styles.empty} />
      </View>
    );
  }

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <View style={styles.chart}>
        {bins.map((value, index) => (
          <View
            key={index}
            style={[
              styles.bar,
              {
                height: `${Math.max(4, value * 100)}%`,
                opacity: 0.35 + value * 0.65,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 12,
    top: '16%',
    width: 88,
    height: 48,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  chart: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1,
  },
  bar: {
    flex: 1,
    backgroundColor: '#FBBF24',
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
  },
  empty: {
    flex: 1,
    opacity: 0.3,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});

/**
 * Synthesize a live luminance histogram from exposure telemetry.
 * Used until a true frame-processor histogram is available.
 */
export function synthesizeLiveHistogram(input: {
  iso: number;
  shutter: number;
  ev: number;
  bins?: number;
}): number[] {
  const bins = input.bins ?? 32;
  const hist = new Array<number>(bins).fill(0);

  // Map exposure to a center-of-mass in [0,1]
  const logShutter = Math.log2(Math.max(1 / 8000, Math.min(1, input.shutter)));
  const logIso = Math.log2(Math.max(25, Math.min(12800, input.iso)) / 100);
  const exposure = logShutter + logIso + input.ev;
  // Typical daylight ~ -6…0 in this space → map toward mid
  const center = Math.max(0.12, Math.min(0.88, 0.52 + exposure * 0.045));
  const spread = Math.max(0.08, 0.18 - Math.abs(input.ev) * 0.015);

  for (let i = 0; i < bins; i++) {
    const x = (i + 0.5) / bins;
    const d = (x - center) / spread;
    hist[i] = Math.exp(-0.5 * d * d);
  }

  // Highlight shoulder grows with positive EV
  if (input.ev > 0.2) {
    for (let i = Math.floor(bins * 0.75); i < bins; i++) {
      hist[i] += (input.ev / 3) * ((i - bins * 0.75) / (bins * 0.25));
    }
  }
  // Shadow crush with negative EV
  if (input.ev < -0.2) {
    for (let i = 0; i < Math.floor(bins * 0.25); i++) {
      hist[i] += (-input.ev / 3) * (1 - i / (bins * 0.25));
    }
  }

  const max = Math.max(1e-6, ...hist);
  return hist.map((v) => v / max);
}

/** 0…1 zebra intensity from exposure bias / ISO. */
export function zebraIntensityFromExposure(ev: number, iso: number) {
  const isoPush = Math.max(0, (iso - 400) / 3200);
  return Math.max(0, Math.min(1, (ev - 0.15) / 1.8 + isoPush * 0.25));
}

/** 0…1 peaking intensity — stronger when focus locked or mid-range lens position. */
export function peakingIntensity(focus: number, locked: boolean) {
  const near = 1 - Math.abs(focus - 0.45) * 1.4;
  return Math.max(0, Math.min(1, (locked ? 0.85 : 0.45) * Math.max(0.2, near)));
}

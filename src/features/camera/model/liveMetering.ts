/** 0…1 peaking intensity — stronger when focus locked or mid-range lens position. */
export function peakingIntensity(focus: number, locked: boolean) {
  const near = 1 - Math.abs(focus - 0.45) * 1.4;
  return Math.max(0, Math.min(1, (locked ? 0.85 : 0.45) * Math.max(0.2, near)));
}

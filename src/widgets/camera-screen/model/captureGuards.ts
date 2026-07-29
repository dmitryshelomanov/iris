export type PreviewInteractionGuardInput = {
  manualEnabled: boolean;
  countdown: number | null;
  isCapturing: boolean;
};

export function canPreviewInteract({
  manualEnabled,
  countdown,
  isCapturing,
}: PreviewInteractionGuardInput): boolean {
  return !manualEnabled && countdown == null && !isCapturing;
}

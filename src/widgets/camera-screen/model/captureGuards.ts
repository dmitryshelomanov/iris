export type PreviewInteractionGuardInput = {
  countdown: number | null;
  isCapturing: boolean;
};

export function canPreviewInteract({
  countdown,
  isCapturing,
}: PreviewInteractionGuardInput): boolean {
  return countdown == null && !isCapturing;
}

import { useCallback, useState, type RefObject } from 'react';

type CaptureLock = {
  isCapturing: boolean;
  beginCapture: () => void;
  endCapture: () => void;
};

type Options = {
  isCapturingRef: RefObject<boolean>;
  /** Bridge for hooks that must subscribe to capturing (e.g. defer manual apply). */
  onChange?: (capturing: boolean) => void;
};

export function useCaptureLock({ isCapturingRef, onChange }: Options): CaptureLock {
  const [isCapturing, setIsCapturing] = useState(false);

  const beginCapture = useCallback(() => {
    isCapturingRef.current = true;
    setIsCapturing(true);
    onChange?.(true);
  }, [isCapturingRef, onChange]);

  const endCapture = useCallback(() => {
    isCapturingRef.current = false;
    setIsCapturing(false);
    onChange?.(false);
  }, [isCapturingRef, onChange]);

  return {
    isCapturing,
    beginCapture,
    endCapture,
  };
}

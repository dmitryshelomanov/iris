import { useCallback, useState, type RefObject } from 'react';

type CaptureLock = {
  isCapturing: boolean;
  beginCapture: () => void;
  endCapture: () => void;
};

export function useCaptureLock(isCapturingRef: RefObject<boolean>): CaptureLock {
  const [isCapturing, setIsCapturing] = useState(false);

  const beginCapture = useCallback(() => {
    isCapturingRef.current = true;
    setIsCapturing(true);
  }, [isCapturingRef]);

  const endCapture = useCallback(() => {
    isCapturingRef.current = false;
    setIsCapturing(false);
  }, [isCapturingRef]);

  return {
    isCapturing,
    beginCapture,
    endCapture,
  };
}

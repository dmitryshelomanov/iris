import { NativeModule, requireNativeModule } from 'expo';

import type { BakeLookVideoNativeOptions, BakeLookVideoNativeResult } from './IrisLookBake.types';

declare class IrisLookBakeModule extends NativeModule<{}> {
  bakeLookIntoVideo(
    inputPath: string,
    options: BakeLookVideoNativeOptions,
  ): Promise<BakeLookVideoNativeResult>;
  /** iOS AudioServices peek/pop/nope — works during an active camera session. */
  playSystemHaptic(kind: 'peek' | 'pop' | 'nope'): void;
}

export default requireNativeModule<IrisLookBakeModule>('IrisLookBake');

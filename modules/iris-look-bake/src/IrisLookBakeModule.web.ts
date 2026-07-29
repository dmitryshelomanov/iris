import { NativeModule, registerWebModule } from 'expo';

import type { BakeLookVideoNativeOptions, BakeLookVideoNativeResult } from './IrisLookBake.types';

class IrisLookBakeModule extends NativeModule<{
  bakeLookIntoVideo(
    inputPath: string,
    options: BakeLookVideoNativeOptions,
  ): Promise<BakeLookVideoNativeResult>;
  cancelBakeLookIntoVideo(): void;
  playSystemHaptic(kind: 'peek' | 'pop' | 'nope'): void;
}> {
  async bakeLookIntoVideo(
    inputPath: string,
    _options: BakeLookVideoNativeOptions,
  ): Promise<BakeLookVideoNativeResult> {
    const path = inputPath.replace(/^file:\/\//, '');
    return {
      path,
      uri: path.startsWith('file://') ? path : `file://${path}`,
      baked: false,
    };
  }

  cancelBakeLookIntoVideo() {}

  playSystemHaptic(_kind: 'peek' | 'pop' | 'nope') {}
}

export default registerWebModule(IrisLookBakeModule, 'IrisLookBake');

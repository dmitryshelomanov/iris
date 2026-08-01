import { NativeModule, registerWebModule } from 'expo';

import type {
  BakeLookVideoNativeOptions,
  BakeLookVideoNativeResult,
  StylizePhotoNativeOptions,
  StylizePhotoNativeResult,
} from './IrisLookBake.types';

class IrisLookBakeModule extends NativeModule<{
  bakeLookIntoVideo(
    inputPath: string,
    options: BakeLookVideoNativeOptions,
  ): Promise<BakeLookVideoNativeResult>;
  cancelBakeLookIntoVideo(): void;
  playSystemHaptic(kind: 'peek' | 'pop' | 'nope'): void;
  stylizePhoto(
    inputPath: string,
    options: StylizePhotoNativeOptions,
  ): Promise<StylizePhotoNativeResult>;
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

  async stylizePhoto(
    inputPath: string,
    _options: StylizePhotoNativeOptions,
  ): Promise<StylizePhotoNativeResult> {
    const path = inputPath.replace(/^file:\/\//, '');
    return {
      path,
      uri: path.startsWith('file://') ? path : `file://${path}`,
    };
  }
}

export default registerWebModule(IrisLookBakeModule, 'IrisLookBake');

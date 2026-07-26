import { CommonResolutions } from 'react-native-vision-camera';

import type { AspectRatio } from './types';

export function resolutionForAspect(aspect: AspectRatio) {
  return aspect === '16:9' ? CommonResolutions.UHD_16_9 : CommonResolutions.UHD_4_3;
}

export function videoResolutionForAspect(aspect: AspectRatio) {
  return aspect === '16:9' ? CommonResolutions.FHD_16_9 : CommonResolutions.FHD_4_3;
}

import { Image, Pressable, View } from 'react-native';
import { Film } from 'lucide-react-native';

import { Icon } from '@/shared/ui/icon';
import type { RecentCapture } from '@/entities/capture';

type Props = {
  shot: RecentCapture | null;
  onPress: () => void;
};

/** Last-shot thumbnail sitting opposite the manual dials toggle. */
export function LastShotButton({ shot, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!shot}
      className="h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-black/45"
      accessibilityLabel="Open last shot"
    >
      {shot ? (
        shot.kind === 'photo' ? (
          <Image source={{ uri: shot.uri }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <View className="h-full w-full items-center justify-center bg-zinc-800">
            <Icon as={Film} size={16} className="text-white" />
          </View>
        )
      ) : (
        <View className="h-7 w-7 rounded-md border border-dashed border-white/25" />
      )}
    </Pressable>
  );
}

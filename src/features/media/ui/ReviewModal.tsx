import { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Modal, Pressable, Share, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Heart, X } from 'lucide-react-native';

import { Icon } from '@/shared/ui/icon';
import { Text } from '@/shared/ui/text';
import type { RecentCapture } from '@/entities/capture';
import { cn } from '@/shared/lib/utils';

type Props = {
  visible: boolean;
  recents: RecentCapture[];
  initialId?: string | null;
  onClose: () => void;
  onDelete?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  /** When true, open in quick post-capture mode with a primary “Shoot again” action. */
  postCapture?: boolean;
};

function BeforeAfterPhoto({ bakedUri, rawUri }: { bakedUri: string; rawUri: string }) {
  const { width } = useWindowDimensions();
  const split = useSharedValue(0.5);

  const gesture = Gesture.Pan().onUpdate((e) => {
    split.value = Math.max(0.08, Math.min(0.92, e.x / Math.max(1, width)));
  });

  const leftStyle = useAnimatedStyle(() => ({
    width: `${split.value * 100}%`,
  }));

  const handleStyle = useAnimatedStyle(() => ({
    left: `${split.value * 100}%`,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View className="flex-1 overflow-hidden">
        <Image source={{ uri: bakedUri }} style={{ flex: 1 }} resizeMode="contain" />
        <Animated.View
          style={[
            { position: 'absolute', top: 0, bottom: 0, left: 0, overflow: 'hidden' },
            leftStyle,
          ]}
        >
          <Image source={{ uri: rawUri }} style={{ width, height: '100%' }} resizeMode="contain" />
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: 2,
              marginLeft: -1,
              backgroundColor: '#FBBF24',
            },
            handleStyle,
          ]}
        />
        <View className="absolute left-3 top-3 rounded-full bg-black/50 px-2 py-1">
          <Text className="text-[10px] font-semibold text-white">Raw</Text>
        </View>
        <View className="absolute right-3 top-3 rounded-full bg-black/50 px-2 py-1">
          <Text className="text-[10px] font-semibold text-white">Look</Text>
        </View>
      </View>
    </GestureDetector>
  );
}

function VideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {
        // disposed
      }
    };
  }, [player]);

  return <VideoView player={player} style={{ flex: 1 }} contentFit="contain" nativeControls />;
}

export function ReviewModal({
  visible,
  recents,
  initialId,
  onClose,
  onDelete,
  onToggleFavorite,
  postCapture = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const initialIndex = useMemo(() => {
    if (!initialId) return 0;
    const idx = recents.findIndex((r) => r.id === initialId);
    return idx >= 0 ? idx : 0;
  }, [initialId, recents]);
  const [index, setIndex] = useState(initialIndex);
  const [compare, setCompare] = useState(false);

  useEffect(() => {
    if (visible) {
      setIndex(initialIndex);
      setCompare(false);
    }
  }, [visible, initialIndex]);

  const current = recents[index] ?? recents[0] ?? null;
  const canCompare =
    current?.kind === 'photo' && !!current.rawUri && current.rawUri !== current.uri;

  const share = async () => {
    if (!current) return;
    try {
      await Share.share({ url: current.uri, message: 'Captured with Iris' });
    } catch {
      // user cancelled
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View
        className="flex-1 bg-black"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <View className="flex-row items-center justify-between px-4 py-2">
          <Pressable
            onPress={onClose}
            className="h-9 w-9 items-center justify-center rounded-full bg-white/10"
          >
            <Icon as={X} size={18} className="text-white" />
          </Pressable>
          <Text className="text-sm font-semibold text-white">
            {postCapture
              ? 'Just captured'
              : current
                ? current.kind === 'video'
                  ? 'Video'
                  : 'Photo'
                : 'Gallery'}
            {!postCapture && recents.length > 0 ? ` · ${index + 1}/${recents.length}` : ''}
          </Text>
          {onToggleFavorite && current ? (
            <Pressable
              onPress={() => onToggleFavorite(current.id)}
              className="h-9 w-9 items-center justify-center rounded-full bg-white/10"
            >
              <Icon
                as={Heart}
                size={18}
                className={current.favorite ? 'text-amber-400' : 'text-white'}
                fill={current.favorite ? '#FBBF24' : 'transparent'}
              />
            </Pressable>
          ) : (
            <View className="w-9" />
          )}
        </View>

        {current?.kind === 'photo' ? (
          compare && canCompare && current.rawUri ? (
            <BeforeAfterPhoto bakedUri={current.uri} rawUri={current.rawUri} />
          ) : (
            <Image source={{ uri: current.uri }} className="flex-1" resizeMode="contain" />
          )
        ) : current ? (
          <VideoPlayer uri={current.uri} />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-white/50">No captures yet</Text>
          </View>
        )}

        {!postCapture && recents.length > 0 ? (
          <FlatList
            horizontal
            data={recents}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingVertical: 10 }}
            renderItem={({ item, index: itemIndex }) => (
              <Pressable onPress={() => setIndex(itemIndex)}>
                {item.kind === 'photo' ? (
                  <Image
                    source={{ uri: item.uri }}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 8,
                      borderWidth: itemIndex === index ? 2 : 0,
                      borderColor: '#FBBF24',
                    }}
                  />
                ) : (
                  <View
                    className={cn(
                      'h-14 w-14 items-center justify-center rounded-lg bg-zinc-800',
                      itemIndex === index && 'border-2 border-amber-400',
                    )}
                  >
                    <Text className="text-[10px] font-semibold text-white">VID</Text>
                  </View>
                )}
              </Pressable>
            )}
          />
        ) : null}

        <View className="flex-row flex-wrap gap-2 px-4 pb-3">
          {canCompare ? (
            <Pressable
              onPress={() => setCompare((v) => !v)}
              className={cn(
                'items-center rounded-xl px-4 py-3',
                compare ? 'bg-amber-400' : 'bg-white/15',
              )}
            >
              <Text className={cn('font-semibold', compare ? 'text-black' : 'text-white')}>
                Before / After
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={share}
            disabled={!current}
            className="min-w-[30%] flex-1 items-center rounded-xl bg-white py-3"
          >
            <Text className="font-semibold text-black">Share</Text>
          </Pressable>
          <Pressable
            onPress={onClose}
            className="min-w-[30%] flex-1 items-center rounded-xl bg-white/15 py-3"
          >
            <Text className="font-semibold text-white">{postCapture ? 'Shoot again' : 'Done'}</Text>
          </Pressable>
          {onDelete && current && !postCapture ? (
            <Pressable
              onPress={() => onDelete(current.id)}
              className="items-center rounded-xl bg-red-500/20 px-4 py-3"
            >
              <Text className="font-semibold text-red-300">Remove</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

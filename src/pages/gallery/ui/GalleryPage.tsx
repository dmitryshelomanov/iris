import { useCallback, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Heart } from 'lucide-react-native';

import { ReviewModal, useRecents } from '@/features/media';
import { Icon } from '@/shared/ui/icon';
import { Text } from '@/shared/ui/text';
import { cn } from '@/shared/lib/utils';

type Filter = 'all' | 'photo' | 'video' | 'favorites';

export function GalleryPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cell = (width - 8) / 3;
  const { recents, dismiss, refresh } = useRecents();
  const [filter, setFilter] = useState<Filter>('all');
  const [reviewId, setReviewId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    switch (filter) {
      case 'photo':
        return recents.filter((r) => r.kind === 'photo');
      case 'video':
        return recents.filter((r) => r.kind === 'video');
      case 'favorites':
        return recents.filter((r) => r.favorite);
      default:
        return recents;
    }
  }, [filter, recents]);

  const toggleFavorite = useCallback(
    async (id: string) => {
      const { toggleFavoriteRecent } = await import('@/entities/capture');
      await toggleFavoriteRecent(id);
      await refresh();
    },
    [refresh],
  );

  return (
    <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between px-3 py-2">
        <Pressable
          onPress={() => router.back()}
          className="h-9 w-9 items-center justify-center rounded-full bg-white/10"
        >
          <Icon as={ArrowLeft} size={18} className="text-white" />
        </Pressable>
        <Text className="text-base font-semibold text-white">Iris gallery</Text>
        <View className="w-9" />
      </View>

      <View className="mb-2 flex-row gap-1.5 px-3">
        {(
          [
            ['all', 'All'],
            ['photo', 'Photos'],
            ['video', 'Videos'],
            ['favorites', 'Favorites'],
          ] as const
        ).map(([id, label]) => (
          <Pressable
            key={id}
            onPress={() => setFilter(id)}
            className={cn(
              'rounded-full px-3 py-1.5',
              filter === id ? 'bg-amber-400' : 'bg-white/10',
            )}
          >
            <Text
              className={cn(
                'text-[11px] font-semibold',
                filter === id ? 'text-black' : 'text-white/80',
              )}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={3}
        contentContainerStyle={{ paddingHorizontal: 4, paddingBottom: insets.bottom + 16 }}
        ListEmptyComponent={
          <View className="items-center px-8 pt-20">
            <Text className="text-center text-white/50">
              Captures saved to the Iris album appear here.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setReviewId(item.id)}
            style={{ width: cell, height: cell, padding: 2 }}
          >
            {item.kind === 'photo' ? (
              <Image source={{ uri: item.uri }} style={{ flex: 1, borderRadius: 4 }} />
            ) : (
              <View className="flex-1 items-center justify-center rounded-sm bg-zinc-800">
                <Text className="text-xs font-semibold text-white">VIDEO</Text>
              </View>
            )}
            {item.favorite ? (
              <View className="absolute right-1.5 top-1.5">
                <Icon as={Heart} size={12} className="text-amber-400" fill="#FBBF24" />
              </View>
            ) : null}
          </Pressable>
        )}
      />

      <ReviewModal
        visible={reviewId != null}
        recents={filtered}
        initialId={reviewId}
        onClose={() => setReviewId(null)}
        onDelete={async (id) => {
          await dismiss(id);
          setReviewId(null);
        }}
        onToggleFavorite={(id) => void toggleFavorite(id)}
      />
    </View>
  );
}

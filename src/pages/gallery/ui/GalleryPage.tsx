import { useCallback, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Heart } from 'lucide-react-native';

import { getLookPreset, isLookPresetId } from '@/features/camera';
import { ReviewModal, useRecents } from '@/features/media';
import { Icon } from '@/shared/ui/icon';
import { Text } from '@/shared/ui/text';
import { cn } from '@/shared/lib/utils';

type KindFilter = 'all' | 'photo' | 'video' | 'favorites';

export function GalleryPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cell = (width - 8) / 3;
  const { recents, dismiss, refresh } = useRecents();
  const [filter, setFilter] = useState<KindFilter>('all');
  const [lookFilter, setLookFilter] = useState<string | 'any'>('any');
  const [reviewId, setReviewId] = useState<string | null>(null);

  const lookIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of recents) {
      if (r.lookId) ids.add(r.lookId);
    }
    return Array.from(ids);
  }, [recents]);

  const filtered = useMemo(() => {
    let list = recents;
    switch (filter) {
      case 'photo':
        list = list.filter((r) => r.kind === 'photo');
        break;
      case 'video':
        list = list.filter((r) => r.kind === 'video');
        break;
      case 'favorites':
        list = list.filter((r) => r.favorite);
        break;
      default:
        break;
    }
    if (lookFilter !== 'any') {
      list = list.filter((r) => r.lookId === lookFilter);
    }
    return list;
  }, [filter, lookFilter, recents]);

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

      <View className="mb-1.5 flex-row gap-1.5 px-3">
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

      {lookIds.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-2 shrink-0 grow-0"
          style={{ flexGrow: 0, flexShrink: 0 }}
          contentContainerStyle={{
            gap: 6,
            paddingHorizontal: 12,
            alignItems: 'center',
          }}
        >
          <Pressable
            onPress={() => setLookFilter('any')}
            className={cn(
              'rounded-full px-3 py-1.5',
              lookFilter === 'any' ? 'bg-amber-400/90' : 'bg-white/10',
            )}
          >
            <Text
              className={cn(
                'text-[11px] font-semibold',
                lookFilter === 'any' ? 'text-black' : 'text-white/80',
              )}
            >
              Any look
            </Text>
          </Pressable>
          {lookIds.map((id) => {
            const label = isLookPresetId(id) ? getLookPreset(id).label : id;
            const active = lookFilter === id;
            return (
              <Pressable
                key={id}
                onPress={() => setLookFilter(id)}
                className={cn(
                  'rounded-full px-3 py-1.5',
                  active ? 'bg-amber-400/90' : 'bg-white/10',
                )}
              >
                <Text
                  className={cn(
                    'text-[11px] font-semibold',
                    active ? 'text-black' : 'text-white/80',
                  )}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <FlatList
        className="flex-1"
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
        renderItem={({ item }) => {
          const lookLabel =
            item.lookId && item.lookId !== 'none' && isLookPresetId(item.lookId)
              ? getLookPreset(item.lookId).label
              : null;
          return (
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
              {lookLabel ? (
                <View className="absolute bottom-1.5 left-1.5 rounded bg-black/55 px-1 py-0.5">
                  <Text className="text-[9px] font-semibold text-white">{lookLabel}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        }}
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

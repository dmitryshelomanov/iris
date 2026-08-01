import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Check, Heart } from 'lucide-react-native';

import { toggleFavoriteRecent } from '@/entities/capture';
import {
  getLookPreset,
  resolveLookPresetId,
  useCaptureSettings,
  type LookPresetId,
} from '@/features/camera';
import {
  LookBakeSheet,
  ReviewModal,
  bakeImportedPhoto,
  pickLibraryPhoto,
  useRecents,
} from '@/features/media';
import { Icon } from '@/shared/ui/icon';
import { Text } from '@/shared/ui/text';
import { errorMessage } from '@/shared/lib/errorMessage';
import { cn } from '@/shared/lib/utils';

type KindFilter = 'all' | 'photo' | 'video' | 'favorites';

export function GalleryPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cell = (width - 8) / 3;
  const { settings } = useCaptureSettings();
  const { recents, addCapture, dismiss, dismissMany, refresh } = useRecents();
  const [filter, setFilter] = useState<KindFilter>('all');
  const [lookFilter, setLookFilter] = useState<string | 'any'>('any');
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [importUri, setImportUri] = useState<string | null>(null);
  const [draftLookId, setDraftLookId] = useState<LookPresetId>('none');
  const [draftStrength, setDraftStrength] = useState(1);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const lookIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of recents) {
      const id = resolveLookPresetId(r.lookId);
      if (id) ids.add(id);
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
      list = list.filter((r) => resolveLookPresetId(r.lookId) === lookFilter);
    }
    return list;
  }, [filter, lookFilter, recents]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((item) => selected.has(item.id));

  const exitSelecting = useCallback(() => {
    setSelecting(false);
    setSelected(new Set());
  }, []);

  const enterSelecting = useCallback((id?: string) => {
    setSelecting(true);
    setSelected(id ? new Set([id]) : new Set());
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (allFilteredSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(filtered.map((item) => item.id)));
  }, [allFilteredSelected, filtered]);

  const confirmDelete = useCallback(() => {
    const ids = [...selected];
    if (ids.length === 0) return;
    const count = ids.length;
    Alert.alert(
      'Delete captures?',
      count === 1
        ? 'Remove this capture from Iris gallery?'
        : `Remove ${count} captures from Iris gallery?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await dismissMany(ids);
            exitSelecting();
          },
        },
      ],
    );
  }, [dismissMany, exitSelecting, selected]);

  const toggleFavorite = useCallback(
    async (id: string) => {
      await toggleFavoriteRecent(id);
      await refresh();
    },
    [refresh],
  );

  const closeImportSheet = useCallback(() => {
    if (importBusy) return;
    setImportUri(null);
    setImportError(null);
  }, [importBusy]);

  const startImport = useCallback(async () => {
    try {
      setImportError(null);
      const uri = await pickLibraryPhoto();
      if (!uri) return;
      const lookId = resolveLookPresetId(settings.lookId) ?? 'none';
      setDraftLookId(lookId);
      setDraftStrength(settings.lookStrength);
      setImportUri(uri);
    } catch (error) {
      Alert.alert('Import failed', errorMessage(error, 'Could not open Photos'));
    }
  }, [settings.lookId, settings.lookStrength]);

  const applyImportBake = useCallback(async () => {
    if (!importUri) return;
    setImportBusy(true);
    setImportError(null);
    try {
      const entry = await bakeImportedPhoto(importUri, {
        lookId: draftLookId,
        lookStrength: draftStrength,
        jpegQuality: settings.jpegQuality,
      });
      await addCapture(entry);
      setImportUri(null);
      setFilter('all');
      setLookFilter('any');
      setReviewId(entry.id);
    } catch (error) {
      setImportError(errorMessage(error, 'Bake failed'));
    } finally {
      setImportBusy(false);
    }
  }, [addCapture, draftLookId, draftStrength, importUri, settings.jpegQuality]);

  return (
    <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between px-3 py-2">
        {selecting ? (
          <Pressable onPress={exitSelecting} className="min-w-9 px-1 py-2">
            <Text className="text-sm font-semibold text-amber-400">Cancel</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => router.back()}
            className="h-9 w-9 items-center justify-center rounded-full bg-white/10"
          >
            <Icon as={ArrowLeft} size={18} className="text-white" />
          </Pressable>
        )}
        <Text className="text-base font-semibold text-white">
          {selecting
            ? selected.size === 0
              ? 'Select items'
              : `${selected.size} selected`
            : 'Iris gallery'}
        </Text>
        {selecting ? (
          <Pressable
            onPress={toggleSelectAll}
            disabled={filtered.length === 0}
            className="min-w-9 px-1 py-2"
          >
            <Text
              className={cn(
                'text-sm font-semibold',
                filtered.length === 0 ? 'text-white/30' : 'text-amber-400',
              )}
            >
              {allFilteredSelected ? 'Deselect All' : 'Select All'}
            </Text>
          </Pressable>
        ) : (
          <View className="min-w-9 flex-row items-center justify-end gap-3 px-1">
            <Pressable onPress={startImport} disabled={importBusy} className="py-2">
              <Text
                className={cn(
                  'text-sm font-semibold',
                  importBusy ? 'text-white/30' : 'text-amber-400',
                )}
              >
                Import
              </Text>
            </Pressable>
            <Pressable
              onPress={() => enterSelecting()}
              disabled={recents.length === 0}
              className="py-2"
            >
              <Text
                className={cn(
                  'text-sm font-semibold',
                  recents.length === 0 ? 'text-white/30' : 'text-amber-400',
                )}
              >
                Select
              </Text>
            </Pressable>
          </View>
        )}
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
            const label = resolveLookPresetId(id) ? getLookPreset(id).label : id;
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
        contentContainerStyle={{
          paddingHorizontal: 4,
          paddingBottom: insets.bottom + (selecting ? 72 : 16),
        }}
        ListEmptyComponent={
          <View className="items-center px-8 pt-20">
            <Text className="mb-4 text-center text-white/50">
              Captures saved to the Iris album appear here. Import a photo from Photos to bake a
              look.
            </Text>
            <Pressable
              onPress={startImport}
              disabled={importBusy}
              className="rounded-xl bg-amber-400 px-5 py-3"
            >
              <Text className="font-semibold text-black">Import photo</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => {
          const lookLabel =
            item.lookId && item.lookId !== 'none' && resolveLookPresetId(item.lookId)
              ? getLookPreset(item.lookId).label
              : null;
          const isSelected = selected.has(item.id);
          return (
            <Pressable
              onPress={() => {
                if (selecting) toggleSelected(item.id);
                else setReviewId(item.id);
              }}
              onLongPress={() => {
                if (!selecting) enterSelecting(item.id);
                else toggleSelected(item.id);
              }}
              style={{ width: cell, height: cell, padding: 2 }}
            >
              {item.kind === 'photo' ? (
                <Image source={{ uri: item.uri }} style={{ flex: 1, borderRadius: 4 }} />
              ) : (
                <View className="flex-1 items-center justify-center rounded-sm bg-zinc-800">
                  <Text className="text-xs font-semibold text-white">VIDEO</Text>
                </View>
              )}
              {selecting ? (
                <>
                  {isSelected ? (
                    <View className="absolute inset-0.5 rounded-sm bg-black/35" />
                  ) : null}
                  <View
                    className={cn(
                      'absolute right-1.5 top-1.5 h-5 w-5 items-center justify-center rounded-full border-2',
                      isSelected ? 'border-amber-400 bg-amber-400' : 'border-white/80 bg-black/40',
                    )}
                  >
                    {isSelected ? <Icon as={Check} size={12} className="text-black" /> : null}
                  </View>
                </>
              ) : (
                <>
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
                </>
              )}
            </Pressable>
          );
        }}
      />

      {selecting ? (
        <View
          className="absolute bottom-0 left-0 right-0 border-t border-white/10 bg-black/95 px-4 pt-3"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <Pressable
            onPress={confirmDelete}
            disabled={selected.size === 0}
            className={cn(
              'items-center rounded-xl py-3',
              selected.size === 0 ? 'bg-red-500/10' : 'bg-red-500/20',
            )}
          >
            <Text
              className={cn(
                'font-semibold',
                selected.size === 0 ? 'text-red-300/40' : 'text-red-300',
              )}
            >
              {selected.size === 0
                ? 'Delete'
                : selected.size === 1
                  ? 'Delete 1 item'
                  : `Delete ${selected.size} items`}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <ReviewModal
        visible={reviewId != null}
        recents={recents}
        initialId={reviewId}
        onClose={() => setReviewId(null)}
        onDelete={async (id) => {
          await dismiss(id);
          setReviewId(null);
        }}
        onToggleFavorite={toggleFavorite}
      />

      <Modal visible={importUri != null} animationType="slide" onRequestClose={closeImportSheet}>
        <View
          className="flex-1 bg-black"
          style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
        >
          <View className="flex-row items-center justify-between px-4 py-2">
            <Pressable
              onPress={closeImportSheet}
              disabled={importBusy}
              className="h-9 w-9 items-center justify-center rounded-full bg-white/10"
            >
              <Icon as={ArrowLeft} size={18} className="text-white" />
            </Pressable>
            <Text className="text-sm font-semibold text-white">Import photo</Text>
            <View className="w-9" />
          </View>
          {importUri ? (
            <Image source={{ uri: importUri }} className="flex-1" resizeMode="contain" />
          ) : null}
          <LookBakeSheet
            title="Bake look"
            lookId={draftLookId}
            strength={draftStrength}
            busy={importBusy}
            error={importError}
            mediaKind="photo"
            applyLabel="Bake look"
            onLookChange={setDraftLookId}
            onStrengthChange={setDraftStrength}
            onApply={applyImportBake}
            onClose={closeImportSheet}
          />
        </View>
      </Modal>
    </View>
  );
}

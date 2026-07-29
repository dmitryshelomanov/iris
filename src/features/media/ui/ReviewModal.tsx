import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Heart, X } from 'lucide-react-native';

import { fileUriExists, type RecentCapture } from '@/entities/capture';
import {
  LOOK_PRESETS,
  LookStrengthSlider,
  getLookPreset,
  isLookPresetId,
  type LookPresetId,
} from '@/features/camera';
import { Icon } from '@/shared/ui/icon';
import { Text } from '@/shared/ui/text';
import { cn } from '@/shared/lib/utils';

import { rebakeLook } from '../model/rebakeLook';
import { useRecents } from '../model/RecentsContext';

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

function formatShutter(seconds: number): string {
  if (seconds <= 0) return '—';
  if (seconds >= 1) return `${Number(seconds.toFixed(1))}s`;
  const denom = Math.max(1, Math.round(1 / seconds));
  return `1/${denom}`;
}

function formatEv(ev: number): string {
  if (Math.abs(ev) < 0.05) return '±0 EV';
  const sign = ev > 0 ? '+' : '';
  return `${sign}${ev.toFixed(1)} EV`;
}

function MetadataStrip({ capture }: { capture: RecentCapture }) {
  const parts: string[] = [];
  const meta = capture.meta;
  if (meta?.lensLabel) parts.push(meta.lensLabel);
  else if (meta?.focalLengthMm) parts.push(`${Math.round(meta.focalLengthMm)}mm`);
  if (meta?.iso != null && meta.iso > 0) parts.push(`ISO ${Math.round(meta.iso)}`);
  if (meta?.shutter != null && meta.shutter > 0) parts.push(formatShutter(meta.shutter));
  if (meta?.ev != null) parts.push(formatEv(meta.ev));

  if (capture.lookId && isLookPresetId(capture.lookId)) {
    const look = getLookPreset(capture.lookId);
    const strength =
      capture.lookStrength != null && capture.lookId !== 'none'
        ? ` · ${Math.round(capture.lookStrength * 100)}%`
        : '';
    parts.push(`${look.label}${strength}`);
  }

  if (parts.length === 0) return null;

  return (
    <View className="px-4 pb-1">
      <Text className="text-center text-[11px] font-medium text-white/55" numberOfLines={2}>
        {parts.join(' · ')}
      </Text>
    </View>
  );
}

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
          <Text className="text-[10px] font-semibold text-white">Native</Text>
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

function LookRebakeSheet({
  lookId,
  strength,
  busy,
  error,
  onLookChange,
  onStrengthChange,
  onApply,
  onClose,
}: {
  lookId: LookPresetId;
  strength: number;
  busy: boolean;
  error: string | null;
  onLookChange: (id: LookPresetId) => void;
  onStrengthChange: (v: number) => void;
  onApply: () => void;
  onClose: () => void;
}) {
  return (
    <View className="border-t border-white/10 bg-zinc-950 px-3 pb-3 pt-2">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-white">Re-bake look</Text>
        <Pressable onPress={onClose} className="rounded-full bg-white/10 px-3 py-1">
          <Text className="text-[11px] font-semibold text-white/80">Close</Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingBottom: 8 }}
      >
        {LOOK_PRESETS.map((look) => {
          const active = look.id === lookId;
          return (
            <Pressable
              key={look.id}
              disabled={busy}
              onPress={() => onLookChange(look.id)}
              className={cn(
                'rounded-full border px-2.5 py-1',
                active ? 'border-amber-400 bg-amber-400/20' : 'border-white/15 bg-black/40',
              )}
            >
              <Text
                className={cn(
                  'text-[11px] font-semibold',
                  active ? 'text-amber-300' : 'text-white',
                )}
              >
                {look.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <LookStrengthSlider value={strength} onChange={onStrengthChange} />
      {error ? <Text className="mt-2 text-center text-[11px] text-red-300">{error}</Text> : null}
      <Pressable
        onPress={onApply}
        disabled={busy}
        className="mt-2 items-center rounded-xl bg-amber-400 py-3"
      >
        {busy ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text className="font-semibold text-black">Apply look</Text>
        )}
      </Pressable>
    </View>
  );
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
  const { refresh } = useRecents();
  const initialIndex = useMemo(() => {
    if (!initialId) return 0;
    const idx = recents.findIndex((r) => r.id === initialId);
    return idx >= 0 ? idx : 0;
  }, [initialId, recents]);
  const [index, setIndex] = useState(initialIndex);
  const [compare, setCompare] = useState(false);
  const [lookSheet, setLookSheet] = useState(false);
  const [draftLookId, setDraftLookId] = useState<LookPresetId>('none');
  const [draftStrength, setDraftStrength] = useState(1);
  const [rebaking, setRebaking] = useState(false);
  const [rebakeError, setRebakeError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setIndex(initialIndex);
      setCompare(false);
      setLookSheet(false);
      setRebakeError(null);
    }
  }, [visible, initialIndex]);

  const current = recents[index] ?? recents[0] ?? null;
  const masterExists = fileUriExists(current?.rawUri);
  const canCompare =
    !!current?.rawUri &&
    masterExists &&
    (current.rawUri !== current.uri || (current.lookId != null && current.lookId !== 'none'));
  const canRebake = !!current?.rawUri && masterExists;

  useEffect(() => {
    if (!current) return;
    const id = isLookPresetId(current.lookId) ? current.lookId : 'none';
    setDraftLookId(id);
    setDraftStrength(current.lookStrength ?? 1);
  }, [current?.id, current?.lookId, current?.lookStrength]);

  const share = async () => {
    if (!current) return;
    try {
      await Share.share({ url: current.uri, message: 'Captured with Iris' });
    } catch {
      // user cancelled
    }
  };

  const openLookSheet = () => {
    if (!canRebake || !current) return;
    const id = isLookPresetId(current.lookId) ? current.lookId : 'none';
    setDraftLookId(id);
    setDraftStrength(current.lookStrength ?? 1);
    setRebakeError(null);
    setLookSheet(true);
  };

  const applyRebake = async () => {
    if (!current || !canRebake) return;
    setRebaking(true);
    setRebakeError(null);
    try {
      await rebakeLook(current.id, {
        lookId: draftLookId,
        lookStrength: draftStrength,
      });
      await refresh();
      setCompare(false);
      setLookSheet(false);
    } catch (error) {
      setRebakeError(error instanceof Error ? error.message : 'Re-bake failed');
    } finally {
      setRebaking(false);
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
          <View className="flex-1">
            <VideoPlayer
              key={compare && canCompare && current.rawUri ? current.rawUri : current.uri}
              uri={compare && canCompare && current.rawUri ? current.rawUri : current.uri}
            />
            {compare && canCompare ? (
              <Text className="absolute left-4 top-4 rounded-full bg-black/55 px-3 py-1 text-[11px] font-semibold text-white">
                Master (before look)
              </Text>
            ) : null}
          </View>
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-white/50">No captures yet</Text>
          </View>
        )}

        {current ? <MetadataStrip capture={current} /> : null}

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

        {lookSheet && canRebake ? (
          <LookRebakeSheet
            lookId={draftLookId}
            strength={draftStrength}
            busy={rebaking}
            error={rebakeError}
            onLookChange={setDraftLookId}
            onStrengthChange={setDraftStrength}
            onApply={applyRebake}
            onClose={() => setLookSheet(false)}
          />
        ) : (
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
            {canRebake ? (
              <Pressable
                onPress={openLookSheet}
                className="items-center rounded-xl bg-white/15 px-4 py-3"
              >
                <Text className="font-semibold text-white">Look</Text>
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
              <Text className="font-semibold text-white">
                {postCapture ? 'Shoot again' : 'Done'}
              </Text>
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
        )}
      </View>
    </Modal>
  );
}

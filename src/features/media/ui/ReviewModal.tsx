import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { FlatList, Image, Modal, Pressable, Share, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Heart, X } from 'lucide-react-native';

import { fileUriExists, type RecentCapture } from '@/entities/capture';
import {
  BakeOverlay,
  LookOverlay,
  cancelBakeLookIntoVideo,
  formatShutter,
  getLookPreset,
  isAnimeMlLook,
  resolveLookPresetId,
  useCaptureSettings,
  type LookPresetId,
} from '@/features/camera';
import { Icon } from '@/shared/ui/icon';
import { Text } from '@/shared/ui/text';
import { errorMessage } from '@/shared/lib/errorMessage';
import { cn } from '@/shared/lib/utils';

import { rebakeLook } from '../model/rebakeLook';
import { useLiveLookPreview } from '../model/useLiveLookPreview';
import { useLookBakeDraft } from '../model/useLookBakeDraft';
import { useRecents } from '../model/RecentsContext';
import { LookBakeSheet } from './LookBakeSheet';

const QUICK_ANIME_LOOKS: LookPresetId[] = ['sk', 'hy'];

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

  const lookId = resolveLookPresetId(capture.lookId);
  if (lookId) {
    const look = getLookPreset(lookId);
    const strength =
      capture.lookStrength != null && lookId !== 'none'
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
        <Image key={bakedUri} source={{ uri: bakedUri }} style={{ flex: 1 }} resizeMode="contain" />
        <Animated.View
          style={[
            { position: 'absolute', top: 0, bottom: 0, left: 0, overflow: 'hidden' },
            leftStyle,
          ]}
        >
          <Image
            key={rawUri}
            source={{ uri: rawUri }}
            style={{ width, height: '100%' }}
            resizeMode="contain"
          />
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
  const { settings } = useCaptureSettings();
  const initialIndex = useMemo(() => {
    if (!initialId) return 0;
    const idx = recents.findIndex((r) => r.id === initialId);
    return idx >= 0 ? idx : 0;
  }, [initialId, recents]);
  const [index, setIndex] = useState(initialIndex);
  const [compare, setCompare] = useState(false);
  const [lookSheet, setLookSheet] = useState(false);
  const draft = useLookBakeDraft();
  const [rebaking, setRebaking] = useState(false);
  const [rebakeError, setRebakeError] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (visible) {
      setIndex(initialIndex);
      setCompare(false);
      setLookSheet(false);
      setRebakeError(null);
    }
  }, [visible, initialIndex]);

  // Abort native video bake if the review sheet unmounts / closes mid-export.
  useEffect(() => {
    if (visible) return;
    cancelBakeLookIntoVideo();
  }, [visible]);

  useEffect(() => {
    return () => {
      cancelBakeLookIntoVideo();
    };
  }, []);

  const current = visible ? (recents[index] ?? recents[0] ?? null) : null;
  const masterExists = fileUriExists(current?.rawUri);
  const canCompare =
    !!current?.rawUri &&
    masterExists &&
    (current.rawUri !== current.uri || (current.lookId != null && current.lookId !== 'none'));
  const canRebake = !!current?.rawUri && masterExists;

  useEffect(() => {
    // Don't clobber in-progress dials while the look sheet is open (e.g. after Apply).
    if (!current || rebaking || lookSheet) return;
    const id = resolveLookPresetId(current.lookId) ?? 'none';
    const strength = current.lookStrength ?? 1;
    draft.syncFromCapture(id, strength, current.overlayPatch);
  }, [current?.id, current?.lookId, current?.lookStrength, current?.overlayPatch, rebaking, lookSheet, draft.syncFromCapture]);

  const liveLookPreview =
    lookSheet && canRebake && current?.kind === 'photo' && !!current.rawUri && masterExists;
  const animeMlDraft = isAnimeMlLook(draft.lookId);

  const { previewUri: livePreviewUri, pending: livePreviewPending, gradeOnly } = useLiveLookPreview({
    enabled: !!liveLookPreview,
    masterUri: liveLookPreview ? current?.rawUri : null,
    overlay: draft.draftOverlay,
    strength: draft.params.strength,
    animeMl: animeMlDraft,
    cacheKey: 'review-live',
  });

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
    let id = resolveLookPresetId(current.lookId) ?? 'none';
    if (current.kind === 'video' && isAnimeMlLook(id)) {
      id = 'none';
    }
    draft.openSheet(id, current.lookStrength ?? 1, current.overlayPatch);
    setRebakeError(null);
    setLookSheet(true);
  };

  const applyRebakeWith = async (
    lookId: LookPresetId,
    lookStrength: number,
    grainPatch?: typeof draft.grainPatch,
  ) => {
    if (!current || !canRebake || rebaking) return;
    const recentId = current.id;
    setRebaking(true);
    setRebakeError(null);
    try {
      await rebakeLook(recentId, {
        lookId,
        lookStrength,
        overlayPatch: grainPatch,
      });
      // Ignore stale completion if the user somehow changed selection mid-bake.
      if (recentId !== (recents[index] ?? recents[0])?.id) return;
      await refresh();
      // Re-bake prepends a new entry — jump to it; keep look sheet open for further tweaks.
      setIndex(0);
      setCompare(false);
    } catch (error) {
      if (recentId !== (recents[index] ?? recents[0])?.id) return;
      setRebakeError(errorMessage(error, 'Re-bake failed'));
    } finally {
      setRebaking(false);
    }
  };

  const applyRebake = () =>
    applyRebakeWith(draft.lookId, draft.params.strength, draft.grainPatch);

  const quickAnimeRebake = (lookId: LookPresetId) => {
    if (current?.kind !== 'photo') return;
    void applyRebakeWith(lookId, settings.lookStrength);
  };

  const showQuickAnime = canRebake && current?.kind === 'photo';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => {
        if (rebaking) return;
        onClose();
      }}
    >
      <View
        className="flex-1 bg-black"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <View className="flex-row items-center justify-between px-4 py-2">
          <Pressable
            onPress={onClose}
            disabled={rebaking}
            className={cn(
              'h-9 w-9 items-center justify-center rounded-full bg-white/10',
              rebaking && 'opacity-40',
            )}
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

        {visible ? (
          <View className="flex-1">
            {current?.kind === 'photo' ? (
              compare && canCompare && current.rawUri && !liveLookPreview ? (
                <BeforeAfterPhoto bakedUri={current.uri} rawUri={current.rawUri} />
              ) : liveLookPreview && current.rawUri ? (
                <View className="flex-1 overflow-hidden">
                  <Image
                    key={livePreviewUri ?? `${current.id}-master`}
                    source={{ uri: livePreviewUri ?? current.rawUri }}
                    className="flex-1"
                    resizeMode="contain"
                  />
                  {!livePreviewUri || gradeOnly ? (
                    <LookOverlay
                      overlay={draft.draftOverlay}
                      strength={draft.params.strength}
                      animeMl={animeMlDraft}
                    />
                  ) : null}
                  {gradeOnly ? (
                    <View className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1">
                      <Text className="text-[10px] font-semibold text-amber-300">Grade only</Text>
                    </View>
                  ) : livePreviewPending ? (
                    <View className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1">
                      <Text className="text-[10px] font-semibold text-amber-300">Preview…</Text>
                    </View>
                  ) : null}
                </View>
              ) : (
                <Image
                  key={current.id}
                  source={{ uri: current.uri }}
                  className="flex-1"
                  resizeMode="contain"
                />
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
            <BakeOverlay
              label={
                rebaking
                  ? isAnimeMlLook(draft.lookId)
                    ? 'Anime stylizing…'
                    : 'Applying look…'
                  : null
              }
            />
          </View>
        ) : (
          <View className="flex-1" />
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
              <Pressable
                disabled={rebaking}
                onPress={() => {
                  if (rebaking) return;
                  setIndex(itemIndex);
                }}
              >
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
          <LookBakeSheet
            title="Re-bake look"
            lookId={draft.lookId}
            params={draft.params}
            activeParam={draft.activeParam}
            busy={rebaking}
            error={rebakeError}
            mediaKind={current.kind === 'video' ? 'video' : 'photo'}
            onLookChange={draft.onLookChange}
            onParamsChange={draft.setParams}
            onActiveParamChange={draft.setActiveParam}
            onApply={applyRebake}
            onClose={() => {
              if (rebaking) return;
              setLookSheet(false);
            }}
          />
        ) : (
          <View className="gap-2 px-4 pb-3">
            {rebakeError ? (
              <Text className="text-center text-[11px] text-red-300">{rebakeError}</Text>
            ) : null}
            <View className="flex-row flex-wrap gap-2">
              {canCompare ? (
                <Pressable
                  onPress={() => setCompare((v) => !v)}
                  disabled={rebaking}
                  className={cn(
                    'items-center rounded-xl px-4 py-3',
                    compare ? 'bg-amber-400' : 'bg-white/15',
                    rebaking && 'opacity-40',
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
                  disabled={rebaking}
                  className={cn(
                    'items-center rounded-xl bg-white/15 px-4 py-3',
                    rebaking && 'opacity-40',
                  )}
                >
                  <Text className="font-semibold text-white">Look</Text>
                </Pressable>
              ) : null}
              {showQuickAnime
                ? QUICK_ANIME_LOOKS.map((lookId) => {
                    const look = getLookPreset(lookId);
                    const active = resolveLookPresetId(current?.lookId) === lookId;
                    return (
                      <Pressable
                        key={lookId}
                        onPress={() => quickAnimeRebake(lookId)}
                        disabled={rebaking}
                        className={cn(
                          'items-center rounded-xl px-4 py-3',
                          active ? 'bg-amber-400/25' : 'bg-white/15',
                          rebaking && 'opacity-40',
                        )}
                      >
                        <Text
                          className={cn(
                            'font-semibold',
                            active ? 'text-amber-300' : 'text-white',
                          )}
                        >
                          {look.label}
                        </Text>
                      </Pressable>
                    );
                  })
                : null}
              <Pressable
                onPress={share}
                disabled={!current || rebaking}
                className={cn(
                  'min-w-[30%] flex-1 items-center rounded-xl bg-white py-3',
                  rebaking && 'opacity-40',
                )}
              >
                <Text className="font-semibold text-black">Share</Text>
              </Pressable>
              <Pressable
                onPress={onClose}
                disabled={rebaking}
                className={cn(
                  'min-w-[30%] flex-1 items-center rounded-xl bg-white/15 py-3',
                  rebaking && 'opacity-40',
                )}
              >
                <Text className="font-semibold text-white">
                  {postCapture ? 'Shoot again' : 'Done'}
                </Text>
              </Pressable>
              {onDelete && current && !postCapture ? (
                <Pressable
                  onPress={() => onDelete(current.id)}
                  disabled={rebaking}
                  className={cn(
                    'items-center rounded-xl bg-red-500/20 px-4 py-3',
                    rebaking && 'opacity-40',
                  )}
                >
                  <Text className="font-semibold text-red-300">Remove</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

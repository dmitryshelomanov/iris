import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useMemo } from 'react';

import {
  LOOK_PRESETS,
  getLookPreset,
  isAnimeMlLook,
  type LookPresetId,
} from '@/features/camera';
import { Text } from '@/shared/ui/text';
import { cn } from '@/shared/lib/utils';

import { LookParamControls, type LookParamId, type LookParamValues } from './LookParamControls';

type Props = {
  title?: string;
  lookId: LookPresetId;
  params: LookParamValues;
  activeParam: LookParamId;
  busy: boolean;
  error: string | null;
  mediaKind: 'photo' | 'video';
  applyLabel?: string;
  onLookChange: (id: LookPresetId) => void;
  onParamsChange: (next: LookParamValues) => void;
  onActiveParamChange: (id: LookParamId) => void;
  onApply: () => void;
  onClose: () => void;
};

export function LookBakeSheet({
  title = 'Bake look',
  lookId,
  params,
  activeParam,
  busy,
  error,
  mediaKind,
  applyLabel = 'Apply look',
  onLookChange,
  onParamsChange,
  onActiveParamChange,
  onApply,
  onClose,
}: Props) {
  const videoBlocksMl = mediaKind === 'video';
  const paramDefaults = useMemo((): LookParamValues => {
    const overlay = getLookPreset(lookId).overlay;
    return {
      strength: 1,
      grain: overlay.grain,
      grainSize: overlay.grainSize,
      grainTexture: overlay.grainTexture,
      grainBlur: overlay.grainBlur,
    };
  }, [lookId]);

  return (
    <View className="border-t border-white/10 bg-zinc-950 px-3 pb-3 pt-2">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-white">{title}</Text>
        <Pressable
          onPress={onClose}
          disabled={busy}
          className={cn('rounded-full bg-white/10 px-3 py-1', busy && 'opacity-40')}
        >
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
          const mlDisabled = videoBlocksMl && isAnimeMlLook(look);
          return (
            <Pressable
              key={look.id}
              disabled={busy || mlDisabled}
              onPress={() => onLookChange(look.id)}
              className={cn(
                'rounded-full border px-2.5 py-1',
                active ? 'border-amber-400 bg-amber-400/20' : 'border-white/15 bg-black/40',
                mlDisabled && 'opacity-40',
              )}
            >
              <Text
                className={cn(
                  'text-[11px] font-semibold',
                  active ? 'text-amber-300' : 'text-white',
                )}
              >
                {look.label}
                {isAnimeMlLook(look) ? ' · Photo' : ''}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {videoBlocksMl ? (
        <Text className="mb-1 text-[10px] font-medium text-white/45">
          Anime ML is photo only — not available for video
        </Text>
      ) : null}
      <LookParamControls
        values={params}
        activeId={activeParam}
        defaults={paramDefaults}
        disabled={busy}
        onActiveChange={onActiveParamChange}
        onChange={onParamsChange}
      />
      {error ? <Text className="mt-2 text-center text-[11px] text-red-300">{error}</Text> : null}
      <Pressable
        onPress={onApply}
        disabled={busy}
        className="mt-2 items-center rounded-xl bg-amber-400 py-3"
      >
        {busy ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text className="font-semibold text-black">{applyLabel}</Text>
        )}
      </Pressable>
    </View>
  );
}

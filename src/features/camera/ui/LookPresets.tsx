import { Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/shared/ui/text';
import {
  LOOK_SCENES,
  getLookPreset,
  looksForScene,
  type LookPreset,
  type LookPresetId,
  type LookSceneId,
} from '../model';
import { cn } from '@/shared/lib/utils';
import { hapticSelect } from '../model/haptics';

type Props = {
  activeId: LookPresetId;
  scene: LookSceneId;
  onSceneChange: (scene: LookSceneId) => void;
  onChange: (id: LookPresetId) => void;
};

function swatchColor(look: LookPreset) {
  if (look.id === 'none') return '#D4D4D4';
  if (look.id === 'as' || look.id === 'tx') return '#2A2A2E';
  return look.overlay.color;
}

function LookChip({
  look,
  active,
  onPress,
}: {
  look: LookPreset;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'flex-row items-center gap-1.5 rounded-full border px-2.5 py-1',
        active ? 'border-amber-400 bg-amber-400/20' : 'border-white/15 bg-black/40',
      )}
    >
      <View
        className={cn(
          'h-2.5 w-2.5 rounded-full border',
          active ? 'border-amber-200/80' : 'border-white/25',
        )}
        style={{ backgroundColor: swatchColor(look) }}
      />
      <Text className={cn('text-[11px] font-semibold', active ? 'text-amber-300' : 'text-white')}>
        {look.label}
      </Text>
    </Pressable>
  );
}

export function LookPresets({ activeId, scene, onSceneChange, onChange }: Props) {
  const sceneLooks = looksForScene(scene);
  const activeLook = getLookPreset(activeId);

  return (
    <View className="gap-1.5">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="flex-row items-center gap-1.5"
      >
        {LOOK_SCENES.map((s) => {
          const active = s.id === scene;
          return (
            <Pressable
              key={s.id}
              onPress={() => {
                void hapticSelect();
                onSceneChange(s.id);
              }}
              className={cn('rounded-md px-2 py-1', active ? 'bg-white/20' : 'bg-black/30')}
            >
              <Text
                className={cn('text-[10px] font-semibold', active ? 'text-white' : 'text-white/50')}
              >
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {activeLook.id !== 'none' ? (
        <Text className="px-0.5 text-[11px] font-medium text-white/70" numberOfLines={1}>
          <Text className="font-semibold text-amber-300/90">{activeLook.label}</Text>
          {' · '}
          {activeLook.hint}
        </Text>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="flex-row items-center gap-1.5"
      >
        {sceneLooks.map((look) => {
          const active = look.id === activeId;
          return (
            <LookChip
              key={look.id}
              look={look}
              active={active}
              onPress={() => {
                void hapticSelect();
                onChange(look.id);
              }}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

type StrengthProps = {
  value: number;
  onChange: (value: number) => void;
};

export function LookStrengthSlider({ value, onChange }: StrengthProps) {
  const steps = [0.35, 0.55, 0.75, 1];
  return (
    <View className="flex-row items-center gap-2">
      <Text className="text-[10px] font-semibold text-white/60">Strength</Text>
      <View className="flex-1 flex-row gap-1">
        {steps.map((step) => {
          const active = Math.abs(value - step) < 0.05;
          return (
            <Pressable
              key={step}
              onPress={() => onChange(step)}
              className={cn(
                'flex-1 items-center rounded-md py-1',
                active ? 'bg-amber-400/30' : 'bg-black/40',
              )}
            >
              <Text
                className={cn(
                  'text-[10px] font-semibold',
                  active ? 'text-amber-300' : 'text-white/70',
                )}
              >
                {Math.round(step * 100)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

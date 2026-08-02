import { Pressable, View } from 'react-native';

import { TickSlider } from '@/features/camera';
import { Text } from '@/shared/ui/text';
import { cn } from '@/shared/lib/utils';

export type LookParamId = 'strength' | 'grain' | 'grainSize' | 'grainTexture' | 'grainBlur';

export type LookParamValues = {
  strength: number;
  grain: number;
  grainSize: number;
  grainTexture: number;
  grainBlur: number;
};

const PARAMS: { id: LookParamId; label: string; short: string }[] = [
  { id: 'strength', label: 'Intensity', short: 'Int' },
  { id: 'grain', label: 'Grain', short: 'Grain' },
  { id: 'grainSize', label: 'Size', short: 'Size' },
  { id: 'grainTexture', label: 'Texture', short: 'Tex' },
  // Soft diffusion of the frame (also softens grain layers in bake).
  { id: 'grainBlur', label: 'Diffusion', short: 'Diff' },
];

type Props = {
  values: LookParamValues;
  activeId: LookParamId;
  /** Preset defaults — re-tap on the active cell resets that field. */
  defaults: LookParamValues;
  disabled?: boolean;
  onActiveChange: (id: LookParamId) => void;
  onChange: (next: LookParamValues) => void;
};

const PARAM_BY_ID = Object.fromEntries(PARAMS.map((p) => [p.id, p])) as Record<
  LookParamId,
  (typeof PARAMS)[number]
>;

function formatParam(id: LookParamId, value: number): string {
  if (id === 'strength') {
    return `+${Math.round(value * 100)}`;
  }
  const n = Math.round(value * 100);
  return n >= 0 ? `+${n}` : `${n}`;
}

export function LookParamControls({
  values,
  activeId,
  defaults,
  disabled = false,
  onActiveChange,
  onChange,
}: Props) {
  return (
    <View className={cn('w-full gap-2', disabled && 'opacity-40')}>
      <View className="flex-row flex-wrap gap-1.5">
        {PARAMS.map((param) => {
          const active = activeId === param.id;
          const value = values[param.id];
          return (
            <Pressable
              key={param.id}
              disabled={disabled}
              onPress={() => {
                if (param.id === activeId) {
                  onChange({ ...values, [param.id]: defaults[param.id] });
                  return;
                }
                onActiveChange(param.id);
              }}
              className={cn(
                'min-w-[52px] items-center rounded-lg px-2 py-1.5',
                active ? 'bg-amber-400' : 'bg-white/10',
              )}
            >
              <Text
                className={cn(
                  'text-sm font-semibold',
                  active ? 'text-black' : 'text-white',
                )}
              >
                {formatParam(param.id, value)}
              </Text>
              <Text
                className={cn(
                  'text-[9px] font-semibold uppercase',
                  active ? 'text-black/70' : 'text-white/50',
                )}
              >
                {param.short}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TickSlider
        value={values[activeId]}
        min={0}
        max={1}
        step={0.01}
        label={PARAM_BY_ID[activeId]?.label}
        formatValue={(v) => formatParam(activeId, v)}
        disabled={disabled}
        onChange={(v) => onChange({ ...values, [activeId]: v })}
      />
    </View>
  );
}

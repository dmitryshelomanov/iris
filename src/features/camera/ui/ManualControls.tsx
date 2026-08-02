import { Pressable, View } from 'react-native';

import { Text } from '@/shared/ui/text';
import type { CameraCapabilities, ManualControlId, ManualControlsState } from '../model';
import { cn } from '@/shared/lib/utils';
import { TickSlider } from './TickSlider';

type AdvancedId = Extract<ManualControlId, 'wb' | 'tint' | 'ev'>;

type Props = {
  value: ManualControlsState;
  capabilities: CameraCapabilities;
  onChange: (next: ManualControlsState) => void;
};

/** Advanced panel: WB / Tint / EV (ISO/SS/Focus live on the main Pro row). */
const CONTROLS: { id: AdvancedId; label: string }[] = [
  { id: 'wb', label: 'WB' },
  { id: 'tint', label: 'Tint' },
  { id: 'ev', label: 'EV' },
];

function formatValue(state: ManualControlsState, id: AdvancedId): string {
  switch (id) {
    case 'wb':
      return `${Math.round(state.wbKelvin)}K`;
    case 'tint':
      return `${state.wbTint >= 0 ? '+' : ''}${Math.round(state.wbTint)}`;
    case 'ev':
      return `${state.ev >= 0 ? '+' : ''}${state.ev.toFixed(1)}`;
  }
}

function isLockedOut(capabilities: CameraCapabilities, id: AdvancedId): boolean {
  switch (id) {
    case 'wb':
    case 'tint':
      return !capabilities.supportsWhiteBalance;
    case 'ev':
      return !capabilities.supportsExposureBias;
  }
}

function sliderRange(
  id: AdvancedId,
  capabilities: CameraCapabilities,
): { min: number; max: number; step: number } {
  switch (id) {
    case 'wb':
      return { min: 2500, max: 8000, step: 50 };
    case 'tint':
      return { min: -150, max: 150, step: 5 };
    case 'ev':
      return {
        min: capabilities.minExposureBias,
        max: capabilities.maxExposureBias,
        step: 0.1,
      };
  }
}

function readNumeric(state: ManualControlsState, id: AdvancedId): number {
  switch (id) {
    case 'wb':
      return state.wbKelvin;
    case 'tint':
      return state.wbTint;
    case 'ev':
      return state.ev;
  }
}

function writeNumeric(state: ManualControlsState, id: AdvancedId, n: number): ManualControlsState {
  const next = { ...state };
  switch (id) {
    case 'wb':
      next.wbKelvin = n;
      break;
    case 'tint':
      next.wbTint = n;
      break;
    case 'ev':
      next.ev = Number(n.toFixed(1));
      break;
  }
  return next;
}

function ensureAdvancedActive(state: ManualControlsState): AdvancedId {
  if (state.activeControl === 'wb' || state.activeControl === 'tint' || state.activeControl === 'ev') {
    return state.activeControl;
  }
  return 'ev';
}

export function ManualControls({ value, capabilities, onChange }: Props) {
  const activeId = ensureAdvancedActive(value);
  const range = sliderRange(activeId, capabilities);
  const canEdit = value.enabled || activeId === 'ev';

  return (
    <View className="w-full gap-2 rounded-xl bg-black/55 px-2.5 py-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-[10px] font-semibold uppercase tracking-widest text-white/70">
          Advanced
        </Text>
        <Pressable
          onPress={() => onChange({ ...value, enabled: !value.enabled })}
          className={cn(
            'rounded-full px-2.5 py-0.5',
            value.enabled ? 'bg-amber-400' : 'bg-white/15',
          )}
        >
          <Text
            className={cn('text-[11px] font-semibold', value.enabled ? 'text-black' : 'text-white')}
          >
            {value.enabled ? 'Manual' : 'Auto'}
          </Text>
        </Pressable>
      </View>

      <View className="flex-row flex-wrap gap-1.5">
        {CONTROLS.map((control) => {
          const lockedOut = isLockedOut(capabilities, control.id);
          const active = activeId === control.id;
          const editable = value.enabled || control.id === 'ev';

          return (
            <Pressable
              key={control.id}
              disabled={!editable || lockedOut}
              onPress={() => onChange({ ...value, activeControl: control.id })}
              className={cn(
                'min-w-[44px] rounded-lg px-2 py-1',
                active && editable ? 'bg-white' : 'bg-white/10',
                (!editable || lockedOut) && 'opacity-40',
              )}
            >
              <Text
                className={cn(
                  'text-[9px] font-semibold uppercase',
                  active && editable ? 'text-black/60' : 'text-white/50',
                )}
              >
                {control.label}
              </Text>
              <Text
                className={cn(
                  'text-xs font-semibold',
                  active && editable ? 'text-black' : 'text-white',
                )}
              >
                {formatValue(value, control.id)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {canEdit && !isLockedOut(capabilities, activeId) ? (
        <TickSlider
          value={readNumeric(value, activeId)}
          min={range.min}
          max={range.max}
          step={range.step}
          showHeader={false}
          formatValue={() => formatValue(value, activeId)}
          onChange={(n) => {
            const next = writeNumeric(value, activeId, n);
            if (activeId !== 'ev' && !next.enabled) {
              onChange({ ...next, enabled: true, activeControl: activeId });
              return;
            }
            onChange({ ...next, activeControl: activeId });
          }}
        />
      ) : null}
    </View>
  );
}

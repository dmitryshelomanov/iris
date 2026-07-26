import { Pressable, View } from 'react-native';

import { Text } from '@/shared/ui/text';
import type { CameraCapabilities, ManualControlId, ManualControlsState } from '../model';
import { cn } from '@/shared/lib/utils';

type Props = {
  value: ManualControlsState;
  capabilities: CameraCapabilities;
  onChange: (next: ManualControlsState) => void;
};

const CONTROLS: { id: ManualControlId; label: string }[] = [
  { id: 'iso', label: 'ISO' },
  { id: 'shutter', label: 'SS' },
  { id: 'wb', label: 'WB' },
  { id: 'tint', label: 'Tint' },
  { id: 'focus', label: 'AF' },
  { id: 'ev', label: 'EV' },
];

function formatValue(state: ManualControlsState, id: ManualControlId): string {
  switch (id) {
    case 'iso':
      return String(Math.round(state.iso));
    case 'shutter': {
      const recip = Math.round(1 / Math.max(state.shutter, 1 / 8000));
      return `1/${recip}`;
    }
    case 'wb':
      return `${Math.round(state.wbKelvin)}K`;
    case 'tint':
      return `${state.wbTint >= 0 ? '+' : ''}${Math.round(state.wbTint)}`;
    case 'focus':
      return state.focus.toFixed(2);
    case 'ev':
      return `${state.ev >= 0 ? '+' : ''}${state.ev.toFixed(1)}`;
  }
}

function isLockedOut(capabilities: CameraCapabilities, id: ManualControlId): boolean {
  switch (id) {
    case 'iso':
      return !capabilities.supportsManualISO;
    case 'shutter':
      return !capabilities.supportsManualShutter;
    case 'focus':
      return !capabilities.supportsManualFocus;
    case 'wb':
    case 'tint':
      return !capabilities.supportsWhiteBalance;
    case 'ev':
      return !capabilities.supportsExposureBias;
  }
}

function stepControl(
  state: ManualControlsState,
  id: ManualControlId,
  dir: 1 | -1,
  capabilities: CameraCapabilities,
): ManualControlsState {
  const next = { ...state };
  switch (id) {
    case 'iso':
      next.iso = Math.min(12800, Math.max(25, state.iso * (dir > 0 ? 2 : 0.5)));
      break;
    case 'shutter':
      next.shutter = Math.min(1, Math.max(1 / 8000, state.shutter * (dir > 0 ? 2 : 0.5)));
      break;
    case 'wb':
      next.wbKelvin = Math.min(8000, Math.max(2500, state.wbKelvin + dir * 100));
      break;
    case 'tint':
      next.wbTint = Math.min(150, Math.max(-150, state.wbTint + dir * 5));
      break;
    case 'focus':
      next.focus = Math.min(1, Math.max(0, Number((state.focus + dir * 0.05).toFixed(2))));
      break;
    case 'ev':
      next.ev = Math.min(
        capabilities.maxExposureBias,
        Math.max(capabilities.minExposureBias, Number((state.ev + dir * 0.3).toFixed(1))),
      );
      break;
  }
  return next;
}

export function ManualControls({ value, capabilities, onChange }: Props) {
  return (
    <View className="w-full gap-2 rounded-xl bg-black/55 px-2.5 py-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-[10px] font-semibold uppercase tracking-widest text-white/70">
          Manual
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
          const active = value.activeControl === control.id;
          const canEdit = value.enabled || control.id === 'ev';

          return (
            <Pressable
              key={control.id}
              disabled={!canEdit || lockedOut}
              onPress={() => onChange({ ...value, activeControl: control.id })}
              className={cn(
                'min-w-[44px] rounded-lg px-2 py-1',
                active && canEdit ? 'bg-white' : 'bg-white/10',
                (!canEdit || lockedOut) && 'opacity-40',
              )}
            >
              <Text
                className={cn(
                  'text-[9px] font-semibold uppercase',
                  active && canEdit ? 'text-black/60' : 'text-white/50',
                )}
              >
                {control.label}
              </Text>
              <Text
                className={cn(
                  'text-xs font-semibold',
                  active && canEdit ? 'text-black' : 'text-white',
                )}
              >
                {formatValue(value, control.id)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {value.enabled || value.activeControl === 'ev' ? (
        <View className="flex-row items-center justify-between gap-2">
          <Pressable
            onPress={() => onChange(stepControl(value, value.activeControl, -1, capabilities))}
            className="h-8 flex-1 items-center justify-center rounded-lg bg-white/10"
          >
            <Text className="text-base font-semibold text-white">−</Text>
          </Pressable>
          <Text className="min-w-14 text-center text-[11px] text-white/50">
            {formatValue(value, value.activeControl)}
          </Text>
          <Pressable
            onPress={() => onChange(stepControl(value, value.activeControl, 1, capabilities))}
            className="h-8 flex-1 items-center justify-center rounded-lg bg-white/10"
          >
            <Text className="text-base font-semibold text-white">+</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

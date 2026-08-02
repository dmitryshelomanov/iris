import { useRef } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/shared/ui/text';
import {
  DEFAULT_EXPOSURE_UI_LIMITS,
  DEFAULT_MANUAL_STATE,
  formatIso,
  formatShutter,
  isoFromT,
  isoToT,
  shutterFromT,
  shutterToT,
  type CameraCapabilities,
  type ExposureUiLimits,
  type ManualControlId,
  type ManualControlsState,
} from '../model';
import { cn } from '@/shared/lib/utils';
import { TickWheel } from './TickWheel';

const QUICK_CONTROLS: {
  id: Extract<ManualControlId, 'iso' | 'shutter' | 'focus'>;
  label: string;
}[] = [
  { id: 'iso', label: 'ISO' },
  { id: 'shutter', label: 'SS' },
  { id: 'focus', label: 'Focus' },
];

type QuickId = 'iso' | 'shutter' | 'focus';

type Props = {
  value: ManualControlsState;
  capabilities: CameraCapabilities;
  /**
   * Catalog-level: true if any lens can lock focus (e.g. physical wide while Multi is active).
   * Falls back to capabilities.supportsManualFocus when omitted.
   */
  canManualFocus?: boolean;
  /** Catalog-level exposure lock availability for ISO/SS. */
  canManualExposure?: boolean;
  /** Live CameraController ISO / shutter limits. */
  exposureLimits?: ExposureUiLimits;
  onChange: (next: ManualControlsState) => void;
  /** Called when user interacts with a control no lens in the catalog can lock. */
  onUnsupported?: (id: QuickId) => void;
  /** Vertical dial height (preview-relative) */
  wheelHeight?: number;
};

function formatQuick(state: ManualControlsState, id: QuickId): string {
  switch (id) {
    case 'iso':
      return formatIso(state.iso);
    case 'shutter':
      return formatShutter(state.shutter);
    case 'focus':
      return state.focus.toFixed(2);
  }
}

function isLockedOut(
  id: QuickId,
  canManualFocus: boolean,
  canManualExposure: boolean,
): boolean {
  switch (id) {
    case 'iso':
    case 'shutter':
      return !canManualExposure;
    case 'focus':
      return !canManualFocus;
  }
}

export function unsupportedManualMessage(id: QuickId): string {
  switch (id) {
    case 'focus':
      return 'Manual focus not supported on this lens';
    case 'iso':
    case 'shutter':
      return 'Manual ISO / shutter not supported on this lens';
  }
}

/**
 * ISO / SS / Focus tiles (bottom-left) + vertical dial on the right edge of the preview.
 */
export function ProQuickControls({
  value,
  capabilities,
  canManualFocus = capabilities.supportsManualFocus,
  canManualExposure = capabilities.supportsManualISO || capabilities.supportsManualShutter,
  exposureLimits = DEFAULT_EXPOSURE_UI_LIMITS,
  onChange,
  onUnsupported,
  wheelHeight = 180,
}: Props) {
  const lastUnsupportedRef = useRef<QuickId | null>(null);

  const activeId: QuickId =
    value.activeControl === 'iso' ||
    value.activeControl === 'shutter' ||
    value.activeControl === 'focus'
      ? value.activeControl
      : 'focus';

  const sliderValue =
    activeId === 'iso'
      ? isoToT(value.iso, exposureLimits)
      : activeId === 'shutter'
        ? shutterToT(value.shutter, exposureLimits)
        : value.focus;

  const reportUnsupported = (id: QuickId) => {
    if (!isLockedOut(id, canManualFocus, canManualExposure)) {
      lastUnsupportedRef.current = null;
      return;
    }
    if (lastUnsupportedRef.current === id) return;
    lastUnsupportedRef.current = id;
    onUnsupported?.(id);
  };

  const selectControl = (id: QuickId) => {
    reportUnsupported(id);
    // First tap selects; tap on the already-active tile resets that param to default.
    if (id !== activeId) {
      onChange({ ...value, activeControl: id });
      return;
    }
    const next: ManualControlsState = {
      ...value,
      activeControl: id,
      ...(id === 'iso' ? { iso: DEFAULT_MANUAL_STATE.iso } : {}),
      ...(id === 'shutter' ? { shutter: DEFAULT_MANUAL_STATE.shutter } : {}),
      ...(id === 'focus' ? { focus: DEFAULT_MANUAL_STATE.focus } : {}),
    };
    // Reset always enables Pro so the dial writes through to the controller.
    onChange({ ...next, enabled: true });
  };

  const activeLockedOut = isLockedOut(activeId, canManualFocus, canManualExposure);

  const onWheel = (t: number) => {
    if (activeLockedOut) {
      reportUnsupported(activeId);
      return;
    }
    const base = { ...value, activeControl: activeId, enabled: true };
    if (activeId === 'iso') {
      onChange({ ...base, iso: Math.round(isoFromT(t, exposureLimits)) });
      return;
    }
    if (activeId === 'shutter') {
      onChange({ ...base, shutter: shutterFromT(t, exposureLimits) });
      return;
    }
    onChange({ ...base, focus: Number(t.toFixed(2)) });
  };

  return (
    <View pointerEvents="box-none" className="absolute inset-0">
      {/* Bottom-left — clear of look chips above and shutter chrome below */}
      <View
        pointerEvents="box-none"
        className="absolute bottom-2 left-2 flex-row items-end gap-1.5"
      >
        {QUICK_CONTROLS.map((control) => {
          const lockedOut = isLockedOut(control.id, canManualFocus, canManualExposure);
          const active = activeId === control.id;
          return (
            <Pressable
              key={control.id}
              hitSlop={8}
              onPress={() => selectControl(control.id)}
              className={cn(
                'min-w-[52px] items-center rounded-lg px-2 py-1.5',
                active ? 'bg-amber-400' : 'bg-black/55',
                lockedOut && !active && 'opacity-50',
              )}
            >
              <Text
                className={cn(
                  'text-sm font-semibold',
                  active ? 'text-black' : 'text-white',
                )}
              >
                {formatQuick(value, control.id)}
              </Text>
              <Text
                className={cn(
                  'text-[9px] font-semibold uppercase',
                  active ? 'text-black/70' : 'text-white/55',
                )}
              >
                {control.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View pointerEvents="box-none" className="absolute bottom-14 right-1 top-14 justify-center">
        <TickWheel
          value={sliderValue}
          min={0}
          max={1}
          step={activeId === 'focus' ? 0.01 : 0.005}
          height={wheelHeight}
          disabled={activeLockedOut}
          onChange={onWheel}
        />
      </View>
    </View>
  );
}

export type { QuickId as ProQuickControlId };

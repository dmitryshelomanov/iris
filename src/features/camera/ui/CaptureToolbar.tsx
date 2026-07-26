import { Pressable, ScrollView } from 'react-native';
import type { FlashMode } from 'react-native-vision-camera';
import { Aperture, Clock3, Flashlight, Layers, Zap, ZapOff } from 'lucide-react-native';

import { Icon } from '@/shared/ui/icon';
import { Text } from '@/shared/ui/text';
import type { AspectRatio, CameraCapabilities, CaptureSettings, TimerSeconds } from '../model';
import { cn } from '@/shared/lib/utils';

type Props = {
  flashMode: FlashMode;
  torchOn: boolean;
  timerSeconds: TimerSeconds;
  aspect: AspectRatio;
  burstCount: CaptureSettings['burstCount'];
  capabilities: CameraCapabilities;
  onFlashChange: (mode: FlashMode) => void;
  onTorchChange: (on: boolean) => void;
  onTimerChange: (seconds: TimerSeconds) => void;
  onAspectChange: (aspect: AspectRatio) => void;
  onBurstChange: (count: CaptureSettings['burstCount']) => void;
};

const FLASH_CYCLE: FlashMode[] = ['off', 'on', 'auto'];
const TIMER_CYCLE: TimerSeconds[] = [0, 3, 10];
const BURST_CYCLE: CaptureSettings['burstCount'][] = [1, 3, 5];

function flashLabel(mode: FlashMode) {
  if (mode === 'auto') return 'A';
  if (mode === 'on') return 'On';
  return 'Off';
}

export function CaptureToolbar({
  flashMode,
  torchOn,
  timerSeconds,
  aspect,
  burstCount,
  capabilities,
  onFlashChange,
  onTorchChange,
  onTimerChange,
  onAspectChange,
  onBurstChange,
}: Props) {
  const cycleFlash = () => {
    const idx = FLASH_CYCLE.indexOf(flashMode);
    onFlashChange(FLASH_CYCLE[(idx + 1) % FLASH_CYCLE.length]);
  };

  const cycleTimer = () => {
    const idx = TIMER_CYCLE.indexOf(timerSeconds);
    onTimerChange(TIMER_CYCLE[(idx + 1) % TIMER_CYCLE.length]);
  };

  const cycleBurst = () => {
    const idx = BURST_CYCLE.indexOf(burstCount);
    onBurstChange(BURST_CYCLE[(idx + 1) % BURST_CYCLE.length]);
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="flex-row items-center gap-1.5 px-0.5"
    >
      <ToolChip
        disabled={!capabilities.hasFlash}
        active={flashMode !== 'off'}
        onPress={cycleFlash}
        label={flashLabel(flashMode)}
        icon={flashMode === 'off' ? ZapOff : Zap}
      />
      <ToolChip
        disabled={!capabilities.hasTorch}
        active={torchOn}
        onPress={() => onTorchChange(!torchOn)}
        label="Torch"
        icon={Flashlight}
      />
      <ToolChip
        active={timerSeconds > 0}
        onPress={cycleTimer}
        label={timerSeconds === 0 ? 'Timer' : `${timerSeconds}s`}
        icon={Clock3}
      />
      <ToolChip
        active={burstCount > 1}
        onPress={cycleBurst}
        label={burstCount === 1 ? 'Single' : `${burstCount}×`}
        icon={Layers}
      />
      <ToolChip
        active={aspect === '16:9'}
        onPress={() => onAspectChange(aspect === '4:3' ? '16:9' : '4:3')}
        label={aspect}
        icon={Aperture}
      />
    </ScrollView>
  );
}

function ToolChip({
  label,
  icon,
  active,
  disabled,
  onPress,
}: {
  label: string;
  icon: typeof Zap;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'h-7 flex-row items-center gap-1 rounded-full px-2.5',
        active ? 'bg-amber-400' : 'bg-black/45',
        disabled && 'opacity-35',
      )}
    >
      <Icon as={icon} size={12} className={active ? 'text-black' : 'text-white'} />
      <Text className={cn('text-[11px] font-semibold', active ? 'text-black' : 'text-white')}>
        {label}
      </Text>
    </Pressable>
  );
}

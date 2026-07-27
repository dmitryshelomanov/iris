import {
  Aperture,
  Binoculars,
  Expand,
  Layers,
  Scan,
  User,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, ScrollView } from 'react-native';

import { cn } from '@/shared/lib/utils';
import { Icon } from '@/shared/ui/icon';
import { Text } from '@/shared/ui/text';
import type { LensId, LensKind, LensOption } from '../model';

type Props = {
  lenses: LensOption[];
  activeId: LensId | undefined;
  onChange: (lens: LensOption) => void;
};

function iconForLens(lens: LensOption): LucideIcon {
  if (lens.kind === 'front' || lens.position === 'front') return User;
  if (lens.kind === 'multi') return Layers;
  if (lens.kind === 'crop') return Expand;
  switch (lens.deviceType) {
    case 'ultra-wide-angle':
      return Scan;
    case 'telephoto':
      return Binoculars;
    case 'wide-angle':
    default:
      return Aperture;
  }
}

function toneForKind(kind: LensKind, active: boolean) {
  if (active) return 'text-sky-300';
  if (kind === 'crop') return 'text-white/55';
  if (kind === 'multi') return 'text-amber-200/80';
  return 'text-white/80';
}

export function LensSwitcher({ lenses, activeId, onChange }: Props) {
  if (lenses.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="flex-row items-center gap-1.5"
    >
      {lenses.map((lens) => {
        const active = lens.id === activeId;
        const IconGlyph = iconForLens(lens);
        return (
          <Pressable
            key={lens.id}
            onPress={() => onChange(lens)}
            className={cn(
              'h-7 flex-row items-center gap-1 rounded-full border px-2.5',
              active ? 'border-sky-400 bg-sky-400/25' : 'border-white/15 bg-black/45',
              lens.kind === 'crop' && !active && 'border-white/10',
            )}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Lens ${lens.label}`}
          >
            <Icon as={IconGlyph} size={12} className={toneForKind(lens.kind, active)} />
            <Text
              className={cn('text-[11px] font-semibold', active ? 'text-sky-300' : 'text-white')}
            >
              {lens.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

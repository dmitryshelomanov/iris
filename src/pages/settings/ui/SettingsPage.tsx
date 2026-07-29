import type { ReactNode } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MirrorMode, QualityPrioritization } from 'react-native-vision-camera';

import { Button } from '@/shared/ui/button';
import { Separator } from '@/shared/ui/separator';
import { Text } from '@/shared/ui/text';
import { useCaptureSettings, type AspectRatio, type VideoFpsOption } from '@/features/camera';
import { cn } from '@/shared/lib/utils';

export function SettingsPage() {
  const insets = useSafeAreaInsets();
  const { settings, patchSettings } = useCaptureSettings();

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}
    >
      <Text className="mt-1 text-sm text-muted-foreground">
        Capture defaults persist across launches. Looks bake into saved photos.
      </Text>

      <Section title="Photo">
        <Row label="Aspect">
          <Segmented
            value={settings.aspect}
            options={[
              { value: '4:3', label: '4:3' },
              { value: '16:9', label: '16:9' },
            ]}
            onChange={(aspect) => patchSettings({ aspect: aspect as AspectRatio })}
          />
        </Row>
        <Separator />
        <Row label="Quality">
          <Segmented
            value={settings.qualityPrioritization}
            options={[
              { value: 'speed', label: 'Fast' },
              { value: 'balanced', label: 'Balanced' },
              { value: 'quality', label: 'Best' },
            ]}
            onChange={(qualityPrioritization) =>
              patchSettings({
                qualityPrioritization: qualityPrioritization as QualityPrioritization,
              })
            }
          />
        </Row>
        <Separator />
        <Row label="JPEG quality">
          <Segmented
            value={String(settings.jpegQuality)}
            options={[
              { value: '0.85', label: '0.85' },
              { value: '0.95', label: '0.95' },
              { value: '1', label: '1.0' },
            ]}
            onChange={(jpegQuality) => patchSettings({ jpegQuality: Number(jpegQuality) })}
          />
        </Row>
        <Separator />
        <ToggleRow
          label="Photo HDR"
          hint="Bracketed exposure when the device supports it"
          value={settings.photoHDR}
          onChange={(photoHDR) => patchSettings({ photoHDR })}
        />
        <Separator />
        <ToggleRow
          label="Distortion correction"
          hint="Straightens ultra-wide edges"
          value={settings.distortionCorrection}
          onChange={(distortionCorrection) => patchSettings({ distortionCorrection })}
        />
        <Separator />
        <ToggleRow
          label="Shutter sound"
          value={settings.shutterSound}
          onChange={(shutterSound) => patchSettings({ shutterSound })}
        />
      </Section>

      <Section title="Video">
        <ToggleRow
          label="Video stabilization"
          hint="Cinematic EIS — crops FoV, adds latency; weaker at 60 fps"
          value={settings.videoStabilization}
          onChange={(videoStabilization) => patchSettings({ videoStabilization })}
        />
        <Separator />
        <Row label="Video FPS">
          <Segmented
            value={String(settings.videoFps)}
            options={[
              { value: '30', label: '30' },
              { value: '60', label: '60' },
              { value: 'max', label: 'Max' },
            ]}
            onChange={(videoFps) =>
              patchSettings({
                videoFps: (videoFps === 'max' ? 'max' : Number(videoFps)) as VideoFpsOption,
              })
            }
          />
        </Row>
      </Section>

      <Section title="Capture aids">
        <ToggleRow
          label="Aspect crop"
          hint="Letterbox preview to match save aspect"
          value={settings.showAspectCrop}
          onChange={(showAspectCrop) => patchSettings({ showAspectCrop })}
        />
        <Separator />
        <ToggleRow
          label="Crosshair"
          hint="Center reticle with tilt guidance"
          value={settings.showCrosshair}
          onChange={(showCrosshair) => patchSettings({ showCrosshair })}
        />
        <Separator />
        <ToggleRow
          label="Volume shutter"
          hint="Hardware volume / Camera Control as shutter"
          value={settings.volumeShutter}
          onChange={(volumeShutter) => patchSettings({ volumeShutter })}
        />
        <Separator />
        <ToggleRow
          label="Grid"
          hint="Rule of thirds"
          value={settings.showGrid}
          onChange={(showGrid) => patchSettings({ showGrid })}
        />
        <Separator />
        <ToggleRow
          label="Level"
          hint="Horizon from device motion"
          value={settings.showLevel}
          onChange={(showLevel) => patchSettings({ showLevel })}
        />
        <Separator />
        <ToggleRow
          label="Focus peaking"
          hint="Magenta focus-plane assist"
          value={settings.showPeaking}
          onChange={(showPeaking) => patchSettings({ showPeaking })}
        />
      </Section>

      <Section title="Lighting">
        <ToggleRow
          label="Low-light boost"
          hint="Longer exposure in dark scenes"
          value={settings.lowLightBoost}
          onChange={(lowLightBoost) => patchSettings({ lowLightBoost })}
        />
      </Section>

      <Section title="Front camera">
        <Row label="Mirror">
          <Segmented
            value={settings.mirrorMode}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'on', label: 'On' },
              { value: 'off', label: 'Off' },
            ]}
            onChange={(mirrorMode) => patchSettings({ mirrorMode: mirrorMode as MirrorMode })}
          />
        </Row>
      </Section>

      <Section title="Save">
        <View className="gap-1">
          <Text className="text-sm font-medium text-foreground">Destination</Text>
          <Text className="text-muted-foreground">Photos app · Iris album</Text>
        </View>
      </Section>

      <View className="mt-5 gap-2">
        <Button onPress={() => Linking.openSettings()}>
          <Text className="text-primary-foreground">Open system settings</Text>
        </Button>
      </View>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="mt-5 gap-2.5">
      <Text className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </Text>
      <View className="gap-3 rounded-xl border border-border p-3">{children}</View>
    </View>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      {children}
    </View>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      className="flex-row items-center justify-between gap-2"
    >
      <View className="flex-1 gap-0.5">
        <Text className="text-sm font-medium text-foreground">{label}</Text>
        {hint ? <Text className="text-[11px] text-muted-foreground">{hint}</Text> : null}
      </View>
      <View
        className={cn(
          'h-6 w-10 justify-center rounded-full px-0.5',
          value ? 'bg-amber-400' : 'bg-muted',
        )}
      >
        <View className={cn('h-5 w-5 rounded-full bg-white', value ? 'self-end' : 'self-start')} />
      </View>
    </Pressable>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <View className="flex-row gap-1.5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            className={cn(
              'flex-1 items-center rounded-lg py-1.5',
              active ? 'bg-foreground' : 'bg-muted',
            )}
          >
            <Text
              className={cn(
                'text-[11px] font-semibold',
                active ? 'text-background' : 'text-foreground',
              )}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

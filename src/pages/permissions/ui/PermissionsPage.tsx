import { usePermissions as useMediaLibraryPermissions } from 'expo-media-library';
import { Linking, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCameraPermission, useMicrophonePermission } from 'react-native-vision-camera';

import { Button } from '@/shared/ui/button';
import { Text } from '@/shared/ui/text';

export function PermissionsPage() {
  const insets = useSafeAreaInsets();
  const camera = useCameraPermission();
  const mic = useMicrophonePermission();
  const [photos, requestPhotos] = useMediaLibraryPermissions({ writeOnly: true });

  return (
    <View
      className="flex-1 gap-6 bg-background px-5"
      style={{ paddingTop: 16, paddingBottom: insets.bottom + 16 }}
    >
      <Text className="text-muted-foreground">
        Grant camera, microphone, and Photos access so Iris can capture and save to your library.
      </Text>

      <View className="gap-3 rounded-2xl border border-border p-4">
        <Text className="font-semibold text-foreground">Camera: {camera.status}</Text>
        <Text className="font-semibold text-foreground">Microphone: {mic.status}</Text>
        <Text className="font-semibold text-foreground">
          Photos: {photos?.status ?? 'undetermined'}
        </Text>
      </View>

      <Button
        onPress={async () => {
          if (camera.canRequestPermission) await camera.requestPermission();
          if (mic.canRequestPermission) await mic.requestPermission();
          await requestPhotos();
        }}
      >
        <Text className="text-primary-foreground">Request permissions</Text>
      </Button>

      {(!camera.hasPermission && !camera.canRequestPermission) || photos?.canAskAgain === false ? (
        <Button variant="outline" onPress={() => Linking.openSettings()}>
          <Text>Open iOS Settings</Text>
        </Button>
      ) : null}
    </View>
  );
}

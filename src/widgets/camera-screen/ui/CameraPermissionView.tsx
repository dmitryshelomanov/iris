import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useMicrophonePermission } from 'react-native-vision-camera';

import { Text } from '@/shared/ui/text';

type Props = {
  canRequestPermission: boolean;
  requestPermission: () => Promise<boolean>;
};

export function CameraPermissionView({ canRequestPermission, requestPermission }: Props) {
  const router = useRouter();
  const mic = useMicrophonePermission();

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-black px-8">
      <Text className="text-center text-xl font-semibold text-white">Camera access needed</Text>
      <Text className="text-center text-sm text-white/60">
        Iris needs the camera for photo and video. Microphone is used for video audio.
      </Text>
      {canRequestPermission ? (
        <Pressable
          onPress={async () => {
            await requestPermission();
            if (!mic.hasPermission && mic.canRequestPermission) {
              await mic.requestPermission();
            }
          }}
          className="rounded-full bg-white px-5 py-3"
        >
          <Text className="font-semibold text-black">Allow camera</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => router.push('/permissions')}
          className="rounded-full bg-white/15 px-5 py-3"
        >
          <Text className="font-semibold text-white">Open permissions help</Text>
        </Pressable>
      )}
    </View>
  );
}

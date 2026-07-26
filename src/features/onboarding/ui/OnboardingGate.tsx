import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { Text } from '@/shared/ui/text';

const ONBOARDING_KEY = 'iris.onboarding.v1.seen';

const STEPS = [
  {
    title: 'Pick a look',
    body: 'Film-inspired grades sit under the preview. Free looks: Native, Portra, Noir.',
  },
  {
    title: 'Compose & shoot',
    body: 'Aspect crop matches the save. Tap to focus, long-press to lock AE/AF. Volume buttons work as shutter.',
  },
  {
    title: 'Looks bake in',
    body: 'Saved photos and videos land in your Photos Iris album with the look applied.',
  },
];

export function OnboardingGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
        if (!cancelled) setVisible(seen !== '1');
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const finish = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    setVisible(false);
  };

  const next = () => {
    if (step >= STEPS.length - 1) {
      void finish();
      return;
    }
    setStep((s) => s + 1);
  };

  if (!ready) return <>{children}</>;

  const current = STEPS[step];

  return (
    <>
      {children}
      <Modal visible={visible} transparent animationType="fade">
        <View className="flex-1 justify-end bg-black/75">
          <View className="gap-4 rounded-t-3xl border-t border-white/10 bg-zinc-950 px-6 pb-10 pt-6">
            <Text className="text-[11px] font-semibold uppercase tracking-widest text-amber-400">
              Welcome to Iris · {step + 1}/{STEPS.length}
            </Text>
            <Text className="text-2xl font-semibold text-white">{current.title}</Text>
            <Text className="text-sm leading-5 text-white/65">{current.body}</Text>
            <Pressable onPress={next} className="mt-2 items-center rounded-xl bg-amber-400 py-3.5">
              <Text className="font-semibold text-black">
                {step >= STEPS.length - 1 ? 'Start shooting' : 'Next'}
              </Text>
            </Pressable>
            <Pressable onPress={() => void finish()} className="items-center py-1">
              <Text className="text-sm text-white/40">Skip</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

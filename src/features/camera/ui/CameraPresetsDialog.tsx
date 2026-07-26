import { useEffect, useMemo, useState } from 'react';
import { Keyboard, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react-native';

import type { CameraPreset } from '../model';
import { Icon } from '@/shared/ui/icon';
import { Text } from '@/shared/ui/text';
import { cn } from '@/shared/lib/utils';

type Props = {
  visible: boolean;
  presets: CameraPreset[];
  suggestedName: string;
  onClose: () => void;
  onSaveCurrent: (name: string) => void;
  onApply: (preset: CameraPreset) => void;
  onRename: (preset: CameraPreset, name: string) => void;
  onDelete: (preset: CameraPreset) => void;
};

export function CameraPresetsDialog({
  visible,
  presets,
  suggestedName,
  onClose,
  onSaveCurrent,
  onApply,
  onRename,
  onDelete,
}: Props) {
  const [newName, setNewName] = useState(suggestedName);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (visible) {
      setNewName(suggestedName);
    } else {
      setEditingId(null);
      setKeyboardHeight(0);
    }
  }, [suggestedName, visible]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const editingPreset = useMemo(
    () => presets.find((preset) => preset.id === editingId) ?? null,
    [editingId, presets],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        className="flex-1 items-center bg-black/70 px-5"
        style={{
          justifyContent: keyboardHeight > 0 ? 'flex-end' : 'center',
          paddingBottom: keyboardHeight > 0 ? keyboardHeight + 12 : 0,
        }}
        onPress={() => {
          Keyboard.dismiss();
          onClose();
        }}
      >
        <Pressable
          onPress={(event) => event.stopPropagation()}
          className="w-full max-w-sm gap-4 rounded-2xl border border-white/10 bg-zinc-950 p-5"
        >
          <View className="gap-1">
            <Text className="text-lg font-semibold text-white">Presets</Text>
            <Text className="text-sm leading-5 text-white/65">
              Save the current camera setup and quickly restore it later.
            </Text>
          </View>

          <View className="gap-2 rounded-xl border border-white/10 bg-black/25 p-3">
            <Text className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
              Save current setup
            </Text>
            <View className="flex-row items-center gap-2">
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder={suggestedName}
                placeholderTextColor="rgba(255,255,255,0.35)"
                className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-white"
              />
              <Pressable
                onPress={() => {
                  onSaveCurrent(newName);
                  setNewName(suggestedName);
                }}
                className="h-11 w-11 items-center justify-center rounded-xl bg-sky-400"
              >
                <Icon as={Plus} size={18} className="text-black" />
              </Pressable>
            </View>
          </View>

          {presets.length === 0 ? (
            <View className="rounded-xl border border-dashed border-white/15 px-4 py-6">
              <Text className="text-center text-base font-medium text-white">No presets yet</Text>
              <Text className="mt-1 text-center text-sm leading-5 text-white/55">
                Save your current look, lens, zoom, manual controls, and mode as a reusable preset.
              </Text>
            </View>
          ) : (
            <ScrollView
              className="max-h-80"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View className="gap-2">
                {presets.map((preset) => {
                  const editing = editingPreset?.id === preset.id;
                  return (
                    <View
                      key={preset.id}
                      className="gap-2 rounded-xl border border-white/10 bg-black/25 p-3"
                    >
                      <View className="flex-row items-center gap-2">
                        {editing ? (
                          <TextInput
                            value={draftName}
                            onChangeText={setDraftName}
                            autoFocus
                            placeholder={preset.name}
                            placeholderTextColor="rgba(255,255,255,0.35)"
                            className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white"
                            returnKeyType="done"
                            onSubmitEditing={() => {
                              onRename(preset, draftName);
                              setEditingId(null);
                            }}
                          />
                        ) : (
                          <View className="flex-1">
                            <Text className="text-base font-medium text-white">{preset.name}</Text>
                            <Text className="text-[11px] text-white/45">
                              {preset.mode === 'video' ? 'Video' : 'Photo'} ·{' '}
                              {preset.settings.lookId}
                            </Text>
                          </View>
                        )}

                        <Pressable
                          onPress={() => {
                            if (editing) {
                              onRename(preset, draftName);
                              setEditingId(null);
                              return;
                            }
                            setEditingId(preset.id);
                            setDraftName(preset.name);
                          }}
                          className={cn(
                            'h-9 w-9 items-center justify-center rounded-lg',
                            editing ? 'bg-amber-400' : 'bg-white/8',
                          )}
                        >
                          <Icon
                            as={editing ? Check : Pencil}
                            size={16}
                            className={editing ? 'text-black' : 'text-white'}
                          />
                        </Pressable>
                        <Pressable
                          onPress={() => onDelete(preset)}
                          className="h-9 w-9 items-center justify-center rounded-lg bg-white/8"
                        >
                          <Icon as={Trash2} size={16} className="text-white/80" />
                        </Pressable>
                      </View>

                      <Pressable
                        onPress={() => onApply(preset)}
                        className="items-center rounded-lg bg-white/8 py-2.5"
                      >
                        <Text className="font-semibold text-white">Apply</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}

          <Pressable onPress={onClose} className="items-center py-1">
            <Text className="text-sm text-white/50">Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

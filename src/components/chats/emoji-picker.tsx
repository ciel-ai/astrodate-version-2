import { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  FlatList,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AVATAR_TEMPLATES = [
  { id: 'leo', name: 'Leo', seed: 'Leo' },
  { id: 'mia', name: 'Mia', seed: 'Mia' },
  { id: 'sam', name: 'Sam', seed: 'Sam' },
  { id: 'ava', name: 'Ava', seed: 'Ava' },
  { id: 'zoe', name: 'Zoe', seed: 'Zoe' },
  { id: 'max', name: 'Max', seed: 'Max' },
];

const AVATAR_REACTIONS = [
  { id: 'hi', name: 'Hi!', eyes: 'default', mouth: 'smile' },
  { id: 'love', name: 'Love', eyes: 'hearts', mouth: 'smile' },
  { id: 'haha', name: 'Haha', eyes: 'happy', mouth: 'smile' },
  { id: 'sad', name: 'Sad', eyes: 'cry', mouth: 'sad' },
  { id: 'shocked', name: 'Shocked', eyes: 'surprised', mouth: 'screamingOpen' },
  { id: 'wink', name: 'Wink', eyes: 'wink', mouth: 'smile' },
  { id: 'playful', name: 'Playful', eyes: 'default', mouth: 'tongue' },
  { id: 'grimace', name: 'Grimace', eyes: 'default', mouth: 'grimace' },
  { id: 'angry', name: 'Angry', eyes: 'angry', mouth: 'grimace' },
  { id: 'dizzy', name: 'Dizzy', eyes: 'dizzy', mouth: 'grimace' },
  { id: 'concerned', name: 'Concerned', eyes: 'concerned', mouth: 'concerned' },
  { id: 'yum', name: 'Yum', eyes: 'happy', mouth: 'eating' },
];

interface EmojiPickerProps {
  onSelectSticker?: (stickerUrl: string) => void;
  isDark?: boolean;
}

// Despite the name (kept for the one call site in chat/[channelId].tsx),
// this only ever renders the dicebear avatar-reaction sticker tray now --
// the free-text emoji keyboard mode (search, categories, ~180 emoji) was
// built but never reachable from any UI and has been removed.
export function EmojiPicker({ onSelectSticker, isDark = true }: EmojiPickerProps) {
  const T = {
    bg: isDark ? '#0E0726' : '#FFFFFF',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    headerBg: isDark ? '#0A0420' : '#F9F9FB',
    dim: isDark ? '#A3A0AB' : '#6B7280',
    dim2: isDark ? '#8C8896' : '#6B7280',
    inputBg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    inputBorder: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    text: isDark ? '#FFFFFF' : '#1B1528',
    placeholderBg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    pressedBg: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
  };
  const [avatarSeed, setAvatarSeed] = useState('Leo');

  return (
    <View style={[styles.container, { backgroundColor: T.bg, borderTopColor: T.border, height: 340 }]}>
      {/* Stickers Header & Avatar Creator */}
      <View style={[styles.avatarCreatorWrap, { backgroundColor: T.headerBg, borderBottomColor: T.border }]}>
        <View style={styles.avatarInputRow}>
          <Text style={[styles.avatarLabel, { color: T.dim }]}>Avatar seed:</Text>
          <TextInput
            value={avatarSeed}
            onChangeText={setAvatarSeed}
            placeholder="Type name..."
            placeholderTextColor={T.dim2}
            style={[styles.avatarInput, { backgroundColor: T.inputBg, color: T.text, borderColor: T.inputBorder }]}
            autoCorrect={false}
            maxLength={20}
          />
        </View>
        <View style={styles.templatesRow}>
          {AVATAR_TEMPLATES.map((tmpl) => {
            const isActive = avatarSeed.toLowerCase().trim() === tmpl.seed.toLowerCase().trim();
            const previewUrl = `https://api.dicebear.com/9.x/avataaars/png?seed=${tmpl.seed}&eyes=default&mouth=smile`;
            return (
              <Pressable
                key={tmpl.id}
                style={[styles.templateBtn, isActive && styles.templateBtnActive]}
                onPress={() => setAvatarSeed(tmpl.seed)}
              >
                <Image source={{ uri: previewUrl }} style={[styles.templatePreview, { backgroundColor: T.placeholderBg }]} />
                <Text style={[styles.templateText, { color: T.dim2 }, isActive && styles.templateTextActive]}>
                  {tmpl.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Stickers Grid */}
      <View style={styles.gridContainer}>
        <FlatList
          data={AVATAR_REACTIONS}
          keyExtractor={(item) => item.id}
          numColumns={3}
          renderItem={({ item }) => {
            const stickerUrl = `https://api.dicebear.com/9.x/avataaars/png?seed=${avatarSeed.trim() || 'AstroUser'}&eyes=${item.eyes}&mouth=${item.mouth}`;
            return (
              <Pressable
                style={({ pressed }) => [
                  styles.stickerBtn,
                  pressed && [styles.stickerBtnPressed, { backgroundColor: T.pressedBg }],
                ]}
                onPress={() => onSelectSticker?.(stickerUrl)}
              >
                <Image source={{ uri: stickerUrl }} style={styles.stickerImage} contentFit="contain" />
                <Text style={[styles.stickerName, { color: T.dim }]}>{item.name}</Text>
              </Pressable>
            );
          }}
          contentContainerStyle={styles.stickerListContent}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0E0726',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  gridContainer: {
    flex: 1,
    paddingHorizontal: 12,
  },
  // Avatar Creator styling
  avatarCreatorWrap: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#0A0420',
  },
  avatarInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  avatarLabel: {
    color: '#A3A0AB',
    fontSize: 13,
    fontWeight: '600',
    marginRight: 8,
  },
  avatarInput: {
    flex: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    paddingHorizontal: 12,
    color: '#FFFFFF',
    fontSize: 13,
    paddingVertical: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  templatesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 4,
  },
  templateBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  templateBtnActive: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
  },
  templatePreview: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  templateText: {
    color: '#8C8896',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '500',
  },
  templateTextActive: {
    color: '#A855F7',
    fontWeight: '600',
  },
  stickerListContent: {
    paddingTop: 10,
    paddingBottom: 20,
  },
  stickerBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    margin: 4,
    borderRadius: 12,
  },
  stickerBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    transform: [{ scale: 0.95 }],
  },
  stickerImage: {
    width: SCREEN_WIDTH / 4.2,
    height: SCREEN_WIDTH / 4.2,
  },
  stickerName: {
    color: '#A3A0AB',
    fontSize: 12,
    marginTop: 6,
    fontWeight: '500',
  },
});

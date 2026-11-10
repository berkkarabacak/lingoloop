import React, { useCallback, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import type { SavedWord } from "@lingoloop/shared";
import { LEVEL_LABELS } from "@lingoloop/shared";
import { api } from "../../api/client";
import { mediaUrl } from "../../api/baseUrl";
import { Screen } from "../../components/Screen";
import { EmptyState, LoadingState } from "../../components/States";
import { Button } from "../../components/Button";
import { useAuth } from "../../auth/AuthProvider";
import { colors, font, levelColors } from "../../theme/tokens";
import { safePlay } from "../../feed/playback";

function ClipModal({ item, onClose }: { item: SavedWord; onClose: () => void }) {
  const player = useVideoPlayer(mediaUrl(item.videoUrl), (instance) => { instance.loop = true; safePlay(instance); });
  return <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
    <View style={styles.modal}>
      <View style={styles.modalHeader}><Text style={styles.modalTitle}>{item.headword}</Text><Pressable accessibilityLabel="Close saved lesson" accessibilityRole="button" onPress={onClose} style={styles.close}><Ionicons name="close" size={26} color={colors.text} /></Pressable></View>
      <VideoView player={player as any} style={styles.modalVideo} nativeControls contentFit="contain" playsInline />
      <View style={styles.modalCopy}><Text style={styles.modalPos}>{item.partOfSpeech}</Text><Text style={styles.modalDefinition}>{item.definition}</Text><Text style={styles.modalExample}>“{item.example}”</Text><Button title="Back to saved words" onPress={onClose} /></View>
    </View>
  </Modal>;
}

export default function SavedScreen() {
  const { refreshMe } = useAuth();
  const [items, setItems] = useState<SavedWord[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SavedWord | null>(null);
  const load = useCallback(async () => {
    try { const result = await api<{ items: SavedWord[] }>("/api/saved"); setItems(result.items); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { setLoading(true); void load(); }, [load]));
  async function unsave(item: SavedWord) {
    setItems((current) => current.filter((entry) => entry.vocabId !== item.vocabId));
    setSelected(null);
    await api(`/api/saved/${item.vocabId}`, { method: "DELETE" });
    await refreshMe();
  }
  const filtered = items.filter((item) => `${item.headword} ${item.definition}`.toLowerCase().includes(query.toLowerCase()));
  if (loading) return <LoadingState label="Opening your word collection…" />;
  return <Screen title="Saved words" subtitle={`${items.length} ${items.length === 1 ? "word" : "words"} ready for another look.`}>
    {!!items.length && <TextInput accessibilityLabel="Search saved words" style={styles.search} value={query} onChangeText={setQuery} placeholder="Search words or meanings" placeholderTextColor={colors.muted} />}
    {!items.length ? <EmptyState icon="bookmark-outline" title="Nothing saved yet" copy="Tap the bookmark on any clip and it will appear here for review." /> : !filtered.length ? <EmptyState icon="search-outline" title="No matching words" copy="Try a different search." /> : <View style={styles.list}>{filtered.map((item) => <View key={item.vocabId} testID={`saved-row-${item.slug}`} style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Review ${item.headword}`} onPress={() => setSelected(item)} style={styles.rowMain}>
        <View style={styles.rowTitle}><View style={[styles.levelDot, { backgroundColor: levelColors[item.level] }]} /><Text style={styles.headword}>{item.headword}</Text></View>
        <Text numberOfLines={2} style={styles.definition}>{item.definition}</Text>
        <Text style={styles.level}>{LEVEL_LABELS[item.level]} · {item.partOfSpeech}</Text>
      </Pressable>
      <Pressable testID={`saved-unsave-${item.slug}`} accessibilityRole="button" accessibilityLabel={`Remove ${item.headword} from saved words`} onPress={() => void unsave(item)} style={styles.unsave}><Ionicons name="bookmark" size={22} color={colors.lime} /></Pressable>
    </View>)}</View>}
    {selected && <ClipModal item={selected} onClose={() => setSelected(null)} />}
  </Screen>;
}
const styles = StyleSheet.create({
  search: { minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 15, fontSize: 16, outlineStyle: "solid", outlineWidth: 0 },
  list: { gap: 10 },
  row: { flexDirection: "row", alignItems: "center", borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, overflow: "hidden" },
  rowMain: { flex: 1, padding: 16, gap: 5 },
  rowTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
  levelDot: { width: 8, height: 8, borderRadius: 4 },
  headword: { ...font("700"), color: colors.text, fontSize: 19 },
  definition: { ...font("400"), color: colors.muted, fontSize: 14, lineHeight: 20 },
  level: { ...font("500"), color: colors.muted, fontSize: 11 },
  unsave: { width: 52, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
  modal: { flex: 1, backgroundColor: colors.ink },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20 },
  modalTitle: { ...font("800"), color: colors.lime, fontSize: 28, flex: 1 },
  close: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  modalVideo: { width: "100%", maxHeight: 520, aspectRatio: 9 / 16, backgroundColor: "#000" },
  modalCopy: { padding: 20, gap: 12 },
  modalPos: { ...font("600"), color: colors.muted, fontSize: 13 },
  modalDefinition: { ...font("500"), color: colors.text, fontSize: 18, lineHeight: 25 },
  modalExample: { ...font("400"), color: colors.muted, fontSize: 16, lineHeight: 23, fontStyle: "italic" },
});

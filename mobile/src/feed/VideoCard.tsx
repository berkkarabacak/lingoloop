/* eslint-disable react-hooks/immutability -- expo-video players are intentionally mutable objects. */
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useEvent, useEventListener } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { LEVEL_LABELS, type FeedItem } from "@lingoloop/shared";
import { colors, font, levelColors } from "../theme/tokens";
import { mediaUrl } from "../api/baseUrl";
import { usePlaybackPrefs } from "../state/PlaybackPrefs";
import { SubtitleLine } from "./SubtitleLine";
import { safePlay } from "./playback";
import { Button } from "../components/Button";

interface Props {
  item: FeedItem;
  index: number;
  isActive: boolean;
  isNear: boolean;
  onSeen: (item: FeedItem) => void;
  onComplete: (item: FeedItem, fallback?: boolean) => void;
  onToggleSave: (item: FeedItem) => void;
  registerControls?: (controls: { toggle: () => void; replay: () => void } | null) => void;
}

function RailButton({ icon, label, onPress, active = false, testID }: { icon: string; label: string; onPress: () => void; active?: boolean; testID?: string }) {
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={(event) => { event.stopPropagation?.(); onPress(); }} style={({ pressed }) => [styles.railButton, pressed && styles.pressed]}>
    <Ionicons name={icon as any} size={25} color={active ? colors.lime : colors.text} />
    <Text style={[styles.railLabel, active && { color: colors.lime }]}>{label}</Text>
  </Pressable>;
}

function PlayerCard({ item, index, isActive, onSeen, onComplete, onToggleSave, registerControls }: Omit<Props, "isNear">) {
  const { muted, setMuted } = usePlaybackPrefs();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [retry, setRetry] = useState(0);
  const completed = useRef(false);
  const maxProgress = useRef(0);
  const player = useVideoPlayer({ uri: mediaUrl(item.videoUrl), useCaching: Platform.OS !== "web" }, (instance) => {
    instance.loop = true;
    instance.muted = muted;
    instance.timeUpdateEventInterval = 0.25;
  });
  useEventListener(player, "statusChange", ({ status }) => { if (status === "error") setFailed(true); });
  const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing });
  const timeUpdate = useEvent(player, "timeUpdate", { currentTime: player.currentTime, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition: 0 });
  const currentTime = timeUpdate?.currentTime || 0;

  useEventListener(player, "playToEnd", () => {
    if (isActive && !completed.current) { completed.current = true; onComplete(item); }
  });

  useEffect(() => { player.muted = muted; }, [muted, player]);
  useEffect(() => {
    if (isActive && !failed) safePlay(player); else player.pause();
  }, [failed, isActive, player]);
  useEffect(() => {
    if (!isActive) return;
    const seen = setTimeout(() => onSeen(item), 1500);
    return () => clearTimeout(seen);
  }, [isActive, item, onSeen]);
  useEffect(() => {
    if (ready || failed || !isActive) return;
    const timer = setTimeout(() => setFailed(true), 10000);
    return () => clearTimeout(timer);
  }, [failed, isActive, ready]);
  useEffect(() => {
    if (!isActive || !failed) return;
    const timer = setTimeout(() => { if (!completed.current) { completed.current = true; onComplete(item, true); } }, 4000);
    return () => clearTimeout(timer);
  }, [failed, isActive, item, onComplete]);
  useEffect(() => {
    const duration = player.duration || item.durationMs / 1000;
    if (duration > 0) maxProgress.current = Math.max(maxProgress.current, currentTime / duration);
    if (isActive && maxProgress.current >= 0.8 && !completed.current) { completed.current = true; onComplete(item); }
  }, [currentTime, isActive, item, onComplete, player.duration]);

  function togglePlayback() { if (isPlaying) player.pause(); else safePlay(player); }
  async function retryVideo() {
    setFailed(false); setReady(false); setRetry((value) => value + 1);
    await player.replaceAsync({ uri: mediaUrl(item.videoUrl), useCaching: Platform.OS !== "web" });
    if (isActive) safePlay(player);
  }
  useEffect(() => {
    registerControls?.({
      toggle: () => { if (isPlaying) player.pause(); else safePlay(player); },
      replay: () => { maxProgress.current = 0; player.currentTime = 0; safePlay(player); },
    });
    return () => registerControls?.(null);
  }, [isPlaying, player, registerControls]);

  return <View testID={`feed-card-${index}`} style={styles.card} accessibilityLabel={`Word: ${item.headword}. ${item.partOfSpeech}. ${item.definition}. Example: ${item.example}`}>
    <Image testID={`video-poster-${item.slug}`} source={{ uri: mediaUrl(item.posterUrl) }} style={[styles.media, ready && !failed && styles.hidden]} contentFit="cover" transition={150} />
    {!failed && <VideoView
      key={retry}
      player={player as any}
      style={styles.media}
      nativeControls={false}
      contentFit="cover"
      playsInline
      surfaceType={Platform.OS === "android" ? "textureView" : undefined}
      onFirstFrameRender={() => setReady(true)}
    />}
    <Pressable accessibilityRole="button" accessibilityLabel={isPlaying ? "Pause video" : "Play video"} onPress={togglePlayback} style={styles.tapLayer}>
      {!isPlaying && !failed && <View style={styles.playGlyph}><Ionicons name="play" size={34} color={colors.text} /></View>}
    </Pressable>
    {!ready && !failed && <ActivityIndicator style={styles.loader} color={colors.lime} size="large" />}
    {failed && <View style={styles.errorBox}><Ionicons name="cloud-offline-outline" size={28} color={colors.coral} /><Text style={styles.errorTitle}>Video unavailable</Text><Text style={styles.errorCopy}>The lesson still works. Read the word and example, or retry the clip.</Text><Button title="Retry video" variant="secondary" onPress={() => void retryVideo()} /></View>}
    <View pointerEvents="none" style={styles.scrim} />
    <View style={styles.levelChip}><View style={[styles.levelDot, { backgroundColor: levelColors[item.level] }]} /><Text style={styles.levelText}>{LEVEL_LABELS[item.level]}</Text></View>
    <View style={styles.subtitleWrap}><SubtitleLine cues={item.subtitles} forms={item.forms} timeMs={currentTime * 1000} fallback={item.example} /></View>
    <View style={styles.wordPanel}>
      <View style={styles.sourceRow}><Text style={styles.sourceChip}>{item.sourceType === "placeholder" ? "STUDY PLACEHOLDER" : item.sourceType === "ai_generated" ? "AI-GENERATED" : "REAL-LIFE CLIP"}</Text></View>
      <Text style={styles.headword} maxFontSizeMultiplier={1.35}>{item.headword}</Text>
      <Text style={styles.pos}>{item.partOfSpeech}{item.ipa ? ` · ${item.ipa}` : ""}</Text>
      <Text numberOfLines={3} style={styles.definition}>{item.definition}</Text>
      <Text numberOfLines={3} style={styles.example}>{item.example}</Text>
    </View>
    <View style={styles.rail}>
      <RailButton testID="rail-save" icon={item.saved ? "bookmark" : "bookmark-outline"} label={item.saved ? "Saved" : "Save"} active={item.saved} onPress={() => onToggleSave(item)} />
      <RailButton testID="rail-replay" icon="refresh" label="Replay" onPress={() => { maxProgress.current = 0; player.currentTime = 0; safePlay(player); }} />
      <RailButton testID="rail-mute" icon={muted ? "volume-mute" : "volume-high"} label={muted ? "Unmute" : "Mute"} onPress={() => setMuted(!muted)} />
      <RailButton icon="information-circle-outline" label="Info" onPress={() => setInfoOpen(true)} />
    </View>
    <Modal visible={infoOpen} transparent animationType="slide" onRequestClose={() => setInfoOpen(false)}>
      <Pressable accessibilityLabel="Close lesson details" style={styles.modalBackdrop} onPress={() => setInfoOpen(false)}>
        <Pressable style={styles.infoSheet} onPress={(event) => event.stopPropagation?.()}>
          <Text style={styles.infoKicker}>LESSON DETAILS</Text>
          <Text style={styles.infoWord}>{item.headword}</Text>
          <Text style={styles.infoPos}>{item.partOfSpeech}{item.ipa ? ` · ${item.ipa}` : ""}</Text>
          <Text style={styles.infoDefinition}>{item.definition}</Text>
          <Text style={styles.infoExample}>“{item.example}”</Text>
          <View style={styles.licenseBox}><Text style={styles.licenseTitle}>{item.license}</Text><Text style={styles.licenseCopy}>{item.attribution}</Text></View>
          <Button title="Close" onPress={() => setInfoOpen(false)} />
        </Pressable>
      </Pressable>
    </Modal>
  </View>;
}

export function VideoCard(props: Props) {
  if (!props.isNear) return <View style={styles.card}><Image source={{ uri: mediaUrl(props.item.posterUrl) }} style={styles.media} contentFit="cover" /></View>;
  return <PlayerCard {...props} />;
}

const styles = StyleSheet.create({
  card: { flex: 1, height: "100%", backgroundColor: colors.ink, overflow: "hidden" },
  media: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%" },
  hidden: { opacity: 0 },
  tapLayer: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
  playGlyph: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(14,15,19,0.58)", alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.65 },
  loader: { position: "absolute", top: "45%", alignSelf: "center" },
  scrim: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(14,15,19,0.18)" },
  levelChip: { position: "absolute", top: 54, left: 16, flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 999, backgroundColor: "rgba(14,15,19,0.75)", paddingHorizontal: 12, paddingVertical: 8 },
  levelDot: { width: 7, height: 7, borderRadius: 4 },
  levelText: { ...font("600"), color: colors.text, fontSize: 11 },
  subtitleWrap: { position: "absolute", left: 18, right: 18, bottom: 320, alignItems: "center" },
  wordPanel: { position: "absolute", left: 18, right: 86, bottom: 92, gap: 6 },
  sourceRow: { flexDirection: "row", marginBottom: 2 },
  sourceChip: { ...font("600"), color: colors.muted, fontSize: 9, letterSpacing: 0.7 },
  headword: { ...font("800"), color: colors.lime, fontSize: 36, lineHeight: 40, letterSpacing: -0.5 },
  pos: { ...font("500"), color: colors.text, fontSize: 13 },
  definition: { ...font("500"), color: colors.text, fontSize: 17, lineHeight: 23 },
  example: { ...font("400"), color: colors.muted, fontSize: 15, lineHeight: 21, fontStyle: "italic" },
  rail: { position: "absolute", right: 10, bottom: 104, gap: 10 },
  railButton: { width: 54, minHeight: 50, borderRadius: 12, backgroundColor: "rgba(14,15,19,0.66)", alignItems: "center", justifyContent: "center", padding: 4 },
  railLabel: { ...font("500"), color: colors.text, fontSize: 10 },
  errorBox: { position: "absolute", top: "27%", left: 28, right: 28, alignItems: "center", gap: 10, padding: 20, borderRadius: 16, backgroundColor: "rgba(14,15,19,0.88)" },
  errorTitle: { ...font("700"), color: colors.text, fontSize: 20 },
  errorCopy: { ...font("400"), color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: "center" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  infoSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  infoKicker: { ...font("600"), color: colors.lime, fontSize: 11, letterSpacing: 1 },
  infoWord: { ...font("800"), color: colors.text, fontSize: 32 },
  infoPos: { ...font("500"), color: colors.muted, fontSize: 14 },
  infoDefinition: { ...font("500"), color: colors.text, fontSize: 17, lineHeight: 24 },
  infoExample: { ...font("400"), color: colors.muted, fontSize: 16, lineHeight: 23, fontStyle: "italic" },
  licenseBox: { padding: 14, borderRadius: 12, backgroundColor: colors.surface2, gap: 4, marginVertical: 6 },
  licenseTitle: { ...font("600"), color: colors.text, fontSize: 13 },
  licenseCopy: { ...font("400"), color: colors.muted, fontSize: 12, lineHeight: 18 },
});

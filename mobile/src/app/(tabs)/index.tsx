import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { FeedItem, Stats } from "@lingoloop/shared";
import { useAuth } from "../../auth/AuthProvider";
import { ApiError, api } from "../../api/client";
import { enqueueCompletion, flushCompletionQueue } from "../../feed/completionQueue";
import { VideoCard } from "../../feed/VideoCard";
import { FeedPager, type FeedEntry } from "../../feed/FeedPager";
import { LoadingState, EmptyState } from "../../components/States";
import { Button } from "../../components/Button";
import { usePlaybackPrefs } from "../../state/PlaybackPrefs";
import { colors, font } from "../../theme/tokens";

export default function FeedScreen() {
  const { user, stats, refreshMe } = useAuth();
  const userId = user?.id;
  const { muted, setMuted } = usePlaybackPrefs();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(true);
  const [feedHeight, setFeedHeight] = useState(800);
  const [toast, setToast] = useState("");
  const loadingMore = useRef(false);
  const controls = useRef<{ toggle: () => void; replay: () => void } | null>(null);

  const syncCompletions = useCallback(async () => {
    if (!userId) return;
    const result = await flushCompletionQueue(userId);
    if (!result.flushed) return;
    setToast(result.xpAwarded ? `Synced +${result.xpAwarded} XP` : "Progress synced");
    setTimeout(() => setToast(""), 1800);
    await refreshMe();
  }, [refreshMe, userId]);

  const load = useCallback(async (reset = false) => {
    if (!user?.level || loadingMore.current) return;
    loadingMore.current = true;
    if (reset) { setLoading(true); setError(""); setActive(0); }
    try {
      const result = await api<{ items: FeedItem[]; nextCursor: string | null }>(`/api/feed?limit=10&cursor=${reset ? "" : cursor || ""}`);
      setItems((current) => {
        const base = reset ? [] : current;
        const seen = new Set(base.map((item) => item.videoId));
        return [...base, ...result.items.filter((item) => !seen.has(item.videoId))];
      });
      setCursor(result.nextCursor);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load the feed."); }
    finally { setLoading(false); loadingMore.current = false; }
  }, [cursor, user?.level]);

  useEffect(() => { setItems([]); setCursor(null); void load(true); }, [user?.level]); // eslint-disable-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => {
    setFocused(true);
    void syncCompletions();
    return () => setFocused(false);
  }, [syncCompletions]));
  useEffect(() => {
    const timer = setInterval(() => { void syncCompletions(); }, 15000);
    return () => clearInterval(timer);
  }, [syncCompletions]);
  useEffect(() => {
    if (Platform.OS === "web") {
      if (typeof document === "undefined") return;
      const visibility = () => setFocused(!document.hidden);
      document.addEventListener("visibilitychange", visibility);
      return () => document.removeEventListener("visibilitychange", visibility);
    }
    const subscription = AppState.addEventListener("change", (state) => {
      const active = state === "active";
      setFocused(active);
      if (active) void syncCompletions();
    });
    return () => subscription.remove();
  }, [syncCompletions]);

  const activeChange = useCallback((index: number) => {
    setActive(index);
    if (index >= items.length - 3 && cursor && !loadingMore.current) void load();
  }, [cursor, items.length, load]);

  const seen = useCallback((item: FeedItem) => {
    void api("/api/progress/view", { method: "POST", body: JSON.stringify({ videoId: item.videoId, event: "start" }) }).catch(() => {});
  }, []);
  const complete = useCallback(async (item: FeedItem, fallback = false) => {
    try {
      const result = await api<{ xpAwarded: number; stats: Stats }>("/api/progress/view", { method: "POST", body: JSON.stringify({ videoId: item.videoId, event: "complete", fallback }) });
      if (result.xpAwarded) { setToast(`+${result.xpAwarded} XP`); setTimeout(() => setToast(""), 1800); }
      await refreshMe();
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 0 && userId) {
        await enqueueCompletion(userId, item.videoId, fallback);
        setToast("Completion saved — will retry when you are online");
      } else {
        setToast("Could not save this completion");
      }
    }
  }, [refreshMe, userId]);
  const toggleSave = useCallback(async (item: FeedItem) => {
    const previous = item.saved;
    setItems((current) => current.map((entry) => entry.vocabId === item.vocabId ? { ...entry, saved: !previous } : entry));
    try {
      await api(`/api/saved/${item.vocabId}`, { method: previous ? "DELETE" : "PUT" });
      setToast(previous ? "Removed from saved words" : "Word saved");
      setTimeout(() => setToast(""), 1400);
      await refreshMe();
    } catch {
      setItems((current) => current.map((entry) => entry.vocabId === item.vocabId ? { ...entry, saved: previous } : entry));
      setToast("Could not update saved words");
    }
  }, [refreshMe]);

  const entries: FeedEntry[] = [...items.map((item) => ({ kind: "video" as const, item })), ...(cursor === null && items.length ? [{ kind: "end" as const }] : [])];
  const current = items[active];
  function command(action: "play" | "mute" | "save" | "replay") {
    if (action === "play") controls.current?.toggle();
    else if (action === "replay") controls.current?.replay();
    else if (action === "mute") setMuted(!muted);
    else if (action === "save" && current) void toggleSave(current);
  }

  if (loading && !items.length) return <LoadingState label="Preparing your first words…" />;
  if (error && !items.length) return <EmptyState icon="cloud-offline-outline" title="Couldn’t load your lessons" copy={error} action="Try again" onAction={() => void load(true)} />;
  if (!items.length) return <EmptyState icon="videocam-outline" title="New clips are on the way" copy="There is no published content at this level yet. Try another level in Profile." action="Choose level" onAction={() => router.push("/(tabs)/profile")} />;

  return <View style={styles.root} onLayout={(event) => setFeedHeight(event.nativeEvent.layout.height)}>
    <View style={styles.feedColumn}>
      <FeedPager
        items={entries}
        height={feedHeight}
        onActiveChange={activeChange}
        onCommand={command}
        renderItem={(entry, state) => entry.kind === "end" ? <View style={styles.endCard}>
          <Ionicons name="checkmark-circle" size={46} color={colors.lime} />
          <Text style={styles.endTitle}>You reached the end.</Text>
          <Text style={styles.endCopy}>Review your words in a quiz, or start the library again.</Text>
          <Button title="Take a quiz" onPress={() => router.push("/(tabs)/quiz")} />
          <Button title="Change level" variant="secondary" onPress={() => router.push("/(tabs)/profile")} />
          <Button title="Start over" variant="ghost" onPress={() => { setItems([]); setCursor(null); void load(true); }} />
        </View> : <VideoCard
          item={entry.item}
          index={active}
          isActive={focused && state.isActive}
          isNear={state.isNear}
          onSeen={seen}
          onComplete={complete}
          onToggleSave={toggleSave}
          registerControls={state.isActive ? (value) => { controls.current = value; } : undefined}
        />}
      />
      <View style={styles.stats} pointerEvents="none"><Text style={styles.statChip}>🔥 {stats?.streakCurrent || 0}</Text><Text style={styles.statChip}>+{stats?.xpToday || 0} XP</Text></View>
      {toast ? <View accessibilityLiveRegion="polite" style={styles.toast}><Text style={styles.toastText}>{toast}</Text></View> : null}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  feedColumn: { flex: 1, width: "100%", maxWidth: 480, alignSelf: "center", backgroundColor: colors.ink, overflow: "hidden" },
  stats: { position: "absolute", top: 54, right: 16, flexDirection: "row", gap: 6 },
  statChip: { ...font("600"), color: colors.text, backgroundColor: "rgba(14,15,19,0.75)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8, fontSize: 11, overflow: "hidden" },
  toast: { position: "absolute", top: 105, alignSelf: "center", backgroundColor: colors.lime, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  toastText: { ...font("800"), color: colors.ink, fontSize: 14 },
  endCard: { flex: 1, height: "100%", alignItems: "center", justifyContent: "center", padding: 30, gap: 15, backgroundColor: colors.ink },
  endTitle: { ...font("800"), color: colors.text, fontSize: 26, textAlign: "center" },
  endCopy: { ...font("400"), color: colors.muted, fontSize: 16, lineHeight: 23, textAlign: "center", marginBottom: 8 },
});

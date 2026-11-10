import React, { useCallback, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { Level } from "@lingoloop/shared";
import { useAuth } from "../../auth/AuthProvider";
import { Screen } from "../../components/Screen";
import { LevelPicker } from "../../components/LevelPicker";
import { Button } from "../../components/Button";
import { colors, font } from "../../theme/tokens";

function Tile({ icon, value, label, accent = colors.lime }: { icon: string; value: string | number; label: string; accent?: string }) {
  return <View style={styles.tile}><Ionicons name={icon as any} size={22} color={accent} /><Text testID={label === "Total XP" ? "profile-xp" : undefined} style={styles.tileValue}>{value}</Text><Text style={styles.tileLabel}>{label}</Text></View>;
}
export default function ProfileScreen() {
  const { user, stats, setLevel, signOut, refreshMe } = useAuth();
  const [busy, setBusy] = useState(false);
  useFocusEffect(useCallback(() => { void refreshMe(); }, [refreshMe]));
  async function change(level: Level) { if (level === user?.level || busy) return; setBusy(true); try { await setLevel(level); } finally { setBusy(false); } }
  const maxXp = Math.max(1, ...(stats?.last7Days.map((day) => day.xp) || [1]));
  return <Screen title={`Keep it up${user?.displayName ? `, ${user.displayName}` : ""}.`} subtitle={user?.email}>
    <View style={styles.grid}>
      <Tile icon="flash-outline" value={stats?.xpTotal || 0} label="Total XP" />
      <Tile icon="flame-outline" value={`${stats?.streakCurrent || 0} days`} label="Current streak" accent={colors.coral} />
      <Tile icon="book-outline" value={stats?.wordsLearned || 0} label="Words learned" />
      <Tile icon="checkmark-done-outline" value={`${stats?.quizAccuracy || 0}%`} label="Quiz accuracy" accent={colors.success} />
    </View>
    <View style={styles.section}>
      <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Last 7 days</Text><Text style={styles.sectionMeta}>Best streak · {stats?.streakBest || 0} days</Text></View>
      <View style={styles.chart}>{stats?.last7Days.map((day) => <View key={day.date} style={styles.barColumn}><View style={styles.barTrack}><View style={[styles.bar, { height: Math.max(4, day.xp / maxXp * 90) }]} /></View><Text style={styles.barLabel}>{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2)}</Text></View>)}</View>
    </View>
    <View style={styles.section}><Text style={styles.sectionTitle}>Your level</Text><LevelPicker compact value={user?.level} onChange={(level) => void change(level)} /></View>
    <View style={styles.section}><View style={styles.inlineStats}><Text style={styles.inlineStat}>{stats?.wordsSaved || 0} saved</Text><Text style={styles.inlineStat}>{stats?.quizzesCompleted || 0} quizzes completed</Text></View></View>
    {user?.role === "admin" && Platform.OS === "web" && <Button title="Open content admin" variant="secondary" onPress={() => router.push("/admin")} />}
    <Button title="Sign out" variant="danger" onPress={() => { void signOut().then(() => router.replace("/welcome")); }} />
  </Screen>;
}
const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: { flex: 1, minWidth: 130, minHeight: 126, padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: 5 },
  tileValue: { ...font("800"), color: colors.text, fontSize: 25, letterSpacing: -0.5 },
  tileLabel: { ...font("500"), color: colors.muted, fontSize: 12 },
  section: { padding: 16, borderRadius: 16, backgroundColor: colors.surface, gap: 16 },
  sectionHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  sectionTitle: { ...font("700"), color: colors.text, fontSize: 17 },
  sectionMeta: { ...font("500"), color: colors.muted, fontSize: 12 },
  chart: { height: 120, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8 },
  barColumn: { flex: 1, alignItems: "center", gap: 6 },
  barTrack: { height: 96, width: "70%", justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 4, backgroundColor: colors.lime },
  barLabel: { ...font("500"), color: colors.muted, fontSize: 11 },
  inlineStats: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  inlineStat: { ...font("500"), color: colors.muted, fontSize: 13 },
});

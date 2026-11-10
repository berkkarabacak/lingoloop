import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, font } from "../theme/tokens";
import { Button } from "./Button";

export function LoadingState({ label = "Loading your learning space…" }: { label?: string }) {
  return <View style={styles.container}><ActivityIndicator color={colors.lime} size="large" /><Text style={styles.copy}>{label}</Text></View>;
}
export function EmptyState({ icon = "book-outline", title, copy, action, onAction }: { icon?: string; title: string; copy: string; action?: string; onAction?: () => void }) {
  return <View style={styles.container}><Ionicons name={icon as any} size={34} color={colors.lime} /><Text style={styles.title}>{title}</Text><Text style={styles.copy}>{copy}</Text>{action && onAction && <Button title={action} onPress={onAction} variant="secondary" />}</View>;
}
const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 260, alignItems: "center", justifyContent: "center", padding: 28, gap: 14 },
  title: { ...font("700"), color: colors.text, fontSize: 20, textAlign: "center" },
  copy: { ...font("400"), color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center", maxWidth: 440 },
});

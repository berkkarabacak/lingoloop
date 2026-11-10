import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, font } from "../theme/tokens";

export function Screen({ title, subtitle, children, scroll = true }: { title: string; subtitle?: string; children: React.ReactNode; scroll?: boolean }) {
  const content = <View style={styles.content}>
    <View style={styles.heading}><Text style={styles.title}>{title}</Text>{subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}</View>
    {children}
  </View>;
  return <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
    {scroll ? <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">{content}</ScrollView> : content}
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  scroll: { flexGrow: 1 },
  content: { flex: 1, width: "100%", maxWidth: 920, alignSelf: "center", padding: 20, gap: 20 },
  heading: { gap: 5 },
  title: { ...font("800"), color: colors.text, fontSize: 30, letterSpacing: -0.6 },
  subtitle: { ...font("400"), color: colors.muted, fontSize: 15, lineHeight: 22 },
});

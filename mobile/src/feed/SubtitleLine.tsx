import React from "react";
import { StyleSheet, Text } from "react-native";
import { activeCue, splitHighlight, type Cue } from "@lingoloop/shared";
import { colors, font } from "../theme/tokens";

export function SubtitleLine({ cues, forms, timeMs, fallback }: { cues: Cue[]; forms: string[]; timeMs: number; fallback: string }) {
  const text = activeCue(cues, timeMs)?.text || fallback;
  return <Text accessibilityLabel={`Subtitle: ${text}`} style={styles.subtitle} maxFontSizeMultiplier={1.35}>
    {splitHighlight(text, forms).map((part, index) => <Text key={index} style={part.hit ? styles.hit : undefined}>{part.text}</Text>)}
  </Text>;
}
const styles = StyleSheet.create({
  subtitle: { ...font("700"), color: colors.text, fontSize: 20, lineHeight: 28, textAlign: "center", backgroundColor: "rgba(0,0,0,0.58)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, overflow: "hidden" },
  hit: { color: colors.lime, backgroundColor: "rgba(14,15,19,0.7)" },
});

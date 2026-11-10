import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Level } from "@lingoloop/shared";
import { LEVELS, LEVEL_LABELS } from "@lingoloop/shared";
import { colors, font, levelColors } from "../theme/tokens";

const samples: Record<Level, string> = {
  beginner: "hungry · borrow · on my way",
  intermediate: "figure out · worth it · catch up",
  advanced: "nuanced · ubiquitous · cut corners",
};
export function LevelPicker({ value, onChange, compact = false }: { value?: Level | null; onChange: (level: Level) => void; compact?: boolean }) {
  return <View style={styles.list}>{LEVELS.map((level) => <Pressable
    key={level}
    testID={`level-${level}`}
    accessibilityRole="button"
    accessibilityLabel={LEVEL_LABELS[level]}
    accessibilityState={{ selected: value === level }}
    onPress={() => onChange(level)}
    style={({ pressed }) => [styles.card, compact && styles.compact, { borderColor: value === level ? levelColors[level] : colors.line }, pressed && styles.pressed]}
  >
    <View style={[styles.swatch, { backgroundColor: levelColors[level] }]} />
    <Text style={styles.name}>{LEVEL_LABELS[level]}</Text>
    <Text style={styles.samples}>{samples[level]}</Text>
  </Pressable>)}</View>;
}
const styles = StyleSheet.create({
  list: { gap: 12 },
  card: { minHeight: 108, padding: 18, borderRadius: 16, borderWidth: 2, backgroundColor: colors.surface, gap: 6, overflow: "hidden" },
  compact: { minHeight: 88, padding: 14 },
  pressed: { opacity: 0.8 },
  swatch: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  name: { ...font("700"), color: colors.text, fontSize: 18 },
  samples: { ...font("400"), color: colors.muted, fontSize: 14, lineHeight: 20 },
});

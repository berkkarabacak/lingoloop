import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { colors, font } from "../theme/tokens";

export function Button({ title, onPress, variant = "primary", disabled, loading, style, accessibilityLabel, testID }: {
  title: string;
  testID?: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  return <Pressable
    testID={testID}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel || title}
    accessibilityState={{ disabled: disabled || loading }}
    disabled={disabled || loading}
    onPress={onPress}
    style={({ pressed }) => [styles.base, styles[variant], pressed && styles.pressed, (disabled || loading) && styles.disabled, style]}
  >
    {loading ? <ActivityIndicator color={variant === "primary" ? colors.ink : colors.text} /> : <Text style={[styles.label, styles[`${variant}Label` as const]]}>{title}</Text>}
  </Pressable>;
}
const styles = StyleSheet.create({
  base: { minHeight: 48, borderRadius: 12, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  primary: { backgroundColor: colors.lime, borderColor: colors.lime },
  secondary: { backgroundColor: colors.surface2, borderColor: colors.line },
  danger: { backgroundColor: "transparent", borderColor: colors.danger },
  ghost: { backgroundColor: "transparent", borderColor: "transparent" },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.985 }] },
  label: { ...font("700"), fontSize: 15 },
  primaryLabel: { color: colors.ink },
  secondaryLabel: { color: colors.text },
  dangerLabel: { color: colors.danger },
  ghostLabel: { color: colors.lime },
});

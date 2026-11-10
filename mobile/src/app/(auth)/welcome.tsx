import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../auth/AuthProvider";
import { Button } from "../../components/Button";
import { colors, font } from "../../theme/tokens";

export default function Welcome() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) { setError("Enter a valid email and at least 8 password characters."); return; }
    setBusy(true);
    try {
      await (mode === "signup" ? signUp : signIn)(email.trim(), password);
      router.replace("/(tabs)");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not sign in."); }
    finally { setBusy(false); }
  }
  return <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <View style={styles.container}>
      <View style={styles.brand}><View style={styles.logo}><Ionicons name="infinite" size={32} color={colors.lime} /></View><Text style={styles.wordmark}>Lingo<Text style={styles.accent}>Loop</Text></Text></View>
      <Text style={styles.hero}>Every swipe.<Text style={styles.accent}> One new word.</Text></Text>
      <Text style={styles.subhero}>Short contextual clips turn endless scrolling into an English learning habit.</Text>
      <View style={styles.segmented}>
        {(["signup", "login"] as const).map((item) => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: mode === item }} onPress={() => setMode(item)} style={[styles.segment, mode === item && styles.segmentActive]}><Text style={[styles.segmentText, mode === item && styles.segmentTextActive]}>{item === "signup" ? "Create account" : "Sign in"}</Text></Pressable>)}
      </View>
      <View style={styles.form}>
        <Text style={styles.label}>Email</Text>
        <TextInput testID="welcome-email" accessibilityLabel="Email" style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="you@example.com" placeholderTextColor={colors.muted} />
        <Text style={styles.label}>Password</Text>
        <TextInput testID="welcome-password" accessibilityLabel="Password" style={styles.input} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" placeholder="At least 8 characters" placeholderTextColor={colors.muted} onSubmitEditing={() => void submit()} />
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Button testID="welcome-submit" title={mode === "signup" ? "Create my learning space" : "Continue learning"} onPress={() => void submit()} loading={busy} />
        <Pressable accessibilityRole="button" onPress={() => { setMode("login"); setEmail("demo@lingoloop.local"); setPassword("learn123"); }} style={styles.demo}><Text style={styles.demoText}>Use the demo learner account</Text></Pressable>
      </View>
      <Text style={styles.note}>Email sign-in for the local MVP. Progress syncs through the LingoLoop backend.</Text>
    </View>
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  container: { flex: 1, width: "100%", maxWidth: 480, alignSelf: "center", justifyContent: "center", padding: 24, gap: 18 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" },
  wordmark: { ...font("800"), color: colors.text, fontSize: 25, letterSpacing: -0.7 },
  accent: { color: colors.lime },
  hero: { ...font("800"), color: colors.text, fontSize: 38, lineHeight: 43, letterSpacing: -1.2, marginTop: 12 },
  subhero: { ...font("400"), color: colors.muted, fontSize: 17, lineHeight: 25, maxWidth: 420, marginBottom: 8 },
  segmented: { flexDirection: "row", padding: 4, borderRadius: 12, backgroundColor: colors.surface },
  segment: { flex: 1, minHeight: 44, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  segmentActive: { backgroundColor: colors.surface2 },
  segmentText: { ...font("600"), color: colors.muted, fontSize: 14 },
  segmentTextActive: { color: colors.text },
  form: { gap: 10 },
  label: { ...font("600"), color: colors.text, fontSize: 13, marginTop: 4 },
  input: { minHeight: 52, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 15, fontSize: 16, outlineStyle: "solid", outlineWidth: 0 },
  error: { ...font("500"), color: colors.danger, fontSize: 14, lineHeight: 20 },
  demo: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  demoText: { ...font("600"), color: colors.lime, fontSize: 14 },
  note: { ...font("400"), color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
});

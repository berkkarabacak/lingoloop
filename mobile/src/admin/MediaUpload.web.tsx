import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../api/client";
import { Button } from "../components/Button";
import { colors, font } from "../theme/tokens";

export default function MediaUpload({ onUploaded }: { onUploaded: (kind: "video" | "poster", url: string) => void }) {
  const [slug, setSlug] = useState("");
  const [kind, setKind] = useState<"video" | "poster">("video");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function upload() {
    if (!file || !slug) { setMessage("Choose a file and enter its content slug."); return; }
    setBusy(true); setMessage("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("slug", slug);
      form.append("kind", kind);
      const result = await api<{ url: string }>("/api/admin/media", { method: "POST", body: form });
      onUploaded(kind, result.url);
      setMessage(`Uploaded ${result.url}`);
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Upload failed."); }
    finally { setBusy(false); }
  }
  return <View style={styles.container}>
    <Text style={styles.title}>Media upload</Text>
    <TextInput accessibilityLabel="Media slug" style={styles.input} value={slug} onChangeText={setSlug} placeholder="content-slug" placeholderTextColor={colors.muted} autoCapitalize="none" />
    <View style={styles.row}><Button title={kind === "video" ? "MP4 video" : "Poster image"} variant="secondary" onPress={() => setKind(kind === "video" ? "poster" : "video")} /><input aria-label="Choose media file" type="file" accept={kind === "video" ? "video/mp4" : "image/jpeg,image/png,image/webp"} onChange={(event) => setFile(event.target.files?.[0] || null)} /></View>
    <Button title="Upload media" onPress={() => void upload()} loading={busy} />
    {message ? <Text style={styles.message}>{message}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  container: { padding: 16, borderRadius: 16, backgroundColor: colors.surface, gap: 12 },
  title: { ...font("700"), color: colors.text, fontSize: 17 },
  input: { minHeight: 46, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.ink, color: colors.text, paddingHorizontal: 12, outlineStyle: "solid", outlineWidth: 0 },
  row: { gap: 12 },
  message: { ...font("400"), color: colors.muted, fontSize: 13, lineHeight: 19 },
});

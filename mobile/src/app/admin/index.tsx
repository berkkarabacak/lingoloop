import React, { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ContentItemInput } from "@lingoloop/shared";
import { useAuth } from "../../auth/AuthProvider";
import { api } from "../../api/client";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { EmptyState, LoadingState } from "../../components/States";
import MediaUpload from "../../admin/MediaUpload";
import { colors, font, levelColors } from "../../theme/tokens";

const template: ContentItemInput = {
  slug: "new-expression", headword: "new expression", forms: ["new expression"], partOfSpeech: "expression",
  ipa: null, definition: "Replace this with a concise learner-friendly definition.", example: "This new expression belongs in a real sentence.",
  level: "intermediate", translations: {}, status: "draft", sortOrder: 99,
  video: { url: "/media/clips/new-expression.mp4", poster: "/media/posters/new-expression.jpg", durationMs: 8000,
    subtitles: [{ startMs: 500, endMs: 7500, text: "This new expression belongs in a real sentence." }],
    sourceType: "real", license: "Owned", attribution: "Add the creator and license details here.", sourceUrl: null },
};

type AdminItem = ContentItemInput & { publishIssues: string[] };
export default function AdminScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<AdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState("");
  const [editor, setEditor] = useState(JSON.stringify(template, null, 2));
  const [importText, setImportText] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try { const result = await api<{ items: AdminItem[] }>("/api/admin/content"); setItems(result.items); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Could not load content."); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (user?.role === "admin") void load(); }, [user?.role]);
  if (Platform.OS !== "web") return <EmptyState title="Web-only content studio" copy="Open LingoLoop in a browser to manage the content library." />;
  if (user?.role !== "admin") return <EmptyState icon="lock-closed-outline" title="Administrator access required" copy="Sign in with a curator account. The server also protects every admin route." />;
  if (loading) return <LoadingState label="Opening the content studio…" />;

  function edit(item: AdminItem) {
    setSelected(item.slug);
    const { publishIssues, ...content } = item;
    setEditor(JSON.stringify(content, null, 2));
    setMessage("");
  }
  async function save() {
    setBusy(true); setMessage("");
    try {
      const item = JSON.parse(editor) as ContentItemInput;
      const result = await api<{ publishIssues: string[]; status: string }>(`/api/admin/content/${item.slug}`, { method: "PUT", body: JSON.stringify(item) });
      setMessage(result.publishIssues.length ? `Saved as draft. ${result.publishIssues.join(" ")}` : "Content saved and ready to publish.");
      await load();
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Invalid content JSON."); }
    finally { setBusy(false); }
  }
  async function setStatus(item: AdminItem, status: "draft" | "published" | "archived") {
    try { await api(`/api/admin/content/${item.slug}/status`, { method: "POST", body: JSON.stringify({ status }) }); await load(); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Could not update status."); }
  }
  async function importItems(dryRun: boolean) {
    setBusy(true); setMessage("");
    try {
      const items = JSON.parse(importText);
      const result = await api<{ created: number; updated: number; drafted: number; errors: { slug: string; issues: string[] }[] }>(`/api/admin/import${dryRun ? "?dryRun=1" : ""}`, { method: "POST", body: JSON.stringify(items) });
      setMessage(`${dryRun ? "Dry run" : "Import"}: ${result.created} created, ${result.updated} updated, ${result.drafted} drafted. ${result.errors.map((error) => `${error.slug}: ${error.issues.join(" ")}`).join(" ")}`);
      if (!dryRun) await load();
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Import JSON is invalid."); }
    finally { setBusy(false); }
  }
  async function exportItems() {
    const data = await api<ContentItemInput[]>("/api/admin/export");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "lingoloop-content.json"; link.click(); URL.revokeObjectURL(link.href);
  }
  function uploaded(kind: "video" | "poster", url: string) {
    try {
      const item = JSON.parse(editor);
      item.video[kind === "video" ? "url" : "poster"] = url;
      setEditor(JSON.stringify(item, null, 2));
    } catch { setMessage("Fix the editor JSON before adding the uploaded URL."); }
  }

  return <Screen title="Content studio" subtitle="Curate, validate, import, and publish the learning library without changing application code.">
    <View style={styles.toolbar}><Button title="New item" onPress={() => { setSelected(""); setEditor(JSON.stringify(template, null, 2)); }} /><Button title="Export library" variant="secondary" onPress={() => void exportItems()} /></View>
    <View style={styles.list}>{items.map((item) => <View key={item.slug} style={styles.row}>
      <Pressable onPress={() => edit(item)} style={styles.rowMain} accessibilityRole="button" accessibilityLabel={`Edit ${item.headword}`}><View style={styles.rowTitle}><View style={[styles.dot, { backgroundColor: levelColors[item.level] }]} /><Text style={styles.headword}>{item.headword}</Text><Text style={[styles.status, item.status === "published" ? styles.published : undefined]}>{item.status}</Text></View><Text style={styles.slug}>{item.slug} · {item.level}</Text>{!!item.publishIssues.length && <Text style={styles.issue}>{item.publishIssues.length} publishing issue{item.publishIssues.length === 1 ? "" : "s"}</Text>}</Pressable>
      <Button testID={`admin-status-${item.slug}`} title={item.status === "published" ? "Unpublish" : "Publish"} variant="secondary" onPress={() => void setStatus(item, item.status === "published" ? "draft" : "published")} />
    </View>)}</View>
    <View style={styles.editorSection}><Text style={styles.sectionTitle}>{selected ? `Editing ${selected}` : "New content item"}</Text><Text style={styles.hint}>Edit metadata and subtitle cues as JSON. Upload media first, then save and publish.</Text><TextInput accessibilityLabel="Content JSON editor" multiline value={editor} onChangeText={setEditor} style={styles.editor} autoCapitalize="none" autoCorrect={false} /><Button title="Save content item" onPress={() => void save()} loading={busy} /></View>
    <MediaUpload onUploaded={uploaded} />
    <View style={styles.editorSection}><Text style={styles.sectionTitle}>Bulk JSON import</Text><TextInput accessibilityLabel="Bulk JSON import" multiline value={importText} onChangeText={setImportText} placeholder="Paste an array of content items" placeholderTextColor={colors.muted} style={styles.importBox} autoCapitalize="none" autoCorrect={false} /><View style={styles.toolbar}><Button title="Dry run" variant="secondary" disabled={!importText.trim()} onPress={() => void importItems(true)} /><Button title="Import" disabled={!importText.trim()} onPress={() => void importItems(false)} /></View></View>
    {message ? <Text accessibilityRole="status" style={styles.message}>{message}</Text> : null}
  </Screen>;
}
const styles = StyleSheet.create({
  toolbar: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  list: { gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  rowMain: { flex: 1, gap: 5 },
  rowTitle: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  headword: { ...font("700"), color: colors.text, fontSize: 16 },
  slug: { ...font("400"), color: colors.muted, fontSize: 12 },
  status: { ...font("600"), color: colors.muted, fontSize: 10, textTransform: "uppercase" },
  published: { color: colors.success },
  issue: { ...font("500"), color: colors.coral, fontSize: 11 },
  editorSection: { padding: 16, borderRadius: 16, backgroundColor: colors.surface, gap: 12 },
  sectionTitle: { ...font("700"), color: colors.text, fontSize: 18 },
  hint: { ...font("400"), color: colors.muted, fontSize: 13, lineHeight: 19 },
  editor: { minHeight: 420, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.ink, color: colors.text, padding: 14, fontFamily: "monospace", fontSize: 12, lineHeight: 18, textAlignVertical: "top", outlineStyle: "solid", outlineWidth: 0 },
  importBox: { minHeight: 160, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.ink, color: colors.text, padding: 14, fontFamily: "monospace", fontSize: 12, textAlignVertical: "top", outlineStyle: "solid", outlineWidth: 0 },
  message: { ...font("500"), color: colors.lime, fontSize: 14, lineHeight: 21 },
});

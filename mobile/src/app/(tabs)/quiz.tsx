import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { QuizQuestion } from "@lingoloop/shared";
import { api, ApiError } from "../../api/client";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { EmptyState, LoadingState } from "../../components/States";
import { useAuth } from "../../auth/AuthProvider";
import { colors, font } from "../../theme/tokens";

interface Feedback { correct: boolean; correctOptionId: string; xpAwarded: number; word: { headword: string; definition: string } }
export default function QuizScreen() {
  const { refreshMe } = useAuth();
  const [quizId, setQuizId] = useState("");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "playing" | "locked" | "result" | "error">("idle");
  const [result, setResult] = useState<{ score: number; total: number; xpAwarded: number } | null>(null);
  const [error, setError] = useState("");

  const start = useCallback(async () => {
    setStatus("loading"); setError(""); setCurrent(0); setSelected(null); setFeedback(null); setResult(null);
    try {
      const response = await api<{ id: string; questions: QuizQuestion[] }>("/api/quizzes", { method: "POST" });
      setQuizId(response.id); setQuestions(response.questions); setStatus("playing");
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === "NOT_ENOUGH_WORDS") { setError(reason.message); setStatus("locked"); }
      else { setError(reason instanceof Error ? reason.message : "Could not create a quiz."); setStatus("error"); }
    }
  }, []);
  useEffect(() => { void start(); }, [start]);

  async function answer(optionId: string) {
    if (feedback) return;
    setSelected(optionId);
    try {
      const response = await api<Feedback>(`/api/quizzes/${quizId}/answers`, { method: "POST", body: JSON.stringify({ index: current, optionId }) });
      setFeedback(response);
      await refreshMe();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save the answer."); }
  }
  async function next() {
    if (current < questions.length - 1) { setCurrent((value) => value + 1); setSelected(null); setFeedback(null); return; }
    const response = await api<{ score: number; total: number; xpAwarded: number }>(`/api/quizzes/${quizId}/complete`, { method: "POST" });
    setResult(response); setStatus("result"); await refreshMe();
  }
  if (status === "loading" || status === "idle") return <LoadingState label="Building a quiz from your learned words…" />;
  if (status === "locked") return <Screen title="Quiz locked"><EmptyState icon="lock-closed-outline" title="Learn four words to unlock" copy={`${error} Completed clips count immediately; you do not need to save them.`} action="Back to lessons" onAction={() => router.push("/(tabs)")} /></Screen>;
  if (status === "error") return <Screen title="Quiz"><EmptyState icon="cloud-offline-outline" title="Couldn’t start this quiz" copy={error} action="Try again" onAction={() => void start()} /></Screen>;
  if (status === "result" && result) return <Screen title="Session complete" subtitle="Every answer helps the next review feel easier.">
    <View style={styles.resultCard}><Ionicons name="trophy-outline" size={42} color={colors.lime} /><Text style={styles.resultScore} testID="quiz-result-score">{result.score}/{result.total}</Text><Text style={styles.resultCopy}>Correct answers</Text><Text style={styles.xp}>+{result.xpAwarded} completion XP</Text></View>
    <Button title="Start another quiz" onPress={() => void start()} />
    <Button title="Back to lessons" variant="secondary" onPress={() => router.push("/(tabs)")} />
  </Screen>;

  const question = questions[current];
  if (!question) return null;
  return <Screen title="Quick check" subtitle={`Question ${current + 1} of ${questions.length}`}>
    <View style={styles.dots}>{questions.map((_, index) => <View key={index} style={[styles.dot, index <= current && styles.dotActive]} />)}</View>
    <View style={styles.promptCard}><Text style={styles.kicker}>{question.type === "meaning" ? "VOCABULARY" : "IN CONTEXT"}</Text><Text style={styles.prompt}>{question.prompt}</Text></View>
    <View style={styles.options}>{question.options.map((option) => {
      const correct = feedback && option.id === feedback.correctOptionId;
      const wrong = feedback && option.id === selected && !feedback.correct;
      return <Button key={option.id} testID={`quiz-option-${option.id}`} title={option.text} disabled={Boolean(feedback)} onPress={() => void answer(option.id)} variant="secondary" style={[styles.option, correct && styles.correct, wrong && styles.wrong]} />;
    })}</View>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {feedback && <View style={[styles.feedback, { borderColor: feedback.correct ? colors.success : colors.danger }]}>
      <Ionicons name={feedback.correct ? "checkmark-circle" : "close-circle"} size={24} color={feedback.correct ? colors.success : colors.danger} />
      <View style={styles.feedbackCopy}><Text style={styles.feedbackTitle}>{feedback.correct ? `Correct · +${feedback.xpAwarded} XP` : "Not quite"}</Text><Text style={styles.feedbackText}><Text style={styles.feedbackWord}>{feedback.word.headword}</Text> — {feedback.word.definition}</Text></View>
      <Button title={current === questions.length - 1 ? "See results" : "Next"} onPress={() => void next()} />
    </View>}
  </Screen>;
}
const styles = StyleSheet.create({
  dots: { flexDirection: "row", gap: 6 },
  dot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.line },
  dotActive: { backgroundColor: colors.lime },
  promptCard: { padding: 22, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: 12 },
  kicker: { ...font("700"), color: colors.lime, fontSize: 11, letterSpacing: 1 },
  prompt: { ...font("700"), color: colors.text, fontSize: 23, lineHeight: 31 },
  options: { gap: 10 },
  option: { alignItems: "flex-start", minHeight: 58 },
  correct: { backgroundColor: "#163A2C", borderColor: colors.success },
  wrong: { backgroundColor: "#3A1C28", borderColor: colors.danger },
  feedback: { padding: 16, borderRadius: 16, borderWidth: 1, backgroundColor: colors.surface, gap: 12 },
  feedbackCopy: { gap: 4 },
  feedbackTitle: { ...font("700"), color: colors.text, fontSize: 17 },
  feedbackText: { ...font("400"), color: colors.muted, fontSize: 14, lineHeight: 20 },
  feedbackWord: { color: colors.text, fontWeight: "700" },
  error: { ...font("500"), color: colors.danger, fontSize: 14 },
  resultCard: { padding: 32, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", gap: 8 },
  resultScore: { ...font("800"), color: colors.text, fontSize: 56, letterSpacing: -2 },
  resultCopy: { ...font("500"), color: colors.muted, fontSize: 16 },
  xp: { ...font("700"), color: colors.lime, fontSize: 18, marginTop: 8 },
});

import React, { useState } from "react";
import type { Level } from "@lingoloop/shared";
import { router } from "expo-router";
import { useAuth } from "../../auth/AuthProvider";
import { Screen } from "../../components/Screen";
import { LevelPicker } from "../../components/LevelPicker";

export default function LevelScreen() {
  const { setLevel } = useAuth();
  const [busy, setBusy] = useState(false);
  async function choose(level: Level) {
    if (busy) return;
    setBusy(true);
    try { await setLevel(level); router.replace("/(tabs)"); } finally { setBusy(false); }
  }
  return <Screen title="Where should we start?" subtitle="Choose the vocabulary that feels right today. You can change your level anytime in Profile.">
    <LevelPicker onChange={(level) => void choose(level)} />
  </Screen>;
}

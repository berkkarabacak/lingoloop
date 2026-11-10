import React, { createContext, useContext, useMemo, useState } from "react";
import { Platform } from "react-native";

const PlaybackContext = createContext<{ muted: boolean; setMuted: (value: boolean) => void } | null>(null);
export function PlaybackPrefsProvider({ children }: { children: React.ReactNode }) {
  const [muted, setMuted] = useState(Platform.OS === "web");
  const value = useMemo(() => ({ muted, setMuted }), [muted]);
  return <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>;
}
export function usePlaybackPrefs() {
  const value = useContext(PlaybackContext);
  if (!value) throw new Error("Playback preferences are unavailable");
  return value;
}

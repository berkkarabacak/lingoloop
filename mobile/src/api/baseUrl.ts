import Constants from "expo-constants";
import { Platform } from "react-native";

export function apiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, "");
  if (Platform.OS === "web" && typeof window !== "undefined") return `${window.location.protocol}//${window.location.hostname}:4000`;
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  return host ? `http://${host}:4000` : "http://127.0.0.1:4000";
}

export function mediaUrl(value: string): string {
  return /^https?:\/\//.test(value) ? value : `${apiBaseUrl()}${value}`;
}

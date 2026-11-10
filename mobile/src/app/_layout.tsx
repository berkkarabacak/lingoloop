import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../auth/AuthProvider";
import { PlaybackPrefsProvider } from "../state/PlaybackPrefs";
import { colors } from "../theme/tokens";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 15000 } } });
export default function RootLayout() {
  return <SafeAreaProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PlaybackPrefsProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ink } }} />
        </PlaybackPrefsProvider>
      </AuthProvider>
    </QueryClientProvider>
  </SafeAreaProvider>;
}

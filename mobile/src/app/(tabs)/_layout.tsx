import React from "react";
import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../auth/AuthProvider";
import { LoadingState } from "../../components/States";
import { colors, font } from "../../theme/tokens";

export default function TabsLayout() {
  const { status, user } = useAuth();
  if (status === "loading") return <LoadingState />;
  if (status === "signedOut") return <Redirect href="/welcome" />;
  if (!user?.level) return <Redirect href="/level" />;
  return <Tabs screenOptions={{
    headerShown: false,
    tabBarActiveTintColor: colors.lime,
    tabBarInactiveTintColor: colors.muted,
    tabBarLabelStyle: { ...font("600"), fontSize: 11 },
    tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line, height: 68, paddingBottom: 8, paddingTop: 6 },
  }}>
    <Tabs.Screen name="index" options={{ title: "Learn", tabBarIcon: ({ color, size }) => <Ionicons name="play-circle-outline" color={(color ?? colors.muted) as string} size={size} /> }} />
    <Tabs.Screen name="quiz" options={{ title: "Quiz", tabBarIcon: ({ color, size }) => <Ionicons name="help-circle-outline" color={(color ?? colors.muted) as string} size={size} /> }} />
    <Tabs.Screen name="saved" options={{ title: "Saved", tabBarIcon: ({ color, size }) => <Ionicons name="bookmark-outline" color={(color ?? colors.muted) as string} size={size} /> }} />
    <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={(color ?? colors.muted) as string} size={size} /> }} />
  </Tabs>;
}

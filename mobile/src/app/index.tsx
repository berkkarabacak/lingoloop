import React from "react";
import { Redirect } from "expo-router";
import { LoadingState } from "../components/States";
import { useAuth } from "../auth/AuthProvider";

export default function Index() {
  const { status, user } = useAuth();
  if (status === "loading") return <LoadingState />;
  if (status === "signedOut") return <Redirect href="/welcome" />;
  if (!user?.level) return <Redirect href="/level" />;
  return <Redirect href="/(tabs)" />;
}

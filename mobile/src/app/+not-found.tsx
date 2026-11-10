import React from "react";
import { router } from "expo-router";
import { EmptyState } from "../components/States";

export default function NotFound() {
  return <EmptyState icon="compass-outline" title="This page wandered off" copy="The lesson or page you requested does not exist." action="Back to lessons" onAction={() => router.replace("/(tabs)")} />;
}

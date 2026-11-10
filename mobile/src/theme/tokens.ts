import { Platform } from "react-native";

export const colors = {
  ink: "#0E0F13",
  surface: "#181A21",
  surface2: "#23262F",
  line: "#2E3240",
  text: "#F5F6FA",
  muted: "#A3A8B8",
  lime: "#C6F432",
  coral: "#FF7A59",
  success: "#3DDC97",
  danger: "#FF5C7A",
  beginner: "#5CC8FF",
  intermediate: "#B38CFF",
  advanced: "#FFB547",
};
export const levelColors = { beginner: colors.beginner, intermediate: colors.intermediate, advanced: colors.advanced };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radii = { card: 16, pill: 999 };
export const font = (weight: "400" | "500" | "600" | "700" | "800") => ({
  fontFamily: Platform.select({ ios: "System", android: "sans-serif", web: "system-ui" }),
  fontWeight: weight,
});

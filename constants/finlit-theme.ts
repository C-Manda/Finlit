import { useSyncExternalStore } from "react";
import { Appearance, Platform, StyleSheet } from "react-native";
import * as SecureStore from "expo-secure-store";

export const palette = {
  ink: "#090b0c",
  muted: "#746c70",
  canvas: "#fbfbfb",
  surface: "#ffffff",
  line: "#e5e0e1",
  blush: "#efd8e5",
  mint: "#d9eee5",
  blue: "#dce8f1",
  peach: "#f1dfd3",
  lilac: "#e4def1",
  purple: "#59378a",
  teal: "#6eaaa0",
  warning: "#d89a70",
  error: "#8c3026",
};

export type Palette = typeof palette;
export type ThemePreference = "system" | "light" | "dark";
let preference: ThemePreference = "system";
let loaded = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());
const readStoredPreference = async () => {
  try {
    const value = Platform.OS === "web"
      ? (typeof window !== "undefined" ? window.localStorage.getItem("finlit-theme") : null)
      : await SecureStore.getItemAsync("finlit-theme");
    if (value === "system" || value === "light" || value === "dark") preference = value;
  } catch {
    // The system palette remains a safe fallback when local storage is unavailable.
  } finally {
    loaded = true;
    notify();
  }
};
export async function setThemePreference(value: ThemePreference) {
  preference = value;
  try {
    if (Platform.OS === "web") {
      window.localStorage.setItem("finlit-theme", value);
    } else {
      await SecureStore.setItemAsync("finlit-theme", value);
    }
  } finally {
    loaded = true;
    notify();
  }
}
const subscribeToTheme = (notifyTheme: () => void) => {
  listeners.add(notifyTheme);
  if (!loaded) void readStoredPreference();
  return () => listeners.delete(notifyTheme);
};
const darkPalette: Palette = {
  ink: "#f6f4f5",
  muted: "#c8bfc2",
  canvas: "#171517",
  surface: "#211e20",
  line: "#494246",
  blush: "#633f54",
  mint: "#23483b",
  blue: "#263f55",
  peach: "#573f31",
  lilac: "#44375c",
  purple: "#c8a8ef",
  teal: "#79c4b1",
  warning: "#e7b65e",
  error: "#ffb4a9",
};
const subscribeToAppearance = (notify: () => void) => {
  const subscription = Appearance.addChangeListener(notify);
  return () => subscription.remove();
};
export function useFinlitColorScheme() {
  const system = useSyncExternalStore(subscribeToAppearance, Appearance.getColorScheme, () => 'light');
  const selected = useSyncExternalStore(subscribeToTheme, () => preference, () => "system");
  return selected === "system" ? system : selected;
}
export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribeToTheme, () => preference, () => "system");
}
export function usePalette(): Palette {
  return useFinlitColorScheme() === "dark" ? darkPalette : palette;
}
// Build each stylesheet once per theme; the hook also responds to system theme changes.
export function themedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (colors: Palette) => T,
) {
  const light = StyleSheet.create(factory(palette));
  const dark = StyleSheet.create(factory(darkPalette));
  return function useStyles() {
    return useFinlitColorScheme() === "dark" ? dark : light;
  };
}

export const spacing = { xs: 6, sm: 10, md: 16, lg: 22, xl: 30 };
export const radii = { sm: 12, md: 18, lg: 24, pill: 999 };

export const fonts = Platform.select({
  ios: { regular: "System", medium: "System" },
  android: { regular: "sans-serif", medium: "sans-serif-medium" },
  default: { regular: "normal", medium: "normal" },
});

export const useCommonStyles = themedStyles((palette) => ({
  page: { flex: 1, backgroundColor: palette.canvas },
  content: {
    padding: spacing.md,
    paddingBottom: 110,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    flexGrow: 1,
  },
  title: {
    color: palette.ink,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "500",
  },
  heading: {
    color: palette.ink,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "500",
  },
  body: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  label: { color: palette.muted, fontSize: 11, lineHeight: 16 },
}));

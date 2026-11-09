import { Ionicons } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  radii,
  spacing,
  usePalette,
  setThemePreference,
  useThemePreference,
  type ThemePreference,
  useCommonStyles,
  themedStyles,
} from "@/constants/finlit-theme";
import { PrimaryButton, Screen, StudentShell } from "./finlit-ui";
import { useAuth } from "@/contexts/auth-context";
import { useProfile } from "@/hooks/use-profile";
import { describeSupabaseError } from "@/lib/supabase-diagnostics";
import { LearningPath } from "./learning-screens";
import { BudgetScreen } from "./budget-screens";
import { ProfileEngagement } from "./engagement/profile-engagement";
export { LoginView } from "./auth-views";
export { HomeScreen as HomeView } from "./home-screen";
export const LearnView = LearningPath;
export const RecommendedView = LearningPath;
export { JourneyScreen as ProgressView } from "./knowledge-views";
export const BudgetView = BudgetScreen;
export function AddEntryView() {
  return <BudgetScreen mode="transaction" />;
}
export const BudgetSummaryView = BudgetScreen;
function LearningRedirect() {
  return <Redirect href="/learn" />;
}
export const ExplanationView = LearningRedirect;
export const ScenarioView = LearningRedirect;
export const FeedbackView = LearningRedirect;
export const ActivityView = LearningRedirect;
export const QuizView = LearningRedirect;
export const ResultView = LearningRedirect;
export function SavedExplanationsView() {
  return <Redirect href={"/glossary" as never} />;
}
export function WelcomeView() {
  const styles = useStyles();
  const commonStyles = useCommonStyles();

  const router = useRouter();
  return (
    <Screen>
      <View style={styles.welcome}>
        <Text style={styles.brand}>FINLIT</Text>
        <View style={styles.hero}>
          <Text style={styles.heroMark}>K</Text>
          <View style={styles.heroDot} />
        </View>
        <Text style={commonStyles.title}>Build better{`\n`}money habits</Text>
        <Text style={[commonStyles.body, styles.welcomeBody]}>
          Short lessons. Practical decisions. Progress you can see.
        </Text>
        <PrimaryButton
          title="Get started"
          onPress={() => router.push("/login")}
        />
        <Pressable onPress={() => router.push("/login")}>
          <Text style={styles.centerLink}>Already have an account? Log in</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

export function ProfileView() {
  const styles = useStyles();
  const palette = usePalette();
  const commonStyles = useCommonStyles();

  const router = useRouter();
  const { signOut, user } = useAuth();
  const { profile, isLoading, error } = useProfile();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const theme = useThemePreference();
  const initials = (profile?.full_name ?? user?.email ?? "U")
    .slice(0, 2)
    .toUpperCase();
  const logOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setSignOutError("");
    try {
      const result = await signOut();
      if (result.error)
        setSignOutError("We could not log you out. Please try again.");
    } catch {
      setSignOutError("We could not log you out. Please try again.");
    } finally {
      setIsSigningOut(false);
    }
  };
  return (
    <StudentShell>
      <Screen>
        <View style={styles.profile}>
          <View style={styles.profileAvatar}>
            <Text style={{ color: palette.ink, fontSize: 22 }}>{initials}</Text>
          </View>
          <Text style={commonStyles.heading}>
            {profile?.full_name ?? "Your profile"}
          </Text>
          <Text style={commonStyles.body}>{user?.email ?? "Your account"}</Text>
        </View>
        {isLoading ? (
          <Text style={commonStyles.body}>Loading profile...</Text>
        ) : null}
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {describeSupabaseError(
              error,
              "Your profile could not be loaded. Please try again.",
            )}
          </Text>
        ) : null}
        <ProfileEngagement />
        <Pressable
          accessibilityRole="button"
          style={styles.savedItem}
          onPress={() => router.push("/progress")}
        >
          <Ionicons name="bar-chart-outline" size={20} color={palette.ink} />
          <View style={{ flex: 1 }}>
            <Text style={styles.moduleTitle}>Learning progress</Text>
            <Text style={commonStyles.label}>Review your lessons</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={palette.muted} />
        </Pressable>
        <View style={styles.appearance}>
          <Text style={styles.moduleTitle}>Appearance</Text>
          <Text style={commonStyles.label}>Choose how FinLit looks on this device</Text>
          <View style={styles.appearanceOptions}>
            {(["system", "light", "dark"] as ThemePreference[]).map(option => (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ selected: theme === option }}
                onPress={() => { void setThemePreference(option); }}
                style={[styles.appearanceOption, theme === option && styles.appearanceSelected]}
              >
                <Text style={styles.appearanceText}>{option[0].toUpperCase() + option.slice(1)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          style={styles.savedItem}
          onPress={() => router.push("/glossary" as never)}
        >
          <Ionicons name="bookmark-outline" size={20} color={palette.ink} />
          <View style={{ flex: 1 }}>
            <Text style={styles.moduleTitle}>Financial glossary</Text>
            <Text style={commonStyles.label}>Review key concepts</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={palette.muted} />
        </Pressable>
        {signOutError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {signOutError}
          </Text>
        ) : null}
        <PrimaryButton
          title={isSigningOut ? "Logging out..." : "Log out"}
          tone="outline"
          disabled={isSigningOut}
          onPress={() => {
            void logOut();
          }}
        />
      </Screen>
    </StudentShell>
  );
}

const useStyles = themedStyles((palette) => ({
  error: {
    color: palette.error,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.sm,
  },
  moduleTitle: { color: palette.ink, fontSize: 13, fontWeight: "500" },
  appearance: { marginTop: spacing.lg, gap: spacing.xs },
  appearanceOptions: { flexDirection: "row", gap: spacing.xs, flexWrap: "wrap" },
  appearanceOption: { borderWidth: 1, borderColor: palette.line, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  appearanceSelected: { backgroundColor: palette.lilac, borderColor: palette.purple },
  appearanceText: { color: palette.ink, fontSize: 13 },
  welcome: {
    minHeight: 590,
    backgroundColor: palette.blush,
    borderRadius: radii.lg,
    padding: 20,
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: 28,
  },
  brand: {
    position: "absolute",
    top: 20,
    left: 20,
    color: palette.ink,
    fontSize: 13,
    letterSpacing: 3,
  },
  hero: {
    alignSelf: "center",
    width: 215,
    height: 215,
    marginBottom: spacing.xl,
    borderRadius: 110,
    backgroundColor: palette.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  heroMark: {
    color: palette.ink,
    fontSize: 48,
    fontWeight: "500",
    transform: [{ rotate: "8deg" }],
    backgroundColor: palette.blue,
    paddingHorizontal: 35,
    paddingVertical: 15,
    borderRadius: 18,
  },
  heroDot: {
    position: "absolute",
    right: 24,
    top: 30,
    width: 38,
    height: 38,
    borderRadius: 20,
    backgroundColor: "#e7b65e",
  },
  welcomeBody: { marginTop: 12, marginBottom: 16 },
  centerLink: {
    color: palette.muted,
    textAlign: "center",
    fontSize: 11,
    marginTop: 15,
  },
  savedItem: {
    minHeight: 65,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderColor: palette.line,
  },
  profile: { alignItems: "center", marginVertical: 24 },
  profileAvatar: {
    width: 78,
    height: 78,
    borderRadius: 40,
    backgroundColor: palette.mint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
}));

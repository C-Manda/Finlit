import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Modal, Platform, Pressable, Switch, Text, View } from "react-native";
import * as SecureStore from "expo-secure-store";

import { useAuth } from "@/contexts/auth-context";
import { useEngagement } from "@/hooks/use-engagement";
import { usePalette, spacing, radii, themedStyles, useCommonStyles } from "@/constants/finlit-theme";
import { supabase } from "@/lib/supabase";
import { badgeCatalogue, type EarnedBadge } from "@/services/engagement";
import {
  getNotificationPermissionStatus,
  registerAndroidPushToken,
  requestAndroidNotificationPermission,
  scheduleDailyReminder,
  scheduleLocalNotification,
  sendTestNotification,
  type NotificationPermissionStatus,
} from "@/services/notifications";
import type { Tables } from "@/types/database.types";

type Preferences = Tables<"notification_preferences">;
type IconName = React.ComponentProps<typeof Ionicons>["name"];

const iconNames: Record<string, IconName> = {
  "book-open": "book-outline",
  bulb: "bulb-outline",
  library: "library-outline",
  award: "ribbon-outline",
  trophy: "trophy-outline",
  flame: "flame-outline",
  calendar: "calendar-outline",
  rocket: "rocket-outline",
  medal: "medal-outline",
  "wallet-cards": "wallet-outline",
};

const defaultPreferences: Preferences = {
  user_id: "",
  reminders_enabled: true,
  reminder_time: "18:00",
  timezone: "Africa/Lusaka",
  inactivity_days: 2,
  updated_at: "",
  budget_tips_enabled: true,
  general_tips_enabled: true,
  streak_reminders_enabled: true,
  inactivity_reminders_enabled: true,
  reminder_frequency: "daily",
  quiet_hours_start: "21:00",
  quiet_hours_end: "07:00",
};

async function readSeenBadges(userId: string): Promise<string[]> {
  const key = `finlit-seen-badges-${userId}`;
  const raw = Platform.OS === "web"
    ? (typeof window !== "undefined" ? window.localStorage.getItem(key) : null)
    : await SecureStore.getItemAsync(key);
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter(item => typeof item === "string") : [];
  } catch {
    return [];
  }
}

async function writeSeenBadges(userId: string, values: string[]) {
  const key = `finlit-seen-badges-${userId}`;
  const value = JSON.stringify(values);
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

export function ProfileEngagement() {
  const styles = useStyles();
  const commonStyles = useCommonStyles();
  const palette = usePalette();
  const { user } = useAuth();
  const { summary, tip, error, isLoading, refresh } = useEngagement();
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [permission, setPermission] = useState<NotificationPermissionStatus>("unsupported");
  const [selectedBadge, setSelectedBadge] = useState<EarnedBadge | null>(null);
  const [celebration, setCelebration] = useState<EarnedBadge | null>(null);
  const [settingsError, setSettingsError] = useState("");

  useEffect(() => {
    if (!user) return;
    let active = true;
    void (async () => {
      const [{ data, error: preferencesError }, permissionStatus] = await Promise.all([
        supabase.from("notification_preferences").select("*").eq("user_id", user.id).maybeSingle(),
        getNotificationPermissionStatus(),
      ]);
      if (!active) return;
      if (preferencesError) setSettingsError("Notification settings could not be loaded.");
      setPreferences(data ?? { ...defaultPreferences, user_id: user.id });
      setPermission(permissionStatus);
      if (permissionStatus === "granted") {
        try {
          await registerAndroidPushToken(user.id);
          await scheduleDailyReminder(user.id);
        } catch {
          if (active) setSettingsError("This device could not be registered for notifications.");
        }
      }
    })();
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!user || !summary || summary.badges.length === 0) return;
    void (async () => {
      const seen = await readSeenBadges(user.id);
      const newlyEarned = summary.badges.find(badge => !seen.includes(badge.code));
      const allSeen = [...new Set([...seen, ...summary.badges.map(badge => badge.code)])];
      await writeSeenBadges(user.id, allSeen);
      if (newlyEarned) setCelebration(newlyEarned);
    })();
  }, [summary, user]);

  const earned = useMemo(() => new Map((summary?.badges ?? []).map(badge => [badge.code, badge])), [summary]);
  const streak = summary?.streak ?? { current_streak: 0, longest_streak: 0, last_active_on: null };
  const activityDates = new Set(summary?.activityDates ?? []);

  async function updatePreferences(patch: Partial<Preferences>) {
    if (!user || !preferences) return;
    const next = { ...preferences, ...patch, updated_at: new Date().toISOString() };
    setPreferences(next);
    if (patch.reminders_enabled === false) {
      const { cancelDailyReminder } = await import("@/services/notifications");
      await cancelDailyReminder(user.id);
    }
    const { error: updateError } = await supabase.from("notification_preferences").upsert(next);
    if (updateError) {
      setPreferences(preferences);
      setSettingsError("Notification settings could not be saved.");
    }
  }

  async function enableNotifications() {
    setSettingsError("");
    const status = await requestAndroidNotificationPermission();
    setPermission(status);
    if (status === "granted" && user) {
      try {
        await registerAndroidPushToken(user.id);
      } catch {
        setSettingsError("Permission was granted, but this device could not be registered.");
      }
    }
  }

  async function runNotificationTest(local: boolean) {
    setSettingsError("");
    try {
      if (local) {
        await scheduleLocalNotification();
      } else {
        const result = await sendTestNotification();
        if (result.status === "no_devices") throw new Error("No registered Android device was found.");
      }
    } catch (value) {
      setSettingsError(value instanceof Error ? value.message : "The notification test failed.");
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={commonStyles.heading}>Your journey</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh journey" onPress={() => void refresh()}>
          <Ionicons name="refresh-outline" size={20} color={palette.purple} />
        </Pressable>
      </View>
      <View style={styles.statsGrid}>
        <Stat label="Current streak" value={`${streak.current_streak} days`} icon="flame-outline" />
        <Stat label="Longest streak" value={`${streak.longest_streak} days`} icon="trophy-outline" />
        <Stat label="Lessons completed" value={String(summary?.lessonCount ?? 0)} icon="book-outline" />
        <Stat label="Modules completed" value={String(summary?.moduleCount ?? 0)} icon="layers-outline" />
      </View>
      <View style={styles.activityCard}>
        <Text style={styles.cardTitle}>This week</Text>
        <View style={styles.week}>
          {Array.from({ length: 7 }, (_, index) => {
            const date = new Date();
            date.setDate(date.getDate() - (6 - index));
            const key = date.toISOString().slice(0, 10);
            return <View key={key} style={styles.day}><View style={[styles.dayDot, activityDates.has(key) && styles.dayActive]} /><Text style={styles.dayLabel}>{date.toLocaleDateString(undefined, { weekday: "narrow" })}</Text></View>;
          })}
        </View>
      </View>

      <Text style={commonStyles.heading}>Achievements</Text>
      <View style={styles.badges}>
        {badgeCatalogue.map(badge => {
          const earnedBadge = earned.get(badge.code);
          const progress = badge.unit === "lesson" || badge.unit === "lessons"
            ? summary?.lessonCount ?? 0
            : badge.unit === "module" ? summary?.moduleCount ?? 0
              : badge.unit === "days" ? streak.longest_streak : earnedBadge ? 1 : 0;
          return (
            <Pressable key={badge.code} accessibilityRole="button" onPress={() => earnedBadge ? setSelectedBadge(earnedBadge) : undefined} style={[styles.badgeCard, !earnedBadge && styles.lockedBadge]}>
              <Ionicons name={iconNames[badge.icon_name] ?? "star-outline"} size={24} color={earnedBadge ? palette.purple : palette.muted} />
              <View style={styles.badgeCopy}>
                <Text style={styles.cardTitle}>{badge.name}</Text>
                <Text style={commonStyles.label}>{earnedBadge ? `Earned ${new Date(earnedBadge.awarded_at).toLocaleDateString()}` : badge.description}</Text>
                {!earnedBadge && badge.target > 0 ? <Text style={styles.progressText}>{Math.min(progress, badge.target)}/{badge.target} {badge.unit}</Text> : null}
              </View>
              <Ionicons name={earnedBadge ? "chevron-forward" : "lock-closed-outline"} size={16} color={palette.muted} />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.tipCard}>
        <View style={styles.sectionHeader}><Text style={styles.cardTitle}>{tip?.title ?? "Daily financial tip"}</Text><Pressable accessibilityLabel="Refresh financial tip" onPress={() => void refresh()}><Ionicons name="refresh-outline" size={18} color={palette.purple} /></Pressable></View>
        <Text style={styles.tipText}>{isLoading ? "Finding a useful tip..." : tip?.text ?? "Keep building one practical money habit at a time."}</Text>
        {tip?.personalised ? <Text style={styles.personalised}>Based on your budget</Text> : null}
      </View>

      <Text style={commonStyles.heading}>Notification settings</Text>
      {Platform.OS === "android" ? (
        <View style={styles.settingsCard}>
          <View style={styles.permissionRow}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>Android notifications</Text><Text style={commonStyles.label}>Permission: {permission}</Text></View><Pressable accessibilityRole="button" onPress={() => void enableNotifications()}><Text style={styles.actionText}>{permission === "granted" ? "Refresh" : "Enable"}</Text></Pressable></View>
          <View style={styles.testActions}>
            <Pressable accessibilityRole="button" onPress={() => void runNotificationTest(true)}><Text style={styles.actionText}>Test locally</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => void runNotificationTest(false)}><Text style={styles.actionText}>Test push</Text></Pressable>
          </View>
          <SettingRow label="Budget tips" value={preferences?.budget_tips_enabled ?? true} onChange={value => void updatePreferences({ budget_tips_enabled: value })} />
          <SettingRow label="General tips" value={preferences?.general_tips_enabled ?? true} onChange={value => void updatePreferences({ general_tips_enabled: value })} />
          <SettingRow label="Streak reminders" value={preferences?.streak_reminders_enabled ?? true} onChange={value => void updatePreferences({ streak_reminders_enabled: value })} />
          <SettingRow label="Inactivity reminders" value={preferences?.inactivity_reminders_enabled ?? true} onChange={value => void updatePreferences({ inactivity_reminders_enabled: value })} />
          <ChoiceRow label="Reminder frequency" value={preferences?.reminder_frequency ?? "daily"} options={["daily", "every_2_days", "weekly", "off"]} onChange={value => void updatePreferences({ reminder_frequency: value })} />
          <ChoiceRow label="Reminder time" value={(preferences?.reminder_time ?? "18:00").slice(0, 5)} options={["08:00", "12:00", "18:00", "20:00"]} onChange={value => void updatePreferences({ reminder_time: value })} />
          <ChoiceRow label="Quiet hours" value={`${(preferences?.quiet_hours_start ?? "21:00").slice(0, 5)}–${(preferences?.quiet_hours_end ?? "07:00").slice(0, 5)}`} options={["21:00–07:00", "22:00–06:00", "23:00–06:00"]} onChange={value => { const [start, end] = value.split("–"); void updatePreferences({ quiet_hours_start: start, quiet_hours_end: end }); }} />
        </View>
      ) : (
        <View style={styles.settingsCard}><Text style={commonStyles.label}>Android notifications will be available when you use FinLit on Android. Tips and achievements remain available here.</Text></View>
      )}
      {error || settingsError ? <Text accessibilityRole="alert" style={styles.error}>{settingsError || "Some engagement details could not be loaded."}</Text> : null}

      <Modal transparent visible={Boolean(selectedBadge || celebration)} onRequestClose={() => { setSelectedBadge(null); setCelebration(null); }}>
        <Pressable style={styles.modalBackdrop} onPress={() => { setSelectedBadge(null); setCelebration(null); }}>
          <Pressable style={styles.modalCard} onPress={event => event.stopPropagation()}>
            <Ionicons name={iconNames[(selectedBadge ?? celebration)?.icon_name ?? "award"] ?? "ribbon-outline"} size={42} color={palette.purple} />
            <Text style={commonStyles.heading}>{celebration ? "Achievement unlocked!" : selectedBadge?.name}</Text>
            <Text style={commonStyles.body}>{(celebration ?? selectedBadge)?.description}</Text>
            <Pressable accessibilityRole="button" onPress={() => { setSelectedBadge(null); setCelebration(null); }}><Text style={styles.actionText}>Done</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: IconName }) {
  const styles = useStyles();
  const palette = usePalette();
  return <View style={styles.stat}><Ionicons name={icon} size={19} color={palette.purple} /><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function SettingRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  const styles = useStyles();
  const palette = usePalette();
  return <View style={styles.settingRow}><Text style={styles.cardTitle}>{label}</Text><Switch value={value} onValueChange={onChange} trackColor={{ false: palette.line, true: palette.lilac }} thumbColor={value ? palette.purple : palette.muted} /></View>;
}

function ChoiceRow({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const styles = useStyles();
  const current = Math.max(options.indexOf(value), 0);
  return <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} onPress={() => onChange(options[(current + 1) % options.length])} style={styles.settingRow}>
    <Text style={styles.cardTitle}>{label}</Text>
    <Text style={styles.actionText}>{value}</Text>
  </Pressable>;
}

const useStyles = themedStyles(palette => ({
  container: { gap: spacing.md, marginTop: spacing.lg },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  stat: { width: "48%", minHeight: 88, padding: spacing.sm, borderRadius: radii.md, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, gap: 3 },
  statValue: { color: palette.ink, fontSize: 17, fontWeight: "600" },
  statLabel: { color: palette.muted, fontSize: 11 },
  activityCard: { padding: spacing.md, backgroundColor: palette.mint, borderRadius: radii.md, gap: spacing.sm },
  cardTitle: { color: palette.ink, fontSize: 13, fontWeight: "600" },
  week: { flexDirection: "row", justifyContent: "space-between" },
  day: { alignItems: "center", gap: 4 },
  dayDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line },
  dayActive: { backgroundColor: palette.purple, borderColor: palette.purple },
  dayLabel: { color: palette.muted, fontSize: 11 },
  badges: { gap: spacing.xs },
  badgeCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radii.md, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line },
  lockedBadge: { opacity: 0.72 },
  badgeCopy: { flex: 1, gap: 2 },
  progressText: { color: palette.purple, fontSize: 11 },
  tipCard: { padding: spacing.md, borderRadius: radii.md, backgroundColor: palette.peach, gap: spacing.sm },
  tipText: { color: palette.ink, fontSize: 14, lineHeight: 20 },
  personalised: { color: palette.purple, fontSize: 11 },
  settingsCard: { padding: spacing.md, borderRadius: radii.md, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, gap: spacing.sm },
  permissionRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs },
  settingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.xs },
  testActions: { flexDirection: "row", gap: spacing.md, paddingVertical: spacing.xs },
  actionText: { color: palette.purple, fontSize: 13, fontWeight: "600" },
  error: { color: palette.error, fontSize: 12 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.42)", justifyContent: "center", alignItems: "center", padding: spacing.lg },
  modalCard: { width: "100%", maxWidth: 360, alignItems: "center", gap: spacing.md, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: palette.surface },
}));

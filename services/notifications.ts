import Constants from "expo-constants";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { supabase } from "@/lib/supabase";

export type NotificationPermissionStatus = "granted" | "denied" | "undetermined" | "unsupported";

type ExpoNotificationsModule = typeof import("expo-notifications");
let configured = false;
const dailyReminderKey = (userId: string) => `finlit-daily-reminder-${userId}`;

async function getNotifications(): Promise<ExpoNotificationsModule | null> {
  if (Platform.OS !== "android") return null;
  const notifications = await import("expo-notifications");
  if (!configured) {
    notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    configured = true;
  }
  return notifications;
}

export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  const notifications = await getNotifications();
  if (!notifications) return "unsupported";
  const { status } = await notifications.getPermissionsAsync();
  return status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined";
}

export async function requestAndroidNotificationPermission(): Promise<NotificationPermissionStatus> {
  const notifications = await getNotifications();
  if (!notifications) return "unsupported";
  const permission = await notifications.requestPermissionsAsync();
  return permission.status === "granted" ? "granted" : permission.status === "denied" ? "denied" : "undetermined";
}

export async function registerAndroidPushToken(userId: string): Promise<NotificationPermissionStatus> {
  const notifications = await getNotifications();
  if (!notifications) return "unsupported";
  const status = await getNotificationPermissionStatus();
  if (status !== "granted") return status;
  await notifications.setNotificationChannelAsync("finlit-engagement", {
    name: "FinLit engagement",
    importance: notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
  });
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error("Missing EAS project ID for Android push registration.");
  const token = (await notifications.getExpoPushTokenAsync({ projectId })).data;
  const { error } = await supabase.from("push_devices").upsert({
    user_id: userId, expo_push_token: token, platform: "android", is_enabled: true,
    last_seen_at: new Date().toISOString(),
  }, { onConflict: "user_id,expo_push_token" });
  if (error) throw error;
  return status;
}

export async function scheduleLocalNotification() {
  const notifications = await getNotifications();
  if (!notifications) return "unsupported" as const;
  const status = await getNotificationPermissionStatus();
  if (status !== "granted") return status;
  await notifications.scheduleNotificationAsync({
    content: {
      title: "FinLit notification test",
      body: "Local Android notifications are configured.",
      data: { source: "local-test" },
    },
    trigger: null,
  });
  return status;
}

export async function scheduleDailyReminder(userId: string) {
  const notifications = await getNotifications();
  if (!notifications) return "unsupported" as const;
  const status = await getNotificationPermissionStatus();
  if (status !== "granted") return status;
  await notifications.setNotificationChannelAsync("finlit-engagement", {
    name: "FinLit engagement",
    importance: notifications.AndroidImportance.HIGH,
    sound: "default",
  });
  const storedId = await SecureStore.getItemAsync(dailyReminderKey(userId));
  const scheduled = await notifications.getAllScheduledNotificationsAsync();
  if (storedId && scheduled.some(item => item.identifier === storedId)) return status;
  const identifier = await notifications.scheduleNotificationAsync({
    content: {
      title: "Your FinLit journey is waiting",
      body: "Open FinLit and keep building better money habits.",
      sound: "default",
      data: { source: "daily-reminder" },
    },
    trigger: {
      type: notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 24 * 60 * 60,
      repeats: false,
    },
  });
  await SecureStore.setItemAsync(dailyReminderKey(userId), identifier);
  return status;
}

export async function cancelDailyReminder(userId: string) {
  const notifications = await getNotifications();
  if (!notifications) return;
  const storedId = await SecureStore.getItemAsync(dailyReminderKey(userId));
  if (storedId) await notifications.cancelScheduledNotificationAsync(storedId);
  await SecureStore.deleteItemAsync(dailyReminderKey(userId));
}

export async function sendTestNotification() {
  if (Platform.OS !== "android") return { status: "unsupported" as const };
  const { data, error } = await supabase.functions.invoke("test-notification", {
    body: {},
  });
  if (error) throw error;
  return data as { status: "sent" | "no_devices"; deviceCount?: number; results?: string[] };
}

export async function disableAndroidPushTokens(userId: string) {
  if (Platform.OS !== "android") return;
  const { error } = await supabase.from("push_devices").update({ is_enabled: false }).eq("user_id", userId).eq("platform", "android");
  if (error) throw error;
}

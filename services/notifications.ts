import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";

export type NotificationPermissionStatus = "granted" | "denied" | "undetermined" | "unsupported";

type ExpoNotificationsModule = typeof import("expo-notifications");
let configured = false;

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
    importance: notifications.AndroidImportance.DEFAULT,
  });
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error("Missing EAS project ID for Android push registration.");
  const token = (await notifications.getExpoPushTokenAsync({ projectId })).data;
  const { error } = await supabase.from("push_devices").upsert(
    { user_id: userId, expo_push_token: token, is_enabled: true, last_seen_at: new Date().toISOString() },
    { onConflict: "expo_push_token" },
  );
  if (error) throw error;
  return status;
}

export async function disableAndroidPushTokens(userId: string) {
  if (Platform.OS !== "android") return;
  const { error } = await supabase.from("push_devices").update({ is_enabled: false }).eq("user_id", userId);
  if (error) throw error;
}

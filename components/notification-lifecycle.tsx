import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/auth-context";
import {
  getNotificationPermissionStatus,
  registerAndroidPushToken,
  scheduleDailyReminder,
} from "@/services/notifications";

export function NotificationLifecycle() {
  const { user, isLoading } = useAuth();
  const registeredUser = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading || !user) {
      registeredUser.current = null;
      return;
    }
    if (registeredUser.current === user.id) return;
    let active = true;
    void getNotificationPermissionStatus()
      .then(async status => {
        if (active && status === "granted") {
          await registerAndroidPushToken(user.id);
          await scheduleDailyReminder(user.id);
        }
        return status;
      })
      .then(() => {
        if (active) registeredUser.current = user.id;
      })
      .catch(error => {
        console.warn("Android push token registration failed.", error);
      });
    return () => {
      active = false;
    };
  }, [isLoading, user]);

  return null;
}

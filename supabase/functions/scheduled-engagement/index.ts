import { admin, inQuietHours } from "../_shared/push.ts";

const headers = { "Content-Type": "application/json" };

Deno.serve(async request => {
  const expected = Deno.env.get("ENGAGEMENT_CRON_SECRET");
  if (!expected || request.headers.get("x-cron-secret") !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }
  try {
    const { data: preferences, error: preferencesError } = await admin
      .from("notification_preferences").select("*");
    if (preferencesError) throw preferencesError;
    const today = new Date();
    let attempted = 0;
    for (const preference of preferences ?? []) {
      if (!preference.reminders_enabled || preference.reminder_frequency === "off" ||
          inQuietHours(preference.timezone, preference.quiet_hours_start, preference.quiet_hours_end, today)) continue;
      const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: preference.timezone }).format(today);
      const localTime = new Intl.DateTimeFormat("en-GB", {
        timeZone: preference.timezone, hour: "2-digit", minute: "2-digit", hour12: false,
      }).format(today);
      const reminderTime = preference.reminder_time.slice(0, 5);
      const [currentHour, currentMinute] = localTime.split(":").map(Number);
      const [reminderHour, reminderMinute] = reminderTime.split(":").map(Number);
      const currentMinutes = currentHour * 60 + currentMinute;
      const reminderMinutes = reminderHour * 60 + reminderMinute;
      if ((currentMinutes - reminderMinutes + 1440) % 1440 >= 60) continue;
      const dayNumber = Math.floor(Date.parse(`${localDate}T00:00:00Z`) / 86400000);
      if (preference.reminder_frequency === "every_2_days" && dayNumber % 2 !== 0) continue;
      if (preference.reminder_frequency === "weekly" && new Date(`${localDate}T00:00:00Z`).getUTCDay() !== 1) continue;
      const { data: devices, error: devicesError } = await admin
        .from("push_devices").select("id").eq("user_id", preference.user_id)
        .eq("platform", "android").eq("is_enabled", true).limit(1);
      if (devicesError) throw devicesError;
      if (!devices?.length) continue;
      const { data: streak } = await admin.from("user_streaks").select("last_active_on")
        .eq("user_id", preference.user_id).maybeSingle();
      const inactiveDays = streak?.last_active_on
        ? Math.floor((Date.parse(`${localDate}T00:00:00Z`) - Date.parse(`${streak.last_active_on}T00:00:00Z`)) / 86400000)
        : preference.inactivity_days;
      const notificationType = inactiveDays >= preference.inactivity_days
        ? "inactivity_reminder"
        : "streak_reminder";
      if (notificationType === "inactivity_reminder" && !preference.inactivity_reminders_enabled) continue;
      if (notificationType === "streak_reminder" && (!preference.streak_reminders_enabled || streak?.last_active_on === localDate)) continue;
      const deliveryKey = `${notificationType}:${localDate}`;
      const dispatchResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-notification-secret": Deno.env.get("NOTIFICATION_DISPATCH_SECRET") ?? "" },
        body: JSON.stringify({
          userId: preference.user_id,
          notificationType,
          deliveryKey,
          scheduledFor: localDate,
          title: notificationType === "inactivity_reminder" ? "FinLit is ready when you are" : "Keep your FinLit streak going",
          body: notificationType === "inactivity_reminder"
            ? "Take a few minutes to return to a lesson or review a money habit."
            : "Complete one meaningful activity today to keep learning.",
        }),
      });
      if (!dispatchResponse.ok) throw new Error(`Dispatch failed with ${dispatchResponse.status}`);
      attempted += 1;
    }
    return new Response(JSON.stringify({ attempted }), { headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Scheduled engagement failed" }), { status: 500, headers });
  }
});

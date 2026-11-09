import { admin, inQuietHours, markInvalidToken, sendExpoMessages } from "../_shared/push.ts";

const headers = { "Content-Type": "application/json" };

Deno.serve(async request => {
  if (request.headers.get("authorization") !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` &&
      request.headers.get("x-cron-secret") !== Deno.env.get("ENGAGEMENT_CRON_SECRET")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }
  try {
    const [{ data: preferences, error: preferencesError }, { data: streaks, error: streaksError }] = await Promise.all([
      admin.from("notification_preferences").select("*"),
      admin.from("user_streaks").select("user_id, last_active_on, current_streak"),
    ]);
    if (preferencesError) throw preferencesError;
    if (streaksError) throw streaksError;
    const streakMap = new Map((streaks ?? []).map(streak => [streak.user_id, streak]));
    let sent = 0;
    for (const preference of preferences ?? []) {
      if (!preference.reminders_enabled || inQuietHours(preference.timezone, preference.quiet_hours_start, preference.quiet_hours_end)) continue;
      const streak = streakMap.get(preference.user_id);
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: preference.timezone }).format(new Date());
      const inactiveDays = streak?.last_active_on
        ? Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${streak.last_active_on}T00:00:00Z`)) / 86400000)
        : preference.inactivity_days;
      const category = inactiveDays >= preference.inactivity_days && preference.inactivity_reminders_enabled ? "inactivity" : "streak";
      if (category === "streak" && (!preference.streak_reminders_enabled || streak?.last_active_on === today)) continue;
      const title = category === "inactivity" ? "FinLit is ready when you are" : "Keep your FinLit streak going";
      const body = category === "inactivity" ? "Take a few minutes to return to a lesson or review a money habit." : "Complete one meaningful activity today to keep learning.";
      const { data: devices, error: devicesError } = await admin.from("push_devices").select("id, expo_push_token").eq("user_id", preference.user_id).eq("is_enabled", true);
      if (devicesError) throw devicesError;
      const key = `${category}:${today}`;
      for (const device of devices ?? []) {
        const { error: logError } = await admin.from("notification_delivery_log").insert({
          user_id: preference.user_id, device_id: device.id, notification_key: key,
          category, scheduled_for: new Date().toISOString(),
        });
        if (logError?.code === "23505") continue;
        if (logError) throw logError;
        const [result] = await sendExpoMessages([{ to: device.expo_push_token, title, body, data: { category }, channelId: "finlit-engagement" }]);
        if (result?.status === "ok") {
          sent++;
          await admin.from("notification_delivery_log").update({ status: "sent", provider_ticket: result.id, delivered_at: new Date().toISOString() }).eq("user_id", preference.user_id).eq("device_id", device.id).eq("notification_key", key);
        } else if (result?.details?.error === "DeviceNotRegistered" || result?.details?.error === "InvalidCredentials") {
          await markInvalidToken(device.expo_push_token);
        }
      }
    }
    return new Response(JSON.stringify({ sent }), { headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Scheduled engagement failed" }), { status: 500, headers });
  }
});

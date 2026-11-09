import { admin, inQuietHours, markInvalidToken, sendExpoMessages } from "../_shared/push.ts";

const headers = { "Content-Type": "application/json" };

Deno.serve(async request => {
  const secret = Deno.env.get("NOTIFICATION_DISPATCH_SECRET");
  if (!secret || request.headers.get("x-notification-secret") !== secret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }
  try {
    const input = await request.json() as {
      userId: string;
      category: "budget" | "general" | "streak" | "inactivity";
      notificationKey: string;
      title: string;
      body: string;
    };
    if (!input.userId || !input.notificationKey || !input.title || !input.body) {
      return new Response(JSON.stringify({ error: "Missing notification fields" }), { status: 400, headers });
    }

    const { data: preferences, error: preferencesError } = await admin
      .from("notification_preferences").select("*").eq("user_id", input.userId).maybeSingle();
    if (preferencesError) throw preferencesError;
    if (!preferences?.reminders_enabled) return new Response(JSON.stringify({ skipped: "disabled" }), { headers });
    const enabled = input.category === "budget" ? preferences.budget_tips_enabled
      : input.category === "general" ? preferences.general_tips_enabled
        : input.category === "streak" ? preferences.streak_reminders_enabled
          : preferences.inactivity_reminders_enabled;
    if (!enabled || inQuietHours(preferences.timezone, preferences.quiet_hours_start, preferences.quiet_hours_end)) {
      return new Response(JSON.stringify({ skipped: "preference" }), { headers });
    }

    const scheduledFor = new Date().toISOString();
    const { data: devices, error: devicesError } = await admin
      .from("push_devices").select("id, expo_push_token").eq("user_id", input.userId).eq("is_enabled", true);
    if (devicesError) throw devicesError;
    const sent: string[] = [];
    for (const device of devices ?? []) {
      const { error: logError } = await admin.from("notification_delivery_log").insert({
        user_id: input.userId, device_id: device.id, notification_key: input.notificationKey,
        category: input.category, scheduled_for: scheduledFor,
      });
      if (logError?.code === "23505") continue;
      if (logError) throw logError;
      const [result] = await sendExpoMessages([{
        to: device.expo_push_token, title: input.title, body: input.body,
        data: { category: input.category }, channelId: "finlit-engagement",
      }]);
      if (result?.status === "ok") {
        sent.push(device.id);
        await admin.from("notification_delivery_log").update({
          status: "sent", provider_ticket: result.id, delivered_at: new Date().toISOString(),
        }).eq("user_id", input.userId).eq("device_id", device.id).eq("notification_key", input.notificationKey).eq("scheduled_for", scheduledFor);
      } else {
        const invalid = result?.details?.error === "DeviceNotRegistered" || result?.details?.error === "InvalidCredentials";
        if (invalid) await markInvalidToken(device.expo_push_token);
        await admin.from("notification_delivery_log").update({
          status: "failed", error_message: result?.details?.error ?? "Expo rejected notification",
        }).eq("user_id", input.userId).eq("device_id", device.id).eq("notification_key", input.notificationKey).eq("scheduled_for", scheduledFor);
      }
    }
    return new Response(JSON.stringify({ sent }), { headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Notification delivery failed" }), { status: 500, headers });
  }
});

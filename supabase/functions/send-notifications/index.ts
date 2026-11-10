import { admin, getExpoReceipts, inQuietHours, markInvalidToken, sendExpoMessages } from "../_shared/push.ts";

const headers = { "Content-Type": "application/json" };
const types = ["budget_tip", "general_tip", "streak_reminder", "inactivity_reminder"] as const;
type NotificationType = typeof types[number];

function isNotificationType(value: string): value is NotificationType {
  return types.includes(value as NotificationType);
}

Deno.serve(async request => {
  const secret = Deno.env.get("NOTIFICATION_DISPATCH_SECRET");
  if (!secret || request.headers.get("x-notification-secret") !== secret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  try {
    const input = await request.json() as {
      userId: string;
      notificationType: NotificationType;
      deliveryKey: string;
      scheduledFor: string;
      title: string;
      body: string;
    };
    if (!input.userId || !isNotificationType(input.notificationType) || !input.deliveryKey ||
        !/^\d{4}-\d{2}-\d{2}$/.test(input.scheduledFor) || !input.title || !input.body) {
      return new Response(JSON.stringify({ error: "Invalid notification fields" }), { status: 400, headers });
    }

    const { data: preferences, error: preferencesError } = await admin
      .from("notification_preferences").select("*").eq("user_id", input.userId).maybeSingle();
    if (preferencesError) throw preferencesError;
    if (!preferences?.reminders_enabled || preferences.reminder_frequency === "off") {
      return new Response(JSON.stringify({ status: "skipped", reason: "disabled" }), { headers });
    }
    const categoryEnabled = input.notificationType === "budget_tip"
      ? preferences.budget_tips_enabled
      : input.notificationType === "general_tip"
        ? preferences.general_tips_enabled
        : input.notificationType === "streak_reminder"
          ? preferences.streak_reminders_enabled
          : preferences.inactivity_reminders_enabled;
    if (!categoryEnabled || inQuietHours(preferences.timezone, preferences.quiet_hours_start, preferences.quiet_hours_end)) {
      return new Response(JSON.stringify({ status: "skipped", reason: "preference" }), { headers });
    }

    const { data: devices, error: devicesError } = await admin
      .from("push_devices").select("id, expo_push_token")
      .eq("user_id", input.userId).eq("platform", "android").eq("is_enabled", true);
    if (devicesError) throw devicesError;
    if (!devices?.length) return new Response(JSON.stringify({ status: "no_devices" }), { headers });

    const { data: existing, error: existingError } = await admin
      .from("notification_delivery_log").select("status, attempt_count, last_attempt_at")
      .eq("user_id", input.userId).eq("notification_type", input.notificationType)
      .eq("delivery_key", input.deliveryKey).maybeSingle();
    if (existingError) throw existingError;
    if (existing?.status === "sent") return new Response(JSON.stringify({ status: "already_sent" }), { headers });
    if (existing?.status === "pending" && existing.last_attempt_at &&
        Date.now() - Date.parse(existing.last_attempt_at) < 10 * 60 * 1000) {
      return new Response(JSON.stringify({ status: "already_claimed" }), { headers });
    }
    const now = new Date().toISOString();
    let claimed = false;
    let claimError;
    if (existing) {
      const claim = await admin.from("notification_delivery_log").update({
        status: "pending",
        attempt_count: (existing.attempt_count ?? 0) + 1,
        last_attempt_at: now,
        error_message: null,
      }).eq("user_id", input.userId).eq("notification_type", input.notificationType)
        .eq("delivery_key", input.deliveryKey)
        .or(`status.eq.failed,and(status.eq.pending,last_attempt_at.lt.${new Date(Date.now() - 10 * 60 * 1000).toISOString()})`)
        .select("id");
      claimError = claim.error;
      claimed = Boolean(claim.data?.length);
    } else {
      const claim = await admin.from("notification_delivery_log").insert({
        user_id: input.userId,
        notification_type: input.notificationType,
        delivery_key: input.deliveryKey,
        scheduled_for: input.scheduledFor,
        status: "pending",
        attempt_count: 1,
        last_attempt_at: now,
      }).select("id");
      claimError = claim.error;
      claimed = Boolean(claim.data?.length);
    }
    if (claimError?.code === "23505") {
      return new Response(JSON.stringify({ status: "already_claimed" }), { headers });
    }
    if (claimError) throw claimError;
    if (!claimed) return new Response(JSON.stringify({ status: "already_claimed" }), { headers });

    let results;
    try {
      results = await sendExpoMessages(devices.map(device => ({
        to: device.expo_push_token,
        title: input.title,
        body: input.body,
        data: { notificationType: input.notificationType, deliveryKey: input.deliveryKey },
        channelId: "finlit-engagement",
      })));
    } catch (error) {
      const { error: failedUpdateError } = await admin.from("notification_delivery_log").update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Expo request failed",
      }).eq("user_id", input.userId).eq("notification_type", input.notificationType)
        .eq("delivery_key", input.deliveryKey);
      if (failedUpdateError) throw failedUpdateError;
      throw error;
    }
    let accepted = 0;
    const errors: string[] = [];
    for (let index = 0; index < devices.length; index += 1) {
      const result = results[index];
      if (result?.status === "ok") {
        accepted += 1;
      } else {
        const reason = result?.details?.error ?? "Expo rejected notification";
        errors.push(reason);
        if (reason === "DeviceNotRegistered" || reason === "InvalidCredentials") {
          try {
            await markInvalidToken(devices[index].expo_push_token);
          } catch (error) {
            errors.push(error instanceof Error ? error.message : "Could not disable invalid token");
          }
        }
      }
    }
    const ticketIds = results.flatMap(result => result?.id ? [result.id] : []);
    let receiptError: string | null = null;
    let receiptsPending = false;
    if (ticketIds.length) {
      try {
        const receipts = await getExpoReceipts(ticketIds);
        const receiptValues = ticketIds.map(id => receipts[id]).filter(Boolean);
        const receiptFailures = receiptValues.filter(receipt => receipt.status === "error");
        receiptsPending = receiptValues.length < ticketIds.length;
        if (receiptFailures.length) {
          receiptError = receiptFailures.map(receipt => receipt.details?.error ?? receipt.message ?? "Expo receipt failed").join("; ");
          errors.push(receiptError);
        }
      } catch (error) {
        receiptsPending = true;
        errors.push(error instanceof Error ? error.message : "Expo receipt request failed");
      }
    }
    const finalStatus = accepted === 0 ? "failed" : receiptError ? "failed" : receiptsPending ? "pending" : "sent";
    const { error: deliveryUpdateError } = await admin.from("notification_delivery_log").update({
      status: finalStatus,
      provider_ticket_id: results.find(result => result?.id)?.id ?? null,
      provider_receipt_status: receiptError ? "error" : receiptsPending ? "pending" : accepted > 0 ? "ok" : "rejected",
      delivered_at: finalStatus === "sent" ? new Date().toISOString() : null,
      error_message: errors.length ? errors.join("; ") : null,
    }).eq("user_id", input.userId).eq("notification_type", input.notificationType).eq("delivery_key", input.deliveryKey);
    if (deliveryUpdateError) throw deliveryUpdateError;
    return new Response(JSON.stringify({ status: finalStatus, accepted, failed: devices.length - accepted }), { headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Notification delivery failed" }), { status: 500, headers });
  }
});

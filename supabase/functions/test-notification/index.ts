import { admin, markInvalidToken, sendExpoMessages } from "../_shared/push.ts";

const headers = { "Content-Type": "application/json" };

Deno.serve(async request => {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Authentication required" }), { status: 401, headers });
  }
  try {
    const { data: authData, error: authError } = await admin.auth.getUser(authorization.slice(7));
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Authentication required" }), { status: 401, headers });
    }
    const { data: devices, error: devicesError } = await admin
      .from("push_devices").select("expo_push_token")
      .eq("user_id", authData.user.id).eq("platform", "android").eq("is_enabled", true);
    if (devicesError) throw devicesError;
    if (!devices?.length) return new Response(JSON.stringify({ status: "no_devices" }), { headers });
    const deliveryKey = `test:${crypto.randomUUID()}`;
    const scheduledFor = new Date().toISOString().slice(0, 10);
    const { error: logError } = await admin.from("notification_delivery_log").insert({
      user_id: authData.user.id,
      notification_type: "general_tip",
      delivery_key: deliveryKey,
      scheduled_for: scheduledFor,
      status: "pending",
      attempt_count: 1,
      last_attempt_at: new Date().toISOString(),
    });
    if (logError) throw logError;
    const results = await sendExpoMessages(devices.map(device => ({
      to: device.expo_push_token,
      title: "FinLit notification test",
      body: "Android push delivery is configured for this device.",
      data: { source: "remote-test" },
      channelId: "finlit-engagement",
    })));
    const accepted = results.filter(result => result.status === "ok").length;
    for (let index = 0; index < results.length; index += 1) {
      const error = results[index]?.details?.error;
      if (error === "DeviceNotRegistered" || error === "InvalidCredentials") {
        await markInvalidToken(devices[index].expo_push_token);
      }
    }
    await admin.from("notification_delivery_log").update({
      status: accepted ? "sent" : "failed",
      provider_ticket_id: results.find(result => result.id)?.id ?? null,
      provider_receipt_status: accepted ? "accepted" : "rejected",
      delivered_at: accepted ? new Date().toISOString() : null,
      error_message: results.filter(result => result.details?.error).map(result => result.details?.error).join("; ") || null,
    }).eq("user_id", authData.user.id).eq("notification_type", "general_tip").eq("delivery_key", deliveryKey);
    return new Response(JSON.stringify({
      status: accepted ? "sent" : "failed",
      deviceCount: devices.length,
      results: results.map(result => ({ status: result.status, ticketId: result.id, error: result.details?.error })),
    }), { status: accepted ? 200 : 502, headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Notification test failed" }), { status: 500, headers });
  }
});

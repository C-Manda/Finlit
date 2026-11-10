import { admin, getExpoReceipts, markInvalidToken, sendExpoMessages } from "../_shared/push.ts";

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
    let results;
    try {
      results = await sendExpoMessages(devices.map(device => ({
        to: device.expo_push_token,
        title: "FinLit notification test",
        body: "Android push delivery is configured for this device.",
        data: { source: "remote-test" },
        channelId: "finlit-engagement",
      })));
    } catch (error) {
      const { error: updateError } = await admin.from("notification_delivery_log").update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Expo request failed",
      }).eq("user_id", authData.user.id).eq("notification_type", "general_tip").eq("delivery_key", deliveryKey);
      if (updateError) throw updateError;
      throw error;
    }
    const accepted = results.filter(result => result.status === "ok").length;
    let receiptError: string | null = null;
    let receiptsPending = false;
    for (let index = 0; index < results.length; index += 1) {
      const error = results[index]?.details?.error;
      if (error === "DeviceNotRegistered" || error === "InvalidCredentials") {
        try {
          await markInvalidToken(devices[index].expo_push_token);
        } catch (markError) {
          receiptError = markError instanceof Error ? markError.message : "Could not disable invalid token";
        }
      }
    }
    const ticketIds = results.flatMap(result => result.id ? [result.id] : []);
    if (ticketIds.length) {
      try {
        const receipts = await getExpoReceipts(ticketIds);
        const receiptValues = ticketIds.map(id => receipts[id]).filter(Boolean);
        const failedReceipts = receiptValues.filter(receipt => receipt.status === "error");
        receiptsPending = receiptValues.length < ticketIds.length;
        if (failedReceipts.length) receiptError = failedReceipts.map(receipt => receipt.details?.error ?? receipt.message ?? "Expo receipt failed").join("; ");
      } catch (error) {
        receiptsPending = true;
        receiptError = error instanceof Error ? error.message : "Expo receipt request failed";
      }
    }
    const { error: deliveryUpdateError } = await admin.from("notification_delivery_log").update({
      status: accepted === 0 ? "failed" : receiptError && !receiptsPending ? "failed" : receiptsPending ? "pending" : "sent",
      provider_ticket_id: results.find(result => result.id)?.id ?? null,
      provider_receipt_status: receiptError && !receiptsPending ? "error" : receiptsPending ? "pending" : accepted ? "ok" : "rejected",
      delivered_at: accepted && !receiptError && !receiptsPending ? new Date().toISOString() : null,
      error_message: [receiptError, ...results.filter(result => result.details?.error).map(result => result.details?.error)].filter(Boolean).join("; ") || null,
    }).eq("user_id", authData.user.id).eq("notification_type", "general_tip").eq("delivery_key", deliveryKey);
    if (deliveryUpdateError) throw deliveryUpdateError;
    return new Response(JSON.stringify({
      status: accepted === 0 ? "failed" : receiptError && !receiptsPending ? "failed" : receiptsPending ? "pending" : "sent",
      deviceCount: devices.length,
      results: results.map(result => ({ status: result.status, ticketId: result.id, error: result.details?.error })),
    }), { status: accepted && !receiptError && !receiptsPending ? 200 : 502, headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Notification test failed" }), { status: 500, headers });
  }
});

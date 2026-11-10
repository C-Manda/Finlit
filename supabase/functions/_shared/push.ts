import { createClient } from "npm:@supabase/supabase-js@2";

export const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

type PushMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, string>;
  channelId: string;
};
export type ExpoPushResult = {
  status?: string;
  id?: string;
  details?: { error?: string };
};

export function inQuietHours(timezone: string, start: string, end: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const current = Number(parts.find(part => part.type === "hour")?.value ?? 0) * 60 + Number(parts.find(part => part.type === "minute")?.value ?? 0);
  const parse = (value: string) => {
    const [hour, minute] = value.slice(0, 5).split(":").map(Number);
    return hour * 60 + minute;
  };
  const quietStart = parse(start);
  const quietEnd = parse(end);
  return quietStart > quietEnd ? current >= quietStart || current < quietEnd : current >= quietStart && current < quietEnd;
}

export async function sendExpoMessages(messages: PushMessage[]) {
  if (messages.length === 0) return [];
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(messages),
  });
  if (!response.ok) throw new Error(`Expo push request failed with ${response.status}`);
  const payload = await response.json() as { data?: ExpoPushResult[] };
  return payload.data ?? [];
}

export async function markInvalidToken(token: string) {
  await admin.from("push_devices").update({ is_enabled: false }).eq("expo_push_token", token);
}

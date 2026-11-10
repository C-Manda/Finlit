import type { Json, Tables } from "@/types/database.types";
import { supabase } from "@/lib/supabase";

export type FinancialTip = {
  id: string;
  category: string;
  title: string;
  text: string;
  personalised: boolean;
};

type AllocationMap = Record<string, number>;

function allocations(value: Json): AllocationMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([, amount]) => typeof amount === "number"),
  ) as AllocationMap;
}

export async function getDailyFinancialTip(userId: string, previousTip?: string): Promise<FinancialTip> {
  const { data: tips, error: tipsError } = await supabase
    .from("financial_tips")
    .select("id, category, title, body")
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  if (tipsError) throw tipsError;

  const { data: plans, error: plansError } = await supabase
    .from("budget_plans")
    .select("id, period_start, period_end, allocations")
    .eq("user_id", userId)
    .order("period_start", { ascending: false })
    .limit(1);
  if (plansError) throw plansError;

  const plan = plans?.[0] as Pick<Tables<"budget_plans">, "id" | "period_start" | "period_end" | "allocations"> | undefined;
  if (plan) {
    const categoryAllocations = allocations(plan.allocations);
    const categoryIds = Object.keys(categoryAllocations);
    if (categoryIds.length > 0) {
      const { data: entries, error: entriesError } = await supabase
        .from("financial_entries")
        .select("category_id, amount, entry_type")
        .eq("user_id", userId)
        .eq("entry_type", "expense")
        .gte("occurred_on", plan.period_start)
        .lte("occurred_on", plan.period_end)
        .in("category_id", categoryIds);
      if (entriesError) throw entriesError;
      const spent = new Map<string, number>();
      for (const entry of entries ?? []) {
        if (entry.category_id) spent.set(entry.category_id, (spent.get(entry.category_id) ?? 0) + entry.amount);
      }
      if ([...spent].some(([id, amount]) => amount > (categoryAllocations[id] ?? 0))) {
        return { id: "budget-review", category: "budgeting", title: "Budget review", text: "One of your planned categories needs a review. Check your budget before making the next purchase.", personalised: true };
      }
      if ([...spent].some(([id, amount]) => amount >= (categoryAllocations[id] ?? 0) * 0.8)) {
        return { id: "budget-near-limit", category: "budgeting", title: "Budget check-in", text: "You are getting close to a planned category limit. A quick review can help you stay intentional.", personalised: true };
      }
    }
  }

  const available = (tips ?? []).filter(tip => tip.body !== previousTip);
  const list = available.length > 0 ? available : tips ?? [];
  const selected = list[Math.floor(new Date().getDate() % Math.max(list.length, 1))];
  if (!selected) {
    return { id: "fallback", category: "general", title: "Daily tip", text: "Keep building one practical money habit at a time.", personalised: false };
  }
  return { id: selected.id, category: selected.category, title: selected.title, text: selected.body, personalised: false };
}

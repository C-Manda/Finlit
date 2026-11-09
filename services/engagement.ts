import { supabase } from "@/lib/supabase";

export type EngagementStreak = {
  current_streak: number;
  longest_streak: number;
  last_active_on: string | null;
};

export type EarnedBadge = {
  code: string;
  name: string;
  description: string;
  icon_name: string | null;
  awarded_at: string;
};

export type EngagementSummary = {
  streak: EngagementStreak;
  activityDates: string[];
  lessonCount: number;
  moduleCount: number;
  badges: EarnedBadge[];
};

export const badgeCatalogue = [
  { code: "first_lesson", name: "First Step", description: "Complete your first lesson.", icon_name: "book-open", target: 1, unit: "lesson" },
  { code: "curious_mind", name: "Curious Mind", description: "Complete five lessons.", icon_name: "bulb", target: 5, unit: "lessons" },
  { code: "knowledge_builder", name: "Knowledge Builder", description: "Complete ten lessons.", icon_name: "library", target: 10, unit: "lessons" },
  { code: "first_module", name: "Module Finisher", description: "Complete your first module.", icon_name: "award", target: 1, unit: "module" },
  { code: "all_modules", name: "Financial Learning Journey", description: "Complete every learning module.", icon_name: "trophy", target: 0, unit: "modules" },
  { code: "three_day_streak", name: "Three-Day Streak", description: "Learn on three consecutive days.", icon_name: "flame", target: 3, unit: "days" },
  { code: "seven_day_streak", name: "One Week Strong", description: "Keep a seven-day streak.", icon_name: "flame", target: 7, unit: "days" },
  { code: "fourteen_day_streak", name: "Two Weeks of Growth", description: "Keep a fourteen-day streak.", icon_name: "flame", target: 14, unit: "days" },
  { code: "monthly_momentum", name: "Monthly Momentum", description: "Keep a thirty-day streak.", icon_name: "calendar", target: 30, unit: "days" },
  { code: "unstoppable", name: "Unstoppable", description: "Keep a ninety-day streak.", icon_name: "rocket", target: 90, unit: "days" },
  { code: "century_club", name: "Century Club", description: "Keep a one-hundred-day streak.", icon_name: "medal", target: 100, unit: "days" },
  { code: "budget_started", name: "Budget Starter", description: "Create your first budget.", icon_name: "wallet-cards", target: 1, unit: "budget" },
] as const;

export async function getEngagementSummary(userId?: string): Promise<EngagementSummary> {
  const { data, error } = await supabase.rpc("get_engagement_summary");
  if (error && !userId) throw error;
  if (error && userId) {
    const [streakResult, lessonResult, moduleResult, userBadgesResult] = await Promise.all([
      supabase.from("user_streaks").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("lesson_progress").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_completed", true),
      supabase.from("module_progress").select("id", { count: "exact", head: true }).eq("user_id", userId).not("completed_at", "is", null),
      supabase.from("user_badges").select("badge_id, awarded_at").eq("user_id", userId),
    ]);
    const fallbackError = streakResult.error ?? lessonResult.error ?? moduleResult.error ?? userBadgesResult.error;
    if (fallbackError) throw fallbackError;
    const streak = streakResult.data;
    const lessonCount = lessonResult.count;
    const moduleCount = moduleResult.count;
    const userBadges = userBadgesResult.data;
    const badgeIds = (userBadges ?? []).map(badge => badge.badge_id);
    const badgesResult = badgeIds.length
      ? await supabase.from("badges").select("id, code, name, description, icon_name").in("id", badgeIds)
      : { data: [] };
    if ("error" in badgesResult && badgesResult.error) throw badgesResult.error;
    const badges = badgesResult.data;
    const awardedAt = new Map((userBadges ?? []).map(badge => [badge.badge_id, badge.awarded_at]));
    return {
      streak: streak ?? { current_streak: 0, longest_streak: 0, last_active_on: null },
      activityDates: [],
      lessonCount: lessonCount ?? 0,
      moduleCount: moduleCount ?? 0,
      badges: (badges ?? []).map(badge => ({ ...badge, awarded_at: awardedAt.get(badge.id) ?? new Date().toISOString() })),
    };
  }
  const value = (data ?? {}) as Partial<EngagementSummary>;
  return {
    streak: value.streak ?? { current_streak: 0, longest_streak: 0, last_active_on: null },
    activityDates: value.activityDates ?? [],
    lessonCount: value.lessonCount ?? 0,
    moduleCount: value.moduleCount ?? 0,
    badges: value.badges ?? [],
  };
}

export async function recordEngagementActivity(
  activityType: string,
  sourceId: string,
) {
  const { data, error } = await supabase.rpc("record_engagement_activity", {
    p_activity_type: activityType,
    p_source_key: sourceId,
  });
  if (error) throw error;
  return data;
}

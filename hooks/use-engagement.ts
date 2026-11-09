import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { getDailyFinancialTip, type FinancialTip } from "@/services/financial-tips";
import { getEngagementSummary, type EngagementSummary } from "@/services/engagement";

export function useEngagement() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<EngagementSummary | null>(null);
  const [tip, setTip] = useState<FinancialTip | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(user));

  const refresh = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const nextSummary = await getEngagementSummary(user.id);
      const nextTip = await getDailyFinancialTip(user.id, tip?.text);
      setSummary(nextSummary);
      setTip(nextTip);
    } catch (value) {
      setError(value instanceof Error ? value : new Error("Unable to load engagement data."));
    } finally {
      setIsLoading(false);
    }
  }, [tip?.text, user]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { summary, tip, isLoading, error, refresh };
}

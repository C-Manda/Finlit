import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Text, View } from "react-native";
import { useAuth } from "@/contexts/auth-context";
import {
  budgetTotals,
  currency,
  monthPeriod,
  type BudgetData,
} from "@/content/budget-rules";
import { learningApi } from "@/services/learning";
import { DonutChart } from "./data-charts";
import { LearningButton } from "./lesson-player";
import { useLearningStyles } from "./learning-screens";

export function HomeBudgetChart() {
  const { user } = useAuth();
  return <BudgetChartBody key={user?.id} />;
}
function BudgetChartBody() {
  const s = useLearningStyles(),
    router = useRouter();
  const [data, setData] = useState<BudgetData | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useFocusEffect(
    useCallback(() => {
      void retry;
      let active = true;
      setData(null);
      setError("");
      learningApi<BudgetData>("budget")
        .then((result) => {
          if (active) setData(result);
        })
        .catch(() => {
          if (active) setError("Your spending chart could not be loaded.");
        });
      return () => {
        active = false;
      };
    }, [retry]),
  );
  const period = monthPeriod();
  const totals = data
    ? budgetTotals(
        { ...period, planned_income: 0, allocations: {} },
        data.entries,
      )
    : null;
  return (
    <View style={s.stack}>
      {error ? (
        <>
          <Text accessibilityRole="alert" style={s.body}>
            {error}
          </Text>
          <LearningButton
            title="Retry spending chart"
            secondary
            onPress={() => setRetry((n) => n + 1)}
          />
        </>
      ) : !data || !totals ? (
        <Text style={s.note}>Loading this month’s spending…</Text>
      ) : (
        <>
          <DonutChart
            title="This month’s spending"
            total={totals.spent}
            format={currency}
            values={Object.entries(totals.categories).map(([id, value]) => ({
              label:
                data.categories.find((c) => c.id === id)?.name ??
                "Category unavailable",
              value,
            }))}
          />
          <Text style={s.note}>
            {period.period_start} to {period.period_end} · Recorded expenses,
            including fees.
          </Text>
          <LearningButton
            title="Open Budget Tracker"
            secondary
            onPress={() => router.push("/budget")}
          />
        </>
      )}
    </View>
  );
}

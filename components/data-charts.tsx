import { Text, View } from "react-native";
import Svg, { Circle, Rect } from "react-native-svg";
import { palette, radii, useFinlitColorScheme } from "@/constants/finlit-theme";

export type ChartRow = {
  label: string;
  values: { label: string; value: number }[];
};
export function chartColors(dark: boolean) {
  return dark
    ? {
        background: "#211e20",
        text: "#f6f4f5",
        muted: "#c8bfc2",
        track: "#383336",
        series: [
          "#79b6a9",
          "#d5a0b8",
          "#d7b16f",
          "#b9a5d8",
          "#9ebdd3",
          "#d1aa90",
        ],
      }
    : {
        background: palette.surface,
        text: palette.ink,
        muted: palette.muted,
        track: "#eee9ec",
        series: [
          "#6eaaa0",
          "#dca5be",
          "#d4b16d",
          "#b6a2d2",
          "#a3bdcf",
          "#d6b49e",
        ],
      };
}
// Legends carry exact values: charts remain understandable without colour or touch.
export function BarChart({
  title,
  rows,
  max,
  format = String,
  empty = "No recorded data in this period.",
}: {
  title: string;
  rows: ChartRow[];
  max?: number;
  format?: (value: number) => string;
  empty?: string;
}) {
  const colors = chartColors(useFinlitColorScheme() === "dark");
  const ceiling = Math.max(
    max ?? 0,
    ...rows.flatMap((row) =>
      row.values.map((item) => (Number.isFinite(item.value) ? item.value : 0)),
    ),
    1,
  );
  return (
    <View
      style={{
        padding: 16,
        gap: 14,
        borderRadius: radii.md,
        backgroundColor: colors.background,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{ fontSize: 18, fontWeight: "500", color: colors.text }}
      >
        {title}
      </Text>
      {!rows.length ? (
        <Text style={{ color: colors.muted }}>{empty}</Text>
      ) : (
        rows.map((row, index) => (
          <View key={index} style={{ gap: 6 }}>
            {!!row.label && (
              <Text style={{ color: colors.text, fontSize: 15 }}>
                {row.label}
              </Text>
            )}
            {row.values.map((item, i) => (
              <View key={item.label} style={{ gap: 4 }}>
                <Text style={{ color: colors.muted, fontSize: 14 }}>
                  {item.label}: {format(item.value)}
                </Text>
                <Svg
                  width="100%"
                  height={8}
                  viewBox="0 0 100 8"
                  preserveAspectRatio="none"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <Rect width={100} height={8} rx={4} fill={colors.track} />
                  <Rect
                    width={Math.max(
                      0,
                      Math.min(100, (item.value / ceiling) * 100),
                    )}
                    height={8}
                    rx={4}
                    fill={colors.series[i % colors.series.length]}
                  />
                </Svg>
              </View>
            ))}
          </View>
        ))
      )}
    </View>
  );
}
export function DonutChart({
  title,
  values,
  total,
  format = String,
}: {
  title: string;
  values: { label: string; value: number }[];
  total: number;
  format?: (value: number) => string;
}) {
  const colors = chartColors(useFinlitColorScheme() === "dark"),
    positive = values.filter((v) => Number.isFinite(v.value) && v.value > 0);
  let offset = 0;
  const circumference = 2 * Math.PI * 56;
  return (
    <View
      style={{
        padding: 16,
        gap: 12,
        borderRadius: radii.md,
        backgroundColor: colors.background,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{ fontSize: 18, fontWeight: "500", color: colors.text }}
      >
        {title}
      </Text>
      {total <= 0 ? (
        <Text style={{ color: colors.muted }}>
          No expenses recorded in this period.
        </Text>
      ) : (
        <>
          <View
            style={{
              alignItems: "center",
              justifyContent: "center",
              alignSelf: "center",
              width: 190,
              height: 190,
            }}
          >
            <Svg
              width={190}
              height={190}
              viewBox="0 0 152 152"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {positive.map((v, i) => {
                const length = (v.value / total) * circumference,
                  start = offset;
                offset += length;
                return (
                  <Circle
                    key={i}
                    cx={76}
                    cy={76}
                    r={56}
                    fill="none"
                    stroke={colors.series[i % colors.series.length]}
                    strokeWidth={19}
                    strokeDasharray={`${length} ${circumference - length}`}
                    strokeDashoffset={-start}
                    rotation={-90}
                    origin="76,76"
                  />
                );
              })}
            </Svg>
            <View
              style={{
                position: "absolute",
                width: 124,
                alignItems: "center",
                gap: 4,
              }}
            >
              <Text
                adjustsFontSizeToFit
                numberOfLines={1}
                style={{ color: colors.text, fontSize: 21, fontWeight: "500" }}
              >
                {format(total)}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                Total expenses
              </Text>
            </View>
          </View>
          {positive.map((v, i) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingVertical: 7,
              }}
            >
              <View
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 5,
                  backgroundColor: colors.series[i % colors.series.length],
                }}
              />
              <Text style={{ flex: 1, color: colors.text, fontSize: 13 }}>
                {v.label}
              </Text>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: colors.text, fontSize: 13 }}>
                  {format(v.value)}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {((v.value / total) * 100).toFixed(1)}%
                </Text>
              </View>
            </View>
          ))}
        </>
      )}
    </View>
  );
}
export function CompactProgress({ value }: { value: number }) {
  const colors = chartColors(useFinlitColorScheme() === "dark");
  return (
    <Svg
      width="100%"
      height={8}
      viewBox="0 0 100 8"
      preserveAspectRatio="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Rect width={100} height={8} rx={4} fill={colors.track} />
      <Rect
        width={Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0}
        height={8}
        rx={4}
        fill={colors.text}
      />
    </Svg>
  );
}

export function ScoreRing({ score, total }: { score: number; total: number }) {
  const colors = chartColors(useFinlitColorScheme() === "dark");
  const percent =
    total > 0 ? Math.max(0, Math.min(100, (score / total) * 100)) : 0;
  const circumference = 2 * Math.PI * 60;
  return (
    <View
      accessible
      accessibilityLabel={`${score} of ${total} correct, ${Math.round(percent)} percent`}
      style={{
        alignSelf: "center",
        width: 150,
        height: 150,
        alignItems: "center",
        justifyContent: "center",
        marginVertical: 16,
      }}
    >
      <Svg
        width={150}
        height={150}
        viewBox="0 0 150 150"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Circle
          cx={75}
          cy={75}
          r={60}
          fill="none"
          stroke={colors.track}
          strokeWidth={12}
        />
        <Circle
          cx={75}
          cy={75}
          r={60}
          fill="none"
          stroke={colors.series[0]}
          strokeWidth={12}
          strokeDasharray={`${(percent / 100) * circumference} ${circumference}`}
          rotation={-90}
          origin="75,75"
        />
      </Svg>
      <Text
        style={{
          position: "absolute",
          fontSize: 30,
          fontWeight: "500",
          color: colors.text,
        }}
      >
        {Math.round(percent)}%
      </Text>
    </View>
  );
}

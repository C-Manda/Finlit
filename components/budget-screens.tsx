import { MoneyLocations, LocationPicker } from "./money-locations";
import { categoryIcon } from "@/content/budget-categories";
import { Ionicons } from "@expo/vector-icons";
import { BarChart, DonutChart } from "./data-charts";
import { useCallback, useMemo, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Header, Screen, StudentShell, ToneCard } from "./finlit-ui";
import { LearningButton } from "./lesson-player";
import { useLearningStyles } from "./learning-screens";
import { learningApi } from "@/services/learning";
import {
  budgetInsights,
  budgetTotals,
  currency as money,
  localDate,
  monthPeriod,
  validDate,
  type BudgetData,
  type BudgetPlan,
  type Entry,
} from "@/content/budget-rules";
import { curriculum, numericAnswer } from "@/content/learning";
import { useAuth } from "@/contexts/auth-context";
import { usePalette, themedStyles, radii } from "@/constants/finlit-theme";

function BudgetInput({
  label,
  value,
  onChange,
  amount = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  amount?: boolean;
  disabled?: boolean;
}) {
  const s = useLearningStyles();
  const palette = usePalette();
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.body}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        editable={!disabled}
        keyboardType={amount ? "decimal-pad" : "default"}
        style={{
          minHeight: 52,
          borderWidth: 1,
          borderColor: palette.line,
          borderRadius: 12,
          padding: 12,
          fontSize: 16,
          color: palette.ink,
          backgroundColor: palette.surface,
        }}
      />
    </View>
  );
}
export function BudgetScreen({
  mode = "overview",
}: {
  mode?: "overview" | "create" | "transaction";
}) {
  const { user } = useAuth();
  return <BudgetBody key={user?.id + mode} mode={mode} />;
}
function BudgetBody({ mode }: { mode: "overview" | "create" | "transaction" }) {
  const b = useBudgetStyles();
  const palette = usePalette();
  const s = useLearningStyles();

  const {
      from,
      plan: planId,
      entry: entryId,
      location: locationId,
    } = useLocalSearchParams<{
      from?: string;
      plan?: string;
      entry?: string;
      location?: string;
    }>(),
    router = useRouter();
  const returnLesson = curriculum
    .flatMap((m) => m.lessons)
    .find((l) => l.id === from);
  const [data, setData] = useState<BudgetData | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState(planId ?? ""),
    [month, setMonth] = useState(localDate().slice(0, 7)),
    [chart, setChart] = useState("plan"),
    [visibleCount, setVisibleCount] = useState(5),
    [showInsights, setShowInsights] = useState(false);
  const lock = useRef(false),
    alive = useRef(true),
    generation = useRef(0),
    activeReload = useRef(reload);
  activeReload.current = reload;
  useFocusEffect(
    useCallback(() => {
      if (activeReload.current !== reload) return;
      let active = true;
      generation.current++;
      alive.current = true;
      setLoading(true);
      setError("");
      learningApi<BudgetData>("budget")
        .then((d) => {
          if (active) setData(d);
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
        generation.current++;
        alive.current = false;
      };
    }, [reload]),
  );
  async function run(action: (current: () => boolean) => Promise<void>) {
    if (lock.current) return;
    const token = generation.current;
    const current = () => alive.current && generation.current === token;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action(current);
    } catch (e) {
      if (current())
        setError(e instanceof Error ? e.message : "Save failed. Please retry.");
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const route = (path: string, extra = "") =>
    router.push(
      (path +
        (returnLesson
          ? "?from=" + returnLesson.id + (extra ? "&" + extra : "")
          : extra
            ? "?" + extra
            : "")) as never,
    );
  const goOverview = (savedPlan = planId) =>
    router.replace(
      ("/budget?" +
        [
          returnLesson ? "from=" + returnLesson.id : "",
          savedPlan ? "plan=" + savedPlan : "",
        ]
          .filter(Boolean)
          .join("&")) as never,
    );
  const plan =
    data?.plans.find((p) => p.id === selected) ??
    data?.plans.find(
      (p) => p.period_start <= localDate() && p.period_end >= localDate(),
    ) ??
    data?.plans[0];
  const totals = useMemo(
    () =>
      budgetTotals(
        plan ?? { ...monthPeriod(month), planned_income: 0, allocations: {} },
        data?.entries ?? [],
      ),
    [plan, month, data?.entries],
  );
  const guidance = returnLesson ? (
    <ToneCard tone="lilac">
      <View style={s.stack}>
        <Text style={s.body}>
          Apply “{returnLesson.title}” using your own information. Your lesson
          completion is already saved. This step is optional.
        </Text>
        <LearningButton
          title="Return to learning"
          secondary
          disabled={busy}
          onPress={() =>
            router.replace(
              ("/learn/lesson/" + returnLesson.id + "?play=1") as never,
            )
          }
        />
      </View>
    </ToneCard>
  ) : null;
  const errors = error ? (
    <View style={s.stack}>
      <Text accessibilityRole="alert" style={s.body}>
        {error}
      </Text>
      <LearningButton
        title="Reload account data"
        secondary
        disabled={busy}
        onPress={() => setReload((n) => n + 1)}
      />
    </View>
  ) : null;
  let content;
  if (loading)
    content = <Text style={s.body}>Loading your budget records…</Text>;
  else if (!data) content = errors;
  else if (
    (mode === "create" && planId && !data.plans.some((p) => p.id === planId)) ||
    (mode === "transaction" &&
      entryId &&
      !data.entries.some((e) => e.id === entryId))
  )
    content = (
      <Text style={s.body}>
        This record is unavailable. Return to your budget and reload.
      </Text>
    );
  else if (mode === "create")
    content = (
      <>
        <BudgetForm
          key={(planId ?? "new") + ":" + reload}
          data={data}
          plan={data.plans.find((p) => p.id === planId)}
          busy={busy}
          onSave={(payload) =>
            run(async (current) => {
              const saved = await learningApi<BudgetPlan>(
                "save_budget",
                payload,
              );
              if (current()) goOverview(saved.id);
            })
          }
        />
        {planId && (
          <LearningButton
            title="Plan another period"
            secondary
            disabled={busy}
            onPress={() => route("/budget/create")}
          />
        )}
        {errors}
      </>
    );
  else if (mode === "transaction")
    content = (
      <>
        <TransactionForm
          key={(entryId ?? "new") + ":" + (locationId ?? "") + ":" + reload}
          data={data}
          entry={data.entries.find((e) => e.id === entryId)}
          initialLocation={locationId}
          busy={busy}
          onSave={(payload) =>
            run(async (current) => {
              await learningApi(entryId ? "update_entry" : "entry", payload);
              if (current()) goOverview();
            })
          }
          onDelete={() =>
            run(async (current) => {
              const entry = data.entries.find((e) => e.id === entryId)!;
              await learningApi("delete_entry", {
                id: entry.id,
                revision: entry.revision,
              });
              if (current()) goOverview();
            })
          }
        />
        {errors}
      </>
    );
  else {
    const activeChart = chart === "plan" && !plan ? "categories" : chart;
    const insights = budgetInsights(data, plan, undefined, totals);
    content = (
      <>
        {errors}
        <View style={b.titleRow}>
          <Text style={[s.title, { flex: 1 }]}>Monthly budget</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Record a transaction"
            onPress={() => route("/budget/add", plan ? "plan=" + plan.id : "")}
            style={b.add}
          >
            <Ionicons name="add" size={24} color={palette.surface} />
          </Pressable>
        </View>
        <Text style={s.note}>
          Record your money. Make room for what matters.
        </Text>
        {(plan
          ? data.plans.length > 1
          : new Set([
              localDate().slice(0, 7),
              ...data.entries.map((e) => e.occurred_on.slice(0, 7)),
            ]).size > 1) && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {plan
              ? data.plans.map((p) => (
                  <Pressable
                    key={p.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: plan.id === p.id }}
                    style={[b.chip, plan.id === p.id && b.selected]}
                    onPress={() => {
                      setSelected(p.id);
                      setVisibleCount(5);
                    }}
                  >
                    <Text style={s.body}>
                      {p.period_start} to {p.period_end}
                    </Text>
                  </Pressable>
                ))
              : [
                  ...new Set([
                    localDate().slice(0, 7),
                    ...data.entries.map((e) => e.occurred_on.slice(0, 7)),
                  ]),
                ]
                  .sort()
                  .reverse()
                  .map((m) => (
                    <Pressable
                      key={m}
                      accessibilityRole="button"
                      accessibilityState={{ selected: month === m }}
                      style={[b.chip, month === m && b.selected]}
                      onPress={() => {
                        setMonth(m);
                        setVisibleCount(5);
                      }}
                    >
                      <Text style={s.body}>{m}</Text>
                    </Pressable>
                  ))}
          </ScrollView>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add an entry from cash flow"
          onPress={() => route("/budget/add", plan ? "plan=" + plan.id : "")}
        >
          <ToneCard tone="blush">
            <View style={{ gap: 8 }}>
              <Text style={s.label}>TRACKED NET CASH FLOW</Text>
              <Text style={b.amount}>{money(totals.net)}</Text>
              <Text style={s.body}>
                Received income: {money(totals.income)}
                {"\n"}Expenses: {money(totals.spent)}
              </Text>
              <Text style={s.note}>
                {plan ? `${plan.period_start} to ${plan.period_end}` : month} ·
                Recorded activity only, not a bank or wallet balance. Tap to add
                an entry →
              </Text>
            </View>
          </ToneCard>
        </Pressable>
        {plan ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View planned budget"
            onPress={() => route("/budget/create", "plan=" + plan.id)}
          >
            <ToneCard tone="blue">
              <View style={{ gap: 6 }}>
                <Text style={s.heading}>Planned budget</Text>
                <Text style={s.body}>
                  Planned income: {money(plan.planned_income)}
                </Text>
                <Text style={s.body}>
                  Allocated: {money(totals.allocated)} ·{" "}
                  {totals.unallocated >= 0 ? "Unallocated" : "Shortfall"}:{" "}
                  {money(Math.abs(totals.unallocated))}
                </Text>
                <Text style={s.note}>
                  Estimates for this period, not recorded entries. View or edit
                  plan →
                </Text>
              </View>
            </ToneCard>
          </Pressable>
        ) : (
          <ToneCard tone="blue">
            <Text style={s.heading}>No budget yet</Text>
            <Text style={s.body}>
              Plan what you expect to receive and spend. Record actual money
              separately using the cash-flow card.
            </Text>
            <LearningButton
              title="Create a budget"
              onPress={() => route("/budget/create")}
            />
          </ToneCard>
        )}
        <MoneyLocations
          data={data}
          busy={busy}
          onEntry={(id) =>
            route(
              "/budget/add",
              "location=" + id + (plan ? "&plan=" + plan.id : ""),
            )
          }
          onSave={(action, payload, done) =>
            run(async (current) => {
              await learningApi(action, payload);
              const updated = await learningApi<BudgetData>("budget");
              if (current()) {
                setData(updated);
                done();
              }
            })
          }
        />
        <LearningButton title="Mobile Money SMS tracking" secondary onPress={() => route("/budget/sms")}/>
        <Text style={s.heading}>Your money in view</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {[
            ["plan", "Plan vs actual"],
            ["categories", "Categories"],
            ["entries", "Entries"],
            ["trend", "Over time"],
            ["cash", "Income vs expenses"],
          ]
            .filter(([key]) => key !== "plan" || !!plan)
            .map(([key, label]) => (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: activeChart === key }}
                onPress={() => setChart(key)}
                style={[b.chip, activeChart === key && b.selected]}
              >
                <Text style={s.body}>{label}</Text>
              </Pressable>
            ))}
        </ScrollView>
        {activeChart === "entries" && (
          <>
            <Text style={s.heading}>Your transactions</Text>
            <View>
              {totals.entries.slice(0, visibleCount).map((e) => (
                <Pressable
                  key={e.id}
                  accessibilityRole="button"
                  accessibilityLabel="View or correct transaction"
                  onPress={() =>
                    route(
                      "/budget/add",
                      "entry=" + e.id + (plan ? "&plan=" + plan.id : ""),
                    )
                  }
                  style={b.entry}
                >
                  <View style={b.categoryIcon}>
                    <Ionicons
                      name={
                        e.entry_type === "transfer"
                          ? "swap-horizontal-outline"
                          : e.entry_type === "income"
                            ? "wallet-outline"
                            : categoryIcon(
                                data.categories.find(
                                  (c) => c.id === e.category_id,
                                )?.name ?? "",
                              )
                      }
                      size={18}
                      color={palette.ink}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={s.body}>
                      {e.entry_type === "transfer"
                        ? "Own-money transfer"
                        : (data.categories.find((c) => c.id === e.category_id)
                            ?.name ?? "Category unavailable")}
                    </Text>
                    <Text style={s.note}>
                      {e.occurred_on}
                      {e.description ? " · " + e.description : ""}
                    </Text>
                    {!!e.fee_amount && (
                      <Text style={s.note}>
                        Fee expense: {money(e.fee_amount)}
                      </Text>
                    )}
                  </View>
                  <Text style={b.entryAmount}>
                    {e.entry_type === "transfer"
                      ? "↔"
                      : e.entry_type === "income"
                        ? "+"
                        : "−"}
                    {money(e.amount)}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={14}
                    color={palette.muted}
                  />
                </Pressable>
              ))}
            </View>
            {totals.entries.length > visibleCount && (
              <LearningButton
                title="Show more transactions"
                secondary
                onPress={() => setVisibleCount((n) => n + 20)}
              />
            )}
            {totals.entries.length === 0 && (
              <Text style={s.body}>
                No transactions recorded in this period. Add actual income,
                expenses or transfers when you are ready.
              </Text>
            )}
          </>
        )}
        {activeChart === "categories" && (
          <DonutChart
            title="Spending by category"
            total={totals.spent}
            format={money}
            values={Object.entries(totals.categories).map(([id, value]) => ({
              label:
                data.categories.find((c) => c.id === id)?.name ??
                "Category unavailable",
              value,
            }))}
          />
        )}
        {activeChart === "plan" && plan && (
          <BarChart
            title="Planned versus recorded spending"
            format={money}
            rows={[
              ...new Set([
                ...Object.keys(plan.allocations),
                ...Object.keys(totals.categories),
              ]),
            ]
              .filter(
                (id) =>
                  (plan.allocations[id] ?? 0) > 0 ||
                  (totals.categories[id] ?? 0) > 0,
              )
              .map((id) => ({
                label:
                  data.categories.find((c) => c.id === id)?.name ??
                  "Category unavailable",
                values: [
                  { label: "Planned", value: plan.allocations[id] ?? 0 },
                  { label: "Recorded", value: totals.categories[id] ?? 0 },
                ],
              }))}
          />
        )}
        {activeChart === "trend" && (
          <>
            <BarChart
              title="Recorded spending by date"
              format={money}
              rows={totals.days.map((day) => ({
                label: day.date,
                values: [{ label: "Expenses", value: day.value }],
              }))}
            />
            <Text style={s.note}>
              Only dates with recorded expenses are shown. Missing records do
              not establish that no spending occurred.
            </Text>
          </>
        )}
        {activeChart === "cash" && (
          <>
            <BarChart
              title="Received income and expenses"
              format={money}
              rows={[
                {
                  label: "Selected period",
                  values: [
                    { label: "Received income", value: totals.income },
                    { label: "Expenses including fees", value: totals.spent },
                  ],
                },
              ]}
            />
            <Text style={s.note}>
              Own-money transfers are excluded. Tracked net cash flow:{" "}
              {money(totals.net)}.
            </Text>
          </>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Spending insights"
          accessibilityState={{ expanded: showInsights }}
          onPress={() => setShowInsights((v) => !v)}
          style={b.chip}
        >
          <Text style={s.body}>
            Spending insights {showInsights ? "−" : "+"}
          </Text>
        </Pressable>
        {showInsights && (
          <>
            <View style={s.card}>
              <Text style={s.heading}>Educational spending insights</Text>
              <Text style={s.body}>
                Allow Finlit to compare your recorded spending with your
                allocations and suggest relevant lessons. This is optional and
                can be turned off here. It does not affect learning access.
              </Text>
              <LearningButton
                title={
                  data.insights
                    ? "Turn personalised insights off"
                    : "Allow personalised insights"
                }
                secondary
                disabled={busy}
                onPress={() =>
                  void run(async (current) => {
                    const enabled = await learningApi<boolean>("consent", {
                      enabled: !data.insights,
                    });
                    if (current()) setData({ ...data, insights: enabled });
                  })
                }
              />
            </View>
            {insights.map((i) => (
              <ToneCard key={i.id} tone="mint">
                <View style={s.stack}>
                  <Text style={s.body}>{i.text}</Text>
                  <LearningButton
                    title="Explore the related lesson"
                    secondary
                    onPress={() =>
                      router.push(("/learn/lesson/" + i.lesson) as never)
                    }
                  />
                </View>
              </ToneCard>
            ))}
          </>
        )}
      </>
    );
  }
  const page = (
    <Screen>
      {mode !== "overview" && (
        <Header
          title={
            mode === "create"
              ? "Plan your budget"
              : entryId
                ? "Edit entry"
                : "Add entry"
          }
          back
        />
      )}
      <View style={s.stack}>
        {guidance}
        {content}
      </View>
    </Screen>
  );
  return mode === "overview" ? (
    <StudentShell>{page}</StudentShell>
  ) : (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {page}
    </KeyboardAvoidingView>
  );
}
function BudgetForm({
  data,
  plan,
  busy,
  onSave,
}: {
  data: BudgetData;
  plan?: BudgetPlan;
  busy: boolean;
  onSave: (payload: object) => Promise<void>;
}) {
  const s = useLearningStyles();

  const [start, setStart] = useState(
      plan?.period_start ?? monthPeriod().period_start,
    ),
    [end, setEnd] = useState(plan?.period_end ?? monthPeriod().period_end);
  const [income, setIncome] = useState(plan ? String(plan.planned_income) : ""),
    [allocations, setAllocations] = useState<Record<string, string>>(
      Object.fromEntries(
        Object.entries(plan?.allocations ?? {}).map(([k, v]) => [k, String(v)]),
      ),
    ),
    [validation, setValidation] = useState("");
  const categories = data.categories.filter((c) => c.entry_type === "expense");
  const draft = budgetTotals(
    {
      period_start: start,
      period_end: end,
      planned_income: numericAnswer(income) ?? 0,
      allocations: Object.fromEntries(
        Object.entries(allocations).map(([id, value]) => [
          id,
          numericAnswer(value) ?? 0,
        ]),
      ),
    },
    [],
  );
  const save = () => {
    if (
      !validDate(start) ||
      !validDate(end) ||
      start > end ||
      numericAnswer(income) === null ||
      Object.values(allocations).some(
        (v) => v !== "" && numericAnswer(v) === null,
      )
    ) {
      setValidation(
        "Use valid dates in YYYY-MM-DD format and non-negative amounts with at most two decimals.",
      );
      return;
    }
    setValidation("");
    void onSave({
      start,
      end,
      income: Number(income),
      allocations: Object.fromEntries(
        categories.map((c) => [c.id, Number(allocations[c.id] || 0)]),
      ),
      revision: plan?.revision ?? 0,
    });
  };
  return (
    <View style={s.stack}>
      <Text style={s.body}>
        These are planned figures, not actual entries. Use your own estimates
        for this period. Include essential needs first. A shortfall can be saved
        so that unmet needs remain visible.
      </Text>
      <BudgetInput
        label="Period start (YYYY-MM-DD)"
        value={start}
        onChange={setStart}
        disabled={busy || !!plan}
      />
      <BudgetInput
        label="Period end (YYYY-MM-DD)"
        value={end}
        onChange={setEnd}
        disabled={busy}
      />
      <BudgetInput
        label="Planned income (K)"
        value={income}
        onChange={setIncome}
        amount
        disabled={busy}
      />
      {categories.map((c) => (
        <BudgetInput
          key={c.id}
          label={c.name + " allocation (K)"}
          value={allocations[c.id] ?? ""}
          onChange={(v) => setAllocations({ ...allocations, [c.id]: v })}
          amount
          disabled={busy}
        />
      ))}
      <Text style={s.heading}>Allocated: {money(draft.allocated)}</Text>
      <Text style={s.body}>
        Unallocated / shortfall: {money(draft.unallocated)}
      </Text>
      {!!validation && (
        <Text accessibilityRole="alert" style={s.body}>
          {validation}
        </Text>
      )}
      <LearningButton
        title={busy ? "Saving…" : "Save budget"}
        disabled={busy || !categories.length}
        onPress={save}
      />
    </View>
  );
}
function TransactionForm({
  initialLocation,
  data,
  entry,
  busy,
  onSave,
  onDelete,
}: {
  data: BudgetData;
  entry?: Entry;
  initialLocation?: string;
  busy: boolean;
  onSave: (payload: object) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const b = useBudgetStyles();
  const palette = usePalette();
  const s = useLearningStyles();

  const [location, setLocation] = useState(
    entry?.location_id ?? initialLocation ?? "",
  );
  const [destination, setDestination] = useState(
    entry?.destination_location_id ?? "",
  );
  const [choosingCategory, setChoosingCategory] = useState(!entry?.category_id);
  const [type, setType] = useState(entry?.entry_type ?? "expense"),
    [amount, setAmount] = useState(entry ? String(entry.amount) : ""),
    [category, setCategory] = useState(entry?.category_id ?? ""),
    [date, setDate] = useState(entry?.occurred_on ?? localDate()),
    [description, setDescription] = useState(entry?.description ?? ""),
    [validation, setValidation] = useState("");
  const [fee, setFee] = useState(String(entry?.fee_amount ?? 0)),
    [feeCategory] = useState(
      entry?.fee_category_id ??
        data.categories.find(
          (c) => c.entry_type === "expense" && c.name === "Transaction fees",
        )?.id ??
        "",
    ),
    [confirmDelete, setConfirmDelete] = useState(false);
  // Collision-resistant retry identifier, not an authentication secret.
  const request = useRef(
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = Math.floor(Math.random() * 16);
      return (c === "x" ? r : (r & 3) | 8).toString(16);
    }),
  );
  const save = () => {
    if (
      numericAnswer(amount) === null ||
      Number(amount) <= 0 ||
      (type !== "transfer" && !category) ||
      !validDate(date) ||
      date > localDate() ||
      description.length > 500 ||
      (fee !== "" && numericAnswer(fee) === null)
    ) {
      setValidation(
        "Enter a positive amount, choose the matching categories and use an actual date (YYYY-MM-DD). Fees must be non-negative. Notes can contain up to 500 characters.",
      );
      return;
    }
    if (
      type === "transfer" &&
      location &&
      (!destination || destination === location)
    ) {
      setValidation("Choose a different destination for this transfer.");
      return;
    }
    if (
      initialLocation &&
      !data.locations?.some((l) => l.id === location && l.active)
    ) {
      setValidation(
        "This location is unavailable. Return to your budget and reload.",
      );
      return;
    }
    setValidation("");
    void onSave({
      location: location || null,
      destination: type === "transfer" ? destination || null : null,
      type,
      amount: Number(amount),
      category: type === "transfer" ? null : category,
      date,
      description,
      request: request.current,
      fee: Number(fee || 0),
      feeCategory: Number(fee) > 0 ? feeCategory || null : null,
      ...(entry ? { id: entry.id, revision: entry.revision } : {}),
    });
  };
  return (
    <View style={s.stack}>
      <View style={b.segment}>
        {["income", "expense"].map((t) => (
          <Pressable
            key={t}
            accessibilityRole="button"
            accessibilityState={{
              selected: type === t || (t === "expense" && type === "transfer"),
              disabled: busy,
            }}
            disabled={busy}
            onPress={() => {
              setType(t);
              setCategory("");
              setChoosingCategory(true);
            }}
            style={[
              b.segmentItem,
              (type === t || (t === "expense" && type === "transfer")) &&
                b.selected,
            ]}
          >
            <Text style={s.body}>
              {(type === t || (t === "expense" && type === "transfer")
                ? "● "
                : "○ ") +
                (t === "income"
                  ? "Income"
                  : t === "expense"
                    ? "Expense"
                    : "Transfer")}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={s.note}>
        {type === "income"
          ? "Record money received before any fee deducted. Loans received are borrowed money, not earnings."
          : type === "transfer"
            ? "Moving your own money does not count as income or spending. Only the fee is an expense."
            : "Enter the purchase or repayment amount without the fee."}
      </Text>
      <LocationPicker
        locations={data.locations ?? []}
        value={location}
        onChange={(id) => {
          setLocation(id);
          setDestination("");
        }}
        disabled={busy}
        allowUnassigned={!entry?.location_id && !initialLocation}
      />
      {!!location && (
        <Text style={s.note}>
          Opening date:{" "}
          {data.locations?.find((l) => l.id === location)?.opening_date}. Record
          only activity on or after this date that is not already included in
          the opening balance.
        </Text>
      )}
      {type === "transfer" && !!location && (
        <LocationPicker
          label="Destination"
          locations={(data.locations ?? []).filter((l) => l.id !== location)}
          value={destination}
          onChange={setDestination}
          disabled={busy}
          allowUnassigned={false}
        />
      )}
      <BudgetInput
        label="Amount (K)"
        value={amount}
        onChange={setAmount}
        amount
        disabled={busy}
      />
      <BudgetInput
        label="Transfer fee (K, optional)"
        value={fee}
        onChange={setFee}
        amount
        disabled={busy}
      />
      <Text style={s.note}>
        Enter only a fee you paid. It is counted once as an expense; do not add
        it to the amount above.
      </Text>
      {type !== "income" && (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel="Moving between my own accounts"
          accessibilityState={{ checked: type === "transfer", disabled: busy }}
          disabled={busy}
          onPress={() => {
            setType(type === "transfer" ? "expense" : "transfer");
            setCategory("");
            setChoosingCategory(true);
          }}
          style={b.chip}
        >
          <Text style={s.body}>
            {type === "transfer" ? "☑" : "☐"} Moving between my own accounts
          </Text>
        </Pressable>
      )}
      {type !== "transfer" && (
        <>
          <Text style={s.heading}>Category</Text>
          {category && !choosingCategory ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change category"
              onPress={() => setChoosingCategory(true)}
              style={[
                b.chip,
                { flexDirection: "row", alignItems: "center", gap: 8 },
              ]}
            >
              <Ionicons
                name={categoryIcon(
                  data.categories.find((c) => c.id === category)?.name ?? "",
                )}
                size={18}
                color={palette.ink}
              />
              <Text style={s.body}>
                {data.categories.find((c) => c.id === category)?.name ??
                  "Category unavailable"}{" "}
                · Change
              </Text>
            </Pressable>
          ) : (
            <View style={b.categories}>
              {data.categories
                .filter(
                  (c) =>
                    c.entry_type === type &&
                    (c.name !== "Transaction fees" || c.id === category) &&
                    (c.name !== "Savings" || c.id === category),
                )
                .map((c) => (
                  <Pressable
                    key={c.id}
                    accessibilityRole="radio"
                    accessibilityState={{
                      checked: category === c.id,
                      disabled: busy,
                    }}
                    disabled={busy}
                    accessibilityLabel={c.name}
                    style={[
                      b.chip,
                      { flexDirection: "row", alignItems: "center", gap: 7 },
                      category === c.id && b.selected,
                    ]}
                    onPress={() => {
                      setCategory(c.id);
                      setChoosingCategory(false);
                    }}
                  >
                    <Ionicons
                      name={categoryIcon(c.name)}
                      size={18}
                      color={palette.ink}
                    />
                    <Text style={s.body}>
                      {category === c.id ? "●" : "○"} {c.name}
                    </Text>
                  </Pressable>
                ))}
            </View>
          )}
        </>
      )}
      <BudgetInput
        label="Transaction date (YYYY-MM-DD)"
        value={date}
        onChange={setDate}
        disabled={busy}
      />
      <BudgetInput
        label="Description (optional)"
        value={description}
        onChange={setDescription}
        disabled={busy}
      />
      {!!validation && (
        <Text accessibilityRole="alert" style={s.body}>
          {validation}
        </Text>
      )}
      <LearningButton
        title={busy ? "Saving…" : "Save transaction"}
        disabled={busy}
        onPress={save}
      />
      {entry &&
        (!confirmDelete ? (
          <LearningButton
            title="Delete transaction"
            secondary
            disabled={busy}
            onPress={() => setConfirmDelete(true)}
          />
        ) : (
          <View style={s.card}>
            <Text style={s.heading}>Delete this transaction?</Text>
            <Text style={s.body}>
              This removes {money(entry.amount)} and any attached fee from your
              records and summaries.
            </Text>
            <LearningButton
              title="Confirm deletion"
              disabled={busy}
              onPress={() => void onDelete()}
            />
            <LearningButton
              title="Keep transaction"
              secondary
              disabled={busy}
              onPress={() => setConfirmDelete(false)}
            />
          </View>
        ))}
    </View>
  );
}

const useBudgetStyles = themedStyles((palette) => ({
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 16,
  },
  add: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: palette.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  amount: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: "500",
    color: palette.ink,
  },
  entry: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 72,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: palette.line,
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.mint,
  },
  entryAmount: {
    maxWidth: "40%",
    fontSize: 14,
    fontWeight: "500",
    color: palette.ink,
  },
  segment: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: radii.pill,
    backgroundColor: palette.line,
  },
  segmentItem: {
    flex: 1,
    minHeight: 44,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  selected: { backgroundColor: palette.surface, borderColor: palette.ink },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radii.pill,
    justifyContent: "center",
  },
  categories: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
}));

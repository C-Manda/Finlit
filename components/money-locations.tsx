import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { usePalette } from "@/constants/finlit-theme";
import {
  currency,
  localDate,
  validDate,
  type BudgetData,
  type MoneyLocation,
} from "@/content/budget-rules";
import { Field, OverflowMenu } from "./finlit-ui";
import { LearningButton } from "./lesson-player";
import { useLearningStyles } from "./learning-screens";

// Stable per-form idempotency key, retained after a network failure.
export function moneyRequestId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 3) | 8).toString(16);
  });
}
export const locationName = (l: MoneyLocation) =>
  l.nickname ? `${l.provider} · ${l.nickname}` : l.provider;
const colours = [
  ["Blue", "#dce8f1"],
  ["Mint", "#d9eee5"],
  ["Lilac", "#e4def1"],
  ["Peach", "#f1dfd3"],
  ["Yellow", "#f6d365"],
  ["Red", "#f5b5b5"],
];
const validMoney = (v: string) => /^[0-9]{1,9}(\.[0-9]{1,2})?$/.test(v);

export function LocationPicker({
  locations,
  value,
  onChange,
  label = "Money location",
  disabled,
  allowUnassigned = true,
}: {
  locations: MoneyLocation[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled: boolean;
  allowUnassigned?: boolean;
}) {
  const s = useLearningStyles();
  const palette = usePalette();
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.heading}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {[
          ...(allowUnassigned
            ? [{ id: "", name: "Unassigned · reports only" }]
            : []),
          ...locations
            .filter((l) => l.active)
            .map((l) => ({
              id: l.id,
              name: `${locationName(l)} · ${currency(l.balance)}`,
            })),
        ].map((l) => (
          <Pressable
            key={l.id}
            accessibilityRole="radio"
            accessibilityLabel={`${label}: ${l.name}`}
            accessibilityState={{ checked: value === l.id, disabled }}
            aria-checked={value === l.id}
            disabled={disabled}
            onPress={() => onChange(l.id)}
            style={[
              s.card,
              {
                padding: 12,
                borderWidth: 1,
                borderColor: value === l.id ? palette.ink : palette.line,
              },
            ]}
          >
            <Text style={s.body}>
              {value === l.id ? "●" : "○"} {l.name}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function MoneyLocations({
  data,
  busy,
  onEntry,
  onSave,
}: {
  data: BudgetData;
  busy: boolean;
  onEntry: (id: string) => void;
  onSave: (action: string, payload: object, done: () => void) => Promise<void>;
}) {
  const s = useLearningStyles(),
    palette = usePalette(),
    router = useRouter();
  const [mode, setMode] = useState<"none" | "add" | "adjust" | "delete">(
    "none",
  );
  const [history, setHistory] = useState(false);
  const [customProvider, setCustomProvider] = useState(false);
  const [type, setType] = useState("mobile_money"),
    [provider, setProvider] = useState("MTN MoMo"),
    [nickname, setNickname] = useState("");
  const [colour, setColour] = useState("#dce8f1"),
    [opening, setOpening] = useState("0"),
    [date, setDate] = useState(localDate());
  const [selected, setSelected] = useState(""),
    [balance, setBalance] = useState(""),
    [reason, setReason] = useState(""),
    [error, setError] = useState("");
  const request = useRef(moneyRequestId());
  const locations = data.locations ?? [];
  const active = locations.filter((l) => l.active);
  const location = locations.find((l) => l.id === selected);
  const close = () => {
    setMode("none");
    setError("");
    request.current = moneyRequestId();
  };
  const start = (next: "add" | "adjust" | "delete") => {
    setMode(next);
    setError("");
    request.current = moneyRequestId();
    setOpening("0");
    setDate(localDate());
    setNickname("");
    setSelected("");
    setBalance("");
    setReason("");
  };
  const submit = () => {
    if (mode === "delete") {
      if (
        !location ||
        location.location_type === "cash" ||
        location.balance !== 0
      ) {
        setError(
          "Choose a location with a zero balance. Cash cannot be deleted.",
        );
        return;
      }
      void onSave(
        "delete_location",
        { location: location.id, request: request.current },
        close,
      );
      return;
    }
    if (mode === "add") {
      if (
        !validMoney(opening) ||
        !validDate(date) ||
        date > localDate() ||
        !provider.trim() ||
        provider.trim().length > 80 ||
        nickname.trim().length > 80
      ) {
        setError(
          "Enter a name, a non-negative opening balance with up to two decimals, and a valid opening date.",
        );
        return;
      }
      void onSave(
        "create_location",
        {
          type,
          provider: provider.trim(),
          nickname: nickname.trim(),
          colour,
          opening: Number(opening),
          date,
          request: request.current,
        },
        close,
      );
    } else {
      if (!location || !validMoney(balance) || reason.length > 500) {
        setError(
          "Choose a location and enter its correct non-negative balance. Reasons may contain up to 500 characters.",
        );
        return;
      }
      void onSave(
        "adjust_location",
        {
          location: location.id,
          balance: Number(balance),
          expected: location.balance,
          reason,
          request: request.current,
        },
        close,
      );
    }
  };
  return (
    <View style={s.stack}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={[s.heading, { flex: 1 }]}>My Money Locations</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add money location"
          disabled={busy}
          onPress={() => start("add")}
          style={{
            minHeight: 44,
            minWidth: 60,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Ionicons name="add" size={20} color={palette.ink} />
          <Text style={s.body}>Add</Text>
        </Pressable>
        <OverflowMenu
          label="Money Locations actions"
          items={[
            { label: "Correct a balance", onPress: () => start("adjust"), disabled: busy },
            { label: "Delete a location", onPress: () => start("delete"), disabled: busy || !active.some((l) => l.location_type !== "cash") },
            { label: history ? "Hide balance history" : "Balance history", onPress: () => setHistory(value => !value), disabled: busy },
            { label: "Mobile Money SMS tracking", onPress: () => router.push("/budget/sms" as never), disabled: busy },
          ]}
        />
      </View>
      <Text style={s.note}>See where your money is kept</Text>
      <Text style={s.body}>Total Available Money</Text>
      <Text
        accessibilityLabel={`Total available money: ${currency(data.available ?? 0)}`}
        style={s.title}
      >
        {currency(data.available ?? 0)}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {active.map((l) => (
          <Pressable
            key={l.id}
            accessibilityRole="button"
            accessibilityLabel={`Add entry to ${locationName(l)}`}
            onPress={() => onEntry(l.id)}
            style={[
              s.card,
              {
                flexBasis: "46%",
                flexGrow: 1,
                backgroundColor: l.colour,
                gap: 6,
              },
            ]}
          >
            <Ionicons
              name={
                l.location_type === "bank"
                  ? "business-outline"
                  : l.location_type === "cash"
                    ? "cash-outline"
                    : "phone-portrait-outline"
              }
              size={22}
              color="#090b0c"
            />
            <Text style={[s.heading, { color: "#090b0c" }]}>
              {locationName(l)}
            </Text>
            <Text style={[s.heading, { color: "#090b0c" }]}>
              {currency(l.balance)}
            </Text>
            <Text style={[s.note, { color: "#333333" }]}>
              {l.location_type === "bank"
                ? "Bank account"
                : l.location_type === "cash"
                  ? "Cash"
                  : "Mobile Money"}{" "}
              · Add entry →
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={s.note}>Money distribution</Text>
      {(data.available ?? 0) > 0 ? (
        <View
          accessibilityRole="image"
          accessibilityLabel={active
            .map((l) => `${locationName(l)} ${currency(l.balance)}`)
            .join(", ")}
          style={{
            flexDirection: "row",
            height: 12,
            borderRadius: 6,
            overflow: "hidden",
          }}
        >
          {active
            .filter((l) => l.balance > 0)
            .map((l) => (
              <View
                key={l.id}
                style={{ flex: l.balance, backgroundColor: l.colour }}
              />
            ))}
        </View>
      ) : (
        <Text style={s.note}>
          Add your existing money with an opening balance or a balance
          correction.
        </Text>
      )}
      <Text style={s.note}>
        {active
          .filter((l) => l.balance > 0)
          .map(
            (l) =>
              `${locationName(l)} ${Math.round((l.balance / (data.available || 1)) * 100)}%`,
          )
          .join(" · ")}
      </Text>
      <Text style={s.note}>
        Opening balances and corrections are not income. Unassigned entries
        affect reports only.
      </Text>
      {mode !== "none" && (
        <View style={s.card}>
          <Text style={s.heading}>
            {mode === "add"
              ? "Add money location"
              : mode === "delete"
                ? "Delete a location"
                : "Correct a balance"}
          </Text>
          {mode === "add" ? (
            <>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {[
                  ["mobile_money", "Mobile Money"],
                  ["bank", "Bank account"],
                ].map(([t, label]) => (
                  <LearningButton
                    key={t}
                    title={(type === t ? "● " : "○ ") + label}
                    secondary
                    disabled={busy}
                    onPress={() => {
                      setType(t);
                      setCustomProvider(false);
                      setProvider(t === "bank" ? "" : "MTN MoMo");
                    }}
                  />
                ))}
              </View>
              {type === "mobile_money" ? (
                <>
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                  >
                    {["MTN MoMo", "Airtel Money"].map((p) => (
                      <LearningButton
                        key={p}
                        title={
                          (!customProvider && provider === p ? "● " : "○ ") + p
                        }
                        secondary
                        disabled={busy}
                        onPress={() => {
                          setCustomProvider(false);
                          setProvider(p);
                        }}
                      />
                    ))}
                    <LearningButton
                      title={(customProvider ? "● " : "○ ") + "Other provider"}
                      secondary
                      disabled={busy}
                      onPress={() => {
                        if (!customProvider) setProvider("");
                        setCustomProvider(true);
                      }}
                    />
                  </View>
                  {customProvider && (
                    <Field
                      label="Mobile money provider name"
                      value={provider}
                      onChangeText={setProvider}
                      editable={!busy}
                      maxLength={80}
                    />
                  )}
                </>
              ) : (
                <Field
                  label="Bank name"
                  value={provider}
                  onChangeText={setProvider}
                  editable={!busy}
                  maxLength={80}
                />
              )}
              <Field
                label="Nickname (optional)"
                value={nickname}
                onChangeText={setNickname}
                editable={!busy}
                maxLength={80}
              />
              {(type === "bank" || customProvider) && (
                <>
                  <Text style={s.body}>Card colour</Text>
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                  >
                    {colours.map(([name, c]) => (
                      <Pressable
                        key={c}
                        accessibilityRole="radio"
                        accessibilityLabel={`${name} card`}
                        aria-checked={colour === c}
                        accessibilityState={{
                          checked: colour === c,
                          disabled: busy,
                        }}
                        disabled={busy}
                        onPress={() => setColour(c)}
                        style={[s.card, { backgroundColor: c, padding: 12 }]}
                      >
                        <Text style={{ color: "#090b0c" }}>
                          {colour === c ? "● " : "○ "}
                          {name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
              <Field
                label="Opening balance (K)"
                value={opening}
                onChangeText={setOpening}
                keyboardType="decimal-pad"
                editable={!busy}
              />
              <Field
                label="Opening date (YYYY-MM-DD)"
                value={date}
                onChangeText={setDate}
                editable={!busy}
              />
              <Text style={s.note}>
                Money held at the start of this date, before entries dated that
                day. It adds to available money, not income. Enter only later
                activity against this location; earlier records stay unassigned.
              </Text>
            </>
          ) : mode === "delete" ? (
            <>
              <LocationPicker
                locations={active.filter((l) => l.location_type !== "cash")}
                value={selected}
                onChange={setSelected}
                disabled={busy}
                allowUnassigned={false}
              />
              <Text style={s.note}>
                This removes the location card. Its entries and balance history
                stay in your records. Cash cannot be deleted.
              </Text>
              {location && location.balance !== 0 && (
                <Text accessibilityRole="alert" style={s.body}>
                  Transfer the remaining {currency(location.balance)} or correct
                  the balance to zero before deleting this location.
                </Text>
              )}
              {location && location.balance === 0 && (
                <Text style={s.body}>Delete {locationName(location)}?</Text>
              )}
            </>
          ) : (
            <>
              <LocationPicker
                locations={locations}
                value={selected}
                onChange={(id) => {
                  setSelected(id);
                  setBalance(
                    String(locations.find((l) => l.id === id)?.balance ?? ""),
                  );
                }}
                disabled={busy}
                allowUnassigned={false}
              />
              <Field
                label="Correct balance (K)"
                value={balance}
                onChangeText={setBalance}
                keyboardType="decimal-pad"
                editable={!busy}
              />
              <Field
                label="Reason (optional)"
                value={reason}
                onChangeText={setReason}
                editable={!busy}
                maxLength={500}
              />
              <Text style={s.note}>
                Records a dated correction without changing income, expenses or
                the original opening balance.
              </Text>
            </>
          )}
          {!!error && (
            <Text accessibilityRole="alert" style={s.body}>
              {error}
            </Text>
          )}
          <LearningButton
            title={
              busy
                ? "Saving…"
                : mode === "add"
                  ? "Save money location"
                  : mode === "delete"
                    ? "Confirm deletion"
                    : "Save correction"
            }
            disabled={
              busy ||
              (mode === "delete" && (!location || location.balance !== 0))
            }
            onPress={submit}
          />
          <LearningButton
            title="Cancel"
            secondary
            disabled={busy}
            onPress={close}
          />
        </View>
      )}
      {history && (
        <View style={s.card}>
          {locations.map((l) => (
            <Text key={l.id} style={s.body}>
              {locationName(l)}
              {!l.active ? " · Deleted" : ""} · Opening{" "}
              {currency(l.opening_balance)} · {l.opening_date}
            </Text>
          ))}
          {(data.adjustments ?? []).map((a) => (
            <Text key={a.id} style={s.body}>
              {locations.find((l) => l.id === a.location_id)?.provider} ·{" "}
              {currency(a.amount)} correction ·{" "}
              {localDate(new Date(a.created_at))}
              {a.reason ? ` · ${a.reason}` : ""}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

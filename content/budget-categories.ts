import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

// Presentation only. Category IDs and ownership remain server controlled.
const icons: Record<string, ComponentProps<typeof Ionicons>["name"]> = {
  "Family & gifts": "gift-outline",
  "Work & business": "briefcase-outline",
  "Scholarships & grants": "school-outline",
  "Loans received": "cash-outline",
  "Other income": "add-circle-outline",
  "Food & groceries": "basket-outline",
  "Housing & utilities": "home-outline",
  Transport: "bus-outline",
  "Data & airtime": "wifi-outline",
  Education: "book-outline",
  "Health & personal care": "medkit-outline",
  Recreation: "game-controller-outline",
  "Family support": "people-outline",
  "Debt repayments": "receipt-outline",
  "Other expenses": "ellipsis-horizontal-circle-outline",
  "Transaction fees": "swap-horizontal-outline",
  Savings: "wallet-outline",
};
export const categoryIcon = (name: string) => icons[name] ?? "pricetag-outline";

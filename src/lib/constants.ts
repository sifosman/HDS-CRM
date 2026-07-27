export const LEAD_STATUS_LABELS: Record<string, string> = {
  new: "New",
  quoting: "Quoting",
  quoted: "Quoted",
  closing: "Closing",
  objection: "Objection",
  follow_up: "Follow Up",
  handover: "Handover",
  closed: "Closed",
  lost: "Lost",
};

export const LEAD_STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  quoting: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  quoted: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  closing: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  objection: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  follow_up: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  handover: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  closed: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  lost: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  none: "None",
  pending: "Pending",
  paid: "Paid",
  partial: "Partial",
  overdue: "Overdue",
};

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  none: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  paid: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  partial: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  overdue: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  carpenter: "Carpenter",
  bulk_buyer: "Bulk Buyer",
  retail: "Retail",
  unknown: "Unknown",
};

export const PIPELINE_STAGES = [
  "new",
  "quoting",
  "quoted",
  "closing",
  "objection",
  "follow_up",
  "handover",
  "closed",
] as const;

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "R0";
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  if (phone.startsWith("+27")) return phone;
  if (phone.startsWith("27")) return "+" + phone;
  if (phone.startsWith("0")) return "+27" + phone.slice(1);
  return phone;
}

export function timeAgo(value: string | null | undefined): string {
  if (!value) return "—";
  const now = new Date();
  const past = new Date(value);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(value);
}

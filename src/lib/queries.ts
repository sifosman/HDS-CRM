import { createClient } from "@/lib/supabase/server";
import type {
  CustomerProfile,
  Conversation,
  Quote,
  Branch,
  BankingDetail,
  HdsPrice,
  Invoice,
} from "@/lib/types";

export async function getDashboardStats() {
  const supabase = await createClient();

  const [customersRes, quotesRes, conversationsRes] = await Promise.all([
    supabase.from("customer_profiles").select("*"),
    supabase.from("quotes").select("total, created_at, status"),
    supabase
      .from("ai_conversations")
      .select("id, phone_number, role, content, lead_status, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const customers = (customersRes.data || []) as CustomerProfile[];
  const quotes = (quotesRes.data || []) as Pick<
    Quote,
    "total" | "created_at" | "status"
  >[];
  const recentActivity = (conversationsRes.data || []) as Pick<
    Conversation,
    "id" | "phone_number" | "role" | "content" | "lead_status" | "created_at"
  >[];

  const totalRevenue = quotes.reduce((sum, q) => sum + Number(q.total || 0), 0);
  const activeLeads = customers.filter(
    (c) => c.lead_status !== "closed" && c.lead_status !== "lost"
  ).length;

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const quotesThisWeek = quotes.filter(
    (q) => new Date(q.created_at) >= weekAgo
  ).length;

  const closedLeads = customers.filter(
    (c) => c.lead_status === "closed"
  ).length;
  const conversionRate =
    customers.length > 0
      ? Math.round((closedLeads / customers.length) * 100)
      : 0;

  // Pipeline stages
  const pipeline = [
    "new",
    "quoting",
    "quoted",
    "closing",
    "objection",
    "follow_up",
    "handover",
    "closed",
  ].map((stage) => ({
    stage,
    count: customers.filter((c) => c.lead_status === stage).length,
  }));

  // Monthly revenue (last 6 months)
  const monthlyRevenue: { month: string; revenue: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const monthName = d.toLocaleString("en-ZA", { month: "short" });
    const revenue = quotes
      .filter((q) => {
        const qd = new Date(q.created_at);
        return qd >= d && qd <= monthEnd;
      })
      .reduce((sum, q) => sum + Number(q.total || 0), 0);
    monthlyRevenue.push({ month: monthName, revenue });
  }

  return {
    totalRevenue,
    activeLeads,
    quotesThisWeek,
    conversionRate,
    totalCustomers: customers.length,
    pipeline,
    monthlyRevenue,
    recentActivity,
  };
}

export async function getCustomers(): Promise<CustomerProfile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_profiles")
    .select("*")
    .order("last_interaction_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data as CustomerProfile[];
}

export async function getCustomerByPhone(
  phone: string
): Promise<CustomerProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_profiles")
    .select("*")
    .eq("phone_number", phone)
    .single();
  if (error) return null;
  return data as CustomerProfile;
}

export async function getConversationsByPhone(
  phone: string,
  limit = 100
): Promise<Conversation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("*")
    .eq("phone_number", phone)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data as Conversation[];
}

export async function getQuotesByPhone(
  phone: string
): Promise<Quote[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("customer_phone", phone)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Quote[];
}

export async function getAllQuotes(): Promise<Quote[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Quote[];
}

export async function getBranches(): Promise<Branch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .order("trading_as", { ascending: true });
  if (error) throw error;
  return data as Branch[];
}

export async function getBankingDetails(): Promise<BankingDetail[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("banking_details")
    .select("*")
    .order("fx_branch", { ascending: true });
  if (error) throw error;
  return data as BankingDetail[];
}

export async function getPrices(): Promise<HdsPrice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hds_prices")
    .select("*")
    .order("description", { ascending: true });
  if (error) throw error;
  return data as HdsPrice[];
}

export async function getInvoices(): Promise<Invoice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Invoice[];
}

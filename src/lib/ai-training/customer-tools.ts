import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Customer lookup tools for the AI Training Advisor.
 *
 * These tools let the AI query the database on-demand when the user asks
 * about a specific customer or conversation. The AI does NOT get all customer
 * data in its context — it only fetches what's needed for the current question.
 *
 * All queries use the service-role admin client (bypasses RLS) since the
 * advisor is only accessible to owners and managers who already have full
 * data access via the dashboard.
 */

// ---------------------------------------------------------------------------
// Tool definitions (OpenAI/OpenRouter function-calling format)
// ---------------------------------------------------------------------------

export const customerToolDefinitions = [
  {
    type: "function" as const,
    function: {
      name: "search_customers",
      description:
        "Search customer profiles by name, phone number, or lead status. Returns a list of matching customers with their key details (name, phone, lead status, total quotes, total spent, last interaction, preferred branch, sales notes). Use this when the user asks about a customer by name or phone, or wants to see customers with a specific lead status (e.g. 'hot leads', 'customers who haven't bought yet').",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Search term — a customer name, phone number, or partial match. Leave empty to list all customers (limited to 50).",
          },
          lead_status: {
            type: "string",
            description: "Filter by lead status: 'hot', 'warm', 'cold', 'converted', 'new', or 'lost'.",
          },
          limit: {
            type: "integer",
            description: "Max results to return. Default 20, max 50.",
            default: 20,
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_customer_conversations",
      description:
        "Get the WhatsApp conversation history between a specific customer and the chatbot (William). Returns the actual messages exchanged — what the customer said and what the bot replied. Use this when the user wants to see how a conversation went, what a customer asked, or how the bot handled a specific situation.",
      parameters: {
        type: "object",
        properties: {
          phone_number: {
            type: "string",
            description: "The customer's phone number (e.g. '27821234567'). Use the phone_number from search_customers results.",
          },
          limit: {
            type: "integer",
            description: "Max messages to return. Default 50, max 200.",
            default: 50,
          },
        },
        required: ["phone_number"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_customer_quotes",
      description:
        "Get quotes and invoices for a specific customer. Returns quote numbers, totals, statuses, dates, and line items. Use this when the user asks about a customer's quote history, what they were quoted, or payment status.",
      parameters: {
        type: "object",
        properties: {
          phone_number: {
            type: "string",
            description: "The customer's phone number. Use the phone_number from search_customers results.",
          },
          limit: {
            type: "integer",
            description: "Max quotes to return. Default 20, max 50.",
            default: 20,
          },
        },
        required: ["phone_number"],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------

type CustomerRow = {
  id: string;
  phone_number: string;
  name: string | null;
  customer_type: string | null;
  email: string | null;
  city: string | null;
  lead_status: string | null;
  total_conversations: number | null;
  total_quotes: number | null;
  total_quote_value: number | null;
  last_quote_date: string | null;
  last_quote_total: number | null;
  payment_status: string | null;
  last_interaction_at: string | null;
  first_interaction_at: string | null;
  preferred_branch: string | null;
  preferred_material: string | null;
  sales_notes: string | null;
  objections: string[] | null;
  conversation_summary: string | null;
  close_attempt_count: number | null;
  objection_count: number | null;
  sale_outcome: string | null;
  follow_up_needed: boolean | null;
  follow_up_date: string | null;
  do_not_contact: boolean | null;
};

type ConversationRow = {
  id: string;
  phone_number: string;
  sender_name: string | null;
  role: string;
  message_text: string | null;
  quote_id: string | null;
  quote_total: number | null;
  lead_status: string | null;
  created_at: string;
};

type QuoteRow = {
  id: string;
  quote_number: string;
  customer_name: string;
  customer_phone: string;
  total: number;
  status: string;
  branch: string | null;
  source: string | null;
  created_at: string;
  quote_data: Record<string, unknown> | null;
};

type InvoiceRow = {
  id: string;
  invoice_number: string;
  quote_id: string;
  customer_name: string;
  customer_phone: string;
  total: number;
  status: string;
  payment_method: string | null;
  payment_date: string | null;
  created_at: string;
};

function formatCustomer(c: CustomerRow): Record<string, unknown> {
  return {
    name: c.name ?? "Unknown",
    phone: c.phone_number,
    lead_status: c.lead_status ?? "unknown",
    customer_type: c.customer_type ?? "unknown",
    city: c.city ?? "unknown",
    total_conversations: c.total_conversations ?? 0,
    total_quotes: c.total_quotes ?? 0,
    total_quote_value: c.total_quote_value != null ? Number(c.total_quote_value) : 0,
    last_quote_total: c.last_quote_total != null ? Number(c.last_quote_total) : null,
    last_quote_date: c.last_quote_date,
    payment_status: c.payment_status ?? "none",
    last_interaction: c.last_interaction_at,
    first_interaction: c.first_interaction_at,
    preferred_branch: c.preferred_branch ?? "none",
    preferred_material: c.preferred_material ?? "none",
    sales_notes: c.sales_notes ?? "",
    objections: c.objections ?? [],
    conversation_summary: c.conversation_summary ?? "",
    close_attempts: c.close_attempt_count ?? 0,
    objection_count: c.objection_count ?? 0,
    sale_outcome: c.sale_outcome ?? "none",
    follow_up_needed: c.follow_up_needed ?? false,
    follow_up_date: c.follow_up_date,
    do_not_contact: c.do_not_contact ?? false,
  };
}

function formatConversation(m: ConversationRow): Record<string, unknown> {
  return {
    from: m.role === "user" ? "customer" : "bot",
    sender_name: m.sender_name,
    message: m.message_text ?? "",
    timestamp: m.created_at,
    quote_id: m.quote_id,
    quote_total: m.quote_total != null ? Number(m.quote_total) : null,
    lead_status: m.lead_status,
  };
}

function formatQuote(q: QuoteRow): Record<string, unknown> {
  const items = q.quote_data?.items ?? q.quote_data?.lineItems ?? [];
  return {
    quote_number: q.quote_number,
    customer_name: q.customer_name,
    total: Number(q.total),
    status: q.status,
    branch: q.branch,
    source: q.source,
    created_at: q.created_at,
    items: Array.isArray(items) ? items.slice(0, 20) : [],
  };
}

function formatInvoice(i: InvoiceRow): Record<string, unknown> {
  return {
    invoice_number: i.invoice_number,
    customer_name: i.customer_name,
    total: Number(i.total),
    status: i.status,
    payment_method: i.payment_method,
    payment_date: i.payment_date,
    created_at: i.created_at,
  };
}

/**
 * Executes a customer tool call and returns the result as a JSON string.
 */
export async function executeCustomerTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<string> {
  try {
    switch (toolName) {
      case "search_customers":
        return JSON.stringify(await searchCustomers(args));
      case "get_customer_conversations":
        return JSON.stringify(await getCustomerConversations(args));
      case "get_customer_quotes":
        return JSON.stringify(await getCustomerQuotes(args));
      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Tool execution failed";
    return JSON.stringify({ error: msg });
  }
}

async function searchCustomers(args: Record<string, unknown>) {
  const admin = createAdminClient();
  const query = (args.query as string)?.trim() ?? "";
  const leadStatus = (args.lead_status as string)?.trim() ?? "";
  const limit = Math.min((args.limit as number) ?? 20, 50);

  let q = admin.from("customer_profiles").select("*").limit(limit);

  if (leadStatus) {
    q = q.eq("lead_status", leadStatus);
  }

  if (query) {
    // Try phone match first (exact or partial)
    const { data: phoneMatch } = await admin
      .from("customer_profiles")
      .select("*")
      .ilike("phone_number", `%${query}%`)
      .limit(limit);

    if (phoneMatch && phoneMatch.length > 0) {
      return {
        count: phoneMatch.length,
        customers: phoneMatch.map(formatCustomer),
      };
    }

    // Name search (case-insensitive partial match)
    const { data: nameMatch } = await admin
      .from("customer_profiles")
      .select("*")
      .ilike("name", `%${query}%`)
      .limit(limit);

    const results = nameMatch ?? [];
    return {
      count: results.length,
      customers: results.map(formatCustomer),
    };
  }

  const { data, error } = await q.order("last_interaction_at", {
    ascending: false,
    nullsFirst: false,
  });

  if (error) return { error: error.message };

  return {
    count: (data ?? []).length,
    customers: (data ?? []).map(formatCustomer),
  };
}

async function getCustomerConversations(args: Record<string, unknown>) {
  const admin = createAdminClient();
  const phoneNumber = (args.phone_number as string)?.trim();
  const limit = Math.min((args.limit as number) ?? 50, 200);

  if (!phoneNumber) {
    return { error: "phone_number is required" };
  }

  const { data, error } = await admin
    .from("ai_conversations")
    .select("*")
    .eq("phone_number", phoneNumber)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) return { error: error.message };

  const messages = (data ?? []).map(formatConversation);
  return {
    phone_number: phoneNumber,
    message_count: messages.length,
    messages,
  };
}

async function getCustomerQuotes(args: Record<string, unknown>) {
  const admin = createAdminClient();
  const phoneNumber = (args.phone_number as string)?.trim();
  const limit = Math.min((args.limit as number) ?? 20, 50);

  if (!phoneNumber) {
    return { error: "phone_number is required" };
  }

  const [quotesRes, invoicesRes] = await Promise.all([
    admin
      .from("quotes")
      .select("*")
      .eq("customer_phone", phoneNumber)
      .order("created_at", { ascending: false })
      .limit(limit),
    admin
      .from("invoices")
      .select("*")
      .eq("customer_phone", phoneNumber)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  return {
    phone_number: phoneNumber,
    quotes: (quotesRes.data ?? []).map(formatQuote),
    invoices: (invoicesRes.data ?? []).map(formatInvoice),
    quote_count: (quotesRes.data ?? []).length,
    invoice_count: (invoicesRes.data ?? []).length,
  };
}

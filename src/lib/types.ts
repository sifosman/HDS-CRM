export type CustomerProfile = {
  id: string;
  phone_number: string;
  name: string | null;
  customer_type: "carpenter" | "bulk_buyer" | "retail" | "unknown" | null;
  email: string | null;
  city: string | null;
  total_conversations: number;
  total_quotes: number;
  total_quote_value: number;
  last_quote_date: string | null;
  last_quote_total: number | null;
  payment_status: "none" | "pending" | "paid" | "partial" | "overdue" | null;
  lead_status:
    | "new"
    | "quoting"
    | "quoted"
    | "closing"
    | "objection"
    | "follow_up"
    | "handover"
    | "closed"
    | "lost"
    | null;
  last_interaction_at: string | null;
  first_interaction_at: string | null;
  preferred_branch: string | null;
  preferred_material: string | null;
  sales_notes: string | null;
  objections: string[] | null;
  conversation_summary: string | null;
  close_attempt_count: number;
  last_close_attempt_at: string | null;
  last_close_type: string | null;
  customer_response: string | null;
  objection_count: number;
  sale_outcome: "pending" | "won" | "lost" | "follow_up" | null;
  follow_up_needed: boolean;
  follow_up_date: string | null;
  created_at: string;
  updated_at: string;
};

export type Conversation = {
  id: string;
  phone_number: string;
  sender_name: string | null;
  role: "user" | "assistant" | "tool" | "system" | null;
  message_text: string | null;
  image_url: string | null;
  tool_calls: Record<string, unknown> | null;
  tool_results: Record<string, unknown> | null;
  lead_status: string | null;
  customer_type: string | null;
  quote_id: string | null;
  quote_total: number | null;
  conversation_metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type Quote = {
  id: string;
  filename: string;
  created_at: string;
  cutlist_id: string;
  expires_at: string | null;
  quote_number: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  project_name: string | null;
  quote_data: Record<string, unknown> | null;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  status: string | null;
  cutlist_url: string | null;
  expiry_date: string | null;
  trading_as: string | null;
  branch: string | null;
  branch_trading_as: string | null;
};

export type Branch = {
  id: number;
  branch_number: number | null;
  trading_as: string | null;
  branch_address: string | null;
  branch_telephone: string | null;
  whatsapp: string | null;
  email_address: string | null;
  created_at: string;
  updated_at: string;
};

export type BankingDetail = {
  id: number;
  fx_branch: string | null;
  account_name: string | null;
  account_number: string | null;
  account_type: string | null;
  created_at: string;
  updated_at: string;
};

export type HdsPrice = {
  ID: number;
  description: string | null;
  price: number | null;
  category: string | null;
  subcategory: string | null;
  color_family: string | null;
  decor_pattern: string | null;
  finish_type: string | null;
  surface_texture: string | null;
  dimensions: string | null;
  face_type: string | null;
  manufacturer: string | null;
  grade: string | null;
};

export type IntelligenceReport = {
  id: string;
  report_date: string;
  category: "competitor" | "pricing" | "product_demand" | "industry_trend";
  insight_summary: string;
  details: Record<string, unknown>;
  severity: "info" | "warning" | "critical";
  conversation_count: number;
  source_phones: string[];
  created_at: string;
};

export type Invoice = {
  id: string;
  invoice_number: string;
  quote_id: string | null;
  quote_number: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  total: number | null;
  status: string | null;
  created_at: string;
};

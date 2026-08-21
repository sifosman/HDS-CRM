/**
 * Meta WhatsApp Business Cloud API client.
 *
 * Server-only module. Reads credentials from environment variables:
 *  - WHATSAPP_ACCESS_TOKEN  (long-lived system-user token)
 *  - WHATSAPP_WABA_ID       (WhatsApp Business Account ID)
 *  - WHATSAPP_PHONE_NUMBER_ID (sender phone number ID)
 *
 * Graph API version is pinned to v23.0 (latest stable as of 2026).
 * If any of the three env vars is missing, `isMetaConfigured()` returns
 * false and the CRM falls back to draft-only mode.
 */

const GRAPH_API_BASE = "https://graph.facebook.com/v23.0";

export type MetaConfig = {
  accessToken: string;
  wabaId: string;
  phoneNumberId: string;
};

export function getMetaConfig(): MetaConfig | null {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const wabaId = process.env.WHATSAPP_WABA_ID;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !wabaId || !phoneNumberId) return null;
  return { accessToken, wabaId, phoneNumberId };
}

export function isMetaConfigured(): boolean {
  return getMetaConfig() !== null;
}

type MetaComponent = {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT";
  text?: string;
  buttons?: Array<{
    type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
    text: string;
    url?: string;
    phone_number?: string;
  }>;
};

export type CreateTemplateInput = {
  name: string;
  category: "marketing" | "utility" | "authentication";
  language: string;
  headerType?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | null;
  headerText?: string | null;
  bodyText: string;
  footer?: string | null;
  buttons?: Array<{
    type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
    text: string;
    url?: string;
    phone_number?: string;
  }>;
};

/**
 * Build the Meta Graph API `components` array from the CRM form fields.
 * Variable placeholders in body/header use the `{{1}}`, `{{2}}` format.
 */
export function buildMetaComponents(input: CreateTemplateInput): MetaComponent[] {
  const components: MetaComponent[] = [];

  if (input.headerType === "TEXT" && input.headerText) {
    components.push({ type: "HEADER", format: "TEXT", text: input.headerText });
  }

  components.push({ type: "BODY", text: input.bodyText });

  if (input.footer) {
    components.push({ type: "FOOTER", text: input.footer });
  }

  if (input.buttons && input.buttons.length > 0) {
    components.push({ type: "BUTTONS", buttons: input.buttons });
  }

  return components;
}

export type MetaApiError = {
  message: string;
  code?: number;
  fbtrace_id?: string;
};

export class MetaGraphApiError extends Error {
  code?: number;
  fbtrace_id?: string;
  constructor(error: MetaApiError) {
    super(error.message);
    this.name = "MetaGraphApiError";
    this.code = error.code;
    this.fbtrace_id = error.fbtrace_id;
  }
}

async function metaFetch(path: string, init: RequestInit): Promise<unknown> {
  const config = getMetaConfig();
  if (!config) {
    throw new MetaGraphApiError({
      message:
        "Meta is not configured. Set WHATSAPP_ACCESS_TOKEN, WHATSAPP_WABA_ID, and WHATSAPP_PHONE_NUMBER_ID.",
    });
  }

  const url = path.startsWith("http")
    ? path
    : `${GRAPH_API_BASE}/${path}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  const data = (await res.json()) as Record<string, unknown>;

  if (!res.ok) {
    const err = (data.error as MetaApiError) || {
      message: `Meta API error: ${res.status} ${res.statusText}`,
    };
    throw new MetaGraphApiError(err);
  }

  return data;
}

/**
 * Submit a message template to Meta for approval.
 * POST /{waba-id}/message_templates
 */
export async function createMetaTemplate(
  input: CreateTemplateInput
): Promise<{ id: string; status: string }> {
  const config = getMetaConfig();
  if (!config) throw new MetaGraphApiError({ message: "Meta not configured" });

  const body = {
    name: input.name,
    category: input.category.toUpperCase(),
    language: input.language,
    components: buildMetaComponents(input),
  };

  const data = (await metaFetch(`${config.wabaId}/message_templates`, {
    method: "POST",
    body: JSON.stringify(body),
  })) as { id: string; status: string };

  return { id: data.id, status: data.status };
}

/**
 * Fetch the current status of a template from Meta.
 * GET /{template-id}
 */
export async function getMetaTemplate(
  metaTemplateId: string
): Promise<{
  id: string;
  status: string;
  name: string;
  language: string;
  category: string;
  rejection_reason?: string;
  created_at?: number;
}> {
  const data = (await metaFetch(metaTemplateId, {
    method: "GET",
  })) as Record<string, unknown>;
  return {
    id: String(data.id),
    status: String(data.status ?? "pending"),
    name: String(data.name ?? ""),
    language: String(data.language ?? ""),
    category: String(data.category ?? ""),
    rejection_reason: data.rejection_reason
      ? String(data.rejection_reason)
      : undefined,
    created_at: data.created_at ? Number(data.created_at) : undefined,
  };
}

/**
 * List all templates for the WABA.
 * GET /{waba-id}/message_templates
 */
export async function listMetaTemplates(): Promise<
  Array<{
    id: string;
    name: string;
    status: string;
    language: string;
    category: string;
  }>
> {
  const config = getMetaConfig();
  if (!config) throw new MetaGraphApiError({ message: "Meta not configured" });

  const data = (await metaFetch(`${config.wabaId}/message_templates`, {
    method: "GET",
  })) as { data: Array<Record<string, unknown>> };

  return (data.data || []).map((t) => ({
    id: String(t.id),
    name: String(t.name ?? ""),
    status: String(t.status ?? "pending"),
    language: String(t.language ?? ""),
    category: String(t.category ?? ""),
  }));
}

/**
 * Delete a template from Meta.
 * DELETE /{waba-id}/message_templates?name={name}
 */
export async function deleteMetaTemplate(name: string): Promise<void> {
  const config = getMetaConfig();
  if (!config) throw new MetaGraphApiError({ message: "Meta not configured" });

  await metaFetch(`${config.wabaId}/message_templates?name=${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}

/**
 * Send a template message to a single recipient via Meta Cloud API.
 * POST /{phone-number-id}/messages
 */
export async function sendTemplateMessage(
  templateName: string,
  language: string,
  toPhone: string,
  components?: Record<string, unknown>
): Promise<{ wa_message_id: string }> {
  const config = getMetaConfig();
  if (!config) throw new MetaGraphApiError({ message: "Meta not configured" });

  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to: toPhone,
    type: "template",
    template: {
      name: templateName,
      language: { code: language },
    },
  };

  if (components) {
    body.template = { ...(body.template as object), components };
  }

  const data = (await metaFetch(`${config.phoneNumberId}/messages`, {
    method: "POST",
    body: JSON.stringify(body),
  })) as { message_id?: string };

  if (!data.message_id) {
    throw new MetaGraphApiError({ message: "No message_id returned by Meta" });
  }

  return { wa_message_id: data.message_id };
}

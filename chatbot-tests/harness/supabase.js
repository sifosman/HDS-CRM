// supabase.js — queries Supabase REST API for ai_conversations and customer_profiles.
// Uses the anon key (read access via "Allow all" RLS policies — see docs/gap-list.md GAP-03).
// No external dependency; uses Node 18+ global fetch.

/**
 * Poll ai_conversations for assistant replies to a given phone number after a timestamp.
 * @param {object} cfg - supabase config { url, anon_key }
 * @param {string} phoneNumber
 * @param {number} afterTimestampMs - epoch ms; only rows created after this are considered
 * @param {number} pollIntervalMs
 * @param {number} pollTimeoutMs
 * @returns {Promise<{rows: array, elapsed_ms: number}>} assistant rows ordered by created_at
 */
export async function pollForAssistantReplies(
  cfg,
  phoneNumber,
  afterTimestampMs,
  pollIntervalMs,
  pollTimeoutMs,
) {
  const afterIso = new Date(afterTimestampMs).toISOString();
  const start = Date.now();
  const deadline = start + pollTimeoutMs;

  // We order by created_at ascending and filter role=eq.assistant, phone_number=eq.<num>,
  // created_at=gte.<iso>. The REST API returns JSON.
  const baseUrl = `${cfg.url}/rest/v1/ai_conversations`;

  while (Date.now() < deadline) {
    const url =
      `${baseUrl}?phone_number=eq.${encodeURIComponent(phoneNumber)}` +
      `&role=eq.assistant` +
      `&created_at=gte.${encodeURIComponent(afterIso)}` +
      `&order=created_at.asc&limit=20`;
    try {
      const res = await fetch(url, {
        headers: {
          apikey: cfg.anon_key,
          Authorization: `Bearer ${cfg.anon_key}`,
          Accept: "application/json",
        },
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
          return { rows, elapsed_ms: Date.now() - start };
        }
      }
    } catch (err) {
      // network errors are retried by the poll loop
    }
    await sleep(pollIntervalMs);
  }
  return { rows: [], elapsed_ms: Date.now() - start };
}

/**
 * Fetch ALL conversation rows (user + assistant + tool) for a phone number after a timestamp.
 * Used for full-scenario assertions (tool_calls inspection, lead_status transitions, etc.).
 */
export async function fetchConversationLog(cfg, phoneNumber, afterTimestampMs) {
  const afterIso = new Date(afterTimestampMs).toISOString();
  const baseUrl = `${cfg.url}/rest/v1/ai_conversations`;
  const url =
    `${baseUrl}?phone_number=eq.${encodeURIComponent(phoneNumber)}` +
    `&created_at=gte.${encodeURIComponent(afterIso)}` +
    `&order=created_at.asc&limit=100`;
  const res = await fetch(url, {
    headers: {
      apikey: cfg.anon_key,
      Authorization: `Bearer ${cfg.anon_key}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase fetch failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/**
 * Fetch the customer_profile for a phone number. Used for lead_status assertions.
 */
export async function fetchCustomerProfile(cfg, phoneNumber) {
  const baseUrl = `${cfg.url}/rest/v1/customer_profiles`;
  const url = `${baseUrl}?phone_number=eq.${encodeURIComponent(phoneNumber)}&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: cfg.anon_key,
      Authorization: `Bearer ${cfg.anon_key}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase profile fetch failed: ${res.status} ${await res.text()}`);
  }
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

/**
 * Delete test data for a phone number range (cleanup). Uses anon key DELETE (allowed by current
 * "Allow all" policies). For production with tightened RLS, this would need the service_role key.
 * @param {object} cfg
 * @param {string} phoneLike - e.g. "2790000%" to delete all test data
 */
export async function cleanupTestData(cfg, phoneLike = "2790000%") {
  const tables = ["ai_conversations", "customer_profiles"];
  const results = {};
  for (const table of tables) {
    const url = `${cfg.url}/rest/v1/${table}?phone_number=like.${encodeURIComponent(phoneLike)}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        apikey: cfg.anon_key,
        Authorization: `Bearer ${cfg.anon_key}`,
      },
    });
    results[table] = { status: res.status, ok: res.ok };
  }
  // invoices table references quotes via quote_id — delete invoices first
  const invUrl = `${cfg.url}/rest/v1/invoices?quote_id=in.(select,id,from,quotes,where,customer_phone,like.${encodeURIComponent(phoneLike)})`;
  try {
    await fetch(invUrl, {
      method: "DELETE",
      headers: { apikey: cfg.anon_key, Authorization: `Bearer ${cfg.anon_key}` },
    });
  } catch (e) { /* invoices table may not exist or may be empty */ }
  // quotes table uses customer_phone column
  const qUrl = `${cfg.url}/rest/v1/quotes?customer_phone=like.${encodeURIComponent(phoneLike)}`;
  const qRes = await fetch(qUrl, {
    method: "DELETE",
    headers: { apikey: cfg.anon_key, Authorization: `Bearer ${cfg.anon_key}` },
  });
  results.quotes = { status: qRes.status, ok: qRes.ok };
  return results;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

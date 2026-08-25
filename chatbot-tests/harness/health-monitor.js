#!/usr/bin/env node
/**
 * HDS Health Monitor — Standalone Script
 *
 * Probes all system components and writes results to the `system_health_checks`
 * Supabase table. The CRM /health page reads this table.
 *
 * This script can run:
 *   - One-shot:    `node health-monitor.js`
 *   - Continuous:  `node health-monitor.js --watch`  (runs every 5 min)
 *   - Single check:`node health-monitor.js --once`
 *
 * Components checked:
 *   1. n8n workflows (webhook reachability — full API check needs N8N_API_KEY)
 *   2. Vercel quote API
 *   3. Supabase database (REST reachability + row freshness)
 *   4. Chatwoot inbox (HTTPS reachability — full check needs CHATWOOT_TOKEN)
 *   5. Meta WhatsApp phone number status (needs WHATSAPP_ACCESS_TOKEN)
 *   6. Meta access token expiry (needs WHATSAPP_ACCESS_TOKEN + META_APP_ID/SECRET)
 *   7. Meta webhook subscription (needs WHATSAPP_ACCESS_TOKEN)
 *
 * Secrets are read from environment variables or a .env file in the harness dir.
 * Components without their required secret are marked "unknown" with a message
 * explaining what's needed — they don't count as failures.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const config = JSON.parse(
  readFileSync(resolve(__dirname, "config.json"), "utf8")
);

const SUPABASE_URL = config.supabase.url;
const SUPABASE_ANON_KEY = config.supabase.anon_key;
const N8N_BASE_URL = "https://n8n.owdsolutions.co.za";
const N8N_WEBHOOK_URL = config.webhook.url;
const VERCEL_QUOTE_URL = "https://hds-sifosmans-projects.vercel.app";
const CHATWOOT_URL = "https://chat.owdsolutions.co.za";
const CHATWOOT_INBOX_ID = "2";
const META_API_VERSION = "v21.0";
const META_PHONE_NUMBER_ID = config.webhook.phone_number_id;
const META_WABA_ID = config.webhook.waba_id;

// Secrets from environment (try to load .env file)
try {
  const envContent = readFileSync(resolve(__dirname, ".env"), "utf8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.+)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  // No .env file — that's OK, we'll use what's in process.env
}

const N8N_API_KEY = process.env.N8N_API_KEY || "";
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || "";
const CHATWOOT_TOKEN = process.env.CHATWOOT_TOKEN || "";
const CHATWOOT_ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID || "";
const META_APP_ID = process.env.META_APP_ID || "";
const META_APP_SECRET = process.env.META_APP_SECRET || "";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function timedFetch(url, options = {}, timeoutMs = 10000) {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const latencyMs = Date.now() - start;
    const body = await res.text();
    return { ok: res.ok, status: res.status, latencyMs, body };
  } catch (err) {
    const latencyMs = Date.now() - start;
    return {
      ok: false,
      status: 0,
      latencyMs,
      body: "",
      error: err.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

function buildCheck(component, checkName, status, latencyMs, message, details) {
  return {
    component,
    check_name: checkName,
    status,
    latency_ms: latencyMs ?? null,
    message: message || null,
    details: details || {},
    checked_at: new Date().toISOString(),
  };
}

async function insertChecks(checks) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/system_health_checks`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(checks),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase insert failed: ${res.status} ${text}`);
  }
}

// ---------------------------------------------------------------------------
// Health checks
// ---------------------------------------------------------------------------

async function checkN8n() {
  // If we have an API key, check workflow active status via API
  if (N8N_API_KEY) {
    const checks = [];
    for (const [name, id] of [
      ["chatbot", "cyaeNrCXWi8YGQXa"],
      ["intelligence", "mJ3doLIvqi4a2bs0"],
    ]) {
      const res = await timedFetch(`${N8N_BASE_URL}/api/v1/workflows/${id}`, {
        headers: { "X-N8N-API-KEY": N8N_API_KEY },
      });
      if (res.ok) {
        let wf;
        try {
          wf = JSON.parse(res.body);
        } catch {
          wf = {};
        }
        const active = wf.active === true;
        checks.push(
          buildCheck(
            "n8n",
            `${name}_workflow_status`,
            active ? "healthy" : "degraded",
            res.latencyMs,
            active ? `${name} workflow active` : `${name} workflow inactive`,
            { workflow_id: id, active, last_execution: wf.lastExecutionStatus || null }
          )
        );
      } else {
        checks.push(
          buildCheck(
            "n8n",
            `${name}_workflow_status`,
            "down",
            res.latencyMs,
            `n8n API error: ${res.status} ${res.error || ""}`.trim(),
            { workflow_id: id }
          )
        );
      }
    }
    // Combine into one check for the /health page (which expects one row per component per run)
    const allActive = checks.every((c) => c.status === "healthy");
    const anyDown = checks.some((c) => c.status === "down");
    return [
      buildCheck(
        "n8n",
        "workflow_status",
        anyDown ? "down" : allActive ? "healthy" : "degraded",
        checks[0]?.latency_ms || null,
        anyDown
          ? "n8n API unreachable"
          : allActive
            ? "Both workflows active"
            : "One or more workflows inactive",
        {
          chatbot_active: checks[0]?.details.active ?? false,
          intelligence_active: checks[1]?.details.active ?? false,
          chatbot_id: "cyaeNrCXWi8YGQXa",
          intelligence_id: "mJ3doLIvqi4a2bs0",
        }
      ),
    ];
  }

  // No API key — do a lightweight webhook reachability check
  // We can't POST a real message, but we can check if the webhook URL responds
  // to a GET (Meta webhooks respond to GET with the verify challenge)
  const res = await timedFetch(
    `${N8N_BASE_URL}/webhook/hds-whatsapp?hub.mode=test&hub.token=healthcheck`,
    {},
    5000
  );
  if (res.status > 0 && res.status < 500) {
    return [
      buildCheck(
        "n8n",
        "webhook_reachability",
        "degraded",
        res.latencyMs,
        "n8n webhook reachable but full workflow status check requires N8N_API_KEY",
        { webhook_url: N8N_WEBHOOK_URL, status_code: res.status, note: "Set N8N_API_KEY for full check" }
      ),
    ];
  }
  return [
    buildCheck(
      "n8n",
      "webhook_reachability",
      "down",
      res.latencyMs,
      `n8n webhook unreachable: ${res.error || res.status}`,
      { webhook_url: N8N_WEBHOOK_URL }
    ),
  ];
}

async function checkVercel() {
  const res = await timedFetch(
    `${VERCEL_QUOTE_URL}/api/supabase/materials/options`,
    {},
    10000
  );
  if (res.ok) {
    const status = res.latencyMs < 3000 ? "healthy" : "degraded";
    return [
      buildCheck(
        "vercel_quote_api",
        "materials_options_endpoint",
        status,
        res.latencyMs,
        status === "healthy"
          ? "API reachable"
          : `API reachable but slow (${res.latencyMs}ms)`,
        { status_code: res.status, endpoint: "/api/supabase/materials/options" }
      ),
    ];
  }
  return [
    buildCheck(
      "vercel_quote_api",
      "materials_options_endpoint",
      "down",
      res.latencyMs,
      `Vercel API error: ${res.status} ${res.error || "non-200 response"}`.trim(),
      { status_code: res.status, endpoint: "/api/supabase/materials/options" }
    ),
  ];
}

async function checkSupabase() {
  const res = await timedFetch(
    `${SUPABASE_URL}/rest/v1/ai_conversations?select=id,created_at&order=created_at.desc&limit=1`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    },
    10000
  );
  if (!res.ok) {
    return [
      buildCheck(
        "supabase",
        "rest_reachability_and_freshness",
        "down",
        res.latencyMs,
        `Supabase REST error: ${res.status} ${res.error || ""}`.trim(),
        { status_code: res.status }
      ),
    ];
  }
  let rows = [];
  try {
    rows = JSON.parse(res.body);
  } catch {
    // empty body is OK
  }
  if (rows.length > 0) {
    const latestAt = new Date(rows[0].created_at).getTime();
    const minsAgo = Math.round((Date.now() - latestAt) / 60000);
    let status = "healthy";
    let msg = `Latest conversation ${minsAgo}m ago`;
    if (minsAgo > 1440) {
      status = "degraded";
      msg = `Latest conversation ${Math.round(minsAgo / 60)}h ago — bot may be idle`;
    }
    return [
      buildCheck("supabase", "rest_reachability_and_freshness", status, res.latencyMs, msg, {
        status_code: res.status,
        latest_conversation_at: rows[0].created_at,
        minutes_since_last: minsAgo,
      }),
    ];
  }
  return [
    buildCheck(
      "supabase",
      "rest_reachability_and_freshness",
      "degraded",
      res.latencyMs,
      "REST reachable but no conversations found",
      { status_code: res.status }
    ),
  ];
}

async function checkChatwoot() {
  if (CHATWOOT_TOKEN && CHATWOOT_ACCOUNT_ID) {
    const res = await timedFetch(
      `${CHATWOOT_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/inboxes/${CHATWOOT_INBOX_ID}`,
      { headers: { "Api-Access-Token": CHATWOOT_TOKEN } },
      10000
    );
    if (res.ok) {
      let inbox;
      try {
        inbox = JSON.parse(res.body);
      } catch {
        inbox = {};
      }
      const active = inbox.is_active !== false;
      return [
        buildCheck(
          "chatwoot",
          "inbox_2_responding",
          active ? "healthy" : "degraded",
          res.latencyMs,
          active ? "Inbox 2 active" : "Inbox 2 disabled",
          { inbox_name: inbox.name, is_active: active, channel_type: inbox.channel_type }
        ),
      ];
    }
    return [
      buildCheck(
        "chatwoot",
        "inbox_2_responding",
        "down",
        res.latencyMs,
        `Chatwoot API error: ${res.status} ${res.error || ""}`.trim(),
        { status_code: res.status }
      ),
    ];
  }
  // No token — check HTTPS reachability only
  const res = await timedFetch(`${CHATWOOT_URL}/`, {}, 10000);
  if (res.status > 0) {
    return [
      buildCheck(
        "chatwoot",
        "https_reachability",
        "degraded",
        res.latencyMs,
        "Chatwoot HTTPS reachable but full inbox check requires CHATWOOT_TOKEN + CHATWOOT_ACCOUNT_ID",
        { status_code: res.status, note: "Set CHATWOOT_TOKEN and CHATWOOT_ACCOUNT_ID for full check" }
      ),
    ];
  }
  return [
    buildCheck(
      "chatwoot",
      "https_reachability",
      "down",
      res.latencyMs,
      `Chatwoot unreachable: ${res.error || "connection failed"}`,
      {}
    ),
  ];
}

async function checkMetaWhatsApp() {
  if (!WHATSAPP_ACCESS_TOKEN) {
    return [
      buildCheck(
        "meta_whatsapp",
        "phone_number_status",
        "unknown",
        null,
        "Set WHATSAPP_ACCESS_TOKEN to check phone number quality rating",
        { note: "Requires WHATSAPP_ACCESS_TOKEN" }
      ),
    ];
  }
  const res = await timedFetch(
    `https://graph.facebook.com/${META_API_VERSION}/${META_PHONE_NUMBER_ID}?fields=name_status,quality_rating,messaging_limit_tier,verified_name`,
    { headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` } },
    10000
  );
  if (!res.ok) {
    let errMsg = `Meta API error: ${res.status}`;
    try {
      const err = JSON.parse(res.body);
      if (err.error?.message) errMsg = `Meta API: ${err.error.message}`;
    } catch {}
    return [
      buildCheck("meta_whatsapp", "phone_number_status", "down", res.latencyMs, errMsg, {
        status_code: res.status,
      }),
    ];
  }
  let data;
  try {
    data = JSON.parse(res.body);
  } catch {
    data = {};
  }
  const qr = data.quality_rating;
  let status = "healthy";
  let msg = `Quality: ${qr}, Tier: ${data.messaging_limit_tier}`;
  if (qr === "RED") {
    status = "down";
    msg = "Quality rating RED — messaging at risk";
  } else if (qr === "YELLOW") {
    status = "degraded";
    msg = "Quality rating YELLOW — monitor closely";
  }
  return [
    buildCheck("meta_whatsapp", "phone_number_status", status, res.latencyMs, msg, {
      quality_rating: qr,
      messaging_limit_tier: data.messaging_limit_tier,
      verified_name: data.verified_name,
      name_status: data.name_status,
    }),
  ];
}

async function checkMetaToken() {
  if (!WHATSAPP_ACCESS_TOKEN) {
    return [
      buildCheck(
        "meta_access_token",
        "token_expiry_check",
        "unknown",
        null,
        "Set WHATSAPP_ACCESS_TOKEN to check token expiry",
        { note: "Requires WHATSAPP_ACCESS_TOKEN" }
      ),
    ];
  }
  // If we have app ID + secret, use debug_token for full expiry check
  if (META_APP_ID && META_APP_SECRET) {
    const res = await timedFetch(
      `https://graph.facebook.com/debug_token?input_token=${WHATSAPP_ACCESS_TOKEN}&access_token=${META_APP_ID}|${META_APP_SECRET}`,
      {},
      10000
    );
    if (res.ok) {
      let data;
      try {
        const parsed = JSON.parse(res.body);
        data = parsed.data || parsed;
      } catch {
        data = {};
      }
      const expiresAt = data.expires_at;
      let status = "healthy";
      let msg = "Token valid";
      let daysLeft = null;
      if (expiresAt && expiresAt > 0) {
        daysLeft = Math.round((expiresAt * 1000 - Date.now()) / 86400000);
        if (daysLeft <= 1) {
          status = "down";
          msg = `Token expired or expires in ${daysLeft} day(s)`;
        } else if (daysLeft <= 14) {
          status = "degraded";
          msg = `Token expires in ${daysLeft} days`;
        } else {
          msg = `Token valid, expires in ${daysLeft} days`;
        }
      } else {
        msg = "Token valid (system user, no expiry)";
      }
      return [
        buildCheck("meta_access_token", "token_expiry_check", status, res.latencyMs, msg, {
          expires_at: expiresAt,
          is_valid: data.is_valid,
          type: data.type,
          days_until_expiry: daysLeft,
        }),
      ];
    }
    return [
      buildCheck(
        "meta_access_token",
        "token_expiry_check",
        "down",
        res.latencyMs,
        `Token debug error: ${res.status}`,
        { status_code: res.status }
      ),
    ];
  }
  // No app ID/secret — do a lightweight check: just hit the Graph API with the token
  // If it returns data (not an OAuth error), the token is valid
  const res = await timedFetch(
    `https://graph.facebook.com/${META_API_VERSION}/${META_PHONE_NUMBER_ID}?fields=verified_name`,
    { headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` } },
    10000
  );
  if (res.ok) {
    return [
      buildCheck(
        "meta_access_token",
        "token_expiry_check",
        "degraded",
        res.latencyMs,
        "Token is valid (full expiry check requires META_APP_ID + META_APP_SECRET)",
        { is_valid: true, note: "Set META_APP_ID and META_APP_SECRET for full expiry check" }
      ),
    ];
  }
  return [
    buildCheck(
      "meta_access_token",
      "token_expiry_check",
      "down",
      res.latencyMs,
      "Token is invalid or expired",
      { is_valid: false }
    ),
  ];
}

async function checkMetaWebhook() {
  if (!WHATSAPP_ACCESS_TOKEN) {
    return [
      buildCheck(
        "meta_webhook",
        "subscription_status",
        "unknown",
        null,
        "Set WHATSAPP_ACCESS_TOKEN to check webhook subscription",
        { note: "Requires WHATSAPP_ACCESS_TOKEN" }
      ),
    ];
  }
  // Try the subscribed_apps endpoint on the WABA ID.
  // This requires whatsapp_business_management permission.
  // If the token only has whatsapp_business_messaging permission, we'll get
  // a "nonexisting field" error — in that case, fall back to an indirect check
  // via the n8n webhook reachability (which confirms the webhook endpoint is
  // responding, even if we can't verify the Meta subscription directly).
  const res = await timedFetch(
    `https://graph.facebook.com/${META_API_VERSION}/${META_WABA_ID}/subscribed_apps`,
    { headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` } },
    10000
  );
  if (res.ok) {
    let data;
    try {
      const parsed = JSON.parse(res.body);
      data = Array.isArray(parsed) ? parsed : parsed.data || [parsed];
    } catch {
      data = [];
    }
    const subscribed = data.length > 0;
    const hasMessages = data.some(
      (d) => (d.subscribed_fields || []).includes("messages")
    );
    let status = "healthy";
    let msg = "Webhook subscribed";
    if (!subscribed) {
      status = "down";
      msg = "No webhook subscriptions found";
    } else if (!hasMessages) {
      status = "degraded";
      msg = "Subscribed but missing messages field";
    }
    return [
      buildCheck("meta_webhook", "subscription_status", status, res.latencyMs, msg, {
        subscribed,
        subscribed_fields: data[0]?.subscribed_fields || [],
      }),
    ];
  }
  // Check if it's a permissions error (not a real outage)
  let errBody;
  try {
    errBody = JSON.parse(res.body);
  } catch {
    errBody = {};
  }
  const errMsg = errBody.error?.message || "";
  const isPermissionError =
    errMsg.includes("nonexisting field") ||
    errMsg.includes("permission") ||
    res.status === 403;

  if (isPermissionError) {
    // Can't check subscription directly — verify the n8n webhook is at least
    // responding to GET requests (Meta sends a GET for webhook verification)
    const webhookRes = await timedFetch(
      `${N8N_BASE_URL}/webhook/hds-whatsapp?hub.mode=subscribe&hub.verify_token=ae73a5a490552fdf6d9141a5fa4bfb91&hub.challenge=healthcheck`,
      {},
      5000
    );
    if (webhookRes.status > 0 && webhookRes.status < 500) {
      return [
        buildCheck(
          "meta_webhook",
          "subscription_status",
          "degraded",
          webhookRes.latencyMs,
          "Webhook endpoint reachable but can't verify Meta subscription (token lacks whatsapp_business_management permission)",
          {
            waba_id: META_WABA_ID,
            webhook_reachable: true,
            webhook_status: webhookRes.status,
            note: "Need a token with whatsapp_business_management permission for full subscription check",
          }
        ),
      ];
    }
    return [
      buildCheck(
        "meta_webhook",
        "subscription_status",
        "down",
        webhookRes.latencyMs,
        "Webhook endpoint unreachable AND can't verify Meta subscription",
        { waba_id: META_WABA_ID, webhook_reachable: false }
      ),
    ];
  }
  // Real API error (not permissions)
  return [
    buildCheck("meta_webhook", "subscription_status", "down", res.latencyMs, `Meta API: ${errMsg}`, {
      status_code: res.status,
      waba_id: META_WABA_ID,
    }),
  ];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function runChecks() {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] Running health checks...`);

  const allChecks = await Promise.all([
    checkN8n(),
    checkVercel(),
    checkSupabase(),
    checkChatwoot(),
    checkMetaWhatsApp(),
    checkMetaToken(),
    checkMetaWebhook(),
  ]);

  const checks = allChecks.flat();

  // Print summary
  for (const c of checks) {
    const icon =
      c.status === "healthy"
        ? "[OK]  "
        : c.status === "degraded"
          ? "[WARN]"
          : c.status === "down"
            ? "[DOWN]"
            : "[?]   ";
    console.log(
      `  ${icon} ${c.component.padEnd(22)} ${c.message}`
    );
  }

  const downCount = checks.filter((c) => c.status === "down").length;
  const degradedCount = checks.filter((c) => c.status === "degraded").length;
  const healthyCount = checks.filter((c) => c.status === "healthy").length;
  console.log(
    `  Summary: ${healthyCount} healthy, ${degradedCount} degraded, ${downCount} down`
  );

  // Insert into Supabase
  try {
    await insertChecks(checks);
    console.log(`  Inserted ${checks.length} checks into system_health_checks`);
  } catch (err) {
    console.error(`  ERROR inserting checks: ${err.message}`);
  }

  return checks;
}

async function main() {
  const args = process.argv.slice(2);
  const watch = args.includes("--watch");
  const once = args.includes("--once");

  if (watch) {
    console.log("HDS Health Monitor — continuous mode (every 5 minutes)");
    console.log("Press Ctrl+C to stop.\n");
    await runChecks();
    setInterval(runChecks, 5 * 60 * 1000);
  } else {
    // Default: one-shot (same as --once)
    console.log("HDS Health Monitor — one-shot mode");
    await runChecks();
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

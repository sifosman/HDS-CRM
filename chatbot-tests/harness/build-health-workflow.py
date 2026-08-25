#!/usr/bin/env python3
"""
Create a simplified HDS Health Monitor workflow in n8n.
Uses a single Code node for all health checks (like the standalone script)
to avoid parallel branching issues.
"""
import json
import os
import urllib.request
import urllib.error

N8N_BASE = "https://n8n.owdsolutions.co.za"
N8N_KEY = ""
ALERT_WF_ID = "h88zr1gcaWcGj8f1"

# Load N8N_KEY from .env
env_path = os.path.join(os.path.dirname(__file__), ".env")
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if line.startswith("N8N_API_KEY="):
            N8N_KEY = line.split("=", 1)[1]
            break

SECRETS = {
    "supabaseUrl": "https://xzsibbbghotreolzwnyk.supabase.co",
    "supabaseAnonKey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6c2liYmJnaG90cmVvbHp3bnlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3MTcyMzUsImV4cCI6MjA2NzI5MzIzNX0.Yq6YS2Mw8fE4pTloeCTUSmI06RrUYe_WW_pC0NTqUDE",
    "n8nBaseUrl": N8N_BASE,
    "n8nApiKey": N8N_KEY,
    "vercelQuoteUrl": "https://hds-sifosmans-projects.vercel.app",
    "chatwootUrl": "https://chat.owdsolutions.co.za",
    "chatwootToken": "hds_n8n_1784799668_d1031a05bef76e77",
    "chatwootAccountId": "1",
    "chatwootInboxId": "2",
    "metaApiVersion": "v21.0",
    "metaAccessToken": "EAAN6rOFrqdYBSAzmgJ7mRzUuEMLAZC8L7zPt9ZB2SF8XPJtZCDNbC3ifJL1fs4HcxXbgthvlpwW6uKvrMU0DAxRi7g5uHmlJWH25WxA5XZBGpqS7bvZBQvbXhWPGhDcj95yBrzWhqj8Em2oE9hILKfBCfp4CZATRvFbNvaXKc0IgS6L803U6TUtGBD0Win9aCKjwZDZD",
    "metaPhoneNumberId": "1193389483847746",
    "metaWabaId": "122111764437301229",
}

CHECKS_CODE = r'''
// HDS Health Monitor — all checks in one Code node
const config = $json;
const checks = [];

function buildCheck(component, checkName, status, latencyMs, message, details) {
  return {
    component, check_name: checkName, status,
    latency_ms: latencyMs || null,
    message: message || null,
    details: details || {},
    checked_at: new Date().toISOString()
  };
}

async function timedFetch(url, opts = {}, timeoutMs = 10000) {
  const start = Date.now();
  try {
    const res = await this.helpers.httpRequest({
      url, method: opts.method || 'GET',
      headers: opts.headers || {},
      body: opts.body,
      json: true,
      timeout: timeoutMs,
      returnFullResponse: true,
    });
    return { ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body: res.body, latencyMs: Date.now() - start };
  } catch(e) {
    return { ok: false, status: 0, body: null, latencyMs: Date.now() - start, error: e.message };
  }
}

// 1. n8n
try {
  const chatbotRes = await timedFetch.call(this, config.n8nBaseUrl + '/api/v1/workflows/cyaeNrCXWi8YGQXa', { headers: { 'X-N8N-API-KEY': config.n8nApiKey } });
  const intelRes = await timedFetch.call(this, config.n8nBaseUrl + '/api/v1/workflows/mJ3doLIvqi4a2bs0', { headers: { 'X-N8N-API-KEY': config.n8nApiKey } });
  const chatbotActive = chatbotRes.ok && chatbotRes.body && chatbotRes.body.active === true;
  const intelActive = intelRes.ok && intelRes.body && intelRes.body.active === true;
  let st = 'healthy', msg = 'Both workflows active';
  if (!chatbotActive && !intelActive) { st = 'down'; msg = 'Both workflows inactive'; }
  else if (!chatbotActive || !intelActive) { st = 'degraded'; msg = (chatbotActive ? 'Intelligence' : 'Chatbot') + ' workflow inactive'; }
  checks.push(buildCheck('n8n', 'workflow_status', st, null, msg, { chatbot_active: chatbotActive, intelligence_active: intelActive }));
} catch(e) {
  checks.push(buildCheck('n8n', 'workflow_status', 'down', null, 'n8n API error: ' + e.message, {}));
}

// 2. Vercel
try {
  const r = await timedFetch.call(this, config.vercelQuoteUrl + '/api/supabase/materials/options');
  checks.push(buildCheck('vercel_quote_api', 'materials_options_endpoint', r.ok ? 'healthy' : 'down', r.latencyMs, r.ok ? 'API reachable' : 'Vercel API error: ' + r.status, { status_code: r.status }));
} catch(e) {
  checks.push(buildCheck('vercel_quote_api', 'materials_options_endpoint', 'down', null, 'Vercel error: ' + e.message, {}));
}

// 3. Supabase
try {
  const r = await timedFetch.call(this, config.supabaseUrl + '/rest/v1/ai_conversations?select=id,created_at&order=created_at.desc&limit=1', { headers: { 'apikey': config.supabaseAnonKey, 'Authorization': 'Bearer ' + config.supabaseAnonKey } });
  if (r.ok) {
    const rows = Array.isArray(r.body) ? r.body : [];
    if (rows.length > 0) {
      const minsAgo = Math.round((Date.now() - new Date(rows[0].created_at).getTime()) / 60000);
      let st = 'healthy', msg = 'Latest conversation ' + minsAgo + 'm ago';
      if (minsAgo > 1440) { st = 'degraded'; msg = 'Latest conversation ' + Math.round(minsAgo/60) + 'h ago'; }
      checks.push(buildCheck('supabase', 'rest_reachability_and_freshness', st, r.latencyMs, msg, { minutes_since_last: minsAgo }));
    } else {
      checks.push(buildCheck('supabase', 'rest_reachability_and_freshness', 'degraded', r.latencyMs, 'No conversations found', {}));
    }
  } else {
    checks.push(buildCheck('supabase', 'rest_reachability_and_freshness', 'down', r.latencyMs, 'Supabase error: ' + r.status, {}));
  }
} catch(e) {
  checks.push(buildCheck('supabase', 'rest_reachability_and_freshness', 'down', null, 'Supabase error: ' + e.message, {}));
}

// 4. Chatwoot
try {
  const r = await timedFetch.call(this, config.chatwootUrl + '/api/v1/accounts/' + config.chatwootAccountId + '/inboxes/' + config.chatwootInboxId, { headers: { 'Api-Access-Token': config.chatwootToken } });
  if (r.ok) {
    const active = r.body && r.body.is_active !== false;
    checks.push(buildCheck('chatwoot', 'inbox_2_responding', active ? 'healthy' : 'degraded', r.latencyMs, active ? 'Inbox 2 active' : 'Inbox 2 disabled', { inbox_name: r.body?.name }));
  } else {
    checks.push(buildCheck('chatwoot', 'inbox_2_responding', 'down', r.latencyMs, 'Chatwoot error: ' + r.status, {}));
  }
} catch(e) {
  checks.push(buildCheck('chatwoot', 'inbox_2_responding', 'down', null, 'Chatwoot error: ' + e.message, {}));
}

// 5. Meta WhatsApp
try {
  const r = await timedFetch.call(this, 'https://graph.facebook.com/' + config.metaApiVersion + '/' + config.metaPhoneNumberId + '?fields=name_status,quality_rating,messaging_limit_tier,verified_name', { headers: { 'Authorization': 'Bearer ' + config.metaAccessToken } });
  if (r.ok && r.body) {
    const qr = r.body.quality_rating;
    let st = 'healthy', msg = 'Quality: ' + qr + ', Tier: ' + r.body.messaging_limit_tier;
    if (qr === 'RED') { st = 'down'; msg = 'Quality rating RED'; }
    else if (qr === 'YELLOW') { st = 'degraded'; msg = 'Quality rating YELLOW'; }
    checks.push(buildCheck('meta_whatsapp', 'phone_number_status', st, r.latencyMs, msg, { quality_rating: qr, messaging_limit_tier: r.body.messaging_limit_tier }));
  } else {
    checks.push(buildCheck('meta_whatsapp', 'phone_number_status', 'down', r.latencyMs, 'Meta API error: ' + r.status, {}));
  }
} catch(e) {
  checks.push(buildCheck('meta_whatsapp', 'phone_number_status', 'down', null, 'Meta error: ' + e.message, {}));
}

// 6. Meta Token (lightweight)
try {
  const r = await timedFetch.call(this, 'https://graph.facebook.com/' + config.metaApiVersion + '/' + config.metaPhoneNumberId + '?fields=verified_name', { headers: { 'Authorization': 'Bearer ' + config.metaAccessToken } });
  if (r.ok && r.body && (r.body.verified_name || r.body.id)) {
    checks.push(buildCheck('meta_access_token', 'token_expiry_check', 'degraded', r.latencyMs, 'Token valid (full expiry check needs META_APP_ID + META_APP_SECRET)', { is_valid: true }));
  } else {
    checks.push(buildCheck('meta_access_token', 'token_expiry_check', 'down', r.latencyMs, 'Token invalid or expired', { is_valid: false }));
  }
} catch(e) {
  checks.push(buildCheck('meta_access_token', 'token_expiry_check', 'down', null, 'Token error: ' + e.message, {}));
}

// 7. Meta Webhook (indirect — check n8n webhook reachability)
try {
  const r = await timedFetch.call(this, config.n8nBaseUrl + '/webhook/hds-whatsapp?hub.mode=subscribe&hub.verify_token=ae73a5a490552fdf6d9141a5fa4bfb91&hub.challenge=healthcheck', {}, 5000);
  checks.push(buildCheck('meta_webhook', 'webhook_endpoint_reachability', r.ok ? 'degraded' : 'down', r.latencyMs, r.ok ? 'Webhook endpoint reachable (cant verify Meta subscription — token lacks management permission)' : 'Webhook unreachable', { webhook_reachable: r.ok }));
} catch(e) {
  checks.push(buildCheck('meta_webhook', 'webhook_endpoint_reachability', 'down', null, 'Webhook error: ' + e.message, {}));
}

// Return all checks as separate items
return checks.map(c => ({ json: c }));
'''.strip()


def n8n_request(method, path, data=None):
    url = f"{N8N_BASE}/api/v1{path}"
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("X-N8N-API-KEY", N8N_KEY)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        print(f"  API error {e.code}: {err_body[:500]}")
        return None
    except Exception as e:
        print(f"  Request error: {e}")
        return None


# Build the workflow
workflow = {
    "name": "HDS Health Monitor",
    "nodes": [
        {
            "parameters": {
                "rule": {
                    "interval": [
                        {"field": "minutes", "minutesInterval": 5}
                    ]
                }
            },
            "id": "schedule-trigger",
            "name": "Every 5 min",
            "type": "n8n-nodes-base.scheduleTrigger",
            "typeVersion": 1.2,
            "position": [0, 0]
        },
        {
            "parameters": {
                "values": {
                    "string": [
                        {"name": k, "value": v} for k, v in SECRETS.items()
                    ]
                },
                "options": {}
            },
            "id": "config-set",
            "name": "Config",
            "type": "n8n-nodes-base.set",
            "typeVersion": 3.4,
            "position": [220, 0]
        },
        {
            "parameters": {
                "jsCode": CHECKS_CODE
            },
            "id": "run-checks",
            "name": "Run All Checks",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [440, 0]
        },
        {
            "parameters": {
                "method": "POST",
                "url": f"={SECRETS['supabaseUrl']}/rest/v1/system_health_checks",
                "sendHeaders": True,
                "headerParameters": {
                    "parameters": [
                        {"name": "apikey", "value": SECRETS['supabaseAnonKey']},
                        {"name": "Authorization", "value": f"Bearer {SECRETS['supabaseAnonKey']}"},
                        {"name": "Content-Type", "value": "application/json"},
                        {"name": "Prefer", "value": "return=minimal"}
                    ]
                },
                "sendBody": True,
                "specifyBody": "json",
                "jsonBody": "={{ JSON.stringify($json) }}",
                "options": {}
            },
            "id": "insert-supabase",
            "name": "Insert to Supabase",
            "type": "n8n-nodes-base.httpRequest",
            "typeVersion": 4.2,
            "position": [660, 0]
        },
        {
            "parameters": {
                "conditions": {
                    "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
                    "conditions": [
                        {
                            "id": "has-down",
                            "leftValue": "={{ $json.status }}",
                            "rightValue": "down",
                            "operator": {"type": "string", "operation": "equals"}
                        }
                    ],
                    "combinator": "or"
                },
                "options": {}
            },
            "id": "if-down",
            "name": "If Down",
            "type": "n8n-nodes-base.if",
            "typeVersion": 2.2,
            "position": [660, 200]
        },
        {
            "parameters": {
                "workflowId": ALERT_WF_ID,
                "options": {}
            },
            "id": "trigger-alert",
            "name": "Trigger Alert",
            "type": "n8n-nodes-base.executeWorkflow",
            "typeVersion": 1.2,
            "position": [880, 200]
        }
    ],
    "connections": {
        "Every 5 min": {"main": [[{"node": "Config", "type": "main", "index": 0}]]},
        "Config": {"main": [[{"node": "Run All Checks", "type": "main", "index": 0}]]},
        "Run All Checks": {"main": [[
            {"node": "Insert to Supabase", "type": "main", "index": 0},
            {"node": "If Down", "type": "main", "index": 0}
        ]]},
        "If Down": {"main": [
            [{"node": "Trigger Alert", "type": "main", "index": 0}],
            []
        ]}
    },
    "settings": {"executionOrder": "v1", "saveExecutionProgress": True}
}

# Check for existing workflow with same name and delete it
existing = n8n_request("GET", "/workflows")
if existing:
    for ex in existing.get("data", []):
        if ex["name"] == "HDS Health Monitor":
            print(f"Deleting existing workflow {ex['id']}")
            n8n_request("DELETE", f"/workflows/{ex['id']}")

# Create the workflow
print("Creating Health Monitor workflow...")
result = n8n_request("POST", "/workflows", workflow)
if result and "id" in result:
    wf_id = result["id"]
    print(f"  Created: {wf_id}")

    # Activate it
    print("Activating...")
    act_result = n8n_request("POST", f"/workflows/{wf_id}/activate")
    if act_result and act_result.get("active"):
        print(f"  SUCCESS: Workflow activated")
    else:
        print(f"  FAILED to activate — check n8n UI: {N8N_BASE}/workflow/{wf_id}")
else:
    print("  FAILED to create workflow")

#!/usr/bin/env python3
"""Fix the Health Monitor workflow — hardcode config in Code node, remove Set node dependency."""
import json
import os
import urllib.request
import urllib.error

N8N_BASE = "https://n8n.owdsolutions.co.za"
N8N_KEY = ""
SUPABASE_URL = "https://xzsibbbghotreolzwnyk.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6c2liYmJnaG90cmVvbHp3bnlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3MTcyMzUsImV4cCI6MjA2NzI5MzIzNX0.Yq6YS2Mw8fE4pTloeCTUSmI06RrUYe_WW_pC0NTqUDE"
WF_ID = "pINDRC0oztJd5t1L"

# Load N8N_KEY from .env
env_path = os.path.join(os.path.dirname(__file__), ".env")
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if line.startswith("N8N_API_KEY="):
            N8N_KEY = line.split("=", 1)[1]
            break

CHECKS_CODE = """// HDS Health Monitor — all checks in one Code node
const SUPABASE_URL = 'https://xzsibbbghotreolzwnyk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6c2liYmJnaG90cmVvbHp3bnlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3MTcyMzUsImV4cCI6MjA2NzI5MzIzNX0.Yq6YS2Mw8fE4pTloeCTUSmI06RrUYe_WW_pC0NTqUDE';
const N8N_BASE = 'https://n8n.owdsolutions.co.za';
const N8N_KEY = '""" + N8N_KEY + """';
const VERCEL_URL = 'https://hds-sifosmans-projects.vercel.app';
const CHATWOOT_URL = 'https://chat.owdsolutions.co.za';
const CHATWOOT_TOKEN = 'hds_n8n_1784799668_d1031a05bef76e77';
const CHATWOOT_ACCOUNT = '1';
const CHATWOOT_INBOX = '2';
const META_VER = 'v21.0';
const META_TOKEN = 'EAAN6rOFrqdYBSAzmgJ7mRzUuEMLAZC8L7zPt9ZB2SF8XPJtZCDNbC3ifJL1fs4HcxXbgthvlpwW6uKvrMU0DAxRi7g5uHmlJWH25WxA5XZBGpqS7bvZBQvbXhWPGhDcj95yBrzWhqj8Em2oE9hILKfBCfp4CZATRvFbNvaXKc0IgS6L803U6TUtGBD0Win9aCKjwZDZD';
const META_PHONE_ID = '1193389483847746';

const checks = [];
function buildCheck(component, checkName, status, message, details) {
  return { component, check_name: checkName, status, latency_ms: null, message: message || null, details: details || {}, checked_at: new Date().toISOString() };
}

// 1. n8n
try {
  const chatbotRes = await this.helpers.httpRequest({ method: 'GET', url: N8N_BASE + '/api/v1/workflows/cyaeNrCXWi8YGQXa', headers: { 'X-N8N-API-KEY': N8N_KEY }, json: true, timeout: 10000 });
  const intelRes = await this.helpers.httpRequest({ method: 'GET', url: N8N_BASE + '/api/v1/workflows/mJ3doLIvqi4a2bs0', headers: { 'X-N8N-API-KEY': N8N_KEY }, json: true, timeout: 10000 });
  const ca = chatbotRes && chatbotRes.active === true;
  const ia = intelRes && intelRes.active === true;
  let st = 'healthy', msg = 'Both workflows active';
  if (!ca && !ia) { st = 'down'; msg = 'Both workflows inactive'; }
  else if (!ca || !ia) { st = 'degraded'; msg = (ca ? 'Intelligence' : 'Chatbot') + ' workflow inactive'; }
  checks.push(buildCheck('n8n', 'workflow_status', st, msg, { chatbot_active: ca, intelligence_active: ia }));
} catch(e) { checks.push(buildCheck('n8n', 'workflow_status', 'down', 'n8n API error: ' + e.message, {})); }

// 2. Vercel
try {
  await this.helpers.httpRequest({ method: 'GET', url: VERCEL_URL + '/api/supabase/materials/options', json: true, timeout: 10000 });
  checks.push(buildCheck('vercel_quote_api', 'materials_options_endpoint', 'healthy', 'API reachable', {}));
} catch(e) { checks.push(buildCheck('vercel_quote_api', 'materials_options_endpoint', 'down', 'Vercel error: ' + e.message, {})); }

// 3. Supabase
try {
  const rows = await this.helpers.httpRequest({ method: 'GET', url: SUPABASE_URL + '/rest/v1/ai_conversations?select=id,created_at&order=created_at.desc&limit=1', headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY }, json: true, timeout: 10000 });
  if (Array.isArray(rows) && rows.length > 0) {
    const minsAgo = Math.round((Date.now() - new Date(rows[0].created_at).getTime()) / 60000);
    let st = 'healthy', msg = 'Latest conversation ' + minsAgo + 'm ago';
    if (minsAgo > 1440) { st = 'degraded'; msg = 'Latest conversation ' + Math.round(minsAgo/60) + 'h ago'; }
    checks.push(buildCheck('supabase', 'rest_reachability_and_freshness', st, msg, { minutes_since_last: minsAgo }));
  } else {
    checks.push(buildCheck('supabase', 'rest_reachability_and_freshness', 'degraded', 'No conversations found', {}));
  }
} catch(e) { checks.push(buildCheck('supabase', 'rest_reachability_and_freshness', 'down', 'Supabase error: ' + e.message, {})); }

// 4. Chatwoot
try {
  const inbox = await this.helpers.httpRequest({ method: 'GET', url: CHATWOOT_URL + '/api/v1/accounts/' + CHATWOOT_ACCOUNT + '/inboxes/' + CHATWOOT_INBOX, headers: { 'Api-Access-Token': CHATWOOT_TOKEN }, json: true, timeout: 10000 });
  const active = inbox && inbox.is_active !== false;
  checks.push(buildCheck('chatwoot', 'inbox_2_responding', active ? 'healthy' : 'degraded', active ? 'Inbox 2 active' : 'Inbox 2 disabled', { inbox_name: inbox ? inbox.name : null }));
} catch(e) { checks.push(buildCheck('chatwoot', 'inbox_2_responding', 'down', 'Chatwoot error: ' + e.message, {})); }

// 5. Meta WhatsApp
try {
  const m = await this.helpers.httpRequest({ method: 'GET', url: 'https://graph.facebook.com/' + META_VER + '/' + META_PHONE_ID + '?fields=name_status,quality_rating,messaging_limit_tier,verified_name', headers: { 'Authorization': 'Bearer ' + META_TOKEN }, json: true, timeout: 10000 });
  const qr = m.quality_rating;
  let st = 'healthy', msg = 'Quality: ' + qr + ', Tier: ' + m.messaging_limit_tier;
  if (qr === 'RED') { st = 'down'; msg = 'Quality rating RED'; }
  else if (qr === 'YELLOW') { st = 'degraded'; msg = 'Quality rating YELLOW'; }
  checks.push(buildCheck('meta_whatsapp', 'phone_number_status', st, msg, { quality_rating: qr, messaging_limit_tier: m.messaging_limit_tier }));
} catch(e) { checks.push(buildCheck('meta_whatsapp', 'phone_number_status', 'down', 'Meta error: ' + e.message, {})); }

// 6. Meta Token
try {
  const t = await this.helpers.httpRequest({ method: 'GET', url: 'https://graph.facebook.com/' + META_VER + '/' + META_PHONE_ID + '?fields=verified_name', headers: { 'Authorization': 'Bearer ' + META_TOKEN }, json: true, timeout: 10000 });
  if (t && (t.verified_name || t.id)) {
    checks.push(buildCheck('meta_access_token', 'token_expiry_check', 'degraded', 'Token valid (full expiry check needs META_APP_ID + META_APP_SECRET)', { is_valid: true }));
  } else {
    checks.push(buildCheck('meta_access_token', 'token_expiry_check', 'down', 'Token invalid', { is_valid: false }));
  }
} catch(e) { checks.push(buildCheck('meta_access_token', 'token_expiry_check', 'down', 'Token error: ' + e.message, {})); }

// 7. Meta Webhook (indirect)
try {
  await this.helpers.httpRequest({ method: 'GET', url: N8N_BASE + '/webhook/hds-whatsapp?hub.mode=subscribe&hub.verify_token=ae73a5a490552fdf6d9141a5fa4bfb91&hub.challenge=healthcheck', json: true, timeout: 5000 });
  checks.push(buildCheck('meta_webhook', 'webhook_endpoint_reachability', 'degraded', 'Webhook endpoint reachable (cant verify Meta subscription)', { webhook_reachable: true }));
} catch(e) { checks.push(buildCheck('meta_webhook', 'webhook_endpoint_reachability', 'down', 'Webhook error: ' + e.message, { webhook_reachable: false })); }

return checks.map(c => ({ json: c }));
"""


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


# Get current workflow
wf = n8n_request("GET", f"/workflows/{WF_ID}")
if not wf:
    print("Failed to get workflow")
    exit(1)

# Update the Code node
for node in wf["nodes"]:
    if node["name"] == "Run All Checks":
        node["parameters"]["jsCode"] = CHECKS_CODE
        print("Updated Run All Checks code node with hardcoded config")

# Update the Insert to Supabase node with hardcoded values
for node in wf["nodes"]:
    if node["name"] == "Insert to Supabase":
        node["parameters"]["url"] = f"{SUPABASE_URL}/rest/v1/system_health_checks"
        for h in node["parameters"]["headerParameters"]["parameters"]:
            if h["name"] == "apikey":
                h["value"] = SUPABASE_ANON_KEY
            elif h["name"] == "Authorization":
                h["value"] = f"Bearer {SUPABASE_ANON_KEY}"
        print("Updated Insert to Supabase with hardcoded values")

# Remove the Config node
wf["nodes"] = [n for n in wf["nodes"] if n["name"] != "Config"]
# Update connections: trigger -> Run All Checks (skip Config)
wf["connections"]["Every 5 min"] = {"main": [[{"node": "Run All Checks", "type": "main", "index": 0}]]}
wf["connections"].pop("Config", None)
print("Removed Config node, connected trigger directly to Run All Checks")

# Remove read-only fields
for key in ["updatedAt", "createdAt", "id", "isArchived", "staticData", "meta",
            "nodeGroups", "pinData", "versionId", "activeVersionId", "versionCounter",
            "triggerCount", "sourceWorkflowId", "shared", "tags", "activeVersion",
            "description", "active"]:
    wf.pop(key, None)

# Deactivate, update, reactivate
print("Deactivating...")
n8n_request("POST", f"/workflows/{WF_ID}/deactivate")

print("Updating...")
result = n8n_request("PUT", f"/workflows/{WF_ID}", wf)
if result and "id" in result:
    print(f"  Updated: {result['id']}")

print("Reactivating...")
result = n8n_request("POST", f"/workflows/{WF_ID}/activate")
if result and result.get("active"):
    print("  SUCCESS: Workflow activated")
else:
    print("  FAILED to activate")

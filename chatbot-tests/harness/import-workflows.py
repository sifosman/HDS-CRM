#!/usr/bin/env python3
"""
Import the HDS Health Monitor and Alert workflows into n8n via the API.
Injects real secrets into the Config nodes before creating the workflows.
"""

import json
import os
import sys
import urllib.request
import urllib.error

N8N_BASE = "https://n8n.owdsolutions.co.za"
N8N_KEY = os.environ.get("N8N_API_KEY", "")
if not N8N_KEY:
    # Load from .env
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("N8N_API_KEY="):
                    N8N_KEY = line.split("=", 1)[1]
                    break

if not N8N_KEY:
    print("ERROR: N8N_API_KEY not found")
    sys.exit(1)

# Real secrets to inject
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
    "alertWhatsappNumber": "27658475289",
    "alertEmail": "sifosman@gmail.com",
    "crmUrl": "https://hds-crm-dashboard.vercel.app",
}


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
        print(f"  API error {e.code}: {err_body[:300]}")
        return None
    except Exception as e:
        print(f"  Request error: {e}")
        return None


def inject_secrets_into_config(workflow, secrets):
    """Replace placeholder values in the Config node with real secrets."""
    for node in workflow.get("nodes", []):
        if node.get("name") == "Config":
            string_values = node["parameters"]["values"]["string"]
            for sv in string_values:
                key = sv["name"]
                if key in secrets:
                    sv["value"] = secrets[key]
            return node
    return None


def import_workflow(json_path, secrets):
    """Load a workflow JSON, inject secrets, create it in n8n."""
    print(f"\n--- Importing {os.path.basename(json_path)} ---")
    with open(json_path) as f:
        wf = json.load(f)

    # Inject secrets into Config node
    config_node = inject_secrets_into_config(wf, secrets)
    if config_node:
        print(f"  Injected {len(secrets)} secrets into Config node")
    else:
        print("  WARNING: No Config node found — secrets not injected")

    # Build the API payload (only the fields the API accepts for creation)
    payload = {
        "name": wf["name"],
        "nodes": wf["nodes"],
        "connections": wf["connections"],
        "settings": wf.get("settings", {"executionOrder": "v1"}),
    }

    # Check if a workflow with this name already exists
    existing = n8n_request("GET", "/workflows")
    if existing:
        for ex in existing.get("data", []):
            if ex["name"] == wf["name"]:
                print(f"  Found existing workflow {ex['id']} with same name — deleting it first")
                n8n_request("DELETE", f"/workflows/{ex['id']}")
                break

    # Create the workflow
    result = n8n_request("POST", "/workflows", payload)
    if result and "id" in result:
        print(f"  SUCCESS: Created workflow '{result['name']}' with ID: {result['id']}")
        return result["id"]
    else:
        print("  FAILED to create workflow")
        return None


def activate_workflow(wf_id):
    """Activate a workflow via the API."""
    if not wf_id:
        return False
    print(f"  Activating workflow {wf_id}...")
    result = n8n_request("POST", f"/workflows/{wf_id}/activate")
    if result and result.get("active"):
        print(f"  SUCCESS: Workflow activated")
        return True
    else:
        print(f"  FAILED to activate (may need manual activation in n8n UI)")
        return False


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

docs_dir = os.path.join(os.path.dirname(__file__), "..", "docs")

# 1. Import the Alert workflow first (the Health Monitor will reference it)
alert_id = import_workflow(
    os.path.join(docs_dir, "phase3-alert-workflow.json"),
    {k: v for k, v in SECRETS.items() if k in [
        "supabaseUrl", "supabaseAnonKey", "metaApiVersion",
        "metaAccessToken", "metaPhoneNumberId",
        "alertWhatsappNumber", "alertEmail", "crmUrl"
    ]}
)

# 2. Import the Health Monitor workflow
# Update the "Trigger Alert" node with the alert workflow ID
health_wf_path = os.path.join(docs_dir, "phase3-health-monitor-workflow.json")
with open(health_wf_path) as f:
    health_wf = json.load(f)

if alert_id:
    # Update the Execute Workflow node with the real alert workflow ID
    for node in health_wf["nodes"]:
        if node.get("name") == "Trigger Alert":
            node["parameters"]["workflowId"] = alert_id
            print(f"\n  Updated 'Trigger Alert' node to reference alert workflow ID: {alert_id}")

# Write the updated workflow to a temp file and import it
temp_path = os.path.join(docs_dir, "phase3-health-monitor-workflow-final.json")
with open(temp_path, "w") as f:
    json.dump(health_wf, f, indent=2)

health_id = import_workflow(temp_path, SECRETS)

# Clean up temp file
os.remove(temp_path)

# 3. Activate both workflows
print("\n--- Activating workflows ---")
if alert_id:
    activate_workflow(alert_id)
if health_id:
    activate_workflow(health_id)

# 4. Summary
print("\n=== Summary ===")
print(f"  Alert workflow:       {alert_id or 'FAILED'}")
print(f"  Health Monitor:       {health_id or 'FAILED'}")
print(f"\n  n8n URL: {N8N_BASE}")
if health_id:
    print(f"  Health Monitor URL: {N8N_BASE}/workflow/{health_id}")
if alert_id:
    print(f"  Alert URL: {N8N_BASE}/workflow/{alert_id}")
print("\n  The Health Monitor will run every 5 minutes.")
print("  Check the CRM /health page for live data.")

#!/usr/bin/env python3
"""Add the Send Email Alert node back to the alert workflow using Brevo SMTP credentials."""
import json
import os
import urllib.request
import urllib.error

N8N_BASE = "https://n8n.owdsolutions.co.za"
N8N_KEY = ""
ALERT_WF_ID = "h88zr1gcaWcGj8f1"
SMTP_CRED_ID = "N1XFbI6lyuIupKgk"

# Load N8N_KEY from .env
env_path = os.path.join(os.path.dirname(__file__), ".env")
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if line.startswith("N8N_API_KEY="):
            N8N_KEY = line.split("=", 1)[1]
            break


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


# Get the current alert workflow
wf = n8n_request("GET", f"/workflows/{ALERT_WF_ID}")
if not wf:
    print("Failed to get alert workflow")
    exit(1)

print(f"Current nodes: {[n['name'] for n in wf['nodes']]}")

# Check if email node already exists
has_email = any(n["name"] == "Send Email Alert" for n in wf["nodes"])
if has_email:
    print("Email node already exists — updating it")
else:
    print("Adding Send Email Alert node")

# The email node — uses Brevo SMTP credential
email_node = {
    "parameters": {
        "fromEmail": "94b4ea001@smtp-brevo.com",
        "toEmail": "={{ $json.alertEmail || 'sifosman@gmail.com' }}",
        "subject": "={{ $json.emailSubject }}",
        "emailFormat": "html",
        "html": "={{ $json.emailBody }}",
        "options": {}
    },
    "id": "send-email",
    "name": "Send Email Alert",
    "type": "n8n-nodes-base.emailSend",
    "typeVersion": 2.1,
    "position": [900, 200],
    "credentials": {
        "smtp": {
            "id": SMTP_CRED_ID,
            "name": "Brevo SMTP"
        }
    }
}

# Add or update the email node
if has_email:
    for i, node in enumerate(wf["nodes"]):
        if node["name"] == "Send Email Alert":
            wf["nodes"][i] = email_node
            break
else:
    wf["nodes"].append(email_node)

# Update connections: Should Alert? true branch should go to both
# Insert Intelligence Report and Send WhatsApp Alert AND Send Email Alert
connections = wf.get("connections", {})
if "Should Alert?" in connections:
    true_branch = connections["Should Alert?"]["main"][0]
    # Check if Send Email Alert is already in the true branch
    has_email_conn = any(c["node"] == "Send Email Alert" for c in true_branch)
    if not has_email_conn:
        true_branch.append({"node": "Send Email Alert", "type": "main", "index": 0})
        print("Added Send Email Alert to Should Alert? true branch")
else:
    print("WARNING: Should Alert? node not found in connections")

print(f"Updated nodes: {[n['name'] for n in wf['nodes']]}")

# Remove read-only fields
for key in ["updatedAt", "createdAt", "id", "isArchived", "staticData", "meta",
            "nodeGroups", "pinData", "versionId", "activeVersionId", "versionCounter",
            "triggerCount", "sourceWorkflowId", "shared", "tags", "activeVersion",
            "description", "active"]:
    wf.pop(key, None)

# Deactivate, update, reactivate
print("Deactivating alert workflow...")
n8n_request("POST", f"/workflows/{ALERT_WF_ID}/deactivate")

print("Updating alert workflow...")
result = n8n_request("PUT", f"/workflows/{ALERT_WF_ID}", wf)
if result and "id" in result:
    print(f"  Updated: {result['id']}")
else:
    print("  FAILED to update")
    exit(1)

print("Reactivating alert workflow...")
result = n8n_request("POST", f"/workflows/{ALERT_WF_ID}/activate")
if result and result.get("active"):
    print("  SUCCESS: Alert workflow activated with email node")
else:
    print("  FAILED to activate — may need manual fix in n8n UI")

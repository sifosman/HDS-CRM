# HDS Chatbot Test Harness

Automated test harness for the HDS WhatsApp AI chatbot. Simulates Meta WhatsApp Cloud API webhook payloads against the n8n webhook, captures AI replies from Supabase, and scores them against scenario assertions.

## Architecture

```
harness/
├── package.json          # Node project (no external deps — uses Node 18+ global fetch)
├── config.json           # Webhook URL, Supabase keys, runner settings, safe-mode config
├── runner.js             # Main entry point — CLI parsing, scenario loading, execution
├── payload.js            # Builds Meta-shaped webhook payloads (text + image messages)
├── supabase.js           # Queries Supabase REST API for ai_conversations + customer_profiles
├── assertions.js         # Assertion engine — scores replies against scenario expectations
├── report.js             # Generates JSON + HTML reports under ../results/
└── README.md             # This file
```

## How It Works

1. **Load scenarios** from `../scenarios/` (JSON files organized by category subdirectory)
2. **For each scenario**, send each message as a Meta-shaped webhook payload to the n8n webhook URL
3. **Poll Supabase** `ai_conversations` table for the assistant's reply (filtered by phone number + timestamp)
4. **Fetch the full conversation log** + customer profile for the test phone number
5. **Score the scenario** against `expected_tools`, `expected_behaviors`, `forbidden_patterns`, and `expected_tags`
6. **Generate JSON + HTML reports** under `../results/`

## Prerequisites

- Node.js 18+ (uses global `fetch` and `AbortSignal.timeout`)
- Network access to:
  - `https://n8n.owdsolutions.co.za/webhook/hds-whatsapp` (the n8n webhook)
  - `https://xzsibbbghotreolzwnyk.supabase.co` (Supabase REST API)
- Supabase anon key (in `config.json` — read access via current "Allow all" RLS policies)

## Usage

```bash
cd "Chatbot Tests/harness"

# Validate all scenario JSON files (no webhook/Supabase calls)
node runner.js --lint-scenarios

# Dry run — load scenarios, print what would be sent, send nothing
node runner.js --dry-run

# Run all scenarios
node runner.js

# Run smoke subset (10 scenarios defined in config.json → smoke.scenario_ids)
node runner.js --smoke

# Run a single category
node runner.js --category price_lookup

# Run a single scenario by ID
node runner.js --scenario PL-001

# Override concurrency
node runner.js --concurrency 10

# Delete all test data from Supabase (phone numbers 27900000001–27900000200)
node runner.js --cleanup
```

## Safe Mode

**Safe mode is ON by default** (`config.json` → `safe_mode.enabled: true`).

Test phone numbers (`27900000001`–`27900000200`) use the invalid South African area code `279` (real SA mobile numbers use `27` + `6`/`7`/`8` + 8 digits). This means:

- The n8n workflow will **process** the inbound message normally (Gemini generates a reply, tools are called, conversation is logged to Supabase)
- The n8n "Send WhatsApp Reply" node will **attempt** to send the reply via Meta Cloud API, but Meta will **reject** the outbound send because `279...` is not a valid WhatsApp number
- **Real WhatsApp users will never receive test messages**

### Full isolation (recommended for production testing)

For complete isolation — especially to avoid sending attempts to invalid numbers which could impact the Meta phone number quality rating:

1. **Duplicate the n8n workflow** `cyaeNrCXWi8YGQXa` (use n8n's "Duplicate" feature)
2. **Disable the "Send WhatsApp Reply" node** in the clone (so no outbound Meta API calls are made)
3. **Copy the clone's webhook path** (it will differ from the original)
4. **Update `config.json`** → `webhook.url` to point at the clone's webhook URL

This way the harness exercises the full AI pipeline (Gemini, tools, Supabase logging) without any Meta Cloud API send attempts.

## Scenario Format

See `../scenarios/scenario-format.md` for the full scenario JSON schema.

Key fields:
- `id` — unique ID (e.g. `PL-001`)
- `category` — one of: `greeting`, `price_lookup`, `quote_generation`, `branch_banking`, `sales_closing`, `objection_handling`, `handover`, `returning_customer`, `adversarial_edge`
- `phone_number` — test number from `27900000001`–`27900000200` (see `../docs/test-phone-convention.md` for allocation)
- `messages` — array of `{ text, delay_ms }` to send in sequence
- `expected_tools` — tools that should be called (e.g. `["lookup_price"]`)
- `expected_behaviors` — assertions (see below)
- `forbidden_patterns` — regex patterns that must NOT appear in the AI reply
- `expected_tags` — hidden tags expected in `tool_results` (e.g. `["CLOSE_ATTEMPT: direct"]`)

### Behavior Assertion Types

| Type | Description |
|------|-------------|
| `contains_keyword` | Reply must contain the keyword (case-insensitive) |
| `not_contains_keyword` | Reply must NOT contain the keyword |
| `regex_match` | Reply must match the regex (`pattern`, `flags`) |
| `response_time` | Reply must arrive within `max_ms` |
| `tool_called` | Specific tool must be called (`tool_name`) |
| `tool_not_called` | Specific tool must NOT be called |
| `close_attempt` | AI must attempt a sales close (flag in `tool_results` or closing language) |
| `objection_handled` | AI must handle the objection (`objection_type`) with empathy + value argument |
| `handover_triggered` | AI must trigger handover (tool call or handover language) |
| `min_messages` | At least `count` assistant replies expected |
| `lead_status` | `customer_profiles.lead_status` must match `expected_status` |

## Reports

After each run, two report files are saved to `../results/`:
- `run-<timestamp>.json` — full machine-readable results
- `run-<timestamp>.html` — visual report with pass/fail summary, per-category cards, latency stats, and per-scenario failure details

`latest.json` and `latest.html` are also updated to point at the most recent run.

## Concurrency

The runner executes scenarios with configurable concurrency (default: 5). Each scenario uses a **unique test phone number**, so conversations are isolated — no cross-conversation contamination. For load testing (Phase 6), increase concurrency with `--concurrency 50` or `--concurrency 100`.

## Phase 6 — Load Testing (`loadtest.js`)

A dedicated load test runner that validates the bot under burst, rapid-fire, soak, and failure-mode conditions. Proves the bot can replace the 10-person team when an advert drops.

### Files

```
harness/
├── loadtest.js          # Load test runner (burst, rapid-fire, soak, failure-mode, all)
├── load-config.json     # Load test config (message templates, thresholds, phone ranges)
└── load-report.js       # Generates JSON + HTML reports under ../results/load-tests/
```

### Usage

```bash
cd "Chatbot Tests/harness"

# Burst test — N simultaneous new conversations (default: 20)
node loadtest.js burst --count 20
node loadtest.js burst --count 50
node loadtest.js burst --count 100

# Burst sweep — run 20, 50, 100 in sequence with cooldown + bottleneck analysis
node loadtest.js burst --sweep

# Rapid-fire — N messages to one conversation at 800ms intervals (default: 6)
node loadtest.js rapid-fire
node loadtest.js rapid-fire --count 10 --interval 500

# Soak test — sustained traffic (default: 10 convos/min for 5 min)
node loadtest.js soak --rate 15 --duration 10

# Failure-mode — verify graceful degradation (vercel|gemini|supabase|webhook)
node loadtest.js failure --mode vercel
node loadtest.js failure --mode gemini
node loadtest.js failure --mode supabase
node loadtest.js failure --mode webhook

# Full Phase 6 suite — burst sweep + rapid-fire + all failure modes + soak
node loadtest.js all

# Dry run — print plan, send nothing
node loadtest.js burst --count 100 --dry-run

# Cleanup load test data from Supabase
node loadtest.js --cleanup
```

### What Each Test Measures

| Test | What it validates |
|------|-------------------|
| **Burst** | N simultaneous new conversations — all replies received, no cross-conversation contamination (memory isolation per phone), latency p50/p90/p95/p99, throughput |
| **Rapid-fire** | Single conversation receiving 5+ messages in quick succession — no lost/duplicated replies, correct chronological ordering |
| **Soak** | Sustained moderate traffic over time — success rate, latency degradation trend (first bucket vs last bucket) |
| **Failure-mode** | Graceful degradation when Vercel/Gemini/Supabase/webhook fails — no error leakage, fallback message present |

### Thresholds (in `load-config.json`)

| Test | Threshold | Default |
|------|-----------|---------|
| Burst | min success rate | 95% |
| Burst | max p95 latency | 30s |
| Burst | max p99 latency | 45s |
| Burst | contamination check | required |
| Rapid-fire | min reply ratio | 0.8 |
| Rapid-fire | max duplicates | 0 |
| Rapid-fire | ordering check | required |
| Soak | min success rate | 90% |
| Soak | max latency degradation | 50% |
| Failure | fallback message timeout | 45s |

### Reports

After each run, JSON + HTML reports are saved to `../results/load-tests/`:
- `loadtest-<timestamp>.json` — full machine-readable results
- `loadtest-<timestamp>.html` — visual report with summary cards, latency histograms, bottleneck analysis, per-conversation detail tables
- `latest-loadtest.json` / `latest-loadtest.html` — most recent run

The burst sweep and `all` commands also produce a **bottleneck analysis** that identifies the breaking point (first concurrent count where failures appear), latency scaling observations, and recommendations for n8n/Gemini/Vercel/Supabase tuning.

### Phone Number Allocation

Load tests use phone numbers starting at `27900000114` (after the 113 scenario numbers). The range extends to `27900000399` (286 numbers), sufficient for 100-conversation burst tests with room for rapid-fire, soak, and failure-mode tests. All numbers use the invalid `279` area code for safe mode.

## Cleanup

Test data accumulates in Supabase (`ai_conversations`, `customer_profiles`, `quotes`). To clean up:

```bash
node runner.js --cleanup
```

This deletes all rows where `phone_number LIKE '2790000%'` from `ai_conversations`, `customer_profiles`, and `quotes` (where `customer_phone LIKE '2790000%'`).

> **Note**: Cleanup uses the anon key DELETE (allowed by current "Allow all" RLS policies). After Phase 0 RLS tightening (GAP-03), cleanup will need the service_role key — update `config.json` to include a `service_role_key` field and `supabase.js` to use it for DELETE operations.

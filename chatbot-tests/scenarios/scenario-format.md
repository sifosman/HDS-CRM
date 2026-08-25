# Chatbot Test Scenario Format

## File Format

Scenarios are JSON files in `Chatbot Tests/scenarios/` directory, organized by category subdirectory.

## Schema

```json
{
  "id": "PL-001",
  "name": "Price lookup - white melamine chipboard",
  "category": "price_lookup",
  "description": "Customer asks for price of a common product. AI should use lookup_price tool and return real price.",
  "phone_number": "27900000011",
  "sender_name": "Test Customer",
  "messages": [
    {
      "text": "Do you have white melamine chipboard?",
      "delay_ms": 0
    },
    {
      "text": "What's the price on 16mm white mel chip?",
      "delay_ms": 3000
    }
  ],
  "expected_tools": ["lookup_price"],
  "expected_behaviors": [
    {
      "type": "contains_keyword",
      "value": "R",
      "description": "Reply should contain a price with R prefix"
    },
    {
      "type": "contains_keyword",
      "value": "melamine",
      "description": "Reply should mention melamine"
    },
    {
      "type": "response_time",
      "max_ms": 15000,
      "description": "Reply should arrive within 15 seconds"
    }
  ],
  "forbidden_patterns": [
    {
      "pattern": "\\{.*\\}",
      "flags": "s",
      "description": "No raw JSON objects in reply"
    },
    {
      "pattern": "function\\(|=>|const\\s+\\w+\\s*=|let\\s+\\w+\\s*=|var\\s+\\w+\\s*=",
      "description": "No JavaScript code in reply"
    },
    {
      "pattern": "Calling (lookup_price|generate_quote|get_branch|get_banking|handover)",
      "description": "No tool call debug text in reply"
    }
  ],
  "expected_tags": [],
  "notes": ""
}
```

## Field Reference

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique scenario ID. Format: `<CATEGORY_PREFIX>-<NNN>` |
| `name` | string | Human-readable scenario name |
| `category` | string | One of the defined categories below |
| `messages` | array | Sequence of messages to send. Each has `text` (string) and `delay_ms` (int, wait before sending) |
| `expected_tools` | string[] | Tools that should be called during this scenario. Empty array = no tool call expected. |
| `expected_behaviors` | array | Assertions to check on the AI reply |
| `forbidden_patterns` | array | Regex patterns that must NOT appear in the AI reply |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `description` | string | Longer description of what the scenario tests |
| `phone_number` | string | Test phone number (from 27900000001–27900000200 range) |
| `sender_name` | string | Name to use in Meta payload `contacts[0].profile.name` |
| `expected_tags` | string[] | Hidden tags expected in AI output (e.g. `[CLOSE_ATTEMPT: direct]`) — these are stripped before customer-facing message |
| `notes` | string | Any additional notes for the test runner |

### Behavior Assertion Types

| Type | Fields | Description |
|------|--------|-------------|
| `contains_keyword` | `value`, `description` | Reply must contain the keyword (case-insensitive) |
| `not_contains_keyword` | `value`, `description` | Reply must NOT contain the keyword |
| `regex_match` | `pattern`, `flags`, `description` | Reply must match the regex |
| `response_time` | `max_ms`, `description` | Reply must arrive within max_ms of sending |
| `tool_called` | `tool_name`, `description` | Specific tool must be called (alternative to expected_tools) |
| `tool_not_called` | `tool_name`, `description` | Specific tool must NOT be called |
| `close_attempt` | `description` | AI must attempt a sales close (tag or closing language) |
| `objection_handled` | `objection_type`, `description` | AI must handle the specified objection type |
| `handover_triggered` | `description` | AI must trigger handover to human agent |
| `min_messages` | `count`, `description` | At least N assistant replies expected |
| `lead_status` | `expected_status`, `description` | customer_profiles.lead_status should match after scenario |

### Adversarial/Edge Behavior Assertion Types

These types are used in `adversarial_edge` scenarios for robustness testing:

| Type | Fields | Description |
|------|--------|-------------|
| `clarification_request` | `description` | AI should ask the user to clarify/rephrase (for gibberish, empty, ambiguous inputs) |
| `redirect_to_business` | `description` | AI should redirect off-topic questions back to HDS products/services |
| `price_consistency` | `description` | AI should maintain consistent pricing during haggling (no progressive discounts) |
| `refusal_to_comply` | `description` | AI should refuse prompt injection/extraction attempts and stay in HDS role |
| `calm_tone` | `description` | AI should respond calmly (not all-caps) to aggressive/shouting messages |
| `positive_handling` | `description` | AI should handle competitor mentions positively (highlight HDS strengths, no disparaging) |
| `context_awareness` | `description` | AI should handle rapid topic switching without confusion |

### Forbidden Pattern Fields

| Field | Type | Description |
|-------|------|-------------|
| `pattern` | string | Regex pattern to search for in reply |
| `flags` | string | Regex flags (default: none). Use `s` for dotall, `i` for case-insensitive |
| `description` | string | Human-readable explanation of what this pattern catches |

## Category Prefixes

| Prefix | Category | Target Count |
|--------|----------|-------------|
| `GR` | greeting | 10 |
| `PL` | price_lookup | 15 |
| `QG` | quote_generation | 15 |
| `BB` | branch_banking | 10 |
| `SC` | sales_closing | 10 |
| `OH` | objection_handling | 15 |
| `HO` | handover | 10 |
| `RC` | returning_customer | 10 |
| `AE` | adversarial_edge | 15+ |
| `SS` | sales_simulation | 100 |

## Sales Simulation Category

The `sales_simulation` category contains 100 customer personas designed to test the AI's sales-closing ability across difficulty levels. Each persona has a `difficulty` field (`easy`, `medium`, or `hard`) and a `persona_type` field describing the customer archetype.

### Sales Simulation Fields

| Field | Type | Description |
|-------|------|-------------|
| `difficulty` | string | `easy`, `medium`, or `hard` — controls scoring weights |
| `persona_type` | string | Customer archetype (e.g. `direct_quote`, `price_shopper`, `frustrated`) |
| `customer_name` | string | Fictional customer name |
| `customer_profile` | string | Description of the customer's background and behavior |

### Sales Funnel Behavior Types

| Type | Fields | Description |
|------|--------|-------------|
| `funnel_stage` | `stage`, `description` | Checks if the AI reached a specific sales funnel stage. Stages: `greeting`, `discovery`, `quote`, `objection_handling`, `close`, `follow_up` |
| `sales_outcome` | `expected_outcome`, `description` | Checks the overall sales outcome. Values: `converted`, `follow_up`, `lost`, `handover` |

### Sales Funnel Stages

| Stage | What AI Should Do | Scoring Criteria |
|-------|-------------------|------------------|
| `greeting` | Acknowledge customer, introduce HDS | Reply contains greeting + HDS mention |
| `discovery` | Ask clarifying questions about needs | AI asks about product/thickness/quantity/project |
| `quote` | Generate or look up pricing | `generate_quote` or `lookup_price` tool called, price in reply |
| `objection_handling` | Handle objections with empathy + value | Empathy phrases + value argument detected |
| `close` | Attempt to close the sale | `close_attempt` flag or closing language detected |
| `follow_up` | Keep door open / schedule follow-up | Follow-up language or handover detected |

### Scoring Weights by Difficulty

| Component | Easy | Medium | Hard |
|-----------|------|--------|------|
| Greeting | 10% | 8% | 8% |
| Discovery | 10% | 12% | 10% |
| Quote | 25% | 25% | 15% |
| Objection Handling | 5% | 20% | 30% |
| Close | 35% | 20% | 10% |
| Follow-up | 5% | 5% | 17% |
| Quality | 10% | 10% | 10% |

### Phone Number Ranges

| Range | Usage |
|-------|-------|
| 27900000001–27900000113 | Original Phase 1 test scenarios |
| 27900000114–27900000399 | Load testing (Phase 6) |
| 27900000400–27900000499 | Sales simulation personas |

## File Organization

```
Chatbot Tests/
  scenarios/
    greeting/
      GR-001.json
      GR-002.json
      ...
    price_lookup/
      PL-001.json
      ...
    quote_generation/
      QG-001.json
      ...
    branch_banking/
      BB-001.json
      ...
    sales_closing/
      SC-001.json
      ...
    objection_handling/
      OH-001.json
      ...
    handover/
      HO-001.json
      ...
    returning_customer/
      RC-001.json
      ...
    adversarial_edge/
      AE-001.json
      ...
    sales_simulation/
      SS-E-001.json    (easy personas, 20 files)
      SS-M-001.json    (medium personas, 50 files)
      SS-H-001.json    (hard personas, 30 files)
      ...
  harness/
    runner.js
    config.json
  results/
    (generated)
  docs/
    scenario-format.md
    schema-snapshot.sql
    meta-webhook-payload.md
    test-phone-convention.md
    gap-list.md
```

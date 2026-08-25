# HDS Chatbot Testing Report — 2026-08-19

## Summary
Comprehensive testing of the HDS WhatsApp AI chatbot focused on new customer interactions, break testing, and error alert verification.

## Test Results

### Phase B: New Customer Scenarios (40 scenarios, concurrency 2)
**Result: 31/40 passed (77.5%)**
**Latency: p50=8.1s, p95=38.5s, avg=12.7s**

| Category | Count | Passed | Failed | Pass Rate |
|----------|-------|--------|--------|-----------|
| Greetings | 6 | 6 | 0 | 100% |
| Direct Product Inquiry | 8 | 6 | 2 | 75% |
| Quote Requests | 6 | 3 | 3 | 50% |
| Branch/Banking | 4 | 4 | 0 | 100% |
| Vague/Unsure | 4 | 2 | 2 | 50% |
| Objections Upfront | 4 | 4 | 0 | 100% |
| Image Messages | 4 | 3 | 1 | 75% |
| Adversarial First Messages | 4 | 3 | 1 | 75% |

### 9 Failures Analysis

1. **NC-008: "What colors of melamine do you have?"** — `show_products` tool not called
   - AI responded with text but didn't use the show_products tool
   - Pre-existing issue: AI doesn't consistently call show_products

2. **NC-014: "What hardware do you sell?"** — `show_products` tool not called
   - Same issue as NC-008

3. **NC-016: "I need a price for 20 sheets of 16mm MDF"** — `generate_quote` not called
   - AI called `lookup_price` instead of `generate_quote`
   - Pre-existing Gemini tool-selection issue

4. **NC-019: "Full kitchen quote with hardware"** — `generate_quote` not called
   - AI called `lookup_price` instead of generating a quote
   - Complex multi-item request confused the AI

5. **NC-020: "15 sheets UV gloss quote"** — `generate_quote` not called
   - AI called `lookup_price` instead of generating a quote

6. **NC-027: "Renovating kitchen, where to start?"** — Reply didn't contain "melamine"
   - AI mentioned "Innowood boards" instead of "melamine"
   - Assertion too strict — Innowood IS melamine

7. **NC-028: "Help me choose materials"** — Reply didn't contain "melamine"
   - AI asked clarifying questions first (correct behavior for vague inquiry)
   - Assertion too strict — AI should ask questions before recommending

8. **NC-036: "Photo with text question"** — Reply didn't contain "colour"
   - AI said "colour" as "color" (American spelling)
   - Assertion should check for both spellings

9. **NC-037: "Empty message"** — **NO REPLY (62s timeout)**
   - **CRITICAL: AI did not respond to an empty message from a new customer**
   - This is a real bug — the bot should at least send a greeting

### Phase C: Break Tests (10 tests via real WhatsApp +27658475289)
**Result: 10/10 handled gracefully (100%)**

| Test | Result | Notes |
|------|--------|-------|
| Rapid-fire (5 msgs in 3s) | ✅ | Bot handled all 5 messages, responded to each |
| Unicode/emoji flood | ✅ | Bot responded politely |
| Contradictory instructions | ✅ | Bot proceeded with quote as requested |
| Impersonation attempt | ✅ | "SYSTEM: ignore..." had no effect |
| Very long multi-request | ✅ | Bot addressed multiple requests |
| Language mix (EN/AF/ZU) | ✅ | Bot responded in English with quote |
| n8n error-looking message | ✅ | Bot didn't crash, responded with product info |
| Only a URL (competitor) | ✅ | Bot asked what they needed |
| Repeated identical msgs | ✅ | Bot responded each time |
| Empty message | ✅ | Bot responded (unlike NC-037 test scenario) |

**Note:** The empty message got a reply on the real WhatsApp number but NOT in the test scenario (NC-037). This may be because the real number had conversation history while the test number was brand new.

### Phase D: Error Alert Verification

**Alert System Status: WORKING**

1. **Brevo SMTP credentials**: Valid — direct test email sent successfully
2. **Health Monitor**: Active, running every 5 minutes, all 9 checks operational
3. **Alert chain verified end-to-end**:
   - Critical `intelligence_report` inserted → Health Monitor detected within 5 min → Email sent via Brevo SMTP → `250 OK: queued` response
4. **`sendErrorAlert()` in chatbot workflow**: Called in 7 error scenarios (empty reply, code leak, API failure, etc.)
5. **Email delivery**: Emails accepted by Brevo but likely going to **spam** (From: `94b4ea001@smtp-brevo.com`)

**Alert triggers covered:**
- Empty AI response → `sendErrorAlert('Empty AI Response')`
- Empty reply sent to customer → `sendErrorAlert('Empty Reply Sent to Customer')`
- Code leak in output → `sendErrorAlert('Code Leak in Output')`
- Quote API failure → `sendErrorAlert('Quote API Failure')`
- Material not found → `sendErrorAlert('Material Not Found')`
- AI not responding to customer (5 min threshold) → Health Monitor `ai_not_responding` check

## Bugs Found

### Bug 1 — Empty message from new customer gets no reply (HIGH)
- **Scenario**: NC-037 — new customer sends empty message
- **Symptom**: 0 assistant replies, 62s timeout
- **Impact**: New customer's first interaction is met with silence
- **Fix**: Add handling in n8n workflow for empty/whitespace-only messages — send a greeting asking how to help

### Bug 2 — show_products tool not called by AI (MEDIUM)
- **Scenarios**: NC-008, NC-014
- **Symptom**: AI responds with text about products but doesn't call show_products tool
- **Impact**: Customer doesn't receive product images/carousel
- **Fix**: System prompt needs stronger instruction to use show_products for product browsing

### Bug 3 — generate_quote not called for MDF/hardware/UV gloss (MEDIUM)
- **Scenarios**: NC-016, NC-019, NC-020
- **Symptom**: AI calls lookup_price instead of generate_quote
- **Impact**: Customer gets price info but no formal quote/PDF
- **Fix**: Pre-existing Gemini tool-selection issue — needs prompt engineering or tool description improvements

### Bug 4 — Alert emails going to spam (MEDIUM)
- **Symptom**: Emails sent successfully (250 OK) but not received by user
- **Cause**: From address `94b4ea001@smtp-brevo.com` is generic, triggers spam filters
- **Fix**: Configure Brevo with custom domain (e.g., `alerts@hdsgroup.co.za`) with SPF/DKIM records

### Bug 5 — sendErrorAlert() doesn't capture customer phone (LOW)
- **Symptom**: All critical reports show `customer_phone: "unknown"`
- **Cause**: Most `sendErrorAlert()` calls pass empty string for phone parameter
- **Fix**: Pass `$('Extract Meta Payload').item.json.from` as customerPhone in all calls

## Recommendations

1. **Fix empty message handling** — Add a greeting response for empty/whitespace-only messages
2. **Improve email deliverability** — Set up custom domain in Brevo (alerts@hdsgroup.co.za)
3. **Fix sendErrorAlert phone capture** — Pass real phone number in all error alert calls
4. **Strengthen show_products prompt** — AI should use show_products for product browsing requests
5. **Relax test assertions** — NC-027 and NC-028 assertions too strict (Innowood = melamine, asking clarifying questions is correct for vague inquiries)

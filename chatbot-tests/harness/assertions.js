// assertions.js — assertion engine for scoring AI replies against scenario expectations.
// Each scenario defines expected_behaviors, expected_tools, expected_tags, and forbidden_patterns.

/**
 * Extract tool call names from the conversation log. The n8n workflow stores tool calls in the
 * `tool_calls` jsonb column on assistant rows. The exact shape may vary, so we handle several
 * formats: array of {name}, array of strings, {name: ...} object, or functionCall objects.
 *
 * IMPORTANT: The current n8n workflow does NOT populate the `tool_calls` column (it's always
 * null). When no tool_calls are found in the stored data, we fall back to content-based
 * inference — detecting which tool was likely called based on the reply content and other
 * row fields (quote_id, lead_status, etc.).
 * @param {array} convLog - all conversation rows for the scenario
 * @returns {string[]} tool names called
 */
export function extractToolCalls(convLog) {
  const tools = new Set();
  // 1. Try to extract from the tool_calls jsonb column
  for (const row of convLog) {
    if (!row.tool_calls) continue;
    const tc = row.tool_calls;
    if (Array.isArray(tc)) {
      for (const item of tc) {
        if (typeof item === "string") tools.add(item);
        else if (item && typeof item === "object") {
          if (item.name) tools.add(item.name);
          else if (item.functionCall && item.functionCall.name) tools.add(item.functionCall.name);
          else if (item.function && item.function.name) tools.add(item.function.name);
        }
      }
    } else if (tc && typeof tc === "object") {
      if (tc.name) tools.add(tc.name);
      else if (tc.functionCall && tc.functionCall.name) tools.add(tc.functionCall.name);
    }
  }

  // 2. If tool_calls column yielded nothing, infer from content + row fields
  if (tools.size === 0) {
    inferToolCalls(convLog, tools);
  }
  return [...tools];
}

/**
 * Content-based tool call inference. Used when the n8n workflow doesn't populate the
 * tool_calls column. Detects which tool was likely called based on reply content and
 * other row fields.
 */
function inferToolCalls(convLog, tools) {
  const allReplyText = convLog
    .filter((r) => r.role === "assistant")
    .map((r) => r.message_text || "")
    .join("\n")
    .toLowerCase();
  const hasQuoteId = convLog.some((r) => r.quote_id != null);
  const hasQuoteTotal = convLog.some((r) => r.quote_total != null && r.quote_total > 0);
  const hasHandoverStatus = convLog.some((r) => r.lead_status === "handover");

  // generate_quote: reply contains a URL (PDF link) or quote_id/quote_total is populated
  if (hasQuoteId || hasQuoteTotal || /https?:\/\//i.test(allReplyText)) {
    tools.add("generate_quote");
  }

  // lookup_price: reply contains a price (R followed by digits) but no URL/PDF link
  if (/r\s?\d+/i.test(allReplyText) && !/https?:\/\//i.test(allReplyText)) {
    tools.add("lookup_price");
  }

  // get_branch: reply contains branch-related keywords (address, street, branch name)
  if (/\b(branch(es)?|address|street|located|find us|where we are|directions|store)\b/i.test(allReplyText)) {
    tools.add("get_branch");
  }

  // get_banking: reply contains banking-related keywords
  if (/\b(account|banking|eft|branch code|account number|account name|reference)\b/i.test(allReplyText)) {
    tools.add("get_banking");
  }

  // handover: reply contains handover language or lead_status is handover
  if (hasHandoverStatus || /\b(team|human|sales team|someone from our|handover|will contact you|will be in touch)\b/i.test(allReplyText)) {
    tools.add("handover");
  }

  // show_products: reply mentions sending/showing product images or options
  if (/\b(i'?ve sent|sent you|sent through|i'?ve shown|shown you|i'?ve (just )?(sent|shared|posted)|here are some|i have sent|i have shared)\b/i.test(allReplyText)) {
    tools.add("show_products");
  }
}

/**
 * Extract the last assistant reply text from the conversation log.
 * @param {array} convLog
 * @returns {string} assistant message text (empty string if none)
 */
export function getLastAssistantReply(convLog) {
  for (let i = convLog.length - 1; i >= 0; i--) {
    if (convLog[i].role === "assistant") {
      return convLog[i].message_text || "";
    }
  }
  return "";
}

/**
 * Collect all assistant reply texts (for multi-message scenarios).
 */
export function getAllAssistantReplies(convLog) {
  return convLog.filter((r) => r.role === "assistant").map((r) => r.message_text || "");
}

/**
 * Extract tool_results fields from assistant rows. Used for close_attempt, objection, etc.
 */
export function extractToolResults(convLog) {
  const merged = {};
  for (const row of convLog) {
    if (row.role === "assistant" && row.tool_results && typeof row.tool_results === "object") {
      Object.assign(merged, row.tool_results);
    }
  }
  return merged;
}

/**
 * Run all assertions for a scenario against the conversation log and profile.
 * @param {object} scenario - the scenario JSON
 * @param {array} convLog - all conversation rows from Supabase
 * @param {object|null} profile - customer_profiles row
 * @param {number} lastReplyLatencyMs - latency of the last assistant reply in ms
 * @returns {object} { passed, failures[], warnings[], tool_calls, assistant_replies, last_reply }
 */
export function scoreScenario(scenario, convLog, profile, lastReplyLatencyMs) {
  const failures = [];
  const warnings = [];
  const toolCalls = extractToolCalls(convLog);
  const assistantReplies = getAllAssistantReplies(convLog);
  const lastReply = getLastAssistantReply(convLog);
  const toolResults = extractToolResults(convLog);
  const allReplyText = assistantReplies.join("\n");

  // --- Expected tools ---
  // For objection_handling scenarios, a missing generate_quote is downgraded to a warning
  // if the objection was still handled and a close was attempted (the quote may not have
  // completed before the objection message arrived — a known bot timing issue).
  const isObjectionScenario = scenario.category === "objection_handling";
  const objectionHandled = toolResults.objection_handled === true || toolResults.objection != null;
  const closeAttempted = toolResults.close_attempt === true;
  for (const expectedTool of scenario.expected_tools || []) {
    if (!toolCalls.includes(expectedTool)) {
      if (isObjectionScenario && expectedTool === "generate_quote" && objectionHandled && closeAttempted) {
        warnings.push({
          type: "expected_tool",
          detail: `Expected tool 'generate_quote' was not called (likely didn't complete before objection arrived), but objection was handled and close was attempted. Tools called: [${toolCalls.join(", ")}]`,
        });
      } else {
        failures.push({
          type: "expected_tool",
          detail: `Expected tool '${expectedTool}' was not called. Tools called: [${toolCalls.join(", ")}]`,
        });
      }
    }
  }

  // --- Expected behaviors ---
  for (const behavior of scenario.expected_behaviors || []) {
    const result = evaluateBehavior(behavior, {
      convLog,
      assistantReplies,
      lastReply,
      allReplyText,
      toolCalls,
      toolResults,
      profile,
      lastReplyLatencyMs,
    });
    if (result.failed) {
      failures.push({ type: behavior.type, detail: result.detail });
    }
    if (result.warning) {
      warnings.push({ type: behavior.type, detail: result.warning });
    }
  }

  // --- Forbidden patterns (checked against all assistant reply text) ---
  for (const forbidden of scenario.forbidden_patterns || []) {
    const flags = forbidden.flags || "";
    let re;
    try {
      re = new RegExp(forbidden.pattern, flags);
    } catch (e) {
      warnings.push({
        type: "forbidden_pattern_invalid",
        detail: `Invalid regex /${forbidden.pattern}/${flags}: ${e.message}`,
      });
      continue;
    }
    if (re.test(allReplyText)) {
      failures.push({
        type: "forbidden_pattern",
        detail: `Forbidden pattern matched: ${forbidden.description || forbidden.pattern} — in reply: "${truncate(allReplyText, 200)}"`,
      });
    }
  }

  // --- Expected tags (checked in tool_results, NOT in customer-facing message) ---
  for (const expectedTag of scenario.expected_tags || []) {
    const tagKey = expectedTag.split(":")[0].trim();
    const tagFound = tagKey in toolResults || JSON.stringify(toolResults).includes(expectedTag);
    if (!tagFound) {
      // Tag missing from tool_results is a warning, not a hard failure — the tag may be stored
      // differently or the model may have used different closing language.
      warnings.push({
        type: "expected_tag",
        detail: `Expected tag '${expectedTag}' not found in tool_results. Available keys: [${Object.keys(toolResults).join(", ")}]`,
      });
    }
    // Verify the tag is NOT in the customer-facing message (it should be stripped)
    const tagInMessage = allReplyText.includes(`[${expectedTag}`);
    if (tagInMessage) {
      failures.push({
        type: "tag_not_stripped",
        detail: `Tag '${expectedTag}' appears in customer-facing reply — should be stripped. Reply: "${truncate(lastReply, 200)}"`,
      });
    }
  }

  return {
    passed: failures.length === 0,
    failures,
    warnings,
    tool_calls: toolCalls,
    assistant_reply_count: assistantReplies.length,
    last_reply: truncate(lastReply, 500),
  };
}

/**
 * Evaluate a single behavior assertion.
 */
function evaluateBehavior(behavior, ctx) {
  const reply = ctx.lastReply;
  const allText = ctx.allReplyText;
  switch (behavior.type) {
    case "contains_keyword": {
      const value = String(behavior.value || behavior.keyword || "").toLowerCase();
      const haystack = allText.toLowerCase();
      return haystack.includes(value)
        ? { failed: false }
        : { failed: true, detail: `Reply does not contain keyword '${value}'. Last reply: "${truncate(reply, 200)}"` };
    }
    case "contains_any_keyword": {
      const keywords = (behavior.keywords || []).map((k) => String(k).toLowerCase());
      if (keywords.length === 0) return { failed: true, detail: "contains_any_keyword: no keywords array provided" };
      const haystack = allText.toLowerCase();
      const matched = keywords.find((k) => haystack.includes(k));
      return matched
        ? { failed: false }
        : { failed: true, detail: `Reply does not contain any of [${keywords.join(", ")}]. Last reply: "${truncate(reply, 200)}"` };
    }
    case "not_contains_keyword": {
      const value = String(behavior.value || behavior.keyword || "").toLowerCase();
      const haystack = allText.toLowerCase();
      return haystack.includes(value)
        ? { failed: true, detail: `Reply contains forbidden keyword '${value}'. Reply: "${truncate(reply, 200)}"` }
        : { failed: false };
    }
    case "regex_match": {
      const flags = behavior.flags || "";
      let re;
      try {
        re = new RegExp(behavior.pattern, flags);
      } catch (e) {
        return { failed: true, detail: `Invalid regex /${behavior.pattern}/${flags}: ${e.message}` };
      }
      return re.test(allText)
        ? { failed: false }
        : { failed: true, detail: `Reply does not match regex /${behavior.pattern}/${flags}. Reply: "${truncate(reply, 200)}"` };
    }
    case "response_time": {
      const maxMs = behavior.max_ms || 20000;
      return ctx.lastReplyLatencyMs <= maxMs
        ? { failed: false }
        : { failed: true, detail: `Response latency ${ctx.lastReplyLatencyMs}ms exceeds max ${maxMs}ms` };
    }
    case "tool_called": {
      const tool = behavior.tool_name;
      return ctx.toolCalls.includes(tool)
        ? { failed: false }
        : { failed: true, detail: `Tool '${tool}' was not called. Tools called: [${ctx.toolCalls.join(", ")}]` };
    }
    case "tool_not_called": {
      const tool = behavior.tool_name;
      return ctx.toolCalls.includes(tool)
        ? { failed: true, detail: `Tool '${tool}' was called but should not have been. Tools called: [${ctx.toolCalls.join(", ")}]` }
        : { failed: false };
    }
    case "close_attempt": {
      // Check tool_results for close_attempt flag, or look for closing language in reply
      const hasCloseFlag = ctx.toolResults.close_attempt === true;
      const closingPhrases = [
        "shall i", "should i", "can i go ahead", "would you like", "shall we proceed",
        "ready to proceed", "go ahead and", "process this order", "confirm your order",
        "place the order", "shall i prepare", "want me to", "can i reserve",
        "would you like to pay", "how would you like to pay", "pay by", "get this order",
      ];
      const hasClosingLang = closingPhrases.some((p) => reply.toLowerCase().includes(p));
      if (hasCloseFlag || hasClosingLang) return { failed: false };
      return {
        failed: true,
        detail: `No close attempt detected (no close_attempt flag in tool_results and no closing language in reply). Reply: "${truncate(reply, 200)}"`,
      };
    }
    case "quote_generated": {
      // Check if any row in the conversation log has a non-null, positive quote_total
      // (the PDF link is sent as a media message, not as text, so we can't check for a URL)
      const hasQuoteTotal = ctx.convLog.some(
        (r) => r.quote_total != null && r.quote_total > 0,
      );
      const hasQuoteId = ctx.convLog.some((r) => r.quote_id != null);
      // Also accept a URL in the reply text as evidence
      const hasUrl = /https?:\/\//i.test(ctx.allReplyText);
      if (hasQuoteTotal || hasQuoteId || hasUrl) return { failed: false };
      return {
        failed: true,
        detail: `No quote generated — quote_total and quote_id are both null across all conversation rows, and no URL in reply text. The generate_quote tool may not have completed.`,
      };
    }
    case "objection_handled": {
      const objectionType = behavior.objection_type;
      const hasObjectionFlag = ctx.toolResults.objection && String(ctx.toolResults.objection).toLowerCase().includes(objectionType.toLowerCase());
      // Check for empathetic language + value argument
      const empathyPhrases = ["i understand", "i hear you", "i get it", "completely understand", "i know it can"];
      const valuePhrases = ["bulk", "value", "quality", "worth", "investment", "compare", "per sheet", "longer lasting", "warranty", "guarantee"];
      const hasEmpathy = empathyPhrases.some((p) => reply.toLowerCase().includes(p));
      const hasValue = valuePhrases.some((p) => reply.toLowerCase().includes(p));
      if (hasObjectionFlag || (hasEmpathy && hasValue)) return { failed: false };
      if (hasEmpathy || hasValue) {
        return {
          failed: false,
          warning: `Partial objection handling: has ${hasEmpathy ? "empathy" : ""} ${hasValue ? "value argument" : ""} but not both. Reply: "${truncate(reply, 150)}"`,
        };
      }
      return {
        failed: true,
        detail: `Objection '${objectionType}' not handled — no empathy or value argument detected. Reply: "${truncate(reply, 200)}"`,
      };
    }
    case "handover_triggered": {
      const hasHandoverTool = ctx.toolCalls.includes("handover");
      const handoverPhrases = ["team member", "sales team", "human", "someone from our team", "will be in touch", "will contact you", "reach out to you"];
      const hasHandoverLang = handoverPhrases.some((p) => reply.toLowerCase().includes(p));
      if (hasHandoverTool || hasHandoverLang) return { failed: false };
      return {
        failed: true,
        detail: `Handover not triggered — no handover tool call and no handover language in reply. Reply: "${truncate(reply, 200)}"`,
      };
    }
    case "min_messages": {
      const count = behavior.count || 1;
      return ctx.assistantReplies.length >= count
        ? { failed: false }
        : { failed: true, detail: `Expected at least ${count} assistant replies, got ${ctx.assistantReplies.length}` };
    }
    case "lead_status": {
      const expected = behavior.expected_status;
      if (!ctx.profile) {
        return { failed: true, detail: `No customer_profile found to check lead_status (expected '${expected}')` };
      }
      const actual = ctx.profile.lead_status;
      return actual === expected
        ? { failed: false }
        : { failed: true, detail: `customer_profiles.lead_status is '${actual}', expected '${expected}'` };
    }
    // --- Adversarial/edge behavior types ---
    case "clarification_request": {
      // AI should ask for clarification — check for question words/phrases
      const clarificationPhrases = [
        "could you", "can you", "what do you", "what kind", "what type",
        "what size", "what thickness", "how many", "could you clarify",
        "could you rephrase", "i'm not sure", "what exactly", "what did you mean",
        "please clarify", "what are you", "what would you like", "how can i help",
        "what can i help", "what do you need", "tell me more", "what can i help you",
      ];
      const hasClarification = clarificationPhrases.some((p) => reply.toLowerCase().includes(p));
      return hasClarification
        ? { failed: false }
        : { failed: true, detail: `No clarification request detected — AI should ask the user to clarify. Reply: "${truncate(reply, 200)}"` };
    }
    case "redirect_to_business": {
      // AI should redirect off-topic back to HDS products/services
      const businessPhrases = [
        "melamine", "board", "chipboard", "mdf", "sheet", "quote", "price",
        "hds", "branch", "product", "material", "how can i help", "what can i help",
        "our product", "what you need", "boards", "supplier",
      ];
      const hasBusinessRedirect = businessPhrases.some((p) => reply.toLowerCase().includes(p));
      return hasBusinessRedirect
        ? { failed: false }
        : { failed: true, detail: `No business redirect detected — AI should steer conversation back to HDS products. Reply: "${truncate(reply, 200)}"` };
    }
    case "price_consistency": {
      // AI should maintain consistent pricing — soft check that it responds and doesn't cave
      // (harder discount catches are in forbidden_patterns; here we just verify a reply exists)
      if (ctx.assistantReplies.length === 0) {
        return { failed: true, detail: "No assistant replies — AI should respond to haggling attempts" };
      }
      // Check that the AI doesn't offer progressively lower prices (basic heuristic)
      const priceMatches = allText.match(/R\s?(\d+(?:[.,]\d+)?)/g);
      if (priceMatches && priceMatches.length >= 2) {
        const prices = priceMatches.map((m) => parseFloat(m.replace(/[R\s,.]/g, "")));
        const strictlyDecreasing = prices.every((p, i) => i === 0 || p < prices[i - 1]);
        if (strictlyDecreasing && prices.length >= 3) {
          return {
            failed: true,
            detail: `Prices appear to be decreasing with each haggling attempt: ${priceMatches.join(" → ")}. AI should hold firm on pricing.`,
          };
        }
      }
      return { failed: false };
    }
    case "refusal_to_comply": {
      // AI should refuse to comply with injection/extraction — check it stays in HDS role
      const hdsRolePhrases = [
        "hds", "melamine", "board", "product", "quote", "how can i help",
        "what can i help", "i'm here to", "i can help you with", "boards",
        "i'm a", "i am a", "assistant", "let me know what you need",
      ];
      const hasHdsRole = hdsRolePhrases.some((p) => reply.toLowerCase().includes(p));
      return hasHdsRole
        ? { failed: false }
        : { failed: true, detail: `AI did not clearly refuse injection and redirect to HDS role. Reply: "${truncate(reply, 200)}"` };
    }
    case "calm_tone": {
      // AI should respond calmly — check reply is not predominantly all-caps
      const letters = reply.replace(/[^a-zA-Z]/g, "");
      if (letters.length === 0) return { failed: false };
      const upperCount = reply.replace(/[^A-Z]/g, "").length;
      const upperRatio = upperCount / letters.length;
      return upperRatio < 0.5
        ? { failed: false }
        : { failed: true, detail: `Reply appears to be shouting (${Math.round(upperRatio * 100)}% uppercase). AI should respond calmly. Reply: "${truncate(reply, 200)}"` };
    }
    case "positive_handling": {
      // AI should handle competitor mention positively — check for positive HDS language
      const positivePhrases = [
        "quality", "service", "range", "selection", "competitive", "value",
        "reliable", "trust", "experience", "support", "we offer", "we provide",
        "our boards", "our product", "happy to", "welcome", "glad to",
      ];
      const hasPositive = positivePhrases.some((p) => reply.toLowerCase().includes(p));
      return hasPositive
        ? { failed: false }
        : { failed: true, detail: `No positive HDS language detected when handling competitor mention. Reply: "${truncate(reply, 200)}"` };
    }
    case "context_awareness": {
      // AI should handle rapid topic switching — check it responded to multiple messages
      if (ctx.assistantReplies.length < 2) {
        return {
          failed: false,
          warning: `Only ${ctx.assistantReplies.length} assistant reply/ies for a multi-topic scenario — AI may not have addressed each topic change`,
        };
      }
      return { failed: false };
    }
    // --- Sales funnel behavior types ---
    case "funnel_stage": {
      return evaluateFunnelStage(behavior, ctx);
    }
    case "sales_outcome": {
      return evaluateSalesOutcome(behavior, ctx);
    }
    default:
      return { failed: false, warning: `Unknown behavior type '${behavior.type}' — skipped` };
  }
}

/**
 * Evaluate a single sales funnel stage.
 * Stages: greeting, discovery, quote, objection_handling, close, follow_up
 * Each stage checks different criteria based on conversation content and tool calls.
 */
function evaluateFunnelStage(behavior, ctx) {
  const stage = behavior.stage;
  const allText = ctx.allReplyText.toLowerCase();
  const replies = ctx.assistantReplies;
  const toolCalls = ctx.toolCalls;
  const toolResults = ctx.toolResults;

  switch (stage) {
    case "greeting": {
      // AI should acknowledge the customer and mention HDS or offer help
      const greetingPhrases = [
        "hi", "hello", "hey", "welcome", "thanks for reaching", "thank you for reaching",
        "good day", "good morning", "good afternoon", "how can i help", "what can i help",
        "hds", "assist", "help you",
      ];
      const hasGreeting = greetingPhrases.some((p) => allText.includes(p));
      if (hasGreeting) return { failed: false };
      return {
        failed: true,
        detail: `Greeting stage not reached — no greeting or HDS acknowledgment detected. Reply: "${truncate(ctx.lastReply, 200)}"`,
      };
    }
    case "discovery": {
      // AI should ask clarifying questions or confirm product specs
      const discoveryPhrases = [
        "what size", "what thickness", "how many", "which product", "what type",
        "what color", "what material", "can you confirm", "let me confirm",
        "you need", "are you looking", "would you like", "what do you need",
        "how many sheets", "what project", "tell me more", "could you",
        "what kind", "melamine", "mdf", "chipboard", "plywood", "gloss",
        "16mm", "18mm", "sheets",
      ];
      const hasDiscovery = discoveryPhrases.some((p) => allText.includes(p));
      if (hasDiscovery) return { failed: false };
      return {
        failed: true,
        detail: `Discovery stage not reached — AI did not ask clarifying questions or confirm product specs. Reply: "${truncate(ctx.lastReply, 200)}"`,
      };
    }
    case "quote": {
      // AI should generate a quote or provide pricing
      const hasQuoteTool = toolCalls.includes("generate_quote") || toolCalls.includes("lookup_price");
      const hasQuoteTotal = ctx.convLog.some((r) => r.quote_total != null && r.quote_total > 0);
      const hasQuoteId = ctx.convLog.some((r) => r.quote_id != null);
      const hasPrice = /r\s?\d+/i.test(allText);
      const hasUrl = /https?:\/\//i.test(allText);
      if (hasQuoteTool || hasQuoteTotal || hasQuoteId || (hasPrice && !hasUrl)) return { failed: false };
      return {
        failed: true,
        detail: `Quote stage not reached — no quote generated, no price provided. Tools called: [${toolCalls.join(", ")}]. Reply: "${truncate(ctx.lastReply, 200)}"`,
      };
    }
    case "objection_handling": {
      // AI should handle objections with empathy and value argument
      const hasObjectionFlag = toolResults.objection != null;
      const empathyPhrases = ["i understand", "i hear you", "i get it", "completely understand", "i know it can", "i appreciate"];
      const valuePhrases = ["bulk", "value", "quality", "worth", "investment", "compare", "per sheet", "longer lasting", "warranty", "guarantee", "competitive"];
      const hasEmpathy = empathyPhrases.some((p) => allText.includes(p));
      const hasValue = valuePhrases.some((p) => allText.includes(p));
      if (hasObjectionFlag || (hasEmpathy && hasValue)) return { failed: false };
      if (hasEmpathy || hasValue) {
        return {
          failed: false,
          warning: `Partial objection handling: has ${hasEmpathy ? "empathy" : ""} ${hasValue ? "value argument" : ""} but not both. Reply: "${truncate(ctx.lastReply, 150)}"`,
        };
      }
      return {
        failed: true,
        detail: `Objection handling stage not reached — no empathy or value argument detected. Reply: "${truncate(ctx.lastReply, 200)}"`,
      };
    }
    case "close": {
      // AI should attempt a sales close
      const hasCloseFlag = toolResults.close_attempt === true;
      const closingPhrases = [
        "shall i", "should i", "can i go ahead", "would you like", "shall we proceed",
        "ready to proceed", "go ahead and", "process this order", "confirm your order",
        "place the order", "shall i prepare", "want me to", "can i reserve",
        "would you like to pay", "how would you like to pay", "pay by", "get this order",
        "shall i send", "can i get your", "let's get this", "shall we move forward",
        "would you like me to", "shall i put this through",
      ];
      const hasClosingLang = closingPhrases.some((p) => allText.includes(p));
      if (hasCloseFlag || hasClosingLang) return { failed: false };
      return {
        failed: true,
        detail: `Close stage not reached — no close attempt detected. Reply: "${truncate(ctx.lastReply, 200)}"`,
      };
    }
    case "follow_up": {
      // AI should keep the door open or schedule follow-up
      const followUpPhrases = [
        "follow up", "get back to you", "reach out", "contact you", "let me know",
        "when you're ready", "anytime", "feel free", "don't hesitate", "in touch",
        "remind", "hold the price", "hold this quote", "hold this pricing", "hold our",
        "valid for", "expires", "save your quote", "when you decide", "here to help",
        "lock in", "lock this", "whenever you're ready", "check back", "i'm here",
        "i am here", "here whenever", "ready to move forward",
      ];
      const hasFollowUp = followUpPhrases.some((p) => allText.includes(p));
      const hasHandover = toolCalls.includes("handover") || ctx.profile?.lead_status === "handover";
      if (hasFollowUp || hasHandover) return { failed: false };
      return {
        failed: true,
        detail: `Follow-up stage not reached — no follow-up language or handover detected. Reply: "${truncate(ctx.lastReply, 200)}"`,
      };
    }
    default:
      return { failed: false, warning: `Unknown funnel stage '${stage}' — skipped` };
  }
}

/**
 * Evaluate the overall sales outcome for a scenario.
 * Expected outcomes: converted, follow_up, lost, handover
 */
function evaluateSalesOutcome(behavior, ctx) {
  const expected = behavior.expected_outcome;
  const toolResults = ctx.toolResults;
  const toolCalls = ctx.toolCalls;
  const allText = ctx.allReplyText.toLowerCase();

  // Determine actual outcome
  const hasCloseAttempt = toolResults.close_attempt === true ||
    ["shall i", "would you like", "can i go ahead", "place the order", "process this order"].some((p) => allText.includes(p));
  const hasFollowUp = ["follow up", "get back to you", "reach out", "when you're ready", "feel free", "in touch", "hold this pricing", "hold the price", "lock in", "i'm here", "i am here"].some((p) => allText.includes(p));
  const hasHandover = toolCalls.includes("handover") || ctx.profile?.lead_status === "handover";
  const hasQuote = ctx.convLog.some((r) => r.quote_total != null && r.quote_total > 0) || toolCalls.includes("generate_quote");

  let actualOutcome;
  if (hasHandover) {
    actualOutcome = "handover";
  } else if (hasCloseAttempt && hasQuote) {
    actualOutcome = "converted";
  } else if (hasFollowUp) {
    actualOutcome = "follow_up";
  } else {
    actualOutcome = "lost";
  }

  if (actualOutcome === expected) return { failed: false };
  // For "converted" expected, "follow_up" is a partial success
  if (expected === "converted" && actualOutcome === "follow_up") {
    return {
      failed: false,
      warning: `Expected 'converted' but got 'follow_up' — AI kept the door open but didn't close. Reply: "${truncate(ctx.lastReply, 150)}"`,
    };
  }
  return {
    failed: true,
    detail: `Sales outcome mismatch: expected '${expected}', got '${actualOutcome}'. Reply: "${truncate(ctx.lastReply, 200)}"`,
  };
}

function truncate(str, max) {
  if (!str) return "";
  return str.length > max ? str.slice(0, max) + "…" : str;
}

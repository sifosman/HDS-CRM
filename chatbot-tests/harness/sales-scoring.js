// sales-scoring.js — sales funnel scoring engine for the sales simulation scenarios.
// Scores each scenario across 6 funnel stages and computes a weighted 0-100 score
// adjusted by difficulty (easy/medium/hard).

/**
 * Score a scenario across all sales funnel stages.
 * @param {object} scenario - the scenario JSON (must have difficulty and expected_behaviors)
 * @param {array} convLog - all conversation rows from Supabase
 * @param {object|null} profile - customer_profiles row
 * @param {number} lastReplyLatencyMs - latency of the last assistant reply in ms
 * @param {object} scoreResult - the result from scoreScenario (failures, warnings, tool_calls, etc.)
 * @returns {object} { stages: {stage: {passed, detail}}, score: 0-100, outcome, summary }
 */
export function scoreSalesFunnel(scenario, convLog, profile, lastReplyLatencyMs, scoreResult) {
  const difficulty = scenario.difficulty || "medium";
  const allText = (convLog.filter((r) => r.role === "assistant").map((r) => r.message_text || "").join("\n")).toLowerCase();
  const toolCalls = scoreResult.tool_calls || [];
  const toolResults = {};
  for (const row of convLog) {
    if (row.role === "assistant" && row.tool_results && typeof row.tool_results === "object") {
      Object.assign(toolResults, row.tool_results);
    }
  }

  // Evaluate each funnel stage
  const stages = {
    greeting: evaluateStageGreeting(allText),
    discovery: evaluateStageDiscovery(allText),
    quote: evaluateStageQuote(allText, toolCalls, convLog),
    objection_handling: evaluateStageObjection(allText, toolResults),
    close: evaluateStageClose(allText, toolResults),
    follow_up: evaluateStageFollowUp(allText, toolCalls, profile),
  };

  // Determine overall sales outcome
  const outcome = determineSalesOutcome(stages, toolCalls, convLog, profile);

  // Compute weighted score based on difficulty
  const score = computeWeightedScore(stages, difficulty, lastReplyLatencyMs, scoreResult);

  // Build summary
  const stageSummary = {};
  for (const [stage, result] of Object.entries(stages)) {
    stageSummary[stage] = result.passed;
  }

  return {
    stages,
    stage_summary: stageSummary,
    score,
    outcome,
    difficulty,
    persona_type: scenario.persona_type || "unknown",
    summary: buildSummary(stages, outcome, score, difficulty),
  };
}

// ---------------------------------------------------------------------------
// Stage evaluators
// ---------------------------------------------------------------------------

function evaluateStageGreeting(allText) {
  const phrases = ["hi", "hello", "hey", "welcome", "thanks for reaching", "thank you for reaching",
    "good day", "good morning", "good afternoon", "how can i help", "what can i help", "hds", "assist"];
  const passed = phrases.some((p) => allText.includes(p));
  return { passed, detail: passed ? "Greeting detected" : "No greeting or HDS acknowledgment detected" };
}

function evaluateStageDiscovery(allText) {
  const phrases = ["what size", "what thickness", "how many", "which product", "what type", "what color",
    "what material", "can you confirm", "let me confirm", "you need", "are you looking", "would you like",
    "what do you need", "how many sheets", "what project", "tell me more", "could you", "what kind",
    "melamine", "mdf", "chipboard", "plywood", "gloss", "16mm", "18mm", "sheets"];
  const passed = phrases.some((p) => allText.includes(p));
  return { passed, detail: passed ? "Discovery/clarification detected" : "No discovery or clarifying questions detected" };
}

function evaluateStageQuote(allText, toolCalls, convLog) {
  const hasQuoteTool = toolCalls.includes("generate_quote") || toolCalls.includes("lookup_price");
  const hasQuoteTotal = convLog.some((r) => r.quote_total != null && r.quote_total > 0);
  const hasQuoteId = convLog.some((r) => r.quote_id != null);
  const hasPrice = /r\s?\d+/i.test(allText);
  const hasUrl = /https?:\/\//i.test(allText);
  const passed = hasQuoteTool || hasQuoteTotal || hasQuoteId || (hasPrice && !hasUrl);
  return { passed, detail: passed ? "Quote or pricing provided" : "No quote generated or price provided" };
}

function evaluateStageObjection(allText, toolResults) {
  const hasObjectionFlag = toolResults.objection != null;
  const empathyPhrases = ["i understand", "i hear you", "i get it", "completely understand", "i know it can", "i appreciate"];
  const valuePhrases = ["bulk", "value", "quality", "worth", "investment", "compare", "per sheet", "longer lasting", "warranty", "guarantee", "competitive"];
  const hasEmpathy = empathyPhrases.some((p) => allText.includes(p));
  const hasValue = valuePhrases.some((p) => allText.includes(p));
  const passed = hasObjectionFlag || (hasEmpathy && hasValue);
  return { passed, detail: passed ? "Objection handled with empathy and value" : "No objection handling detected" };
}

function evaluateStageClose(allText, toolResults) {
  const hasCloseFlag = toolResults.close_attempt === true;
  const phrases = ["shall i", "should i", "can i go ahead", "would you like", "shall we proceed",
    "ready to proceed", "go ahead and", "process this order", "confirm your order", "place the order",
    "shall i prepare", "want me to", "can i reserve", "would you like to pay", "how would you like to pay",
    "pay by", "get this order", "shall i send", "can i get your", "let's get this", "shall we move forward",
    "would you like me to", "shall i put this through"];
  const hasClosingLang = phrases.some((p) => allText.includes(p));
  const passed = hasCloseFlag || hasClosingLang;
  return { passed, detail: passed ? "Close attempt detected" : "No close attempt detected" };
}

function evaluateStageFollowUp(allText, toolCalls, profile) {
  const phrases = ["follow up", "get back to you", "reach out", "contact you", "let me know",
    "when you're ready", "anytime", "feel free", "don't hesitate", "in touch", "remind",
    "hold the price", "hold this quote", "valid for", "expires", "save your quote",
    "when you decide", "here to help"];
  const hasFollowUp = phrases.some((p) => allText.includes(p));
  const hasHandover = toolCalls.includes("handover") || profile?.lead_status === "handover";
  const passed = hasFollowUp || hasHandover;
  return { passed, detail: passed ? "Follow-up or handover detected" : "No follow-up language detected" };
}

// ---------------------------------------------------------------------------
// Outcome determination
// ---------------------------------------------------------------------------

function determineSalesOutcome(stages, toolCalls, convLog, profile) {
  const hasHandover = toolCalls.includes("handover") || profile?.lead_status === "handover";
  if (hasHandover) return "handover";
  if (stages.close.passed && stages.quote.passed) return "converted";
  if (stages.follow_up.passed) return "follow_up";
  return "lost";
}

// ---------------------------------------------------------------------------
// Weighted score computation
// ---------------------------------------------------------------------------

function computeWeightedScore(stages, difficulty, latencyMs, scoreResult) {
  // Base weights for each stage (sum to 100)
  const weights = {
    easy: { greeting: 10, discovery: 10, quote: 25, objection_handling: 5, close: 35, follow_up: 5, quality: 10 },
    medium: { greeting: 8, discovery: 12, quote: 25, objection_handling: 20, close: 20, follow_up: 5, quality: 10 },
    hard: { greeting: 8, discovery: 10, quote: 15, objection_handling: 30, close: 10, follow_up: 17, quality: 10 },
  };
  const w = weights[difficulty] || weights.medium;

  let score = 0;
  if (stages.greeting.passed) score += w.greeting;
  if (stages.discovery.passed) score += w.discovery;
  if (stages.quote.passed) score += w.quote;
  if (stages.objection_handling.passed) score += w.objection_handling;
  if (stages.close.passed) score += w.close;
  if (stages.follow_up.passed) score += w.follow_up;

  // Quality score: penalize for failures and forbidden patterns
  const failureCount = (scoreResult.failures || []).length;
  const qualityScore = Math.max(0, w.quality - failureCount * 3);
  score += qualityScore;

  // Latency bonus/penalty (up to ±5 points)
  if (latencyMs != null) {
    if (latencyMs <= 15000) score += 3;
    else if (latencyMs <= 30000) score += 1;
    else if (latencyMs > 60000) score -= 5;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ---------------------------------------------------------------------------
// Summary builder
// ---------------------------------------------------------------------------

function buildSummary(stages, outcome, score, difficulty) {
  const passedStages = Object.entries(stages).filter(([, v]) => v.passed).map(([k]) => k);
  const failedStages = Object.entries(stages).filter(([, v]) => !v.passed).map(([k]) => k);
  return `Score ${score}/100 (${difficulty}) — Outcome: ${outcome}. Stages passed: ${passedStages.join(", ") || "none"}. Stages missed: ${failedStages.join(", ") || "none"}.`;
}

/**
 * Build aggregate statistics across all sales simulation results.
 * @param {array} salesResults - array of scoreSalesFunnel results
 * @returns {object} aggregate stats
 */
export function buildSalesAggregate(salesResults) {
  const total = salesResults.length;
  if (total === 0) return { total: 0 };

  const byDifficulty = { easy: { count: 0, scores: [], outcomes: {} }, medium: { count: 0, scores: [], outcomes: {} }, hard: { count: 0, scores: [], outcomes: {} } };
  const stageCounts = { greeting: { passed: 0, total: 0 }, discovery: { passed: 0, total: 0 }, quote: { passed: 0, total: 0 }, objection_handling: { passed: 0, total: 0 }, close: { passed: 0, total: 0 }, follow_up: { passed: 0, total: 0 } };
  const outcomeCounts = { converted: 0, follow_up: 0, lost: 0, handover: 0 };
  const byPersonaType = {};
  const allScores = [];

  for (const r of salesResults) {
    const d = r.difficulty || "medium";
    if (!byDifficulty[d]) continue;
    byDifficulty[d].count++;
    byDifficulty[d].scores.push(r.score);
    byDifficulty[d].outcomes[r.outcome] = (byDifficulty[d].outcomes[r.outcome] || 0) + 1;

    for (const [stage, result] of Object.entries(r.stages)) {
      if (!stageCounts[stage]) continue;
      stageCounts[stage].total++;
      if (result.passed) stageCounts[stage].passed++;
    }

    outcomeCounts[r.outcome] = (outcomeCounts[r.outcome] || 0) + 1;
    allScores.push(r.score);

    const pt = r.persona_type || "unknown";
    if (!byPersonaType[pt]) byPersonaType[pt] = { count: 0, scores: [], outcomes: {} };
    byPersonaType[pt].count++;
    byPersonaType[pt].scores.push(r.score);
    byPersonaType[pt].outcomes[r.outcome] = (byPersonaType[pt].outcomes[r.outcome] || 0) + 1;
  }

  // Compute averages
  const avgScore = allScores.length ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;
  for (const d of Object.keys(byDifficulty)) {
    const scores = byDifficulty[d].scores;
    byDifficulty[d].avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  }
  for (const pt of Object.keys(byPersonaType)) {
    const scores = byPersonaType[pt].scores;
    byPersonaType[pt].avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  }

  // Funnel conversion rates
  const funnelRates = {};
  for (const [stage, counts] of Object.entries(stageCounts)) {
    funnelRates[stage] = counts.total > 0 ? Math.round((counts.passed / counts.total) * 100) : 0;
  }

  return {
    total,
    avgScore,
    byDifficulty,
    stageCounts,
    funnelRates,
    outcomeCounts,
    conversionRate: total > 0 ? Math.round(((outcomeCounts.converted || 0) / total) * 100) : 0,
    byPersonaType,
  };
}

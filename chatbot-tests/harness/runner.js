// runner.js — main entry point for the HDS chatbot test harness.
//
// Usage:
//   node runner.js                      Run all scenarios
//   node runner.js --smoke              Run smoke subset (10-15 scenarios)
//   node runner.js --category price_lookup   Run one category
//   node runner.js --scenario PL-001    Run a single scenario by ID
//   node runner.js --lint-scenarios     Validate all scenario JSON files (no webhook calls)
//   node runner.js --dry-run            Load scenarios, print plan, send nothing
//   node runner.js --cleanup            Delete test data from Supabase (2790000% range)
//   node runner.js --concurrency 10     Override concurrency
//   node runner.js --no-safe-mode       Disable safe-mode warning
//   node runner.js --sales-sim          Run sales simulation scenarios (100 customer personas)

import { readFile, readdir, stat, mkdir } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HARNESS_DIR = __dirname;
const CHATBOT_TESTS_DIR = resolve(HARNESS_DIR, "..");

import { buildTextPayload, buildImagePayload, resetMessageSeq } from "./payload.js";
import {
  pollForAssistantReplies,
  fetchConversationLog,
  fetchCustomerProfile,
  cleanupTestData,
} from "./supabase.js";
import { scoreScenario } from "./assertions.js";
import { generateReport } from "./report.js";
import { generateSalesReport } from "./sales-report.js";
import { scoreSalesFunnel } from "./sales-scoring.js";
import { writeRunToSupabase } from "./db.js";

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = {
    smoke: false,
    category: null,
    scenario: null,
    scenarios: null,
    lintScenarios: false,
    dryRun: false,
    cleanup: false,
    concurrency: null,
    noSafeMode: false,
    salesSim: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--smoke") args.smoke = true;
    else if (a === "--category") args.category = argv[++i];
    else if (a === "--scenario") args.scenario = argv[++i];
    else if (a === "--scenarios") args.scenarios = argv[++i].split(',').map(s => s.trim());
    else if (a === "--lint-scenarios") args.lintScenarios = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--cleanup") args.cleanup = true;
    else if (a === "--concurrency") args.concurrency = parseInt(argv[++i], 10);
    else if (a === "--no-safe-mode") args.noSafeMode = true;
    else if (a === "--sales-sim") args.salesSim = true;
  }
  return args;
}

// ---------------------------------------------------------------------------
// Scenario loading
// ---------------------------------------------------------------------------
async function loadAllScenarios(scenariosDir) {
  const categories = await readdir(scenariosDir);
  const scenarios = [];
  for (const cat of categories) {
    const catPath = join(scenariosDir, cat);
    const s = await stat(catPath);
    if (!s.isDirectory()) continue;
    const files = await readdir(catPath);
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const raw = await readFile(join(catPath, f), "utf-8");
      try {
        const scenario = JSON.parse(raw);
        scenario._file = join(cat, f);
        scenarios.push(scenario);
      } catch (e) {
        scenarios.push({
          _file: join(cat, f),
          _parseError: e.message,
          id: f.replace(".json", ""),
          category: cat,
        });
      }
    }
  }
  return scenarios;
}

// ---------------------------------------------------------------------------
// Scenario validation (lint)
// ---------------------------------------------------------------------------
function validateScenario(scenario) {
  const errors = [];
  if (scenario._parseError) {
    errors.push(`JSON parse error: ${scenario._parseError}`);
    return errors;
  }
  const required = ["id", "name", "category", "messages", "expected_tools", "expected_behaviors", "forbidden_patterns"];
  for (const field of required) {
    if (!(field in scenario)) errors.push(`Missing required field: ${field}`);
  }
  if (scenario.messages) {
    if (!Array.isArray(scenario.messages) || scenario.messages.length === 0) {
      errors.push("messages must be a non-empty array");
    } else {
      scenario.messages.forEach((m, i) => {
        const isImage = m.type === "image" || m.media_id;
        if (!isImage && !m.text) errors.push(`messages[${i}].text is required`);
        if (isImage && !m.media_id) errors.push(`messages[${i}].media_id is required for image messages`);
        if (typeof m.delay_ms !== "number") errors.push(`messages[${i}].delay_ms must be a number`);
      });
    }
  }
  if (scenario.expected_tools && !Array.isArray(scenario.expected_tools)) {
    errors.push("expected_tools must be an array");
  }
  if (scenario.expected_behaviors && !Array.isArray(scenario.expected_behaviors)) {
    errors.push("expected_behaviors must be an array");
  }
  if (scenario.forbidden_patterns && !Array.isArray(scenario.forbidden_patterns)) {
    errors.push("forbidden_patterns must be an array");
  }
  if (scenario.phone_number) {
    if (!/^2790000\d{4}$/.test(scenario.phone_number)) {
      errors.push(`phone_number '${scenario.phone_number}' is not in test range 27900000001–27900000999`);
    }
  }
  // Validate behavior types
  const validBehaviorTypes = [
    "contains_keyword", "contains_any_keyword", "not_contains_keyword", "regex_match", "response_time",
    "tool_called", "tool_not_called", "close_attempt", "objection_handled",
    "handover_triggered", "min_messages", "lead_status",
    // Adversarial/edge behavior types
    "clarification_request", "redirect_to_business", "price_consistency",
    "refusal_to_comply", "calm_tone", "positive_handling", "context_awareness",
    "quote_generated",
    // Sales funnel behavior types
    "funnel_stage", "sales_outcome",
  ];
  for (const b of scenario.expected_behaviors || []) {
    if (!validBehaviorTypes.includes(b.type)) {
      errors.push(`Unknown behavior type '${b.type}' in ${scenario.id}`);
    }
  }
  // Validate regex patterns compile
  for (const p of scenario.forbidden_patterns || []) {
    try {
      new RegExp(p.pattern, p.flags || "");
    } catch (e) {
      errors.push(`Invalid regex in forbidden_patterns: /${p.pattern}/${p.flags || ""} — ${e.message}`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Scenario execution
// ---------------------------------------------------------------------------
async function executeScenario(scenario, config, opts) {
  if (scenario._parseError) {
    return {
      scenario_id: scenario.id,
      name: "(unparseable)",
      category: scenario.category,
      passed: false,
      skipped: false,
      failures: [{ type: "parse_error", detail: scenario._parseError }],
      warnings: [],
      latency_ms: null,
      tool_calls: [],
      last_reply: "",
    };
  }

  const webhookCfg = config.webhook;
  const supabaseCfg = config.supabase;
  const runnerCfg = config.runner;
  const phoneNumber = scenario.phone_number;
  const senderName = scenario.sender_name || "Test Customer";

  const scenarioStart = Date.now();
  const results = [];

  for (const [msgIdx, msg] of scenario.messages.entries()) {
    if (msg.delay_ms > 0) await sleep(msg.delay_ms);

    const sendTime = Date.now();
    let payload;
    const isImage = msg.type === "image" || msg.media_id;
    if (isImage) {
      payload = buildImagePayload({
        phoneNumber,
        senderName,
        caption: msg.caption || "",
        mediaId: msg.media_id || "test-media-001",
        wabaId: webhookCfg.waba_id,
        displayPhoneNumber: webhookCfg.display_phone_number,
        phoneNumberId: webhookCfg.phone_number_id,
      });
    } else {
      payload = buildTextPayload({
        phoneNumber,
        senderName,
        messageText: msg.text,
        wabaId: webhookCfg.waba_id,
        displayPhoneNumber: webhookCfg.display_phone_number,
        phoneNumberId: webhookCfg.phone_number_id,
      });
    }

    if (opts.dryRun) {
      const preview = isImage ? `[image: ${msg.media_id}] ${msg.caption || ""}` : msg.text.slice(0, 60);
      console.log(`  [dry-run] ${scenario.id} msg ${msgIdx + 1}/${scenario.messages.length} → ${phoneNumber}: "${preview}"`);
      continue;
    }

    // POST to n8n webhook
    try {
      const res = await fetch(webhookCfg.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(webhookCfg.timeout_ms || 30000),
      });
      // n8n webhook may return 200 immediately (async processing). We don't need the body.
      if (!res.ok && res.status !== 302) {
        results.push({
          msgIdx,
          error: `Webhook POST returned ${res.status}`,
          sendTime,
        });
        continue;
      }
    } catch (err) {
      results.push({ msgIdx, error: `Webhook POST failed: ${err.message}`, sendTime });
      continue;
    }

    // Poll for assistant reply for this message
    const pollTimeout = runnerCfg.poll_timeout_ms || 60000;
    const { rows, elapsed_ms } = await pollForAssistantReplies(
      supabaseCfg,
      phoneNumber,
      sendTime,
      runnerCfg.poll_interval_ms || 2000,
      pollTimeout,
    );
    results.push({ msgIdx, sendTime, replyRows: rows, latency_ms: elapsed_ms });
  }

  if (opts.dryRun) {
    return {
      scenario_id: scenario.id,
      name: scenario.name,
      category: scenario.category,
      passed: true,
      skipped: true,
      failures: [],
      warnings: [],
      latency_ms: null,
      tool_calls: [],
      last_reply: "(dry-run — no webhook calls)",
    };
  }

  // Fetch full conversation log for scoring
  let convLog = [];
  let profile = null;
  let lastReplyLatency = null;
  try {
    convLog = await fetchConversationLog(supabaseCfg, phoneNumber, scenarioStart);
    profile = await fetchCustomerProfile(supabaseCfg, phoneNumber);
    // Latency of last assistant reply = time from scenario start to last assistant row
    const assistantRows = convLog.filter((r) => r.role === "assistant");
    if (assistantRows.length > 0) {
      const lastAssistantTime = new Date(assistantRows[assistantRows.length - 1].created_at).getTime();
      lastReplyLatency = lastAssistantTime - scenarioStart;
    } else {
      // Use the last poll latency as fallback
      const lastResult = results[results.length - 1];
      lastReplyLatency = lastResult?.latency_ms ?? null;
    }
  } catch (err) {
    return {
      scenario_id: scenario.id,
      name: scenario.name,
      category: scenario.category,
      passed: false,
      skipped: false,
      failures: [{ type: "supabase_error", detail: `Failed to fetch conversation log: ${err.message}` }],
      warnings: [],
      latency_ms: lastReplyLatency,
      tool_calls: [],
      last_reply: "",
    };
  }

  const score = scoreScenario(scenario, convLog, profile, lastReplyLatency);
  const result = {
    scenario_id: scenario.id,
    name: scenario.name,
    category: scenario.category,
    passed: score.passed,
    skipped: false,
    failures: score.failures,
    warnings: score.warnings,
    latency_ms: lastReplyLatency,
    tool_calls: score.tool_calls,
    assistant_reply_count: score.assistant_reply_count,
    last_reply: score.last_reply,
  };

  // If this is a sales simulation scenario, also compute sales funnel scoring
  if (scenario.category === "sales_simulation") {
    const salesScore = scoreSalesFunnel(scenario, convLog, profile, lastReplyLatency, score);
    result.sales_score = salesScore.score;
    result.sales_outcome = salesScore.outcome;
    result.sales_difficulty = salesScore.difficulty;
    result.sales_persona_type = salesScore.persona_type;
    result.sales_stage_summary = salesScore.stage_summary;
    result.sales_summary = salesScore.summary;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Concurrency-limited runner
// ---------------------------------------------------------------------------
async function runWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function runNext() {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  }
  const workers = [];
  for (let i = 0; i < Math.min(concurrency, items.length); i++) {
    workers.push(runNext());
  }
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = JSON.parse(readFileSync(join(HARNESS_DIR, "config.json"), "utf-8"));

  const scenariosDir = resolve(HARNESS_DIR, config.paths.scenarios_dir);
  const resultsDir = resolve(HARNESS_DIR, config.paths.results_dir);

  // --- Cleanup mode ---
  if (args.cleanup) {
    console.log("Cleaning up test data (phone_number LIKE '2790000%')...");
    const results = await cleanupTestData(config.supabase);
    console.log("Cleanup results:", JSON.stringify(results, null, 2));
    return;
  }

  // --- Load scenarios ---
  const allScenarios = await loadAllScenarios(scenariosDir);
  console.log(`Loaded ${allScenarios.length} scenarios from ${scenariosDir}`);

  // --- Lint mode ---
  if (args.lintScenarios) {
    let errorCount = 0;
    for (const s of allScenarios) {
      const errors = validateScenario(s);
      if (errors.length > 0) {
        errorCount += errors.length;
        console.log(`✗ ${s.id || s._file}:`);
        for (const e of errors) console.log(`    ${e}`);
      } else {
        console.log(`✓ ${s.id}`);
      }
    }
    console.log(`\n${allScenarios.length} scenarios, ${errorCount} errors`);
    process.exit(errorCount > 0 ? 1 : 0);
  }

  // --- Filter scenarios ---
  let scenarios = allScenarios.filter((s) => !s._parseError);
  if (args.salesSim) {
    scenarios = scenarios.filter((s) => s.category === "sales_simulation");
    if (scenarios.length === 0) {
      console.error(`No sales simulation scenarios found.`);
      process.exit(1);
    }
    console.log(`Sales simulation mode: ${scenarios.length} customer personas`);
  } else if (args.scenario) {
    scenarios = scenarios.filter((s) => s.id === args.scenario);
    if (scenarios.length === 0) {
      console.error(`Scenario '${args.scenario}' not found.`);
      process.exit(1);
    }
  } else if (args.scenarios) {
    scenarios = scenarios.filter((s) => args.scenarios.includes(s.id));
    if (scenarios.length === 0) {
      console.error(`No matching scenarios found in: ${args.scenarios.join(', ')}`);
      process.exit(1);
    }
    console.log(`Mixed mode: running ${scenarios.length} scenarios`);
  } else if (args.category) {
    scenarios = scenarios.filter((s) => s.category === args.category);
    if (scenarios.length === 0) {
      console.error(`No scenarios in category '${args.category}'.`);
      process.exit(1);
    }
  } else if (args.smoke) {
    const smokeIds = config.smoke?.scenario_ids || [];
    scenarios = scenarios.filter((s) => smokeIds.includes(s.id));
    console.log(`Smoke mode: running ${scenarios.length} scenarios`);
  }

  // Also include parse-error scenarios so they show up as failures
  if (!args.scenario && !args.category) {
    const broken = allScenarios.filter((s) => s._parseError);
    scenarios = [...broken, ...scenarios];
  }

  // --- Dry run ---
  if (args.dryRun) {
    console.log(`\nDRY RUN — ${scenarios.length} scenarios would be executed:`);
    const exec = await runWithConcurrency(scenarios, 1, (s) => executeScenario(s, config, { dryRun: true }));
    for (const r of exec) {
      console.log(`  ${r.scenario_id} [${r.category}] ${r.name} — ${r.passed ? "would run" : "parse error"}`);
    }
    return;
  }

  // --- Safe mode warning ---
  if (config.safe_mode?.enabled && !args.noSafeMode) {
    console.log("\n⚠  SAFE MODE ON: Test numbers (2790000xxxx) use invalid SA area code 279.");
    console.log("   Meta will reject outbound sends — real WhatsApp users won't receive test messages.");
    if (config.safe_mode.warn_on_send) {
      console.log("   For full isolation, point config.webhook.url at a cloned n8n workflow with 'Send WhatsApp Reply' disabled.");
    }
    console.log("");
  }

  // --- Execute ---
  const concurrency = args.concurrency || config.runner.concurrency || 5;
  const runType = args.salesSim ? "sales_simulation" : args.smoke ? "smoke" : args.category ? "category" : args.scenario ? "scenario" : "full";
  console.log(`Running ${scenarios.length} scenarios with concurrency ${concurrency}...\n`);

  // Build phone-number map for Supabase logging
  const phoneMap = {};
  for (const s of scenarios) {
    if (s.phone_number) phoneMap[s.id] = s.phone_number;
  }

  resetMessageSeq();
  const startedAt = new Date().toISOString();
  const results = await runWithConcurrency(scenarios, concurrency, async (s) => {
    const result = await executeScenario(s, config, {});
    const status = result.skipped ? "SKIP" : result.passed ? "PASS" : "FAIL";
    const latency = result.latency_ms != null ? ` ${result.latency_ms}ms` : "";
    console.log(`  [${status}] ${result.scenario_id} [${result.category}] ${result.name}${latency}`);
    if (!result.passed && !result.skipped) {
      for (const f of result.failures) console.log(`         ✗ ${f.detail}`);
    }
    return result;
  });

  const finishedAt = new Date().toISOString();

  // --- Generate report ---
  const isSalesSim = args.salesSim || (results.length > 0 && results[0]?.sales_score != null && results.every((r) => r.sales_score != null || r.skipped));
  const runResult = {
    started_at: startedAt,
    finished_at: finishedAt,
    config_snapshot: {
      webhook_url: config.webhook.url,
      concurrency,
      safe_mode: config.safe_mode?.enabled,
    },
    results,
  };

  let jsonPath, htmlPath, summary;
  if (isSalesSim) {
    // Collect sales results from the scenario results
    runResult.salesResults = results
      .filter((r) => r.sales_score != null)
      .map((r) => ({
        scenario_id: r.scenario_id,
        score: r.sales_score,
        outcome: r.sales_outcome,
        difficulty: r.sales_difficulty,
        persona_type: r.sales_persona_type,
        stages: Object.fromEntries(
          Object.entries(r.sales_stage_summary || {}).map(([stage, passed]) => [
            stage,
            { passed, detail: passed ? "Stage reached" : "Stage not reached" },
          ])
        ),
        summary: r.sales_summary,
      }));
    const salesReportResult = await generateSalesReport(runResult, resultsDir);
    jsonPath = salesReportResult.jsonPath;
    htmlPath = salesReportResult.htmlPath;
    // Build a basic summary for Supabase logging
    const passed = results.filter((r) => r.passed).length;
    const total = results.length;
    summary = {
      total,
      passed,
      failed: total - passed,
      skipped: results.filter((r) => r.skipped).length,
      pass_rate: total ? `${((passed / total) * 100).toFixed(1)}%` : "0%",
      by_category: { sales_simulation: { total, passed, failed: total - passed } },
      latency_ms: { p50: null, p95: null, avg: null },
    };
  } else {
    const reportResult = await generateReport(runResult, resultsDir);
    jsonPath = reportResult.jsonPath;
    htmlPath = reportResult.htmlPath;
    summary = reportResult.summary;
  }

  // --- Write results to Supabase (Phase 2: AI Performance Reporting) ---
  const runId = `run-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  try {
    const dbResult = await writeRunToSupabase(config.supabase, runResult, summary, runId, {
      run_type: runType,
      concurrency,
      phoneNumbersByScenario: phoneMap,
    });
    console.log(`  [db] Wrote ${dbResult.rowsWritten} scenario rows to ai_test_runs (summary: ${dbResult.summaryWritten ? "ok" : "failed"})`);
  } catch (err) {
    console.error(`  [db] Failed to write to Supabase: ${err.message}`);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Results: ${summary.passed}/${summary.total} passed (${summary.pass_rate})`);
  console.log(`Latency: p50=${summary.latency_ms.p50 ?? "—"}ms p95=${summary.latency_ms.p95 ?? "—"}ms avg=${summary.latency_ms.avg ?? "—"}ms`);
  for (const [cat, c] of Object.entries(summary.by_category)) {
    console.log(`  ${cat}: ${c.passed}/${c.total}`);
  }
  if (isSalesSim && runResult.salesResults) {
    const salesAgg = runResult.salesResults;
    const converted = salesAgg.filter((r) => r.outcome === "converted").length;
    const followUp = salesAgg.filter((r) => r.outcome === "follow_up").length;
    const lost = salesAgg.filter((r) => r.outcome === "lost").length;
    const handover = salesAgg.filter((r) => r.outcome === "handover").length;
    const avgScore = salesAgg.length > 0 ? Math.round(salesAgg.reduce((a, b) => a + b.score, 0) / salesAgg.length) : 0;
    const conversionRate = salesAgg.length > 0 ? Math.round((converted / salesAgg.length) * 100) : 0;
    console.log(`\n--- Sales Simulation Summary ---`);
    console.log(`  Conversion rate: ${converted}/${salesAgg.length} (${conversionRate}%)`);
    console.log(`  Outcomes: ${converted} converted, ${followUp} follow-up, ${lost} lost, ${handover} handover`);
    console.log(`  Average sales score: ${avgScore}/100`);
    // Difficulty breakdown
    for (const diff of ["easy", "medium", "hard"]) {
      const diffResults = salesAgg.filter((r) => r.difficulty === diff);
      if (diffResults.length > 0) {
        const diffAvg = Math.round(diffResults.reduce((a, b) => a + b.score, 0) / diffResults.length);
        const diffConverted = diffResults.filter((r) => r.outcome === "converted").length;
        console.log(`  ${diff}: ${diffResults.length} customers, avg score ${diffAvg}/100, ${diffConverted} converted`);
      }
    }
  }
  console.log(`\nJSON report: ${jsonPath}`);
  console.log(`HTML report: ${htmlPath}`);
  console.log(`${"=".repeat(60)}`);

  process.exit(summary.failed > 0 ? 1 : 0);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

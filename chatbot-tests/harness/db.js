// db.js — writes test run results to Supabase (ai_test_runs + ai_test_run_summaries).
// Uses the anon key (POST allowed by "Allow all" RLS policies).
// No external dependency; uses Node 18+ global fetch.

/**
 * Insert a single scenario result row into ai_test_runs.
 * @param {object} cfg - supabase config { url, anon_key }
 * @param {object} row - { run_id, scenario_id, scenario_name, category, passed, ... }
 * @returns {Promise<boolean>} success
 */
export async function insertTestRunRow(cfg, row) {
  const url = `${cfg.url}/rest/v1/ai_test_runs`;
  const body = {
    run_id: row.run_id,
    scenario_id: row.scenario_id,
    scenario_name: row.name || null,
    category: row.category,
    passed: row.passed,
    skipped: row.skipped || false,
    latency_ms: row.latency_ms ?? null,
    tool_calls: row.tool_calls || [],
    assistant_reply_count: row.assistant_reply_count || 0,
    failure_reason: row.failures && row.failures.length > 0 ? row.failures[0].detail : null,
    failures: row.failures || [],
    warnings: row.warnings || [],
    last_reply: row.last_reply ? String(row.last_reply).slice(0, 5000) : null,
    phone_number: row.phone_number || null,
    run_type: row.run_type || "full",
    concurrency: row.concurrency ?? null,
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        apikey: cfg.anon_key,
        Authorization: `Bearer ${cfg.anon_key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`  [db] Failed to insert ai_test_runs row for ${row.scenario_id}: ${res.status} ${text}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`  [db] Error inserting ai_test_runs row for ${row.scenario_id}: ${err.message}`);
    return false;
  }
}

/**
 * Insert a run summary row into ai_test_run_summaries.
 * @param {object} cfg - supabase config { url, anon_key }
 * @param {object} summary - { run_id, run_type, concurrency, total, passed, failed, ... }
 * @returns {Promise<boolean>} success
 */
export async function insertTestRunSummary(cfg, summary) {
  const url = `${cfg.url}/rest/v1/ai_test_run_summaries`;
  const body = {
    run_id: summary.run_id,
    run_type: summary.run_type || "full",
    concurrency: summary.concurrency ?? null,
    total: summary.total,
    passed: summary.passed,
    failed: summary.failed,
    skipped: summary.skipped || 0,
    pass_rate: summary.pass_rate_num || 0,
    latency_p50_ms: summary.latency_p50_ms ?? null,
    latency_p95_ms: summary.latency_p95_ms ?? null,
    latency_avg_ms: summary.latency_avg_ms ?? null,
    by_category: summary.by_category || {},
    started_at: summary.started_at || null,
    finished_at: summary.finished_at || null,
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        apikey: cfg.anon_key,
        Authorization: `Bearer ${cfg.anon_key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`  [db] Failed to insert ai_test_run_summaries: ${res.status} ${text}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`  [db] Error inserting ai_test_run_summaries: ${err.message}`);
    return false;
  }
}

/**
 * Write a full test run result to Supabase: individual scenario rows + summary.
 * Called at the end of a run. Failures are logged but don't block the report.
 * @param {object} cfg - supabase config
 * @param {object} runResult - { started_at, finished_at, results, config_snapshot }
 * @param {object} summary - from buildSummary()
 * @param {string} runId - the run_id string
 * @param {object} opts - { run_type, concurrency, phoneNumbersByScenario }
 * @returns {Promise<{rowsWritten: number, summaryWritten: boolean}>}
 */
export async function writeRunToSupabase(cfg, runResult, summary, runId, opts = {}) {
  const runType = opts.run_type || "full";
  const concurrency = opts.concurrency ?? null;
  const phoneMap = opts.phoneNumbersByScenario || {};

  // Insert individual scenario rows
  let rowsWritten = 0;
  for (const result of runResult.results) {
    if (result.skipped && result.latency_ms == null) continue; // skip dry-run entries
    const ok = await insertTestRunRow(cfg, {
      ...result,
      run_id: runId,
      run_type: runType,
      concurrency,
      phone_number: phoneMap[result.scenario_id] || null,
    });
    if (ok) rowsWritten++;
  }

  // Insert summary row
  const passRateNum = summary.total > 0
    ? Math.round((summary.passed / summary.total) * 1000) / 10 // one decimal
    : 0;

  const summaryWritten = await insertTestRunSummary(cfg, {
    run_id: runId,
    run_type: runType,
    concurrency,
    total: summary.total,
    passed: summary.passed,
    failed: summary.failed,
    skipped: summary.skipped,
    pass_rate_num: passRateNum,
    latency_p50_ms: summary.latency_ms?.p50 ?? null,
    latency_p95_ms: summary.latency_ms?.p95 ?? null,
    latency_avg_ms: summary.latency_ms?.avg ?? null,
    by_category: summary.by_category || {},
    started_at: runResult.started_at,
    finished_at: runResult.finished_at,
  });

  return { rowsWritten, summaryWritten };
}

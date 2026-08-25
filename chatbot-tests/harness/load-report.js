// load-report.js — generates JSON and HTML load test reports under ../results/load-tests/.
//
// The HTML report includes:
//   - Summary cards for each test (burst/rapid-fire/soak/failure)
//   - Latency distribution histograms (CSS bar charts)
//   - Bottleneck analysis and recommendations
//   - Per-conversation detail tables
//   - CSV export link

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Generate and save both JSON and HTML load test reports.
 * @param {object} runResult - full result from loadtest.js
 * @param {string} resultsDir - absolute path to load-test results directory
 * @returns {Promise<{jsonPath: string, htmlPath: string, summary: object}>}
 */
export async function generateLoadReport(runResult, resultsDir) {
  await mkdir(resultsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const summary = buildSummary(runResult);
  const jsonPath = join(resultsDir, `loadtest-${timestamp}.json`);
  const htmlPath = join(resultsDir, `loadtest-${timestamp}.html`);

  const jsonReport = {
    run_id: runResult.run_id,
    started_at: runResult.started_at,
    finished_at: runResult.finished_at,
    config: runResult.config_snapshot,
    summary,
    bottleneck_analysis: runResult.bottleneck_analysis,
    tests: runResult.results,
  };

  await writeFile(jsonPath, JSON.stringify(jsonReport, null, 2));
  const html = buildHtmlReport(jsonReport);
  await writeFile(htmlPath, html);

  // Also write "latest" copies
  await writeFile(join(resultsDir, "latest-loadtest.json"), JSON.stringify(jsonReport, null, 2));
  await writeFile(join(resultsDir, "latest-loadtest.html"), html);

  return { jsonPath, htmlPath, summary };
}

function buildSummary(runResult) {
  const results = runResult.results || [];
  const total = results.length;
  const passed = results.filter((r) => r.passed?.ok).length;
  const failed = total - passed;
  const burstTests = results.filter((r) => r.test_type === "burst" && !r.dry_run);
  const rapidFire = results.find((r) => r.test_type === "rapid-fire" && !r.dry_run);
  const soak = results.find((r) => r.test_type === "soak" && !r.dry_run);
  const failures = results.find((r) => r.test_type === "failure" && !r.dry_run);

  const byType = {};
  for (const r of results) {
    byType[r.test_type] = byType[r.test_type] || { total: 0, passed: 0, failed: 0 };
    byType[r.test_type].total++;
    if (r.passed?.ok) byType[r.test_type].passed++;
    else byType[r.test_type].failed++;
  }

  const maxConcurrent = burstTests.length
    ? burstTests.reduce((max, t) => (!t.dry_run && t.count > max ? t.count : max), 0)
    : 0;

  return {
    total,
    passed,
    failed,
    pass_rate: total ? `${((passed / total) * 100).toFixed(1)}%` : "0%",
    by_type: byType,
    max_concurrent_tested: maxConcurrent,
    burst_tests_count: burstTests.length,
    rapid_fire: !!rapidFire,
    soak: !!soak,
    failure_mode: !!failures,
  };
}

function buildHtmlReport(report) {
  const s = report.summary;
  const bottleneck = report.bottleneck_analysis;

  const cardsHtml = buildSummaryCards(report.tests);
  const bottleneckHtml = buildBottleneckSection(bottleneck);
  const testsHtml = report.tests.map(buildTestSection).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Phase 6: HDS Chatbot Load Test Report — ${escapeHtml(report.run_id)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; color: #222; }
  h1, h2, h3 { color: #1a1a1a; margin-top: 1.5em; }
  .meta { color: #666; font-size: 13px; margin-bottom: 16px; }
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin: 20px 0; }
  .stat { background: #fff; padding: 16px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; }
  .stat .big { font-size: 2em; font-weight: 700; }
  .stat.passed .big { color: #16a34a; }
  .stat.failed .big { color: #dc2626; }
  .stat.total .big { color: #1a1a1a; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin: 20px 0; }
  .card { background: #fff; padding: 16px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .card h3 { margin-top: 0; }
  .card.passed { border-left: 4px solid #16a34a; }
  .card.failed { border-left: 4px solid #dc2626; }
  .card.warn { border-left: 4px solid #f59e0b; }
  .metric { display: flex; justify-content: space-between; margin: 4px 0; font-size: 13px; }
  .metric span:first-child { color: #666; }
  .metric span:last-child { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin: 16px 0; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; font-size: 13px; vertical-align: top; }
  th { background: #f9f9f9; font-weight: 600; }
  .bar-chart { display: flex; flex-direction: column; gap: 4px; margin: 12px 0; }
  .bar-row { display: flex; align-items: center; gap: 8px; }
  .bar-label { width: 80px; font-size: 12px; color: #666; }
  .bar-track { flex: 1; background: #e5e7eb; border-radius: 4px; overflow: hidden; height: 20px; }
  .bar-fill { height: 100%; background: #3b82f6; min-width: 1px; }
  .bar-value { width: 60px; text-align: right; font-size: 12px; }
  .recommendations { background: #fff; padding: 16px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .recommendations ul { margin: 8px 0; padding-left: 20px; }
  .recommendations li { margin: 6px 0; font-size: 13px; }
  .issues { color: #dc2626; font-size: 13px; }
  .issues li { margin: 2px 0; }
  .ok { color: #16a34a; font-weight: 600; }
  .warning { color: #b45309; }
  pre { white-space: pre-wrap; word-break: break-word; font-size: 11px; background: #f5f5f5; padding: 8px; border-radius: 4px; max-height: 200px; overflow: auto; }
  details summary { cursor: pointer; color: #2563eb; font-size: 13px; }
  .section { margin: 24px 0; }
  .lat-table { max-width: 500px; }
</style>
</head>
<body>
<h1>Phase 6 — Concurrency & Load Test Report</h1>
<div class="meta">
  Run ID: ${escapeHtml(report.run_id)}<br>
  Started: ${escapeHtml(report.started_at)} | Finished: ${escapeHtml(report.finished_at)}<br>
  Config: ${escapeHtml(report.config.webhook_url)}<br>
  Safe Mode: ${report.config.safe_mode ? "ON" : "OFF"}
</div>

<h2>Summary</h2>
<div class="summary">
  <div class="stat total"><div class="big">${s.total}</div><div>tests run</div></div>
  <div class="stat passed"><div class="big">${s.passed}</div><div>passed</div></div>
  <div class="stat failed"><div class="big">${s.failed}</div><div>failed</div></div>
  <div class="stat"><div class="big">${s.pass_rate}</div><div>pass rate</div></div>
  <div class="stat"><div class="big">${s.max_concurrent_tested}</div><div>max concurrent</div></div>
</div>

<h2>Test Results</h2>
<div class="cards">
  ${cardsHtml}
</div>

${bottleneckHtml}

<h2>Detailed Results</h2>
${testsHtml}

</body>
</html>`;
}

function buildSummaryCards(tests) {
  return tests.map((t) => {
    const cls = t.dry_run ? "warn" : t.passed?.ok ? "passed" : "failed";
    const title = `${t.test_type === "burst" ? "Burst" : t.test_type === "rapid-fire" ? "Rapid-Fire" : t.test_type === "soak" ? "Soak" : t.test_type === "failure" ? "Failure-Mode" : "Test"} ${t.test_type === "burst" ? `(${t.count})` : ""}${t.test_type === "rapid-fire" ? `(${t.count} msgs)` : ""}${t.test_type === "soak" ? `(${t.rate_per_min}/min, ${t.duration_min}min)` : ""}${t.test_type === "failure" ? `(${t.mode})` : ""}`;
    const metrics = [];
    if (t.test_type === "burst") {
      metrics.push(["Replies", `${t.reply?.received || "—"}/${t.count} (${t.reply?.success_rate_pct || "—"}%)`]);
      metrics.push(["p50 latency", `${t.reply?.latency?.p50 ?? "—"}ms`]);
      metrics.push(["p95 latency", `${t.reply?.latency?.p95 ?? "—"}ms`]);
      metrics.push(["Contamination", `${t.contamination?.passed || "—"}/${t.count}`]);
      metrics.push(["Throughput", `${t.throughput_convos_per_sec || "—"} convos/s`]);
    } else if (t.test_type === "rapid-fire") {
      metrics.push(["Msgs sent", `${t.messages_sent}`]);
      metrics.push(["Replies", `${t.assistant_replies} (ratio ${t.reply_ratio})`]);
      metrics.push(["Duplicates", `${t.duplicate_count}`]);
      metrics.push(["Ordering OK", `${t.ordering_ok}`]);
      metrics.push(["p95 latency", `${t.reply_latency?.p95 ?? "—"}ms`]);
    } else if (t.test_type === "soak") {
      metrics.push(["Convos", `${t.total_convos}`]);
      metrics.push(["Replies", `${t.replies_received} (${t.success_rate_pct}%)`]);
      metrics.push(["p95 latency", `${t.reply_latency?.p95 ?? "—"}ms`]);
      metrics.push(["Degradation", `${t.latency_degradation_pct != null ? t.latency_degradation_pct + "%" : "—"}`]);
    } else if (t.test_type === "failure") {
      metrics.push(["POST", t.post_ok ? `OK (${t.post_status})` : `FAIL (${t.post_status})`]);
      metrics.push(["Reply", t.reply_received ? `YES (${t.reply_latency_ms}ms)` : "NO"]);
      metrics.push(["Mode", t.mode]);
    }
    const metricHtml = metrics.map(([k, v]) => `<div class="metric"><span>${escapeHtml(k)}</span><span>${escapeHtml(String(v))}</span></div>`).join("");
    const issues = t.passed?.issues || [];
    const statusHtml = t.dry_run
      ? `<p class="warning">DRY RUN — no webhook calls</p>`
      : issues.length
        ? `<ul class="issues">${issues.map((i) => `<li>✗ ${escapeHtml(i)}</li>`).join("")}</ul>`
        : `<p class="ok">✓ PASSED</p>`;
    return `<div class="card ${cls}">
      <h3>${escapeHtml(title)}</h3>
      ${metricHtml}
      ${statusHtml}
    </div>`;
  }).join("\n");
}

function buildBottleneckSection(bottleneck) {
  if (!bottleneck) return "";
  const observations = bottleneck.observations || [];
  const recommendations = bottleneck.recommendations || [];
  const obsHtml = observations.length
    ? `<ul>${observations.map((o) => `<li>${escapeHtml(o)}</li>`).join("")}</ul>`
    : "<p>No bottlenecks detected.</p>";
  const recHtml = recommendations.length
    ? `<ul>${recommendations.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>`
    : "";
  const breaking = bottleneck.breaking_point
    ? `<div class="metric"><span>Approx. breaking point</span><span>${bottleneck.breaking_point} concurrent conversations</span></div>`
    : "";

  return `<div class="section">
    <h2>Bottleneck Analysis</h2>
    <div class="recommendations">
      ${breaking}
      <h3>Observations</h3>
      ${obsHtml}
      <h3>Recommendations</h3>
      ${recHtml || "<p>No recommendations — tested load within healthy range.</p>"}
    </div>
  </div>`;
}

function buildTestSection(t) {
  if (t.dry_run) {
    return `<div class="section">
      <h3>${escapeHtml(t.test_type)} — DRY RUN</h3>
      <p>Plan only; no webhook calls were made.</p>
      <pre>${escapeHtml(JSON.stringify(t, null, 2))}</pre>
    </div>`;
  }

  if (t.test_type === "burst") return buildBurstSection(t);
  if (t.test_type === "rapid-fire") return buildRapidFireSection(t);
  if (t.test_type === "soak") return buildSoakSection(t);
  if (t.test_type === "failure") return buildFailureSection(t);

  return `<div class="section">
    <h3>${escapeHtml(t.test_type)}</h3>
    <pre>${escapeHtml(JSON.stringify(t, null, 2))}</pre>
  </div>`;
}

function buildBurstSection(t) {
  const lat = t.reply?.latency || {};
  const hist = buildHistogram(t.conversations || [], "reply_latency_ms", 10);
  const rows = (t.conversations || []).slice(0, 100).map((c) => `<tr>
    <td>${escapeHtml(c.phone)}</td>
    <td>${c.post_ok ? "✓" : "✗"}</td>
    <td>${c.post_latency_ms ?? "—"}</td>
    <td>${c.reply_received ? "✓" : "✗"}</td>
    <td>${c.reply_latency_ms ?? "—"}</td>
    <td>${c.contamination_ok ? "✓" : "✗"}</td>
    <td>${escapeHtml((c.reply_text || "").substring(0, 80))}</td>
  </tr>`).join("");
  return `<div class="section">
    <h3>Burst Test — ${t.count} simultaneous conversations</h3>
    <div class="metric"><span>Replies</span><span>${t.reply?.received || "—"}/${t.count} (${t.reply?.success_rate_pct || "—"}%)</span></div>
    <div class="metric"><span>POST success</span><span>${t.webhook_post?.success || "—"}/${t.count}</span></div>
    <div class="metric"><span>Contamination</span><span>${t.contamination?.passed || "—"}/${t.count}</span></div>
    <div class="metric"><span>Throughput</span><span>${t.throughput_convos_per_sec || "—"} convos/s</span></div>
    <h4>Reply Latency Distribution (ms)</h4>
    <div class="bar-chart">${buildLatencyBars(lat)}</div>
    <h4>Reply Latency Histogram</h4>
    ${hist}
    <h4>Latency Stats</h4>
    <table class="lat-table">
      <tr><th>Metric</th><th>Value (ms)</th></tr>
      <tr><td>min</td><td>${lat.min ?? "—"}</td></tr>
      <tr><td>p50</td><td>${lat.p50 ?? "—"}</td></tr>
      <tr><td>p90</td><td>${lat.p90 ?? "—"}</td></tr>
      <tr><td>p95</td><td>${lat.p95 ?? "—"}</td></tr>
      <tr><td>p99</td><td>${lat.p99 ?? "—"}</td></tr>
      <tr><td>max</td><td>${lat.max ?? "—"}</td></tr>
      <tr><td>avg</td><td>${lat.avg ?? "—"}</td></tr>
    </table>
    <h4>Conversation Details (first 100)</h4>
    <table>
      <thead><tr><th>Phone</th><th>POST</th><th>POST ms</th><th>Reply</th><th>Reply ms</th><th>Clean</th><th>Reply preview</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function buildRapidFireSection(t) {
  const rows = (t.replies || []).map((r) => `<tr>
    <td>${r.index}</td>
    <td>${escapeHtml(r.created_at)}</td>
    <td>${r.latency_from_send_ms ?? "—"}</td>
    <td>${escapeHtml((r.message_text || "").substring(0, 120))}</td>
  </tr>`).join("");
  const msgRows = (t.messages || []).map((m) => `<tr>
    <td>${m.index}</td>
    <td>${escapeHtml(m.text)}</td>
    <td>${m.post_ok ? "✓" : "✗"}</td>
    <td>${m.post_latency_ms ?? "—"}</td>
  </tr>`).join("");
  return `<div class="section">
    <h3>Rapid-Fire Test — ${t.count} messages to ${escapeHtml(t.phone)}</h3>
    <div class="metric"><span>Messages sent</span><span>${t.messages_sent}</span></div>
    <div class="metric"><span>Assistant replies</span><span>${t.assistant_replies} (ratio ${t.reply_ratio})</span></div>
    <div class="metric"><span>User msgs logged</span><span>${t.user_messages_logged}</span></div>
    <div class="metric"><span>Duplicate replies</span><span>${t.duplicate_count}</span></div>
    <div class="metric"><span>Ordering OK</span><span>${t.ordering_ok}</span></div>
    <h4>Sent Messages</h4>
    <table>
      <thead><tr><th>#</th><th>Text</th><th>POST</th><th>POST ms</th></tr></thead>
      <tbody>${msgRows}</tbody>
    </table>
    <h4>Assistant Replies</h4>
    <table>
      <thead><tr><th>#</th><th>Time</th><th>Latency ms</th><th>Reply preview</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function buildSoakSection(t) {
  const bucketRows = (t.latency_buckets || []).map((b) => `<tr>
    <td>${b.bucket}</td>
    <td>${b.convos}</td>
    <td>${b.replies}</td>
    <td>${b.avg_latency_ms}</td>
    <td>${b.p95_latency_ms}</td>
  </tr>`).join("");
  const lat = t.reply_latency || {};
  return `<div class="section">
    <h3>Soak Test — ${t.rate_per_min}/min for ${t.duration_min} minutes</h3>
    <div class="metric"><span>Total convos</span><span>${t.total_convos}</span></div>
    <div class="metric"><span>POST successes</span><span>${t.post_successes}</span></div>
    <div class="metric"><span>Replies</span><span>${t.replies_received} (${t.success_rate_pct}%)</span></div>
    <div class="metric"><span>Latency degradation</span><span>${t.latency_degradation_pct != null ? t.latency_degradation_pct + "%" : "—"}</span></div>
    <h4>Reply Latency Distribution (ms)</h4>
    <div class="bar-chart">${buildLatencyBars(lat)}</div>
    <h4>Latency by Time Bucket</h4>
    <table>
      <thead><tr><th>Bucket</th><th>Convos</th><th>Replies</th><th>Avg ms</th><th>p95 ms</th></tr></thead>
      <tbody>${bucketRows}</tbody>
    </table>
  </div>`;
}

function buildFailureSection(t) {
  return `<div class="section">
    <h3>Failure-Mode Test — ${escapeHtml(t.mode)}</h3>
    <p><strong>Message:</strong> ${escapeHtml(t.message)}</p>
    <p><strong>Description:</strong> ${escapeHtml(t.description)}</p>
    <div class="metric"><span>POST</span><span>${t.post_ok ? `OK (${t.post_status})` : `FAIL (${t.post_status})`}</span></div>
    <div class="metric"><span>POST latency</span><span>${t.post_latency_ms ?? "—"}ms</span></div>
    <div class="metric"><span>Reply received</span><span>${t.reply_received ? `YES (${t.reply_latency_ms}ms)` : "NO"}</span></div>
    <div class="metric"><span>Has fallback keyword</span><span>${t.has_fallback_keyword ? "YES" : "NO"}</span></div>
    <div class="metric"><span>Error leakage</span><span>${t.error_leakage ? "YES (BAD)" : "NO"}</span></div>
    <h4>Reply Text</h4>
    <pre>${escapeHtml(t.reply_text || "(no reply)")}</pre>
    <h4>Tool Calls Logged</h4>
    <pre>${escapeHtml((t.tool_calls || []).join("\n") || "(none)")}</pre>
  </div>`;
}

function buildLatencyBars(lat) {
  const metrics = [
    ["min", lat.min],
    ["p50", lat.p50],
    ["p90", lat.p90],
    ["p95", lat.p95],
    ["p99", lat.p99],
    ["max", lat.max],
  ].filter(([_, v]) => v != null);
  if (metrics.length === 0) return "<p>No latency data available.</p>";
  const max = Math.max(...metrics.map(([_, v]) => v));
  return metrics.map(([k, v]) => `<div class="bar-row">
    <div class="bar-label">${escapeHtml(k)}</div>
    <div class="bar-track"><div class="bar-fill" style="width: ${(v / max) * 100}%"></div></div>
    <div class="bar-value">${v}ms</div>
  </div>`).join("");
}

function buildHistogram(conversations, key, bins) {
  const values = conversations
    .map((c) => c[key])
    .filter((v) => v != null && v > 0);
  if (values.length === 0) return "<p>No data for histogram.</p>";

  values.sort((a, b) => a - b);
  const min = values[0];
  const max = values[values.length - 1];
  const binWidth = (max - min) / bins || 1;
  const counts = new Array(bins).fill(0);

  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / binWidth), bins - 1);
    counts[idx]++;
  }

  const maxCount = Math.max(...counts);
  const rows = [];
  for (let i = 0; i < bins; i++) {
    const from = Math.round(min + i * binWidth);
    const to = i === bins - 1 ? max : Math.round(min + (i + 1) * binWidth);
    const c = counts[i];
    rows.push(`<div class="bar-row">
      <div class="bar-label">${from}-${to}</div>
      <div class="bar-track"><div class="bar-fill" style="width: ${(c / maxCount) * 100}%"></div></div>
      <div class="bar-value">${c}</div>
    </div>`);
  }
  return `<div class="bar-chart">${rows.join("")}</div>`;
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

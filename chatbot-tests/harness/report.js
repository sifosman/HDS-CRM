// report.js — generates JSON and HTML test reports under Chatbot Tests/results/.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Generate and save both JSON and HTML reports.
 * @param {object} runResult - full result from runner
 * @param {string} resultsDir - absolute path to results directory
 * @returns {Promise<{jsonPath: string, htmlPath: string, summary: object}>}
 */
export async function generateReport(runResult, resultsDir) {
  await mkdir(resultsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const summary = buildSummary(runResult);
  const jsonPath = join(resultsDir, `run-${timestamp}.json`);
  const htmlPath = join(resultsDir, `run-${timestamp}.html`);

  const jsonReport = {
    run_id: `run-${timestamp}`,
    started_at: runResult.started_at,
    finished_at: runResult.finished_at,
    config: runResult.config_snapshot,
    summary,
    scenarios: runResult.results,
  };

  await writeFile(jsonPath, JSON.stringify(jsonReport, null, 2));
  const html = buildHtmlReport(jsonReport);
  await writeFile(htmlPath, html);

  // Also write a "latest" symlink-equivalent (just copy) for convenience
  await writeFile(join(resultsDir, "latest.json"), JSON.stringify(jsonReport, null, 2));
  await writeFile(join(resultsDir, "latest.html"), html);

  return { jsonPath, htmlPath, summary };
}

function buildSummary(runResult) {
  const results = runResult.results;
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  const skipped = results.filter((r) => r.skipped).length;
  const byCategory = {};
  for (const r of results) {
    const cat = r.category || "unknown";
    if (!byCategory[cat]) byCategory[cat] = { total: 0, passed: 0, failed: 0 };
    byCategory[cat].total++;
    if (r.passed) byCategory[cat].passed++;
    else byCategory[cat].failed++;
  }
  const latencies = results.filter((r) => r.latency_ms != null).map((r) => r.latency_ms);
  latencies.sort((a, b) => a - b);
  const p50 = latencies.length ? latencies[Math.floor(latencies.length * 0.5)] : null;
  const p95 = latencies.length ? latencies[Math.floor(latencies.length * 0.95)] : null;
  const avgLatency = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;
  return {
    total,
    passed,
    failed,
    skipped,
    pass_rate: total ? `${((passed / total) * 100).toFixed(1)}%` : "0%",
    by_category: byCategory,
    latency_ms: { p50, p95, avg: avgLatency },
  };
}

function buildHtmlReport(report) {
  const s = report.summary;
  const scenarioRows = report.scenarios
    .map((r) => {
      const statusClass = r.skipped ? "skipped" : r.passed ? "passed" : "failed";
      const failures = (r.failures || [])
        .map((f) => `<li>${escapeHtml(f.detail)}</li>`)
        .join("");
      const warnings = (r.warnings || [])
        .map((w) => `<li class="warning">${escapeHtml(w.detail)}</li>`)
        .join("");
      return `<tr class="${statusClass}">
        <td>${escapeHtml(r.scenario_id)}</td>
        <td>${escapeHtml(r.name)}</td>
        <td>${escapeHtml(r.category)}</td>
        <td>${r.skipped ? "SKIPPED" : r.passed ? "PASS" : "FAIL"}</td>
        <td>${r.latency_ms != null ? r.latency_ms + "ms" : "—"}</td>
        <td>${escapeHtml((r.tool_calls || []).join(", "))}</td>
        <td>${failures || warnings ? `<ul>${failures}${warnings}</ul>` : "—"}</td>
        <td>${r.last_reply ? `<details><summary>view</summary><pre>${escapeHtml(r.last_reply)}</pre></details>` : "—"}</td>
      </tr>`;
    })
    .join("\n");

  const categoryCards = Object.entries(s.by_category)
    .map(([cat, c]) => {
      const rate = c.total ? ((c.passed / c.total) * 100).toFixed(0) : 0;
      const cls = rate >= 90 ? "good" : rate >= 70 ? "warn" : "bad";
      return `<div class="card ${cls}"><h3>${escapeHtml(cat)}</h3>
        <div class="big">${c.passed}/${c.total}</div>
        <div>${rate}% pass</div></div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>HDS Chatbot Test Report — ${escapeHtml(report.run_id)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; color: #222; }
  h1 { color: #1a1a1a; }
  .summary { display: flex; gap: 16px; flex-wrap: wrap; margin: 20px 0; }
  .stat { background: #fff; padding: 16px 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; }
  .stat .big { font-size: 2em; font-weight: 700; }
  .stat.passed .big { color: #16a34a; }
  .stat.failed .big { color: #dc2626; }
  .stat.total .big { color: #1a1a1a; }
  .categories { display: flex; gap: 12px; flex-wrap: wrap; margin: 20px 0; }
  .card { background: #fff; padding: 12px 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; min-width: 140px; }
  .card.good { border-left: 4px solid #16a34a; }
  .card.warn { border-left: 4px solid #f59e0b; }
  .card.bad { border-left: 4px solid #dc2626; }
  .card .big { font-size: 1.5em; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #eee; font-size: 13px; vertical-align: top; }
  th { background: #f9f9f9; font-weight: 600; position: sticky; top: 0; }
  tr.passed { background: #f0fdf4; }
  tr.failed { background: #fef2f2; }
  tr.skipped { background: #f9fafb; color: #888; }
  tr.passed td:nth-child(4) { color: #16a34a; font-weight: 600; }
  tr.failed td:nth-child(4) { color: #dc2626; font-weight: 600; }
  ul { margin: 4px 0; padding-left: 16px; }
  li { margin: 2px 0; font-size: 12px; }
  li.warning { color: #b45309; }
  pre { white-space: pre-wrap; word-break: break-word; font-size: 11px; background: #f5f5f5; padding: 8px; border-radius: 4px; max-height: 200px; overflow: auto; }
  details summary { cursor: pointer; color: #2563eb; }
  .meta { color: #666; font-size: 13px; margin-bottom: 16px; }
</style>
</head>
<body>
<h1>HDS Chatbot Test Report</h1>
<div class="meta">
  Run ID: ${escapeHtml(report.run_id)}<br>
  Started: ${escapeHtml(report.started_at)} | Finished: ${escapeHtml(report.finished_at)}<br>
  Latency p50: ${s.latency_ms.p50 ?? "—"}ms | p95: ${s.latency_ms.p95 ?? "—"}ms | avg: ${s.latency_ms.avg ?? "—"}ms
</div>
<div class="summary">
  <div class="stat total"><div class="big">${s.total}</div><div>total</div></div>
  <div class="stat passed"><div class="big">${s.passed}</div><div>passed</div></div>
  <div class="stat failed"><div class="big">${s.failed}</div><div>failed</div></div>
  <div class="stat"><div class="big">${s.pass_rate}</div><div>pass rate</div></div>
</div>
<h2>By Category</h2>
<div class="categories">${categoryCards}</div>
<h2>Scenario Results</h2>
<table>
<thead><tr><th>ID</th><th>Name</th><th>Category</th><th>Status</th><th>Latency</th><th>Tools</th><th>Failures / Warnings</th><th>Reply</th></tr></thead>
<tbody>
${scenarioRows}
</tbody>
</table>
</body>
</html>`;
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

// combine-load-results.js — combines individual load test result JSON files into a single
// consolidated Phase 6 report with bottleneck analysis.
//
// Usage: node combine-load-results.js
// Reads all loadtest-*.json from ../results/load-tests/ and produces:
//   - phase6-final-report.json
//   - phase6-final-report.html

import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HARNESS_DIR = __dirname;
const RESULTS_DIR = resolve(HARNESS_DIR, "..", "results", "load-tests");

function percentile(sortedArr, p) {
  if (!sortedArr.length) return null;
  const idx = Math.min(Math.floor(sortedArr.length * p), sortedArr.length - 1);
  return sortedArr[idx];
}

function computeStats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    min: sorted.length ? sorted[0] : null,
    max: sorted.length ? sorted[sorted.length - 1] : null,
    avg: sorted.length ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length) : null,
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
  };
}

function analyzeBottlenecks(burstResults) {
  const analysis = {
    breaking_point: null,
    observations: [],
    recommendations: [],
  };

  for (const r of burstResults) {
    if (r.dry_run || !r.passed) continue;
    if (!r.passed.ok) {
      analysis.breaking_point = r.count;
      analysis.observations.push(`At ${r.count} concurrent conversations, failures detected: ${r.passed.issues.join(", ")}`);
      break;
    }
  }

  const validResults = burstResults.filter((r) => !r.dry_run && r.reply && r.reply.latency);
  if (validResults.length >= 2) {
    for (let i = 1; i < validResults.length; i++) {
      const prev = validResults[i - 1];
      const curr = validResults[i];
      const p50Increase = prev.reply.latency.p50 && curr.reply.latency.p50
        ? ((curr.reply.latency.p50 - prev.reply.latency.p50) / prev.reply.latency.p50 * 100).toFixed(0)
        : null;
      if (p50Increase && parseFloat(p50Increase) > 50) {
        analysis.observations.push(`p50 latency increased ${p50Increase}% from ${prev.count} → ${curr.count} concurrent conversations`);
      }
    }
  }

  if (analysis.breaking_point) {
    analysis.recommendations.push(`n8n workflow concurrency limit appears to be around ${analysis.breaking_point} simultaneous conversations. Consider increasing n8n execution concurrency setting or adding a queue.`);
  }
  const hasContaminationFailure = burstResults.some((r) => r.contamination && r.contamination.failed > 0);
  if (hasContaminationFailure) {
    analysis.recommendations.push("Cross-conversation contamination detected — investigate n8n memory buffer isolation.");
  }
  const hasPostFailure = burstResults.some((r) => r.webhook_post && r.webhook_post.failed > 0);
  if (hasPostFailure) {
    analysis.recommendations.push("Webhook POST failures detected under load — check n8n reverse proxy connection limits.");
  }
  if (analysis.recommendations.length === 0) {
    analysis.recommendations.push("No critical bottlenecks detected in tested range. Bot appears to handle the tested load levels.");
  }

  return analysis;
}

async function main() {
  const files = await readdir(RESULTS_DIR);
  const jsonFiles = files.filter((f) => f.startsWith("loadtest-") && f.endsWith(".json"));

  // Read all results and extract individual tests
  const allTests = [];
  for (const f of jsonFiles) {
    const raw = await readFile(join(RESULTS_DIR, f), "utf-8");
    try {
      const data = JSON.parse(raw);
      if (data.tests) {
        for (const t of data.tests) {
          // Deduplicate by test_type + key identifier
          if (t.test_type === "burst") {
            if (!allTests.some((x) => x.test_type === "burst" && x.count === t.count && !x.dry_run && !t.dry_run)) {
              allTests.push(t);
            }
          } else if (t.test_type === "rapid-fire") {
            if (!allTests.some((x) => x.test_type === "rapid-fire" && !x.dry_run && !t.dry_run)) {
              allTests.push(t);
            }
          } else if (t.test_type === "soak") {
            if (!allTests.some((x) => x.test_type === "soak" && !x.dry_run && !t.dry_run)) {
              allTests.push(t);
            }
          } else if (t.test_type === "failure") {
            if (!allTests.some((x) => x.test_type === "failure" && x.mode === t.mode && !x.dry_run && !t.dry_run)) {
              allTests.push(t);
            }
          }
        }
      }
    } catch (e) {
      // skip invalid
    }
  }

  // Sort: burst (by count), rapid-fire, failure (by mode), soak
  allTests.sort((a, b) => {
    const order = { burst: 1, "rapid-fire": 2, failure: 3, soak: 4 };
    if (order[a.test_type] !== order[b.test_type]) return order[a.test_type] - order[b.test_type];
    if (a.test_type === "burst") return (a.count || 0) - (b.count || 0);
    if (a.test_type === "failure") return (a.mode || "").localeCompare(b.mode || "");
    return 0;
  });

  const burstResults = allTests.filter((r) => r.test_type === "burst" && !r.dry_run);
  const analysis = burstResults.length > 1 ? analyzeBottlenecks(burstResults) : null;

  const summary = {
    total: allTests.length,
    passed: allTests.filter((t) => t.passed?.ok).length,
    failed: allTests.filter((t) => !t.passed?.ok && !t.dry_run).length,
    burst_tests: burstResults.length,
    rapid_fire: allTests.some((t) => t.test_type === "rapid-fire" && !t.dry_run),
    soak: allTests.some((t) => t.test_type === "soak" && !t.dry_run),
    failure_modes: allTests.filter((t) => t.test_type === "failure" && !t.dry_run).map((t) => t.mode),
  };

  const report = {
    run_id: `phase6-final-${new Date().toISOString().replace(/[:.]/g, "-")}`,
    started_at: allTests[0]?.started_at || new Date().toISOString(),
    finished_at: new Date().toISOString(),
    summary,
    bottleneck_analysis: analysis,
    tests: allTests,
  };

  await writeFile(join(RESULTS_DIR, "phase6-final-report.json"), JSON.stringify(report, null, 2));
  await writeFile(join(RESULTS_DIR, "phase6-final-report.html"), buildHtml(report));

  console.log(`Consolidated ${allTests.length} test results into phase6-final-report.json/html`);
  console.log(`  Passed: ${summary.passed}/${summary.total}`);
  console.log(`  Burst tests: ${summary.burst_tests}`);
  console.log(`  Rapid-fire: ${summary.rapid_fire}`);
  console.log(`  Soak: ${summary.soak}`);
  console.log(`  Failure modes: ${summary.failure_modes.join(", ")}`);
  if (analysis) {
    console.log(`\nBottleneck Analysis:`);
    if (analysis.breaking_point) console.log(`  Breaking point: ${analysis.breaking_point} concurrent conversations`);
    for (const obs of analysis.observations) console.log(`  • ${obs}`);
    for (const rec of analysis.recommendations) console.log(`  → ${rec}`);
  }
  console.log(`\nReports:`);
  console.log(`  ${join(RESULTS_DIR, "phase6-final-report.json")}`);
  console.log(`  ${join(RESULTS_DIR, "phase6-final-report.html")}`);
}

function buildHtml(report) {
  const s = report.summary;
  const b = report.bottleneck_analysis;
  const cardsHtml = report.tests.map((t) => {
    const cls = t.dry_run ? "warn" : t.passed?.ok ? "passed" : "failed";
    const title = `${t.test_type === "burst" ? "Burst" : t.test_type === "rapid-fire" ? "Rapid-Fire" : t.test_type === "soak" ? "Soak" : "Failure-Mode"} ${t.test_type === "burst" ? `(${t.count})` : ""}${t.test_type === "rapid-fire" ? `(${t.count} msgs)` : ""}${t.test_type === "soak" ? `(${t.rate_per_min}/min, ${t.duration_min}min)` : ""}${t.test_type === "failure" ? `(${t.mode})` : ""}`;
    const metrics = [];
    if (t.test_type === "burst") {
      metrics.push(["Replies", `${t.reply?.received}/${t.count} (${t.reply?.success_rate_pct}%)`]);
      metrics.push(["p50", `${t.reply?.latency?.p50 ?? "—"}ms`]);
      metrics.push(["p95", `${t.reply?.latency?.p95 ?? "—"}ms`]);
      metrics.push(["p99", `${t.reply?.latency?.p99 ?? "—"}ms`]);
      metrics.push(["Contamination", `${t.contamination?.passed}/${t.count}`]);
    } else if (t.test_type === "rapid-fire") {
      metrics.push(["Msgs/Replies", `${t.messages_sent}/${t.assistant_replies}`]);
      metrics.push(["Duplicates", `${t.duplicate_count}`]);
      metrics.push(["Ordering", `${t.ordering_ok}`]);
    } else if (t.test_type === "soak") {
      metrics.push(["Convos", `${t.total_convos}`]);
      metrics.push(["Replies", `${t.replies_received} (${t.success_rate_pct}%)`]);
      metrics.push(["Degradation", `${t.latency_degradation_pct}%`]);
    } else if (t.test_type === "failure") {
      metrics.push(["POST", t.post_ok ? "OK" : "FAIL"]);
      metrics.push(["Reply", t.reply_received ? "YES" : "NO"]);
    }
    const mHtml = metrics.map(([k, v]) => `<div class="metric"><span>${k}</span><span>${v}</span></div>`).join("");
    const issues = t.passed?.issues || [];
    const status = t.dry_run ? '<p class="warn">DRY RUN</p>' : issues.length ? `<ul class="issues">${issues.map((i) => `<li>✗ ${i}</li>`).join("")}</ul>` : '<p class="ok">✓ PASSED</p>';
    return `<div class="card ${cls}"><h3>${title}</h3>${mHtml}${status}</div>`;
  }).join("\n");

  const bottleneckHtml = b ? `<div class="section">
    <h2>Bottleneck Analysis</h2>
    <div class="recommendations">
      ${b.breaking_point ? `<div class="metric"><span>Breaking point</span><span>${b.breaking_point} concurrent</span></div>` : ""}
      <h3>Observations</h3>
      <ul>${b.observations.map((o) => `<li>${o}</li>`).join("") || "<li>None</li>"}</ul>
      <h3>Recommendations</h3>
      <ul>${b.recommendations.map((r) => `<li>${r}</li>`).join("") || "<li>None</li>"}</ul>
    </div>
  </div>` : "";

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Phase 6 Final Report — HDS Chatbot Load Testing</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; color: #222; }
  h1, h2, h3 { color: #1a1a1a; }
  .meta { color: #666; font-size: 13px; margin-bottom: 16px; }
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin: 20px 0; }
  .stat { background: #fff; padding: 16px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; }
  .stat .big { font-size: 2em; font-weight: 700; }
  .stat.passed .big { color: #16a34a; }
  .stat.failed .big { color: #dc2626; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin: 20px 0; }
  .card { background: #fff; padding: 16px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .card.passed { border-left: 4px solid #16a34a; }
  .card.failed { border-left: 4px solid #dc2626; }
  .card.warn { border-left: 4px solid #f59e0b; }
  .metric { display: flex; justify-content: space-between; margin: 4px 0; font-size: 13px; }
  .metric span:first-child { color: #666; }
  .ok { color: #16a34a; font-weight: 600; }
  .warn { color: #b45309; }
  .issues { color: #dc2626; font-size: 13px; }
  .recommendations { background: #fff; padding: 16px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .recommendations ul { margin: 8px 0; padding-left: 20px; }
  .recommendations li { margin: 6px 0; font-size: 13px; }
  .section { margin: 24px 0; }
</style></head><body>
<h1>Phase 6 — Concurrency & Load Test Final Report</h1>
<div class="meta">Run ID: ${report.run_id}<br>Generated: ${report.finished_at}</div>
<h2>Summary</h2>
<div class="summary">
  <div class="stat"><div class="big">${s.total}</div><div>tests</div></div>
  <div class="stat passed"><div class="big">${s.passed}</div><div>passed</div></div>
  <div class="stat failed"><div class="big">${s.failed}</div><div>failed</div></div>
</div>
<h2>Test Results</h2>
<div class="cards">${cardsHtml}</div>
${bottleneckHtml}
</body></html>`;
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });

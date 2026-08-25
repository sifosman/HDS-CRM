// sales-report.js — generates a sales-specific HTML report for the sales simulation scenarios.
// Includes funnel analysis, difficulty breakdown, objection handling, close technique analysis,
// and improvement recommendations.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildSalesAggregate } from "./sales-scoring.js";

/**
 * Generate and save both JSON and HTML sales reports.
 * @param {object} runResult - full result from runner (with salesResults attached)
 * @param {string} resultsDir - absolute path to results directory
 * @returns {Promise<{jsonPath: string, htmlPath: string, aggregate: object}>}
 */
export async function generateSalesReport(runResult, resultsDir) {
  await mkdir(resultsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const aggregate = buildSalesAggregate(runResult.salesResults || []);
  const jsonPath = join(resultsDir, `sales-sim-${timestamp}.json`);
  const htmlPath = join(resultsDir, `sales-sim-${timestamp}.html`);

  const jsonReport = {
    run_id: `sales-sim-${timestamp}`,
    started_at: runResult.started_at,
    finished_at: runResult.finished_at,
    config: runResult.config_snapshot,
    aggregate,
    scenarios: runResult.results,
    sales_results: runResult.salesResults || [],
  };

  await writeFile(jsonPath, JSON.stringify(jsonReport, null, 2));
  const html = buildSalesHtmlReport(jsonReport);
  await writeFile(htmlPath, html);

  // Also write "latest" copies
  await writeFile(join(resultsDir, "sales-sim-latest.json"), JSON.stringify(jsonReport, null, 2));
  await writeFile(join(resultsDir, "sales-sim-latest.html"), html);

  return { jsonPath, htmlPath, aggregate };
}

// ---------------------------------------------------------------------------
// HTML report builder
// ---------------------------------------------------------------------------

function buildSalesHtmlReport(report) {
  const agg = report.aggregate;
  const s = agg;

  // Funnel diagram data
  const funnelStages = ["greeting", "discovery", "quote", "objection_handling", "close", "follow_up"];
  const funnelData = funnelStages.map((stage) => ({
    stage,
    passed: s.stageCounts[stage]?.passed || 0,
    total: s.stageCounts[stage]?.total || 0,
    rate: s.funnelRates[stage] || 0,
  }));

  // Difficulty breakdown
  const difficultyCards = Object.entries(s.byDifficulty || {})
    .filter(([, d]) => d.count > 0)
    .map(([diff, d]) => {
      const outcomes = d.outcomes || {};
      const converted = outcomes.converted || 0;
      const followUp = outcomes.follow_up || 0;
      const lost = outcomes.lost || 0;
      const handover = outcomes.handover || 0;
      const closeRate = d.count > 0 ? Math.round((converted / d.count) * 100) : 0;
      const colorClass = diff === "easy" ? "easy" : diff === "medium" ? "medium" : "hard";
      return `<div class="diff-card ${colorClass}">
        <h3>${escapeHtml(diff)} (${d.count})</h3>
        <div class="big-score">${d.avgScore}/100</div>
        <div class="close-rate">Close rate: ${closeRate}%</div>
        <div class="outcomes">
          <span class="outcome converted">Converted: ${converted}</span>
          <span class="outcome followup">Follow-up: ${followUp}</span>
          <span class="outcome lost">Lost: ${lost}</span>
          <span class="outcome handover">Handover: ${handover}</span>
        </div>
      </div>`;
    }).join("\n");

  // Funnel diagram bars
  const funnelBars = funnelData.map((f) => {
    const width = f.rate;
    const color = f.rate >= 80 ? "#16a34a" : f.rate >= 50 ? "#f59e0b" : "#dc2626";
    return `<div class="funnel-row">
      <div class="funnel-label">${escapeHtml(f.stage)}</div>
      <div class="funnel-bar-container">
        <div class="funnel-bar" style="width: ${width}%; background: ${color};"></div>
        <span class="funnel-text">${f.passed}/${f.total} (${f.rate}%)</span>
      </div>
    </div>`;
  }).join("\n");

  // Outcome summary
  const outcomeCards = Object.entries(s.outcomeCounts || {})
    .map(([outcome, count]) => {
      const pct = s.total > 0 ? Math.round((count / s.total) * 100) : 0;
      const colorClass = outcome === "converted" ? "good" : outcome === "follow_up" ? "warn" : outcome === "handover" ? "info" : "bad";
      return `<div class="stat ${colorClass}"><div class="big">${count}</div><div>${escapeHtml(outcome)} (${pct}%)</div></div>`;
    }).join("\n");

  // Persona type breakdown
  const personaRows = Object.entries(s.byPersonaType || {})
    .sort((a, b) => b[1].avgScore - a[1].avgScore)
    .map(([pt, d]) => {
      const outcomes = d.outcomes || {};
      const converted = outcomes.converted || 0;
      const closeRate = d.count > 0 ? Math.round((converted / d.count) * 100) : 0;
      const scoreClass = d.avgScore >= 70 ? "good" : d.avgScore >= 40 ? "warn" : "bad";
      return `<tr>
        <td>${escapeHtml(pt)}</td>
        <td>${d.count}</td>
        <td class="${scoreClass}">${d.avgScore}/100</td>
        <td>${closeRate}%</td>
        <td>${outcomes.converted || 0}</td>
        <td>${outcomes.follow_up || 0}</td>
        <td>${outcomes.lost || 0}</td>
        <td>${outcomes.handover || 0}</td>
      </tr>`;
    }).join("\n");

  // Scenario detail rows
  const scenarioRows = (report.sales_results || [])
    .map((sr) => {
      const r = report.scenarios.find((sc) => sc.scenario_id === sr.persona_type?.replace?.("unknown", "") || sc.scenario_id === sr.scenario_id) || {};
      const scoreClass = sr.score >= 70 ? "good" : sr.score >= 40 ? "warn" : "bad";
      const outcomeClass = sr.outcome === "converted" ? "good" : sr.outcome === "follow_up" ? "warn" : sr.outcome === "handover" ? "info" : "bad";
      const stages = Object.entries(sr.stages || {})
        .map(([stage, result]) => `<span class="stage-badge ${result.passed ? "pass" : "fail"}">${stage[0].toUpperCase()}</span>`)
        .join(" ");
      const scenario = report.scenarios.find((sc) => sc.scenario_id === (sr.scenario_id || r.scenario_id));
      const name = scenario?.name || sr.scenario_id || "—";
      const lastReply = scenario?.last_reply || "";
      return `<tr>
        <td>${escapeHtml(sr.scenario_id || r.scenario_id || "—")}</td>
        <td>${escapeHtml(name)}</td>
        <td><span class="diff-badge ${sr.difficulty}">${escapeHtml(sr.difficulty)}</span></td>
        <td class="${scoreClass}"><strong>${sr.score}/100</strong></td>
        <td class="${outcomeClass}">${escapeHtml(sr.outcome)}</td>
        <td class="stages">${stages}</td>
        <td>${lastReply ? `<details><summary>view</summary><pre>${escapeHtml(lastReply)}</pre></details>` : "—"}</td>
      </tr>`;
    }).join("\n");

  // Improvement recommendations
  const recommendations = generateRecommendations(s);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>HDS Sales Simulation Report — ${escapeHtml(report.run_id)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; color: #222; }
  h1 { color: #1a1a1a; }
  h2 { color: #333; margin-top: 30px; border-bottom: 2px solid #ddd; padding-bottom: 8px; }
  .meta { color: #666; font-size: 13px; margin-bottom: 16px; }
  .summary { display: flex; gap: 16px; flex-wrap: wrap; margin: 20px 0; }
  .stat { background: #fff; padding: 16px 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; min-width: 120px; }
  .stat .big { font-size: 2em; font-weight: 700; }
  .stat.good .big { color: #16a34a; }
  .stat.bad .big { color: #dc2626; }
  .stat.warn .big { color: #f59e0b; }
  .stat.info .big { color: #2563eb; }
  .diff-cards { display: flex; gap: 16px; flex-wrap: wrap; margin: 20px 0; }
  .diff-card { background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); min-width: 200px; flex: 1; }
  .diff-card.easy { border-left: 4px solid #16a34a; }
  .diff-card.medium { border-left: 4px solid #f59e0b; }
  .diff-card.hard { border-left: 4px solid #dc2626; }
  .diff-card h3 { margin: 0 0 8px 0; text-transform: capitalize; }
  .big-score { font-size: 2em; font-weight: 700; color: #1a1a1a; }
  .close-rate { color: #666; margin: 4px 0; }
  .outcomes { display: flex; flex-direction: column; gap: 2px; font-size: 12px; margin-top: 8px; }
  .outcome { padding: 2px 0; }
  .outcome.converted { color: #16a34a; }
  .outcome.followup { color: #f59e0b; }
  .outcome.lost { color: #dc2626; }
  .outcome.handover { color: #2563eb; }
  .funnel { background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin: 20px 0; }
  .funnel-row { display: flex; align-items: center; margin: 8px 0; }
  .funnel-label { width: 180px; font-weight: 600; text-transform: capitalize; }
  .funnel-bar-container { flex: 1; position: relative; height: 30px; background: #f0f0f0; border-radius: 4px; overflow: hidden; }
  .funnel-bar { height: 100%; transition: width 0.3s; }
  .funnel-text { position: absolute; left: 8px; top: 50%; transform: translateY(-50%); color: #333; font-size: 13px; font-weight: 600; z-index: 1; }
  table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin: 16px 0; }
  th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #eee; font-size: 13px; vertical-align: top; }
  th { background: #f9f9f9; font-weight: 600; position: sticky; top: 0; }
  td.good { color: #16a34a; font-weight: 600; }
  td.bad { color: #dc2626; font-weight: 600; }
  td.warn { color: #f59e0b; font-weight: 600; }
  .diff-badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
  .diff-badge.easy { background: #dcfce7; color: #16a34a; }
  .diff-badge.medium { background: #fef3c7; color: #b45309; }
  .diff-badge.hard { background: #fee2e2; color: #dc2626; }
  .stage-badge { display: inline-block; width: 22px; height: 22px; line-height: 22px; text-align: center; border-radius: 4px; font-size: 11px; font-weight: 700; margin-right: 2px; }
  .stage-badge.pass { background: #dcfce7; color: #16a34a; }
  .stage-badge.fail { background: #fee2e2; color: #dc2626; }
  .stages { white-space: nowrap; }
  .recommendations { background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin: 20px 0; }
  .recommendations ol { padding-left: 20px; }
  .recommendations li { margin: 8px 0; }
  .recommendations .priority { font-weight: 700; }
  .recommendations .priority.high { color: #dc2626; }
  .recommendations .priority.medium { color: #f59e0b; }
  .recommendations .priority.low { color: #2563eb; }
  pre { white-space: pre-wrap; word-break: break-word; font-size: 11px; background: #f5f5f5; padding: 8px; border-radius: 4px; max-height: 200px; overflow: auto; }
  details summary { cursor: pointer; color: #2563eb; }
</style>
</head>
<body>
<h1>HDS Sales Simulation Report</h1>
<div class="meta">
  Run ID: ${escapeHtml(report.run_id)}<br>
  Started: ${escapeHtml(report.started_at)} | Finished: ${escapeHtml(report.finished_at)}<br>
  Total Customers: ${s.total} | Avg Score: ${s.avgScore}/100 | Conversion Rate: ${s.conversionRate}%
</div>

<h2>Executive Summary</h2>
<div class="summary">
  <div class="stat"><div class="big">${s.total}</div><div>customers</div></div>
  <div class="stat good"><div class="big">${s.outcomeCounts.converted || 0}</div><div>converted</div></div>
  <div class="stat warn"><div class="big">${s.outcomeCounts.follow_up || 0}</div><div>follow-up</div></div>
  <div class="stat bad"><div class="big">${s.outcomeCounts.lost || 0}</div><div>lost</div></div>
  <div class="stat info"><div class="big">${s.outcomeCounts.handover || 0}</div><div>handover</div></div>
  <div class="stat"><div class="big">${s.avgScore}/100</div><div>avg score</div></div>
  <div class="stat good"><div class="big">${s.conversionRate}%</div><div>conversion</div></div>
</div>

<h2>Difficulty Breakdown</h2>
<div class="diff-cards">
${difficultyCards}
</div>

<h2>Sales Funnel Analysis</h2>
<div class="funnel">
  ${funnelBars}
</div>

<h2>Outcome Distribution</h2>
<div class="summary">
${outcomeCards}
</div>

<h2>Performance by Persona Type</h2>
<table>
<thead><tr><th>Persona Type</th><th>Count</th><th>Avg Score</th><th>Close Rate</th><th>Converted</th><th>Follow-up</th><th>Lost</th><th>Handover</th></tr></thead>
<tbody>
${personaRows}
</tbody>
</table>

<h2>Scenario Details</h2>
<table>
<thead><tr><th>ID</th><th>Name</th><th>Difficulty</th><th>Score</th><th>Outcome</th><th>Funnel Stages</th><th>Last Reply</th></tr></thead>
<tbody>
${scenarioRows}
</tbody>
</table>

<h2>Improvement Recommendations</h2>
<div class="recommendations">
  <ol>
${recommendations}
  </ol>
</div>

</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Recommendation generator
// ---------------------------------------------------------------------------

function generateRecommendations(s) {
  const recs = [];

  // Funnel drop-off analysis
  const funnelStages = ["greeting", "discovery", "quote", "objection_handling", "close", "follow_up"];
  let biggestDropoff = null;
  let biggestDropPct = 0;
  for (let i = 1; i < funnelStages.length; i++) {
    const prev = s.funnelRates[funnelStages[i - 1]] || 0;
    const curr = s.funnelRates[funnelStages[i]] || 0;
    const drop = prev - curr;
    if (drop > biggestDropPct) {
      biggestDropPct = drop;
      biggestDropoff = { from: funnelStages[i - 1], to: funnelStages[i], drop };
    }
  }

  if (biggestDropoff && biggestDropPct > 20) {
    recs.push(`<li><span class="priority high">[HIGH]</span> <strong>Funnel drop-off at ${biggestDropoff.to} stage</strong>: ${biggestDropPct}% of customers drop off between ${biggestDropoff.from} and ${biggestDropoff.to}. This is the biggest bottleneck in the sales process. Focus on improving AI behavior at this stage.</li>`);
  }

  // Close rate analysis
  const closeRate = s.funnelRates.close || 0;
  if (closeRate < 50) {
    recs.push(`<li><span class="priority high">[HIGH]</span> <strong>Low close rate (${closeRate}%)</strong>: The AI is not attempting to close sales often enough. Update the system prompt to emphasize closing techniques — the AI should always attempt a close after a quote is generated.</li>`);
  } else if (closeRate < 75) {
    recs.push(`<li><span class="priority medium">[MEDIUM]</span> <strong>Moderate close rate (${closeRate}%)</strong>: The AI closes sometimes but misses opportunities. Train the AI to recognize buying signals and attempt closes more aggressively.</li>`);
  }

  // Objection handling analysis
  const objectionRate = s.funnelRates.objection_handling || 0;
  if (objectionRate < 50) {
    recs.push(`<li><span class="priority high">[HIGH]</span> <strong>Weak objection handling (${objectionRate}%)</strong>: The AI struggles to handle objections. Add more objection handling patterns to the system prompt — empathy phrases + value arguments for price, quality, timing, authority, and budget objections.</li>`);
  }

  // Quote generation analysis
  const quoteRate = s.funnelRates.quote || 0;
  if (quoteRate < 70) {
    recs.push(`<li><span class="priority high">[HIGH]</span> <strong>Quote generation issues (${quoteRate}%)</strong>: The AI is not generating quotes reliably. This may be a tool-calling issue — verify the generate_quote tool is working and the AI is calling it correctly.</li>`);
  }

  // Difficulty-specific recommendations
  const easyData = s.byDifficulty?.easy;
  const hardData = s.byDifficulty?.hard;
  if (easyData && easyData.count > 0) {
    const easyCloseRate = Math.round(((easyData.outcomes.converted || 0) / easyData.count) * 100);
    if (easyCloseRate < 80) {
      recs.push(`<li><span class="priority high">[HIGH]</span> <strong>Easy customers not being closed (${easyCloseRate}%)</strong>: The AI should be closing nearly all easy customers. These are ready-to-buy customers — the AI just needs to quote and ask for the order. Review the close attempt logic.</li>`);
    }
  }
  if (hardData && hardData.count > 0) {
    const hardLostRate = Math.round(((hardData.outcomes.lost || 0) / hardData.count) * 100);
    if (hardLostRate > 60) {
      recs.push(`<li><span class="priority medium">[MEDIUM]</span> <strong>Hard customers being lost (${hardLostRate}%)</strong>: While hard customers are expected to be difficult, the AI should at least keep the door open (follow_up) rather than losing them entirely. Focus on follow-up language and de-escalation techniques.</li>`);
    }
  }

  // Follow-up analysis
  const followUpRate = s.funnelRates.follow_up || 0;
  if (followUpRate < 30) {
    recs.push(`<li><span class="priority medium">[MEDIUM]</span> <strong>Low follow-up rate (${followUpRate}%)</strong>: The AI rarely keeps the door open for future business. Add follow-up language to the system prompt — "feel free to reach out", "when you're ready", "I'll save your quote".</li>`);
  }

  // Persona type insights
  const personaEntries = Object.entries(s.byPersonaType || {});
  const worstPersona = personaEntries.sort((a, b) => a[1].avgScore - b[1].avgScore)[0];
  const bestPersona = personaEntries.sort((a, b) => b[1].avgScore - a[1].avgScore)[0];
  if (worstPersona && worstPersona[1].avgScore < 40) {
    recs.push(`<li><span class="priority medium">[MEDIUM]</span> <strong>Worst persona type: ${worstPersona[0]} (avg ${worstPersona[1].avgScore}/100)</strong>: The AI struggles most with this customer type. Review the conversation patterns and add specific handling instructions to the system prompt.</li>`);
  }
  if (bestPersona && bestPersona[1].avgScore >= 70) {
    recs.push(`<li><span class="priority low">[LOW]</span> <strong>Best persona type: ${bestPersona[0]} (avg ${bestPersona[1].avgScore}/100)</strong>: The AI handles this customer type well. Use these successful patterns as a model for improving other persona types.</li>`);
  }

  if (recs.length === 0) {
    recs.push(`<li><span class="priority low">[LOW]</span> <strong>Performance looks good across all metrics</strong>. No critical issues identified. Continue monitoring and look for incremental improvements.</li>`);
  }

  return recs.map((r) => `    ${r}`).join("\n");
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

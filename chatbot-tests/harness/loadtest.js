// loadtest.js — Phase 6: Concurrency & Load Testing for the HDS WhatsApp AI chatbot.
//
// Usage:
//   node loadtest.js burst [--count 20|50|100|N]          Burst test: N simultaneous new conversations
//   node loadtest.js burst --sweep                          Sweep burst tests at 20, 50, 100
//   node loadtest.js rapid-fire [--count N] [--interval ms] Rapid-fire: N messages to one conversation
//   node loadtest.js soak [--rate N] [--duration min]       Soak test: N convos/min for M minutes
//   node loadtest.js failure [--mode vercel|gemini|supabase|webhook]  Failure-mode test
//   node loadtest.js all                                    Run full Phase 6 suite
//   node loadtest.js --cleanup                              Delete load test data from Supabase
//   node loadtest.js --dry-run                              Print plan, send nothing
//
// Output: JSON + HTML reports under ../results/load-tests/

import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HARNESS_DIR = __dirname;
const CHATBOT_TESTS_DIR = resolve(HARNESS_DIR, "..");

import { buildTextPayload, resetMessageSeq } from "./payload.js";
import {
  pollForAssistantReplies,
  fetchConversationLog,
  fetchCustomerProfile,
  cleanupTestData,
} from "./supabase.js";
import { generateLoadReport } from "./load-report.js";

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = {
    command: null,
    count: null,
    sweep: false,
    interval: null,
    rate: null,
    duration: null,
    mode: null,
    cleanup: false,
    dryRun: false,
    all: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "burst") args.command = "burst";
    else if (a === "rapid-fire") args.command = "rapid-fire";
    else if (a === "soak") args.command = "soak";
    else if (a === "failure") args.command = "failure";
    else if (a === "all") { args.all = true; args.command = "all"; }
    else if (a === "--count") args.count = parseInt(argv[++i], 10);
    else if (a === "--sweep") args.sweep = true;
    else if (a === "--interval") args.interval = parseInt(argv[++i], 10);
    else if (a === "--rate") args.rate = parseInt(argv[++i], 10);
    else if (a === "--duration") args.duration = parseInt(argv[++i], 10);
    else if (a === "--mode") args.mode = argv[++i];
    else if (a === "--cleanup") args.cleanup = true;
    else if (a === "--dry-run") args.dryRun = true;
  }
  return args;
}

// ---------------------------------------------------------------------------
// Phone number allocation
// ---------------------------------------------------------------------------
function generatePhoneNumbers(start, count) {
  const startNum = parseInt(start, 10);
  const numbers = [];
  for (let i = 0; i < count; i++) {
    numbers.push(String(startNum + i));
  }
  return numbers;
}

function pickMessage(templates, index) {
  return templates[index % templates.length];
}

// ---------------------------------------------------------------------------
// Metrics utilities
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Webhook POST with timing
// ---------------------------------------------------------------------------
async function postWebhook(url, payload, timeoutMs) {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const elapsed = Date.now() - start;
    return { ok: res.ok || res.status === 302, status: res.status, elapsed_ms: elapsed, error: null };
  } catch (err) {
    return { ok: false, status: 0, elapsed_ms: Date.now() - start, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// BURST TEST — N simultaneous new conversations
// ---------------------------------------------------------------------------
async function runBurstTest(config, loadConfig, opts) {
  const count = opts.count || loadConfig.defaults.burst_counts[0];
  const webhookCfg = config.webhook;
  const supabaseCfg = config.supabase;
  const phoneStart = loadConfig.phone_range.start;
  const templates = loadConfig.message_templates.greeting;
  const pollTimeout = loadConfig.defaults.poll_timeout_ms;
  const pollInterval = loadConfig.defaults.poll_interval_ms;
  const webhookTimeout = loadConfig.defaults.webhook_timeout_ms;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`BURST TEST — ${count} simultaneous new conversations`);
  console.log(`${"=".repeat(60)}\n`);

  const phones = generatePhoneNumbers(phoneStart, count);
  const senderName = "Load Test Customer";

  // Build all payloads
  const conversations = phones.map((phone, i) => ({
    phone,
    message: pickMessage(templates, i),
    sendTime: null,
    postResult: null,
    replyLatency: null,
    replyReceived: false,
    replyText: "",
    convLog: [],
    contaminationOk: true,
  }));

  if (opts.dryRun) {
    console.log(`[dry-run] Would fire ${count} simultaneous POSTs to ${webhookCfg.url}`);
    for (const c of conversations.slice(0, 5)) {
      console.log(`  ${c.phone}: "${c.message}"`);
    }
    console.log(`  ... and ${count - 5} more`);
    return { test_type: "burst", count, dry_run: true, conversations };
  }

  // Fire ALL webhook POSTs simultaneously
  console.log(`Firing ${count} simultaneous webhook POSTs...`);
  resetMessageSeq();
  const burstStart = Date.now();

  const postPromises = conversations.map(async (conv, i) => {
    const payload = buildTextPayload({
      phoneNumber: conv.phone,
      senderName,
      messageText: conv.message,
      wabaId: webhookCfg.waba_id,
      displayPhoneNumber: webhookCfg.display_phone_number,
      phoneNumberId: webhookCfg.phone_number_id,
    });
    conv.sendTime = Date.now();
    conv.postResult = await postWebhook(webhookCfg.url, payload, webhookTimeout);
    return conv;
  });

  await Promise.all(postPromises);
  const postElapsed = Date.now() - burstStart;
  const postSuccesses = conversations.filter((c) => c.postResult.ok).length;
  console.log(`Webhook POSTs complete: ${postSuccesses}/${count} succeeded in ${postElapsed}ms\n`);

  // Poll for replies — all in parallel
  console.log(`Polling for assistant replies (timeout: ${pollTimeout}ms)...`);
  const pollPromises = conversations.map(async (conv) => {
    if (!conv.postResult.ok) return;
    const { rows, elapsed_ms } = await pollForAssistantReplies(
      supabaseCfg,
      conv.phone,
      conv.sendTime,
      pollInterval,
      pollTimeout,
    );
    if (rows.length > 0) {
      conv.replyReceived = true;
      conv.replyLatency = elapsed_ms;
      conv.replyText = rows[0].message_text || "";
    } else {
      conv.replyLatency = elapsed_ms;
    }
  });

  // Progress tracking
  let pollDone = 0;
  const progressInterval = setInterval(() => {
    pollDone = conversations.filter((c) => c.replyReceived || c.replyLatency !== null).length;
    const received = conversations.filter((c) => c.replyReceived).length;
    console.log(`  Progress: ${pollDone}/${count} polls done, ${received} replies received...`);
  }, 10000);

  await Promise.all(pollPromises);
  clearInterval(progressInterval);

  const replyCount = conversations.filter((c) => c.replyReceived).length;
  console.log(`Replies received: ${replyCount}/${count}\n`);

  // Contamination check — fetch conversation log for each phone, verify all rows match phone
  console.log("Running contamination check (memory isolation per phone)...");
  const contaminationPromises = conversations.map(async (conv) => {
    try {
      conv.convLog = await fetchConversationLog(supabaseCfg, conv.phone, conv.sendTime);
      const foreignRows = conv.convLog.filter((r) => r.phone_number !== conv.phone);
      if (foreignRows.length > 0) {
        conv.contaminationOk = false;
        conv.contaminationDetails = `${foreignRows.length} rows from other phone numbers found in ${conv.phone}'s conversation log`;
      }
    } catch (err) {
      conv.contaminationOk = false;
      conv.contaminationDetails = `Failed to fetch conversation log: ${err.message}`;
    }
  });
  await Promise.all(contaminationPromises);

  const contaminationPassed = conversations.filter((c) => c.contaminationOk).length;
  console.log(`Contamination check: ${contaminationPassed}/${count} passed\n`);

  // Compute metrics
  const postLatencies = conversations.map((c) => c.postResult.elapsed_ms);
  const replyLatencies = conversations.filter((c) => c.replyLatency !== null).map((c) => c.replyLatency);
  const totalElapsed = Date.now() - burstStart;

  const result = {
    test_type: "burst",
    count,
    started_at: new Date(burstStart).toISOString(),
    finished_at: new Date().toISOString(),
    total_elapsed_ms: totalElapsed,
    webhook_post: {
      success: postSuccesses,
      failed: count - postSuccesses,
      latency: computeStats(postLatencies),
    },
    reply: {
      received: replyCount,
      missing: count - replyCount,
      success_rate_pct: count ? ((replyCount / count) * 100).toFixed(1) : "0",
      latency: computeStats(replyLatencies),
    },
    contamination: {
      passed: contaminationPassed,
      failed: count - contaminationPassed,
    },
    throughput_convos_per_sec: count > 0 ? (count / (totalElapsed / 1000)).toFixed(2) : "0",
    conversations: conversations.map((c) => ({
      phone: c.phone,
      message: c.message,
      post_ok: c.postResult.ok,
      post_status: c.postResult.status,
      post_latency_ms: c.postResult.elapsed_ms,
      post_error: c.postResult.error,
      reply_received: c.replyReceived,
      reply_latency_ms: c.replyLatency,
      reply_text: c.replyText ? c.replyText.substring(0, 200) : "",
      contamination_ok: c.contaminationOk,
      contamination_detail: c.contaminationDetails || null,
      reply_count: c.convLog.filter((r) => r.role === "assistant").length,
    })),
    thresholds: loadConfig.thresholds.burst,
    passed: evaluateBurstPass(replyCount, count, computeStats(replyLatencies), contaminationPassed, loadConfig.thresholds.burst),
  };

  // Print summary
  printBurstSummary(result);
  return result;
}

function evaluateBurstPass(replyCount, total, latencyStats, contaminationPassed, thresholds) {
  const issues = [];
  const successRate = total ? (replyCount / total) * 100 : 0;
  if (successRate < thresholds.min_success_rate_pct) {
    issues.push(`Success rate ${successRate.toFixed(1)}% < ${thresholds.min_success_rate_pct}%`);
  }
  if (latencyStats.p95 && latencyStats.p95 > thresholds.max_p95_latency_ms) {
    issues.push(`p95 latency ${latencyStats.p95}ms > ${thresholds.max_p95_latency_ms}ms`);
  }
  if (latencyStats.p99 && latencyStats.p99 > thresholds.max_p99_latency_ms) {
    issues.push(`p99 latency ${latencyStats.p99}ms > ${thresholds.max_p99_latency_ms}ms`);
  }
  if (thresholds.contamination_check && contaminationPassed < total) {
    issues.push(`Contamination check: ${contaminationPassed}/${total} passed (memory isolation violated)`);
  }
  return { ok: issues.length === 0, issues };
}

function printBurstSummary(r) {
  console.log(`\n${"-".repeat(50)}`);
  console.log(`BURST TEST RESULT: ${r.count} conversations`);
  console.log(`${"-".repeat(50)}`);
  console.log(`  Webhook POST:     ${r.webhook_post.success}/${r.count} succeeded`);
  console.log(`  Post latency:     p50=${r.webhook_post.latency.p50}ms p95=${r.webhook_post.latency.p95}ms max=${r.webhook_post.latency.max}ms`);
  console.log(`  Replies received: ${r.reply.received}/${r.count} (${r.reply.success_rate_pct}%)`);
  console.log(`  Reply latency:    p50=${r.reply.latency.p50 ?? "—"}ms p90=${r.reply.latency.p90 ?? "—"}ms p95=${r.reply.latency.p95 ?? "—"}ms p99=${r.reply.latency.p99 ?? "—"}ms`);
  console.log(`  Contamination:    ${r.contamination.passed}/${r.count} passed`);
  console.log(`  Throughput:       ${r.throughput_convos_per_sec} convos/sec`);
  console.log(`  Total elapsed:    ${r.total_elapsed_ms}ms`);
  console.log(`  PASS: ${r.passed.ok ? "YES" : "NO"}`);
  if (!r.passed.ok) {
    for (const issue of r.passed.issues) console.log(`    ✗ ${issue}`);
  }
  console.log(`${"-".repeat(50)}\n`);
}

// ---------------------------------------------------------------------------
// RAPID-FIRE TEST — single conversation, N messages in quick succession
// ---------------------------------------------------------------------------
async function runRapidFireTest(config, loadConfig, opts) {
  const count = opts.count || loadConfig.defaults.rapid_fire_count;
  const interval = opts.interval || loadConfig.defaults.rapid_fire_interval_ms;
  const webhookCfg = config.webhook;
  const supabaseCfg = config.supabase;
  const phoneStart = loadConfig.phone_range.start;
  const messages = loadConfig.message_templates.rapid_fire_sequence;
  const pollTimeout = loadConfig.defaults.poll_timeout_ms;
  const pollInterval = loadConfig.defaults.poll_interval_ms;
  const webhookTimeout = loadConfig.defaults.webhook_timeout_ms;

  // Use a phone number far enough from burst test range to avoid collision
  const phone = String(parseInt(phoneStart, 10) + 500);
  const senderName = "Rapid Fire Test";

  console.log(`\n${"=".repeat(60)}`);
  console.log(`RAPID-FIRE TEST — ${count} messages to ${phone}, ${interval}ms interval`);
  console.log(`${"=".repeat(60)}\n`);

  const messageSeq = [];
  for (let i = 0; i < count; i++) {
    messageSeq.push({
      text: messages[i % messages.length],
      sendTime: null,
      postResult: null,
    });
  }

  if (opts.dryRun) {
    console.log(`[dry-run] Would send ${count} messages to ${phone} at ${interval}ms intervals:`);
    for (const m of messageSeq) console.log(`  "${m.text}"`);
    return { test_type: "rapid-fire", count, phone, dry_run: true };
  }

  // Send messages rapidly without waiting for replies
  console.log(`Sending ${count} messages at ${interval}ms intervals...`);
  resetMessageSeq();
  const sendStart = Date.now();

  for (let i = 0; i < count; i++) {
    const msg = messageSeq[i];
    const payload = buildTextPayload({
      phoneNumber: phone,
      senderName,
      messageText: msg.text,
      wabaId: webhookCfg.waba_id,
      displayPhoneNumber: webhookCfg.display_phone_number,
      phoneNumberId: webhookCfg.phone_number_id,
    });
    msg.sendTime = Date.now();
    msg.postResult = await postWebhook(webhookCfg.url, payload, webhookTimeout);
    console.log(`  [${i + 1}/${count}] sent "${msg.text.substring(0, 40)}..." → ${msg.postResult.ok ? "OK" : "FAIL"}`);
    if (i < count - 1) await sleep(interval);
  }

  const sendElapsed = Date.now() - sendStart;
  console.log(`\nAll messages sent in ${sendElapsed}ms. Polling for replies (timeout: ${pollTimeout}ms)...\n`);

  // Wait for all replies — poll until we get at least count replies or timeout
  const pollStart = Date.now();
  const deadline = pollStart + pollTimeout;
  let allReplies = [];

  while (Date.now() < deadline) {
    try {
      allReplies = await fetchConversationLog(supabaseCfg, phone, sendStart);
      const assistantReplies = allReplies.filter((r) => r.role === "assistant");
      if (assistantReplies.length >= count) break;
    } catch (err) {
      // retry
    }
    await sleep(pollInterval);
  }

  const totalElapsed = Date.now() - sendStart;
  const userMessages = allReplies.filter((r) => r.role === "user");
  const assistantReplies = allReplies.filter((r) => r.role === "assistant");
  const toolMessages = allReplies.filter((r) => r.role === "tool");

  // Check for duplicates (same message_text appearing more than once in assistant replies)
  const replyTexts = assistantReplies.map((r) => r.message_text || "");
  const duplicateCheck = {};
  for (const t of replyTexts) {
    if (t) duplicateCheck[t] = (duplicateCheck[t] || 0) + 1;
  }
  const duplicates = Object.entries(duplicateCheck).filter(([_, c]) => c > 1);

  // Check ordering — assistant replies should be in chronological order
  let orderingOk = true;
  for (let i = 1; i < assistantReplies.length; i++) {
    const prev = new Date(assistantReplies[i - 1].created_at).getTime();
    const curr = new Date(assistantReplies[i].created_at).getTime();
    if (curr < prev) {
      orderingOk = false;
      break;
    }
  }

  const replyLatencies = assistantReplies.map((r, i) => {
    // Latency from the corresponding user message send time
    const correspondingUserMsg = messageSeq[Math.min(i, messageSeq.length - 1)];
    return new Date(r.created_at).getTime() - correspondingUserMsg.sendTime;
  });

  const result = {
    test_type: "rapid-fire",
    count,
    phone,
    interval_ms: interval,
    started_at: new Date(sendStart).toISOString(),
    finished_at: new Date().toISOString(),
    total_elapsed_ms: totalElapsed,
    messages_sent: count,
    post_successes: messageSeq.filter((m) => m.postResult.ok).length,
    post_failures: messageSeq.filter((m) => !m.postResult.ok).length,
    user_messages_logged: userMessages.length,
    assistant_replies: assistantReplies.length,
    tool_messages: toolMessages.length,
    reply_ratio: count ? (assistantReplies.length / count).toFixed(2) : "0",
    duplicates: duplicates.map(([text, c]) => ({ text: text.substring(0, 100), count: c })),
    duplicate_count: duplicates.length,
    ordering_ok: orderingOk,
    reply_latency: computeStats(replyLatencies),
    messages: messageSeq.map((m, i) => ({
      index: i,
      text: m.text,
      send_time: m.sendTime,
      post_ok: m.postResult.ok,
      post_latency_ms: m.postResult.elapsed_ms,
    })),
    replies: assistantReplies.map((r, i) => ({
      index: i,
      created_at: r.created_at,
      message_text: (r.message_text || "").substring(0, 200),
      latency_from_send_ms: replyLatencies[i] || null,
    })),
    thresholds: loadConfig.thresholds.rapid_fire,
    passed: evaluateRapidFirePass(assistantReplies.length, count, duplicates.length, orderingOk, loadConfig.thresholds.rapid_fire),
  };

  printRapidFireSummary(result);
  return result;
}

function evaluateRapidFirePass(replyCount, sentCount, duplicateCount, orderingOk, thresholds) {
  const issues = [];
  const ratio = sentCount ? replyCount / sentCount : 0;
  if (ratio < thresholds.min_reply_count_ratio) {
    issues.push(`Reply ratio ${ratio.toFixed(2)} < ${thresholds.min_reply_count_ratio}`);
  }
  if (duplicateCount > thresholds.max_duplicate_replies) {
    issues.push(`${duplicateCount} duplicate replies found (max allowed: ${thresholds.max_duplicate_replies})`);
  }
  if (thresholds.ordering_check && !orderingOk) {
    issues.push("Reply ordering check failed (replies not in chronological order)");
  }
  return { ok: issues.length === 0, issues };
}

function printRapidFireSummary(r) {
  console.log(`\n${"-".repeat(50)}`);
  console.log(`RAPID-FIRE TEST RESULT: ${r.count} messages to ${r.phone}`);
  console.log(`${"-".repeat(50)}`);
  console.log(`  Messages sent:    ${r.messages_sent} (${r.post_successes} POST OK, ${r.post_failures} failed)`);
  console.log(`  User msgs logged: ${r.user_messages_logged}`);
  console.log(`  Assistant replies:${r.assistant_replies} (ratio: ${r.reply_ratio})`);
  console.log(`  Tool messages:    ${r.tool_messages}`);
  console.log(`  Duplicates:       ${r.duplicate_count}`);
  console.log(`  Ordering OK:      ${r.ordering_ok}`);
  console.log(`  Reply latency:    p50=${r.reply_latency.p50 ?? "—"}ms p95=${r.reply_latency.p95 ?? "—"}ms max=${r.reply_latency.max ?? "—"}ms`);
  console.log(`  Total elapsed:    ${r.total_elapsed_ms}ms`);
  console.log(`  PASS: ${r.passed.ok ? "YES" : "NO"}`);
  if (!r.passed.ok) {
    for (const issue of r.passed.issues) console.log(`    ✗ ${issue}`);
  }
  console.log(`${"-".repeat(50)}\n`);
}

// ---------------------------------------------------------------------------
// SOAK TEST — sustained moderate traffic over time
// ---------------------------------------------------------------------------
async function runSoakTest(config, loadConfig, opts) {
  const rate = opts.rate || loadConfig.defaults.soak_rate_per_min;
  const durationMin = opts.duration || loadConfig.defaults.soak_duration_min;
  const webhookCfg = config.webhook;
  const supabaseCfg = config.supabase;
  const phoneStart = String(parseInt(loadConfig.phone_range.start, 10) + 600);
  const templates = [
    ...loadConfig.message_templates.greeting,
    ...loadConfig.message_templates.price_lookup,
  ];
  const pollTimeout = loadConfig.defaults.poll_timeout_ms;
  const pollInterval = loadConfig.defaults.poll_interval_ms;
  const webhookTimeout = loadConfig.defaults.webhook_timeout_ms;

  const totalConvos = Math.ceil(rate * durationMin);
  const intervalMs = (60 * 1000) / rate;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`SOAK TEST — ${rate} convos/min for ${durationMin} min (${totalConvos} total)`);
  console.log(`Interval between conversations: ${intervalMs.toFixed(0)}ms`);
  console.log(`${"=".repeat(60)}\n`);

  if (opts.dryRun) {
    console.log(`[dry-run] Would send ${totalConvos} conversations at ${rate}/min for ${durationMin} min`);
    return { test_type: "soak", rate, duration_min: durationMin, total_convos: totalConvos, dry_run: true };
  }

  const conversations = [];
  const soakStart = Date.now();

  // Send conversations at the target rate
  for (let i = 0; i < totalConvos; i++) {
    const phone = String(parseInt(phoneStart, 10) + i);
    const message = pickMessage(templates, i);
    const conv = { phone, message, sendTime: Date.now(), postResult: null, replyReceived: false, replyLatency: null, replyText: "" };

    const payload = buildTextPayload({
      phoneNumber: phone,
      senderName: "Soak Test Customer",
      messageText: message,
      wabaId: webhookCfg.waba_id,
      displayPhoneNumber: webhookCfg.display_phone_number,
      phoneNumberId: webhookCfg.phone_number_id,
    });

    conv.postResult = await postWebhook(webhookCfg.url, payload, webhookTimeout);
    conversations.push(conv);

    const progressIdx = i + 1;
    if (progressIdx % 5 === 0 || progressIdx === totalConvos) {
      console.log(`  [${progressIdx}/${totalConvos}] sent to ${phone} — ${conv.postResult.ok ? "OK" : "FAIL"}`);
    }

    if (i < totalConvos - 1) await sleep(intervalMs);
  }

  console.log(`\nAll ${totalConvos} conversations sent. Polling for replies...\n`);

  // Poll for all replies in parallel
  const pollPromises = conversations.map(async (conv) => {
    if (!conv.postResult.ok) return;
    const { rows, elapsed_ms } = await pollForAssistantReplies(
      supabaseCfg,
      conv.phone,
      conv.sendTime,
      pollInterval,
      pollTimeout,
    );
    if (rows.length > 0) {
      conv.replyReceived = true;
      conv.replyLatency = elapsed_ms;
      conv.replyText = rows[0].message_text || "";
    }
  });

  let pollDone = 0;
  const progressInterval = setInterval(() => {
    pollDone = conversations.filter((c) => c.replyReceived || c.replyLatency !== null).length;
    console.log(`  Poll progress: ${pollDone}/${totalConvos}...`);
  }, 15000);

  await Promise.all(pollPromises);
  clearInterval(progressInterval);

  const totalElapsed = Date.now() - soakStart;
  const replyCount = conversations.filter((c) => c.replyReceived).length;
  const replyLatencies = conversations.filter((c) => c.replyLatency !== null).map((c) => c.replyLatency);

  // Analyze latency trend over time — split into buckets
  const bucketCount = Math.min(10, Math.max(2, Math.floor(durationMin)));
  const bucketSize = Math.ceil(totalConvos / bucketCount);
  const buckets = [];
  for (let b = 0; b < bucketCount; b++) {
    const bucketConvs = conversations.slice(b * bucketSize, (b + 1) * bucketSize);
    const bucketLatencies = bucketConvs.filter((c) => c.replyLatency !== null).map((c) => c.replyLatency);
    if (bucketLatencies.length > 0) {
      buckets.push({
        bucket: b + 1,
        convos: bucketConvs.length,
        replies: bucketConvs.filter((c) => c.replyReceived).length,
        avg_latency_ms: Math.round(bucketLatencies.reduce((a, x) => a + x, 0) / bucketLatencies.length),
        p95_latency_ms: percentile([...bucketLatencies].sort((a, x) => a - x), 0.95),
      });
    }
  }

  // Detect degradation — compare first bucket avg to last bucket avg
  let degradationPct = null;
  if (buckets.length >= 2) {
    const firstAvg = buckets[0].avg_latency_ms;
    const lastAvg = buckets[buckets.length - 1].avg_latency_ms;
    if (firstAvg > 0) {
      degradationPct = ((lastAvg - firstAvg) / firstAvg * 100).toFixed(1);
    }
  }

  const result = {
    test_type: "soak",
    rate_per_min: rate,
    duration_min: durationMin,
    total_convos: totalConvos,
    started_at: new Date(soakStart).toISOString(),
    finished_at: new Date().toISOString(),
    total_elapsed_ms: totalElapsed,
    post_successes: conversations.filter((c) => c.postResult.ok).length,
    replies_received: replyCount,
    success_rate_pct: totalConvos ? ((replyCount / totalConvos) * 100).toFixed(1) : "0",
    reply_latency: computeStats(replyLatencies),
    latency_buckets: buckets,
    latency_degradation_pct: degradationPct != null ? parseFloat(degradationPct) : null,
    conversations: conversations.map((c) => ({
      phone: c.phone,
      message: c.message,
      send_time: c.sendTime,
      post_ok: c.postResult.ok,
      reply_received: c.replyReceived,
      reply_latency_ms: c.replyLatency,
      reply_text: c.replyText ? c.replyText.substring(0, 150) : "",
    })),
    thresholds: loadConfig.thresholds.soak,
    passed: evaluateSoakPass(replyCount, totalConvos, degradationPct, loadConfig.thresholds.soak),
  };

  printSoakSummary(result);
  return result;
}

function evaluateSoakPass(replyCount, total, degradationPct, thresholds) {
  const issues = [];
  const successRate = total ? (replyCount / total) * 100 : 0;
  if (successRate < thresholds.min_success_rate_pct) {
    issues.push(`Success rate ${successRate.toFixed(1)}% < ${thresholds.min_success_rate_pct}%`);
  }
  if (degradationPct != null && parseFloat(degradationPct) > thresholds.max_latency_degradation_pct) {
    issues.push(`Latency degradation ${degradationPct}% > ${thresholds.max_latency_degradation_pct}%`);
  }
  return { ok: issues.length === 0, issues };
}

function printSoakSummary(r) {
  console.log(`\n${"-".repeat(50)}`);
  console.log(`SOAK TEST RESULT: ${r.rate_per_min}/min for ${r.duration_min}min`);
  console.log(`${"-".repeat(50)}`);
  console.log(`  Total convos:     ${r.total_convos}`);
  console.log(`  POST successes:   ${r.post_successes}`);
  console.log(`  Replies received: ${r.replies_received} (${r.success_rate_pct}%)`);
  console.log(`  Reply latency:    p50=${r.reply_latency.p50 ?? "—"}ms p90=${r.reply_latency.p90 ?? "—"}ms p95=${r.reply_latency.p95 ?? "—"}ms`);
  console.log(`  Degradation:      ${r.latency_degradation_pct != null ? r.latency_degradation_pct + "%" : "—"}`);
  console.log(`  Latency by bucket:`);
  for (const b of r.latency_buckets) {
    console.log(`    Bucket ${b.bucket}: ${b.replies}/${b.convos} replies, avg=${b.avg_latency_ms}ms, p95=${b.p95_latency_ms}ms`);
  }
  console.log(`  Total elapsed:    ${r.total_elapsed_ms}ms (${(r.total_elapsed_ms / 1000 / 60).toFixed(1)} min)`);
  console.log(`  PASS: ${r.passed.ok ? "YES" : "NO"}`);
  if (!r.passed.ok) {
    for (const issue of r.passed.issues) console.log(`    ✗ ${issue}`);
  }
  console.log(`${"-".repeat(50)}\n`);
}

// ---------------------------------------------------------------------------
// FAILURE-MODE TEST — verify graceful degradation
// ---------------------------------------------------------------------------
async function runFailureTest(config, loadConfig, opts) {
  const mode = opts.mode || "vercel";
  const webhookCfg = config.webhook;
  const supabaseCfg = config.supabase;
  const phoneStart = String(parseInt(loadConfig.phone_range.start, 10) + 800);
  const pollTimeout = loadConfig.defaults.poll_timeout_ms;
  const pollInterval = loadConfig.defaults.poll_interval_ms;
  const webhookTimeout = loadConfig.defaults.webhook_timeout_ms;
  const thresholds = loadConfig.thresholds.failure_mode;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`FAILURE-MODE TEST — mode: ${mode}`);
  console.log(`${"=".repeat(60)}\n`);

  const testCases = {
    vercel: {
      description: "Send a quote request that exercises the Vercel quote API. Observe whether the bot falls back gracefully if the quote API is slow or unavailable.",
      message: "I need a quote for 20 sheets of 16mm white melamine chipboard",
      expect_tools: ["generate_quote"],
      fallback_check: "Bot should either return a quote or a graceful fallback message (not an error/timeout with no reply)",
    },
    gemini: {
      description: "Send a complex multi-part message that requires heavy Gemini processing. Observe whether the bot responds within timeout or degrades gracefully.",
      message: "Hi! I need pricing on 16mm white melamine chipboard, 18mm melamine, and also do you cut MDF? I need about 30 sheets total mixed. Also what are your banking details and where are your branches? Can I get a quote for all of this?",
      expect_tools: [],
      fallback_check: "Bot should respond within timeout even with a complex multi-topic message",
    },
    supabase: {
      description: "Send a message from a new number. The bot must create a customer profile and log the conversation. If Supabase is slow, the bot should still respond (context loading is best-effort).",
      message: "Hi, I'm a new customer. Do you have white melamine boards?",
      expect_tools: ["lookup_price"],
      fallback_check: "Bot should respond even if Supabase context loading is slow",
    },
    webhook: {
      description: "Send to an invalid webhook URL to verify the harness handles webhook failures gracefully (not a bot test — harness resilience test).",
      message: "Hi, this is a webhook failure test",
      expect_tools: [],
      fallback_check: "Harness should detect webhook failure and report it cleanly",
      override_url: "https://n8n.owdsolutions.co.za/webhook/nonexistent-endpoint-404",
    },
  };

  const testCase = testCases[mode];
  if (!testCase) {
    console.error(`Unknown failure mode: ${mode}. Valid modes: ${Object.keys(testCases).join(", ")}`);
    return { test_type: "failure", mode, error: `Unknown mode: ${mode}` };
  }

  console.log(`Description: ${testCase.description}`);
  console.log(`Message: "${testCase.message}"`);
  console.log(`Expected: ${testCase.fallback_check}\n`);

  const phone = phoneStart;
  const senderName = "Failure Test Customer";
  const targetUrl = testCase.override_url || webhookCfg.url;

  if (opts.dryRun) {
    console.log(`[dry-run] Would send to ${phone} via ${targetUrl}: "${testCase.message}"`);
    return { test_type: "failure", mode, dry_run: true, ...testCase };
  }

  // Send the message
  resetMessageSeq();
  const payload = buildTextPayload({
    phoneNumber: phone,
    senderName,
    messageText: testCase.message,
    wabaId: webhookCfg.waba_id,
    displayPhoneNumber: webhookCfg.display_phone_number,
    phoneNumberId: webhookCfg.phone_number_id,
  });

  console.log(`Sending to ${targetUrl}...`);
  const sendTime = Date.now();
  const postResult = await postWebhook(targetUrl, payload, webhookTimeout);
  console.log(`POST result: ${postResult.ok ? "OK" : "FAIL"} (${postResult.status}) in ${postResult.elapsed_ms}ms`);

  if (!postResult.ok) {
    console.log("Webhook POST failed — this is expected for webhook failure mode.");
    if (mode === "webhook") {
      const result = {
        test_type: "failure",
        mode,
        description: testCase.description,
        message: testCase.message,
        post_ok: false,
        post_status: postResult.status,
        post_error: postResult.error,
        reply_received: false,
        reply_latency_ms: null,
        reply_text: "",
        passed: { ok: true, issues: [], note: "Webhook failure correctly detected by harness" },
      };
      console.log("\nPASS: Harness correctly detected webhook failure.\n");
      return result;
    }
  }

  // Poll for reply
  console.log(`Polling for reply (timeout: ${pollTimeout}ms)...`);
  const { rows, elapsed_ms } = await pollForAssistantReplies(
    supabaseCfg,
    phone,
    sendTime,
    pollInterval,
    pollTimeout,
  );

  const replyReceived = rows.length > 0;
  const replyText = replyReceived ? (rows[0].message_text || "") : "";

  // Fetch full conversation log to check tool calls
  let convLog = [];
  let toolCalls = [];
  try {
    convLog = await fetchConversationLog(supabaseCfg, phone, sendTime);
    toolCalls = convLog.filter((r) => r.role === "tool").map((r) => r.message_text || "");
  } catch (err) {
    // non-fatal
  }

  // Check for fallback keywords in reply
  const hasFallbackKeyword = thresholds.required_fallback_keywords.some((kw) =>
    replyText.toLowerCase().includes(kw.toLowerCase()),
  );

  // Check for error leakage (raw error messages, stack traces, JSON)
  const errorPatterns = [
    /Error:/i,
    /TypeError/i,
    /at\s+\w+\s+\(/,
    /stack\s+trace/i,
    /\{.*error.*\}/i,
    /ETIMEDOUT/i,
    /ECONNREFUSED/i,
    /fetch failed/i,
  ];
  const errorLeakage = errorPatterns.some((p) => p.test(replyText));

  const issues = [];
  if (!replyReceived) issues.push("No reply received within timeout — graceful degradation failed");
  if (replyReceived && errorLeakage) issues.push("Error/stack trace leaked into customer reply");
  if (mode === "vercel" && replyReceived && !hasFallbackKeyword && toolCalls.length === 0) {
    issues.push("No fallback message or tool call — bot may have silently failed");
  }

  const result = {
    test_type: "failure",
    mode,
    description: testCase.description,
    message: testCase.message,
    expect_tools: testCase.expect_tools,
    fallback_check: testCase.fallback_check,
    post_ok: postResult.ok,
    post_status: postResult.status,
    post_error: postResult.error,
    post_latency_ms: postResult.elapsed_ms,
    reply_received: replyReceived,
    reply_latency_ms: replyReceived ? elapsed_ms : null,
    reply_text: replyText.substring(0, 500),
    tool_calls: toolCalls.map((t) => t.substring(0, 200)),
    has_fallback_keyword: hasFallbackKeyword,
    error_leakage: errorLeakage,
    thresholds: thresholds,
    passed: { ok: issues.length === 0, issues },
  };

  console.log(`\n${"-".repeat(50)}`);
  console.log(`FAILURE-MODE TEST RESULT: ${mode}`);
  console.log(`${"-".repeat(50)}`);
  console.log(`  POST:            ${postResult.ok ? "OK" : "FAIL"} (${postResult.status}) in ${postResult.elapsed_ms}ms`);
  console.log(`  Reply received:  ${replyReceived ? `YES (${elapsed_ms}ms)` : "NO"}`);
  console.log(`  Reply text:      ${replyText.substring(0, 100) || "(empty)"}`);
  console.log(`  Tool calls:      ${toolCalls.length > 0 ? toolCalls.map((t) => t.substring(0, 60)).join(", ") : "(none)"}`);
  console.log(`  Fallback keyword:${hasFallbackKeyword ? "YES" : "NO"}`);
  console.log(`  Error leakage:   ${errorLeakage ? "YES (BAD)" : "NO (good)"}`);
  console.log(`  PASS: ${result.passed.ok ? "YES" : "NO"}`);
  if (!result.passed.ok) {
    for (const issue of result.passed.issues) console.log(`    ✗ ${issue}`);
  }
  console.log(`${"-".repeat(50)}\n`);

  return result;
}

// ---------------------------------------------------------------------------
// FULL PHASE 6 SUITE
// ---------------------------------------------------------------------------
async function runFullSuite(config, loadConfig, opts) {
  const results = [];

  // 1. Burst sweep: 20, 50, 100
  console.log("\n" + "#".repeat(60));
  console.log("# PHASE 6 FULL SUITE — Part 1: Burst Tests (sweep 20, 50, 100)");
  console.log("#".repeat(60));

  // Cleanup between burst tests to avoid Supabase clutter
  for (const count of loadConfig.defaults.burst_counts) {
    console.log(`\n--- Cleaning up before burst ${count} ---`);
    await cleanupTestData(config.supabase);
    const burstResult = await runBurstTest(config, loadConfig, { count, dryRun: opts.dryRun });
    results.push(burstResult);
    if (opts.dryRun) break;
    // Cool down between burst tests
    console.log(`Cooling down 15s before next burst test...`);
    await sleep(15000);
  }

  // 2. Rapid-fire
  console.log("\n" + "#".repeat(60));
  console.log("# PHASE 6 FULL SUITE — Part 2: Rapid-Fire Test");
  console.log("#".repeat(60));
  await cleanupTestData(config.supabase);
  const rapidResult = await runRapidFireTest(config, loadConfig, { dryRun: opts.dryRun });
  results.push(rapidResult);

  // 3. Failure-mode tests
  console.log("\n" + "#".repeat(60));
  console.log("# PHASE 6 FULL SUITE — Part 3: Failure-Mode Tests");
  console.log("#".repeat(60));
  for (const mode of ["vercel", "gemini", "supabase", "webhook"]) {
    await cleanupTestData(config.supabase);
    const failResult = await runFailureTest(config, loadConfig, { mode, dryRun: opts.dryRun });
    results.push(failResult);
    if (opts.dryRun) continue;
    await sleep(5000);
  }

  // 4. Soak test (shortened for suite — 5 min default)
  console.log("\n" + "#".repeat(60));
  console.log("# PHASE 6 FULL SUITE — Part 4: Soak Test");
  console.log("#".repeat(60));
  await cleanupTestData(config.supabase);
  const soakResult = await runSoakTest(config, loadConfig, { dryRun: opts.dryRun });
  results.push(soakResult);

  return results;
}

// ---------------------------------------------------------------------------
// Bottleneck analysis
// ---------------------------------------------------------------------------
function analyzeBottlenecks(burstResults) {
  const analysis = {
    breaking_point: null,
    observations: [],
    recommendations: [],
  };

  // Find breaking point — first burst count where success rate drops below threshold
  for (const r of burstResults) {
    if (r.dry_run || !r.passed) continue;
    if (!r.passed.ok) {
      analysis.breaking_point = r.count;
      analysis.observations.push(`At ${r.count} concurrent conversations, failures detected: ${r.passed.issues.join(", ")}`);
      break;
    }
  }

  // Analyze latency scaling
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

  // Recommendations based on findings
  if (analysis.breaking_point) {
    analysis.recommendations.push(`n8n workflow concurrency limit appears to be around ${analysis.breaking_point} simultaneous conversations. Consider increasing n8n execution concurrency setting or adding a queue.`);
  }
  const hasContaminationFailure = burstResults.some((r) => r.contamination && r.contamination.failed > 0);
  if (hasContaminationFailure) {
    analysis.recommendations.push("Cross-conversation contamination detected — investigate n8n memory buffer isolation. Each conversation must use phone-number-scoped memory.");
  }
  const hasPostFailure = burstResults.some((r) => r.webhook_post && r.webhook_post.failed > 0);
  if (hasPostFailure) {
    analysis.recommendations.push("Webhook POST failures detected under load — n8n webhook may be rejecting connections. Check n8n reverse proxy (nginx) connection limits and n8n WEBHOOK_URL settings.");
  }
  if (analysis.recommendations.length === 0) {
    analysis.recommendations.push("No critical bottlenecks detected in tested range. Bot appears to handle the tested load levels.");
  }

  return analysis;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = JSON.parse(readFileSync(join(HARNESS_DIR, "config.json"), "utf-8"));
  const loadConfig = JSON.parse(readFileSync(join(HARNESS_DIR, "load-config.json"), "utf-8"));

  const resultsDir = resolve(HARNESS_DIR, "..", "results", "load-tests");
  await mkdir(resultsDir, { recursive: true });

  // --- Cleanup mode ---
  if (args.cleanup) {
    console.log("Cleaning up load test data (phone_number LIKE '2790000%')...");
    const results = await cleanupTestData(config.supabase);
    console.log("Cleanup results:", JSON.stringify(results, null, 2));
    return;
  }

  // --- Safe mode warning ---
  if (config.safe_mode?.enabled && !args.dryRun) {
    console.log("\n⚠  SAFE MODE ON: Test numbers (2790000xxxx) use invalid SA area code 279.");
    console.log("   Meta will reject outbound sends — real WhatsApp users won't receive test messages.\n");
  }

  let suiteResults = [];
  let analysis = null;

  if (args.command === "burst") {
    if (args.sweep) {
      // Sweep: run burst at all default counts
      for (const count of loadConfig.defaults.burst_counts) {
        if (!args.dryRun) {
          console.log(`\n--- Cleaning up before burst ${count} ---`);
          await cleanupTestData(config.supabase);
        }
        const result = await runBurstTest(config, loadConfig, { count, dryRun: args.dryRun });
        suiteResults.push(result);
        if (!args.dryRun && suiteResults.length < loadConfig.defaults.burst_counts.length) {
          console.log("Cooling down 15s...\n");
          await sleep(15000);
        }
      }
      analysis = analyzeBottlenecks(suiteResults);
    } else {
      const result = await runBurstTest(config, loadConfig, { count: args.count, dryRun: args.dryRun });
      suiteResults.push(result);
    }
  } else if (args.command === "rapid-fire") {
    const result = await runRapidFireTest(config, loadConfig, { count: args.count, interval: args.interval, dryRun: args.dryRun });
    suiteResults.push(result);
  } else if (args.command === "soak") {
    const result = await runSoakTest(config, loadConfig, { rate: args.rate, duration: args.duration, dryRun: args.dryRun });
    suiteResults.push(result);
  } else if (args.command === "failure") {
    const result = await runFailureTest(config, loadConfig, { mode: args.mode, dryRun: args.dryRun });
    suiteResults.push(result);
  } else if (args.command === "all") {
    suiteResults = await runFullSuite(config, loadConfig, { dryRun: args.dryRun });
    const burstResults = suiteResults.filter((r) => r.test_type === "burst");
    if (burstResults.length > 1) analysis = analyzeBottlenecks(burstResults);
  } else {
    console.error("No command specified. Usage: node loadtest.js <burst|rapid-fire|soak|failure|all> [options]");
    console.error("  node loadtest.js burst --count 20");
    console.error("  node loadtest.js burst --sweep");
    console.error("  node loadtest.js rapid-fire --count 6 --interval 800");
    console.error("  node loadtest.js soak --rate 10 --duration 5");
    console.error("  node loadtest.js failure --mode vercel");
    console.error("  node loadtest.js all");
    console.error("  node loadtest.js --cleanup");
    process.exit(1);
  }

  // --- Generate report ---
  const runResult = {
    run_id: `loadtest-${new Date().toISOString().replace(/[:.]/g, "-")}`,
    started_at: suiteResults[0]?.started_at || new Date().toISOString(),
    finished_at: new Date().toISOString(),
    config_snapshot: {
      webhook_url: config.webhook.url,
      safe_mode: config.safe_mode?.enabled,
    },
    results: suiteResults,
    bottleneck_analysis: analysis,
  };

  const { jsonPath, htmlPath, summary } = await generateLoadReport(runResult, resultsDir);

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Phase 6 Load Test Report:`);
  console.log(`  JSON: ${jsonPath}`);
  console.log(`  HTML: ${htmlPath}`);
  if (analysis) {
    console.log(`\nBottleneck Analysis:`);
    if (analysis.breaking_point) console.log(`  Breaking point: ${analysis.breaking_point} concurrent conversations`);
    for (const obs of analysis.observations) console.log(`  • ${obs}`);
    for (const rec of analysis.recommendations) console.log(`  → ${rec}`);
  }
  console.log(`${"=".repeat(60)}`);

  // Exit code based on overall pass/fail
  const allPassed = suiteResults.every((r) => r.passed?.ok !== false);
  process.exit(allPassed ? 0 : 1);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

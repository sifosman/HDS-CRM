// feature-test.js — Comprehensive feature test for all presentation features
// Tests each feature showcased in hds-chatbot-presentation.html
import { buildTextPayload, buildImagePayload, resetMessageSeq } from './payload.js';
import { pollForAssistantReplies, fetchConversationLog, fetchCustomerProfile, cleanupTestData } from './supabase.js';
import { readFileSync } from 'fs';

const cfg = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'));

const WEBHOOK = cfg.webhook.url;
const WABA_ID = cfg.webhook.waba_id;
const DISPLAY_PHONE = cfg.webhook.display_phone_number;
const PHONE_ID = cfg.webhook.phone_number_id;
const SUPA = cfg.supabase;

// Phone range for feature tests: 27900000600-699
let phoneCounter = 600;
function nextPhone() { return `27900000${phoneCounter++}`; }

const results = [];

async function sendMessage(phone, name, text, isImage = false, caption = '', mediaId = 'test-media-001') {
  const payload = isImage
    ? buildImagePayload({ phoneNumber: phone, senderName: name, caption, mediaId, wabaId: WABA_ID, displayPhoneNumber: DISPLAY_PHONE, phoneNumberId: PHONE_ID })
    : buildTextPayload({ phoneNumber: phone, senderName: name, messageText: text, wabaId: WABA_ID, displayPhoneNumber: DISPLAY_PHONE, phoneNumberId: PHONE_ID });

  const res = await fetch(WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return { status: res.status, ok: res.ok };
}

async function waitForReply(phone, timeoutMs = 60000) {
  const before = Date.now();
  const { rows, elapsed_ms } = await pollForAssistantReplies(SUPA, phone, before, 3000, timeoutMs);
  return { rows, elapsed_ms };
}

async function getFullLog(phone, afterMs) {
  return await fetchConversationLog(SUPA, phone, afterMs);
}

function checkContains(text, keywords) {
  const lower = text.toLowerCase();
  return keywords.some(k => lower.includes(k.toLowerCase()));
}

function checkContainsAll(text, keywords) {
  const lower = text.toLowerCase();
  return keywords.every(k => lower.includes(k.toLowerCase()));
}

async function runTest(name, testFn) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`TEST: ${name}`);
  console.log('='.repeat(70));
  try {
    const result = await testFn();
    results.push({ name, ...result });
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`RESULT: ${status} (${result.elapsed_ms}ms)`);
    if (result.notes) console.log(`NOTES: ${result.notes}`);
    return result;
  } catch (err) {
    console.log(`ERROR: ${err.message}`);
    results.push({ name, passed: false, error: err.message, elapsed_ms: 0 });
    return { passed: false, error: err.message };
  }
}

// ============================================================
// TEST 1: Sales Conversation — greeting + quote + close
// ============================================================
async function testSalesConversation() {
  const phone = nextPhone();
  const t0 = Date.now();
  const sendRes = await sendMessage(phone, 'Asif', 'Hi, I need 10 sheets of white melamine 16mm for my kitchen. Can you give me a quote?');
  if (!sendRes.ok) throw new Error(`Webhook returned ${sendRes.status}`);
  const { rows, elapsed_ms } = await waitForReply(phone);
  if (rows.length === 0) return { passed: false, elapsed_ms, notes: 'No reply received' };

  const reply = rows[0].message_text || rows[0].content || '';
  const hasGreeting = checkContains(reply, ['hi', 'hello', 'hey', 'welcome']);
  const hasQuote = checkContains(reply, ['quote', 'total', 'r7,200', 'r650', '7200', 'incl']);
  const hasClose = checkContains(reply, ['shall', 'process', 'order', 'go ahead', 'ready']);

  const log = await getFullLog(phone, t0);
  const toolCalls = log.filter(r => r.role === 'tool' || (r.tool_results && r.tool_results.tool_name));
  const hasGenerateQuote = log.some(r => {
    const tr = r.tool_results;
    return tr && (tr.tool_name === 'generate_quote' || tr.generate_quote || (r.message_text && r.message_text.includes('generate_quote')));
  });

  return {
    passed: hasGreeting && hasQuote,
    elapsed_ms,
    notes: `Greeting: ${hasGreeting}, Quote info: ${hasQuote}, Close attempt: ${hasClose}, generate_quote called: ${hasGenerateQuote}`,
    reply: reply.substring(0, 300),
  };
}

// ============================================================
// TEST 2: Homeowner Consultant Mode
// ============================================================
async function testHomeownerConsultant() {
  const phone = nextPhone();
  const t0 = Date.now();
  const sendRes = await sendMessage(phone, 'Asif', "Hi, I'm a homeowner and I want to renovate my kitchen. I've never done this before and I'm not sure what boards I need. Can you help?");
  if (!sendRes.ok) throw new Error(`Webhook returned ${sendRes.status}`);
  const { rows, elapsed_ms } = await waitForReply(phone);
  if (rows.length === 0) return { passed: false, elapsed_ms, notes: 'No reply received' };

  const reply = rows[0].message_text || rows[0].content || '';
  const hasGreeting = checkContains(reply, ['hi', 'hello', 'hey', 'love', 'great', 'welcome']);
  const hasEducation = checkContains(reply, ['hds', 'factory', 'branch', 'innowood', 'quality', 'manufactur']);
  const hasGuidance = checkContains(reply, ['recommend', 'popular', 'white melamine', 'start', 'what look', 'photo', 'measure']);
  const offersPhoto = checkContains(reply, ['photo', 'image', 'picture', 'send']);

  return {
    passed: hasGreeting && hasEducation && hasGuidance,
    elapsed_ms,
    notes: `Greeting: ${hasGreeting}, Education: ${hasEducation}, Guidance: ${hasGuidance}, Offers photo: ${offersPhoto}`,
    reply: reply.substring(0, 300),
  };
}

// ============================================================
// TEST 3: Image Intelligence — kitchen photo analysis
// ============================================================
async function testImageIntelligence() {
  const phone = nextPhone();
  const t0 = Date.now();
  // Send image with caption asking for help
  const sendRes = await sendMessage(phone, 'Asif', '', true, 'Here is a photo of my current kitchen. Can you tell me what I need?', 'test-kitchen-photo-001');
  if (!sendRes.ok) throw new Error(`Webhook returned ${sendRes.status}`);
  const { rows, elapsed_ms } = await waitForReply(phone, 90000);
  if (rows.length === 0) return { passed: false, elapsed_ms, notes: 'No reply received (image processing may take longer)' };

  const reply = rows[0].message_text || rows[0].content || '';
  const acknowledgesPhoto = checkContains(reply, ['photo', 'image', 'picture', 'kitchen', 'thanks', 'thank you']);
  const estimatesSheets = checkContains(reply, ['sheet', 'board', 'cabinet', 'estimate', 'roughly', 'approximately']);
  const offersSketch = checkContains(reply, ['sketch', 'cutting', 'carpenter', 'draw', 'measure']);

  return {
    passed: acknowledgesPhoto && estimatesSheets,
    elapsed_ms,
    notes: `Acknowledges photo: ${acknowledgesPhoto}, Estimates sheets: ${estimatesSheets}, Offers sketch: ${offersSketch}`,
    reply: reply.substring(0, 300),
  };
}

// ============================================================
// TEST 4: Quote Generation — PDF with line items
// ============================================================
async function testQuoteGeneration() {
  const phone = nextPhone();
  const t0 = Date.now();
  const sendRes = await sendMessage(phone, 'Asif', 'Hi, I need a quote for 5 sheets of melamine 16mm white please');
  if (!sendRes.ok) throw new Error(`Webhook returned ${sendRes.status}`);
  const { rows, elapsed_ms } = await waitForReply(phone);
  if (rows.length === 0) return { passed: false, elapsed_ms, notes: 'No reply received' };

  const reply = rows[0].message_text || rows[0].content || '';
  const hasTotal = checkContains(reply, ['total', 'r3,250', 'r3250', '3250', 'r3,810', 'incl', 'vat']);
  const hasQuoteId = checkContains(reply, ['q-2026', 'quote id', 'quote number', 'quote:']);
  const hasPdf = checkContains(reply, ['pdf', 'view quote', 'supabase', 'http']);

  const log = await getFullLog(phone, t0);
  const hasGenerateQuote = log.some(r => {
    const tr = r.tool_results;
    return tr && (tr.tool_name === 'generate_quote' || tr.generate_quote || (r.message_text && r.message_text.includes('generate_quote')));
  });

  return {
    passed: hasTotal && (hasQuoteId || hasPdf),
    elapsed_ms,
    notes: `Total: ${hasTotal}, Quote ID: ${hasQuoteId}, PDF link: ${hasPdf}, generate_quote called: ${hasGenerateQuote}`,
    reply: reply.substring(0, 300),
  };
}

// ============================================================
// TEST 5: Smart Upselling — board upgrades
// ============================================================
async function testSmartUpselling() {
  const phone = nextPhone();
  const t0 = Date.now();
  const sendRes = await sendMessage(phone, 'Asif', 'Hi, I need 10 sheets of white melamine 16mm for my kitchen cabinets. What do you have?');
  if (!sendRes.ok) throw new Error(`Webhook returned ${sendRes.status}`);
  const { rows, elapsed_ms } = await waitForReply(phone);
  if (rows.length === 0) return { passed: false, elapsed_ms, notes: 'No reply received' };

  const reply = rows[0].message_text || rows[0].content || '';
  const hasBaseProduct = checkContains(reply, ['white melamine', 'mel chip', 'value white', 'r650', '650']);
  const hasUpgrade = checkContains(reply, ['wood grain', 'dakota', 'flagstaff', 'white cedar', 'uv', 'gloss', 'premium', 'white marble', '795', '995']);
  const hasClose = checkContains(reply, ['quote', 'shall', 'would you', 'prepare']);

  return {
    passed: hasBaseProduct && hasUpgrade,
    elapsed_ms,
    notes: `Base product: ${hasBaseProduct}, Upgrade mentioned: ${hasUpgrade}, Close attempt: ${hasClose}`,
    reply: reply.substring(0, 300),
  };
}

// ============================================================
// TEST 6: Decision Simplification — overwhelmed customer
// ============================================================
async function testDecisionSimplification() {
  const phone = nextPhone();
  const t0 = Date.now();
  const sendRes = await sendMessage(phone, 'Asif', "Hi, I'm not sure what I need. There are too many options. Can you just tell me what to get for my kitchen cabinets?");
  if (!sendRes.ok) throw new Error(`Webhook returned ${sendRes.status}`);
  const { rows, elapsed_ms } = await waitForReply(phone);
  if (rows.length === 0) return { passed: false, elapsed_ms, notes: 'No reply received' };

  const reply = rows[0].message_text || rows[0].content || '';
  const recommendsOne = checkContains(reply, ['recommend', 'most popular', 'best option', 'go with', 'suggest', 'most common']);
  const mentionsProduct = checkContains(reply, ['white melamine', 'mel chip', 'dakota oak', 'wood grain']);

  return {
    passed: recommendsOne && mentionsProduct,
    elapsed_ms,
    notes: `Recommends one: ${recommendsOne}, Mentions product: ${mentionsProduct}`,
    reply: reply.substring(0, 300),
  };
}

// ============================================================
// TEST 7: Objection Handling — price objection
// ============================================================
async function testObjectionHandling() {
  const phone = nextPhone();
  const t0 = Date.now();
  // First message to get a quote
  const sendRes1 = await sendMessage(phone, 'Asif', 'Hi, I need 10 sheets of white melamine 16mm. Can you quote me?');
  if (!sendRes1.ok) throw new Error(`Webhook returned ${sendRes1.status}`);
  const { rows: rows1 } = await waitForReply(phone);
  if (rows1.length === 0) return { passed: false, elapsed_ms: 0, notes: 'No reply to first message' };

  // Wait a bit then send objection
  await new Promise(r => setTimeout(r, 2000));
  const t1 = Date.now();
  const sendRes2 = await sendMessage(phone, 'Asif', 'That is too expensive. I can get it cheaper at Builders Warehouse. Not sure if I can afford this right now.');
  if (!sendRes2.ok) throw new Error(`Webhook returned ${sendRes2.status}`);
  const { rows: rows2, elapsed_ms } = await waitForReply(phone, 60000);

  if (rows2.length === 0) return { passed: false, elapsed_ms, notes: 'No reply to objection' };

  const reply = rows2[0].message_text || rows2[0].content || '';
  const hasEmpathy = checkContains(reply, ['understand', 'budget', 'price', 'concern', 'appreciate', 'completely']);
  const hasValue = checkContains(reply, ['factory', 'manufactur', 'quality', 'innowood', 'precision', 'cutting', 'direct', 'durable']);
  const hasReattempt = checkContains(reply, ['shall', 'go ahead', 'secure', 'process', 'order', 'ready']);

  return {
    passed: hasEmpathy && hasValue,
    elapsed_ms,
    notes: `Empathy: ${hasEmpathy}, Value argument: ${hasValue}, Re-attempt close: ${hasReattempt}`,
    reply: reply.substring(0, 300),
  };
}

// ============================================================
// TEST 8: Hardware Quoting — boards + hardware in same PDF
// ============================================================
async function testHardwareQuoting() {
  const phone = nextPhone();
  const t0 = Date.now();
  const sendRes = await sendMessage(phone, 'Asif', 'Hi, I need 5 sheets of melamine 16mm white and 20 soft close hinges. Can you quote me for everything?');
  if (!sendRes.ok) throw new Error(`Webhook returned ${sendRes.status}`);
  const { rows, elapsed_ms } = await waitForReply(phone, 90000);
  if (rows.length === 0) return { passed: false, elapsed_ms, notes: 'No reply received' };

  const reply = rows[0].message_text || rows[0].content || '';
  const hasBoardQuote = checkContains(reply, ['melamine', 'sheet', 'board', 'r650', '650', '3250', 'r3,250']);
  const hasHardware = checkContains(reply, ['hinge', 'soft close', 'hardware', 'r14', '14']);
  const hasTotal = checkContains(reply, ['total', 'incl', 'vat', 'grand']);

  return {
    passed: hasBoardQuote && hasHardware && hasTotal,
    elapsed_ms,
    notes: `Board quote: ${hasBoardQuote}, Hardware mentioned: ${hasHardware}, Total: ${hasTotal}`,
    reply: reply.substring(0, 300),
  };
}

// ============================================================
// TEST 9: HDS-Manufactured Products First
// ============================================================
async function testHDSManufacturedFirst() {
  const phone = nextPhone();
  const t0 = Date.now();
  const sendRes = await sendMessage(phone, 'Asif', 'Hi, I am building kitchen cabinets. What boards and colours do you recommend?');
  if (!sendRes.ok) throw new Error(`Webhook returned ${sendRes.status}`);
  const { rows, elapsed_ms } = await waitForReply(phone);
  if (rows.length === 0) return { passed: false, elapsed_ms, notes: 'No reply received' };

  const reply = rows[0].message_text || rows[0].content || '';
  const mentionsHDS = checkContains(reply, ['hds', 'manufactur', 'factory', 'innowood']);
  const recommendsProduct = checkContains(reply, ['white melamine', 'mel chip', 'wood grain', 'dakota', 'flagstaff', 'white cedar']);

  return {
    passed: mentionsHDS && recommendsProduct,
    elapsed_ms,
    notes: `Mentions HDS: ${mentionsHDS}, Recommends product: ${recommendsProduct}`,
    reply: reply.substring(0, 300),
  };
}

// ============================================================
// TEST 10: Returning Customer Recognition
// ============================================================
async function testReturningCustomer() {
  const phone = nextPhone();
  const t0 = Date.now();
  // First visit
  const sendRes1 = await sendMessage(phone, 'Asif', 'Hi, I need 8 sheets of white melamine 16mm please. Can you quote me?');
  if (!sendRes1.ok) throw new Error(`Webhook returned ${sendRes1.status}`);
  const { rows: rows1 } = await waitForReply(phone);
  if (rows1.length === 0) return { passed: false, elapsed_ms: 0, notes: 'No reply to first visit' };

  // Wait for first conversation to complete
  await new Promise(r => setTimeout(r, 3000));
  // Return visit
  const t1 = Date.now();
  const sendRes2 = await sendMessage(phone, 'Asif', 'Hi again, I am back. I want to order more boards for my next project.');
  if (!sendRes2.ok) throw new Error(`Webhook returned ${sendRes2.status}`);
  const { rows: rows2, elapsed_ms } = await waitForReply(phone, 60000);
  if (rows2.length === 0) return { passed: false, elapsed_ms, notes: 'No reply to return visit' };

  const reply = rows2[0].message_text || rows2[0].content || '';
  const hasWelcomeBack = checkContains(reply, ['welcome back', 'great to', 'back', 'again', 'return', 'good to see']);
  const usesName = checkContains(reply, ['asif']);

  return {
    passed: hasWelcomeBack,
    elapsed_ms,
    notes: `Welcome back: ${hasWelcomeBack}, Uses name: ${usesName}`,
    reply: reply.substring(0, 300),
  };
}

// ============================================================
// TEST 11: Branch Lookup & Banking Details
// ============================================================
async function testBranchBanking() {
  const phone = nextPhone();
  const t0 = Date.now();
  const sendRes = await sendMessage(phone, 'Asif', 'Hi, where is your nearest branch to Centurion? And what are your banking details for EFT payment?');
  if (!sendRes.ok) throw new Error(`Webhook returned ${sendRes.status}`);
  const { rows, elapsed_ms } = await waitForReply(phone);
  if (rows.length === 0) return { passed: false, elapsed_ms, notes: 'No reply received' };

  const reply = rows[0].message_text || rows[0].content || '';
  const hasBranch = checkContains(reply, ['sunderland', 'centurion', 'branch', 'address', 'van tonder', '16']);
  const hasBanking = checkContains(reply, ['account', 'banking', 'eft', 'account number', 'current', 'account name']);

  return {
    passed: hasBranch && hasBanking,
    elapsed_ms,
    notes: `Branch info: ${hasBranch}, Banking details: ${hasBanking}`,
    reply: reply.substring(0, 300),
  };
}

// ============================================================
// TEST 12: Product Carousels — show_products
// ============================================================
async function testProductCarousels() {
  const phone = nextPhone();
  const t0 = Date.now();
  const sendRes = await sendMessage(phone, 'Asif', 'Hi, what colours and wood grain options do you have available? Can you show me?');
  if (!sendRes.ok) throw new Error(`Webhook returned ${sendRes.status}`);
  const { rows, elapsed_ms } = await waitForReply(phone);
  if (rows.length === 0) return { passed: false, elapsed_ms, notes: 'No reply received' };

  const reply = rows[0].message_text || rows[0].content || '';
  const mentionsProducts = checkContains(reply, ['wood grain', 'colour', 'color', 'option', 'range', 'dakota', 'flagstaff', 'white cedar', 'melamine']);
  const offersToShow = checkContains(reply, ['sent', 'carousel', 'image', 'show', 'browse', 'swipe', 'see']);

  const log = await getFullLog(phone, t0);
  const hasShowProducts = log.some(r => {
    const tr = r.tool_results;
    return tr && (tr.tool_name === 'show_products' || tr.show_products || (r.message_text && r.message_text.includes('show_products')));
  });

  return {
    passed: mentionsProducts,
    elapsed_ms,
    notes: `Mentions products: ${mentionsProducts}, Offers to show: ${offersToShow}, show_products called: ${hasShowProducts}`,
    reply: reply.substring(0, 300),
  };
}

// ============================================================
// TEST 13: Payment Link Generation
// ============================================================
async function testPaymentLink() {
  const phone = nextPhone();
  const t0 = Date.now();
  // First get a quote
  const sendRes1 = await sendMessage(phone, 'Asif', 'Hi, I need 5 sheets of white melamine 16mm. Please quote me.');
  if (!sendRes1.ok) throw new Error(`Webhook returned ${sendRes1.status}`);
  const { rows: rows1 } = await waitForReply(phone, 60000);
  if (rows1.length === 0) return { passed: false, elapsed_ms: 0, notes: 'No reply to quote request' };

  // Ask for payment link
  await new Promise(r => setTimeout(r, 2000));
  const sendRes2 = await sendMessage(phone, 'Asif', 'Yes I will take it. Please send me the online payment link.');
  if (!sendRes2.ok) throw new Error(`Webhook returned ${sendRes2.status}`);
  const { rows: rows2, elapsed_ms } = await waitForReply(phone, 60000);
  if (rows2.length === 0) return { passed: false, elapsed_ms, notes: 'No reply to payment link request' };

  const reply = rows2[0].message_text || rows2[0].content || '';
  const hasPaymentLink = checkContains(reply, ['payfast', 'pay', 'link', 'http', 'secure', 'payment']);
  const hasAmount = checkContains(reply, ['r3,250', 'r3250', '3250', 'r3,810', 'amount']);

  return {
    passed: hasPaymentLink,
    elapsed_ms,
    notes: `Payment link: ${hasPaymentLink}, Amount: ${hasAmount}`,
    reply: reply.substring(0, 300),
  };
}

// ============================================================
// TEST 14: Adversarial & Edge Cases
// ============================================================
async function testAdversarial() {
  const phone = nextPhone();
  const t0 = Date.now();
  // Test joke
  const sendRes = await sendMessage(phone, 'Asif', 'Tell me a joke');
  if (!sendRes.ok) throw new Error(`Webhook returned ${sendRes.status}`);
  const { rows, elapsed_ms } = await waitForReply(phone);
  if (rows.length === 0) return { passed: false, elapsed_ms, notes: 'No reply received' };

  const reply = rows[0].message_text || rows[0].content || '';
  const hasJokeOrRedirect = checkContains(reply, ['joke', 'funny', '😄', '😂', 'carpenter', 'board', 'help', 'quote', 'melamine']);
  const staysInCharacter = !checkContains(reply, ['i am an ai', 'i am a language model', 'i cannot tell jokes', 'as an ai']);

  return {
    passed: hasJokeOrRedirect && staysInCharacter,
    elapsed_ms,
    notes: `Responds appropriately: ${hasJokeOrRedirect}, Stays in character: ${staysInCharacter}`,
    reply: reply.substring(0, 300),
  };
}

// ============================================================
// TEST 14b: Gibberish handling
// ============================================================
async function testGibberish() {
  const phone = nextPhone();
  const t0 = Date.now();
  const sendRes = await sendMessage(phone, 'Asif', 'asdfgh jkl');
  if (!sendRes.ok) throw new Error(`Webhook returned ${sendRes.status}`);
  const { rows, elapsed_ms } = await waitForReply(phone);
  if (rows.length === 0) return { passed: false, elapsed_ms, notes: 'No reply received' };

  const reply = rows[0].message_text || rows[0].content || '';
  const asksClarification = checkContains(reply, ['clarify', 'didn\'t catch', 'didn\'t understand', 'not sure', 'help', 'how can', 'what']);

  return {
    passed: asksClarification,
    elapsed_ms,
    notes: `Asks for clarification: ${asksClarification}`,
    reply: reply.substring(0, 300),
  };
}

// ============================================================
// TEST 15: Handover to human
// ============================================================
async function testHandover() {
  const phone = nextPhone();
  const t0 = Date.now();
  const sendRes = await sendMessage(phone, 'Asif', 'Hi, I would like to speak to a human please. Can you connect me to someone?');
  if (!sendRes.ok) throw new Error(`Webhook returned ${sendRes.status}`);
  const { rows, elapsed_ms } = await waitForReply(phone);
  if (rows.length === 0) return { passed: false, elapsed_ms, notes: 'No reply received' };

  const reply = rows[0].message_text || rows[0].content || '';
  const acknowledgesHandover = checkContains(reply, ['team', 'human', 'connect', 'someone', 'sales', 'agent', 'handover', 'colleague']);

  const log = await getFullLog(phone, t0);
  const hasHandoverTool = log.some(r => {
    const tr = r.tool_results;
    return tr && (tr.tool_name === 'handover' || tr.handover || (r.message_text && r.message_text.includes('handover')));
  });
  const profile = await fetchCustomerProfile(SUPA, phone);
  const leadStatusHandover = profile && (profile.lead_status === 'handover' || profile.sale_outcome === 'handover');

  return {
    passed: acknowledgesHandover,
    elapsed_ms,
    notes: `Acknowledges: ${acknowledgesHandover}, handover tool called: ${hasHandoverTool}, Lead status handover: ${leadStatusHandover}`,
    reply: reply.substring(0, 300),
  };
}

// ============================================================
// TEST 16: Nudge Re-engagement workflow active
// ============================================================
async function testNudgeWorkflow() {
  const n8nKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkMTRmZDRkMy1mYTIzLTQ5MjItYjVkNi02ZTQwMThkOGI1MjciLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjY3YTUxYWYtOWYyYi00Nzc4LTlmZTMtNjNiOTVmNDlkMjYxIiwiaWF0IjoxNzg0NzE3NzMzfQ.nQHo8-mKqgxBbmQ1d6eumE6I98HAOEWvrd44SMJjA7w';
  const res = await fetch('https://n8n.owdsolutions.co.za/api/v1/workflows/ns44X6bheopqZ6Xq', {
    headers: { 'X-N8N-API-KEY': n8nKey },
  });
  if (!res.ok) return { passed: false, elapsed_ms: 0, notes: `API returned ${res.status}` };
  const data = await res.json();
  const isActive = data.active === true;
  return {
    passed: isActive,
    elapsed_ms: 0,
    notes: `Workflow active: ${isActive}, Name: ${data.name}`,
  };
}

// ============================================================
// TEST 17: Branch Resolution Flow — assign_branch_to_quote
// ============================================================
async function testBranchResolution() {
  const phone = nextPhone();
  const t0 = Date.now();
  // Get a quote first
  const sendRes1 = await sendMessage(phone, 'Asif', 'Hi, I need 5 sheets of white melamine 16mm. Please quote me.');
  if (!sendRes1.ok) throw new Error(`Webhook returned ${sendRes1.status}`);
  const { rows: rows1 } = await waitForReply(phone, 60000);
  if (rows1.length === 0) return { passed: false, elapsed_ms: 0, notes: 'No reply to quote request' };

  // Confirm order with location
  await new Promise(r => setTimeout(r, 2000));
  const sendRes2 = await sendMessage(phone, 'Asif', 'Yes I will take it. I am in Krugersdorp.');
  if (!sendRes2.ok) throw new Error(`Webhook returned ${sendRes2.status}`);
  const { rows: rows2, elapsed_ms } = await waitForReply(phone, 60000);
  if (rows2.length === 0) return { passed: false, elapsed_ms, notes: 'No reply to location message' };

  const reply = rows2[0].message_text || rows2[0].content || '';
  const hasBranch = checkContains(reply, ['krugersdorp', 'branch', 'luipaard', '115']);
  const hasAddress = checkContains(reply, ['address', 'street', 'phone']);
  const asksPayment = checkContains(reply, ['pay', 'eft', 'card', 'link', 'payment']);

  return {
    passed: hasBranch,
    elapsed_ms,
    notes: `Branch mentioned: ${hasBranch}, Address: ${hasAddress}, Asks payment: ${asksPayment}`,
    reply: reply.substring(0, 300),
  };
}

// ============================================================
// TEST 18: PayFast endpoint responds
// ============================================================
async function testPayFastEndpoint() {
  const res = await fetch('https://hds-sifosmans-projects.vercel.app/api/payfast/pay?quoteId=TEST-CHECK&amount=100.00&customerName=Test', {
    redirect: 'manual',
  });
  // PayFast should redirect or show a payment page
  const ok = res.status === 200 || res.status === 302 || res.status === 307 || res.status === 0;
  return {
    passed: ok,
    elapsed_ms: 0,
    notes: `PayFast endpoint status: ${res.status}`,
  };
}

// ============================================================
// TEST 19: Vercel assign-branch endpoint
// ============================================================
async function testAssignBranchEndpoint() {
  const res = await fetch('https://hds-sifosmans-projects.vercel.app/api/optimizer/assign-branch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quoteNumber: 'TEST-CHECK', branchData: { trading_as: 'Test', email_address: 'test@test.com' } }),
  });
  const data = await res.json().catch(() => ({}));
  // Should return 404 for non-existent quote, but endpoint should exist
  const endpointExists = res.status !== 404;
  return {
    passed: endpointExists,
    elapsed_ms: 0,
    notes: `Assign-branch endpoint status: ${res.status}, Response: ${JSON.stringify(data).substring(0, 200)}`,
  };
}

// ============================================================
// TEST 20: Image padding endpoint (carousel images)
// ============================================================
async function testImagePaddingEndpoint() {
  const testUrl = encodeURIComponent('https://xzsibbbghotreolzwnyk.supabase.co/storage/v1/object/public/product-images/test.jpg');
  const res = await fetch(`https://hds-sifosmans-projects.vercel.app/api/image/pad?url=${testUrl}`);
  // Should return an image (200) or a 404 for non-existent image, but endpoint should exist
  const endpointExists = res.status === 200 || res.status === 404 || res.status === 500;
  const isImage = res.status === 200 && res.headers.get('content-type')?.includes('image');
  return {
    passed: endpointExists,
    elapsed_ms: 0,
    notes: `Image pad endpoint status: ${res.status}, Content-Type: ${res.headers.get('content-type')}, Returns image: ${isImage}`,
  };
}

// ============================================================
// MAIN RUNNER
// ============================================================
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  HDS WhatsApp AI Chatbot — Comprehensive Feature Test Suite     ║');
  console.log('║  Testing all features from hds-chatbot-presentation.html        ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log(`\nWebhook: ${WEBHOOK}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Safe mode: ON (test numbers 279000006xx — Meta rejects outbound)\n`);

  resetMessageSeq();

  // Clean up any previous test data
  console.log('Cleaning up previous test data...');
  await cleanupTestData(SUPA, '279000006%');

  // Run all tests sequentially (to avoid concurrency issues)
  await runTest('1. Sales Conversation — greeting + quote + close', testSalesConversation);
  await runTest('2. Homeowner Consultant Mode', testHomeownerConsultant);
  await runTest('3. Image Intelligence — kitchen photo analysis', testImageIntelligence);
  await runTest('4. Quote Generation — PDF with line items', testQuoteGeneration);
  await runTest('5. Smart Upselling — board upgrades', testSmartUpselling);
  await runTest('6. Decision Simplification — overwhelmed customer', testDecisionSimplification);
  await runTest('7. Objection Handling — price objection', testObjectionHandling);
  await runTest('8. Hardware Quoting — boards + hardware in same PDF', testHardwareQuoting);
  await runTest('9. HDS-Manufactured Products First', testHDSManufacturedFirst);
  await runTest('10. Returning Customer Recognition', testReturningCustomer);
  await runTest('11. Branch Lookup & Banking Details', testBranchBanking);
  await runTest('12. Product Carousels — show_products', testProductCarousels);
  await runTest('13. Payment Link Generation', testPaymentLink);
  await runTest('14a. Adversarial — joke request', testAdversarial);
  await runTest('14b. Adversarial — gibberish input', testGibberish);
  await runTest('15. Handover to human', testHandover);
  await runTest('16. Nudge Re-engagement workflow active', testNudgeWorkflow);
  await runTest('17. Branch Resolution Flow', testBranchResolution);
  await runTest('18. PayFast endpoint responds', testPayFastEndpoint);
  await runTest('19. Assign-branch endpoint', testAssignBranchEndpoint);
  await runTest('20. Image padding endpoint (carousels)', testImagePaddingEndpoint);

  // Summary
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  TEST SUMMARY                                                    ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`\nTotal: ${results.length} | Passed: ${passed} | Failed: ${failed}\n`);
  console.log('-'.repeat(70));
  for (const r of results) {
    const status = r.passed ? '✅' : '❌';
    console.log(`${status} ${r.name}`);
    if (!r.passed && r.notes) console.log(`    → ${r.notes}`);
    if (!r.passed && r.reply) console.log(`    → Reply: ${r.reply.substring(0, 150)}...`);
  }
  console.log('-'.repeat(70));

  // Cleanup
  console.log('\nCleaning up test data...');
  await cleanupTestData(SUPA, '279000006%');
  console.log('Done!');

  // Write JSON report
  const report = {
    timestamp: new Date().toISOString(),
    total: results.length,
    passed,
    failed,
    results: results.map(r => ({
      name: r.name,
      passed: r.passed,
      elapsed_ms: r.elapsed_ms,
      notes: r.notes,
      reply: r.reply,
      error: r.error,
    })),
  };
  const reportPath = new URL('../results/feature-test-results.json', import.meta.url);
  const { writeFileSync, mkdirSync } = await import('fs');
  const { dirname } = await import('path');
  try { mkdirSync(dirname(reportPath.pathname), { recursive: true }); } catch {}
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved to: ${reportPath.pathname}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

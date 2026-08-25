#!/usr/bin/env node
// Run a curated mix of 10 scenarios covering key categories
const { spawnSync } = require('child_process');
const scenarios = [
  'GR-001',  // greeting - easy
  'QG-001',  // quote generation - medium
  'SC-001',  // sales closing - medium
  'OH-001',  // objection handling - hard
  'HO-001',  // handover - medium
  'PL-001',  // price lookup - easy
  'BB-001',  // branch banking - easy
  'RC-001',  // returning customer - medium
  'HC-002',  // homeowner consultant - image service offer (new)
  'HC-004',  // confused customer - decision simplification (new)
];

// Run them all via a single runner invocation by filtering
const { run } = (() => {
  const results = [];
  for (const id of scenarios) {
    const r = spawnSync('node', ['runner.js', '--scenario', id, '--concurrency', '1'], {
      cwd: __dirname,
      encoding: 'utf8',
      timeout: 120000,
    });
    const out = r.stdout || '';
    const passLine = out.split('\n').find(l => l.includes('[PASS]') || l.includes('[FAIL]'));
    const resultLine = out.split('\n').find(l => l.includes('Results:'));
    console.log(passLine?.trim() || `  [ERROR] ${id} - no output`);
    results.push({ id, pass: passLine?.includes('[PASS]') });
  }
  const passed = results.filter(r => r.pass).length;
  console.log(`\n============================================================`);
  console.log(`Mixed Results: ${passed}/${results.length} passed (${(passed/results.length*100).toFixed(1)}%)`);
  console.log(`============================================================`);
})();

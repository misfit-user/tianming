#!/usr/bin/env node
// smoke-memory-read-contract.js - locks memory read compatibility paths.

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let assertions = 0;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
  assertions++;
}

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

const world = read('tm-world.js');
assert(/function _memText\(entry\)/.test(world), 'buildAIContext should normalize memory entry text');
assert(/typeof memoryEntryText === 'function'/.test(world), 'buildAIContext should delegate to shared memoryEntryText when available');
assert(/entry\.content \|\| entry\.text \|\| entry\.summary \|\| entry\.title/.test(world), '_memText should support compressed/content entries');
assert(/T' \+ f\.turn \+ ': ' \+ _memText\(f\)/.test(world), 'foreshadow context should use normalized memory text');
assert(/T' \+ m\.turn \+ ': ' \+ _memText\(m\)/.test(world), 'AI memory context should use normalized memory text');
assert(!/T' \+ f\.turn \+ ': ' \+ f\.text/.test(world), 'foreshadow context must not read only .text');
assert(!/T' \+ m\.turn \+ ': ' \+ m\.text/.test(world), 'AI memory context must not read only .text');

const mechanics = (read('tm-mechanics.js') + read('tm-mechanics-memory.js'));
assert(/recallMemory:\s*function\(query,\s*opts\)/.test(mechanics), 'NpcMemorySystem.recallMemory should exist');
assert(/recall:\s*function\(charName,\s*limit\)/.test(mechanics), 'NpcMemorySystem.recall compatibility alias should exist');
assert(/GM\._memoryArchiveFull/.test(mechanics), 'recall compatibility alias should read the full memory archive first');

const chaoyi = (read('tm-chaoyi-changchao-adapter.js') + read('tm-chaoyi-changchao.js') + read('tm-chaoyi-changchao-flows.js'));
assert(/NpcMemorySystem\.recall\b/.test(chaoyi), 'old chaoyi recall caller should remain covered by compatibility alias');

const infra = (read('tm-ai-infra-retry.js') + '\n' + read('tm-ai-infra.js'));
assert(/function memoryEntryText\(entry\)/.test(infra), 'shared memoryEntryText helper should exist');
assert(/function buildMemoryDiagnosticSnapshot\(G\)/.test(infra), 'memory diagnostic snapshot helper should exist');
assert(/function recordMemoryDiagnostic\(kind,\s*payload\)/.test(infra), 'memory diagnostic recorder should exist');
assert(/function openMemoryDiagnostics\(\)/.test(infra), 'memory diagnostics UI entry should exist');
assert(/d\.memory\.events/.test(infra), 'AI diagnostics ledger should store memory events');
assert(/_memoryDiagnosticsLog/.test(infra), 'memory diagnostics should retain a short cross-turn log');

const settings = read('tm-player-settings.js');
assert(/openMemoryDiagnostics/.test(settings), 'settings debug panel should expose memory diagnostics');

console.log('[smoke-memory-read-contract] PASS assertions=' + assertions);

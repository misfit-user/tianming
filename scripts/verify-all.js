#!/usr/bin/env node
// scripts/verify-all.js - run all local safety gates.
//
// Order:
//   syntax-check -> encoding-check -> ref-check -> find-orphans -> official-scenario-smoke
//   -> smoke-engine-phase0 -> smoke-office-dynastification -> smoke-military-systems -> smoke-influence-groups -> smoke-class-engine -> smoke-class-party-bidirectional
//   -> smoke-letter-full -> smoke-letter-intercept-react -> smoke-tinyi-fix
//   -> smoke-tinyi-impeachment -> smoke-guoku-* -> smoke-corruption-* -> boot-smoke -> render-smoke -> headless-smoke -> smoke-chaoyi-v3
//
// Usage:
//   node scripts/verify-all.js
//
// This is fail-fast and prints a short baseline summary at the end.

'use strict';

const cp = require('child_process');
const path = require('path');

const SCRIPTS = path.resolve(__dirname);

// Current clean baseline: 227 passing tests (+15 from slice 1-3b pipeline 结构测试), 0 real failures.
const SMOKE_BASELINE = { minPass: 227, maxFail: 0 };

const checks = [
  { name: 'syntax-check', file: 'syntax-check.js', estSec: 17, expectExit: 0 },
  { name: 'encoding-check', file: 'smoke-encoding-check.js', estSec: 1, expectExit: 0 },
  { name: 'ref-check', file: 'ref-check.js', estSec: 1, expectExit: 0 },
  { name: 'find-orphans', file: 'find-orphans.js', estSec: 1, expectExit: 0 },
  { name: 'official-scenario', file: 'official-scenario-smoke.js', estSec: 1, expectExit: 0 },
  { name: 'tianqi-cache-recovery', file: 'smoke-tianqi-official-cache-recovery.js', estSec: 1, expectExit: 0 },
  { name: 'start-game-data-integrity', file: 'smoke-start-game-data-integrity.js', estSec: 20, expectExit: 0 },
  { name: 'phase8-office-standalone', file: 'smoke-phase8-office-standalone.js', estSec: 1, expectExit: 0 },
  { name: 'phase8-map-live-panels', file: 'smoke-phase8-map-live-panels.js', estSec: 1, expectExit: 0 },
  { name: 'shiji-history-ui', file: 'smoke-shiji-history-ui.js', estSec: 1, expectExit: 0 },
  { name: 'formal-edict-portrait', file: 'smoke-formal-edict-portrait.js', estSec: 1, expectExit: 0 },
  { name: 'formal-edict-polish-scope', file: 'smoke-formal-edict-polish-scope.js', estSec: 1, expectExit: 0 },
  { name: 'formal-runtime-chrome-throttle', file: 'smoke-formal-runtime-chrome-throttle.js', estSec: 1, expectExit: 0 },
  { name: 'formal-module-modal-size', file: 'smoke-formal-module-modal-size.js', estSec: 1, expectExit: 0 },
  { name: 'audio-bgm', file: 'smoke-audio-bgm.js', estSec: 1, expectExit: 0 },
  { name: 'wendui-active-audience', file: 'smoke-wendui-active-audience.js', estSec: 1, expectExit: 0 },
  { name: 'yuqian-open-frequency', file: 'smoke-yuqian-open-frequency.js', estSec: 1, expectExit: 0 },
  { name: 'topbar-fiscal-consistency', file: 'smoke-topbar-fiscal-consistency.js', estSec: 1, expectExit: 0 },
  { name: 'endturn-console-regressions', file: 'smoke-endturn-console-regressions.js', estSec: 1, expectExit: 0 },
  { name: 'wentian-hardchange', file: 'smoke-wentian-hardchange.js', estSec: 1, expectExit: 0 },
  { name: 'ai-core-path-aliases', file: 'smoke-ai-core-path-aliases.js', estSec: 1, expectExit: 0 },
  { name: 'core-ui-field-reads', file: 'smoke-core-ui-field-reads.js', estSec: 1, expectExit: 0 },
  { name: 'faction-relations', file: 'smoke-faction-relations.js', estSec: 1, expectExit: 0 },
  { name: 'faction-index', file: 'smoke-faction-index.js', estSec: 1, expectExit: 0 },
  { name: 'faction-index-e2e', file: 'smoke-faction-index-e2e.js', estSec: 1, expectExit: 0 },
  { name: 'faction-membership', file: 'smoke-faction-membership.js', estSec: 1, expectExit: 0 },
  { name: 'faction-panel-ui', file: 'smoke-faction-panel-ui.js', estSec: 1, expectExit: 0 },
  { name: 'faction-binding-lint', file: 'smoke-faction-binding-lint.js', estSec: 1, expectExit: 0 },
  { name: 'faction-npc-in-turn', file: 'smoke-faction-npc-in-turn-driver.js', estSec: 1, expectExit: 0 },
  { name: 'engine-phase0', file: 'smoke-engine-phase0.js', estSec: 1, expectExit: 0 },
  { name: 'office-dynastification', file: 'smoke-office-dynastification.js', estSec: 1, expectExit: 0 },
  { name: 'office-appointment-sync', file: 'smoke-office-appointment-sync.js', estSec: 1, expectExit: 0 },
  { name: 'loyalty-attribution', file: 'smoke-loyalty-attribution.js', estSec: 1, expectExit: 0 },
  { name: 'huangquan-attribution', file: 'smoke-huangquan-attribution.js', estSec: 1, expectExit: 0 },
  { name: 'memory-read-contract', file: 'smoke-memory-read-contract.js', estSec: 1, expectExit: 0 },
  { name: 'military-systems', file: 'smoke-military-systems.js', estSec: 1, expectExit: 0 },
  { name: 'influence-groups', file: 'smoke-influence-groups.js', estSec: 1, expectExit: 0 },
  { name: 'class-engine', file: 'smoke-class-engine.js', estSec: 1, expectExit: 0 },
  { name: 'class-party-bidi', file: 'smoke-class-party-bidirectional.js', estSec: 1, expectExit: 0 },
  { name: 'letter-full', file: 'smoke-letter-full.js', estSec: 1, expectExit: 0 },
  { name: 'letter-intercept', file: 'smoke-letter-intercept-react.js', estSec: 1, expectExit: 0 },
  { name: 'tinyi-fix', file: 'smoke-tinyi-fix.js', estSec: 1, expectExit: 0 },
  { name: 'tinyi-impeach', file: 'smoke-tinyi-impeachment.js', estSec: 1, expectExit: 0 },
  // R8 (2026-05-04) guoku LAYERED 5 层链行为快照·R9 merge 前 baseline (Claude own)
  { name: 'guoku-compute-tax-flow', file: 'smoke-guoku-compute-tax-flow.js', estSec: 1, expectExit: 0 },
  { name: 'guoku-compute-tax-flow-tyrant', file: 'smoke-guoku-compute-tax-flow-tyrant.js', estSec: 1, expectExit: 0 },
  { name: 'guoku-tick-full-pass', file: 'smoke-guoku-tick-full-pass.js', estSec: 1, expectExit: 0 },
  { name: 'guoku-sources-scenario-disabled', file: 'smoke-guoku-sources-scenario-disabled.js', estSec: 1, expectExit: 0 },
  { name: 'guoku-yearly-settle', file: 'smoke-guoku-yearly-settle.js', estSec: 1, expectExit: 0 },
  { name: 'guoku-init-from-dynasty', file: 'smoke-guoku-init-from-dynasty.js', estSec: 1, expectExit: 0 },
  { name: 'guoku-enact-reform', file: 'smoke-guoku-enact-reform.js', estSec: 1, expectExit: 0 },
  { name: 'guoku-loan-and-bankruptcy', file: 'smoke-guoku-loan-and-bankruptcy.js', estSec: 1, expectExit: 0 },
  { name: 'economy-env-huangquan', file: 'smoke-economy-env-huangquan.js', estSec: 1, expectExit: 0 },
  // R8 (2026-05-04) corruption LAYERED OVERRIDE chain smoke (Codex own)
  { name: 'corruption-tick', file: 'smoke-corruption-tick-full-pass.js', estSec: 1, expectExit: 0 },
  { name: 'corruption-detect', file: 'smoke-corruption-detection-event.js', estSec: 1, expectExit: 0 },
  { name: 'corruption-treasury', file: 'smoke-corruption-impact-on-treasury.js', estSec: 2, expectExit: 0 },
  { name: 'corruption-purge', file: 'smoke-corruption-purge-and-asset-seize.js', estSec: 1, expectExit: 0 },
  { name: 'corruption-yearly', file: 'smoke-corruption-yearly-evaluate.js', estSec: 1, expectExit: 0 },
  { name: 'corruption-clique', file: 'smoke-corruption-clique-formation.js', estSec: 1, expectExit: 0 },
  { name: 'corruption-ai', file: 'smoke-corruption-ai-detect-prompt.js', estSec: 1, expectExit: 0 },
  { name: 'corruption-juanna', file: 'smoke-corruption-pardon-and-restore.js', estSec: 1, expectExit: 0 },
  { name: 'corruption-player-actions-sync', file: 'smoke-corruption-player-actions-sync.js', estSec: 1, expectExit: 0 },
  // R12a (2026-05-04) edict-parser LAYERED OVERRIDE chain smoke (phase-c-patches·Claude own)
  { name: 'edict-parser-layered', file: 'smoke-edict-parser-layered.js', estSec: 1, expectExit: 0 },
  // R12c (2026-05-04) authority PhaseF1 LAYERED OVERRIDE chain smoke (Codex own)
  { name: 'authority-f1-layered', file: 'smoke-authority-f1-layered.js', estSec: 1, expectExit: 0 },
  // P4-beta (2026-05-04) UI foundation consolidation smoke (Codex own)
  { name: 'ui-foundation', file: 'smoke-ui-foundation.js', estSec: 1, expectExit: 0 },
  // P4-beta (2026-05-04) diagnostics foundation consolidation smoke (Codex own)
  { name: 'diagnostics-foundation', file: 'smoke-diagnostics-foundation.js', estSec: 1, expectExit: 0 },
  // P5-α (2026-05-04) namespace reconcile·24 canonical container + alias smoke (Claude own)
  { name: 'p5-alpha-namespaces', file: 'smoke-p5-alpha-namespaces.js', estSec: 1, expectExit: 0 },
  // P5-β (2026-05-04) NPC/Char namespace facade smoke (Codex own)
  { name: 'p5-beta-npc-char', file: 'smoke-p5-beta-npc-char.js', estSec: 1, expectExit: 0 },
  { name: 'npc-action-logic', file: 'smoke-npc-action-logic.js', estSec: 1, expectExit: 0 },
  // P5-γ (2026-05-04) Edict namespace facade smoke·EDICT_TYPES 两版本隔离·R12b 后 v2 (Claude own)
  { name: 'p5-gamma-edict', file: 'smoke-p5-gamma-edict.js', estSec: 1, expectExit: 0 },
  // P5-δ (2026-05-04) Fiscal/Economy/Guoku/Neitang facade fill·tick 跨 7 engine 强隔离 (Claude own)
  { name: 'p5-delta-fiscal', file: 'smoke-p5-delta-fiscal.js', estSec: 1, expectExit: 0 },
  // P5-ε (2026-05-04) Authority/Office/Keju/Corruption facade fill·R12c v1·R87 Lizhi 留 (Claude own)
  { name: 'p5-epsilon-authority', file: 'smoke-p5-epsilon-authority.js', estSec: 1, expectExit: 0 },
  // P5-ζ (2026-05-04) Map/UI facade fill·R87 MapSystem keep·UI infrastructure only (Codex own)
  { name: 'p5-zeta-map-ui', file: 'smoke-p5-zeta-map-ui.js', estSec: 1, expectExit: 0 },
  // P5-η (2026-05-04) Endturn facade fill·public entrypoints only·AI internals black-boxed (Codex own)
  { name: 'p5-eta-endturn', file: 'smoke-p5-eta-endturn.js', estSec: 1, expectExit: 0 },
  // P5-θ (2026-05-04) Editor facade fill·HTML inline retained·Office legacy AI not duplicated (Codex own)
  { name: 'p5-theta-editor', file: 'smoke-p5-theta-editor.js', estSec: 1, expectExit: 0 },
  // P6 (2026-05-04) HTML inline namespace migration lock; index/editor safe first pass (Codex own)
  { name: 'p6-inline-namespaces', file: 'smoke-p6-inline-namespaces.js', estSec: 1, expectExit: 0 },
  // P6 optional namespace lint (2026-05-04) retired aliases + migrated inline handlers stay retired
  { name: 'lint-namespace', file: 'lint-namespace.js', estSec: 1, expectExit: 0 },
  // Phase 7 P7-β baseline·tm-endturn-ai-infer 行为快照·拆分前 lockdown (Claude own)
  { name: 'endturn-public-contract', file: 'smoke-endturn-public-contract.js', estSec: 1, expectExit: 0 },
  { name: 'endturn-subcall-registry', file: 'smoke-endturn-subcall-registry.js', estSec: 1, expectExit: 0 },
  { name: 'postturn-court-turn-gating', file: 'smoke-postturn-court-turn-gating.js', estSec: 1, expectExit: 0 },
  { name: 'postturn-court-deferred-finalize', file: 'smoke-postturn-court-deferred-finalize.js', estSec: 1, expectExit: 0 },
  { name: 'endturn-prompt-tokens', file: 'smoke-endturn-prompt-tokens.js', estSec: 1, expectExit: 0 },
  { name: 'endturn-helpers', file: 'smoke-endturn-helpers.js', estSec: 1, expectExit: 0 },
  { name: 'endturn-apply-fields', file: 'smoke-endturn-apply-fields.js', estSec: 1, expectExit: 0 },
  { name: 'endturn-followup', file: 'smoke-endturn-followup.js', estSec: 1, expectExit: 0 },
  { name: 'endturn-error-path', file: 'smoke-endturn-error-path.js', estSec: 1, expectExit: 0 },
  { name: 'ai-preflight-diagnostics', file: 'smoke-ai-preflight-diagnostics.js', estSec: 1, expectExit: 0 },
  { name: 'endturn-section-boundary', file: 'smoke-endturn-section-boundary.js', estSec: 1, expectExit: 0 },
  { name: 'endturn-callai', file: 'smoke-endturn-callai.js', estSec: 1, expectExit: 0 },
  { name: 'endturn-narrative', file: 'smoke-endturn-narrative.js', estSec: 1, expectExit: 0 },
  { name: 'endturn-namespace-deps', file: 'smoke-endturn-namespace-deps.js', estSec: 1, expectExit: 0 },
  { name: 'boot-smoke', file: 'boot-smoke.js', estSec: 10, expectExit: 0 },
  { name: 'render-smoke', file: 'render-smoke.js', estSec: 5, expectExit: 0 },
  { name: 'smoke', file: 'headless-smoke.js', estSec: 30, expectExit: null },
  { name: 'cc3-smoke', file: 'smoke-chaoyi-v3.js', estSec: 1, expectExit: 0 },
  // 2026-05-07·endTurn 管道化双轨 diff (slice cluster 1-3b 验证)
  // 不许 pipeline mode 与 legacy mode 在 normalized GM 上有任何差异
  { name: 'pipeline-diff', file: 'smoke-pipeline-diff.js', estSec: 8, expectExit: 0 }
];

let totalSec = 0;
const results = [];

for (const c of checks) {
  process.stdout.write(`[verify-all] run ${c.name} (~${c.estSec}s)... `);
  const t0 = Date.now();
  const r = cp.spawnSync('node', [path.join(SCRIPTS, c.file)], { encoding: 'utf8' });
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  totalSec += parseFloat(dt);

  let ok;
  if (c.name === 'smoke') {
    const m = (r.stdout || '').match(/"passed"\s*:\s*(\d+)\s*,\s*"failed"\s*:\s*(\d+)/);
    if (m) {
      const passed = +m[1];
      const failed = +m[2];
      ok = passed >= SMOKE_BASELINE.minPass && failed <= SMOKE_BASELINE.maxFail;
      if (!ok) {
        process.stderr.write(
          '\n[smoke] baseline regression (expected >= ' + SMOKE_BASELINE.minPass
          + ' pass / <= ' + SMOKE_BASELINE.maxFail
          + ' fail; actual ' + passed + '/' + failed + ')\n'
        );
      }
    } else {
      ok = false;
      process.stderr.write('\n[smoke] cannot parse passed/failed JSON\n');
    }
  } else {
    ok = r.status === 0;
  }

  process.stdout.write((ok ? '\x1b[32mPASS' : '\x1b[31mFAIL') + '\x1b[0m  ' + dt + 's\n');
  results.push({ name: c.name, ok, dt, stdout: r.stdout, stderr: r.stderr });
  if (!ok) {
    process.stderr.write('\n[verify-all] ' + c.name + ' failed; aborting remaining checks\n\n');
    process.stderr.write(r.stdout || '');
    process.stderr.write(r.stderr || '');
    process.exit(1);
  }
}

console.log('\n[verify-all] all ' + checks.length + ' checks passed; total ' + totalSec.toFixed(1) + 's\n');
for (const r of results) {
  const lines = (r.stdout || '').split('\n').filter(Boolean);
  const tail = lines.slice(-2).filter(function(l) {
    return /PASS|pass|fail|valid|no issues|returned/.test(l);
  }).slice(-1)[0] || lines.slice(-1)[0] || '';
  console.log('  - ' + r.name.padEnd(18) + tail.trim());
}
process.exit(0);

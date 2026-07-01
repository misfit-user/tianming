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

// Current clean TM.test baseline: 227 passing tests, 0 real failures.
// Memory governance/runtime/compiler coverage is enforced by explicit checks below.
const SMOKE_BASELINE = { minPass: 227, maxFail: 0 };

const checks = [
  { name: 'syntax-check', file: 'syntax-check.js', estSec: 17, expectExit: 0 },
  { name: 'encoding-check', file: 'smoke-encoding-check.js', estSec: 1, expectExit: 0 },
  { name: 'ref-check', file: 'ref-check.js', estSec: 1, expectExit: 0 },
  { name: 'find-orphans', file: 'find-orphans.js', estSec: 1, expectExit: 0 },
  { name: 'non-dead-retention-guards', file: 'smoke-non-dead-retention-guards.js', estSec: 1, expectExit: 0 },
  { name: 'restored-deprecated-code-paths', file: 'smoke-restored-deprecated-code-paths.js', estSec: 1, expectExit: 0 },
  { name: 'dead-code-removal-guards', file: 'smoke-dead-code-removal-guards.js', estSec: 1, expectExit: 0 },
  { name: 'electron-save-lifecycle-dead-code', file: 'smoke-electron-save-lifecycle-dead-code.js', estSec: 1, expectExit: 0 },
  { name: 'official-scenario', file: 'official-scenario-smoke.js', estSec: 1, expectExit: 0 },
  { name: 'tianqi-cache-recovery', file: 'smoke-tianqi-official-cache-recovery.js', estSec: 1, expectExit: 0 },
  { name: 'start-game-data-integrity', file: 'smoke-start-game-data-integrity.js', estSec: 20, expectExit: 0 },
  { name: 'start-game-scenario-library', file: 'smoke-start-game-scenario-library.js', estSec: 1, expectExit: 0 },
  { name: 'phase8-office-standalone', file: 'smoke-phase8-office-standalone.js', estSec: 1, expectExit: 0 },
  { name: 'phase8-map-live-panels', file: 'smoke-phase8-map-live-panels.js', estSec: 1, expectExit: 0 },
  { name: 'faction-stats-nooverflow', file: 'smoke-faction-stats-nooverflow.js', estSec: 1, expectExit: 0 },
  { name: 'region-age-settlement-labels', file: 'smoke-region-age-settlement-labels.js', estSec: 1, expectExit: 0 },
  { name: 'hover-fulltext', file: 'smoke-hover-fulltext.js', estSec: 1, expectExit: 0 },
  { name: 'map-view-scores', file: 'smoke-map-view-scores.js', estSec: 1, expectExit: 0 },
  { name: 'map-live-vitals', file: 'smoke-map-live-vitals.js', estSec: 1, expectExit: 0 },
  { name: 'gongming-engine', file: 'smoke-gongming-engine.js', estSec: 1, expectExit: 0 },
  { name: 'gongming-display', file: 'smoke-gongming-display.js', estSec: 1, expectExit: 0 },
  { name: 'gongming-consequence', file: 'smoke-gongming-consequence.js', estSec: 1, expectExit: 0 },
  { name: 'gongming-production', file: 'smoke-gongming-production.js', estSec: 1, expectExit: 0 },
  { name: 'gongming-aiface', file: 'smoke-gongming-aiface.js', estSec: 1, expectExit: 0 },
  { name: 'rank-resolve', file: 'smoke-rank-resolve.js', estSec: 1, expectExit: 0 },
  { name: 'rank-display-sources', file: 'smoke-rank-display-sources.js', estSec: 1, expectExit: 0 },
  { name: 'merit-dynamics', file: 'smoke-merit-dynamics.js', estSec: 1, expectExit: 0 },
  { name: 'building-works', file: 'smoke-building-works.js', estSec: 1, expectExit: 0 },
  { name: 'building-compat', file: 'smoke-building-compat.js', estSec: 1, expectExit: 0 },
  { name: 'armory-readiness', file: 'smoke-armory-readiness.js', estSec: 1, expectExit: 0 },
  { name: 'army-veterancy', file: 'smoke-army-veterancy.js', estSec: 1, expectExit: 0 },
  { name: 'army-units-loss-sync', file: 'smoke-army-units-loss-sync.js', estSec: 1, expectExit: 0 },
  // 御驾亲征战术战斗接入(flag GM._yujiaQinzheng 默认 OFF)·纳入回归防静默腐烂
  { name: 'army-units-derivation', file: 'smoke-army-units-derivation.js', estSec: 2, expectExit: 0 },
  { name: 'army-units-lexicon', file: 'smoke-army-units-lexicon.js', estSec: 1, expectExit: 0 },
  { name: 'battle-adapter', file: 'smoke-battle-adapter.js', estSec: 1, expectExit: 0 },
  { name: 'battle-resolve', file: 'smoke-battle-resolve.js', estSec: 1, expectExit: 0 },
  { name: 'battle-turn', file: 'smoke-battle-turn.js', estSec: 2, expectExit: 0 },
  { name: 'battle-veterancy-wire', file: 'smoke-battle-veterancy-wire.js', estSec: 1, expectExit: 0 },
  { name: 'battle-report', file: 'smoke-battle-report.js', estSec: 1, expectExit: 0 },
  { name: 'appoint-commander-living', file: 'smoke-appoint-commander-living.js', estSec: 1, expectExit: 0 },
  { name: 'onboarding-help', file: 'smoke-onboarding-help.js', estSec: 1, expectExit: 0 },
  { name: 'workshop-preflight-access', file: 'smoke-workshop-preflight-access.js', estSec: 1, expectExit: 0 },
  { name: 'editor-renderall-resilient', file: 'smoke-editor-renderall-resilient.js', estSec: 1, expectExit: 0 },
  { name: 'editor-pipeline-shim', file: 'smoke-editor-pipeline-shim.js', estSec: 1, expectExit: 0 },
  { name: 'authoring-agent-tools', file: 'smoke-authoring-agent-tools.js', estSec: 2, expectExit: 0 },
  { name: 'authoring-agent-fiction', file: 'smoke-authoring-agent-fiction.js', estSec: 1, expectExit: 0 },
  { name: 'authoring-ui-worldkind', file: 'smoke-authoring-ui-worldkind.js', estSec: 1, expectExit: 0 },
  { name: 'fullgen-worldkind-modern', file: 'smoke-fullgen-worldkind-modern.js', estSec: 1, expectExit: 0 },
  { name: 'fullgen-editor-worldkind', file: 'smoke-fullgen-editor-worldkind.js', estSec: 1, expectExit: 0 },
  { name: 'bgm-import', file: 'smoke-bgm-import.js', estSec: 1, expectExit: 0 },
  { name: 'region-governor-live', file: 'smoke-region-governor-live.js', estSec: 1, expectExit: 0 },
  { name: 'restore-custom-scenarios', file: 'smoke-restore-custom-scenarios.js', estSec: 1, expectExit: 0 },
  { name: 'field-pipelines', file: 'smoke-field-pipelines.js', estSec: 1, expectExit: 0 },
  { name: 'region-status', file: 'smoke-region-status.js', estSec: 1, expectExit: 0 },
  { name: 'class-satisfaction-guard', file: 'smoke-class-satisfaction-guard.js', estSec: 1, expectExit: 0 },
  { name: 'social-foundation', file: 'smoke-social-foundation.js', estSec: 1, expectExit: 0 },
  { name: 'shiji-history-ui', file: 'smoke-shiji-history-ui.js', estSec: 1, expectExit: 0 },
  { name: 'formal-edict-portrait', file: 'smoke-formal-edict-portrait.js', estSec: 1, expectExit: 0 },
  { name: 'formal-edict-polish-scope', file: 'smoke-formal-edict-polish-scope.js', estSec: 1, expectExit: 0 },
  { name: 'formal-edict-endturn-bridge', file: 'smoke-formal-edict-endturn-bridge.js', estSec: 1, expectExit: 0 },
  { name: 'formal-ui-bridge-state', file: 'smoke-formal-ui-bridge-state.js', estSec: 1, expectExit: 0 },
  { name: 'formal-hongyan-fulltext', file: 'smoke-formal-hongyan-fulltext.js', estSec: 1, expectExit: 0 },
  { name: 'formal-records-fulltext', file: 'smoke-formal-records-fulltext.js', estSec: 1, expectExit: 0 },
  { name: 'formal-runtime-chrome-throttle', file: 'smoke-formal-runtime-chrome-throttle.js', estSec: 1, expectExit: 0 },
  { name: 'back-to-launch-formal-exit', file: 'smoke-back-to-launch-formal-exit.js', estSec: 1, expectExit: 0 },
  { name: 'css-resource-retry', file: 'smoke-css-resource-retry.js', estSec: 1, expectExit: 0 },
  { name: 'content-manager-workshop-fullpage', file: 'smoke-content-manager-workshop-fullpage.js', estSec: 1, expectExit: 0 },
  { name: 'content-manager-workshop-publish-flow', file: 'smoke-content-manager-workshop-publish-flow.js', estSec: 1, expectExit: 0 },
  { name: 'workshop-admin-review-ui', file: 'smoke-workshop-admin-review-ui.js', estSec: 1, expectExit: 0 },
  { name: 'turn-result-theme-guard', file: 'smoke-turn-result-theme-guard.js', estSec: 1, expectExit: 0 },
  { name: 'formal-module-modal-size', file: 'smoke-formal-module-modal-size.js', estSec: 1, expectExit: 0 },
  { name: 'audio-bgm', file: 'smoke-audio-bgm.js', estSec: 1, expectExit: 0 },
  { name: 'wendui-active-audience', file: 'smoke-wendui-active-audience.js', estSec: 1, expectExit: 0 },
  { name: 'wendui-json-leak-guard', file: 'smoke-wendui-json-leak-guard.js', estSec: 1, expectExit: 0 },
  { name: 'yuqian-open-frequency', file: 'smoke-yuqian-open-frequency.js', estSec: 1, expectExit: 0 },
  { name: 'topbar-fiscal-consistency', file: 'smoke-topbar-fiscal-consistency.js', estSec: 1, expectExit: 0 },
  { name: 'endturn-console-regressions', file: 'smoke-endturn-console-regressions.js', estSec: 1, expectExit: 0 },
  { name: 'ceming', file: 'smoke-ceming.js', estSec: 1, expectExit: 0 },
  { name: 'ceming-profile-schema', file: 'smoke-ceming-profile-schema.js', estSec: 1, expectExit: 0 },
  { name: 'char-autogen-containers', file: 'smoke-char-autogen-containers.js', estSec: 1, expectExit: 0 },
  { name: 'wentian-hardchange', file: 'smoke-wentian-hardchange.js', estSec: 1, expectExit: 0 },
  { name: 'ai-core-path-aliases', file: 'smoke-ai-core-path-aliases.js', estSec: 1, expectExit: 0 },
  { name: 'model-probe-evidence', file: 'smoke-model-probe-evidence.js', estSec: 1, expectExit: 0 },
  { name: 'core-ui-field-reads', file: 'smoke-core-ui-field-reads.js', estSec: 1, expectExit: 0 },
  { name: 'faction-relations', file: 'smoke-faction-relations.js', estSec: 1, expectExit: 0 },
  { name: 'faction-index', file: 'smoke-faction-index.js', estSec: 1, expectExit: 0 },
  { name: 'faction-index-e2e', file: 'smoke-faction-index-e2e.js', estSec: 1, expectExit: 0 },
  { name: 'faction-membership', file: 'smoke-faction-membership.js', estSec: 1, expectExit: 0 },
  { name: 'faction-panel-ui', file: 'smoke-faction-panel-ui.js', estSec: 1, expectExit: 0 },
  { name: 'faction-binding-lint', file: 'smoke-faction-binding-lint.js', estSec: 1, expectExit: 0 },
  { name: 'faction-npc-llm-decision', file: 'smoke-faction-npc-llm-decision.js', estSec: 1, expectExit: 0 },
  { name: 'faction-llm-priority-lifecycle', file: 'smoke-faction-llm-priority-lifecycle.js', estSec: 1, expectExit: 0 },
  { name: 'faction-llm-comprehensive-upgrade', file: 'smoke-faction-llm-comprehensive-upgrade.js', estSec: 1, expectExit: 0 },
  { name: 'faction-npc-in-turn', file: 'smoke-faction-npc-in-turn-driver.js', estSec: 1, expectExit: 0 },
  { name: 'faction-npc-multiturn-e2e', file: 'smoke-faction-npc-multiturn-e2e.js', estSec: 1, expectExit: 0 },
  { name: 'qiju-category-coverage', file: 'smoke-qiju-category-coverage.js', estSec: 1, expectExit: 0 },
  { name: 'ai-change-applier-baseline', file: 'smoke-ai-change-applier-baseline.js', estSec: 1, expectExit: 0 },
  { name: 'dismissal-state-regex', file: 'smoke-dismissal-state-regex.js', estSec: 1, expectExit: 0 },
  { name: 'wendui-prison', file: 'smoke-wendui-prison.js', estSec: 1, expectExit: 0 },
  { name: 'engine-phase0', file: 'smoke-engine-phase0.js', estSec: 1, expectExit: 0 },
  { name: 'office-dynastification', file: 'smoke-office-dynastification.js', estSec: 1, expectExit: 0 },
  { name: 'office-appointment-sync', file: 'smoke-office-appointment-sync.js', estSec: 1, expectExit: 0 },
  { name: 'loyalty-attribution', file: 'smoke-loyalty-attribution.js', estSec: 1, expectExit: 0 },
  { name: 'office-loyalty-transfer', file: 'smoke-office-loyalty-transfer.js', estSec: 1, expectExit: 0 },
  { name: 'huangquan-attribution', file: 'smoke-huangquan-attribution.js', estSec: 1, expectExit: 0 },
  { name: 'guoku-bankruptcy-seven-stage', file: 'smoke-guoku-bankruptcy-seven-stage.js', estSec: 1, expectExit: 0 },
  { name: 'env-policy-complete-chain', file: 'smoke-env-policy-complete-chain.js', estSec: 1, expectExit: 0 },
  { name: 'huji-deep-fields-and-presets', file: 'smoke-huji-deep-fields-and-presets.js', estSec: 1, expectExit: 0 },
  { name: 'memory-read-contract', file: 'smoke-memory-read-contract.js', estSec: 1, expectExit: 0 },
  { name: 'memory-manifest', file: 'smoke-memory-manifest.js', estSec: 1, expectExit: 0 },
  { name: 'memory-envelope-facade', file: 'smoke-memory-envelope-facade.js', estSec: 1, expectExit: 0 },
  { name: 'memory-envelope-retrieval', file: 'smoke-memory-envelope-retrieval.js', estSec: 1, expectExit: 0 },
  { name: 'memory-envelope-schema-v0', file: 'smoke-memory-envelope-schema-v0.js', estSec: 1, expectExit: 0 },
  { name: 'memory-court-record-envelope', file: 'smoke-memory-court-record-envelope.js', estSec: 1, expectExit: 0 },
  { name: 'memory-context-compiler', file: 'smoke-memory-context-compiler.js', estSec: 1, expectExit: 0 },
  { name: 'memory-e2e-game-golden', file: 'smoke-memory-e2e-game-golden.js', estSec: 1, expectExit: 0 },
  { name: 'memory-turn-inference-projection', file: 'smoke-memory-turn-inference-projection.js', estSec: 1, expectExit: 0 },
  { name: 'memory-legacy-source-migration', file: 'smoke-memory-legacy-source-migration.js', estSec: 1, expectExit: 0 },
  { name: 'memory-focus-relevance', file: 'smoke-memory-focus-relevance.js', estSec: 1, expectExit: 0 },
  { name: 'memory-character-stance', file: 'smoke-memory-character-stance.js', estSec: 1, expectExit: 0 },
  { name: 'memory-stance-netting', file: 'smoke-memory-stance-netting.js', estSec: 1, expectExit: 0 },
  { name: 'memory-forget', file: 'smoke-memory-forget.js', estSec: 1, expectExit: 0 },
  { name: 'memory-budget', file: 'smoke-memory-budget.js', estSec: 1, expectExit: 0 },
  { name: 'memory-capacity', file: 'smoke-memory-capacity.js', estSec: 1, expectExit: 0 },
  { name: 'memory-era-rollup', file: 'smoke-memory-era-rollup.js', estSec: 1, expectExit: 0 },
  { name: 'memory-recency-decay', file: 'smoke-memory-recency-decay.js', estSec: 1, expectExit: 0 },
  { name: 'memory-failed-edict-lesson', file: 'smoke-memory-failed-edict-lesson.js', estSec: 1, expectExit: 0 },
  { name: 'memory-turn-writeback', file: 'smoke-memory-turn-writeback.js', estSec: 1, expectExit: 0 },
  { name: 'memory-turn-archive', file: 'smoke-memory-turn-archive.js', estSec: 1, expectExit: 0 },
  { name: 'memory-turn-rollup', file: 'smoke-memory-turn-rollup.js', estSec: 1, expectExit: 0 },
  { name: 'memory-turn-backfill', file: 'smoke-memory-turn-backfill.js', estSec: 1, expectExit: 0 },
  { name: 'memory-turn-quality-gate', file: 'smoke-memory-turn-quality-gate.js', estSec: 1, expectExit: 0 },
  { name: 'memory-turn-output-contract', file: 'smoke-memory-turn-output-contract.js', estSec: 1, expectExit: 0 },
  { name: 'memory-turn-issue-supersedes', file: 'smoke-memory-turn-issue-supersedes.js', estSec: 1, expectExit: 0 },
  { name: 'memory-governance-goldens', file: 'smoke-memory-governance-goldens.js', estSec: 1, expectExit: 0 },
  { name: 'memory-writegate', file: 'smoke-memory-writegate.js', estSec: 1, expectExit: 0 },
  { name: 'memory-writegate-flush', file: 'smoke-memory-writegate-flush.js', estSec: 1, expectExit: 0 },
  { name: 'memory-capacity-limits', file: 'smoke-memory-capacity-limits.js', estSec: 1, expectExit: 0 },
  { name: 'memory-evidence-registry', file: 'smoke-memory-evidence-registry.js', estSec: 1, expectExit: 0 },
  { name: 'memory-evidence-envelope', file: 'smoke-memory-evidence-envelope.js', estSec: 1, expectExit: 0 },
  { name: 'memory-evidence-endturn-metadata', file: 'smoke-memory-evidence-endturn-metadata.js', estSec: 1, expectExit: 0 },
  { name: 'memory-source-bound-records', file: 'smoke-memory-source-bound-records.js', estSec: 1, expectExit: 0 },
  { name: 'memory-source-bound-summaries', file: 'smoke-memory-source-bound-summaries.js', estSec: 1, expectExit: 0 },
  { name: 'memory-sc1q-commitment-sourcebound', file: 'smoke-memory-sc1q-commitment-sourcebound.js', estSec: 1, expectExit: 0 },
  { name: 'memory-current-issues-governance', file: 'smoke-memory-current-issues-governance.js', estSec: 1, expectExit: 0 },
  { name: 'npc-relation-events', file: 'smoke-npc-relation-events.js', estSec: 1, expectExit: 0 },
  { name: 'context-zones-core', file: 'smoke-context-zones-core.js', estSec: 1, expectExit: 0 },
  { name: 'memory-procedural-lessons', file: 'smoke-memory-procedural-lessons.js', estSec: 1, expectExit: 0 },
  { name: 'memory-controls', file: 'smoke-memory-controls.js', estSec: 1, expectExit: 0 },
  { name: 'memory-controls-actions', file: 'smoke-memory-controls-actions.js', estSec: 1, expectExit: 0 },
  { name: 'memory-evidence-risk-guards', file: 'smoke-memory-evidence-risk-guards.js', estSec: 1, expectExit: 0 },
  { name: 'memory-trace-authority-lineage', file: 'smoke-memory-trace-authority-lineage.js', estSec: 1, expectExit: 0 },
  { name: 'memory-workshop-mvp', file: 'smoke-memory-workshop-mvp.js', estSec: 1, expectExit: 0 },
  { name: 'memory-workshop-actions', file: 'smoke-memory-workshop-actions.js', estSec: 1, expectExit: 0 },
  { name: 'memory-workshop-review-details', file: 'smoke-memory-workshop-review-details.js', estSec: 1, expectExit: 0 },
  { name: 'memory-workshop-governance-visibility', file: 'smoke-memory-workshop-governance-visibility.js', estSec: 1, expectExit: 0 },
  { name: 'memory-workshop-governance-actions', file: 'smoke-memory-workshop-governance-actions.js', estSec: 1, expectExit: 0 },
  { name: 'memory-workshop-panel-click', file: 'smoke-memory-workshop-panel-click.js', estSec: 1, expectExit: 0 },
  { name: 'memory-workshop-panel-danger-guards', file: 'smoke-memory-workshop-panel-danger-guards.js', estSec: 1, expectExit: 0 },
  { name: 'memory-workshop-governance-undo', file: 'smoke-memory-workshop-governance-undo.js', estSec: 1, expectExit: 0 },
  { name: 'memory-workshop-rollup-undo', file: 'smoke-memory-workshop-rollup-undo.js', estSec: 1, expectExit: 0 },
  { name: 'memory-workshop-audit-filters', file: 'smoke-memory-workshop-audit-filters.js', estSec: 1, expectExit: 0 },
  { name: 'memory-workshop-audit-capacity', file: 'smoke-memory-workshop-audit-capacity.js', estSec: 1, expectExit: 0 },
  { name: 'memory-workshop-rollup-controls', file: 'smoke-memory-workshop-rollup-controls.js', estSec: 1, expectExit: 0 },
  { name: 'memory-workshop-preinference', file: 'smoke-memory-workshop-preinference.js', estSec: 1, expectExit: 0 },
  { name: 'memory-sc1-precontext-trace', file: 'smoke-memory-sc1-precontext-trace.js', estSec: 1, expectExit: 0 },
  { name: 'memory-sc1-writeback-loop', file: 'smoke-memory-sc1-writeback-loop.js', estSec: 1, expectExit: 0 },
  { name: 'memory-sc1-governance-markers', file: 'smoke-memory-sc1-governance-markers.js', estSec: 1, expectExit: 0 },
  { name: 'memory-accepted-readback-loop', file: 'smoke-memory-accepted-readback-loop.js', estSec: 1, expectExit: 0 },
  { name: 'memory-accepted-governance', file: 'smoke-memory-accepted-governance.js', estSec: 1, expectExit: 0 },
  { name: 'memory-hard-state-source', file: 'smoke-memory-hard-state-source.js', estSec: 1, expectExit: 0 },
  { name: 'memory-recall-query-builder', file: 'smoke-memory-recall-query-builder.js', estSec: 1, expectExit: 0 },
  { name: 'memory-trace-core', file: 'smoke-memory-trace-core.js', estSec: 1, expectExit: 0 },
  { name: 'memory-trace-integration', file: 'smoke-memory-trace-integration.js', estSec: 1, expectExit: 0 },
  { name: 'memory-trace-persist', file: 'smoke-memory-trace-persist.js', estSec: 1, expectExit: 0 },
  { name: 'memory-retrieval-core', file: 'smoke-memory-retrieval-core.js', estSec: 1, expectExit: 0 },
  { name: 'memory-retrieval-integration', file: 'smoke-memory-retrieval-integration.js', estSec: 1, expectExit: 0 },
  { name: 'memory-retrieval-budget', file: 'smoke-memory-retrieval-budget.js', estSec: 1, expectExit: 0 },
  { name: 'memory-retrieval-graph-hop', file: 'smoke-memory-retrieval-graph-hop.js', estSec: 1, expectExit: 0 },
  { name: 'memory-recall-injection-lineage', file: 'smoke-memory-recall-injection-lineage.js', estSec: 1, expectExit: 0 },
  { name: 'memory-recall-context-zones', file: 'smoke-memory-recall-context-zones.js', estSec: 1, expectExit: 0 },
  { name: 'memory-injection-guarantees', file: 'smoke-memory-injection-guarantees.js', estSec: 1, expectExit: 0 },
  { name: 'memory-retrieval-golden', file: 'smoke-memory-retrieval-golden.js', estSec: 1, expectExit: 0 },
  { name: 'memory-retrieval-golden-matrix', file: 'smoke-memory-retrieval-golden-matrix.js', estSec: 1, expectExit: 0 },
  { name: 'memory-retrieval-governance', file: 'smoke-memory-retrieval-governance.js', estSec: 1, expectExit: 0 },
  { name: 'memory-governance-live-chain', file: 'smoke-memory-governance-live-chain.js', estSec: 1, expectExit: 0 },
  { name: 'memory-retrieval-diagnostics', file: 'smoke-memory-retrieval-diagnostics.js', estSec: 1, expectExit: 0 },
  { name: 'memory-visibility-audience', file: 'smoke-memory-visibility-audience.js', estSec: 1, expectExit: 0 },
  { name: 'memory-character-scope', file: 'smoke-memory-character-scope.js', estSec: 1, expectExit: 0 },
  { name: 'memory-temporal-validity', file: 'smoke-memory-temporal-validity.js', estSec: 1, expectExit: 0 },
  { name: 'hougong-module-load', file: 'smoke-houguong-module-load.js', estSec: 1, expectExit: 0 },
  { name: 'military-systems', file: 'smoke-military-systems.js', estSec: 1, expectExit: 0 },
  { name: 'endturn-battle-detail-fallback', file: 'smoke-endturn-battle-detail-fallback.js', estSec: 1, expectExit: 0 },
  { name: 'influence-groups', file: 'smoke-influence-groups.js', estSec: 1, expectExit: 0 },
  { name: 'class-engine', file: 'smoke-class-engine.js', estSec: 1, expectExit: 0 },
  { name: 'class-party-bidi', file: 'smoke-class-party-bidirectional.js', estSec: 1, expectExit: 0 },
  { name: 'party-class-drift-bidirectional', file: 'smoke-party-class-drift-bidirectional.js', estSec: 1, expectExit: 0 },
  { name: 'party-class-tuning', file: 'smoke-party-class-tuning.js', estSec: 1, expectExit: 0 },
  { name: 'party-goals-lifecycle', file: 'smoke-party-goals-lifecycle.js', estSec: 1, expectExit: 0 },
  { name: 'party-class-dynamic-relations', file: 'smoke-party-class-dynamic-relations.js', estSec: 1, expectExit: 0 },
  { name: 'player-action-signals', file: 'smoke-player-action-signals.js', estSec: 1, expectExit: 0 },
  { name: 'party-class-llm-calibrator', file: 'smoke-party-class-llm-calibrator.js', estSec: 1, expectExit: 0 },
  { name: 'party-goals-scenario-variance', file: 'smoke-party-goals-scenario-variance.js', estSec: 1, expectExit: 0 },
  { name: 'party-goals-adaptive-evidence', file: 'smoke-party-goals-adaptive-evidence.js', estSec: 1, expectExit: 0 },
  { name: 'class-demand-party-goals', file: 'smoke-class-demand-party-goals.js', estSec: 1, expectExit: 0 },
  { name: 'class-character-relations', file: 'smoke-class-character-relations.js', estSec: 1, expectExit: 0 },
  { name: 'class-character-ui', file: 'smoke-class-character-ui.js', estSec: 1, expectExit: 0 },
  { name: 'character-class-action-signals', file: 'smoke-character-class-action-signals.js', estSec: 1, expectExit: 0 },
  { name: 'class-character-effects', file: 'smoke-class-character-effects.js', estSec: 1, expectExit: 0 },
  { name: 'class-character-court-office-links', file: 'smoke-class-character-court-office-links.js', estSec: 1, expectExit: 0 },
  { name: 'class-action-delegate-character', file: 'smoke-class-action-delegate-character.js', estSec: 1, expectExit: 0 },
  { name: 'class-action-delegate-ui', file: 'smoke-class-action-delegate-ui.js', estSec: 1, expectExit: 0 },
  { name: 'class-character-ai-context', file: 'smoke-class-character-ai-context.js', estSec: 1, expectExit: 0 },
  { name: 'tinyi-party-class-agenda', file: 'smoke-tinyi-party-class-agenda.js', estSec: 1, expectExit: 0 },
  { name: 'tinyi-scenario-class-source', file: 'smoke-tinyi-scenario-class-source.js', estSec: 1, expectExit: 0 },
  { name: 'tinyi-topic-localization', file: 'smoke-tinyi-topic-localization.js', estSec: 1, expectExit: 0 },
  { name: 'endturn-party-class-change-groups', file: 'smoke-endturn-party-class-change-groups.js', estSec: 1, expectExit: 0 },
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
  { name: 'crisis-player-paths', file: 'smoke-crisis-player-paths.js', estSec: 1, expectExit: 0 },
  { name: 'crisis-player-surface-bridge', file: 'smoke-crisis-player-surface-bridge.js', estSec: 1, expectExit: 0 },
  // R12a (2026-05-04) edict-parser LAYERED OVERRIDE chain smoke (phase-c-patches·Claude own)
  { name: 'edict-parser-layered', file: 'smoke-edict-parser-layered.js', estSec: 1, expectExit: 0 },
  { name: 'policy-detail-player-paths', file: 'smoke-policy-detail-player-paths.js', estSec: 1, expectExit: 0 },
  { name: 'edict-office-abolish-dynamic-lifecycle', file: 'smoke-edict-office-abolish-dynamic-lifecycle.js', estSec: 1, expectExit: 0 },
  { name: 'edict-institution-ai-context', file: 'smoke-edict-institution-ai-context.js', estSec: 1, expectExit: 0 },
  { name: 'edict-institution-lifecycle-events', file: 'smoke-edict-institution-lifecycle-events.js', estSec: 1, expectExit: 0 },
  { name: 'institution-lifecycle-player-chain', file: 'smoke-institution-lifecycle-player-chain.js', estSec: 1, expectExit: 0 },
  { name: 'turn-report-institution-lifecycle', file: 'smoke-turn-report-institution-lifecycle.js', estSec: 1, expectExit: 0 },
  { name: 'ai-context-institution-lifecycle', file: 'smoke-ai-context-institution-lifecycle.js', estSec: 1, expectExit: 0 },
  { name: 'institution-lifecycle-ui-surface', file: 'smoke-institution-lifecycle-ui-surface.js', estSec: 1, expectExit: 0 },
  { name: 'ai-structured-policy-detail-actions', file: 'smoke-ai-structured-policy-detail-actions.js', estSec: 1, expectExit: 0 },
  { name: 'char-economy-ai-context', file: 'smoke-char-economy-ai-context.js', estSec: 1, expectExit: 0 },
  { name: 'char-economy-family-tier-contract', file: 'smoke-char-economy-family-tier-contract.js', estSec: 1, expectExit: 0 },
  // R12c (2026-05-04) authority PhaseF1 LAYERED OVERRIDE chain smoke (Codex own)
  { name: 'authority-f1-layered', file: 'smoke-authority-f1-layered.js', estSec: 1, expectExit: 0 },
  { name: 'authority-variable-linkage-matrix', file: 'smoke-authority-variable-linkage-matrix.js', estSec: 1, expectExit: 0 },
  { name: 'authority-variable-linkage-effects', file: 'smoke-authority-variable-linkage-effects.js', estSec: 1, expectExit: 0 },
  // P4-beta (2026-05-04) UI foundation consolidation smoke (Codex own)
  { name: 'ui-foundation', file: 'smoke-ui-foundation.js', estSec: 1, expectExit: 0 },
  // P4-beta (2026-05-04) diagnostics foundation consolidation smoke (Codex own)
  { name: 'diagnostics-foundation', file: 'smoke-diagnostics-foundation.js', estSec: 1, expectExit: 0 },
  // P5-α (2026-05-04) namespace reconcile·24 canonical container + alias smoke (Claude own)
  { name: 'p5-alpha-namespaces', file: 'smoke-p5-alpha-namespaces.js', estSec: 1, expectExit: 0 },
  // P5-β (2026-05-04) NPC/Char namespace facade smoke (Codex own)
  { name: 'p5-beta-npc-char', file: 'smoke-p5-beta-npc-char.js', estSec: 1, expectExit: 0 },
  { name: 'npc-action-logic', file: 'smoke-npc-action-logic.js', estSec: 1, expectExit: 0 },
  { name: 'npc-economy-ability-wuchang-candidates', file: 'smoke-npc-economy-ability-wuchang-candidates.js', estSec: 1, expectExit: 0 },
  { name: 'npc-execution-economy-ability-wuchang-results', file: 'smoke-npc-execution-economy-ability-wuchang-results.js', estSec: 1, expectExit: 0 },
  { name: 'npc-family-tier-behavior-effects', file: 'smoke-npc-family-tier-behavior-effects.js', estSec: 1, expectExit: 0 },
  { name: 'centralization-finance-guard', file: 'smoke-centralization-finance-guard.js', estSec: 1, expectExit: 0 },
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
  // 2026-05-21 scenario editor reset inventory: official scenario field coverage and editor risk gate
  { name: 'editor-reset-inventory', file: 'smoke-editor-reset-inventory.js', estSec: 1, expectExit: 0 },
  // 2026-05-21 scenario editor reset preview: home shell and health dashboard skeleton
  { name: 'scenario-editor-reset-preview', file: 'smoke-scenario-editor-reset-preview.js', estSec: 1, expectExit: 0 },
  // 2026-05-25 scenario editor reset round-trip: bundle integrity + polymorphism predicates across both official scenarios
  { name: 'scenario-editor-reset-roundtrip', file: 'smoke-scenario-editor-reset-roundtrip.js', estSec: 1, expectExit: 0 },
  // P6 (2026-05-04) HTML inline namespace migration lock; index/editor safe first pass (Codex own)
  { name: 'p6-inline-namespaces', file: 'smoke-p6-inline-namespaces.js', estSec: 1, expectExit: 0 },
  // P6 optional namespace lint (2026-05-04) retired aliases + migrated inline handlers stay retired
  { name: 'lint-namespace', file: 'lint-namespace.js', estSec: 1, expectExit: 0 },
  // Phase 7 P7-β baseline·tm-endturn-ai-infer 行为快照·拆分前 lockdown (Claude own)
  { name: 'endturn-public-contract', file: 'smoke-endturn-public-contract.js', estSec: 1, expectExit: 0 },
  { name: 'endturn-subcall-registry', file: 'smoke-endturn-subcall-registry.js', estSec: 1, expectExit: 0 },
  { name: 'postturn-court-turn-gating', file: 'smoke-postturn-court-turn-gating.js', estSec: 1, expectExit: 0 },
  { name: 'postturn-court-deferred-finalize', file: 'smoke-postturn-court-deferred-finalize.js', estSec: 1, expectExit: 0 },
  { name: 'postturn-court-render-fallback', file: 'smoke-postturn-court-render-fallback.js', estSec: 1, expectExit: 0 },
  { name: 'endturn-validity-gate', file: 'smoke-endturn-validity-gate.js', estSec: 1, expectExit: 0 },
  { name: 'changequeue-apply-safety', file: 'smoke-changequeue-apply-safety.js', estSec: 1, expectExit: 0 },
  { name: 'settlement-reentrant-rollback', file: 'smoke-settlement-reentrant-rollback.js', estSec: 1, expectExit: 0 },
  { name: 'turn-inference-call-optim', file: 'smoke-turn-inference-call-optim.js', estSec: 1, expectExit: 0 },
  { name: 'sc07-cognition-upgrade', file: 'smoke-sc07-cognition-upgrade.js', estSec: 1, expectExit: 0 },
  { name: 'sc1bc-upgrade', file: 'smoke-sc1bc-upgrade.js', estSec: 1, expectExit: 0 },
  { name: 'sc1q-sc19-upgrade', file: 'smoke-sc1q-sc19-upgrade.js', estSec: 1, expectExit: 0 },
  { name: 'endturn-multicall-upgrade', file: 'smoke-endturn-multicall-upgrade.js', estSec: 1, expectExit: 0 },
  { name: 'endturn-performance-optimizations', file: 'smoke-endturn-performance-optimizations.js', estSec: 1, expectExit: 0 },
  { name: 'endturn-systems-tail-guards', file: 'smoke-endturn-systems-tail-guards.js', estSec: 1, expectExit: 0 },
  { name: 'endturn-render-loading-guard', file: 'smoke-endturn-render-loading-guard.js', estSec: 1, expectExit: 0 },
  { name: 'endturn-prompt-tokens', file: 'smoke-endturn-prompt-tokens.js', estSec: 1, expectExit: 0 },
  { name: 'endturn-context-caps', file: 'smoke-endturn-context-caps.js', estSec: 1, expectExit: 0 },
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
  { name: 'chaoyi-attribution', file: 'smoke-chaoyi-attribution.js', estSec: 1, expectExit: 0 },
  { name: 'sovereign-address-sensing', file: 'smoke-sovereign-address-sensing.js', estSec: 1, expectExit: 0 },
  // 常朝大改·Slice 2·议题 tag fallback 推导守门
  { name: 'cc3-agenda-tags', file: 'smoke-changchao-agenda-tags.js', estSec: 1, expectExit: 0 },
  // 常朝大改·Slice 3·B 方案 persona-text fallback hit rate ≥ 50%·dims 分布 ≥ 3 种
  { name: 'cc3-persona-stance', file: 'smoke-changchao-persona-stance.js', estSec: 1, expectExit: 0 },
  // 常朝大改·Slice 8·6-layer mode pipeline 守门 (base mode·persona modulation·guards·linkage)
  { name: 'cc3-mode-pipeline', file: 'smoke-changchao-mode-pipeline.js', estSec: 1, expectExit: 0 },
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

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function countMatches(src, pattern) {
  const matches = src.match(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g'));
  return matches ? matches.length : 0;
}

const keju = read('tm-keju.js');
const kejuRuntime = (read('tm-keju-runtime.js') + read('tm-keju-runtime-keyi.js'));
const playerSettings = read('tm-player-settings.js');
const saveLifecycle = read('tm-save-lifecycle.js');
const patches = (read('tm-patches.js') + '\n' + read('tm-patches-start.js'));
const gameLoop = (read('tm-game-loop.js') + read('tm-game-loop-wentian-hardchange.js'));
const endturnCore = read('tm-endturn-core.js');
const launch = read('tm-launch.js');
const officeEditor = read('tm-office-editor.js');
const editorDetails = read('editor-details.js');
const electron = read('tm-electron.js');
const militaryUi = read('tm-military-ui.js');
const postTurnJobs = read('tm-post-turn-jobs.js');
const npcDecision = (read('tm-npc-decision.js') + read('tm-npc-decision-ai-driven.js'));
const threeSystemsUi = read('tm-three-systems-ui.js');
const editorAiGen = read('editor-ai-gen.js');
const courtMeter = read('tm-court-meter.js');
const editorAdministration = read('editor-administration.js');
const mapRecognition = read('map-recognition.js');
const integrationBridge = read('tm-integration-bridge.js');
const endturnHelpers = read('tm-endturn-helpers.js');
const endturnQiaozhi = read('tm-endturn-qiaozhi.js');
const dataAccess = read('tm-data-access.js');
const topbarVars = read('tm-topbar-vars.js');
const aiChangeApplier = read('modules/ai-change-applier/core.js') + '\n' +
  read('modules/ai-change-applier/validators.js') + '\n' +
  read('modules/ai-change-applier/reconcile.js');
const indices = read('tm-indices.js');
const officeSystem = read('tm-office-system.js');
const editorAuthoringAgent = read('editor-authoring-agent.js');
const kejuReformEvolution = read('tm-keju-reform-evolution.js');

assert(!/function\s+manualStartKeju\s*\(/.test(keju), 'obsolete manualStartKeju direct exam launcher should be removed');
assert(/function\s+startKejuByMethod\s*\(/.test(keju), 'active keju method launcher should remain');
assert(/startKejuExam\s*\(\s*\{\s*type:\s*'zhengke'/.test(keju), 'active keju launcher should still call startKejuExam with method metadata');
assert(/绝不直接 startKejuExam|startKejuExam/.test(kejuRuntime), 'keju runtime design guard should remain visible');

[
  /function\s+importSaveFile\s*\(/,
  /function\s+doSaveGame\s*\(/,
  /async\s+function\s+doSaveGameDesktop\s*\(/,
  /function\s+openSettings\s*\(/
].forEach((pattern) => {
  assert(!pattern.test(playerSettings), 'tm-player-settings should no longer define obsolete overwritten entrypoint: ' + pattern);
});
assert(/doSaveGame\s*=\s*async\s*function\s*\(/.test(saveLifecycle), 'active doSaveGame override should remain in tm-save-lifecycle');
assert(/importSaveFile\s*=\s*function\s*\(/.test(saveLifecycle), 'active importSaveFile override should remain in tm-save-lifecycle');
assert(/openSettings\s*=\s*function\s*\(/.test(patches), 'active openSettings override should remain in tm-patches');

[
  /function\s+renderRulTab\s*\(/,
  /function\s+renderEvtTab\s*\(/,
  /function\s+renderTechTab\s*\(/,
  /function\s+renderMapTab\s*\(/,
  /async\s+function\s+aiGenOfficeEd\s*\(/
].forEach((pattern) => {
  assert(!pattern.test(launch), 'tm-launch obsolete editor stub should be removed: ' + pattern);
});
assert(/function\s+renderRulTab\s*\(/.test(officeEditor) || /window\.renderRulTab\s*=\s*function/.test(read('editor-details.js')), 'active renderRulTab should remain outside tm-launch');
assert(/function\s+renderEvtTab\s*\(/.test(officeEditor) || /window\.renderEvtTab\s*=\s*function/.test(read('editor-details.js')), 'active renderEvtTab should remain outside tm-launch');
assert(/function\s+renderTechTab\s*\(/.test(officeEditor) || /window\.renderTechTab\s*=\s*function/.test(read('editor-details.js')), 'active renderTechTab should remain outside tm-launch');
assert(/renderMapTab\s*=\s*function\s*\(/.test(electron), 'active renderMapTab override should remain in tm-electron');
assert(/function\s+aiGenOfficeEd\s*\(/.test(officeEditor), 'active aiGenOfficeEd should remain in tm-office-editor');
[
  /function\s+renderClassTab\s*\(/,
  /function\s+renderItmTab\s*\(/,
  /function\s+renderMilTab\s*\(/,
  /function\s+renderWldTab\s*\(/
].forEach((pattern) => {
  assert(!pattern.test(launch), 'tm-launch obsolete editor tab stub should be removed: ' + pattern);
});
assert(/window\.renderClassTab\s*=\s*function/.test(editorDetails), 'active renderClassTab should remain in editor-details');
assert(/window\.renderItmTab\s*=\s*function/.test(editorDetails), 'active renderItmTab should remain in editor-details');
assert(/window\.renderWldTab\s*=\s*function/.test(editorDetails), 'active renderWldTab should remain in editor-details');
assert(/wld-ref-section/.test(officeEditor), 'world tab reference-book enhancement should remain in tm-office-editor');
assert(/window\.renderMilTab\s*=\s*function/.test(militaryUi), 'active renderMilTab should remain in tm-military-ui');
assert(/function\s+addMilItem\s*\(/.test(launch), 'military UI helper addMilItem should remain in tm-launch');
assert(/function\s+editMilItem\s*\(/.test(launch), 'military UI helper editMilItem should remain in tm-launch');
assert(/function\s+deleteMilItem\s*\(/.test(launch), 'military UI helper deleteMilItem should remain in tm-launch');
assert(!/renderOfficeTab\s*=\s*function\s*\(/.test(patches), 'obsolete renderOfficeTab override should be removed from tm-patches');
assert(/function\s+renderOfficeTab\s*\(/.test(officeEditor), 'active renderOfficeTab should remain in tm-office-editor');
assert(/office-config-cost-panel/.test(officeEditor), 'active renderOfficeTab should retain officeConfig cost panel');

assert.strictEqual(countMatches(postTurnJobs, /async\s+function\s+_awaitPostTurnJobs\s*\(/g), 1, 'only the enhanced _awaitPostTurnJobs definition should remain');
assert.strictEqual(countMatches(postTurnJobs, /async\s+function\s+_awaitPostTurnJobsForSave\s*\(/g), 1, 'only the enhanced _awaitPostTurnJobsForSave definition should remain');
assert(/function\s+_detachRemainingPostTurnJobs\s*\(/.test(postTurnJobs), 'enhanced post-turn detach helper should remain');

[
  'scenario-style',
  'qiju-history',
  'shiji-history',
  'letters-recent',
  'ai-rules',
  'historical-deviations',
  'game-mode'
].forEach((name) => {
  assert(
    new RegExp("EndTurnHooks\\.registerFragment\\('" + name + "'").test(endturnCore),
    'active end-turn prompt fragment should remain: ' + name
  );
});
assert(
  !/EndTurnHooks\.register\('before', function\(\) \{\s*return; \/\/ \[slice 3b\.4/.test(endturnCore),
  'dead migrated prompt-mutating before-hook shells should stay removed'
);
assert(
  !/GM\._origPrompt(?:2|3|11|Shiji|Ltr|Hist)?\s*(?:=|!|<|>)/.test(endturnCore),
  'dead prompt backup/restore variables should stay out of executable end-turn core'
);
assert(/GM\._historicalDeviations\.forEach/.test(endturnCore) && /ttl--/.test(endturnCore), 'historical-deviations TTL decay hook should remain');

assert(!/function\s+startGame\s*\(\s*sid\s*\)/.test(gameLoop), 'obsolete tm-game-loop startGame owner should be removed after active hooks are migrated');
assert(/startGame\s*=\s*async\s*function\s*\(\s*sid\s*\)/.test(patches), 'active startGame owner should remain in tm-patches');
assert(/function\s+_tmRefreshFactionDerivedRuntime\s*\(/.test(gameLoop), 'enterGame should retain migrated faction derived refresh helper');
assert(/function\s+_installCharPopupOutsideClose\s*\(/.test(gameLoop), 'shared char popup outside-close helper should remain');
assert.strictEqual(
  countMatches(gameLoop, /function\s+_closePopup\s*\(/g),
  0,
  'game-loop should not keep duplicate nested char popup close helpers'
);

[
  'executeRequestFundsBehavior',
  'executeOfficeDutyBehavior',
  'executePrivateLifeBehavior',
  'executeDevelopLocalBehavior',
  'executeReliefBehavior'
].forEach((name) => {
  assert.strictEqual(
    countMatches(npcDecision, new RegExp('function\\s+' + name + '\\s*\\(')),
    1,
    'legacy fixed-effect NPC behavior handler should be removed: ' + name
  );
});
assert(/function\s+_npcEnsureExecutionFactors\s*\(/.test(npcDecision), 'economy-aware NPC execution factors helper should remain');
assert.strictEqual(
  countMatches(threeSystemsUi, /function\s+openForcesRelationsPanel\s*\(/g),
  1,
  'obsolete unselected faction panel implementation should be removed'
);
assert(/function\s+openForcesRelationsPanel\s*\(\s*selectedFacName\s*\)/.test(threeSystemsUi), 'selected faction panel implementation should remain');
assert(!/function\s+_phaseColor\s*\(/.test(threeSystemsUi), 'obsolete faction phase color helper should be removed with the old panel');
assert(!/Legacy single-pass government/.test(editorAiGen), 'unreachable legacy government single-pass block should be removed');
assert(!/Legacy single-pass adminHierarchy/.test(editorAiGen), 'unreachable legacy adminHierarchy single-pass block should be removed');
assert(!/if\s*\(\s*false\s*&&\s*target\s*===\s*['"]government['"]\s*\)/.test(editorAiGen), 'editor-ai-gen should not keep if(false) government code');
assert(!/if\s*\(\s*false\s*&&\s*target\s*===\s*['"]adminHierarchy['"]\s*\)/.test(editorAiGen), 'editor-ai-gen should not keep if(false) adminHierarchy code');
assert(!/if\s*\(\s*false\s*&&\s*typeof\s+openChaoyi\s*===\s*['"]function['"]\s*\)/.test(courtMeter), 'post-turn court should not keep unreachable openChaoyi dead branch');
assert(!/_cc2_openPrepareDialog/.test(courtMeter), 'post-turn court should not keep removed _cc2 prepare-dialog references');
assert(!/var\s+cyBody\s*=\s*null\s*;\s*if\s*\(\s*cyBody\s*\)/.test(courtMeter), 'post-turn court should not keep null cyBody dead render branch');
assert.strictEqual(
  countMatches(editorAdministration, /function\s+initAdministrationPanel\s*\(/g),
  1,
  'obsolete overwritten initAdministrationPanel should be removed from editor-administration'
);
assert(/function\s+_adminBuildOfficialPositionOptions\s*\(/.test(editorAdministration), 'shared admin official option helper should exist');
assert(/function\s+_adminCollectLeafDivisionEntries\s*\(/.test(editorAdministration), 'shared admin leaf-division helper should exist');
assert(/function\s+_adminFindDivisionIn\s*\(/.test(editorAdministration), 'shared admin division lookup helper should exist');
assert.strictEqual(
  countMatches(editorAdministration, /function\s+collectOfficials\s*\(/g),
  0,
  'duplicate nested collectOfficials helpers should be collapsed'
);
assert.strictEqual(
  countMatches(editorAdministration, /function\s+collectLeafDivisions\s*\(/g),
  0,
  'duplicate nested collectLeafDivisions helpers should be collapsed'
);
assert.strictEqual(
  countMatches(editorAdministration, /function\s+findDivision\s*\(/g),
  0,
  'duplicate nested findDivision helpers should be collapsed'
);
assert(/function\s+_walkAdminDivisions\s*\(/.test(integrationBridge), 'shared IntegrationBridge division walker should exist');
assert(
  countMatches(integrationBridge, /function\s+walk\s*\(/g) <= 1,
  'IntegrationBridge should not keep duplicate nested walk helpers'
);
assert(/function\s+_walkOfficeTree\s*\(/.test(endturnHelpers), 'shared end-turn office tree walker should exist');
assert.strictEqual(
  countMatches(endturnHelpers, /function\s+walk\s*\(/g),
  0,
  'end-turn helpers should not keep duplicate nested office walk helpers'
);
assert.strictEqual(
  countMatches(topbarVars, /function\s+_topbarEscHtml\s*\(/g),
  1,
  'topbar shared HTML escape helper should exist once'
);
assert.strictEqual(
  countMatches(topbarVars, /function\s+esc\s*\(/g),
  0,
  'topbar should not keep duplicate nested esc helpers'
);
assert(
  countMatches(topbarVars, /_topbarEscHtml\s*\(/g) > 10,
  'topbar minxin/huji surfaces should use shared HTML escape helper'
);
assert.strictEqual(
  countMatches(endturnQiaozhi, /function\s+_qiaozhiFindDivisionByName\s*\(/g),
  1,
  'qiaozhi shared division-name lookup helper should exist once'
);
assert.strictEqual(
  countMatches(endturnQiaozhi, /function\s+_find\s*\(/g),
  0,
  'qiaozhi should not keep duplicate nested _find helpers'
);
assert.strictEqual(
  countMatches(dataAccess, /function\s+_walkOfficeTree\s*\(/g),
  1,
  'data access shared office-tree walker should exist once'
);
assert(
  countMatches(dataAccess, /function\s+walk\s*\(/g) <= 1,
  'data access should not keep duplicate nested office-tree walk helpers'
);
assert.strictEqual(
  countMatches(aiChangeApplier, /function\s+_tmGateReason\s*\(/g),
  1,
  'AI change applier should keep only the active _tmGateReason implementation'
);
assert.strictEqual(
  countMatches(aiChangeApplier, /function\s+_firstNarrativeHit\s*\(/g),
  1,
  'AI change applier shared narrative keyword helper should exist once'
);
assert.strictEqual(
  countMatches(aiChangeApplier, /function\s+_hit\s*\(/g),
  0,
  'AI change applier should not keep duplicate nested _hit helpers'
);
assert.strictEqual(
  countMatches(indices, /function\s+_tmWalkOfficeChildren\s*\(/g),
  1,
  'indices shared office children walker should exist once'
);
assert.strictEqual(
  countMatches(indices, /function\s+search\s*\(/g),
  0,
  'indices should not keep duplicate nested office search helpers'
);
assert.strictEqual(
  countMatches(officeSystem, /function\s+_offWalkOfficeTree\s*\(/g),
  1,
  'office system shared office-tree walker should exist once'
);
assert.strictEqual(
  countMatches(officeSystem, /function\s+_walk\s*\(/g),
  0,
  'office system should not keep duplicate nested _walk helpers'
);
assert.strictEqual(
  countMatches(keju, /function\s+_kejuWalkDivisions\s*\(/g),
  1,
  'keju shared admin-division walker should exist once'
);
assert.strictEqual(
  countMatches(keju, /function\s+walk\s*\(/g),
  0,
  'keju should not keep duplicate nested admin-division walk helpers'
);
assert.strictEqual(
  countMatches(editorAuthoringAgent, /function\s+_agentClone\s*\(/g),
  1,
  'authoring agent shared clone helper should exist once'
);
assert.strictEqual(
  countMatches(editorAuthoringAgent, /function\s+clone\s*\(/g),
  0,
  'authoring agent should not keep duplicate nested clone helpers'
);
assert.strictEqual(
  countMatches(kejuReformEvolution, /function\s+_kjpAliveNpcName\s*\(/g),
  1,
  'keju reform evolution shared alive NPC filter should exist once'
);
assert.strictEqual(
  countMatches(kejuReformEvolution, /function\s+aliveFilter\s*\(/g),
  0,
  'keju reform evolution should not keep duplicate nested aliveFilter helpers'
);
assert.strictEqual(
  countMatches(kejuReformEvolution, /function\s+clampDim\s*\(/g),
  2,
  'keju reform evolution should keep separate clampDim ranges for L8 and L9 normalization'
);
[
  'buildColorMap',
  'calculateCenter',
  'extractRegionBoundary',
  'extractRegionColor',
  'pointToLineDistance',
  'simplifyBoundary'
].forEach((name) => {
  assert.strictEqual(
    countMatches(mapRecognition, new RegExp('function\\s+' + name + '\\s*\\(', 'g')),
    1,
    'obsolete overwritten map recognition helper should be removed: ' + name
  );
});

// ── 2026-06-16 减量:47 个零引用死函数已删除(全树 ref=1 复核)·锁定防回潮 ──
[
  ['tm-endturn-render.js', ['_renderUnifiedChangesLegacy']],
  ['tm-npc-decision.js', ['executeNpcAction', 'generateWeightReport', 'rankCandidatesByWeight', 'npcExecutionLayer', '_npcHasRealFaction']],
  ['tm-game-loop.js', ['_showEnthronementEvent']],
  ['tm-military.js', ['startBuildingUpgrade', 'generateBattleStrategyReport', 'recruitUnit', 'transferUnit', 'disbandUnit', 'generateArmyCompositionReport', 'getCharacterResidence']],
  ['tm-feudal.js', ['revokeTitle', 'getHighestTitle', 'cutSupplyRoute', 'getAutonomyPermission']],
  ['tm-map-system.js', ['generateVoronoiMap', 'applyTerrainEffects', 'setPolygonTerrain']],
  ['tm-mechanics.js', ['processCharacterDeath', 'showDeathNotification']],
  ['phase8-formal-map.js', ['regionIdentity', 'objectValue', 'realmFactionSub', 'anyDisplayValue']],
  ['tm-content-manager.js', ['catalogPackRowV2', 'commentRow']],
  ['tm-ai-infra.js', ['buildTimeTriad', 'xmlTag', 'getFullDateStr', 'turnToDay', 'getAICacheStats']],
  ['tm-keju.js', ['_kejuFindDivision']],
  ['phase8-formal-drafts.js', ['getEdictArchiveRows', 'getFormalEdictCategories', 'letterStateClassFormal']],
  ['phase8-formal-bridge.js', ['pendingEdictCount', 'pendingLetterCount', 'recordCount', 'showLegacy']],
  ['generated/tm-ai-change-applier.bundle.js', ['_tmExistsChar', '_tmExistsFaction']],
  ['tm-corruption-engine.js', ['setIfDef']],
  ['tm-wendui.js', ['setWenduiMode']],
  ['tm-chaoyi-changchao.js', ['_cc3_checkDeptAbsenceMalus']],
  ['tm-npc-engine.js', ['generateChangeReport', 'toggleSection', 'updatePartyLoyaltyLink',
    'buildNpcContext', 'getCharacterFromContext', 'getFactionFromContext', 'getVariableFromContext',
    'getRelationFromContext', 'getOpinionFromContext', 'getMilitaryStrengthFromContext', 'getEconomicLevelFromContext',
    'calculateDecisionWeight', 'evaluateCondition', 'generateDecisionsForActor', 'executeNpcDecisions']]
].forEach((entry) => {
  const src = read(entry[0]);
  entry[1].forEach((name) => {
    assert(
      !new RegExp('function\\s+' + name + '\\s*\\(').test(src),
      '[减量2026-06-16] ' + entry[0] + ' 的零引用死函数应保持删除: ' + name
    );
  });
});
// closeMapDossier 曾有重复定义(旧版已删)·锁定只剩一个(完整版)
assert.strictEqual(
  countMatches(read('phase8-formal-map.js'), /function\s+closeMapDossier\s*\(/g),
  1,
  'closeMapDossier duplicate definition should stay removed (only fuller version remains)'
);
// tm-test.js 整文件已删除(dev-only·runAllTests 零消费方)·锁定不回潮
assert(!fs.existsSync(path.join(root, 'tm-test.js')), 'tm-test.js (dev-only test harness) should stay deleted');
assert(!/tm-test\.js/.test(read('index.html')), 'index.html should not reload the deleted tm-test.js');

// ── npc-engine 决策死簇切除(2026-06-16)·锁定 IIFE + 解线不回潮 ──
const npcEngineSrc = read('tm-npc-engine.js');
assert(!/var\s+InteractionSystem\s*=\s*\(function/.test(npcEngineSrc), 'dead InteractionSystem IIFE should stay removed');
assert(!/var\s+NpcEngine\s*=\s*\(function/.test(npcEngineSrc), 'dead NpcEngine driver IIFE should stay removed');
// live 部分必须保留
assert(/window\.TM\.NpcEngine\.aggregateDims\s*=\s*_aggregatePersonalityDims/.test(npcEngineSrc), 'live TM.NpcEngine.aggregateDims export must remain');
assert(/var\s+CentralizationSystem\s*=\s*\(function/.test(npcEngineSrc), 'live CentralizationSystem must remain');
assert(/function\s+resetTurnChanges\s*\(/.test(npcEngineSrc) && /function\s+evaluateThresholdTriggers\s*\(/.test(npcEngineSrc), 'live resetTurnChanges/evaluateThresholdTriggers must remain');
// 5-file 解线:死调用/死注册保持移除
assert(!/NpcEngine\.runEngine\s*\(/.test(read('tm-endturn-systems.js')), 'dead NpcEngine.runEngine() call should stay removed');
assert(!/InteractionSystem\.initialize\s*\(/.test((read('tm-patches.js') + '\n' + read('tm-patches-start.js'))) && !/NpcEngine\.initialize\s*\(/.test((read('tm-patches.js') + '\n' + read('tm-patches-start.js'))), 'dead InteractionSystem/NpcEngine.initialize() calls should stay removed');
assert(!/_buildWindowRefGroup\('NPC\.legacy'/.test(read('tm-namespaces.js')), 'dead NPC.legacy namespace group should stay removed');

// ── 二阶死代码切除(2026-06-16·被删发射器/调用方留下的孤儿)·锁定不回潮 ──
[
  ['tm-game-loop.js', ['_confirmEnthronement']],
  ['tm-map-system.js', ['delaunayTriangulation', 'generateVoronoiCells', 'clipVoronoiCells']],
  ['tm-military.js', ['getBuildingCost', 'getBuildingTime']],
  ['tm-feudal.js', ['revokeFief']],
  ['tm-mechanics.js', ['removeFromOfficeTree']]
].forEach((entry) => {
  const src = read(entry[0]);
  entry[1].forEach((name) => {
    assert(!new RegExp('function\\s+' + name + '\\s*\\(').test(src), '[二阶减量2026-06-16] ' + entry[0] + ' 的孤儿死函数应保持删除: ' + name);
  });
});

// ── 2026-07-07 死代码清除刀:76 个零引用死函数已删除(全语料 token 零引用+逐个动态拼名/JSON 复核)·锁定防回潮 ──
[
  ['editor-administration.js', ['deleteAdminDivisionConfirm','exportRegionsData','exportGeographyData','batchAssignRegions','renderGeographyInfo','aiGenerateCities','importCitiesFromFile','aiGenerateAdminHierarchyDelegate','checkDivisionPermission','syncCapitalLinkage']],
  ['editor-crud.js', ['_readJsonField']],
  ['editor-government.js', ['_govFnDel']],
  ['editor.js', ['addMapItem','checkOfficialVassalMatch']],
  ['map-editor-tools.js', ['findEdgeNear','findEdgeNearMulti']],
  ['map-recognition.js', ['sortBoundaryPoints','closeBorderGaps']],
  ['phase8-formal-records.js', ['formalRecordRows','renderRecordExportButton']],
  ['tm-ai-infra-model-detect.js', ['probeModelEvidenceAuditLegacy']],
  ['tm-change-queue.js', ['safeUpdateProperty','makeNewEntityReactive']],
  ['tm-content-manager.js', ['renderUpdateTab','renderOnlineTab','renderHotUpdateTab','renderWorkshopTab','renderOnlineTabV2','renderUpdateTabV2','renderHotUpdateTabV2']],
  ['tm-dynamic-systems.js', ['createPost','transferPost','findPostsByTerritory','findPostByHolder','getPostStatistics','checkHierarchy','checkAchievements','openAchievements','clearAICache','resetAIStats']],
  ['tm-endturn-province.js', ['executeProvincePolicy','appointProvinceGovernor','_peSectionV2','formatNumberComma']],
  ['tm-feudal.js', ['getFeudalLevel']],
  ['tm-guoku-engine.js', ['triggerBankruptcyEvent']],
  ['tm-guoku-panel.js', ['_guoku_banPrivate','_guoku_newCoin']],
  ['tm-help-social.js', ['batchProcessNPCs']],
  ['tm-huji-deep-fill.js', ['_computeCapitalPullRate']],
  ['tm-indices.js', ['rebuildIndices','updateIndex','updateScenarioIndex']],
  ['tm-influence-groups.js', ['isMale']],
  ['tm-keju-wuju.js', ['_kjG3DeriveStance']],
  ['tm-lizhi-panel.js', ['_lizhi_handleCase']],
  ['tm-map-system.js', ['sortVerticesByAngle','clipPolygonToBounds']],
  ['tm-mechanics-world.js', ['getFamilyBranch','addToFamily','createBranch','getFamilyBarrierMultiplier']],
  ['tm-memory-retrieval.js', ['suppressSupersededHits']],
  ['tm-memory-turn-rollup.js', ['pushRef']],
  ['tm-office-editor.js', ['_addOfficeDept','_addOfficePos']],
  ['tm-office-panel.js', ['updOffNode','addGameDept','submitOfficeCh']],
  ['tm-office-runtime.js', ['_adaptForOld']],
  ['tm-party-goals.js', ['supportingPartyNamesForClass']],
  ['tm-player-settings.js', ['_saveAPIAndAutoProbe']],
  ['tm-renwu-tuzhi.js', ['tabStub']],
  ['tm-three-systems-ui.js', ['_aiDbgCounts','_aiDbgPairs']],
  ['tm-topbar-vars.js', ['_showStubPanel']]
].forEach((entry) => {
  const src = read(entry[0]);
  entry[1].forEach((name) => {
    assert(
      !new RegExp('function\\s+' + name + '\\s*\\(').test(src),
      '[死代码清除2026-07-07] ' + entry[0] + ' 的零引用死函数应保持删除: ' + name
    );
  });
});

// ---------- 2026-11-16 死代码普查（名单存 E:\\tianming-archive\\deadscan-20261116）----------
// 一、被后面装载的脚本整个换掉的旧函数：旧的删了，接手的那一个必须还在。
assert(/window\.openCharRenwuPage\s*=\s*function/.test(read('tm-renwu-tuzhi.js')), '人物志入口由 tm-renwu-tuzhi.js 接管');
['aiGenChr', 'aiGenFac', 'aiGenVar', 'aiGenCivic', 'aiGenFullScenario'].forEach((name) => {
  assert(new RegExp('window\\.' + name + '\\s*=').test(officeEditor), name + ' 由 tm-office-editor.js 接管');
});
['editChr', 'renderRulTab', 'renderEvtTab', 'renderFacTab', 'renderTechTab'].forEach((name) => {
  assert(new RegExp('window\\.' + name + '\\s*=').test(editorDetails), name + ' 由 editor-details.js 接管');
});
// 二、定义之后再没有任何地方提到的函数声明（含上面被换掉的旧函数）：保持删除。
[
  ['editor-authoring-agent-ui.js', ['_validationDelta']],
  ['editor.js', ['_collectDivisionNames']],
  ['map-editor-brush.js', ['recur']],
  ['phase8-formal-bridge.js', ['getFactions', 'topbarBannerText']],
  ['phase8-formal-drafts.js', ['openGuoku', 'returnFormalHomeSoon']],
  ['phase8-formal-map.js', ['closeModule', 'moduleShell', 'openGuoku', 'openModule', 'regionChildIndex', 'riskClass']],
  ['phase8-formal-rightrail.js', ['rightIssueFaction', 'rightIssuePersonButton', 'rightIssueRows']],
  ['phase8-formal-rightrail-social.js', ['closeDeskOverlay', 'closeModule', 'closeRightDrawer', 'openGuoku', 'openHongyanPreviewPanel', 'openModule', 'openOfficeStandalone', 'openPanel', 'openShiluPreviewPanel', 'returnFormalHomeSoon', 'saveFormalDraftsToGM']],
  ['preview/scenario-editor-reset-app.js', ['adminWalkFind', 'isDomFile']],
  ['tm-chaoyi-changchao.js', ['getAIConfig', 'saveAIConfig', 'showAIConfigModal']],
  ['tm-class-character-relations.js', ['categoryHits', 'classHasRepresentative', 'partySupportsClass', 'scorePair']],
  ['tm-content-manager.js', ['changelogSummary', 'resetAccountRemoteState']],
  ['tm-corruption-cases.js', ['clamp']],
  ['tm-corruption-extras.js', ['safe']],
  ['tm-desktop-update.js', ['checkWhenClear', 'modalInWay']],
  ['tm-dynamic-systems.js', ['calculateSalary']],
  ['tm-faction-diplomacy.js', ['notice']],
  ['tm-faction-npc-chaoyi.js', ['_arr', '_isAlive', '_isMarkedPlayerFaction', '_isPlayerFaction', '_normFactionName', '_resolvePlayerFactionNames']],
  ['tm-faction-npc-edict.js', ['_applyEffects', '_arr', '_clampLoyalty', '_classifyChar', '_isAlive', '_isMarkedPlayerFaction', '_isPlayerFaction', '_normFactionName', '_resolvePlayerFactionNames']],
  ['tm-faction-npc-llm-decision.js', ['_applyDiplomacy', '_armyCommander', '_clamp', '_findArmy', '_findRelationRecord', '_pushFacTrajectory', '_syncArmyCommanderAliases', '_upsertRelationRecord']],
  ['tm-faction-npc-llm-enrich.js', ['_safeNum']],
  ['tm-faction-npc-memorial.js', ['_isAlive', '_isMarkedPlayerFaction', '_isPlayerFaction', '_normFactionName', '_resolvePlayerFactionNames']],
  ['tm-faction-npc-office.js', ['_arr', '_clamp', '_isAlive', '_isMarkedPlayerFaction', '_isPlayerFaction', '_normFactionName', '_resolvePlayerFactionNames']],
  ['tm-feudal.js', ['autoQuanxuanAndAppoint', 'createSupplyRoute', 'generateQuanxuanReport', 'generateSupplyReport', 'getAllVassals', 'levyVassalArmies', 'performQuanxuan', 'promoteTitle', 'quanxuanFinalDecision', 'quanxuanRefinedSelection']],
  ['tm-launch.js', ['aiGenChr', 'aiGenCivic', 'aiGenFac', 'aiGenFullScenario', 'aiGenVar', 'editChr']],
  ['tm-lizhi-panel.js', ['_lizhi_applyHandling', '_lizhi_handleActiveCase']],
  ['tm-map-system.js', ['_mapSourceIsTemplate', 'calculateCircumcenter', 'closeInteractiveMap', 'computeIntersection', 'edgesEqual', 'findCityByName', 'isInsideBoundary', 'migrateLegacyRuntimeMap', 'openInteractiveMap', 'pointInCircumcircle']],
  ['tm-matters.js', ['has']],
  ['tm-mechanics-world.js', ['getFamilyOf']],
  ['tm-memory-hybrid.js', ['overlap']],
  ['tm-memory-retrieval.js', ['hitMatchesNode']],
  ['tm-minxin-hard-link-consumers.js', ['ensureObject']],
  ['tm-npc-action-ledger.js', ['bumpRevision']],
  ['tm-npc-decision.js', ['_getNpcActionLedger', '_getNpcDecisionBatchPersonaMaxLen', '_npcActionCooldownTurns', '_npcAdjustFamilySharedWealth', '_npcAdjustGuoku', '_npcAdjustPrivateWealth', '_npcAdjustProvinceStat', '_npcAdjustPublicPurse', '_npcApplyPublicGrant', '_npcEnsureCharResources', '_npcEnsureProvinceStats', '_npcFindFamilyRecord', '_npcHistoryKindForAction', '_npcLiveCharacters', '_npcProvinceKeyFor', '_npcPushExecutionResult', '_npcRecentTargetPenalty', '_npcRecordMoneyAction', '_npcRound', '_npcSameFaction', '_npcTargetSort', '_recordNpcActionLedger']],
  ['tm-npc-decision-ai-driven.js', ['_getNpcDecisionHandledNames', '_isNpcIdleBehaviorAllowed', '_markNpcDecisionHandled', '_npcApplyPlanningOutput', '_npcBuildCharacterEconomyContext', '_npcCharacterEconomyScore']],
  ['tm-npc-travel.js', ['inferredOfficeConstraint']],
  ['tm-office-editor.js', ['aiGenOfficeStaff', 'renderEvtTab', 'renderFacTab', 'renderRulTab', 'renderTechTab']],
  ['tm-office-runtime-summary-appoint.js', ['_offAutoFill']],
  ['tm-office-tenure.js', ['controlled']],
  ['tm-player-core.js', ['_dfBar', '_rwpAbilityRankLabel', '_rwpAmbitionTag', '_rwpHeartVerdict', '_rwpLoyaltyTag', '_rwpRenderFamilyTree', '_rwpResItem', '_rwpSwitchTab', '_rwpXianPct', 'openCharRenwuPage']],
  ['tm-player-settings.js', ['_testSecondaryAPI', 'sToggleInsecureTlsRelay']],
  ['tm-state.js', ['_safeClone']],
  ['tm-utils.js', ['_toggleDialogueDebug', 'gSid', 'showNotificationHistory']],
  ['tm-world-view.js', ['closeEraTrends', 'closeHistoricalEvents']],
  ['tm-world.js', ['_sl', '_sn']]
].forEach((entry) => {
  const src = read(entry[0]);
  entry[1].forEach((name) => {
    assert(
      !new RegExp('function\\s+' + name.replace(/[$]/g, '\\$&') + '\\s*\\(').test(src),
      '[死代码清除2026-11-16] ' + entry[0] + ' 的作废函数应保持删除: ' + name
    );
  });
});

console.log('smoke-dead-code-removal-guards ok');

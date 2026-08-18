#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let assertions = 0;
function check(cond, message) {
  if (!cond) throw new Error('[smoke-ai-writeback-integrity] ' + message);
  assertions++;
}

function baseGM(extra) {
  return Object.assign({
    turn: 9,
    chars: [], facs: [], parties: [], classes: [], armies: [], activeProjects: [],
    activeWars: [], activeDisasters: [], activeEdicts: [], omens: [], religions: [],
    minxin: { trueIndex: 50, revolts: [] }, corruption: { trueIndex: 20 },
    guoku: { money: 1000 }, neitang: { money: 500 },
    adminHierarchy: {}, _turnReport: [], turnChanges: { variables: [], characters: [] },
    memorials: [], currentIssues: []
  }, extra || {});
}

function makeContext() {
  const quietConsole = { log() {}, warn() {}, info() {}, error() {} };
  const ctx = {
    console: quietConsole,
    Math, Date, JSON, Object, Array, Number, String, Boolean, RegExp,
    isFinite, isNaN, parseInt, parseFloat, Promise, Symbol, Map, Set,
    setTimeout: () => 0, clearTimeout() {}, Error, TypeError, RangeError,
    TM: { errors: { capture() {}, captureSilent() {} } },
    P: {}, GM: baseGM(),
    addEB() {}, recordAIDiagnostic() {},
    renderTopBarVars() {}, syncArmiesToMap() {}, renderMap() {}, syncMilitarySources() {}
  };
  ctx.window = ctx;
  ctx.global = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  [
    'tm-ai-change-pathutils.js',
    'tm-ai-change-army.js',
    'tm-ai-change-narrative.js',
    'tm-ai-change-applier.js',
    'tm-ai-change-applier-validators.js',
    'tm-ai-change-applier-reconcile.js'
  ].forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx, { filename: file });
  });
  ctx._deathCalls = [];
  ctx.applyOneDeath = function applyOneDeathStub(cd) {
    const ch = (ctx.GM.chars || []).find((c) => c && c.name === cd.name);
    ctx._deathCalls.push({ name: cd.name, reason: cd.reason });
    if (ch) { ch.alive = false; ch.dead = true; ch.deathReason = cd.reason; }
  };
  return ctx;
}

function makeDeathContext() {
  const ctx = {
    console: { log() {}, warn() {}, info() {}, error() {} },
    Math, Date, JSON, Object, Array, Number, String, Boolean, RegExp,
    isFinite, isNaN, parseInt, parseFloat, Error,
    P: { playerInfo: { characterName: '天子' }, adminHierarchy: {} },
    GM: baseGM({ chars: [{ name: '天子', id: 'player_1', isPlayer: true, alive: true, officialTitle: '皇帝' }] }),
    _dbg() {},
    GameEventBus: { emit() { ctx._busDeaths++; } },
    _deathEvents: 0, _busDeaths: 0, _adjudications: 0
  };
  ctx.findCharByName = (name) => ctx.GM.chars.find((c) => c && c.name === name) || null;
  ctx._fuzzyFindChar = (name) => ctx.GM.chars.find((c) => c && (c.name === name || c.id === name)) || null;
  ctx.addEB = () => { ctx._deathEvents++; };
  ctx.adjudicatePlayerDeath = (ch, reason) => { ctx._adjudications++; ctx.GM._playerDeathReason = reason; };
  ctx.window = ctx;
  ctx.global = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-ai-apply-deaths.js'), 'utf8'), ctx, { filename: 'tm-ai-apply-deaths.js' });
  return ctx;
}

async function main() {
  const ctx = makeContext();

  // A. char_updates 存亡旁路必须规范化到 character_deaths，并只经 applyOneDeath 落账。
  ctx.GM = baseGM({ chars: [{ name: '甲将', alive: true, stress: 0 }] });
  const deathInput = {
    char_updates: [{
      name: '甲将', reason: '战阵中流矢',
      updates: { alive: false, dead: true, _deathCause: '裸写不得入库', stress: 8 }
    }]
  };
  const deathRes = ctx.applyAITurnChanges(deathInput);
  check(ctx._deathCalls.length === 1 && ctx._deathCalls[0].name === '甲将', 'char_updates death must call applyOneDeath exactly once');
  check(ctx.GM.chars[0].alive === false && ctx.GM.chars[0].dead === true, 'death pipeline must own final state');
  check(deathInput.character_deaths.length === 1 && deathInput.character_deaths[0].reason === '战阵中流矢', 'death must normalize to character_deaths with reason: ' + JSON.stringify(deathInput.character_deaths));
  check(!Object.prototype.hasOwnProperty.call(deathInput.char_updates[0].updates, 'alive') &&
    !Object.prototype.hasOwnProperty.call(deathInput.char_updates[0].updates, 'dead') &&
    !Object.prototype.hasOwnProperty.call(deathInput.char_updates[0].updates, '_deathCause'), 'bare death fields must be removed before generic merge');
  check(ctx.GM.chars[0].stress === 8, 'non-sensitive char update fields must still apply');
  check(deathRes.applied.semantic.character_deaths_normalized === 1, 'normalized death count must be observable');

  ctx.GM = baseGM({ chars: [{ name: '乙将', alive: true }] });
  ctx._deathCalls.length = 0;
  const duplicateDeath = { character_deaths: [{ name: '乙将', reason: '既有结构化条目' }], char_updates: [{ name: '乙将', updates: { alive: false } }] };
  ctx.applyAITurnChanges(duplicateDeath);
  check(ctx._deathCalls.length === 1, 'matching explicit and normalized death entries must share one death sink call');
  check(duplicateDeath.character_deaths.length === 1, 'death normalization must deduplicate an existing character_deaths entry');

  ctx.GM = baseGM({ chars: [{ name: '真人', alive: true }] });
  ctx._deathCalls.length = 0;
  const ghostDeath = ctx.applyAITurnChanges({ char_updates: [{ name: '王二麻子', updates: { alive: false } }] });
  check(ctx._deathCalls.length === 0 && ctx.GM.chars[0].alive === true, 'unknown death target must not fuzzy-hit or create a character');
  check(ghostDeath.applied.failed.some((f) => /existing living character/.test(f.reason || '')), 'unknown death rejection must be visible');

  // B. changes/anyPath 强类型、敏感路径、P 根、原型链与 merge 语义。
  ctx.GM = baseGM({
    chars: [{ name: '真人', alive: true, officialTitle: '旧职' }],
    custom: { score: 40, label: '甲', settings: { a: 1, nested: { x: 1 } } }
  });
  ctx.GM._indices = { charByName: new Map([['真人', ctx.GM.chars[0]]]) };
  ctx.P._indices = { scenarioById: new Map() };
  const pathRes = ctx.applyAITurnChanges({
    changes: [
      { path: 'custom.score', delta: '5', reason: '字符串不得通过' },
      { path: 'custom.score', delta: 5, reason: '真数值可通过' },
      { path: 'chars.真人.alive', op: 'set', value: false },
      { path: 'chars.真人.officialTitle', op: 'set', value: '幽灵官职' },
      { path: 'chars.真人._fakeDeath', op: 'set', value: true },
      { path: 'custom.__proto__.polluted', op: 'set', value: true }
    ],
    anyPathChanges: [
      { path: 'P.officeTree', op: 'set', value: [{ name: '伪官制' }] },
      { path: 'custom.settings', op: 'merge', value: { b: 2, nested: { y: 3 } } },
      { path: 'custom.settings', op: 'merge', value: { constructor: { prototype: { polluted: true } } } },
      { path: 'custom.score', op: 'delta', value: '7' }
    ]
  });
  check(pathRes.ok === false && pathRes.rolledBack === true, 'one rejected operation must reject and roll back the whole AI batch');
  check(ctx.GM.custom.score === 40 && typeof ctx.GM.custom.score === 'number', 'valid siblings must not survive a rejected batch');
  check(ctx.GM.custom.settings.a === 1 && !Object.prototype.hasOwnProperty.call(ctx.GM.custom.settings, 'b') &&
    ctx.GM.custom.settings.nested.x === 1 && !Object.prototype.hasOwnProperty.call(ctx.GM.custom.settings.nested, 'y'), 'merge may not invent unknown schema fields and rejected batch must leave the object unchanged');
  check(ctx.GM.chars[0].alive === true && ctx.GM.chars[0].officialTitle === '旧职' && !ctx.GM.chars[0]._fakeDeath, 'death/office/internal paths must be blocked');
  check(!ctx.GM.P && Object.prototype.polluted === undefined, 'P root and prototype pollution must be blocked');
  check(!Object.prototype.hasOwnProperty.call(ctx.GM, '_indices') && !Object.prototype.hasOwnProperty.call(ctx.P, '_indices'), 'rollback without buildIndices must discard non-serializable index caches instead of restoring malformed plain objects');
  check(pathRes.applied.failed.length >= 7, 'every rejected path operation must surface in applied.failed');
  const directBlocked = ctx.TM.AIChange.PathUtils.applyPathSet(ctx.GM, 'chars.真人.alive', false, 'direct sink probe');
  check(!directBlocked.ok && ctx.GM.chars[0].alive === true, 'PathUtils sink itself must reject sensitive paths even without dispatcher precheck');

  // B2. "+field" 旧数组追加语法必须先规范化 realKey 再校验，不能绕过存亡/内部/原型保护。
  const attackedChar = ctx.GM.chars[0];
  const originalProto = Object.getPrototypeOf(attackedChar);
  const appendAttackRes = ctx.applyAITurnChanges({
    char_updates: [{ name: '真人', updates: {
      '+alive': false,
      '+_deathCause': '旁路伪死因',
      '+__proto__': { polluted: true }
    } }]
  });
  check(attackedChar.alive === true && appendAttackRes.applied.failed.some((f) => f.updateKey === '+alive'), '+alive must be rejected visibly without mutating survival state');
  check(!Object.prototype.hasOwnProperty.call(attackedChar, '_deathCause') && appendAttackRes.applied.failed.some((f) => f.updateKey === '+_deathCause'), '+_deathCause must be rejected visibly');
  check(Object.getPrototypeOf(attackedChar) === originalProto && Object.prototype.polluted === undefined && appendAttackRes.applied.failed.some((f) => f.updateKey === '+__proto__'), '+__proto__ must not alter the character prototype and must fail visibly');

  const allowedAppendRes = ctx.applyAITurnChanges({ char_updates: [{ name: '真人', updates: { '+careerHistory': { title: '合法履历追加' } } }] });
  check(Array.isArray(ctx.GM.chars[0].careerHistory) && ctx.GM.chars[0].careerHistory.length === 1 && allowedAppendRes.applied.failed.length === 0, 'only explicitly allowed careerHistory array append may apply');

  // C. faction leader 与 army commander 的最终 sink 只接受真实活人，并同步所有镜像。
  ctx.GM = baseGM({
    chars: [{ name: '韩旷', id: 'char_hankuang', alive: true }, { name: '亡将', alive: false, dead: true }],
    facs: [{ name: '东林', leader: '旧首', leaderName: '旧首', ruler: '旧首', leaderInfo: { name: '旧首' } }],
    armies: [{ name: '京营', commander: '旧将', commanderName: '旧将', general: '旧将', leader: '旧将', soldiers: 1000 }]
  });
  const livingRes = ctx.applyAITurnChanges({
    faction_updates: [{ name: '东林', updates: { leader: 'char_hankuang', ruler: 'char_hankuang', leadership: { ruler: 'char_hankuang', successionRule: '推举' }, leaderInfo: { name: 'char_hankuang', bio: '新任' } } }],
    army_changes: [{ name: '京营', newCommander: 'char_hankuang', reason: '奉诏易帅' }]
  });
  const fac = ctx.GM.facs[0], army = ctx.GM.armies[0];
  check(fac.leader === '韩旷' && fac.leaderName === '韩旷' && fac.ruler === '韩旷' && fac.leadership.ruler === '韩旷' && fac.leaderInfo.name === '韩旷', 'faction leader mirrors must stay synchronized');
  check(fac.leaderInfo.bio === '新任' && fac.leadership.successionRule === '推举' && livingRes.applied.semantic.faction_updates === 3, 'legal leaderInfo/leadership metadata and faction update field count must survive semantic leader routing');
  check(army.commander === '韩旷' && army.commanderName === '韩旷' && army.general === '韩旷' && army.leader === '韩旷', 'army commander aliases must stay synchronized to canonical living name');
  check(livingRes.applied.failed.length === 0, 'valid living leader/commander writes must not fail');
  const noopLeader = ctx.applyAITurnChanges({ faction_updates: [{ name: '东林', updates: { leader: 'char_hankuang' } }] });
  check(noopLeader.applied.failed.length === 0, 'already-synchronized valid leader update must be an accepted no-op');

  const malformedMirrorRes = ctx.applyAITurnChanges({
    faction_updates: [
      { name: '东林', updates: { leader: 'char_hankuang', leaderInfo: null, leadership: ['王二麻子'] } },
      { name: '东林', updates: { leaderInfo: /伪容器/, leadership: new Date(0) } }
    ]
  });
  check(fac.leader === '韩旷' && fac.leaderName === '韩旷' && fac.ruler === '韩旷'
    && fac.leadership && !Array.isArray(fac.leadership) && fac.leadership.ruler === '韩旷'
    && fac.leaderInfo && !Array.isArray(fac.leaderInfo) && fac.leaderInfo.name === '韩旷', 'malformed leader containers must not overwrite synchronized faction mirrors');
  check(malformedMirrorRes.applied.failed.filter((f) => f.updateKey === 'leaderInfo').length === 2
    && malformedMirrorRes.applied.failed.filter((f) => f.updateKey === 'leadership').length === 2, 'null/array and non-plain leader containers must all fail visibly');

  const invalidRes = ctx.applyAITurnChanges({
    faction_updates: [{ name: '东林', updates: { leader: '王二麻子' } }, { name: '东林', updates: { ruler: '亡将' } }],
    army_changes: [{ name: '京营', commander: '王二麻子' }, { name: '京营', commander: '亡将' }, { name: '京营', commander: '韩旷', leaderName: '亡将' }]
  });
  check(fac.leader === '韩旷' && army.commander === '韩旷', 'ghost/dead leader or commander must leave prior valid state intact');
  check(invalidRes.applied.failed.length === 5, 'ghost/dead/conflicting leader and commander rejections must all be observable');

  // C1. validator 抛异常不能再被 catch 后吞掉：严格回合写回必须整批回滚。
  ctx.GM = baseGM({ custom: { score: 10 } });
  ctx._validateLivingActorConsistency = function() { throw new Error('synthetic validator crash'); };
  const validatorCrash = ctx.applyAITurnChanges({
    _strictValidation: true,
    changes: [{ path: 'custom.score', delta: 5, reason: 'validator rollback probe' }]
  });
  check(validatorCrash.ok === false && validatorCrash.rolledBack === true, 'strict validator exception must reject the whole AI transaction');
  check(ctx.GM.custom.score === 10, 'strict validator exception must restore writes made before validation');
  check(validatorCrash.applied.failed.some((row) => row.validator === 'livingActor' && row.reason === 'validator exception'
    && Array.isArray(row.details) && row.details.some((detail) => /synthetic validator crash/.test(detail))),
  'validator exception must be observable with validator identity and error detail');
  delete ctx._validateLivingActorConsistency;

  // C2. party leader/head 同样只走真实活人 sink，合法 ID 归一并同步镜像。
  ctx.GM = baseGM({
    chars: [{ name: '韩旷', id: 'char_hankuang', alive: true }, { name: '亡将', alive: false, dead: true }],
    parties: [{ name: '清议党', leader: '旧首', head: '旧首', cohesion: 50 }]
  });
  const validParty = ctx.applyAITurnChanges({ party_updates: [{ name: '清议党', updates: { leader: 'char_hankuang', head: 'char_hankuang', cohesion: 75 } }] });
  check(ctx.GM.parties[0].leader === '韩旷' && ctx.GM.parties[0].head === '韩旷' && ctx.GM.parties[0].cohesion === 75, 'valid living party leader id must canonicalize and synchronize leader/head while preserving legal fields');
  check(validParty.applied.failed.length === 0, 'valid living party leader update must not fail');
  const invalidParty = ctx.applyAITurnChanges({ party_updates: [
    { name: '清议党', updates: { leader: '王二麻子' } },
    { name: '清议党', updates: { head: '亡将' } },
    { name: '清议党', updates: { leader: '韩旷', head: '亡将' } },
    { name: '清议党', updates: { nested: { constructor: { prototype: { polluted: true } } } } }
  ] });
  check(ctx.GM.parties[0].leader === '韩旷' && ctx.GM.parties[0].head === '韩旷' && Object.prototype.polluted === undefined, 'ghost/dead/conflicting party leaders and nested prototype payloads must leave state intact');
  check(invalidParty.applied.failed.length === 4, 'every invalid party leader/prototype update must leave an applied.failed trace');
  const partyPath = ctx.TM.AIChange.PathUtils.applyPathSet(ctx.GM, 'parties.0.head', '亡将', 'direct bypass probe');
  check(!partyPath.ok && ctx.GM.parties[0].head === '韩旷', 'direct anyPath party leader/head bypass must be blocked at PathUtils sink');

  ctx.GM.facs = [{ name: '东林', leader: '韩旷' }];
  const succession = {
    faction_succession: [
      { faction: '东林', newLeader: 'char_hankuang', reason: '合法继统' },
      { faction: '东林', newLeader: '王二麻子', reason: '幽灵不得继统' },
      { faction: '东林', newLeader: '亡将', reason: '亡者不得继统' },
      { faction: '不存在势力', newLeader: '韩旷', reason: '幽灵势力不得继统' }
    ]
  };
  ctx.preflightAIWriteBack(succession);
  check(succession.faction_succession.length === 1, 'succession preflight must reject ghost faction and ghost/dead leaders');
  check(succession.faction_succession[0].faction === '东林' && succession.faction_succession[0].newLeader === '韩旷', 'succession preflight must canonicalize exact ids to active names');

  const leaderPreflight = {
    faction_events: [{ actor: '东林', action: '政变成功', newLeader: 'char_hankuang' }, { actor: '东林', action: '政变成功', newLeader: '亡将' }],
    party_changes: [{ name: '清议党', new_leader: 'char_hankuang' }, { name: '清议党', new_leader: '王二麻子' }],
    party_splinter: [{ parent: '清议党', newName: '新党', newLeader: 'char_hankuang' }, { parent: '清议党', newName: '鬼党', newLeader: '亡将' }],
    party_create: [{ name: '正党', leader: 'char_hankuang' }, { name: '幽党', leader: '王二麻子' }],
    faction_create: [{ name: '新军', leader: 'char_hankuang', reason: '立旗' }, { name: '鬼军', leader: '亡将', reason: '立旗' }],
    party_updates: [{ name: '清议党', updates: { head: 'char_hankuang' } }]
  };
  ctx.preflightAIWriteBack(leaderPreflight);
  check(leaderPreflight.faction_events[0].newLeader === '韩旷' && leaderPreflight.party_changes[0].new_leader === '韩旷' && leaderPreflight.party_updates[0].updates.leader === '韩旷', 'preflight must canonicalize valid leader ids across faction events, party changes and party updates');
  check(leaderPreflight.party_splinter.length === 1 && leaderPreflight.party_splinter[0].newLeader === '韩旷' && leaderPreflight.party_create.length === 1 && leaderPreflight.party_create[0].leader === '韩旷' && leaderPreflight.faction_create.length === 1 && leaderPreflight.faction_create[0].leader === '韩旷', 'creation/splinter preflight must reject ghost/dead leaders and keep canonical living leaders');

  // C3. 真死亡 sink：玩家死亡必须进入裁决器，重复投递不得重跑级联或事件。
  const deathCtx = makeDeathContext();
  deathCtx.applyOneDeath({ name: 'player_1', reason: '宫变遇害' });
  deathCtx.applyOneDeath({ name: '天子', reason: '重复死亡不得重算' });
  check(deathCtx.GM.chars[0].alive === false && deathCtx.GM.chars[0].dead === true && deathCtx._adjudications === 1, 'player death must adjudicate exactly once through applyOneDeath');
  check(deathCtx._busDeaths === 1 && deathCtx._deathEvents === 1 && deathCtx.GM._playerDeathReason === '宫变遇害', 'duplicate death delivery must not repeat event or overwrite original death reason');
  const endturnApplySource = fs.readFileSync(path.join(ROOT, 'tm-endturn-apply.js'), 'utf8');
  const endturnStagesSource = fs.readFileSync(path.join(ROOT, 'tm-endturn-apply-stages.js'), 'utf8');
  check(/he\.type === 'death'[\s\S]{0,500}_tmApplyCanonicalDeath\(he\.character/.test(endturnApplySource) && !/he\.type === 'death'[\s\S]{0,500}\.alive\s*=\s*false/.test(endturnApplySource), 'harem death consumer must route the raw character reference to the canonical death sink without bare writes');
  check(!/\.alive\s*=\s*false|\.dead\s*=\s*true/.test(endturnApplySource + '\n' + endturnStagesSource), 'endturn writeback consumers must not contain direct character death writes');
  check(endturnApplySource.includes("_tmSetFactionLeaderCanonical(_coupFac, fe.newLeader") &&
    endturnApplySource.includes("_tmSetFactionLeaderCanonical(fObj, sc.newLeader") &&
    endturnApplySource.includes("_tmSetPartyLeaderCanonical(party, pc.new_leader"), 'faction coup/succession and party change leaders must use canonical living-entity sinks');
  check(endturnApplySource.includes("_tmSetPartyLeaderCanonical(newParty, sp.newLeader") &&
    endturnApplySource.includes("_tmSetPartyLeaderCanonical(newP, pc.leader") &&
    endturnApplySource.includes("_tmSetFactionLeaderCanonical(newF, fc.leader"), 'new/splintered parties and new factions must validate leaders before insertion');
  check(endturnApplySource.includes("_tmApplyCanonicalDeath(r.leaderName, ru.leaderCasualty") &&
    endturnApplySource.includes("_tmApplyCanonicalDeath(r.leaderName, '起义失败被剿'"), 'revolt casualty and suppression deaths must share the canonical death sink');
  check(endturnStagesSource.includes("global.applyOneDeath({ name:_sov.name") &&
    endturnStagesSource.includes("death pipeline did not apply") &&
    endturnStagesSource.includes("player character not found"), 'reconcile regicide must route player death and surface missing/no-op pipeline failures');

  // D. 真跑 apply stage，确认 prompt 宣告的五个扩展字段不再被 dispatcher 丢弃。
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-endturn-apply-stages.js'), 'utf8'), ctx, { filename: 'tm-endturn-apply-stages.js' });

  // faction_succession 的主链 consumer 之后，post stage 必须补齐所有领袖镜像。
  ctx.GM = baseGM({
    chars: [{ name: '韩旷', alive: true }],
    facs: [{ name: '东林', leader: '韩旷', ruler: '旧首', leadership: { ruler: '旧首' }, leaderInfo: { name: '韩旷' } }]
  });
  ctx.TM.Endturn.AI.apply.stages._applyPostValidateAssemble(
    { results: {}, meta: { timing: {} }, record: {} },
    { p1: { faction_succession: [{ faction: '东林', newLeader: '韩旷' }] }, _applied: {}, _applyStart: Date.now() }
  );
  check(ctx.GM.facs[0].leaderName === '韩旷' && ctx.GM.facs[0].ruler === '韩旷' && ctx.GM.facs[0].leadership.ruler === '韩旷' && ctx.GM.facs[0].leaderInfo.name === '韩旷', 'succession post stage must synchronize all leader mirrors');

  const captured = [];
  ctx.applyAITurnChanges = function capture(input) {
    captured.push(input);
    return { ok: true, applied: { failed: [] } };
  };
  ctx.preflightAIWriteBack = (x) => x;
  ctx.GM = baseGM();
  const p1 = {
    shizhengji: '', changes: [], appointments: [], institutions: [], regions: [], events: [], npc_actions: [], relations: [],
    tax_reforms: [{ op: 'rate', taxId: 'shangshui', rate: 0.06 }],
    class_updates: [{ name: '士绅', updates: { satisfaction: 50 } }],
    region_updates: [{ id: 'shandong', updates: { prosperity: 60 } }],
    project_updates: [{ name: '河工', progress: 10 }],
    anyPathChanges: [{ path: 'custom.flag', op: 'set', value: true }]
  };
  await ctx.TM.Endturn.AI.apply.stages._applyCore_reconcile({ results: { sc1: p1 }, meta: {}, record: {} });
  check(captured.length >= 1, 'apply stage must invoke applyAITurnChanges');
  const dispatched = captured[0];
  ['tax_reforms', 'class_updates', 'region_updates', 'project_updates', 'anyPathChanges'].forEach((field) => {
    check(dispatched[field] === p1[field] && dispatched[field].length === 1, 'dispatcher must forward ' + field);
  });

  console.log('[smoke-ai-writeback-integrity] PASS assertions=' + assertions);
}

main().catch((err) => {
  console.error(err && err.stack || err);
  process.exit(1);
});

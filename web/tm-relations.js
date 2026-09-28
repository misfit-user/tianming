// @ts-check
// ============================================================
// NPC关系网 + 势力关系矩阵（中国政治史风格）
// 5维NPC关系 + 多维势力矩阵 + 累积历史账本 + 冲突渐进
// ============================================================

// ── NPC 关系标签（多个可并存） ──
var NPC_RELATION_LABELS = {
  // 血缘
  brother:     { label:'兄弟',   category:'blood' },
  cousin:      { label:'从兄弟', category:'blood' },
  uncle_nephew:{ label:'叔侄',   category:'blood' },
  father_son:  { label:'父子',   category:'blood' },
  clan:        { label:'族亲',   category:'blood' },
  // 姻亲
  in_law:      { label:'姻亲',   category:'marriage' },
  son_in_law:  { label:'翁婿',   category:'marriage' },
  brother_in_law:{label:'连襟',  category:'marriage' },
  maternal:    { label:'外戚',   category:'marriage' },
  // 同乡
  same_region: { label:'同郡',   category:'origin' },
  // 师徒
  master:      { label:'业师',   category:'teaching' },
  disciple:    { label:'门生',   category:'teaching' },
  // 同年
  same_cohort: { label:'同年',   category:'cohort' },
  // 故吏
  former_subordinate:{label:'故吏',category:'career' },
  former_superior:  { label:'旧主',category:'career' },
  // 友朋
  close_friend:{ label:'知交',   category:'friendship' },
  poet_friend: { label:'诗友',   category:'friendship' },
  old_acquaintance:{label:'故交',category:'friendship' },
  // 政派
  same_party:  { label:'同党',   category:'politics' },
  colleague:   { label:'同僚',   category:'politics' },
  // 敌对
  political_rival:{label:'政敌', category:'enmity' },
  sworn_enemy:   {label:'宿敌', category:'enmity' },
  // 暗线
  co_conspirator:{label:'共谋', category:'secret' },
  secret_ally:   {label:'暗盟', category:'secret' }
};

// ── 冲突等级（0-5） ──
var CONFLICT_LEVELS = {
  0: { label:'和睦', desc:'正常交往' },
  1: { label:'口角', desc:'一次争论、冷眼' },
  2: { label:'弹劾', desc:'公开对抗，奏疏互攻' },
  3: { label:'绝交', desc:'断绝往来，相见不语' },
  4: { label:'陷害', desc:'互设陷阱、构陷入罪' },
  5: { label:'死仇', desc:'不共戴天' }
};

// ── NPC 互动类型（20+种） ──
//  fameActor/fameTarget: 名望 (-100..+100) 增减
//  virtueActor/virtueTarget: 贤能（0+ 累积型）增减 · 仅加不减（或减一点）
var NPC_INTERACTION_TYPES = {
  recommend:         { label:'举荐', conflict:0, effect:{respect:+8, owesFavor:+1}, mood:'喜', important:6, fameActor:+2, virtueActor:+4 },
  impeach:           { label:'弹劾', conflict:+1, effect:{affinity:-15, hostility:+15}, mood:'恨', important:8, fameActor:+3, fameTarget:-4, virtueActor:+5 },
  petition_jointly:  { label:'联名上书', conflict:0, effect:{affinity:+5, trust:+3}, mood:'平', important:4, fameActor:+1, virtueActor:+2 },
  form_clique:       { label:'结党', conflict:0, effect:{trust:+10}, label_add:['same_party'], mood:'平', important:5, fameActor:-2, virtueActor:-3 },
  private_visit:     { label:'私访', conflict:0, effect:{affinity:+5, trust:+5}, mood:'喜', important:4, fameActor:+1 },
  invite_banquet:    { label:'宴请', conflict:0, effect:{affinity:+6}, mood:'喜', important:4, fameActor:+1 },
  gift_present:      { label:'馈赠', conflict:0, effect:{affinity:+4, owesFavor:+1}, mood:'喜', important:3, fameActor:+1 },
  correspond_secret: { label:'密信', conflict:0, effect:{trust:+8}, label_add:['co_conspirator'], mood:'平', important:5, fameActor:-1 },
  confront:          { label:'对质', conflict:+1, effect:{affinity:-10}, mood:'恨', important:6, virtueActor:+2 },
  mediate:           { label:'调和', conflict:-1, effect:{respect:+5}, mood:'平', important:5, fameActor:+3, virtueActor:+5 },
  frame_up:          { label:'构陷', conflict:+2, effect:{affinity:-25, trust:-40, hostility:+30}, mood:'恨', important:10, fameActor:-8, virtueActor:-10 },
  expose_secret:     { label:'揭发', conflict:+2, effect:{affinity:-20, fear:+15}, mood:'恨', important:9, fameActor:+2, fameTarget:-10, virtueActor:+1 },
  marriage_alliance: { label:'联姻', conflict:0, effect:{affinity:+15, trust:+10, kinshipTies:+1}, label_add:['in_law'], mood:'喜', important:8, fameActor:+3 },
  master_disciple:   { label:'师徒缔结', conflict:0, effect:{respect:+20, affinity:+10}, label_add_actor:['master'], label_add_target:['disciple'], mood:'喜', important:9, fameActor:+5, virtueActor:+8, virtueTarget:+5 },
  duel_poetry:       { label:'诗文切磋', conflict:0, effect:{respect:+5, affinity:+3}, label_add:['poet_friend'], mood:'平', important:3, fameActor:+4, virtueActor:+3 },
  share_intelligence:{ label:'通风报信', conflict:0, effect:{trust:+8}, mood:'平', important:5, fameActor:-1 },
  betray:            { label:'背叛', conflict:+3, effect:{trust:-50, affinity:-30, hostility:+25}, effectActor:{hostility:+15}, mood:'恨', important:10, fameActor:-15, virtueActor:-20 },
  reconcile:         { label:'和解', conflict:-2, effect:{affinity:+10, trust:+5}, mood:'喜', important:6, fameActor:+2, virtueActor:+3 },
  mourn_together:    { label:'共哀', conflict:-1, effect:{affinity:+8}, mood:'忧', important:5, fameActor:+1, virtueActor:+2 },
  rival_compete:     { label:'竞争', conflict:+1, effect:{affinity:-5, respect:+3}, mood:'平', important:4, fameActor:+1 },
  guarantee:         { label:'担保', conflict:0, effect:{trust:+10, owesFavor:+1}, mood:'平', important:5, fameActor:+2, virtueActor:+4 },
  slander:           { label:'诽谤', conflict:+1, effect:{affinity:-12, hostility:+10}, mood:'恨', important:6, fameActor:-4, fameTarget:-3, virtueActor:-3 },
  // ── 批辛·新交互家族（吊唁/贺寿/作伐/托孤/求教/赠药/饯行/接风）·丰富 respect/fear 二维 ──
  condole:           { label:'吊唁', conflict:0, effect:{affinity:+8, respect:+4}, mood:'忧', important:5, virtueActor:+2 },
  celebrate_birthday:{ label:'贺寿', conflict:0, effect:{affinity:+6, respect:+3, owesFavor:+1}, mood:'喜', important:4, fameActor:+1 },
  propose_match:     { label:'作伐', conflict:0, effect:{trust:+6, affinity:+4, owesFavor:+1}, mood:'喜', important:5, fameActor:+1 },   // 只牵线·正式缔结仍归 marriage_alliance
  entrust_orphan:    { label:'托孤', conflict:0, effect:{trust:+30, respect:+15, owesFavor:+2}, effectActor:{trust:+25}, mood:'忧', important:9, virtueTarget:+5 },
  seek_instruction:  { label:'求教', conflict:0, effect:{affinity:+5}, effectActor:{respect:+12, affinity:+5}, mood:'敬', important:4 },   // target 对 actor 观感 effect·actor 对 target 之敬在 effectActor
  gift_medicine:     { label:'赠药', conflict:0, effect:{affinity:+7, trust:+5, fear:-3}, mood:'喜', important:4, fameActor:+1 },   // 示好化解戒惧·补 fear 维
  farewell_feast:    { label:'饯行', conflict:0, effect:{affinity:+6, respect:+3}, mood:'忧', important:4, fameActor:+1 },
  welcome_feast:     { label:'接风', conflict:0, effect:{affinity:+6, respect:+3}, mood:'喜', important:4, fameActor:+1 },
  // ── 批辛·NPC→玩家四新面（谢恩/求情/乞休·由 apply.dispatch 走奏疏；贺寿等复用上族）──
  express_gratitude: { label:'谢恩', conflict:0, effect:{affinity:+3, trust:+2}, mood:'喜', important:4, fameActor:+1, virtueActor:+1 },
  intercede:         { label:'求情', conflict:0, effect:{affinity:+2}, mood:'忧', important:5, virtueActor:+2 },
  petition_retire:   { label:'乞休', conflict:0, effect:{}, mood:'忧', important:6 }
};

// ── 势力互动类型 ──
var FACTION_INTERACTION_TYPES = {
  military_aid:     { label:'军事援助', historyType:'aid',      effect:{trust:+15, hostility:-10} },
  trade_embargo:    { label:'贸易禁运', historyType:'embargo',  effect:{economicTies:-30, hostility:+15} },
  open_market:      { label:'开放互市', historyType:'trade',    effect:{economicTies:+25, trust:+5} },
  send_envoy:       { label:'遣使',     historyType:'diplomacy',effect:{trust:+5} },
  demand_tribute:   { label:'索贡',     historyType:'pressure', effect:{hostility:+10} },
  pay_tribute:      { label:'献贡',     historyType:'tribute',  effect:{hostility:-5} },
  royal_marriage:   { label:'和亲',     historyType:'marriage', effect:{kinshipTies:+25, trust:+15, hostility:-15} },
  send_hostage:     { label:'质子',     historyType:'hostage',  effect:{trust:+10} },
  cultural_exchange:{ label:'文化交流', historyType:'culture',  effect:{culturalAffinity:+15} },
  religious_mission:{ label:'宗教使节', historyType:'religion', effect:{culturalAffinity:+10} },
  proxy_war:        { label:'代理战争', historyType:'proxy',    effect:{hostility:+20, trust:-15} },
  incite_rebellion: { label:'煽动叛乱', historyType:'subversion',effect:{hostility:+25, trust:-30} },
  spy_infiltration: { label:'派细作',   historyType:'espionage',effect:{trust:-5} },
  assassin_dispatch:{ label:'派刺客',   historyType:'assassination',effect:{hostility:+40, trust:-60} },
  border_clash:     { label:'边境冲突', historyType:'skirmish', effect:{hostility:+15, trust:-10} },
  declare_war:      { label:'宣战',     historyType:'war',      effect:{hostility:+50, trust:-40} },
  sue_for_peace:    { label:'请和',     historyType:'peace',    effect:{hostility:-20, trust:+5} },
  annex_vassal:     { label:'并吞',     historyType:'annexation',effect:{} },
  recognize_independence:{label:'承认独立',historyType:'independence',effect:{} },
  form_confederation:{label:'结盟',     historyType:'alliance', effect:{trust:+20, hostility:-15} },
  break_confederation:{label:'毁约',    historyType:'betrayal', effect:{trust:-30, hostility:+20} },
  gift_treasure:    { label:'赠宝',     historyType:'gift',     effect:{trust:+5, hostility:-3} },
  pay_indemnity:    { label:'赔款',     historyType:'indemnity',effect:{economicTies:+10, hostility:-10} }
};

// ── 辅助函数 ──

/**
 * 获取/初始化两角色间关系对象
 */
function _tmRelationCanonName(name) {
  if (!name) return name;
  try {
    if (typeof canonicalizeCharName === 'function') return canonicalizeCharName(name) || name;
  } catch (_) {}
  return name;
}

function ensureCharRelation(charA, charB) {
  charA = _tmRelationCanonName(charA);
  charB = _tmRelationCanonName(charB);
  if (!charA || !charB || charA === charB) return null;
  var a = (typeof findCharByName === 'function') ? findCharByName(charA) : null;
  if (!a) return null;
  if (!a.relations) a.relations = {};
  if (!a.relations[charB]) {
    a.relations[charB] = {
      affinity: 50, trust: 50, respect: 50, fear: 0, hostility: 0,
      labels: [], history: [],
      owesFavor: 0, holdsSecret: 0,
      conflictLevel: 0, escalationTurn: 0
    };
  }
  var r = a.relations[charB];
  // 兼容字段
  if (r.affinity === undefined) r.affinity = 50;
  if (r.trust === undefined) r.trust = 50;
  if (r.respect === undefined) r.respect = 50;
  if (r.fear === undefined) r.fear = 0;
  if (r.hostility === undefined) r.hostility = 0;
  if (!Array.isArray(r.labels)) r.labels = [];
  if (!Array.isArray(r.history)) r.history = [];
  if (r.conflictLevel === undefined) r.conflictLevel = 0;
  return r;
}

function _tmRelationHash(text) {
  try {
    if (typeof window !== 'undefined' && window.TM && TM.MemorySourceBound && typeof TM.MemorySourceBound.safeHash === 'function') {
      return TM.MemorySourceBound.safeHash(text);
    }
  } catch(_) {}
  text = String(text == null ? '' : text);
  var h = 2166136261;
  for (var i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return 'h' + (h >>> 0).toString(16) + '-len' + text.length;
}

function recordNpcRelationEvent(data) {
  if (typeof GM === 'undefined' || !GM) return null;
  data = data || {};
  if (!data.actor || !data.target) return null;
  if (!Array.isArray(GM._npcRelationEvents)) GM._npcRelationEvents = [];
  var turn = Number(data.turn != null ? data.turn : (GM.turn || 0));
  var text = String(data.text || data.description || data.kind || '').replace(/\s+/g, ' ').trim();
  var hash = _tmRelationHash([turn, data.source || '', data.actor, data.target, data.kind || '', text].join('|'));
  var id = data.id || ('npcRelationEvent-' + turn + '-' + String(data.actor).slice(0, 12) + '-' + String(data.target).slice(0, 12) + '-' + String(data.kind || 'event').slice(0, 24) + '-' + hash.slice(0, 18));
  var exists = GM._npcRelationEvents.some(function(evt) { return evt && evt.id === id; });
  if (exists) return null;
  var sourceRef = { type: 'npcRelationEvent', id: id, turn: turn, authority: data.authorityLevel || 'event_log', visibility: data.visibility || 'internal', lane: 'L4_dialogue_evidence', role: 'record' };
  try {
    if (typeof window !== 'undefined' && window.TM && TM.MemorySourceBound && typeof TM.MemorySourceBound.normalizeRef === 'function') {
      sourceRef = TM.MemorySourceBound.normalizeRef(sourceRef);
    }
  } catch(_) {}
  var evt = {
    id: id,
    turn: turn,
    source: data.source || 'npc_interaction',
    actor: String(data.actor),
    target: String(data.target),
    participants: Array.isArray(data.participants) ? data.participants.slice(0, 8) : [String(data.actor), String(data.target)],
    kind: String(data.kind || 'interaction'),
    delta: data.delta || {},
    metrics: data.metrics || {},
    text: text,
    importance: Math.max(1, Math.min(10, Number(data.importance || 5))),
    visibility: data.visibility || 'internal',
    authorityLevel: data.authorityLevel || 'event_log',
    confidence: data.confidence != null ? Math.max(0, Math.min(1, Number(data.confidence))) : 0.82,
    sourceRefs: [sourceRef],
    basisRefs: Array.isArray(data.basisRefs) ? data.basisRefs.slice(0, 8) : [],
    contentHash: hash
  };
  GM._npcRelationEvents.push(evt);
  if (GM._npcRelationEvents.length > 1200) GM._npcRelationEvents = GM._npcRelationEvents.slice(-1200);
  return evt;
}

if (typeof window !== 'undefined') {
  window.recordNpcRelationEvent = recordNpcRelationEvent;
  window.TM = window.TM || {};
  window.TM.NpcRelationEvents = window.TM.NpcRelationEvents || {};
  window.TM.NpcRelationEvents.record = recordNpcRelationEvent;
}

/**
 * 应用一次NPC互动
 */
function applyNpcInteraction(actor, target, type, extra) {
  var ledger = typeof TM !== 'undefined' && TM.NPC && TM.NPC.ActionLedger;
  if (ledger && ledger.owns(type)) {
    var intent = Object.assign({}, extra || {}, { actor:actor, target:target, behaviorType:type, intent:extra && extra.description || type });
    var receipt = ledger.ingest(intent, extra && extra._agent ? 'agent:relations' : 'relations');
    if (extra && intent.actionId) extra.actionId = intent.actionId;
    return !!receipt && /^(submitted|waiting|started|partial|completed)$/.test(receipt.outcome);
  }
  extra = extra || {};
  actor = _tmRelationCanonName(actor);
  target = _tmRelationCanonName(target);
  var def = NPC_INTERACTION_TYPES[type];
  if (!def) return false;
  var rAB = ensureCharRelation(actor, target);
  var rBA = ensureCharRelation(target, actor);
  if (!rAB || !rBA) return false;
  var turn = (typeof GM !== 'undefined' && GM.turn) || 1;

  // 双向应用 effect（可能方向不对称——actor的行为对target的情感 != 反之）
  // 简化：主要改变 target→actor 的关系（被动方视角）
  var eff = def.effect || {};
  ['affinity','trust','respect','fear','hostility'].forEach(function(k) {
    if (eff[k] !== undefined) {
      rBA[k] = Math.max(-100, Math.min(100, (rBA[k] || 0) + eff[k]));
    }
  });
  if (eff.owesFavor) rBA.owesFavor = (rBA.owesFavor || 0) + eff.owesFavor;

  // 批辛·不对称建模：actor 对 target 的观感变化 ≠ target 对 actor（如求教者敬业师、托孤者更托付、背叛者亦生恨）。
  //   仅当型定义显式声明 effectActor 时才写 rAB·同 clamp。无 effectActor 的型 rAB 五维逐字节不变（零波及）。
  var effA = def.effectActor;
  if (effA) {
    ['affinity','trust','respect','fear','hostility'].forEach(function(k) {
      if (effA[k] !== undefined) {
        rAB[k] = Math.max(-100, Math.min(100, (rAB[k] || 0) + effA[k]));
      }
    });
    if (effA.owesFavor) rAB.owesFavor = (rAB.owesFavor || 0) + effA.owesFavor;
  }

  // 冲突级变化（双向一致）
  if (def.conflict) {
    var newLv = Math.max(0, Math.min(5, (rBA.conflictLevel || 0) + def.conflict));
    rBA.conflictLevel = newLv;
    rAB.conflictLevel = newLv;
    rBA.escalationTurn = turn;
    rAB.escalationTurn = turn;
  }

  // 标签添加
  var labelsToAdd = [];
  if (def.label_add) labelsToAdd = labelsToAdd.concat(def.label_add);
  if (def.label_add_actor) {
    (def.label_add_actor || []).forEach(function(l) {
      if (rAB.labels.indexOf(l) < 0) rAB.labels.push(l);
    });
  }
  if (def.label_add_target) {
    (def.label_add_target || []).forEach(function(l) {
      if (rBA.labels.indexOf(l) < 0) rBA.labels.push(l);
    });
  }
  labelsToAdd.forEach(function(l) {
    if (rAB.labels.indexOf(l) < 0) rAB.labels.push(l);
    if (rBA.labels.indexOf(l) < 0) rBA.labels.push(l);
  });

  // 写入历史
  var hEntry = {
    turn: turn,
    event: extra.description || def.label,
    type: type,
    weight: def.conflict ? -(def.conflict * 10) : ((eff.affinity || 0) + (eff.trust || 0)) / 2,
    emotion: def.mood || '平'
  };
  rBA.history.push(hEntry);
  rAB.history.push(hEntry);
  // 限制历史长度
  if (rAB.history.length > 20) rAB.history = rAB.history.slice(-20);
  if (rBA.history.length > 20) rBA.history = rBA.history.slice(-20);

  recordNpcRelationEvent({
    turn: turn,
    source: 'tm-relations.applyNpcInteraction',
    actor: actor,
    target: target,
    participants: [actor, target],
    kind: type,
    delta: eff,
    metrics: {
      affinity: rBA.affinity,
      trust: rBA.trust,
      respect: rBA.respect,
      fear: rBA.fear,
      hostility: rBA.hostility,
      conflictLevel: rBA.conflictLevel || 0,
      owesFavor: rBA.owesFavor || 0
    },
    text: extra.description || def.label,
    importance: def.important || 5,
    visibility: extra.visibility || 'internal'
  });

  // NPC 记忆
  if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
    var mood = def.mood || '平';
    var imp = def.important || 5;
    NpcMemorySystem.remember(actor, '对' + target + ' ' + (extra.description || def.label), mood, imp, target);
    NpcMemorySystem.remember(target, actor + '对己行' + def.label + (extra.description ? '——' + extra.description.substring(0, 30) : ''), mood, imp, actor);
  }
  return true;
}

/**
 * 冲突级每回合自然衰减（5 回合 -1，直至 0）
 */
function decayConflictLevels() {
  if (!GM || !GM.chars) return;
  var turn = GM.turn || 1;
  GM.chars.forEach(function(c) {
    if (!c || !c.relations) return;
    Object.keys(c.relations).forEach(function(otherName) {
      var r = c.relations[otherName];
      if (!r || !r.conflictLevel) return;
      var gap = turn - (r.escalationTurn || 0);
      if (gap >= 5) {
        var decay = Math.floor(gap / 5);
        r.conflictLevel = Math.max(0, r.conflictLevel - decay);
        r.escalationTurn = turn;
      }
    });
  });
}

/**
 * 跨代父仇继承：父辈 conflictLevel ≥ 4 且双方有子嗣时，子代继承 conflictLevel=2
 */
function inheritBloodFeuds() {
  if (!GM || !GM.chars) return;
  GM.chars.forEach(function(parent) {
    if (!parent || !parent.relations || !Array.isArray(parent.children) || parent.children.length === 0) return;
    Object.keys(parent.relations).forEach(function(enemyName) {
      var r = parent.relations[enemyName];
      if (!r || r.conflictLevel < 4) return;
      var enemy = findCharByName(enemyName);
      if (!enemy || !Array.isArray(enemy.children) || enemy.children.length === 0) return;
      // 双方子代间建立 conflictLevel=2
      parent.children.forEach(function(pcName) {
        enemy.children.forEach(function(ecName) {
          if (pcName === ecName) return;
          var rc = ensureCharRelation(pcName, ecName);
          var rce = ensureCharRelation(ecName, pcName);
          if (rc && !rc._inheritedFeud) {
            rc.conflictLevel = Math.max(rc.conflictLevel, 2);
            rc.labels.push('inherited_feud');
            rc._inheritedFeud = true;
            rc.history.push({ turn: GM.turn, event: '承父辈宿怨：' + parent.name + ' 与 ' + enemy.name + ' 结仇', type:'inherited', weight:-20, emotion:'恨' });
          }
          if (rce && !rce._inheritedFeud) {
            rce.conflictLevel = Math.max(rce.conflictLevel, 2);
            rce.labels.push('inherited_feud');
            rce._inheritedFeud = true;
          }
        });
      });
    });
  });
}

/**
 * 获取某角色最强 N 条关系（供 prompt 注入）
 */
function getTopRelations(charName, n) {
  n = n || 5;
  var ch = findCharByName(charName);
  if (!ch || !ch.relations) return [];
  var rels = [];
  Object.keys(ch.relations).forEach(function(other) {
    var r = ch.relations[other];
    if (!r) return;
    // 强度分数：绝对情感+冲突级加成+标签数
    var score = Math.abs((r.affinity||50)-50) + Math.abs(r.hostility||0) + (r.conflictLevel||0)*15 + (r.labels||[]).length*3 + (r.owesFavor||0)*5 + (r.holdsSecret||0)*7;
    rels.push({ name: other, score: score, rel: r });
  });
  rels.sort(function(a, b) { return b.score - a.score; });
  return rels.slice(0, n);
}

/**
 * 关系摘要字符串（供 prompt 注入）
 */
function summarizeRelation(otherName, r) {
  if (!r) return '';
  var labelStr = (r.labels || []).map(function(l) {
    return (NPC_RELATION_LABELS[l] && NPC_RELATION_LABELS[l].label) || l;
  }).slice(0, 3).join('·');
  var parts = [];
  if (labelStr) parts.push('[' + labelStr + ']');
  parts.push(otherName);
  var emoBits = [];
  if ((r.affinity||50) > 70) emoBits.push('亲');
  else if ((r.affinity||50) < 30) emoBits.push('恶');
  if ((r.respect||50) > 70) emoBits.push('敬');
  if ((r.fear||0) > 40) emoBits.push('畏');
  if ((r.hostility||0) > 40) emoBits.push('仇');
  if ((r.trust||50) < 20) emoBits.push('疑');
  if (emoBits.length) parts.push('('+emoBits.join('')+')');
  if (r.conflictLevel > 0) parts.push('冲突L'+r.conflictLevel+(CONFLICT_LEVELS[r.conflictLevel]?'('+CONFLICT_LEVELS[r.conflictLevel].label+')':''));
  if (r.owesFavor > 0) parts.push('欠人情'+r.owesFavor);
  if (r.holdsSecret > 0) parts.push('握把柄'+r.holdsSecret);
  if (r.history && r.history.length > 0) {
    var recent = r.history[r.history.length-1];
    if (recent) parts.push('近事T'+recent.turn+':'+recent.event.substring(0,20));
  }
  return parts.join(' ');
}

/**
 * 获取/初始化势力间关系
 */
function ensureFactionRelation(facA, facB) {
  if (!facA || !facB || facA === facB) return null;
  normalizeFactionRelationsMap();
  if (!GM.factionRelationsMap[facA]) GM.factionRelationsMap[facA] = {};
  if (!GM.factionRelationsMap[facA][facB]) {
    GM.factionRelationsMap[facA][facB] = {
      trust: 50, hostility: 0, economicTies: 10, culturalAffinity: 10,
      kinshipTies: 0, territorialDispute: 0,
      historicalEvents: [], activeTreaties: [], borderOpen: false,
      warsCount: 0, spiesFrom: 0, spiesTo: 0,
      proxies: []
    };
    var seed = findFactionRelationRecord(facA, facB);
    if (seed) mergeFactionRelationRecord(GM.factionRelationsMap[facA][facB], seed, true);
  }
  return GM.factionRelationsMap[facA][facB];
}

function clampFactionRelationValue(v) {
  v = parseFloat(v);
  if (isNaN(v)) v = 0;
  return Math.max(-100, Math.min(100, v));
}

function normalizeFactionRelationsMap() {
  if (typeof GM === 'undefined' || !GM) return {};
  if (!GM.factionRelationsMap || typeof GM.factionRelationsMap !== 'object' || Array.isArray(GM.factionRelationsMap)) {
    GM.factionRelationsMap = {};
  }
  Object.keys(GM.factionRelationsMap).forEach(function(k) {
    if (k.indexOf('->') <= 0) return;
    var parts = k.split('->');
    var from = parts.shift();
    var to = parts.join('->');
    var oldRel = GM.factionRelationsMap[k];
    if (from && to && oldRel && typeof oldRel === 'object') {
      if (!GM.factionRelationsMap[from]) GM.factionRelationsMap[from] = {};
      if (!GM.factionRelationsMap[from][to]) {
        GM.factionRelationsMap[from][to] = oldRel;
      } else {
        Object.keys(oldRel).forEach(function(prop) {
          if (GM.factionRelationsMap[from][to][prop] === undefined) GM.factionRelationsMap[from][to][prop] = oldRel[prop];
        });
      }
    }
    delete GM.factionRelationsMap[k];
  });
  return GM.factionRelationsMap;
}

function relationValueToTrustHostility(rel, value, force) {
  value = clampFactionRelationValue(value);
  rel.value = value;
  if (force || rel.trust === undefined) rel.trust = Math.max(0, Math.min(100, 50 + Math.max(0, value) * 0.5 + Math.min(0, value) * 0.25));
  if (force || rel.hostility === undefined) rel.hostility = Math.max(0, Math.min(100, value < 0 ? Math.abs(value) : 0));
}

function mergeFactionRelationRecord(rel, record, forceValue) {
  if (!rel || !record) return rel;
  if (record.type !== undefined) rel.type = record.type;
  if (record.desc !== undefined) rel.desc = record.desc;
  if (record.reason !== undefined && rel.desc === undefined) rel.desc = record.reason;
  if (record.value !== undefined) relationValueToTrustHostility(rel, record.value, !!forceValue);
  return rel;
}

function findFactionRelationRecord(facA, facB) {
  var list = (typeof GM !== 'undefined' && GM && Array.isArray(GM.factionRelations)) ? GM.factionRelations : [];
  for (var i = 0; i < list.length; i++) {
    var r = list[i];
    if (r && r.from === facA && r.to === facB) return r;
  }
  for (var j = 0; j < list.length; j++) {
    var rr = list[j];
    if (rr && rr.from === facB && rr.to === facA) return rr;
  }
  return null;
}

function upsertFactionRelationRecord(from, to, patch) {
  if (!from || !to || from === to) return null;
  if (!Array.isArray(GM.factionRelations)) GM.factionRelations = [];
  var found = null;
  GM.factionRelations.forEach(function(r) {
    if (r && r.from === from && r.to === to) found = r;
  });
  if (!found) {
    found = { from: from, to: to, type: 'neutral', value: 0, desc: '' };
    GM.factionRelations.push(found);
  }
  if (patch.type !== undefined) found.type = patch.type;
  if (patch.value !== undefined) found.value = clampFactionRelationValue(patch.value);
  if (patch.desc !== undefined) found.desc = patch.desc;
  return found;
}

function setFactionRelation(from, to, patch, options) {
  if (!from || !to || from === to) return null;
  patch = patch || {};
  options = options || {};
  normalizeFactionRelationsMap();
  var rel = ensureFactionRelation(from, to);
  var reverse = options.mirror === false ? null : ensureFactionRelation(to, from);
  var delta = patch.delta !== undefined ? patch.delta : patch.relation_delta;
  delta = parseFloat(delta);
  if (isNaN(delta)) delta = 0;
  var baseValue = rel && rel.value !== undefined ? parseFloat(rel.value) : 0;
  var nextValue = patch.value !== undefined ? clampFactionRelationValue(patch.value) : clampFactionRelationValue(baseValue + delta);
  var nextType = patch.type !== undefined ? patch.type : patch.new_type;
  var desc = patch.desc !== undefined ? patch.desc : (patch.event || patch.reason || '');
  var turn = (typeof GM !== 'undefined' && GM && GM.turn) || 1;

  [rel, reverse].forEach(function(r) {
    if (!r) return;
    relationValueToTrustHostility(r, nextValue, true);
    if (nextType !== undefined) r.type = nextType;
    if (desc) r.desc = desc;
    if (!Array.isArray(r.historicalEvents)) r.historicalEvents = [];
    if (delta || desc || nextType !== undefined) {
      r.historicalEvents.push({ turn: turn, event: desc || nextType || 'relation_shift', delta: delta });
      if (r.historicalEvents.length > 20) r.historicalEvents = r.historicalEvents.slice(-20);
    }
  });

  var listPatch = { value: nextValue };
  if (nextType !== undefined) listPatch.type = nextType;
  if (desc) listPatch.desc = desc;
  upsertFactionRelationRecord(from, to, listPatch);
  if (reverse) upsertFactionRelationRecord(to, from, listPatch);
  return rel;
}

function syncFactionRelationsFromList(list) {
  if (typeof GM === 'undefined' || !GM) return {};
  if (Array.isArray(list)) GM.factionRelations = list;
  normalizeFactionRelationsMap();
  (GM.factionRelations || []).forEach(function(r) {
    if (!r || !r.from || !r.to || r.from === r.to) return;
    mergeFactionRelationRecord(ensureFactionRelation(r.from, r.to), r, true);
    mergeFactionRelationRecord(ensureFactionRelation(r.to, r.from), r, true);
  });
  return GM.factionRelationsMap;
}

function removeFactionRelationsForFaction(factionName, world) {
  var G = world || ((typeof GM !== 'undefined' && GM) ? GM : null);
  if (!factionName || !G) return { ok: false, reason: 'invalid-faction' };
  var name = String(factionName);
  if (!G.factionRelationsMap || typeof G.factionRelationsMap !== 'object' || Array.isArray(G.factionRelationsMap)) {
    G.factionRelationsMap = {};
  }
  delete G.factionRelationsMap[name];
  Object.keys(G.factionRelationsMap).forEach(function(from) {
    if (G.factionRelationsMap[from] && typeof G.factionRelationsMap[from] === 'object') {
      delete G.factionRelationsMap[from][name];
    }
    if (from.indexOf(name + '->') === 0 || from.slice(-(name.length + 2)) === '->' + name) {
      delete G.factionRelationsMap[from];
    }
  });
  if (Array.isArray(G.factionRelations)) {
    G.factionRelations = G.factionRelations.filter(function(r) {
      return r && r.from !== name && r.to !== name;
    });
  }
  return { ok: true };
}

function _tmFactionStableId(faction) {
  if (!faction || typeof faction !== 'object') return '';
  var raw = faction.id != null ? faction.id : faction.factionId;
  return raw == null ? '' : String(raw).trim();
}

function _tmFactionName(faction) {
  if (!faction || typeof faction !== 'object') return '';
  return String(faction.name || faction.factionName || '').trim();
}

function _tmFactionResolve(world, ref) {
  var list = world && Array.isArray(world.facs) ? world.facs : [];
  if (ref && typeof ref === 'object') {
    if (list.indexOf(ref) >= 0) return ref;
    var objectId = _tmFactionStableId(ref);
    if (objectId) return list.find(function(f) { return _tmFactionStableId(f) === objectId; }) || null;
    ref = _tmFactionName(ref);
  }
  var value = ref == null ? '' : String(ref).trim();
  if (!value) return null;
  var byId = list.filter(function(f) {
    var factionId = _tmFactionStableId(f);
    return factionId && (factionId === value || ('id:' + factionId) === value);
  });
  if (byId.length === 1) return byId[0];
  var byName = list.filter(function(f) { return _tmFactionName(f) === value; });
  return byName.length === 1 ? byName[0] : null;
}

function _tmFactionReferenceMatcher(world, faction) {
  var id = _tmFactionStableId(faction);
  var name = _tmFactionName(faction);
  var sameName = (world.facs || []).filter(function(f) { return _tmFactionName(f) === name; }).length;
  var allowLegacyName = !!name && sameName === 1;
  function scalar(value) {
    if (value == null) return false;
    if (typeof value === 'object') {
      var objectId = _tmFactionStableId(value);
      if (objectId) return !!id && objectId === id;
      return allowLegacyName && _tmFactionName(value) === name;
    }
    var text = String(value).trim();
    if (!text) return false;
    if (id && (text === id || text === 'id:' + id)) return true;
    return allowLegacyName && text === name;
  }
  function record(entry) {
    if (!entry || typeof entry !== 'object') return false;
    var fields = [
      'factionId', 'sourceFactionId', 'targetFactionId', 'attackerId', 'defenderId',
      'attackerFactionId', 'defenderFactionId', 'fromId', 'toId', 'ownerFactionId',
      'faction', 'sourceFaction', 'targetFaction', 'attacker', 'defender', 'enemy',
      'attackerFaction', 'defenderFaction', 'from', 'to', 'sideA', 'sideB',
      'owner', 'ownerFaction', 'controller', 'occupiedBy', 'occupier', 'initiator', 'responder'
    ];
    for (var i = 0; i < fields.length; i++) {
      if (scalar(entry[fields[i]])) return true;
    }
    var arrays = ['parties', 'participants', 'participantIds', 'factions', 'factionIds', 'belligerents'];
    for (var j = 0; j < arrays.length; j++) {
      var values = entry[arrays[j]];
      if (Array.isArray(values) && values.some(scalar)) return true;
    }
    return false;
  }
  return { id: id, name: name, allowLegacyName: allowLegacyName, scalar: scalar, record: record };
}

function _tmFactionClone(value) {
  if (value == null) return value;
  if (typeof deepClone === 'function') return deepClone(value);
  return JSON.parse(JSON.stringify(value));
}

function _tmFactionClearMapRefs(root, matcher, replacement) {
  if (!root || typeof root !== 'object') return root;
  var copy = _tmFactionClone(root);
  var nameFields = {
    faction:1, sourceFaction:1, targetFaction:1, attackerFaction:1, defenderFaction:1,
    owner:1, ownerFaction:1, controller:1, occupiedBy:1, occupier:1
  };
  var idFields = {
    factionId:1, sourceFactionId:1, targetFactionId:1, attackerFactionId:1,
    defenderFactionId:1, ownerFactionId:1, controllerFactionId:1, occupierId:1
  };
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    Object.keys(value).forEach(function(key) {
      var child = value[key];
      if ((nameFields[key] || idFields[key]) && matcher.scalar(child)) {
        if (replacement) value[key] = idFields[key] ? replacement.id : replacement.name;
        else delete value[key];
        if (key === 'occupiedBy') delete value._occupiedTurn;
        return;
      }
      if (child && typeof child === 'object') visit(child);
    });
  }
  visit(copy);
  return copy;
}

// tm-relations 也被独立编辑器加载；成员写口由正式游戏入口在装载时注入，
// 避免关系模块对编辑器未加载的运行时 provider 形成悬空依赖。
var _tmFactionMembershipProvider = null;
function configureFactionMembershipProvider(provider) {
  if (!provider || typeof provider.assignChar !== 'function' || typeof provider.assignArmy !== 'function') {
    return { ok: false, reason: 'invalid-membership-provider' };
  }
  _tmFactionMembershipProvider = provider;
  return { ok: true };
}

function removeFaction(factionRef, options) {
  options = options || {};
  var G = options.world || ((typeof GM !== 'undefined' && GM) ? GM : null);
  if (!G || !Array.isArray(G.facs)) return { ok: false, reason: 'world-unavailable' };
  var faction = _tmFactionResolve(G, factionRef);
  if (!faction) {
    var unresolved = factionRef && typeof factionRef === 'object' ? _tmFactionName(factionRef) : String(factionRef || '').trim();
    var ambiguous = unresolved && G.facs.filter(function(f) { return _tmFactionName(f) === unresolved; }).length > 1;
    if (ambiguous) return { ok: false, reason: 'ambiguous-legacy-faction-name' };
    return { ok: true, alreadyRemoved: true, removed: false };
  }
  var matcher = _tmFactionReferenceMatcher(G, faction);
  if (!matcher.id) return { ok: false, reason: 'missing-stable-id' };
  var replacement = options.transferTo ? _tmFactionResolve(G, options.transferTo) : null;
  if (options.transferTo && !replacement) return { ok: false, reason: 'transfer-faction-not-found' };
  var replacementRef = replacement ? { id: _tmFactionStableId(replacement), name: _tmFactionName(replacement) } : null;
  var before = {
    facs: G.facs.slice(), activeWars: G.activeWars, activeSieges: G.activeSieges,
    armies: G.armies, treaties: G.treaties, factionRelations: G.factionRelations,
    factionRelationsMap: _tmFactionClone(G.factionRelationsMap), warTruces: G._warTruces,
    pendingAudiences: G._pendingAudiences, negotiations: G._negotiations,
    pendingDiplomaticProposals: G.pendingDiplomaticProposals,
    privatePendingDiplomaticProposals: G._pendingDiplomaticProposals,
    mapData: G.mapData, map: G.map, regions: G.regions, cities: G.cities,
    adminHierarchy: G.adminHierarchy, provinceStats: G.provinceStats,
    provinceToFaction: G._provinceToFaction,
    factionStates: G.facs.map(function(f) { return { faction: f, state: _tmFactionClone(f) }; }),
    charStates: (G.chars || []).map(function(ch) { return { char: ch, state: _tmFactionClone(ch) }; }),
    armyStates: (G.armies || []).map(function(army) { return { army: army, state: _tmFactionClone(army) }; })
  };
  try {
    var membership = _tmFactionMembershipProvider;
    if (!membership || typeof membership.assignChar !== 'function' || typeof membership.assignArmy !== 'function') {
      throw new Error('势力注销缺少统一成员归属入口');
    }
    var removedArmies = (G.armies || []).filter(function(a) { return matcher.record(a); });
    var removedArmyRefs = [];
    removedArmies.forEach(function(a) {
      [a && a.id, a && a.name].forEach(function(v) { if (v != null && String(v)) removedArmyRefs.push(String(v)); });
    });
    G.activeWars = (G.activeWars || []).filter(function(w) { return !matcher.record(w); });
    G.activeSieges = (G.activeSieges || []).filter(function(s) {
      if (matcher.record(s)) return false;
      var siegeArmyRefs = [
        s && s.attackerArmy, s && s.attackerArmyId, s && s.defenderArmy, s && s.defenderArmyId,
        s && s.besiegerArmy, s && s.besiegerArmyId, s && s.garrisonArmy, s && s.garrisonArmyId
      ].filter(function(value) { return value !== undefined && value !== null; }).map(String);
      return !siegeArmyRefs.some(function(value) { return removedArmyRefs.indexOf(value) >= 0; });
    });
    G.armies = options.removeArmies === false
      ? (G.armies || []).map(function(a) {
          if (!matcher.record(a)) return a;
          membership.assignArmy(a, replacementRef ? replacementRef.name : '', {
            reason: options.reason || '势力注销', silent: true, byTurn: G.turn, deferRefresh: true,
            targetFactionId: replacementRef ? replacementRef.id : ''
          });
          return a;
        })
      : (G.armies || []).filter(function(a) { return !matcher.record(a); });
    G.treaties = (G.treaties || []).filter(function(t) { return !matcher.record(t); });
    ['pendingDiplomaticProposals', '_pendingDiplomaticProposals'].forEach(function(field) {
      if (Array.isArray(G[field])) G[field] = G[field].filter(function(p) { return !matcher.record(p); });
    });
    if (Array.isArray(G._pendingAudiences)) {
      G._pendingAudiences = G._pendingAudiences.filter(function(a) { return !matcher.record(a); });
    }
    if (Array.isArray(G._negotiations)) {
      G._negotiations = G._negotiations.filter(function(n) {
        return !matcher.record(n) && !matcher.record(n && n.parties) && !matcher.record(n && n.sourceRef);
      });
    }
    G.facs.forEach(function(other) {
      if (!other || other === faction) return;
      if (Array.isArray(other._incomingProposals)) {
        other._incomingProposals = other._incomingProposals.filter(function(p) { return !matcher.record(p); });
      }
      var strategy = other.aiStrategy;
      if (!strategy || typeof strategy !== 'object') return;
      ['allianceIds', 'grudgeIds', 'enemyIds', 'rivalIds'].forEach(function(field) {
        if (Array.isArray(strategy[field])) strategy[field] = strategy[field].filter(function(v) { return !matcher.scalar(v); });
      });
      if (matcher.allowLegacyName) {
        ['alliances', 'grudges', 'enemies', 'rivals', 'treaties'].forEach(function(field) {
          if (Array.isArray(strategy[field])) strategy[field] = strategy[field].filter(function(v) { return !matcher.scalar(v); });
        });
      }
    });
    (G.chars || []).forEach(function(ch) {
      if (!ch || (!matcher.scalar(ch.factionId) && !matcher.scalar(ch.faction))) return;
      membership.assignChar(ch, replacementRef ? replacementRef.name : '', {
        reason: options.reason || '势力注销', silent: true, byTurn: G.turn, deferRefresh: true,
        targetFactionId: replacementRef ? replacementRef.id : ''
      });
    });
    G.facs.forEach(function(other) {
      if (!other || other === faction) return;
      ['liegeId','overlordId','suzerainId'].forEach(function(field) {
        if (matcher.scalar(other[field])) other[field] = replacementRef ? replacementRef.id : '';
      });
      ['liege','overlord','suzerain'].forEach(function(field) {
        if (matcher.scalar(other[field])) other[field] = replacementRef ? replacementRef.name : '';
      });
      ['vassalIds','allyIds','enemyIds','rivalIds','treatyPartnerIds'].forEach(function(field) {
        if (Array.isArray(other[field])) other[field] = other[field].filter(function(value) { return !matcher.scalar(value); });
      });
      if (matcher.allowLegacyName) {
        ['vassals','allies','enemies','rivals','treatyPartners'].forEach(function(field) {
          if (Array.isArray(other[field])) other[field] = other[field].filter(function(value) { return !matcher.scalar(value); });
        });
      }
    });
    // 稳定 ID 记录始终可精确清理；旧姓名键只有在该姓名唯一时才安全删除。
    // 同名不同 ID 时保留无法消歧的旧姓名关系，避免注销甲时误删乙的关系。
    if (Array.isArray(G.factionRelations)) {
      G.factionRelations = G.factionRelations.filter(function(relation) { return !matcher.record(relation); });
    }
    removeFactionRelationsForFaction(matcher.id, G);
    removeFactionRelationsForFaction('id:' + matcher.id, G);
    if (matcher.allowLegacyName) removeFactionRelationsForFaction(matcher.name, G);
    if (G._warTruces && G._warTruces.truces && typeof G._warTruces.truces === 'object') {
      var truceCopy = _tmFactionClone(G._warTruces);
      Object.keys(truceCopy.truces).forEach(function(key) {
        var parts = String(key).split('|');
        if (parts.some(function(part) { return matcher.scalar(part); })) delete truceCopy.truces[key];
      });
      G._warTruces = truceCopy;
    }
    ['mapData', 'map', 'regions', 'cities', 'adminHierarchy', 'provinceStats'].forEach(function(field) {
      if (G[field] && typeof G[field] === 'object') G[field] = _tmFactionClearMapRefs(G[field], matcher, replacementRef);
    });
    if (G._provinceToFaction && typeof G._provinceToFaction === 'object') {
      var provinceOwners = _tmFactionClone(G._provinceToFaction);
      Object.keys(provinceOwners).forEach(function(key) {
        if (!matcher.scalar(provinceOwners[key])) return;
        if (replacementRef) provinceOwners[key] = replacementRef.name;
        else delete provinceOwners[key];
      });
      G._provinceToFaction = provinceOwners;
    }
    G.facs = G.facs.filter(function(f) { return f !== faction; });
    if (typeof removeFromIndex === 'function' && (!options.world || (typeof GM !== 'undefined' && G === GM))) removeFromIndex('fac', matcher.name);
    if (typeof buildIndices === 'function' && (!options.world || (typeof GM !== 'undefined' && G === GM))) buildIndices();
    delete G._facIndex;
    return {
      ok: true, removed: true, factionId: matcher.id, factionName: matcher.name,
      warsRemoved: before.activeWars && before.activeWars.length ? before.activeWars.length - G.activeWars.length : 0,
      armiesRemoved: removedArmies.length
    };
  } catch (error) {
    G.facs = before.facs;
    G.activeWars = before.activeWars; G.activeSieges = before.activeSieges;
    G.armies = before.armies; G.treaties = before.treaties;
    G.factionRelations = before.factionRelations; G.factionRelationsMap = before.factionRelationsMap;
    G._warTruces = before.warTruces; G._pendingAudiences = before.pendingAudiences;
    G._negotiations = before.negotiations;
    G.pendingDiplomaticProposals = before.pendingDiplomaticProposals;
    G._pendingDiplomaticProposals = before.privatePendingDiplomaticProposals;
    G.mapData = before.mapData; G.map = before.map; G.regions = before.regions; G.cities = before.cities;
    G.adminHierarchy = before.adminHierarchy; G.provinceStats = before.provinceStats;
    G._provinceToFaction = before.provinceToFaction;
    before.factionStates.forEach(function(entry) {
      if (!entry.faction) return;
      Object.keys(entry.faction).forEach(function(key) { delete entry.faction[key]; });
      Object.keys(entry.state || {}).forEach(function(key) { entry.faction[key] = _tmFactionClone(entry.state[key]); });
    });
    before.charStates.forEach(function(entry) {
      if (!entry.char) return;
      Object.keys(entry.char).forEach(function(key) { delete entry.char[key]; });
      Object.keys(entry.state || {}).forEach(function(key) { entry.char[key] = _tmFactionClone(entry.state[key]); });
    });
    before.armyStates.forEach(function(entry) {
      if (!entry.army) return;
      Object.keys(entry.army).forEach(function(key) { delete entry.army[key]; });
      Object.keys(entry.state || {}).forEach(function(key) { entry.army[key] = _tmFactionClone(entry.state[key]); });
    });
    try {
      if (typeof invalidateGameIndices === 'function') invalidateGameIndices(G, null);
      delete G._facIndex;
    } catch (_indexRollbackError) {
      if (typeof TM !== 'undefined' && TM.errors && typeof TM.errors.captureSilent === 'function') {
        TM.errors.captureSilent(_indexRollbackError, '势力注销回滚索引失效');
      }
    }
    if (typeof TM !== 'undefined' && TM.errors && typeof TM.errors.capture === 'function') {
      TM.errors.capture(error, '势力注销事务失败');
    }
    return { ok: false, reason: 'remove-failed', error: error };
  }
}

/**
 * 应用一次势力互动
 */
function applyFactionInteraction(facA, facB, type, extra) {
  extra = extra || {};
  var def = FACTION_INTERACTION_TYPES[type];
  if (!def) return false;
  var rAB = ensureFactionRelation(facA, facB);
  var rBA = ensureFactionRelation(facB, facA);
  if (!rAB || !rBA) return false;
  var turn = GM.turn || 1;
  // 应用效果（双向对称）
  var eff = def.effect || {};
  ['trust','hostility','economicTies','culturalAffinity','kinshipTies','territorialDispute'].forEach(function(k) {
    if (eff[k] !== undefined) {
      rAB[k] = Math.max(-100, Math.min(100, (rAB[k] || 0) + eff[k]));
      rBA[k] = Math.max(-100, Math.min(100, (rBA[k] || 0) + eff[k]));
    }
  });
  // 资源/领土后果（#25·外交真后果接通）：抽象六维之外·赔款/朝贡/互市/并吞落真国库与领土·额由对方势力 strength 派生·EB 留痕·国库只在玩家为一方时动
  try { _applyDiploResourceConsequence(facA, facB, type, extra); } catch (_dre) {}
  // 战争计数
  if (type === 'declare_war') { rAB.warsCount = (rAB.warsCount||0) + 1; rBA.warsCount = rAB.warsCount; }
  // 历史事件
  var hEntry = {
    turn: turn,
    event: extra.description || def.label,
    type: def.historyType || type,
    impact: (eff.trust || 0) - (eff.hostility || 0),
    initiator: facA,
    target: facB
  };
  rAB.historicalEvents.push(hEntry);
  rBA.historicalEvents.push(hEntry);
  // 限制长度
  if (rAB.historicalEvents.length > 40) rAB.historicalEvents = rAB.historicalEvents.slice(-40);
  if (rBA.historicalEvents.length > 40) rBA.historicalEvents = rBA.historicalEvents.slice(-40);
  // 条约记录
  if (extra.treatyType) {
    var treaty = { type: extra.treatyType, terms: extra.terms || '', sinceTurn: turn, until: extra.until || null };
    rAB.activeTreaties.push(treaty);
    rBA.activeTreaties.push(treaty);
  }
  // 代理人记录
  if (type === 'proxy_war' && extra.viaProxy) {
    rAB.proxies.push({ via: extra.viaProxy, action: extra.action || '', sinceTurn: turn });
    rBA.proxies.push({ via: extra.viaProxy, action: extra.action || '', sinceTurn: turn });
  }
  // 细作
  if (type === 'spy_infiltration') rAB.spiesTo = (rAB.spiesTo || 0) + 1;
  return true;
}

// ── #25·外交资源/领土后果 ──────────────────────────────────────────
// 国库=玩家帑廪·仅当玩家为交互一方时动国库(FiscalEngine spend/add)·两 AI 势力间则动其抽象 faction.money/strength
function _diploFindFac(name) {
  if (!name || typeof GM === 'undefined' || !Array.isArray(GM.facs)) return null;
  return GM.facs.find(function(f){ return f && f.name === name; }) || null;
}
function _diploPlayerFac() {
  return (typeof P !== 'undefined' && (P.playerFactionName || (P.playerInfo && P.playerInfo.factionName))) || (typeof GM !== 'undefined' && (GM.playerFactionName || GM.playerFaction)) || '本朝';
}
// 岁币/赔款额按对方势力 strength(夹 20-200)派生·strength 50→money 30000/cloth 2000(对齐旧硬编)·保守上下限
function _diploTributeAmt(otherStrength) {
  var s = Math.max(20, Math.min(200, Number(otherStrength) || 50));
  return { money: Math.round(Math.max(8000, Math.min(120000, s * 600))), cloth: Math.round(Math.max(0, Math.min(8000, s * 40))) };
}
function _applyDiploResourceConsequence(facA, facB, type, extra) {
  if (type !== 'pay_indemnity' && type !== 'demand_tribute' && type !== 'pay_tribute' && type !== 'open_market' && type !== 'annex_vassal' && type !== 'recognize_independence') return;
  var player = _diploPlayerFac();
  var fA = _diploFindFac(facA), fB = _diploFindFac(facB);
  function strOf(f){ return Math.max(20, Math.min(200, (f && Number(f.strength)) || 50)); }
  function eb(txt){ if (typeof addEB === 'function') { try { addEB('外交', txt); } catch(_){} } }
  function spend(amts, tag){ if (typeof FiscalEngine !== 'undefined' && FiscalEngine.spendFromGuoku) { try { FiscalEngine.spendFromGuoku(amts, tag); } catch(_){} } }
  function add(amts, tag){ if (typeof FiscalEngine !== 'undefined' && FiscalEngine.addToGuoku) { try { FiscalEngine.addToGuoku(amts, tag); } catch(_){} } }
  function absMoney(f, d){ if (f) f.money = (Number(f.money) || 0) + d; }

  if (type === 'pay_indemnity') {            // facA 向 facB 赔款·额由收方 facB 实力派生
    var a1 = _diploTributeAmt(strOf(fB)).money;
    if (facA === player) { spend({ money: a1 }, '赔款·' + facB); eb('向' + facB + '赔款 ' + a1 + ' 两·出帑'); }
    else if (facB === player) { add({ money: a1 }, '赔款·' + facA); eb(facA + '赔款 ' + a1 + ' 两·入帑'); }
    else { absMoney(fA, -a1); absMoney(fB, a1); }
  } else if (type === 'demand_tribute') {     // facA 索贡(收)·额由纳方 facB 实力派生
    var t1 = _diploTributeAmt(strOf(fB));
    if (facA === player) { add(t1, '朝贡·' + facB); eb(facB + '纳贡 ' + t1.money + ' 两' + (t1.cloth?('·布'+t1.cloth+'匹'):'') + '·入帑'); }
    else if (facB === player) { spend(t1, '岁币·' + facA); eb('纳' + facA + '岁币 ' + t1.money + ' 两·出帑'); }
    else { absMoney(fB, -t1.money); absMoney(fA, t1.money); }
  } else if (type === 'pay_tribute') {        // facA 献贡(付)·额由受方 facB 实力派生
    var t2 = _diploTributeAmt(strOf(fB));
    if (facA === player) { spend(t2, '岁币·' + facB); eb('献' + facB + '岁币 ' + t2.money + ' 两·出帑'); }
    else if (facB === player) { add(t2, '朝贡·' + facA); eb(facA + '献贡 ' + t2.money + ' 两·入帑'); }
    else { absMoney(fA, -t2.money); absMoney(fB, t2.money); }
  } else if (type === 'open_market') {        // 互市:即期通商红利入账(随对方实力)·玩家方才动国库·标 tradeOpen
    var bonus = Math.round(_diploTributeAmt(strOf(fB)).money * 0.3);
    if (facA === player || facB === player) { var other = (facA === player) ? facB : facA; add({ money: bonus }, '互市·' + other); eb('与' + other + '开互市·通商之利 ' + bonus + ' 两入帑'); }
    var rOM = ensureFactionRelation(facA, facB); if (rOM) rOM.tradeOpen = true;
  } else if (type === 'annex_vassal') {       // 并吞:被吞 facB 领土/兵并入 facA·标 absorbed(原 effect:{} 空)
    if (fB) {
      if (fA && Array.isArray(fB.provinceIds)) fA.provinceIds = (fA.provinceIds || []).concat(fB.provinceIds);
      if (fA) fA.strength = (Number(fA.strength) || 0) + Math.round((Number(fB.strength) || 0) * 0.6);
      fB._absorbedBy = facA; fB._absorbedTurn = (typeof GM !== 'undefined' && GM.turn) || 0; fB.strength = 0; fB.provinceIds = [];
      eb(facA + '并吞' + facB + '·其疆土部众归并');
    }
  } else if (type === 'recognize_independence') {  // 承认独立:facB 脱离附庸(领土留其自身)
    if (fB) { fB.suzerainFaction = ''; fB._independentTurn = (typeof GM !== 'undefined' && GM.turn) || 0; eb(facA + '承认' + facB + '独立·解除附庸'); }
  }
}

/**
 * 势力关系摘要（供 prompt 注入）
 */
function summarizeFactionRelation(facA, facB) {
  var r = (GM.factionRelationsMap && GM.factionRelationsMap[facA] && GM.factionRelationsMap[facA][facB]);
  if (!r) return '';
  var parts = [];
  parts.push(facA + '→' + facB);
  if (r.trust > 70) parts.push('信');
  else if (r.trust < 30) parts.push('疑');
  if (r.hostility > 50) parts.push('敌');
  if (r.economicTies > 50) parts.push('贸');
  if (r.kinshipTies > 20) parts.push('姻');
  if (r.culturalAffinity > 40) parts.push('文');
  if (r.territorialDispute > 40) parts.push('疆');
  if (r.warsCount > 0) parts.push('战'+r.warsCount+'次');
  if (r.spiesTo > 0) parts.push('细作'+r.spiesTo);
  if (r.proxies && r.proxies.length) parts.push('代理'+r.proxies.length);
  if (r.historicalEvents && r.historicalEvents.length > 0) {
    var _recent = r.historicalEvents.slice(-2).map(function(e) { return 'T'+e.turn+':'+(e.event||e.type).substring(0,20); }).join(';');
    parts.push('[史:'+_recent+']');
  }
  return parts.join(' ');
}

// 导出
if (typeof window !== 'undefined') {
  window.NPC_RELATION_LABELS = NPC_RELATION_LABELS;
  window.CONFLICT_LEVELS = CONFLICT_LEVELS;
  window.NPC_INTERACTION_TYPES = NPC_INTERACTION_TYPES;
  window.FACTION_INTERACTION_TYPES = FACTION_INTERACTION_TYPES;
  window.ensureCharRelation = ensureCharRelation;
  window.applyNpcInteraction = applyNpcInteraction;
  window.decayConflictLevels = decayConflictLevels;
  window.inheritBloodFeuds = inheritBloodFeuds;
  window.getTopRelations = getTopRelations;
  window.summarizeRelation = summarizeRelation;
  window.ensureFactionRelation = ensureFactionRelation;
  window.applyFactionInteraction = applyFactionInteraction;
  window.summarizeFactionRelation = summarizeFactionRelation;
  window.normalizeFactionRelationsMap = normalizeFactionRelationsMap;
  window.syncFactionRelationsFromList = syncFactionRelationsFromList;
  window.findFactionRelationRecord = findFactionRelationRecord;
  window.setFactionRelation = setFactionRelation;
  window.removeFactionRelationsForFaction = removeFactionRelationsForFaction;
  window.removeFactionRelationsFor = removeFactionRelationsForFaction;
  window.TM = window.TM || {};
  window.TM.Factions = window.TM.Factions || {};
  window.TM.Factions.ensureRelation = ensureFactionRelation;
  window.TM.Factions.setRelation = setFactionRelation;
  window.TM.Factions.syncRelationsFromList = syncFactionRelationsFromList;
  window.TM.Factions.removeRelationsForFaction = removeFactionRelationsForFaction;
  window.TM.Factions.configureMembershipProvider = configureFactionMembershipProvider;
  window.TM.Factions.removeFaction = removeFaction;
}

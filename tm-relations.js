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
  betray:            { label:'背叛', conflict:+3, effect:{trust:-50, affinity:-30, hostility:+25}, mood:'恨', important:10, fameActor:-15, virtueActor:-20 },
  reconcile:         { label:'和解', conflict:-2, effect:{affinity:+10, trust:+5}, mood:'喜', important:6, fameActor:+2, virtueActor:+3 },
  mourn_together:    { label:'共哀', conflict:-1, effect:{affinity:+8}, mood:'忧', important:5, fameActor:+1, virtueActor:+2 },
  rival_compete:     { label:'竞争', conflict:+1, effect:{affinity:-5, respect:+3}, mood:'平', important:4, fameActor:+1 },
  guarantee:         { label:'担保', conflict:0, effect:{trust:+10, owesFavor:+1}, mood:'平', important:5, fameActor:+2, virtueActor:+4 },
  slander:           { label:'诽谤', conflict:+1, effect:{affinity:-12, hostility:+10}, mood:'恨', important:6, fameActor:-4, fameTarget:-3, virtueActor:-3 }
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
function ensureCharRelation(charA, charB) {
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

/**
 * 应用一次NPC互动
 */
function applyNpcInteraction(actor, target, type, extra) {
  extra = extra || {};
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
  if (!GM.factionRelationsMap) GM.factionRelationsMap = {};
  if (!GM.factionRelationsMap[facA]) GM.factionRelationsMap[facA] = {};
  if (!GM.factionRelationsMap[facA][facB]) {
    GM.factionRelationsMap[facA][facB] = {
      trust: 50, hostility: 0, economicTies: 10, culturalAffinity: 10,
      kinshipTies: 0, territorialDispute: 0,
      historicalEvents: [], activeTreaties: [], borderOpen: false,
      warsCount: 0, spiesFrom: 0, spiesTo: 0,
      proxies: []
    };
  }
  return GM.factionRelationsMap[facA][facB];
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
}

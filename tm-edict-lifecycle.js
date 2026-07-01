// @ts-check
// ============================================================
// 诏令生命周期 + 类型分化 + 利益集团阻力模型
// 中国施政真实模型——诏令不是一纸即成，有程序、有阻力、有变形
// ============================================================

// ── 诏令类型（12 大类） ──
// 生命周期以真实时间(天数)表示，游戏运行时按 P.time.daysPerTurn 换算为回合数
// 历史经验值：改革需 3-15 年；减税需数月；人事 1-3 月；大赦即日；战事 1-3 年
var EDICT_TYPES = {
  amnesty: {
    label:'大赦/恩诏', lifecycleDays:7, immediate:true,
    historyPaths:['新帝登基','遇吉祥','平叛后'],
    affectedClasses:{ '农民':+8, '囚犯':+30, '官僚':0 },
    resistance:{ '士绅':5, '官僚':5 },
    keywords:['大赦','赦免','恩','免罪','减刑','放归']
  },
  reward: {
    label:'封赏/加恩', lifecycleDays:10, immediate:true,
    historyPaths:['功臣封赏','寿辰恩荣'],
    affectedClasses:{ '官僚':+10, '宗室':+15, '国库':-3 },
    resistance:{ '清议士林':10 },
    keywords:['封','赏','赐','加官','进爵','荫']
  },
  personnel: {
    label:'人事任免', lifecycleDays:60, immediate:false,
    historyPaths:['新官上任','调任外放','罢免'],
    affectedClasses:{ '官僚':+5, '党派':+10 },
    resistance:{ '失势方':30 },
    keywords:['任','命','调','迁','升','罢','免','外放','召回']
  },
  tax_reduction: {
    label:'减免赋税', lifecycleDays:180, immediate:false,
    historyPaths:['灾后','新君恩','太平年'],
    affectedClasses:{ '农民':+15, '商贾':+8, '国库':-15 },
    resistance:{ '地方胥吏':30, '征税官':20 },
    unintendedRisk:'middlemen_skim',
    keywords:['免','减','蠲','缓','宽','轻','税','粮','赋','役']
  },
  tax_increase: {
    label:'加征/派捐', lifecycleDays:180, immediate:false,
    historyPaths:['军费','灾后','内廷花销'],
    affectedClasses:{ '农民':-20, '商贾':-15, '国库':+10 },
    resistance:{ '农民':60, '士绅':40 },
    unintendedRisk:'peasant_revolt',
    keywords:['加','征','派','饷','课','捐']
  },
  admin_reform: {
    label:'行政改革', lifecycleDays:1095, immediate:false, phased:true, // 3年
    historyPaths:['新君革新','中兴'],
    affectedClasses:{ '官僚':-10, '皇权':+15 },
    resistance:{ '官僚':70, '被裁者':90 },
    keywords:['裁','并','省','减','改制','整饬','革新']
  },
  economic_reform: {
    label:'经济改革', lifecycleDays:3650, immediate:false, phased:true, // 约10年(王安石变法约15年)
    historyPaths:['王安石','张居正','雍正'],
    affectedClasses:{ '国库':+20, '士绅':-20, '豪强':-25 },
    resistance:{ '士绅':85, '豪强':95, '胥吏':70 },
    unintendedRisk:'elite_backlash',
    keywords:['新法','青苗','一条鞭','摊丁入亩','清丈','均田','平籴','市易']
  },
  military_mobilize: {
    label:'军事动员', lifecycleDays:180, immediate:false,
    historyPaths:['征伐','平叛'],
    affectedClasses:{ '军人':+10, '农民':-15, '国库':-20 },
    resistance:{ '反战派':30 },
    keywords:['征','讨','伐','发兵','调','屯','戍']
  },
  diplomacy: {
    label:'对外战和', lifecycleDays:90, immediate:false,
    historyPaths:['和亲','议和','宣战','册封'],
    affectedClasses:{ '外藩':0 },
    resistance:{ '主战派':50, '主和派':50 },
    keywords:['和','议','盟','册封','和亲','质子']
  },
  imperial_ritual: {
    label:'巡幸/祭祀', lifecycleDays:120, immediate:false,
    historyPaths:['封禅','谒陵','南巡','祭天'],
    affectedClasses:{ '皇权':+10, '地方':-10, '国库':-15 },
    resistance:{ '地方':40, '清议':30 },
    keywords:['巡','幸','祭','封禅','谒陵','拜庙']
  },
  criminal_justice: {
    label:'刑狱敕命', lifecycleDays:14, immediate:true,
    historyPaths:['大狱','平反','诛杀'],
    affectedClasses:{ '朝野':0 },
    resistance:{ '同党':40 },
    keywords:['诛','杀','刑','下狱','查办','平反','昭雪']
  },
  education_culture: {
    label:'文教诏', lifecycleDays:730, immediate:false, // 2年(建学/修书周期)
    historyPaths:['开科','兴学','修书'],
    affectedClasses:{ '士人':+15, '寒门':+10, '国库':-5 },
    resistance:{ '世家':20 },
    keywords:['兴学','建学','修书','印经','刊']  // G2·step 0a·去掉 '开科'/'取士'·让 enke 优先识别
  },
  enke: {
    // G2·Phase G·step 0a·恩科·v3.1 Path C 诏令集成
    label:'恩科',
    lifecycleDays:730,                      // 2 年完成 (筹备 + 乡试 + 会试 + 殿试 + 谢恩)
    immediate:false, phased:true,
    historyPaths:['登基恩科','寿诞恩科','大婚恩科','平乱恩科','瑞祥恩科','无故强发'],
    affectedClasses:{ '士林':+10, '官僚':-5, '国库':-8 },
    resistance:{ '清议士林':30, '常科派':40, '礼部':50 },
    unintendedRisk:'enke_abuse_party',      // 滥开 → 恩科党尾大不掉
    keywords:['特赐','恩科','开恩','士子','恩荣','蒙恩','科赐','钦取','开科','取士']
  },
  wuju: {
    // G3·Phase G·武举·Path C 诏令集成·M4 strong keyword required
    label:'武举',
    lifecycleDays:1095,                       // 3 年 phased
    immediate:false, phased:true,
    historyPaths:['war-crisis','general-shortage','periodic','muster-warriors','无故强发武举'],
    affectedClasses:{ '军':+15, '士林':-3, '国库':-15 },
    resistance:{ '文官':40, '清议':30, '兵部':20 },
    unintendedRisk:'military_coup_risk',      // 武勋哗变·尾大不掉
    keywords:['武举','武科','募将','设武科','钦点武状元']   // 删 '选武' 避撞 '选兵'
  },
  school: {
    // Phase H·私学/书院·Path C 诏令集成·15 类·strong keyword
    label:'兴学/禁讲学',
    lifecycleDays:1095,                       // 3 年 phased
    immediate:false, phased:true,
    historyPaths:['兴官学','禁讲学','扶书院','官化书院','无故强禁'],
    affectedClasses:{ '士林':+10, '国库':-5, '皇权':+5 },
    resistance:{ '士林':50, '在野儒':70, '清议':40 },
    unintendedRisk:'literati_revolt',          // 士林反弹·东林党根源
    keywords:['兴学','建学','禁讲','禁书院','立书院','扶书院','官化','复立']
  },
  tongzi: {
    // G5·Phase G·童子科·Path C 诏令集成·17 类·罕见 (10 年 cooldown)·strong keyword
    label:'童子科',
    lifecycleDays:365,                         // 1 年完成·短周期
    immediate:false, phased:true,
    historyPaths:['recommendation','royal-recognition','无故强荐'],
    affectedClasses:{ '士林':+5, '民心':+3, '国库':-2 },
    resistance:{ '清议':10, '礼部':15 },         // 罕见·resistance 极低
    unintendedRisk:'precocious_decline',        // 神童早凋
    keywords:['童子科','神童','荐神童','童子荐举']
  }
};

// ── 诏令生命周期阶段 ──
var EDICT_STAGES = {
  drafting:         { label:'草拟', desc:'中书舍人/翰林起草' },
  review:           { label:'审议', desc:'门下省封驳审核' },
  promulgation:     { label:'颁布', desc:'正式下令' },
  transmission:     { label:'传达', desc:'驿道传送，有时滞' },
  interpretation:   { label:'解读', desc:'地方官理解（可能曲解）' },
  execution:        { label:'执行', desc:'实际操作，消耗资源' },
  feedback:         { label:'反馈', desc:'地方上报效果/阻力' },
  adjustment:       { label:'调整', desc:'遇阻力后微调' },
  sedimentation:    { label:'沉淀', desc:'成例或废止' }
};

// ── 改革五阶段（与 stage 平行的另一维度） ──
// 同样以真实天数表示；参照王安石变法(熙宁2年至元丰8年约15年)与张居正改革(万历6年至10年约4年)平均值
var REFORM_PHASES = {
  pilot:    { label:'试点', desc:'选一二地先试行', days:365 },         // 约 1 年
  expand:   { label:'局部推广', desc:'扩至 3-5 省', days:730 },        // 约 2 年
  national: { label:'全国推广', desc:'全面铺开', days:1095 },          // 约 3 年
  backlash: { label:'反扑', desc:'既得利益集团反击', days:730 },       // 约 2 年
  outcome:  { label:'定局', desc:'延续/废止/折中', days:365 }          // 约 1 年
};

// ── 时间单位转换辅助 ──

/**
 * 获取当前剧本的每回合天数
 */
// TM_RETENTION_GUARD: edict-days-per-turn-compatible-redefinition.
// This later definition intentionally mirrors tm-utils.js for the edict module.
// Treat it as duplicated compatibility, not dead code, until the helper is centralized.
function _getDaysPerTurn() {
  if (typeof P === 'undefined' || !P.time) return 30;
  var dpt = Number(P.time.daysPerTurn);
  if (dpt > 0) return dpt;
  // 兼容旧格式 perTurn
  var perTurn = P.time.perTurn || '1m';
  if (perTurn === 'custom' && Number(P.time.customDays) > 0) return Number(P.time.customDays);
  var map = { '1d':1, '1w':7, '1m':30, '1s':90, '1y':365 };
  if (map[perTurn]) return map[perTurn];
  var n = parseInt(perTurn, 10);
  return n > 0 ? n : 30;
}

/**
 * 将真实天数换算为回合数（至少 1 回合；超过本次回合跨度的事件即 1 回合完成）
 */
function daysToTurns(days) {
  var daysPerTurn = _getDaysPerTurn();
  if (days <= daysPerTurn) return 1; // 一回合内即可完成
  return Math.max(1, Math.ceil(days / daysPerTurn));
}

/**
 * 返回某种诏令类型换算到当前剧本下的回合数
 */
function getEdictLifecycleTurns(edictType) {
  var t = EDICT_TYPES[edictType];
  if (!t) return 1;
  return daysToTurns(t.lifecycleDays || 30);
}

/**
 * 返回改革某阶段在当前剧本下的回合数
 */
function getReformPhaseTurns(phase) {
  var p = REFORM_PHASES[phase];
  if (!p) return 1;
  return daysToTurns(p.days || 365);
}

/**
 * 生成"几回合推演完"的人类可读描述（自适应回合时长）
 * - 若 daysPerTurn 很大（如 1 年/回合），即使改革也可能 1-2 回合内完成
 * - 若 daysPerTurn 很小（如 1 天/回合），改革可能上百回合
 */
function formatLifecycleForScript(edictType) {
  var t = EDICT_TYPES[edictType];
  if (!t) return '';
  var days = t.lifecycleDays || 30;
  var daysPerTurn = _getDaysPerTurn();
  var turns = daysToTurns(days);
  // 真实时间描述
  var realTime = days < 14 ? days + '日内' : days < 90 ? Math.round(days/30) + '月左右' : days < 730 ? Math.round(days/30) + '月' : Math.round(days/365) + '年';
  // 回合描述
  if (turns === 1 && daysPerTurn >= days) return '1 回合内完成（此剧本 1 回合 ≈ ' + daysPerTurn + '天，可一次推演完成）';
  return '约 ' + turns + ' 回合（真实时间约 ' + realTime + '，此剧本 1 回合 ≈ ' + daysPerTurn + '天）';
}

// ── 阻力来源与应对 ──
var RESISTANCE_SOURCES = {
  '士绅':    { defaultStr:60, counter:'科举怀柔/分化利益' },
  '豪强':    { defaultStr:70, counter:'严法压制/建立地方监察' },
  '官僚':    { defaultStr:40, counter:'加官/调动/清洗' },
  '胥吏':    { defaultStr:65, counter:'严刑/精简编制' },
  '宗室':    { defaultStr:80, counter:'推恩令/宗正监督' },
  '外戚':    { defaultStr:70, counter:'内外隔离' },
  '宦官':    { defaultStr:50, counter:'裁阉党/司礼监改革' },
  '武将':    { defaultStr:50, counter:'杯酒释兵权/定期轮换' },
  '商贾':    { defaultStr:30, counter:'抑商/专卖' },
  '清议':    { defaultStr:20, counter:'言路疏通' },
  '农民':    { defaultStr:30, counter:'赈济/轻徭薄赋' },
  '土司':    { defaultStr:75, counter:'改土归流' },
  '藩王':    { defaultStr:90, counter:'削藩/移封' },
  '僧道':    { defaultStr:35, counter:'度牒管控' }
};

// ── 根据诏令文本预测类型（玩家端预览用） ──
function classifyEdict(edictText) {
  var text = (edictText || '').toLowerCase();
  var scores = {};
  Object.keys(EDICT_TYPES).forEach(function(k) {
    var t = EDICT_TYPES[k];
    var score = 0;
    (t.keywords || []).forEach(function(kw) {
      if (text.indexOf(kw) >= 0) score += 2;
    });
    if (score > 0) scores[k] = score;
  });
  // 取最高分
  var best = null, bestScore = 0;
  Object.keys(scores).forEach(function(k) {
    if (scores[k] > bestScore) { best = k; bestScore = scores[k]; }
  });
  return best || 'amnesty'; // fallback
}

/**
 * 计算诏令执行乘数（0-1.5）
 * 综合执行者能力/忠诚/吏治/阻力/时代
 */
function calcEdictMultiplier(edictType, executor, state) {
  state = state || {};
  var t = EDICT_TYPES[edictType] || {};
  var execAbility = 50, execLoyalty = 50;
  if (executor) {
    // 按诏令类型选用不同能力维度
    if (edictType === 'tax_reduction' || edictType === 'tax_increase' || edictType === 'economic_reform') {
      execAbility = executor.management || executor.administration || 50;
    } else if (edictType === 'military_mobilize' || edictType === 'diplomacy') {
      execAbility = executor.military || executor.administration || 50;
    } else if (edictType === 'admin_reform' || edictType === 'personnel') {
      execAbility = executor.administration || 50;
    } else if (edictType === 'education_culture') {
      execAbility = executor.intelligence || 50;
    } else {
      execAbility = executor.administration || 50;
    }
    execLoyalty = executor.loyalty || 50;
  }
  var resistance = state.resistance || 30; // 由 AI 评估
  var eraBonus = state.eraBonus || 0; // -10 to +10

  var multiplier = (
    (execAbility / 100) * 0.35 +
    (execLoyalty / 100) * 0.25 +
    (eraBonus / 100) * 0.05 -
    (resistance / 100) * 0.25 +
    0.55 // base
  );
  return Math.max(0.1, Math.min(1.5, multiplier));
}

/**
 * 根据诏令预估阻力（0-100）
 */
function estimateResistance(edictType, state) {
  state = state || {};
  var t = EDICT_TYPES[edictType] || {};
  if (!t.resistance) return 30;
  var total = 0, count = 0;
  Object.keys(t.resistance).forEach(function(cls) {
    var base = t.resistance[cls] || 30;
    // 如果该阶层当前满意度低，阻力加倍
    var clsSat = (state.classSatisfaction && state.classSatisfaction[cls]) || 50;
    var mult = clsSat < 30 ? 1.5 : clsSat > 70 ? 0.7 : 1.0;
    total += base * mult;
    count++;
  });
  return count > 0 ? Math.round(total / count) : 30;
}

/**
 * 生成预警文本（供玩家颁诏时参考）
 */
function generateEdictForecast(edictType) {
  var t = EDICT_TYPES[edictType];
  if (!t) return { label:'未分类', forecast:'' };
  var lines = [];
  lines.push('类型：' + t.label);
  lines.push('预计生命周期：' + formatLifecycleForScript(edictType));
  if (t.phased) lines.push('※ 改革类诏令——将进入"试点→推广→反扑→定局"5阶段');
  if (t.historyPaths && t.historyPaths.length) lines.push('历史典范：' + t.historyPaths.join('、'));
  if (t.affectedClasses) {
    var winners = [], losers = [];
    Object.keys(t.affectedClasses).forEach(function(cls) {
      var v = t.affectedClasses[cls];
      if (v > 0) winners.push(cls + '+' + v);
      if (v < 0) losers.push(cls + v);
    });
    if (winners.length) lines.push('受益：' + winners.join('、'));
    if (losers.length) lines.push('受损：' + losers.join('、'));
  }
  if (t.resistance) {
    var resLines = [];
    Object.keys(t.resistance).forEach(function(cls) {
      resLines.push(cls + '('+ t.resistance[cls] + ')');
    });
    if (resLines.length) lines.push('主阻力：' + resLines.join('、'));
  }
  if (t.unintendedRisk) {
    var riskMap = {
      middlemen_skim:'⚠ 风险：胥吏截留，惠民打折',
      peasant_revolt:'⚠ 风险：加赋过急可能引发民变',
      elite_backlash:'⚠ 风险：精英阶层反扑，反改革潮'
    };
    if (riskMap[t.unintendedRisk]) lines.push(riskMap[t.unintendedRisk]);
  }
  return { label: t.label, forecast: lines.join('\n'), type: t };
}

// ── F·改革杠杆 typed-incidence（2026-06-16·未 ship 未 commit）：接上 orphaned EDICT_TYPES.affectedClasses ──
//   把诏令类型的跨阶层赢家/输家向量经 gateSatisfaction 落地（±14 预算自动 bound·与 AI class_changes/huji 硬效果不双砸·source 记账）。
//   仅阶层类键（农民/官僚/士绅/豪强/商贾/军/士人/士林/寒门/宗室）→ 标签路由匹配 GM.classes（含现生阶层）；
//   非阶层键（国库/皇权/民心/囚犯/党派/外藩/地方/朝野）归 parser/别系不在此施；
//   盲 fallback（无关键词命中→默认 amnesty）不施；按类取最大绝对值 delta 防粗键重叠人为叠加。
//   仅玩家诏令路径（processEdictEffects）调用→与 AI class_changes 天然分离；朝代中立（标签路由·不写死单朝阶层）。
var _EDICT_CLASS_MATCH = {
  '农民': /自耕|佃|编户|农/, '寒门': /自耕|寒|庶|农/,
  '商贾': /商|贾/, '商人': /商|贾/,
  '士绅': /绅|豪强|地主/, '豪强': /豪强|地主|绅/,
  '士人': /士大夫|士林|生员|翰林/, '士林': /士大夫|士林|生员|翰林/, '官僚': /士大夫|官僚|翰林/,
  '军人': /军|武人/, '军': /军|武人/,
  '宗室': /宗室|宗藩|藩王|皇族/
};
function applyEdictTypedIncidence(root, edictText, opts) {
  opts = opts || {};
  if (!root || !Array.isArray(root.classes) || !edictText) return null;
  var CE = (typeof TM !== 'undefined' && TM.ClassEngine && typeof TM.ClassEngine.gateSatisfaction === 'function') ? TM.ClassEngine : null;
  if (!CE) return null;   // 无总闸则不施（守纪律·不绕闸直写满意度）
  var type = classifyEdict(edictText);
  var def = EDICT_TYPES[type];
  if (!def || !def.affectedClasses) return null;
  // 防盲 fallback：所选类型的关键词须真出现在文本（classifyEdict 无命中默认 amnesty），否则不施
  var hit = (def.keywords || []).some(function(kw) { return edictText.indexOf(kw) >= 0; });
  if (!hit) return null;
  var SCALE = 0.5;   // 不独占 ±14 预算·留余地给其余信号；溢出由闸夹
  var turn = opts.turn != null ? opts.turn : (root.turn || 0);
  var perClass = [];   // 按 GM.class 聚合·取最大绝对值 delta（防粗键重叠 e.g. 士绅+豪强 同砸缙绅）
  Object.keys(def.affectedClasses).forEach(function(key) {
    var delta = Number(def.affectedClasses[key]) || 0;
    if (!delta) return;
    var re = _EDICT_CLASS_MATCH[key];
    if (!re) return;   // 非阶层键跳过
    root.classes.forEach(function(cls) {
      if (!cls || !re.test(cls.name || '')) return;
      var ex = perClass.filter(function(p) { return p.cls === cls; })[0];
      if (!ex) perClass.push({ cls: cls, delta: delta });
      else if (Math.abs(delta) > Math.abs(ex.delta)) ex.delta = delta;
    });
  });
  var applied = [];
  perClass.forEach(function(p) {
    var raw = p.delta * SCALE;
    var res = CE.gateSatisfaction(root, p.cls, raw, { turn: turn, source: 'edict-typed-incidence:' + type, reason: (def.label || type) + '·跨阶层后果' });
    applied.push({ name: p.cls.name, delta: raw, approved: res ? res.approved : 0 });
  });
  if (applied.length && typeof addEB === 'function') {
    var winners = applied.filter(function(a) { return a.delta > 0; }).map(function(a) { return a.name; });
    var losers = applied.filter(function(a) { return a.delta < 0; }).map(function(a) { return a.name; });
    addEB('诏令', (def.label || '诏令') + '·阶层向背：' + (winners.length ? '利' + winners.join('、') : '') + (losers.length ? (winners.length ? '；' : '') + '损' + losers.join('、') : ''));
  }
  return { type: type, applied: applied };
}

// 导出
if (typeof window !== 'undefined') {
  window.applyEdictTypedIncidence = applyEdictTypedIncidence;
  window.EDICT_TYPES = EDICT_TYPES;
  window.EDICT_STAGES = EDICT_STAGES;
  window.REFORM_PHASES = REFORM_PHASES;
  window.RESISTANCE_SOURCES = RESISTANCE_SOURCES;
  window.classifyEdict = classifyEdict;
  window.calcEdictMultiplier = calcEdictMultiplier;
  window.estimateResistance = estimateResistance;
  window.generateEdictForecast = generateEdictForecast;
  window.daysToTurns = daysToTurns;
  window.getEdictLifecycleTurns = getEdictLifecycleTurns;
  window.getReformPhaseTurns = getReformPhaseTurns;
  window.formatLifecycleForScript = formatLifecycleForScript;
}

// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
//  tm-chaoyi-v3.js — 常朝 v3（preview 移植 + GM Adapter）
//  状态：迁移波 1·骨架 + 数据桥接·UI 完整·尚未路由
//  依赖：tm-chaoyi.js (openChaoyi/closeChaoyi/addCYBubble) /
//        tm-ai-infra.js (callAI / _aiDialogueTok / _aiDialogueWordHint / extractJSON) /
//        tm-chaoyi-v2.js (_cc2_buildAgendaPrompt 借用·暂时)
//
//  R157 章节导航：
//    §A [L1]   GM Adapter prelude（buildCharsFromGM / buildAgendaFromGM 等）
//    §B [L80]  preview 移植 JS（runOpening/runAnnounce/runDetail/runDebate/runClosing）
//    §C [末尾] 入口注册 _cc3_open / 路由桩
// ============================================================

// ───────────────────────────────────────────
// §A · GM Adapter（替代 preview mock 数据源）
// ───────────────────────────────────────────

/** 从 GM.chars 构建 CHARS 字典（preview 期望的格式） */
/** 旧档兼容·解析玩家本朝势力名·多源回退 */
function _cc3_resolvePlayerFaction() {
  // ① 直接读 P.playerInfo.factionName
  let pf = (typeof P !== 'undefined' && P.playerInfo && P.playerInfo.factionName) || '';
  if (pf) return pf;
  // ② 兜底：从玩家角色查 faction
  const pname = (typeof P !== 'undefined' && P.playerInfo && P.playerInfo.characterName) || '';
  if (pname && typeof GM !== 'undefined' && Array.isArray(GM.chars)) {
    const pch = GM.chars.find(c => c && (c.name === pname || c.isPlayer));
    if (pch && pch.faction) return pch.faction;
  }
  // ③ 兜底：找 isPlayer 角色
  if (typeof GM !== 'undefined' && Array.isArray(GM.chars)) {
    const pch = GM.chars.find(c => c && c.isPlayer);
    if (pch && pch.faction) return pch.faction;
  }
  // ④ 兜底：从剧本读
  const sc = (typeof P !== 'undefined' && P.scenario) || {};
  if (sc.playerInfo && sc.playerInfo.factionName) return sc.playerInfo.factionName;
  return '';
}

/** 旧档兼容·判断角色是否本朝（缺 ch.faction 时用 officialTitle 兜底推断） */
function _cc3_isOwnFaction(ch, playerFaction) {
  if (!playerFaction) return true; // 无玩家势力可比·全放行（保留旧档可玩性）
  if (!ch.faction) {
    // 老档无 faction·按官名启发：标准汉式官名一律算本朝
    const t = (ch.officialTitle || ch.title || '');
    if (/尚书|侍郎|巡抚|总督|提督学政|学士|主事|郎中|员外|御史|给事中|都察|寺卿|参议|参政|布政|按察|府尹|知府|知州|知县|内阁|首辅|次辅|阁臣|大学士|司礼|秉笔|掌印|总督|经略|镇守|总兵/.test(t)) return true;
    return false; // 既无 faction 又非汉官名·宁滤勿留
  }
  // 严格相等
  if (ch.faction === playerFaction) return true;
  // 模糊匹配（"明" / "明朝" / "明朝廷" 视为同一）
  const norm = function(s) { return String(s).replace(/朝廷$|朝$|王朝$|帝国$/, ''); };
  if (norm(ch.faction) && norm(ch.faction) === norm(playerFaction)) return true;
  return false;
}

/** 构造"可传召池"·包含正常缺朝者 + 身份本不入朝者
 *  分类：
 *    court_absent  - 已是朝官但缺朝（risk 0·正常召）
 *    inner_palace  - 后宫女眷（risk 3·后宫干政·言官必弹）
 *    student       - 学生（risk 1·破格召问·小风险）
 *    clan          - 宗室王族（risk 3·政变嫌疑·重风险）
 *    commoner      - 在野/方外（risk 2·破例召）
 */
function _cc3_buildSummonablePool() {
  const pool = [];
  if (typeof GM === 'undefined' || !Array.isArray(GM.chars)) return pool;
  const playerFaction = _cc3_resolvePlayerFaction();
  const playerName = (typeof P !== 'undefined' && P.playerInfo && P.playerInfo.characterName) || '';
  GM.chars.forEach(function(ch) {
    if (!ch || !ch.name || ch.alive === false) return;
    if (ch.isPlayer || (playerName && ch.name === playerName)) return;
    if (!_cc3_isOwnFaction(ch, playerFaction)) return;
    // 法律/身体不在自由身·不可召
    if (ch._imprisoned || ch.imprisoned || ch._inJail || ch._jailed) return;
    if (ch._exiled || ch._banished) return;
    if (ch._fled || ch._missing) return;
    if (typeof ch.health === 'number' && ch.health <= 10) return;
    // 已在朝且无缺席状态·跳过（不需召）
    if (CHARS[ch.name] && !CHARS[ch.name].absent) return;

    const t = ch.officialTitle || ch.title || '';
    const isOfficial = _cc3_isCourtOfficial(ch);

    let category = 'commoner', risk = 2, reasonLabel = '';
    if (isOfficial) {
      category = 'court_absent';
      risk = 0;
      reasonLabel = (CHARS[ch.name] && CHARS[ch.name].absent) || _cc3_classifyAbsent(ch) || '远离京师';
    } else if (/皇后|皇太后|皇贵妃|贵妃|皇妃|妃|嫔|才人|选侍|婕妤|淑仪|淑女|美人|宫人|夫人$|乳母|奉圣|宫娥|侍女/.test(t)) {
      category = 'inner_palace';
      risk = 3;
      reasonLabel = '后宫·' + (t || '女眷');
    } else if (/^太子|公主|郡主|藩王|宗室|皇子|郡王|亲王$/.test(t)) {
      category = 'clan';
      risk = 3;
      reasonLabel = '宗室·' + t;
    } else if (/监生$|秀才$|举人$|生员$|童生|庶吉士$/.test(t)) {
      category = 'student';
      risk = 1;
      reasonLabel = '在野·' + t;
    } else {
      category = 'commoner';
      risk = 2;
      reasonLabel = '在野·' + (t || '布衣');
    }
    const riskTag = { court_absent: '', inner_palace: ' [⚠️后宫干政]', student: ' [破格召学]', clan: ' [⚠️宗室预政]', commoner: ' [破例召民]' }[category] || '';
    pool.push({
      name: ch.name,
      category: category,
      risk: risk,
      reasonLabel: reasonLabel,
      displayLabel: ch.name + '（' + reasonLabel + '）' + riskTag
    });
  });
  return pool;
}

/** 判断角色是否"在京文武大臣"（常朝可参与） */
function _cc3_isCourtOfficial(ch) {
  if (!ch) return false;
  const t = (ch.officialTitle || ch.title || '');
  // ── 黑名单：后宫女眷 / 太监杂役 / 学生 / 命妇·一律不入常朝 ──
  // 注：宦官系如"司礼监掌印/秉笔太监"是入朝的·此处只挡纯杂役太监（无品级"小太监/中常侍/答应"）
  if (/皇后|皇太后|皇贵妃|贵妃|皇妃|妃|嫔|才人|选侍|婕妤|淑仪|淑女|美人|宫人/.test(t)) return false;
  if (/夫人$|乳母|保姆|奉圣|宫娥|侍女/.test(t)) return false; // 客氏=奉圣夫人挡这里
  if (/^太子|公主|郡主|藩王|宗室|王子|皇子|郡王|亲王$/.test(t) && !/太子太傅|太子少保|太子少傅|太子太师/.test(t)) return false;
  if (/监生$|秀才$|举人$|生员$|童生|进士及第$|庶吉士$/.test(t)) return false; // 史可法·国子监生 挡这里
  if (/平民|布衣|草民|庶人|百姓/.test(t)) return false;
  // 没有官职描述的也排除（无 title）
  if (!t) return false;
  // ── 白名单：标准官职关键字（含 OR 即视为大臣）──
  const whitelist = /尚书|侍郎|侍读|侍讲|学士|大学士|首辅|次辅|阁臣|内阁|巡抚|总督|提督|经略|督师|总兵|副将|参将|游击|守备|千户|百户|指挥使|指挥同知|指挥佥事|都督|都指挥|京卫|锦衣卫|御史|给事中|都察|科道|道御史|寺卿|少卿|寺丞|郎中|员外郎|主事|中书|翰林|通政|光禄|鸿胪|太仆|太常|太医院|太学|国子祭酒|博士|监正|监副|主簿|府尹|知府|同知|通判|推官|知州|知县|布政|参政|参议|按察|学政|提学|盐运|府丞|司礼|秉笔|掌印|总管|提督东厂|提督西厂|提督内官|镇守|戍守|经制|提刑|按抚|宣慰|宣抚|安抚使|大行|侍中|常侍|内臣|少傅|少保|少师|太傅|太保|太师/;
  return whitelist.test(t);
}

function _cc3_buildCharsFromGM() {
  const dict = {};
  const chars = (typeof GM !== "undefined" && GM.chars) || [];
  // 玩家本朝势力名（如「明朝廷」）·非本朝者（后金/蒙古/起义军/朝鲜等）不入朝议
  const playerFaction = _cc3_resolvePlayerFaction();
  const playerName = (typeof P !== 'undefined' && P.playerInfo && P.playerInfo.characterName) || '';
  chars.forEach(function(ch) {
    if (!ch || !ch.name || ch.alive === false) return;
    // 排除玩家自己（皇帝不在"百官"列）
    if (ch.isPlayer || (playerName && ch.name === playerName)) return;
    // 排除非本朝势力（如玩家是明·则后金/蒙古/起义军不上明朝早朝）·旧档 ch.faction 缺失时用官名兜底
    if (!_cc3_isOwnFaction(ch, playerFaction)) return;
    // 排除非"在京文武大臣"·后宫女眷·学生·宗室命妇等不入常朝
    if (!_cc3_isCourtOfficial(ch)) return;
    let cls = "east";
    const title = (ch.officialTitle || ch.title || "");
    if (/将军|总兵|都督|提督|参将|副将/.test(title)) cls = "wu";
    else if (/御史|给事中|都察|科道/.test(title)) cls = "kdao";
    let rank = 9;
    if (typeof _cyGetRank === "function") {
      const r = _cyGetRank(ch);
      const rmap = { "正一品":1,"从一品":1,"正二品":2,"从二品":2,"正三品":3,"从三品":3,"正四品":4,"从四品":4,"正五品":5,"从五品":5,"正六品":6,"从六品":6,"正七品":7,"从七品":7 };
      rank = rmap[r] || 9;
    }
    dict[ch.name] = {
      title: title,
      rank: rank,
      faction: ch.faction || "中立",
      party: ch.party || '',
      loyalty: (typeof ch.loyalty === 'number') ? ch.loyalty : 50,
      integrity: (typeof ch.integrity === 'number') ? ch.integrity : 50,
      ambition: (typeof ch.ambition === 'number') ? ch.ambition : 50,
      stanceText: ch.stance || '',
      class: cls,
      initial: ch.name.charAt(0),
      absent: _cc3_classifyAbsent(ch)
    };
  });
  return dict;
}

/** G 类·5 类缺席状态识别·从 char 字段 + _isAtCapital 推断 */
function _cc3_classifyAbsent(ch) {
  if (!ch) return null;
  if (ch.alive === false) return null;
  // 状态闸·身体/法律不在朝堂者·无论是否在京·一律算缺席
  if (ch._imprisoned || ch.imprisoned || ch._inJail || ch._jailed) return "下狱待决";
  if (ch._exiled || ch._banished) return "贬谪外地";
  if (ch._retired || ch._zhi_shi) return "致仕归乡";
  if (ch._mourning || ch._inMourning) return "丁忧守制";
  if (ch._fled || ch._missing) return "逃亡失踪";
  if (typeof ch.health === 'number' && ch.health <= 10) return "病重不能起";
  if (ch._sickLeave || ch._sick) return "称病请假";
  if (ch._punished || ch._restricted || ch._reflecting) return "闭门思过";
  // 位置闸
  const inCapital = (typeof _isAtCapital === "function") ? _isAtCapital(ch) : true;
  if (inCapital) return null;
  if (ch._travelTo) return "远赴 " + ch._travelTo;
  if (ch._dispatched || ch._onMission) return "奉旨外出";
  if ((ch.loyalty || 50) < 25 && (ch.ambition || 50) > 70) return "称病在家（实斗气）";
  return "远离京师";
}

/** G 类·检测某衙门主官连续缺席次数·返回效率惩罚倍数（0 / -0.15 / -0.30） */
function _cc3_checkDeptAbsenceMalus(deptName) {
  if (typeof GM === 'undefined' || !GM._deptAbsenceTracker) return 0;
  const rec = GM._deptAbsenceTracker[deptName];
  if (!rec) return 0;
  if (rec.consecutive >= 3) return -0.30;
  if (rec.consecutive >= 2) return -0.15;
  return 0;
}

/** G 类·朝议结束记录各衙门主官缺席状况 */
function _cc3_recordDeptAbsence() {
  if (typeof GM === 'undefined') return;
  if (!GM._deptAbsenceTracker) GM._deptAbsenceTracker = {};
  const cfg = (typeof _cc3_getScenarioConfig === 'function') ? _cc3_getScenarioConfig() : { deptOptions: [] };
  const depts = cfg.deptOptions || [];
  depts.forEach(dept => {
    let principal = null;
    try {
      if (GM.chars) {
        principal = GM.chars.find(c => c && c.alive !== false && c.officialTitle && c.officialTitle.indexOf(dept) === 0);
      }
    } catch (_) {}
    if (!principal) return;
    const absent = _cc3_classifyAbsent(principal);
    if (!GM._deptAbsenceTracker[dept]) GM._deptAbsenceTracker[dept] = { consecutive: 0, lastAbsent: '' };
    const rec = GM._deptAbsenceTracker[dept];
    if (absent) {
      rec.consecutive = (rec.consecutive || 0) + 1;
      rec.lastAbsent = absent;
      rec.lastTurn = GM.turn || 0;
    } else {
      rec.consecutive = 0;
    }
  });
}

/** 从 GM 读皇威/皇权·多源回退（authority-engines 是 GM.huangwei.index 对象·老字段是 GM.vars["皇威"].value）*/
function _cc3_getPrestige() {
  if (typeof GM === 'undefined' || !GM) return 50;
  // ① 主路径：authority-engines 的 GM.huangwei（对象含 index）或纯 number
  if (GM.huangwei != null) {
    if (typeof GM.huangwei === 'object' && typeof GM.huangwei.index === 'number') return GM.huangwei.index;
    if (typeof GM.huangwei === 'number') return GM.huangwei;
  }
  // ② 次路径：GM.vars["皇威"].value（老核心系统·R10 之前架构）
  if (GM.vars && GM.vars["皇威"] && typeof GM.vars["皇威"].value === 'number') return GM.vars["皇威"].value;
  // ③ 兜底
  return 50;
}
function _cc3_getPower() {
  if (typeof GM === 'undefined' || !GM) return 50;
  // ① 主路径：GM.huangquan.index
  if (GM.huangquan != null) {
    if (typeof GM.huangquan === 'object' && typeof GM.huangquan.index === 'number') return GM.huangquan.index;
    if (typeof GM.huangquan === 'number') return GM.huangquan;
  }
  // ② 次路径：GM.vars["皇权"].value
  if (GM.vars && GM.vars["皇权"] && typeof GM.vars["皇权"].value === 'number') return GM.vars["皇权"].value;
  return 50;
}

/** 异步生成议程·走 v2 _cc2_buildAgendaPrompt + v2 callAI tier */
async function _cc3_buildAgendaFromGM() {
  if (typeof _cc2_buildAgendaPrompt !== "function") {
    console.warn('[cc3·agenda] _cc2_buildAgendaPrompt 未加载·走 fallback');
    return _cc3_fallbackAgenda();
  }
  if (typeof callAI !== "function") {
    console.warn('[cc3·agenda] callAI 未加载·走 fallback');
    return _cc3_fallbackAgenda();
  }
  if (!(P && P.ai && P.ai.key && P.ai.url)) {
    console.warn('[cc3·agenda] P.ai 未配置·走 fallback', P && P.ai);
    return _cc3_fallbackAgenda();
  }
  try {
    // v2 _cc2_buildAgendaPrompt 读 CY._cc2.attendees·v3 须先 seed
    if (typeof CY !== 'undefined') {
      if (!CY._cc2) CY._cc2 = {};
      const attendees = [];
      Object.keys(CHARS || {}).forEach(function(n) {
        const c = CHARS[n];
        if (!c || c.absent) return;
        attendees.push({
          name: n,
          title: c.title || c.office || c.position || '',
          faction: c.faction || '',
          party: c.party || c.dangPai || ''
        });
      });
      CY._cc2.attendees = attendees;
      console.log('[cc3·agenda] CY._cc2.attendees 已 seed·' + attendees.length + ' 人');
    }
    let prompt = _cc2_buildAgendaPrompt();
    // P4+·季节天气注入·让 AI 议程反映时令（AI 可能据此生成"春汛/酷暑/秋冬粮饷"等议题）
    if (typeof _cc3_getSeasonAndWeather === 'function') {
      const sw = _cc3_getSeasonAndWeather();
      const cfg = (typeof _cc3_getScenarioConfig === 'function') ? _cc3_getScenarioConfig() : null;
      prompt += '\n\n【今日时令】' + sw.season + '·' + sw.weather +
                (cfg ? '·' + cfg.audienceHall + '·' + cfg.dateLabel : '') +
                '。议程可酌情反映时令（春汛/夏旱/秋粮/冬饷·或寒朝百官冒雪/暑朝苦热等氛围）。';
    }
    // 注入财政/战争/党争/起居等真实游戏状态·议程 AI 据此生成相关议题
    try {
      const gk = (typeof GM !== 'undefined' && GM.guoku) || {};
      const nc = (typeof GM !== 'undefined' && GM.neicang) || {};
      const finParts = [];
      if (typeof gk.money === 'number') finParts.push('帑银 ' + Math.round(gk.money));
      if (typeof gk.grain === 'number') finParts.push('粮 ' + Math.round(gk.grain));
      if (typeof nc.money === 'number') finParts.push('内帑 ' + Math.round(nc.money));
      if (finParts.length) prompt += '\n【国帑现状】' + finParts.join('·') + '·议程可针对吃紧/盈余生成相应（请帑/请赈/加征/裁冗等）';
      if (typeof GM !== 'undefined' && Array.isArray(GM.activeWars) && GM.activeWars.length) {
        const wars = GM.activeWars.slice(0, 3).map(w => (w.enemy || w.opponent || '?') + (w.frontline ? '@' + w.frontline : '') + (w.status ? '(' + w.status + ')' : ''));
        prompt += '\n【在伐之敌】' + wars.join('·') + '·议程可涉边报/请饷/调兵';
      }
      const meterParts = [];
      if (typeof GM !== 'undefined') {
        if (typeof GM.partyStrife === 'number') meterParts.push('党争 ' + Math.round(GM.partyStrife));
        if (typeof GM.unrest === 'number')      meterParts.push('民变 ' + Math.round(GM.unrest));
        const corr = (GM.corruption && typeof GM.corruption.index === 'number') ? GM.corruption.index : (typeof GM.corruption === 'number' ? GM.corruption : null);
        if (corr != null) meterParts.push('腐败 ' + Math.round(corr));
      }
      if (meterParts.length) prompt += '\n【乱政指数】' + meterParts.join('·') + '·高党争易生弹劾·高民变易生地方告急·高腐败易生科道严劾';
      // 起居注最近 3 条·让议程接得上前事
      if (typeof GM !== 'undefined' && Array.isArray(GM.qijuHistory) && GM.qijuHistory.length) {
        prompt += '\n【近事·起居注】\n';
        GM.qijuHistory.slice(0, 3).forEach(q => {
          prompt += '  · ' + (q.date || ('T' + (q.turn || 0))) + '·' + String(q.content || '').slice(0, 80) + '\n';
        });
      }
      // 上回合推演摘要
      if (typeof GM !== 'undefined' && (GM._lastTurnSummary || GM._lastTurnReport)) {
        const rep = String(GM._lastTurnSummary || GM._lastTurnReport || '').slice(0, 200);
        if (rep) prompt += '\n【前回合推演摘要】' + rep;
      }
      // 长期诏书 / 进行中编年项
      if (typeof _buildLongTermActionsDigest === 'function') {
        const digest = _buildLongTermActionsDigest();
        if (digest) prompt += '\n' + digest;
      }
      // 朔朝特别注入：本月已开过早朝时·朔朝须接续不重复
      const _isPostTurnNow = (typeof state !== 'undefined' && state._isPostTurn) || (GM && GM._isPostTurnCourt);
      if (_isPostTurnNow && Array.isArray(GM._courtRecords)) {
        const sameTurnIn = GM._courtRecords.filter(function(r) {
          return r && r.phase === 'in-turn' && r.targetTurn === GM.turn;
        });
        if (sameTurnIn.length > 0) {
          prompt += '\n\n【★本月早朝已议·朔朝不可重复★】本回合月内已开早朝·下列议题已有定论·朔朝议程须避免重复·应议本月新增/未尽事宜·或就早朝结论作进一步部署：\n';
          sameTurnIn.forEach(function(r) {
            (r.decisions || []).forEach(function(d) {
              prompt += '  · ' + (d.title || '') + (d.dept ? '(' + d.dept + ')' : '') + ' → ' + (d.label || d.action) + (d.extra ? '·' + d.extra.slice(0, 80) : '') + '\n';
            });
          });
          prompt += '※朔朝议程不得与上述早朝议题主旨相同·可生成新议或就上述结论的执行/反馈/续议。\n';
        }
      }
      // 时空约束
      if (typeof _buildTemporalConstraint === 'function') {
        prompt += _buildTemporalConstraint(null);
      }
    } catch (e) { console.warn('[cc3·agenda] 状态注入异常·继续', e && e.message); }
    console.log('[cc3·agenda] 调用 AI·prompt 长度=' + prompt.length);
    const tok = (typeof _aiDialogueTok === "function") ? Math.max(5000, _aiDialogueTok("cy", 9)) : 8000;
    // 带 system prompt（朝代/玩家/规制/风格 + 时令/国势）·prompt cache 命中
    const messages = _cc3_makeMessagesWithSystem(prompt);
    const raw = (typeof callAIMessages === 'function')
      ? await callAIMessages(messages, tok, null, 'secondary')
      : await callAI(prompt, tok, null, 'secondary');
    console.log('[cc3·agenda] AI 返回·长度=' + (raw ? raw.length : 0) + '·前 200 字符=', (raw || '').slice(0, 200));
    const parsed = (typeof extractJSON === "function") ? extractJSON(raw) : null;
    console.log('[cc3·agenda] extractJSON 解析结果·type=' + (Array.isArray(parsed) ? 'array(' + parsed.length + ')' : typeof parsed), parsed);
    let items = Array.isArray(parsed) ? parsed : (parsed && typeof parsed === "object" ? [parsed] : []);
    items = items.filter(it => it && typeof it === "object" && (it.title || it.content || it.announceLine));
    if (items.length === 0) {
      console.warn('[cc3·agenda] AI 返回不可用·走 fallback');
      return _cc3_fallbackAgenda();
    }
    // B1 增强：v2 议程 prompt 没生成 selfReact/debate2·v3 本地合成
    items = items.map(_cc3_enhanceAgendaItem);
    console.log('[cc3·agenda] AI 议程已生成·' + items.length + ' 条', items);
    return items;
  } catch (e) {
    console.error('[cc3·agenda] AI 调用抛错·走 fallback', e);
    try { window.TM && TM.errors && TM.errors.captureSilent(e, "tm-chaoyi-v3:agenda"); } catch (_) {}
    return _cc3_fallbackAgenda();
  }
}

/** 给 AI 生成的议程补 selfReact / debate / debate2 字段（让流程不冷场） */
function _cc3_enhanceAgendaItem(item) {
  if (!item || typeof item !== "object") return item;
  // 默认补 detail 字段（v2 用 content·v3 期望 detail）
  if (!item.detail) item.detail = item.content || item.title || "";
  // 默认 controversial / importance
  if (typeof item.controversial !== "number") item.controversial = 3;
  if (typeof item.importance !== "number") item.importance = 5;

  // 候选 NPC 池：在京、非主奏者、非缺席
  const presenter = item.presenter;
  const target = item.target;
  const pool = [];
  Object.keys(CHARS).forEach(n => {
    const c = CHARS[n];
    if (!c || c.absent) return;
    if (n === presenter) return;
    pool.push(n);
  });
  if (pool.length < 2) return item;
  const shuffled = pool.slice().sort(() => Math.random() - 0.5);

  // selfReact：所有议程都要·1-3 条
  if (!Array.isArray(item.selfReact) || item.selfReact.length === 0) {
    const n = item.controversial >= 6 ? 3 : (item.controversial >= 3 ? 2 : 1);
    item.selfReact = shuffled.slice(0, n).map((name, idx) => ({
      name, stance: _cc3_pickStanceByFaction(name, item, idx),
      line: _cc3_genShortReact(name, item)
    }));
  }
  // debate：高争议（>5）·4-6 条
  if (item.controversial > 5 && (!Array.isArray(item.debate) || item.debate.length < 3)) {
    const slot = Math.min(6, Math.max(4, Math.floor(item.controversial / 2) + 2));
    const used = new Set((item.selfReact || []).map(r => r.name));
    const debaters = shuffled.filter(n => !used.has(n)).concat(shuffled.filter(n => used.has(n))); // 优先未表态者
    if (target && !used.has(target) && pool.includes(target)) {
      // 弹劾对象优先抢辩
      debaters.unshift(target);
    }
    item.debate = debaters.slice(0, slot).map((name, idx) => ({
      name, stance: _cc3_pickStanceByFaction(name, item, idx + 5),
      line: _cc3_genDebateLine(name, item)
    }));
  }
  // debate2：极高争议（>7）·3-4 条折中/进展
  if (item.controversial > 7 && (!Array.isArray(item.debate2) || item.debate2.length === 0)) {
    const used = new Set((item.debate || []).map(d => d.name));
    const round2Pool = (item.debate || []).slice(0, 4); // 用第一轮的人换种说法
    item.debate2 = round2Pool.map((d, idx) => ({
      name: d.name, stance: idx % 3 === 0 ? "mediate" : d.stance,
      line: _cc3_genDebate2Line(d.name, item, d.stance)
    }));
  }
  return item;
}

function _cc3_pickStanceByFaction(name, item, idx) {
  if (item && item.target === name) return "oppose";
  // 走与玩家提问一致的属性驱动立场推导（intent 当 'neutral'）
  return _cc3_computeStanceFromChar(name, item || {}, 'neutral');
}

function _cc3_genShortReact(name, item) {
  const tplPool = [
    "臣以为此事 " + (item.title || "") + " 可议。",
    "陛下圣裁 · 臣 " + name + " 随议。",
    "此事关乎大体 · 臣愿陈一二。",
    "臣闻 " + (item.dept || "某部") + " 所奏 · 心有所感。"
  ];
  return tplPool[Math.floor(Math.random() * tplPool.length)];
}

function _cc3_genDebateLine(name, item, stance) {
  const t = item.title || "此事";
  return "陛下 · " + t + " 一事 · 臣 " + name + " 谨陈一议：望陛下察焉。";
}

function _cc3_genDebate2Line(name, item, stance) {
  return "臣 " + name + " 再思之 · 此事或可分议而行 · 不必一时定夺。";
}

function _cc3_fallbackAgenda() {
  const items = [];
  // 在京且非缺席的真实 NPC 池（按部）
  const inCourtByDept = {};
  Object.keys(CHARS || {}).forEach(function(n) {
    const c = CHARS[n];
    if (!c || c.absent) return;
    const d = c.dept || c.office || '';
    if (!d) return;
    if (!inCourtByDept[d]) inCourtByDept[d] = [];
    inCourtByDept[d].push(n);
  });
  function pickPresenter(deptHint) {
    if (deptHint && inCourtByDept[deptHint] && inCourtByDept[deptHint].length) {
      return { name: inCourtByDept[deptHint][0], dept: deptHint };
    }
    // 任何在京者
    const any = Object.keys(CHARS || {}).filter(n => CHARS[n] && !CHARS[n].absent);
    if (any.length) {
      const n = any[Math.floor(Math.random() * any.length)];
      return { name: n, dept: CHARS[n].dept || CHARS[n].office || '某部' };
    }
    return { name: '某部官员', dept: deptHint || '六部' };
  }
  // 去重：排除已分配给廷议的 issue·廷议会单独处理这些
  const pending = ((GM.currentIssues || []).filter(i => i.status === "pending" && i.allocatedTo !== 'tinyi')).slice(0, 3);
  pending.forEach(function(iss) {
    const p = pickPresenter(iss.dept);
    items.push({
      presenter: p.name, dept: p.dept, type: "routine", urgency: "normal",
      title: (iss.title || "时政要议").slice(0, 10),
      announceLine: "臣有一事启奏。",
      content: iss.description || "事宜需陛下圣裁",
      detail: iss.description || "事宜需陛下圣裁·伏惟圣意。",
      controversial: 3, importance: 5, _fallback: true
    });
  });
  if (items.length === 0) {
    items.push({ presenter: "内侍", dept: "内廷", type: "routine", urgency: "normal", title: "日常无事", announceLine: "今日并无紧要奏报。", content: "百官今日并无紧要事务奏闻陛下。", detail: "百官今日并无紧要事务奏闻陛下。", controversial: 0, importance: 1, _fallback: true });
  }
  // 走一遍 enhance·补 selfReact/debate
  return items.map(_cc3_enhanceAgendaItem);
}

/** 全局 system prompt·稳定部分·byte-stable 当回合内·走 prompt cache 折扣
 *  含：朝代 / 剧本 / 玩家身份 / 朝代规制 / 写作风格 / 史实档 / 通用规约 /
 *      scenario.chaoyi.systemPromptExtra（剧本可加） / P.conf.aiPersona（玩家可加）
 */
function _cc3_buildSystemPromptStable() {
  const sc = (typeof P !== 'undefined' && P.scenario) || {};
  const cfg = (typeof _cc3_getScenarioConfig === 'function') ? _cc3_getScenarioConfig() : {};
  const playerName = (typeof P !== 'undefined' && P.playerInfo && P.playerInfo.characterName) || '皇帝';
  const playerFaction = (typeof _cc3_resolvePlayerFaction === 'function' && _cc3_resolvePlayerFaction()) || '本朝';
  const dynasty = (typeof P !== 'undefined' && P.dynasty) || sc.name || '本朝';
  const style = (typeof P !== 'undefined' && P.conf && P.conf.style) || '文学化';
  const difficulty = (typeof P !== 'undefined' && P.conf && P.conf.difficulty) || '普通';
  const gameMode = (typeof P !== 'undefined' && P.conf && P.conf.gameMode) || 'light-history';

  const styleMap = {
    '文学化': '文学性·重氛围烘托·辞藻有韵·气象阔大',
    '史书体': '史书体·简练精确·文必有据·字必凿凿·避免修辞铺陈',
    '戏剧化': '戏剧化·冲突鲜明·情感强烈·戏味浓厚·人物个性突出'
  };
  const modeMap = {
    'strict_hist': '严格史实·NPC 须严格符合史册记载·言论有典可据·不偏离历史角色',
    'light-history': '轻度史实·NPC 大体符合史实·允许合理演绎',
    'yanyi': '演义模式·NPC 性格夸张·允许跨时空发挥'
  };
  const diffMap = {
    '简单': '·NPC 多顺承·辞令较柔和·阻力较小',
    '普通': '',
    '困难': '·NPC 反对更激烈·阴谋更频繁·辞令更尖锐·言官敢于触怒'
  };

  let s = '【常朝系统说明】你正在为「天命」朝议系统生成对话·须严守以下设定：\n\n';
  s += '【时代】' + dynasty + (sc.name ? '·剧本《' + sc.name + '》' : '') + (sc.startYear ? '·公元 ' + sc.startYear + ' 年' : '') + '\n';
  s += '【玩家】' + playerName + '·' + playerFaction + '·皇帝（自称"朕"·臣下称"陛下"或"皇上"）\n';
  // 当前是早朝(月内·五更三点)还是朔朝(月初·post-turn)·优先读 state._isPostTurn（_cc3_open 入口已捕获）
  const isPostTurn = (typeof state !== 'undefined' && state._isPostTurn != null)
                     ? !!state._isPostTurn
                     : ((typeof GM !== 'undefined') && !!GM._isPostTurnCourt);
  const currentChaoName = isPostTurn ? (cfg.shuoChaoName || '朔朝') : (cfg.chaoName || '早朝');
  const currentChaoTime = isPostTurn ? '朔月初一' : '五更三点';
  s += '【朝议规制】' + (cfg.audienceHall || '正殿') + '·当下举行【' + currentChaoName + '】（' + currentChaoTime + '）' +
       '·肃朝阈值 皇威' + (((cfg.strictThreshold || {}).prestige) || 75) + '/皇权' + (((cfg.strictThreshold || {}).power) || 75) +
       '·' + (cfg.directSpeakRank != null ? '一二品阁臣可不待旨' : '百官皆需举笏请奏') + '\n';
  if (isPostTurn) s += '【朔朝特别说明】此为月初朔朝·重大决议施于下月·百官奏报多为前月总结·亦或新月规划·氛围较早朝更庄重正式\n';
  s += '【写作风格】' + (styleMap[style] || styleMap['文学化']) + '\n';
  s += '【史实档】' + (modeMap[gameMode] || modeMap['light-history']) + (diffMap[difficulty] || '') + '\n';

  s += '\n【通用规约】\n';
  s += '· 臣下发言以"臣……"开头·半文言·朝堂奏对体·字句精当\n';
  s += '· 不可用现代汉语·不可空泛附和"陛下圣明"·必须有具体观点和理由\n';
  s += '· 立场基于角色档案推导（派系/性格/忠诚/记忆/与陛下关系）·不可机械随机\n';
  s += '· 紧扣议题具体内容·不重复他臣已表态·要有差异和进展\n';
  s += '· 涉及自身利害则语气强烈·涉及记忆则态度连贯\n';
  s += '\n【发言信息源】NPC 发言可引用以下游戏状态作为论据（自下文 sysVariable 段读）：\n';
  s += '  · 御案时政（待处理时政清单·可议）·\n';
  s += '  · 国帑·征伐·乱政指数（财政/军事/党争实情·关乎是否切实可行）·\n';
  s += '  · 近回合推演摘要（近事变化·NPC 已知）·\n';
  s += '  · 近期诏令（陛下已下旨·NPC 所言不可与已颁诏书相悖；亦可言其执行中得失）·\n';
  s += '  · 起居注近事（百官昨日动向·可作为佐证或反诘）·\n';
  s += '  · 长期诏书/编年项（仍在执行的政策·NPC 应知其进度反馈）\n';
  s += '※ NPC 发言若涉及上述任一项·须明确点出（如"前番户部所奏…"/"圣上旬日前下严办之诏…"/"近年党争已积…"）\n';

  // 剧本可在 scenario.chaoyi.systemPromptExtra 加自定义本朝规约
  if (cfg.systemPromptExtra) s += '\n【本朝特设】' + cfg.systemPromptExtra + '\n';
  // 玩家可在设置面板 P.conf.aiPersona / systemPrompt 加自定义指令（目前 UI 未暴露·留扩展位）
  const personaExtra = (typeof P !== 'undefined' && P.conf && (P.conf.aiPersona || P.conf.systemPrompt)) || '';
  if (personaExtra) s += '\n【陛下附注】' + personaExtra + '\n';

  return s;
}

/** 当回合可变 system prompt·时令/朝威/七大变量/时政摘要 */
function _cc3_buildSystemPromptVariable() {
  let s = '';
  const cfg = (typeof _cc3_getScenarioConfig === 'function') ? _cc3_getScenarioConfig() : {};
  // 时局
  s += '【今日】' + (cfg.dateLabel || '本朝某年');
  if (typeof state !== 'undefined' && state._currentSeason) {
    s += '·' + state._currentSeason + '·' + (state._currentWeather || '晴');
  }
  // 朝威·暴露具体数值 + 阈值 + 临界判定
  const info = _cc3_getStrictCourtInfo();
  s += '\n【朝威】皇威 ' + info.prestige + ' / 皇权 ' + info.power + '·肃朝阈值 ' + info.thPrestige + '/' + info.thPower +
       '·当前【' + (info.isStrict ? '肃朝' : '众言') + '】' + (info.note ? '（' + info.note + '）' : '') + '\n';
  // 七大变量·多源回退（authority-engines 主路径 GM.<name> 对象·次路径 GM.vars[zh].value）
  if (typeof GM !== 'undefined' && GM) {
    const valueOf = function(obj) {
      if (obj == null) return null;
      if (typeof obj === 'number') return obj;
      if (typeof obj === 'object' && typeof obj.index === 'number') return obj.index;
      if (typeof obj === 'object' && typeof obj.value === 'number') return obj.value;
      return null;
    };
    // 中文名 → 主路径英文键
    const map = { '皇威': 'huangwei', '皇权': 'huangquan', '民心': 'minxin', '吏治': 'lizhi', '国势': 'guoshi', '文教': 'wenjiao', '边备': 'bianbei' };
    const parts = [];
    Object.keys(map).forEach(function(zh) {
      let x = null;
      // 优先主路径
      if (GM[map[zh]] != null) x = valueOf(GM[map[zh]]);
      // 次路径 GM.vars[zh]
      if (x == null && GM.vars && GM.vars[zh]) x = valueOf(GM.vars[zh]);
      if (typeof x === 'number') parts.push(zh + ' ' + Math.round(x));
    });
    if (parts.length) s += '【国势】' + parts.join('·') + '\n';
  }
  // 顶层时政（御案·最多 6 条·带描述·排除已分配给廷议的）
  const issues = ((typeof GM !== 'undefined' && GM.currentIssues) || []).filter(i => i && i.status === 'pending' && i.allocatedTo !== 'tinyi').slice(0, 6);
  if (issues.length) {
    s += '【御案时政·待处理】\n';
    issues.forEach(i => {
      const desc = String(i.description || '').slice(0, 60);
      s += '  · ' + (i.title || '') + (desc ? '：' + desc : '') + (i.dept ? '（' + i.dept + '）' : '') + '\n';
    });
  }
  // 财政状况（帑廪/内帑/积粮/布）
  if (typeof GM !== 'undefined') {
    const gk = GM.guoku || {};
    const nc = GM.neicang || {};
    const finParts = [];
    if (typeof gk.money === 'number')  finParts.push('帑银 ' + Math.round(gk.money) + ' 两');
    if (typeof gk.grain === 'number')  finParts.push('粮 ' + Math.round(gk.grain) + ' 石');
    if (typeof gk.cloth === 'number')  finParts.push('布 ' + Math.round(gk.cloth) + ' 匹');
    if (typeof nc.money === 'number')  finParts.push('内帑 ' + Math.round(nc.money) + ' 两');
    if (finParts.length) s += '【国帑】' + finParts.join('·') + '\n';
  }
  // 军事·活跃战争
  if (typeof GM !== 'undefined' && Array.isArray(GM.activeWars) && GM.activeWars.length) {
    const wars = GM.activeWars.slice(0, 4).map(w => {
      const fr = w.frontline || w.location || '';
      const en = w.enemy || w.opponent || '?';
      return en + (fr ? '@' + fr : '') + (w.status ? '(' + w.status + ')' : '');
    });
    s += '【征伐】活跃战事 ' + GM.activeWars.length + ' 处：' + wars.join('·') + '\n';
  }
  // 党争 / 民变 / 腐败（如有）
  const meterParts = [];
  if (typeof GM !== 'undefined') {
    if (typeof GM.partyStrife === 'number') meterParts.push('党争 ' + Math.round(GM.partyStrife));
    if (typeof GM.unrest === 'number')      meterParts.push('民变指数 ' + Math.round(GM.unrest));
    if (typeof GM.corruption === 'number')  meterParts.push('腐败 ' + Math.round(GM.corruption));
    else if (GM.corruption && typeof GM.corruption.index === 'number') meterParts.push('腐败 ' + Math.round(GM.corruption.index));
  }
  if (meterParts.length) s += '【乱政】' + meterParts.join('·') + '\n';
  // 近 3 回合推演摘要（若有 GM._turnReports 数组·取最近 3 个）
  if (typeof GM !== 'undefined') {
    const reports = [];
    if (Array.isArray(GM._turnReports) && GM._turnReports.length) {
      GM._turnReports.slice(-3).forEach(r => {
        if (r && (r.summary || r.text)) reports.push((r.turn ? 'T' + r.turn + '·' : '') + String(r.summary || r.text).slice(0, 200));
      });
    }
    if (reports.length === 0 && (GM._lastTurnSummary || GM._lastTurnReport)) {
      reports.push(String(GM._lastTurnSummary || GM._lastTurnReport || '').slice(0, 240));
    }
    if (reports.length) s += '【近回合推演摘要】\n  ' + reports.join('\n  ') + '\n';
  }
  // 近 5 条诏令（GM._edictTracker·让 NPC 知道陛下最近发了什么旨）
  if (typeof GM !== 'undefined' && Array.isArray(GM._edictTracker) && GM._edictTracker.length) {
    const recentEdicts = GM._edictTracker.slice(-5).map(e => {
      const t = e.turn != null ? 'T' + e.turn + '·' : '';
      const cat = e.category ? '【' + e.category + '】' : '';
      const stat = e.status && e.status !== 'pending' ? '(' + e.status + ')' : '';
      return t + cat + String(e.content || e.title || '').slice(0, 80) + stat;
    });
    s += '【近期诏令】（陛下颁过的旨意·NPC 行动须考虑这些已下之令）\n  · ' + recentEdicts.join('\n  · ') + '\n';
  }
  // 长期诏书 / 进行中编年项 / 旅程在途（走 ai-infra 已有 builder）
  if (typeof _buildLongTermActionsDigest === 'function') {
    try {
      const digest = _buildLongTermActionsDigest();
      if (digest) s += digest + '\n';
    } catch (_) {}
  }
  // 起居注最近 4 条（百官昨日动向）
  if (typeof GM !== 'undefined' && Array.isArray(GM.qijuHistory) && GM.qijuHistory.length) {
    const recent = GM.qijuHistory.slice(0, 4).map(q => {
      const d = q.date || (q.turn != null ? 'T' + q.turn : '');
      const c = String(q.content || '').slice(0, 70);
      return (d ? d + '·' : '') + c;
    });
    s += '【近事·起居注】\n  ' + recent.join('\n  ') + '\n';
  }
  // 待审奏疏数（不展开内容·只总数）
  if (typeof GM !== 'undefined' && Array.isArray(GM.zoushuPool)) {
    const pendingZS = GM.zoushuPool.filter(z => z && (z.status === 'pending' || !z.status));
    if (pendingZS.length) s += '【奏疏池】' + pendingZS.length + ' 件待批\n';
  }
  return s;
}

/** 同回合 sysStable 缓存包装（走 ai-infra 的 getCachedSysStable·命中节省 token） */
function _cc3_getCachedSysStable() {
  if (typeof getCachedSysStable === 'function') {
    return getCachedSysStable(_cc3_buildSystemPromptStable);
  }
  return _cc3_buildSystemPromptStable();
}

/** 把 prompt(string) 拼成带 system 的 messages 数组·提供给所有 v3 AI 调用复用 */
function _cc3_makeMessagesWithSystem(userPrompt) {
  const sysStable = _cc3_getCachedSysStable();
  const sysVariable = _cc3_buildSystemPromptVariable();
  if (typeof buildCachedMessages === 'function') {
    return buildCachedMessages(sysStable, sysVariable, userPrompt);
  }
  return [
    { role: 'system', content: sysStable + (sysVariable ? '\n\n' + sysVariable : '') },
    { role: 'user', content: userPrompt }
  ];
}

/** AI 生成 NPC 即时立场+台词（基于完整角色档案+议题语境+他臣表态）
 *  role: 'self' | 'debate' | 'debate2' | 'dissent'
 *  onChunk: 流式回调·只回传 line 部分（剥 JSON 包装）
 *  返回 {stance, line} 或 null（AI 失败）
 */
async function _cc3_aiGenReact(name, item, role, onChunk) {
  if (typeof callAI !== 'function') return null;
  if (!(P && P.ai && P.ai.key && P.ai.url)) return null;

  const ch = CHARS[name] || {};
  let gmCh = null;
  try { if (typeof findCharByName === 'function') gmCh = findCharByName(name); } catch (_) {}
  const personality = (gmCh && gmCh.personality) || '';
  const loyalty     = (gmCh && typeof gmCh.loyalty   === 'number') ? gmCh.loyalty   : null;
  const integrity   = (gmCh && typeof gmCh.integrity === 'number') ? gmCh.integrity : null;
  const ambition    = (gmCh && typeof gmCh.ambition  === 'number') ? gmCh.ambition  : null;
  const officialTitle = (gmCh && (gmCh.officialTitle || gmCh.title)) || ch.title || '';
  const stance2Player = (gmCh && gmCh.stanceToPlayer) || '';
  const family       = (gmCh && gmCh.family) || '';
  const traits       = (gmCh && Array.isArray(gmCh.traits)) ? gmCh.traits.join('·') : '';

  // 长期记忆（最近 5 条）
  let memorySnippet = '';
  try {
    if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.recall) {
      const memList = NpcMemorySystem.recall(name, 5);
      if (Array.isArray(memList) && memList.length) {
        memorySnippet = memList.map(m => '  - ' + (m.text || m.event || JSON.stringify(m).slice(0, 80))).join('\n');
      }
    }
  } catch (_) {}
  // 与陛下关系
  let relationLine = '';
  try {
    if (typeof OpinionSystem !== 'undefined' && OpinionSystem.getEventOpinion) {
      const op = OpinionSystem.getEventOpinion(name, '玩家');
      if (op != null) relationLine = '与陛下关系值: ' + Math.round(op);
    }
  } catch (_) {}

  const stanceLabels = { support:'支持', oppose:'反对', mediate:'折中', neutral:'中立' };

  let p = '你扮演 ' + name + '。\n';
  p += '── 你的档案 ──\n';
  p += '官职：' + officialTitle + '\n';
  p += '势力：' + (gmCh && gmCh.faction || ch.faction || '中立') + '·党派：' + (gmCh && gmCh.party || ch.party || '中立') + '\n';
  if (personality) p += '性格：' + personality + '\n';
  if (traits)      p += '特质：' + traits + '\n';
  const stats = [];
  if (loyalty   != null) stats.push('忠诚 ' + loyalty);
  if (integrity != null) stats.push('清廉 ' + integrity);
  if (ambition  != null) stats.push('野心 ' + ambition);
  if (stats.length) p += '能力：' + stats.join(' · ') + '\n';
  if (family)        p += '家世：' + (typeof family === 'string' ? family : '世家') + '\n';
  if (stance2Player) p += '对陛下：' + stance2Player + '\n';
  if (relationLine)  p += relationLine + '\n';
  if (memorySnippet) p += '── 你的记忆（影响判断）──\n' + memorySnippet + '\n';

  // 该 NPC 的最近行为（起居注+NPC 行动日志中相关条目）·让 AI 知道"前几日 X 干了什么"以保持连贯
  let actLines = [];
  try {
    if (typeof GM !== 'undefined' && Array.isArray(GM.qijuHistory)) {
      GM.qijuHistory.slice(0, 12).forEach(function(q) {
        if (!q) return;
        const c = String(q.content || '');
        if (c.indexOf(name) >= 0) actLines.push((q.date || ('T' + (q.turn||0))) + '·' + c.slice(0, 80));
      });
    }
    if (typeof GM !== 'undefined' && Array.isArray(GM._npcActionsLog)) {
      GM._npcActionsLog.slice(-8).forEach(function(a) {
        if (a && a.actor === name) {
          actLines.push('T' + (a.turn || '?') + '·' + (a.action || '') + ('· '+ (a.detail || '')).slice(0, 80));
        }
      });
    }
  } catch (_) {}
  if (actLines.length) {
    p += '── 你近日所为（起居注 / NPC 行动）──\n  ' + actLines.slice(0, 5).join('\n  ') + '\n';
  }
  // 该 NPC 近期未批奏疏（如有）
  try {
    if (typeof GM !== 'undefined' && Array.isArray(GM.zoushuPool)) {
      const myZS = GM.zoushuPool.filter(function(z) {
        return z && (z.author === name || z.from === name) && (z.status === 'pending' || !z.status);
      }).slice(0, 3);
      if (myZS.length) {
        p += '── 你已上之奏（待陛下批·此朝不可重复同奏）──\n';
        myZS.forEach(function(z) { p += '  · ' + (z.title || '') + '：' + String(z.summary || z.content || '').slice(0, 60) + '\n'; });
      }
    }
  } catch (_) {}

  p += '\n── 今日早朝议题 ──\n';
  p += '主奏：' + (item.presenter || '某员') + '（' + (item.dept || '') + '）\n';
  p += '议题：「' + (item.title || '') + '」\n';
  p += '内容：' + (item.detail || item.content || item.title || '') + '\n';
  if (item.target) p += '所涉之人：' + item.target + '\n';
  if (item.target === name) p += '【！】此议直接针对你·须自辩·语气惶恐而坚定\n';
  if (item.urgency === 'urgent') p += '【急】此为紧急奏报\n';

  // 殿中已有立场（避免重复）
  const peerLines = [];
  if (Array.isArray(item.selfReact)) {
    item.selfReact.filter(r => r.name !== name && r.line && r._aiGen).forEach(r => {
      peerLines.push('  ' + r.name + '（' + (stanceLabels[r.stance] || '') + '）：' + r.line);
    });
  }
  if (role === 'debate' && Array.isArray(item.debate)) {
    item.debate.filter(d => d.name !== name && d.line && d._aiGen).forEach(d => {
      peerLines.push('  ' + d.name + '（' + (stanceLabels[d.stance] || '') + '）：' + d.line);
    });
  }
  if (role === 'debate2' && Array.isArray(item.debate)) {
    item.debate.filter(d => d.line && d._aiGen).forEach(d => {
      peerLines.push('  ' + d.name + '（' + (stanceLabels[d.stance] || '') + '）：' + d.line);
    });
  }
  if (peerLines.length) p += '\n── 殿中诸臣已表态（你须有差异）──\n' + peerLines.join('\n') + '\n';

  // 时令（影响措辞）
  if (typeof state !== 'undefined' && state._currentSeason) {
    p += '\n时令：' + state._currentSeason + '·' + (state._currentWeather || '晴') + '\n';
  }
  // 朝威
  const strict = (typeof isStrictCourt === 'function') ? isStrictCourt() : false;
  p += '朝威：' + (strict ? '肃朝（百官谨慎·言辞克制）' : '众言（百官较活跃）') + '\n';

  p += '\n── 任务 ──\n';
  if (role === 'self') {
    p += '陛下尚未发话·你较有想法·先行自发表态。\n';
  } else if (role === 'debate') {
    p += '殿中议论·你须就议题表立场和理由（与他臣有别）。\n';
  } else if (role === 'debate2') {
    p += '殿中议论第二轮·或承上、或折中、或更鲜明、要有进展·不可重复一轮。\n';
  } else {
    p += '你出列严辞抗辩。\n';
  }
  const wordHint = (typeof _aiDialogueWordHint === 'function') ? _aiDialogueWordHint('cy') : '约 50-120 字';
  p += '\n严格按 JSON 输出（不带其他文字、不带代码块标记）：\n';
  p += '{"stance":"support|oppose|mediate|neutral","line":"..."}\n\n';
  p += '要求：\n';
  p += '· stance 必须基于你档案中的派系/性格/忠诚/与陛下关系/此议之利害·不可机械随机·不可空泛中立\n';
  p += '· 若议题涉及你或你的派系利益·立场须强烈\n';
  p += '· 若议题与你的记忆相关·态度应有连贯性\n';
  p += '· line 字数' + wordHint + '·半文言·朝堂奏对体·"臣……"开头·体现你的性格与身份\n';
  p += '· 紧扣议题具体内容·有具体观点·不可空泛附和\n';
  p += '· 与已表态他臣有所区别·不重复其话\n';
  p += '· 直接 JSON·不要解释·不要 ```json 包裹';

  // 时空约束·防 AI 引用未来史实（"崇祯朝某事"等）
  if (typeof _buildTemporalConstraint === 'function') {
    try { p += _buildTemporalConstraint(gmCh); } catch (_) {}
  }

  // 调用 AI（流式·拆 JSON 中的 line 实时回调）
  let raw = '';
  const tok = Math.max(600, (typeof _aiDialogueTok === 'function') ? _aiDialogueTok('cy', 1) : 600);
  const signal = (typeof CY !== 'undefined' && CY.abortCtrl) ? CY.abortCtrl.signal : null;

  // 提取 JSON 字符串里的 line 字段值（处理转义）
  function extractLineFromPartial(s) {
    if (!s) return '';
    const m = s.match(/"line"\s*:\s*"((?:[^"\\]|\\.)*)/);
    if (!m) return '';
    let v = m[1];
    try { v = v.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\'); } catch (_) {}
    return v;
  }

  // 带 system prompt（朝代/规制/风格/时令/朝威/国势）·走 prompt cache
  const messages = _cc3_makeMessagesWithSystem(p);
  if (typeof callAIMessagesStream === 'function') {
    try {
      raw = await callAIMessagesStream(
        messages,
        tok,
        {
          signal: signal,
          tier: 'secondary',
          onChunk: (partial) => {
            if (typeof onChunk === 'function') {
              const lineSoFar = extractLineFromPartial(partial);
              if (lineSoFar) onChunk(lineSoFar);
            }
          }
        }
      );
    } catch (e) {
      console.warn('[cc3·react] 流式失败·退非流式·', e && e.message);
      try {
        raw = (typeof callAIMessages === 'function')
          ? await callAIMessages(messages, tok, signal, 'secondary')
          : await callAI(p, tok, signal, 'secondary');
      } catch (e2) { return null; }
    }
  } else if (typeof callAIMessages === 'function') {
    try { raw = await callAIMessages(messages, tok, signal, 'secondary'); } catch (e) { return null; }
  } else {
    try { raw = await callAI(p, tok, signal, 'secondary'); } catch (e) { return null; }
  }

  // 解析 JSON
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const obj = JSON.parse(m[0]);
    if (!obj || typeof obj.line !== 'string' || obj.line.length < 6) return null;
    const validStances = ['support', 'oppose', 'mediate', 'neutral'];
    const stance = validStances.indexOf(obj.stance) >= 0 ? obj.stance : 'neutral';
    return { stance: stance, line: obj.line.trim() };
  } catch (e) {
    console.warn('[cc3·react] JSON 解析失败·原文:', raw && raw.slice(0, 200));
    return null;
  }
}

/** 流式渲染 NPC 表态气泡（先空泡·按 chunk 实时吐字·完成后修正立场徽章） */
async function _cc3_streamReactBubble(npc, item, role) {
  const main = $('cy-stage-main');
  // 空泡先入·初始 stance 用 mock 立场（后续 AI 返回时校正）
  const row = addBubble({ name: npc.name, stance: npc.stance || 'neutral', text: '…' });
  const textEl = row && row.querySelector('.cy-bubble-text');
  const stanceEl = row && row.querySelector('.stance');
  const onChunk = (partial) => {
    if (textEl && partial) {
      textEl.textContent = partial;
      if (main) main.scrollTop = main.scrollHeight;
    }
  };
  // 走 AI；失败回退原 mock line
  let aiResult = null;
  if (aiEnabled()) {
    try { aiResult = await _cc3_aiGenReact(npc.name, item, role, onChunk); } catch (e) {}
  }
  if (aiResult && aiResult.line) {
    if (textEl) textEl.textContent = aiResult.line;
    if (stanceEl && aiResult.stance) {
      stanceEl.className = 'stance stance-' + aiResult.stance;
      stanceEl.textContent = stanceLbl(aiResult.stance);
    }
    // 写回 npc·下游引用一致 + 标记 AI 生成
    npc.stance = aiResult.stance;
    npc.line = aiResult.line;
    npc._aiGen = true;
  } else {
    // mock 回退
    if (textEl) textEl.textContent = npc.line || '臣随议·伏听圣裁。';
  }
  if (main) main.scrollTop = main.scrollHeight;
}

/** preview callAIPreview 替代·走 v2 callAI tier 系统·有 onChunk 时优先流式
 *  所有调用都带 system prompt（朝代/玩家/规制/风格 + 时令/朝威/国势）·走 prompt cache
 */
async function _cc3_callAI(prompt, onChunk) {
  if (typeof callAI !== "function") throw new Error("callAI 未加载");
  const tok = (typeof _aiDialogueTok === "function") ? _aiDialogueTok("cy", 1) : 500;
  const signal = (typeof CY !== "undefined" && CY.abortCtrl) ? CY.abortCtrl.signal : null;
  const messages = _cc3_makeMessagesWithSystem(prompt);
  // 流式优先（有 onChunk 且 callAIMessagesStream 可用）
  if (typeof onChunk === 'function' && typeof callAIMessagesStream === 'function') {
    try {
      return await callAIMessagesStream(messages, tok, { signal: signal, onChunk: onChunk, tier: 'secondary' });
    } catch (e) {
      console.warn('[cc3·stream] 流式失败·退非流式·', e && e.message);
    }
  }
  // 非流式·callAIMessages 优先（保持 system prompt）
  if (typeof callAIMessages === 'function') {
    return await callAIMessages(messages, tok, signal, 'secondary');
  }
  // 兜底：拼成单 prompt 走老 callAI
  const flat = messages.map(m => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('\n\n');
  return await callAI(flat, tok, signal, 'secondary');
}

// 兼容 preview 的全局名（preview JS 仍引用 callAIPreview / aiEnabled）
function _cc3_aiEnabled() {
  // v3 总是启用 AI（v2 主项目本来就要求 AI 配置）
  return (typeof P !== "undefined") && P.ai && P.ai.key && P.ai.url;
}

// ─── 朝代配置·scenario.chaoyi schema·全朝代适应 ───
function _cc3_getScenarioConfig() {
  const sc = (typeof P !== "undefined" && P.scenario) || {};
  const cfg = (sc && sc.chaoyi) || {};
  // 兜底默认值（明制·preview 默认值）
  return {
    enabled: cfg.enabled !== false,
    audienceHall: cfg.audienceHall || "正殿",
    chaoName: cfg.chaoName || "早朝",
    shuoChaoName: cfg.shuoChaoName || "朔朝",
    openingRites: cfg.openingRites || ["mingbian", "shanhu", "imperialEnter"],
    strictThreshold: cfg.strictThreshold || { prestige: 75, power: 75 },
    directSpeakRank: cfg.directSpeakRank != null ? cfg.directSpeakRank : 2,
    deptOptions: cfg.deptOptions || ["户部", "吏部", "礼部", "兵部", "刑部", "工部", "都察院"],
    factionMap: cfg.factionMap || {},
    enabledTypes: cfg.enabledTypes || ["routine", "request", "warning", "emergency", "personnel", "confrontation", "joint_petition", "personal_plea"],
    fixedAgenda: cfg.fixedAgenda || [],
    // 当前游戏年/月/日（用于标题）
    dateLabel: _cc3_buildDateLabel(sc)
  };
}

/** P4 真实性·季节 + 天气推算（从 scenario.startYear + GM.turn 推月份） */
function _cc3_getSeasonAndWeather() {
  const sc = (typeof P !== 'undefined' && P.scenario) || {};
  const startY = sc.startYear || 1628;
  const turn = (typeof GM !== 'undefined') ? (GM.turn || 0) : 0;
  const month = (turn % 12) + 1;  // 1-12
  // 季节
  let season = '春';
  if (month >= 3 && month <= 5) season = '春';
  else if (month >= 6 && month <= 8) season = '夏';
  else if (month >= 9 && month <= 11) season = '秋';
  else season = '冬';
  // 天气（按季节随机·45% 晴 / 25% 阴 / 季节性 30%）
  const r = Math.random();
  let weather = '晴';
  if (r < 0.45) weather = '晴';
  else if (r < 0.70) weather = '阴';
  else {
    if (season === '春') weather = ['细雨', '微雨', '春雷'][Math.floor(Math.random()*3)];
    else if (season === '夏') weather = ['骤雨', '酷热', '雷暴'][Math.floor(Math.random()*3)];
    else if (season === '秋') weather = ['秋雨', '微寒', '霜露'][Math.floor(Math.random()*3)];
    else weather = ['雪', '寒风', '冰封'][Math.floor(Math.random()*3)];
  }
  return { season, month, weather };
}

/** P4·开场气泡的季节天气描述 */
function _cc3_getSeasonalAmbientLine(season, weather) {
  const map = {
    春: {
      晴:   '（春日和煦·宫墙下海棠初绽。）',
      阴:   '（春阴漠漠·廊下偶有燕子轻啼。）',
      细雨: '（春雨潇潇·百官冒雨候于丹墀。）',
      微雨: '（檐前微雨·阶下青苔渐生。）',
      春雷: '（春雷初动·殿宇为之微震。）'
    },
    夏: {
      晴:   '（夏日炎炎·百官冠服已透汗。）',
      阴:   '（夏阴沉沉·暑气未消·众官面带倦色。）',
      骤雨: '（骤雨倾盆·御道为之泥泞。）',
      酷热: '（炎暑难当·内侍频送冰盏。）',
      雷暴: '（殿外雷电交作·百官色变。）'
    },
    秋: {
      晴:   '（秋空澄朗·桂香远来。）',
      阴:   '（秋云低垂·廊下偶有落叶。）',
      秋雨: '（秋雨连绵·宫漏滴答更显寂寥。）',
      微寒: '（秋意已深·百官加冬服一重。）',
      霜露: '（晨霜满阶·呵气成雾。）'
    },
    冬: {
      晴:   '（冬日初升·朱墙映雪愈显皇威。）',
      阴:   '（朔风凛冽·百官紧抱朝笏。）',
      雪:   '（瑞雪纷飞·御道一片皑然。）',
      寒风: '（寒风刺骨·百官冒凛而立。）',
      冰封: '（殿前冰封·阶上一步一滑。）'
    }
  };
  const seasonMap = map[season] || map.春;
  return seasonMap[weather] || seasonMap['晴'];
}

/** 标题日期·优先用游戏官方 getTSText（含年号/季节/干支日·与游戏其他界面一致）
 *  朔朝（post-turn）目标月 = 当前 turn + 1（朔朝代表下月初一·决议施于次月）
 *  老路径作为兜底·防 P.time 缺失时崩 */
function _cc3_buildDateLabel(scenario) {
  const baseTurn = (typeof GM !== "undefined") ? (GM.turn || 0) : 0;
  // 优先 state._isPostTurn（_cc3_open 入口已锁定）·防 await 期间 GM 标志被外部 reset
  const isPostTurn = (typeof state !== 'undefined' && state._isPostTurn != null)
                     ? !!state._isPostTurn
                     : ((typeof GM !== "undefined") && !!GM._isPostTurnCourt);
  const turn = isPostTurn ? (baseTurn + 1) : baseTurn;
  // 主路径：官方 getTSText
  if (typeof getTSText === 'function' && typeof P !== 'undefined' && P.time) {
    try {
      const s = getTSText(turn);
      if (s && typeof s === 'string') return s;
    } catch (_) {}
  }
  // 兜底：按 P.time.perTurn 推算（'1d'/'3d'/'1m'/'1s'/'1y'·剧本可调）
  const startY = (scenario && scenario.startYear) || (typeof P !== 'undefined' && P.time && P.time.year) || 1628;
  const perTurn = (typeof P !== 'undefined' && P.time && P.time.perTurn) || '1s';
  let yearOff = 0, month = (typeof P !== 'undefined' && P.time && P.time.startMonth) || 1;
  // 估算每回合月份偏移（仅作显示兜底·不影响核心 turn 推进）
  const monthsPerTurn = (perTurn === '1y') ? 12 : (perTurn === '1m') ? 1 : (perTurn === '1s') ? 3 : (/^\d+d$/.test(perTurn)) ? (parseInt(perTurn) / 30) : 3;
  const totalMonths = (month - 1) + Math.round(turn * monthsPerTurn);
  yearOff = Math.floor(totalMonths / 12);
  month = (totalMonths % 12) + 1;
  const yr = startY + yearOff;
  // 干支
  const gan = "甲乙丙丁戊己庚辛壬癸";
  const zhi = "子丑寅卯辰巳午未申酉戌亥";
  const ganIdx = (yr - 4) % 10;
  const zhiIdx = (yr - 4) % 12;
  const ganzhi = gan.charAt(ganIdx >= 0 ? ganIdx : ganIdx + 10) + zhi.charAt(zhiIdx >= 0 ? zhiIdx : zhiIdx + 12);
  const monthStr = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "腊"][month - 1];
  return ganzhi + "年" + monthStr + "月";
}

// ───────────────────────────────────────────
// §B · preview 移植 JS（轻改·后续 Edit 适配）
// ───────────────────────────────────────────


// ═══════════════════════════════════════════════
// 数据·朝堂角色（mock·明末崇祯朝实在臣）
// ═══════════════════════════════════════════════
const CHARS = {}; // mock 数据·_cc3_open 时由 _cc3_overrideMockWithGM 从 GM.chars 填充

// ═══════════════════════════════════════════════
// 数据·议程（mock·7 条·涵盖各类型）
// ═══════════════════════════════════════════════
const AGENDA = []; // mock 数据·_cc3_open 时由 _cc3_buildAgendaFromGM (走 v2 _cc2_buildAgendaPrompt) 填充

// ═══════════════════════════════════════════════
// 状态机
// ═══════════════════════════════════════════════
const state = {
  mode: 'changchao',           // 'changchao' | 'shuochao'
  phase: 'opening',
  currentIdx: 0,
  decisions: [],               // {idx, action, item, label, extra?}
  pendingPlayerInput: null,
  benchExpanded: false,
  debateRound: 0,
  prestige: 55,                // 皇威
  power: 60,                   // 皇权
  attendees: [],               // present chars
  absents: [],                 // absent chars
  done: false
};

// ═══════════════════════════════════════════════
// 工具
// ═══════════════════════════════════════════════
function $(id) { return document.getElementById(id); }
function escHtml(s) { return String(s||'').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":"&#39;"}[c])); }
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function avatarHtml(name, opts = {}) {
  const ch = CHARS[name] || { initial: name.slice(0, 1), class: 'east' };
  const cls = ch.class === 'wu' ? 'wu' : ch.class === 'kdao' ? 'koudao' : '';
  return `<div class="cy-bubble-avatar ${cls}">${escHtml(ch.initial || name.slice(0, 1))}</div>`;
}

function addBubble(opts) {
  const main = $('cy-stage-main');
  const row = document.createElement('div');
  row.className = 'cy-bubble-row ' + (opts.kind || 'npc');
  let inner = '';
  if (opts.kind === 'system') {
    const sysCls = opts.sysKind ? (' ' + opts.sysKind) : '';
    inner = `<div class="cy-bubble-content"><div class="cy-bubble-text${sysCls}">${opts.text}</div></div>`;
  } else if (opts.kind === 'player') {
    inner = `<div class="cy-bubble-content"><div class="cy-bubble-meta">陛下</div><div class="cy-bubble-text">${escHtml(opts.text)}</div></div>`;
  } else {
    const ch = CHARS[opts.name] || {};
    const stance = opts.stance ? `<span class="stance stance-${opts.stance}">${stanceLbl(opts.stance)}</span>` : '';
    const itemType = opts.itemType ? `<span class="type-badge t-${opts.itemType}">${typeLbl(opts.itemType)}</span>` : '';
    const meta = `${escHtml(opts.name)} · ${escHtml(ch.title || '')}${itemType}${stance}`;
    const urgTag = opts.urgent ? '<span class="urg-tag">⚡ 急</span>' : '';
    const detailCls = opts.detail ? (' detail' + (opts.itemType ? ' type-' + opts.itemType : '')) : '';
    const urgCls = opts.urgent ? ' urgent' : '';
    inner = `${avatarHtml(opts.name)}<div class="cy-bubble-content"><div class="cy-bubble-meta">${meta}</div><div class="cy-bubble-text${detailCls}${urgCls}">${urgTag}${escHtml(opts.text)}</div></div>`;
  }
  row.innerHTML = inner;
  main.appendChild(row);
  main.scrollTop = main.scrollHeight;
  // 记录最后说话者·"你说/其他人" 代词识别用
  if (!opts.kind && opts.name) {
    state._lastNpcSpeaker = opts.name;
  }
  // ─── 收集对话到 transcript·朝议结束写入 _courtRecords·供 AI 推演读取 ───
  try {
    if (!state._transcript) state._transcript = [];
    let role, speaker, text;
    if (opts.kind === 'player') { role = 'player'; speaker = '陛下'; text = opts.text; }
    else if (opts.kind === 'system') { role = 'system'; speaker = '内侍'; text = opts.text; }
    else if (opts.name) { role = 'npc'; speaker = opts.name; text = opts.text; }
    if (text && (role === 'player' || role === 'npc')) {
      // 对系统旁白做较弱过滤·只保留有意义的（如召见/抗辩等结构化标记）
      // 玩家+NPC 全保留
      state._transcript.push({
        role: role,
        speaker: speaker,
        text: String(text).replace(/<[^>]+>/g, '').slice(0, 400),
        stance: opts.stance || '',
        agendaIdx: typeof state.currentIdx === 'number' ? state.currentIdx : -1,
        phase: state.phase || ''
      });
      // 上限 200 条·防爆
      if (state._transcript.length > 200) state._transcript.shift();
    }
  } catch (_) {}
  return row;
}

function typeLbl(t) {
  return { routine: '日常', request: '请旨', warning: '预警', emergency: '紧急', personnel: '人事', confrontation: '弹劾', joint_petition: '联名', personal_plea: '请旨' }[t] || t;
}

function stanceLbl(s) {
  return { support: '支持', oppose: '反对', neutral: '中立', mediate: '折中' }[s] || s;
}

// ═══════════════════════════════════════════════
// 玩家说话主入口·按阶段分发 + 关键词解析 + NPC 回应
// ═══════════════════════════════════════════════
async function onPlayerSpeak(text) {
  if (!text) return;
  // 弹层关闭
  document.querySelectorAll('.cy-popover.show').forEach(p => p.classList.remove('show'));
  const jp = document.querySelector('.cy-popover.jinkou'); if (jp) jp.remove();

  if (state.done) {
    addBubble({ kind: 'player', text });
    addBubble({ kind: 'system', text: '（朝会已散 · 陛下回乾清宫。）' });
    return;
  }
  if (state.phase === 'opening' || state.phase === 'closing') {
    addBubble({ kind: 'player', text });
    addBubble({ kind: 'system', text: '（朝礼未及奏对 · 百官无应。）' });
    return;
  }
  if (state.phase === 'announce') return onSpeakAnnounce(text);
  if (state.phase === 'detail') return onSpeakDetail(text);
  if (state.phase === 'debate') return onSpeakDebateLive(text);
}

async function onSpeakAnnounce(text) {
  const t = text.replace(/[。·，。，！？\s]/g, '');
  if (/^奏来$|奏闻|讲|说|何事|讲来|奏明/.test(t)) {
    addBubble({ kind: 'player', text });
    await delay(280);
    return onAnnounceChoice('proceed');
  }
  if (/免议|不议|不必|算了|不必再奏|此事不议/.test(t)) {
    addBubble({ kind: 'player', text });
    await delay(280);
    return onAnnounceChoice('skip');
  }
  if (/再奏|改日|稍后|留中/.test(t)) {
    addBubble({ kind: 'player', text });
    await delay(280);
    return onAnnounceChoice('hold');
  }
  // 自由话语·让奏报者重新启奏
  addBubble({ kind: 'player', text });
  await delay(320);
  const item = AGENDA[state.currentIdx];
  addBubble({ name: item.presenter, text: '陛下圣意未明 · 容臣再启：' + item.announceLine });
}

async function onSpeakDetail(text) {
  addBubble({ kind: 'player', text });
  await delay(320);
  const action = parseDetailKeyword(text);
  if (action) return doAction(action);
  // 自由话语 → 主奏者回应 + 一名 NPC 跟话
  await npcRespondToPlayer(text, 2);
}

async function onSpeakDebateLive(text) {
  // 议论中玩家直接说·插入到队列·主流程（runDebate 循环里）会下一拍消费
  // 但若玩家在按钮已显示后说的话·直接走 npcRespondToPlayer
  if (document.querySelector('.cy-action-bar .cy-btn')) {
    addBubble({ kind: 'player', text });
    await delay(320);
    const action = parseDetailKeyword(text);
    if (action) return doAction(action);
    await npcRespondToPlayer(text, 2);
    return;
  }
  // 否则·入队列·让 runDebate 循环消化
  state.pendingPlayerInput = text;
  addBubble({ kind: 'system', text: '（陛下举笏 · 待此官言毕即接陛下之意。）' });
}

function parseDetailKeyword(text) {
  const t = text.replace(/[。·，。，！？\s]/g, '');
  if (/^准奏$|^准$|^可$|准了|可办|从之|奏可/.test(t)) return 'approve';
  if (/^驳$|^驳奏$|不准|不可|否|不行|不允/.test(t)) return 'reject';
  if (/留中|从长计议|容朕|缓议|且听/.test(t)) return 'hold';
  if (/下廷议|集议|付廷议/.test(t)) return 'escalate';
  if (/部议|发部|交部/.test(t)) {
    // 简化：默认转户部·真实场景应弹下拉
    return null; // 仍走自由话语·以免失误
  }
  return null;
}

async function npcRespondToPlayer(playerText, count) {
  const item = AGENDA[state.currentIdx];
  const intent = inferPlayerIntent(playerText);
  const mentioned = findMentionedChars(playerText);

  // 代词识别：你说/请说/讲来 → 指上一个发言者；其他人/诸卿/众卿 → 排除上一个发言者
  const t = (playerText || '').trim();
  // 单字/极短指令也算·常朝里"说"/"讲"/"继续"/"续言"等是对刚才发言者的省略主语指令
  const shortCmd = /^(说|讲|继续|续言|续奏|再言|再奏|续之|进之|具陈|具言|且|然|然后|往下|接着|更陈|续陈|展开|细之|精之|准之|何也|何如)[。！？.\s!?·]*$/;
  const refsLastSpeaker = /^(你说|请说|尔言|尔说|且言|且说|讲来|细言|说来|你来说|你具陈|你陈之|尔陈|尔续|尔再言|尔以为|你怎么看|你看)/.test(t)
                         || /\b你说\b|\b你讲\b/.test(t)
                         || shortCmd.test(t);
  const askOthers = /其他人|余者|余下|其余|诸卿|众卿|他人|别人|余等|余卿/.test(t);
  const lastSpeaker = state._lastNpcSpeaker || '';

  const seen = new Set();
  const candidates = [];

  // 0) "你说/请说" 类·定向给上一个发言者
  if (refsLastSpeaker && lastSpeaker && CHARS[lastSpeaker] && !CHARS[lastSpeaker].absent) {
    candidates.push(lastSpeaker); seen.add(lastSpeaker);
  }

  // 1) 被玩家点名的人优先（任何在场 NPC 都识别·不止 item.target）
  mentioned.forEach(n => {
    if (CHARS[n] && !CHARS[n].absent && !seen.has(n)) {
      candidates.push(n); seen.add(n);
    }
  });

  // "其他人" 时·上一个发言者排除·标记 seen 不再选
  if (askOthers && lastSpeaker) seen.add(lastSpeaker);

  // 2) intent 触发的特殊抢答（被针对者/言官/折中派）
  if (intent === 'punish') {
    if (item.target && CHARS[item.target] && !CHARS[item.target].absent && !seen.has(item.target)) {
      // 被批者抢辩
      candidates.unshift(item.target); seen.add(item.target);
    }
    // 言官响应
    ['黄宗周', '黄景昉', '倪元璐'].forEach(n => {
      if (CHARS[n] && !CHARS[n].absent && !seen.has(n) && candidates.length < count + 1) {
        candidates.push(n); seen.add(n);
      }
    });
  }
  if ((intent === 'mediate' || intent === 'doubt') && CHARS['韩爌'] && !seen.has('韩爌')) {
    // 折中疑虑·首辅出来调和
    candidates.unshift('韩爌'); seen.add('韩爌');
  }

  // 3) 主奏者
  if (!seen.has(item.presenter)) {
    candidates.push(item.presenter); seen.add(item.presenter);
  }

  // 4) debate / selfReact 中已有立场者
  (item.debate || []).forEach(d => {
    if (!seen.has(d.name) && CHARS[d.name] && !CHARS[d.name].absent) {
      candidates.push(d.name); seen.add(d.name);
    }
  });
  (item.selfReact || []).forEach(d => {
    if (!seen.has(d.name) && CHARS[d.name] && !CHARS[d.name].absent) {
      candidates.push(d.name); seen.add(d.name);
    }
  });

  // 5) 闲人兜底
  ['韩爌', '王永光', '黄宗周', '倪元璐'].forEach(n => {
    if (CHARS[n] && !CHARS[n].absent && !seen.has(n)) {
      candidates.push(n); seen.add(n);
    }
  });

  // 点名时·让回应数 +1（点名的不挤主奏者位）
  const explicitTarget = (refsLastSpeaker && lastSpeaker) || mentioned.length > 0;
  const respondN = explicitTarget ? Math.min(count + 1, candidates.length) : Math.min(count, candidates.length);
  const picked = candidates.slice(0, respondN);

  for (let i = 0; i < picked.length; i++) {
    const name = picked[i];
    const isMentionedNow = mentioned.indexOf(name) >= 0 || (refsLastSpeaker && name === lastSpeaker);
    const stance = inferStanceForResponder(name, item, playerText, intent, isMentionedNow);
    // 流式：先放空气泡·再随 chunk 增量更新
    const row = addBubble({ name, stance, text: '…' });
    const textEl = row && row.querySelector('.cy-bubble-text');
    const main = $('cy-stage-main');
    const onChunk = (partial) => {
      if (textEl) {
        textEl.textContent = (partial || '').trim() || '…';
        if (main) main.scrollTop = main.scrollHeight;
      }
    };
    const line = await generateNpcReply(name, item, playerText, stance, intent, isMentionedNow, onChunk);
    if (textEl) textEl.textContent = line;
    if (main) main.scrollTop = main.scrollHeight;
    await delay(280);
  }
}

// ─── 玩家话意图识别（punish 优先于 aggressive·因「严办 X」更属惩处）───
function inferPlayerIntent(text) {
  const t = text || '';
  if (/严办|惩之|治罪|不察|可斩|罢黜|查办|严斥|拿下/.test(t)) return 'punish';
  if (/[!！]{2,}/.test(t) || /必须|即办|速行|不容|刻不容缓|不得有违|断不可/.test(t)) return 'aggressive';
  if (/民苦|忧|痛|哀|怜|可怜|惜民|百姓苦/.test(t)) return 'sympathetic';
  if (/善|嘉许|勤勉|可嘉|有功|忠勇|赏之/.test(t)) return 'praise';
  if (/恐有|未必|疑|或非|姑妄|存疑|不可不察/.test(t)) return 'doubt';
  if (/两全|折中|分发|分批|可缓|商榷|或可|稍议/.test(t)) return 'mediate';
  if (/何如|如何|可乎|几何|详言|细言|奈何|怎样|何意|何谓|可言之|讲来/.test(t)) return 'inquire';
  return 'neutral';
}

// ─── 在场 NPC 名识别 ───
function findMentionedChars(text) {
  if (!text) return [];
  const found = [];
  Object.keys(CHARS).forEach(name => {
    if (text.indexOf(name) >= 0) found.push(name);
  });
  return found;
}

function inferStanceForResponder(name, item, playerText, intent, isMentioned) {
  // 自辩刚性规则
  if (isMentioned && item.target === name) return 'oppose';
  if (isMentioned && !item.target) return 'support';
  const inDebate = (item.debate || []).find(d => d.name === name);
  if (inDebate) return inDebate.stance;
  return _cc3_computeStanceFromChar(name, item, intent);
}

/** 从角色实际属性 + 党派 + 议题语境 推导立场·替代纯随机 */
function _cc3_computeStanceFromChar(name, item, intent) {
  const ch = CHARS[name] || {};
  const cfg = (typeof _cc3_getScenarioConfig === 'function') ? _cc3_getScenarioConfig() : { factionMap: {} };
  const factionMap = cfg.factionMap || {};

  // intent 强约束（保留确定性短路）
  if (item && item.target === name) return 'oppose';
  if (intent === 'mediate') return 'mediate';
  if (intent === 'inquire') return 'neutral';

  // ── score: -1 (强反对) ~ +1 (强支持) ──
  let score = 0;

  // ① 党派立场表（scenario.chaoyi.factionMap·剧本可配）
  const partyKey = ch.party || '';
  for (const k of Object.keys(factionMap)) {
    if (partyKey && partyKey.indexOf(k) >= 0) {
      const tone = factionMap[k] && factionMap[k].tone;
      if (tone === 'support') score += 0.45;
      else if (tone === 'oppose') score -= 0.45;
      else if (tone === 'mediate') score += 0.0; // 倾折中
      break;
    }
  }

  // ② 忠诚度·高=偏支持·低=偏反对
  const loyalty = (typeof ch.loyalty === 'number') ? ch.loyalty : 50;
  score += (loyalty - 50) / 100; // -0.5 ~ +0.5

  // ③ 角色 stance 文本（如"中立·将崛起"/"清流"/"附阉"）
  const stxt = ch.stanceText || '';
  if (/清流|耿介|刚直|敢言|忠直/.test(stxt)) score += 0.15;
  if (/附阉|逢迎|柔佞|阴狡|工心术/.test(stxt)) {
    // 这类人会看皇帝意图行事·intent=praise/punish 时附和·sympathetic 时折中
    if (intent === 'praise' || intent === 'punish' || intent === 'aggressive') score += 0.35;
    else if (intent === 'sympathetic') score -= 0.05;
  }

  // ④ intent 与角色性质叠加
  if (intent === 'punish') {
    if (ch.class === 'kdao') score += 0.35;       // 言官响应严办
    if (/东林|清流/.test(partyKey)) score += 0.15;
  }
  if (intent === 'sympathetic') {
    const integrity = (typeof ch.integrity === 'number') ? ch.integrity : 50;
    score += (integrity - 50) / 200;              // 高清廉者更易共情民苦
  }
  if (intent === 'aggressive') {
    // 阁臣（rank<=2）经验老到·常委婉劝谏；言官则附和
    if (ch.rank && ch.rank <= 2) score -= 0.15;
    if (ch.class === 'kdao') score += 0.15;
  }
  if (intent === 'doubt') {
    if (ch.rank && ch.rank <= 2) score -= 0.05;   // 阁臣更慎·偏折中
  }
  if (intent === 'praise') {
    score += 0.20;                                // 嘉奖时大多附和
  }

  // ⑤ 极小随机扰动（避免完全可预测·但权重远低于属性）
  score += (Math.random() - 0.5) * 0.12;

  if (score >= 0.40) return 'support';
  if (score <= -0.30) return 'oppose';
  if (Math.abs(score) < 0.12) return 'neutral';
  return 'mediate';
}

// 入口·先试 AI 再回退 mock·支持流式 onChunk 回调
async function generateNpcReply(name, item, playerText, stance, intent, isMentioned, onChunk) {
  if (aiEnabled()) {
    try {
      const aiLine = await callAIPreview(buildNpcPrompt(name, item, playerText, stance, intent, isMentioned), onChunk);
      const cleaned = (aiLine || '').trim().replace(/^["「『]|["」』]$/g, '');
      if (cleaned.length >= 6) return cleaned;
    } catch (e) {
      setAiStatus('AI 失败 · 退 mock：' + (e.message || e), true);
    }
  }
  return generateNpcReplyMock(name, item, playerText, stance, intent, isMentioned);
}

function generateNpcReplyMock(name, item, playerText, stance, intent, isMentioned) {
  const ch = CHARS[name] || {};
  const isPresenter = (name === item.presenter);
  const isTarget = (name === item.target);
  const pBrief = (playerText || '').slice(0, 16).replace(/[。，！？·]/g, '');

  // ── intent 专属模板（覆盖通用模板）──
  if (isMentioned && isTarget) {
    return '臣 ' + name + ' 闻陛下点名 · 不敢隐避：陛下方才所言「' + pBrief + '」 · 实有未察 · 容臣再陈本末！';
  }
  if (isMentioned && !isTarget) {
    return '臣 ' + name + ' 蒙陛下点问 · 不敢不直陈：陛下方才之意「' + pBrief + '」 · 臣以为' + (stance === 'support' ? '正合时宜 · 陛下圣明。' : stance === 'oppose' ? '尚有可商榷之处 · 容臣具陈。' : '可参酌而行之。');
  }
  if (intent === 'inquire') {
    if (isPresenter) return '臣谨答陛下：' + (item.detail.split('，')[1] || item.detail).slice(0, 60) + '。陛下若再有疑 · 臣无所避。';
    return '陛下既问 · 臣 ' + name + ' 所知如此：' + (stance === 'support' ? '此事确有可行之处 · 臣愿副办。' : stance === 'oppose' ? '此事尚有未备 · 望陛下慎之。' : '此事进退两难 · 伏听圣裁。');
  }
  if (intent === 'punish') {
    if (isTarget) return '陛下！臣 ' + name + ' 不敢承此重责 · 臣自任职以来 · 实未尝有违 · 望陛下察臣本心 · 容臣分辩！';
    if (ch.class === 'kdao') return '臣 ' + name + ' 以言官身份附议陛下 · 此辈奸佞 · 当严办以正朝纲！';
    return stance === 'support' ? '陛下圣裁 · 臣等附议严办 · 以正朝纲。' : '陛下三思 · 严办之前 · 是否先令其自陈？';
  }
  if (intent === 'aggressive') {
    return stance === 'support' ? '陛下圣意刚断 · 臣 ' + name + ' 即办去 · 不敢有半日延误！' : '陛下三思！此举关乎大体 · 若骤然行之 · 恐有未周······';
  }
  if (intent === 'sympathetic') {
    return stance === 'support' ? '陛下念及百姓苦难 · 实为社稷之福。臣 ' + name + ' 愿为陛下分忧。' : '陛下圣怀仁厚 · 然此事处置不可全凭恻隐 · 须并察事理。';
  }
  if (intent === 'praise') {
    if (item.target) return '陛下嘉许之意 · 臣 ' + name + ' 代' + item.target + '谢恩。然亦望陛下慎察其行 · 方为公允。';
    return '陛下赞许 · 实为' + (isPresenter ? '臣' : (item.presenter || '某员')) + '之幸 · 当益自勉励 · 不负圣望。';
  }
  if (intent === 'doubt') {
    return '陛下既有疑 · 不可不察。臣 ' + name + ' 以为：' + (stance === 'support' ? '可先准之 · 后续再察。' : stance === 'oppose' ? '不如暂缓 · 待详查。' : '宜下廷议·三日回奏。');
  }

  // ── 通用立场化模板（与之前一致） ──
  const tplSupport = [
    '陛下圣明 · 臣' + (isPresenter ? '所奏' : '附议') + '。' + (pBrief ? '陛下既言「' + pBrief + '」 · 臣愈坚此见。' : ''),
    '臣谨遵圣意 · 此事可即办。',
    '陛下所言极是 · ' + item.title + ' 事可如是断。',
    '臣 ' + name + ' 愿为陛下督办此事。'
  ];
  const tplOppose = [
    '陛下三思 · 此事尚需斟酌。' + item.title + ' 牵涉甚多 · 恐有未及。',
    '臣不敢苟同 · ' + (pBrief ? '陛下言「' + pBrief + '」 · ' : '') + '然此事另有难处 · 容臣具陈。',
    '陛下所虑虽是 · 然事关大体 · 不宜轻断。',
    '臣以言官身份谨陈 · 此举或致他患。'
  ];
  const tplMediate = [
    '陛下与诸臣所论各有理据 · 臣愿陈一折中：' + item.title + ' 可分而行之。',
    '臣以为可两全其美 · ' + (pBrief ? '即遵陛下「' + pBrief + '」之意 · 兼顾他议。' : '请陛下听臣再陈。'),
    '兹事体大 · 不可独断 · 亦不可空议。臣请下廷议或部议 · 三日后回奏。'
  ];
  const tplNeutral = [
    '臣愚钝 · 不敢独断 · 伏听陛下圣裁。',
    '此事进退两难 · 臣随圣意。',
    '臣随班附议 · 不敢专擅。'
  ];
  const map = { support: tplSupport, oppose: tplOppose, mediate: tplMediate, neutral: tplNeutral };
  const arr = map[stance] || tplNeutral;
  return arr[Math.floor(Math.random() * arr.length)];
}

// 旧的通用模板部分被新版生成模板覆盖·下面这段已并入·保留空函数体作 stub
// (legacy 通用模板段已并入 generateNpcReplyMock 主体)

// ═══════════════════════════════════════════════
// AI 接入·OpenAI 兼容协议·复用主项目 localStorage.tm_api
// ═══════════════════════════════════════════════
function getAIConfig() {
  let cfg = {};
  try { cfg = JSON.parse(localStorage.getItem('tm_api') || '{}'); } catch(_){}
  return { key: cfg.key || '', url: cfg.url || '', model: cfg.model || '' };
}
function saveAIConfig(cfg) {
  try { localStorage.setItem('tm_api', JSON.stringify(cfg)); } catch(_){}
}
// v3 重写：aiEnabled 直接看 P.ai（v2 主项目已配 API）
function aiEnabled() {
  return _cc3_aiEnabled();
}
function setAiStatus(text, isErr) {
  // v3 在主项目内·无 ai-status 元素·改为 toast 或静默
  if (isErr && typeof toast === 'function') toast(text);
}

// v3 重写：callAIPreview 委托给 _cc3_callAI（走 v2 callAI tier 系统）·透传 onChunk
async function callAIPreview(prompt, onChunk) {
  return await _cc3_callAI(prompt, onChunk);
}

// 旧 fetch 实现保留为废弃函数·永不被调用
// (旧 _cc3_DEAD_callAIPreview·preview 自带 fetch 实现·已委托 _cc3_callAI·此处删除 ~50 行死代码)

// 构造朝堂 NPC 立场化回应 prompt
function buildNpcPrompt(name, item, playerText, stance, intent, isMentioned) {
  const ch = CHARS[name] || {};
  const stanceLabels = { support: '支持', oppose: '反对', mediate: '折中', neutral: '中立' };
  const intentLabels = {
    inquire: '询问情况·想了解细节',
    aggressive: '言辞激进·有强行推进/严办之意',
    mediate: '倾向折中调和·或要求分批办理',
    sympathetic: '表达对百姓/受害者的同情忧虑',
    punish: '意欲惩治某人或追究失职',
    praise: '嘉许某人某事',
    doubt: '心存疑虑·需臣劝导或申辩',
    neutral: '随意发问·态度中性'
  };

  // ─── B1 融合：从 GM 读真角色上下文（v2 character/personality/loyalty/记忆）───
  let gmCh = null;
  try { if (typeof findCharByName === 'function') gmCh = findCharByName(name); } catch (_) {}
  const personality = (gmCh && gmCh.personality) || '';
  const loyalty = (gmCh && typeof gmCh.loyalty === 'number') ? gmCh.loyalty : null;
  const integrity = (gmCh && typeof gmCh.integrity === 'number') ? gmCh.integrity : null;
  const ambition = (gmCh && typeof gmCh.ambition === 'number') ? gmCh.ambition : null;
  const family = (gmCh && gmCh.family) || '';
  const officialTitle = (gmCh && (gmCh.officialTitle || gmCh.title)) || ch.title || '';
  const stance2Player = (gmCh && gmCh.stanceToPlayer) || '';
  // NPC 历史记忆（最近 3 条）
  let memorySnippet = '';
  try {
    if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.recall) {
      const memList = NpcMemorySystem.recall(name, 3);
      if (Array.isArray(memList) && memList.length) {
        memorySnippet = memList.map(m => '  - ' + (m.text || m.event || JSON.stringify(m).slice(0, 60))).join('\n');
      }
    }
  } catch (_) {}
  // 与陛下关系（OpinionSystem）
  let relationLine = '';
  try {
    if (typeof OpinionSystem !== 'undefined' && OpinionSystem.getEventOpinion) {
      const op = OpinionSystem.getEventOpinion(name, '玩家');
      if (op != null) relationLine = '与陛下关系值: ' + Math.round(op);
    }
  } catch (_) {}

  let p = '你是 ' + name + '·身份「' + officialTitle + '」·派系「' + (ch.faction || gmCh && gmCh.faction || '中立') + '」·品级 ' + (ch.rank || '?') + '。\n';
  if (personality) p += '性格：' + personality + '\n';
  const stats = [];
  if (loyalty != null) stats.push('忠诚 ' + loyalty);
  if (integrity != null) stats.push('清廉 ' + integrity);
  if (ambition != null) stats.push('野心 ' + ambition);
  if (stats.length) p += '能力数值：' + stats.join(' · ') + '\n';
  if (family) p += '家世：' + (typeof family === 'string' ? family : '世家出身') + '\n';
  if (stance2Player) p += '对陛下：' + stance2Player + '\n';
  if (relationLine) p += relationLine + '\n';
  if (memorySnippet) p += '【近期记忆】\n' + memorySnippet + '\n';
  p += '\n今日早朝·正议题「' + item.title + '」（' + (item.dept || '') + '上奏）。\n';
  p += '议题原文：' + (item.detail || item.content || item.title) + '\n\n';

  if (item.selfReact && item.selfReact.length) {
    p += '殿中已有臣表态：\n';
    item.selfReact.forEach(r => { p += '  ' + r.name + '：' + (r.line || '') + '\n'; });
  }
  if (item.debate && item.debate.length) {
    p += '议论中诸臣：\n';
    item.debate.slice(0, 4).forEach(d => { p += '  ' + d.name + '（' + (stanceLabels[d.stance] || '') + '）：' + (d.line || '') + '\n'; });
  }
  // 议论上下文·上一个发言者及其话（让 AI 理解"你说/其他人"指代）
  const lastSp = (typeof state !== 'undefined' && state._lastNpcSpeaker) || '';
  if (lastSp && lastSp !== name) {
    p += '【上一位发言者】' + lastSp + '（你之前·朝堂刚刚听其陈奏）\n';
  }

  p += '\n陛下方才说：「' + playerText + '」\n';
  if (intent && intent !== 'neutral') {
    p += '【陛下话语意图分析】' + (intentLabels[intent] || '') + '。请以此为基调回应。\n';
  }
  // 代词识别提示
  const refLast = /^(你说|请说|尔言|尔说|且言|且说|讲来|细言|说来|你来说|你具陈|你陈之|尔陈|尔续|尔再言)/.test((playerText || '').trim());
  const askOth = /其他人|余者|余下|其余|诸卿|众卿|他人|别人|余等|余卿/.test(playerText || '');
  if (refLast && lastSp === name) {
    p += '【重要】陛下用"你说/讲来"等词·实是指你（' + name + '·上一位刚发言）·须接续刚才所论·具体陈述细节·不可重复套话。\n';
  }
  if (askOth && lastSp && lastSp !== name) {
    p += '【重要】陛下问"其他人觉得呢"·暗示不复听' + lastSp + '·愿听他臣异见·你须给出与' + lastSp + '不同视角的看法·不可附和。\n';
  }
  if (isMentioned && !refLast) {
    if (item.target === name) {
      p += '【重要】陛下点名提及你（' + name + '·正是被指弹劾对象）·你须自辩。语气惶恐而坚定·不可空泛附和·须具体反驳。\n';
    } else {
      p += '【重要】陛下点名提及你（' + name + '）·你须直接领旨·或谨慎进言·不可不应。\n';
    }
  }
  // 朝威标识
  const strict = (typeof isStrictCourt === 'function') ? isStrictCourt() : false;
  p += '【朝威】' + (strict ? '肃朝（皇威皇权双高·百官谨慎·言辞克制）' : '众言（百官较活跃·可有自发表态）') + '。\n';

  // P4+·季节天气标识（让回应反映时令·如冬日寒朝言简意赅·夏日苦热则托病感叹）
  if (state && state._currentSeason) {
    p += '【时令】' + state._currentSeason + ' · ' + (state._currentWeather || '晴') + '·可酌情融入回应措辞。\n';
  }

  p += '\n请以 ' + name + ' 的口吻·立场为「' + (stanceLabels[stance] || '中立') + '」·针对陛下的话作回应。\n';

  // 字数走 v2 朝议字数设置
  const wordHint = (typeof _aiDialogueWordHint === 'function') ? _aiDialogueWordHint('cy') : '约 50-120 字';
  p += '要求：\n';
  p += '· 半文言·朝堂奏对体·「臣……」开头·体现你的性格（' + (personality || '一般文官') + '）\n';
  p += '· 字数' + wordHint + '·一句话足矣·不超过两句\n';
  p += '· 立场鲜明·体现派系倾向与品级口吻\n';
  p += '· 紧扣陛下话的具体内容（不要空泛附和"陛下圣明"）\n';
  p += '· 若有近期记忆且相关·可隐约带出（如"前番陕西事·臣已具陈"）\n';
  p += '· 不重复 selfReact / debate 中的话·要有新内容\n';
  p += '· 直接输出回应文·不要任何前后缀。';

  // 时空约束·防 AI 引用未来史实
  if (typeof _buildTemporalConstraint === 'function') {
    try { p += _buildTemporalConstraint(gmCh); } catch (_) {}
  }

  return p;
}

function showAIConfigModal() {
  const cfg = getAIConfig();
  const m = document.createElement('div');
  m.className = 'cy-input-modal';
  m.innerHTML = `
    <div class="cy-input-modal-card" style="width:min(520px,90vw);">
      <h3>AI 配置 · OpenAI 兼容协议（与主游戏共享）</h3>
      <div class="hint">配置存于 localStorage.tm_api · 主游戏配过此处自动读出 · 改动也会回写</div>
      <div style="font-size:12px;color:var(--ink-500);margin-bottom:4px;">API URL（如 https://api.openai.com/v1·或自定义代理）</div>
      <input id="ai-cfg-url" type="text" value="${escHtml(cfg.url)}" placeholder="https://api.openai.com/v1" />
      <div style="font-size:12px;color:var(--ink-500);margin-bottom:4px;">API Key</div>
      <input id="ai-cfg-key" type="password" value="${escHtml(cfg.key)}" placeholder="sk-..." />
      <div style="font-size:12px;color:var(--ink-500);margin-bottom:4px;">模型名（如 gpt-4o-mini / claude-sonnet-4-5 / deepseek-chat 等）</div>
      <input id="ai-cfg-model" type="text" value="${escHtml(cfg.model || 'gpt-4o-mini')}" placeholder="gpt-4o-mini" />
      <div style="font-size:11px;color:var(--ink-300);margin:8px 0;">注：CORS 限制下·部分官方端点（含 Anthropic）需经代理。已知可直连：兼容 OpenAI 协议的国产 API（DeepSeek/智谱/月之暗面等）和大多数代理端点。</div>
      <div class="row">
        <button class="cy-btn muted" id="ai-cfg-cancel">取消</button>
        <button class="cy-btn" id="ai-cfg-test">⚡ 测试调用</button>
        <button class="cy-btn primary" id="ai-cfg-save">保存</button>
      </div>
      <div id="ai-cfg-result" style="font-size:12px;color:var(--ink-500);margin-top:8px;min-height:18px;"></div>
    </div>
  `;
  $('cy-stage').appendChild(m);
  $('ai-cfg-cancel').onclick = () => m.remove();
  $('ai-cfg-save').onclick = () => {
    saveAIConfig({
      url: $('ai-cfg-url').value.trim(),
      key: $('ai-cfg-key').value.trim(),
      model: $('ai-cfg-model').value.trim() || 'gpt-4o-mini'
    });
    setAiStatus('已保存');
    m.remove();
  };
  $('ai-cfg-test').onclick = async () => {
    const tmpCfg = {
      url: $('ai-cfg-url').value.trim(),
      key: $('ai-cfg-key').value.trim(),
      model: $('ai-cfg-model').value.trim() || 'gpt-4o-mini'
    };
    saveAIConfig(tmpCfg);
    $('ai-cfg-result').textContent = '调用中…';
    $('ai-cfg-result').style.color = 'var(--ink-500)';
    try {
      const r = await callAIPreview('请用半文言一句话（不超过 30 字）回答：「君何以治国？」');
      $('ai-cfg-result').style.color = 'var(--celadon-400)';
      $('ai-cfg-result').textContent = '✓ 调用成功：' + (r || '').slice(0, 100);
    } catch (e) {
      $('ai-cfg-result').style.color = 'var(--vermillion-300)';
      $('ai-cfg-result').textContent = '✗ 失败：' + (e.message || e).slice(0, 200);
    }
  };
}

function pickResponder(item, exclude) {
  const debaters = (item.debate || []).map(d => d.name);
  const candidates = ['韩爌', '黄宗周', '倪元璐', ...debaters];
  return candidates.find(n => n !== exclude && CHARS[n] && !CHARS[n].absent) || '韩爌';
}

// 朝堂氛围气泡·不影响逻辑·仅渲染殿中活力
const AMBIENT_LINES = [
  '（殿中有低声议论。）',
  '（黄宗周与王在晋目光交触。）',
  '（满桂凝视前方 · 面无表情。）',
  '（韩爌捻须 · 略有沉思。）',
  '（殿中有人微微叹息。）',
  '（温体仁扶笏 · 目光低垂。）',
  '（毕自严捏紧手中奏疏。）',
  '（科道几员低声相商。）',
  '（远处似有内官传旨之声。）'
];
function maybeAmbient(prob) {
  if (Math.random() > (prob == null ? 0.2 : prob)) return;
  const line = AMBIENT_LINES[Math.floor(Math.random() * AMBIENT_LINES.length)];
  addBubble({ kind: 'system', text: line });
}

function setActions(html) {
  $('cy-action-bar').innerHTML = html;
}

function setPhase(label, hint) {
  $('cy-phase-label').textContent = label;
  $('cy-phase-hint').textContent = hint || '';
}

function updateProgress() {
  $('cy-progress-tag').textContent = '已议 ' + state.decisions.length;
}

function refreshTitle() {
  // 朝代配置·从 scenario.chaoyi 读
  const cfg = (typeof _cc3_getScenarioConfig === "function") ? _cc3_getScenarioConfig() : null;
  if (cfg) {
    const isShuo2 = state.mode === 'shuochao';
    const chaoName2 = isShuo2 ? cfg.shuoChaoName : cfg.chaoName;
    const ttl2 = '〔 ' + chaoName2 + ' 〕' + cfg.audienceHall + ' · ' + cfg.dateLabel;
    const tEl = $('cy-title'); if (tEl) tEl.textContent = ttl2;
    const cEl = $('cy-ceremony-title'); if (cEl) cEl.textContent = '〔 ' + chaoName2 + ' 〕';
    const sEl = $('cy-ceremony') && $('cy-ceremony').querySelector('.sub');
    if (sEl) sEl.textContent = cfg.audienceHall + (isShuo2 ? ' · 朔月初一' : ' · 五更三点') + ' · ' + cfg.dateLabel;
    return;
  }
  // 兜底（preview mode·或 GM 未初始化）
  const isShuo = state.mode === 'shuochao';
  const ttl = isShuo ? '〔 朔 朝 〕奉天门 · 戊辰年三月初一' : '〔 早 朝 〕奉天门 · 戊辰年三月十二';
  $('cy-title').textContent = ttl;
  $('cy-ceremony-title').textContent = isShuo ? '〔 朔 朝 〕' : '〔 早 朝 〕';
  $('cy-ceremony').querySelector('.sub').textContent = isShuo
    ? '奉天门 · 朔月初一 · 戊辰年三月初一'
    : '奉天门 · 五更三点 · 戊辰年三月十二';
}

// 时辰流动·议程推进时辰
const TIME_FLOW = ['五更三点', '寅时初刻', '寅时正', '寅时三刻', '卯时初', '卯时二刻', '卯时正', '卯时四刻', '辰时初'];
function getTimeStr() {
  // currentIdx 为 0 时（开场）= 五更三点·之后每议程推 1 个刻度
  const idx = Math.min(state.currentIdx, TIME_FLOW.length - 1);
  return TIME_FLOW[idx];
}
function updateTimeOfDay() {
  let el = $('time-of-day');
  if (!el) {
    const bar = document.querySelector('.cy-titlebar');
    if (!bar) return;
    el = document.createElement('div');
    el.id = 'time-of-day';
    el.className = 'time-of-day';
    bar.appendChild(el);
  }
  el.textContent = '🕒 ' + getTimeStr();
}

// ═══════════════════════════════════════════════
// 班次区渲染
// ═══════════════════════════════════════════════
function renderBench() {
  const east = [], west = [], kdao = [];
  Object.entries(CHARS).forEach(([name, ch]) => {
    const html = `<div class="bench-avatar${ch.absent ? ' absent' : ''}" title="${escHtml(name)}·${escHtml(ch.title)}${ch.absent ? ' ('+escHtml(ch.absent)+')' : ''}" data-name="${escHtml(name)}">
      <div class="bench-avatar-circle ${ch.class === 'wu' ? 'wu' : ch.class === 'kdao' ? 'koudao' : ''}${ch.absent ? ' absent' : ''}">${escHtml(ch.initial)}</div>
      <div class="bench-avatar-name">${escHtml(name)}</div>
    </div>`;
    if (ch.class === 'kdao') kdao.push(html);
    else if (ch.class === 'wu') west.push(html);
    else east.push(html);
  });
  // sort by rank
  const byRank = (a, b) => {
    const m1 = a.match(/data-name="([^"]+)"/), m2 = b.match(/data-name="([^"]+)"/);
    return (CHARS[m1[1]].rank || 99) - (CHARS[m2[1]].rank || 99);
  };
  east.sort(byRank); west.sort(byRank); kdao.sort(byRank);
  $('bench-east').innerHTML = east.join('');
  $('bench-west').innerHTML = west.join('');
  $('bench-kdao').innerHTML = kdao.join('');

  // attendance count
  state.attendees = []; state.absents = [];
  Object.entries(CHARS).forEach(([name, ch]) => {
    if (ch.absent) state.absents.push({ name, reason: ch.absent });
    else state.attendees.push(name);
  });
  $('cy-attend-tag').textContent = '殿中 ' + state.attendees.length;
  $('cy-bench-status').textContent = '朝堂全景 · ' + state.attendees.length + ' 员到 · ' + state.absents.length + ' 缺';
}

// ═══════════════════════════════════════════════
// 朝会主流程
// ═══════════════════════════════════════════════
async function runOpening() {
  state.phase = 'opening';
  setPhase('【鸣 鞭】', '百官入班候旨');
  setActions('<span style="color:var(--ink-500);font-size:12px;">入殿仪礼中……</span>');
  await delay(1300);
  $('cy-ceremony').style.display = 'none';

  // ── 鸣鞭三响（视觉化·CSS 动画总时长 ~1.2s） ──
  const main = $('cy-stage-main');
  const bellRow = document.createElement('div');
  bellRow.className = 'bell-ring';
  bellRow.innerHTML = '<span>铮</span><span>铮</span><span>铮</span>';
  main.appendChild(bellRow);
  await delay(1100);

  addBubble({ kind: 'system', sysKind: 'ceremony', text: '〔 鸣 鞭 三 响 · 百 官 列 班 〕' });
  await delay(380);

  // ── 山呼万岁（震动动画） ──
  const cheerEl = document.createElement('div');
  cheerEl.className = 'cheer-line';
  cheerEl.textContent = '吾 皇 万 岁 万 岁 万 万 岁';
  main.appendChild(cheerEl);
  main.scrollTop = main.scrollHeight;
  await delay(550);

  // ── 缺朝名册（视觉化） ──
  if (state.absents.length > 0) {
    const roster = document.createElement('div');
    roster.className = 'absent-roster';
    let html = '<span class="lbl">〔 缺 朝 〕</span>';
    state.absents.forEach(a => {
      html += '<span class="name">' + escHtml(a.name) + '</span><span style="color:var(--ink-300);font-size:11px;">（' + escHtml(a.reason) + '）</span>';
    });
    roster.innerHTML = html;
    main.appendChild(roster);
    main.scrollTop = main.scrollHeight;
    await delay(500);
  }

  // P4·季节天气氛围气泡（在御殿前·渲染时令）
  if (typeof _cc3_getSeasonAndWeather === 'function') {
    try {
      const sw = _cc3_getSeasonAndWeather();
      const line = _cc3_getSeasonalAmbientLine(sw.season, sw.weather);
      if (line) {
        addBubble({ kind: 'system', text: line });
        await delay(420);
      }
      // 把季节天气存到 state·议程 prompt 可读
      state._currentSeason = sw.season;
      state._currentWeather = sw.weather;
    } catch (_) {}
  }

  addBubble({ kind: 'system', sysKind: 'ceremony', text: '〔 陛 下 御 殿 · 百 官 奏 事 〕' });
  await delay(450);
  console.log('[cc3] runOpening 完毕·进入 runNextItem·AGENDA.length=' + AGENDA.length);
  try {
    await runNextItem();
  } catch (e) {
    console.error('[cc3] runNextItem 顶层抛错', e);
    addBubble({ kind: 'system', sysKind: 'warn', text: '（朝议流程异常·' + (e && e.message || e) + '·已自动退朝。）' });
    setTimeout(() => { try { runClosing(); } catch (_) {} }, 500);
  }
}

async function runNextItem() {
  console.log('[cc3] runNextItem·idx=' + state.currentIdx + '·AGENDA.length=' + AGENDA.length);
  if (state.currentIdx >= AGENDA.length) {
    console.log('[cc3] 议程已尽·进入 runClosing');
    return runClosing();
  }
  // Half-way nudge
  if (state.currentIdx === Math.floor(AGENDA.length / 2)) {
    addBubble({ kind: 'system', text: '百官奏事已半。' });
    await delay(500);
  }
  // Near-end nudge
  if (state.currentIdx === AGENDA.length - 2) {
    addBubble({ kind: 'system', text: '百官奏事已多 · 陛下是否退朝？（仍可继续）' });
    await delay(600);
  }
  try {
    await runAnnounce();
  } catch (e) {
    console.error('[cc3] runAnnounce 抛错·item idx=' + state.currentIdx, e);
    addBubble({ kind: 'system', sysKind: 'warn', text: '（议程异常·跳过此条。' + (e && e.message || e) + '）' });
    state.currentIdx++;
    updateProgress();
    await delay(300);
    return runNextItem();
  }
}

async function runAnnounce() {
  const item = AGENDA[state.currentIdx];
  if (!item) {
    console.warn('[cc3] runAnnounce·item 为空 idx=' + state.currentIdx + '·AGENDA=', AGENDA);
    state.currentIdx++;
    return runNextItem();
  }
  console.log('[cc3] runAnnounce·idx=' + state.currentIdx, item);
  state.phase = 'announce';
  state._chaosFired = false;
  updateTimeOfDay();
  // 阶段标签按 urgency 着色
  const tag = $('cy-phase-tag');
  tag.classList.remove('strict', 'urgent');
  if (item.urgency === 'urgent') tag.classList.add('urgent');
  setPhase('【启 奏】' + (item.urgency === 'urgent' ? ' · 急 奏' : ''), '官员请奏 · 陛下定夺');
  await delay(400);

  // ── 急奏特殊处理：先弹"此为急奏 陛下是否先听？"卡片 ──
  if (item.urgency === 'urgent') {
    const main = $('cy-stage-main');
    const card = document.createElement('div');
    card.className = 'urgent-card';
    card.innerHTML = `<span class="urgent-mark">⚡ 急 奏</span><span class="urgent-text">${escHtml(item.presenter)} · ${escHtml(item.dept || '')} · 「${escHtml(item.title)}」 · 须陛下即决</span>`;
    main.appendChild(card);
    main.scrollTop = main.scrollHeight;
    await delay(700);
  }

  addBubble({
    name: item.presenter,
    text: item.announceLine,
    urgent: item.urgency === 'urgent',
    itemType: item.type
  });
  await delay(300);
  setActions(`
    <button class="cy-btn primary" onclick="onAnnounceChoice('proceed')">奏来</button>
    <button class="cy-btn muted" onclick="onAnnounceChoice('skip')">此事免议</button>
    <button class="cy-btn" onclick="onAnnounceChoice('hold')">改日再奏</button>
  `);
}

async function onAnnounceChoice(choice) {
  const item = AGENDA[state.currentIdx];
  if (choice === 'proceed') {
    addBubble({ kind: 'player', text: '奏来。' });
    await delay(300);
    return runDetail();
  }
  if (choice === 'skip') {
    addBubble({ kind: 'player', text: '此事免议。' });
    await delay(200);
    addBubble({ kind: 'system', text: '（' + item.presenter + ' 退入班列。此事压一回合。）' });
    state.decisions.push({ idx: state.currentIdx, action: 'skip', item, label: '免议' });
    state.currentIdx++;
    updateProgress();
    await delay(400);
    return runNextItem();
  }
  if (choice === 'hold') {
    addBubble({ kind: 'player', text: '此事改日再奏。' });
    await delay(200);
    addBubble({ kind: 'system', text: '（' + item.presenter + ' 退归班列。议程留中。）' });
    state.decisions.push({ idx: state.currentIdx, action: 'hold', item, label: '改日再奏（留中）' });
    state.currentIdx++;
    updateProgress();
    await delay(400);
    return runNextItem();
  }
}

// ═══ 肃朝判定·请奏队列 ═══
/** 详细诊断·返回 {prestige, power, thPrestige, thPower, isStrict, note}
 *  实时从 GM.vars 重读·使中途数值变动也能正确反映 */
function _cc3_getStrictCourtInfo() {
  // 优先 state.prestige/power（_cc3_overrideMockWithGM 已同步）·若无则即时读 GM
  let pres = (typeof state !== 'undefined' && typeof state.prestige === 'number') ? state.prestige : null;
  let pwr  = (typeof state !== 'undefined' && typeof state.power    === 'number') ? state.power    : null;
  if (pres == null) pres = (typeof _cc3_getPrestige === 'function') ? _cc3_getPrestige() : 50;
  if (pwr  == null) pwr  = (typeof _cc3_getPower    === 'function') ? _cc3_getPower()    : 50;
  const cfg = (typeof _cc3_getScenarioConfig === 'function') ? _cc3_getScenarioConfig() : { strictThreshold: { prestige: 75, power: 75 } };
  const th = cfg.strictThreshold || { prestige: 75, power: 75 };
  const presOk = pres >= th.prestige;
  const pwrOk  = pwr  >= th.power;
  const isStrict = presOk && pwrOk;
  // 临界标注（差 5 内称"勉强达标"·短缺 5 内称"将临"·差距大无标注）
  let note = '';
  if (isStrict) {
    if (pres - th.prestige <= 5 || pwr - th.power <= 5) note = '勉强达标';
  } else {
    const gp = th.prestige - pres, gw = th.power - pwr;
    if (gp <= 5 && gw <= 5) note = '将临肃朝';
    else if (!presOk && !pwrOk) note = '皇威皇权两不足';
    else if (!presOk) note = '皇威不足 (差 ' + gp + ')';
    else if (!pwrOk) note = '皇权不足 (差 ' + gw + ')';
  }
  return { prestige: pres, power: pwr, thPrestige: th.prestige, thPower: th.power, isStrict: isStrict, note: note };
}

function isStrictCourt() {
  return _cc3_getStrictCourtInfo().isStrict;
}

/** 朝代配置·rank 直接发言阈值（阁臣不待旨） */
function _cc3_getDirectSpeakRank() {
  if (typeof _cc3_getScenarioConfig === 'function') {
    return _cc3_getScenarioConfig().directSpeakRank;
  }
  return 2;
}
function classifyForStrict(reactor) {
  // 低朝威·全直接发言（现状）
  if (!isStrictCourt()) return 'speak';
  // 高朝威·rank ≤ 阁臣线 仍可不待旨而言·余等需举笏请奏
  const ch = CHARS[reactor.name] || {};
  const directRank = (typeof _cc3_getDirectSpeakRank === 'function') ? _cc3_getDirectSpeakRank() : 2;
  if (ch.rank && ch.rank <= directRank) return 'speak';
  return 'request';
}

async function runDetail() {
  const item = AGENDA[state.currentIdx];
  state.phase = 'detail';
  state._strictQueue = null;  // 每条议程开始重置
  const strict = isStrictCourt();
  // 阶段标签状态
  const tag = $('cy-phase-tag');
  tag.classList.remove('strict', 'urgent');
  if (strict) tag.classList.add('strict');
  if (item.urgency === 'urgent') tag.classList.add('urgent');
  setPhase('【详 述】' + (strict ? ' · 肃朝' : '') + (item.urgency === 'urgent' ? ' · 急' : ''), '正文奏报 · ' + (strict ? '诸臣肃然待旨' : '殿中自发表态') + ' · 陛下处分');
  await delay(300);
  addBubble({
    name: item.presenter,
    text: item.detail,
    detail: true,
    urgent: item.urgency === 'urgent',
    itemType: item.type
  });
  await delay(500);

  // ── 详述后·按朝威分流 ──
  if (item.selfReact && item.selfReact.length) {
    const directs = [];
    const requests = [];
    item.selfReact.forEach(r => {
      if (classifyForStrict(r) === 'speak') directs.push(r);
      else requests.push(r);
    });

    // 高朝威：先入请奏队列（举笏请言）
    if (strict && requests.length > 0) {
      state._strictQueue = requests.map(r => ({ name: r.name, stance: r.stance, line: r.line, used: false }));
      addBubble({ kind: 'system', text: '（殿中肃静 · 诸臣俯首待旨。）' });
      await delay(420);
      for (const q of state._strictQueue) {
        addBubble({ kind: 'system', text: '（' + q.name + ' 举笏请言。）' });
        await delay(280);
      }
    }

    // 直接发言者（低朝威全部·高朝威仅 rank 1-2）
    if (directs.length > 0) {
      addBubble({ kind: 'system', text: strict ? '（一二阁臣不待旨而言。）' : '（殿中有臣自发表态。）' });
      await delay(380);
      for (const r of directs) {
        // AI 流式·读其档案/记忆/派系决定立场和台词
        await _cc3_streamReactBubble(r, item, 'self');
        await delay(280);
        if (state.pendingPlayerInput) {
          const t = state.pendingPlayerInput; state.pendingPlayerInput = null;
          addBubble({ kind: 'player', text: t });
          await delay(360);
          // 玩家插言后·让一名 NPC 流式回应（走完整 npcRespondToPlayer 路径）
          try { await npcRespondToPlayer(t, 1); } catch (_) {}
        }
        maybeAmbient(0.18);
      }
      await delay(200);
    }
  }
  showDetailActions();
}

// 请奏队列：让 X 单独发言
async function letStrictSpeaker(idx) {
  document.querySelectorAll('.cy-popover.show').forEach(p => p.classList.remove('show'));
  const queue = state._strictQueue || [];
  const q = queue[idx];
  if (!q || q.used) return;
  q.used = true;
  addBubble({ kind: 'system', text: '（陛下示意 ' + q.name + ' 言之。）' });
  await delay(280);
  addBubble({ name: q.name, stance: q.stance, text: q.line });
  await delay(450);
  // 玩家在 NPC 发言后可能即说·若已说则消化
  if (state.pendingPlayerInput) {
    const t = state.pendingPlayerInput; state.pendingPlayerInput = null;
    addBubble({ kind: 'player', text: t });
    await delay(360);
  }
  maybeAmbient(0.2);
  showDetailActions();
}

// 请奏队列：一并准予全数
async function letAllStrictSpeakers() {
  document.querySelectorAll('.cy-popover.show').forEach(p => p.classList.remove('show'));
  const queue = state._strictQueue || [];
  if (queue.filter(q => !q.used).length === 0) return;
  addBubble({ kind: 'system', text: '（陛下挥袖：诸卿但言之。）' });
  await delay(320);
  for (const q of queue) {
    if (q.used) continue;
    q.used = true;
    addBubble({ name: q.name, stance: q.stance, text: q.line });
    await delay(480);
    maybeAmbient(0.18);
  }
  showDetailActions();
}

// 请奏队列：免诸卿之言（直接进入决断·剩余 NPC 不再说）
function dismissStrictQueue() {
  document.querySelectorAll('.cy-popover.show').forEach(p => p.classList.remove('show'));
  const queue = state._strictQueue || [];
  queue.forEach(q => q.used = true);
  addBubble({ kind: 'system', text: '（陛下挥袖：诸卿之言可免。）' });
  showDetailActions();
}

function toggleStrictQueuePopover() {
  document.querySelectorAll('.cy-popover.show').forEach(p => p.classList.remove('show'));
  const pop = $('strict-queue-popover');
  if (pop) pop.classList.add('show');
}

function showDetailActions() {
  // 请奏队列按钮（仅肃朝有内容时显示）
  const queue = state._strictQueue || [];
  const liveQueue = queue.filter(q => !q.used);
  let queueBtnHtml = '';
  if (liveQueue.length > 0) {
    queueBtnHtml = `
      <button class="cy-btn" style="border-color:var(--celadon-400);color:var(--celadon-400);" onclick="toggleStrictQueuePopover()">📋 请奏 ${liveQueue.length} 人 ▼</button>
      <div class="cy-popover" id="strict-queue-popover">
        ${liveQueue.map((q, idx) => `<button class="cy-popover-item" onclick="letStrictSpeaker(${queue.indexOf(q)})">${escHtml(q.name)} <span class="hint">${stanceLbl(q.stance)}</span></button>`).join('')}
        <div class="cy-popover-divider"></div>
        <button class="cy-popover-item" onclick="letAllStrictSpeakers()">一并准予 <span class="hint">${liveQueue.length} 人续奏</span></button>
        <button class="cy-popover-item" onclick="dismissStrictQueue()">免诸卿之言 <span class="hint">直入决断</span></button>
      </div>
    `;
  }
  setActions(`
    <button class="cy-btn primary" onclick="doAction('approve')">准 奏</button>
    <button class="cy-btn danger" onclick="doAction('reject')">驳 奏</button>
    <button class="cy-btn" onclick="doAction('hold')">留 中</button>
    <button class="cy-btn muted" onclick="toggleMorePopover()">⋯ 更多</button>
    ${queueBtnHtml}
    <div class="cy-popover" id="more-popover">
      <button class="cy-popover-item" onclick="doMore('refer')">发部议 → <span class="hint">转某衙门详议</span></button>
      <button class="cy-popover-item" onclick="doMore('escalate')">下廷议 <span class="hint">转正式廷议</span></button>
      <button class="cy-popover-item" onclick="doMore('modify')">改批 → <span class="hint">玩家口述新方案</span></button>
      <button class="cy-popover-item" onclick="doMore('probe')">追问 → <span class="hint">问奏报者细节</span></button>
      <div class="cy-popover-divider"></div>
      <button class="cy-popover-item" onclick="doMore('summon')">传召 → <span class="hint">召不在场者</span></button>
      <button class="cy-popover-item" onclick="doMore('admonish')">训诫 → <span class="hint">当庭训某官</span></button>
      <button class="cy-popover-item" onclick="doMore('praise')">嘉奖 → <span class="hint">当庭赏某官</span></button>
    </div>
  `);
}

function toggleMorePopover() {
  const pop = $('more-popover');
  pop.classList.toggle('show');
}

async function doAction(action, extra) {
  const item = AGENDA[state.currentIdx];
  // 如有议论高争议 + 玩家直接决断（非议论后），则进议论
  if ((action === 'approve' || action === 'reject') && item.controversial > 5 && state.phase !== 'debate' && item.debate && item.debate.length > 0) {
    return runDebate();
  }
  return finalizeAction(action, extra);
}

async function finalizeAction(action, extra) {
  const item = AGENDA[state.currentIdx];
  const labels = {
    approve: '准奏', reject: '驳奏', hold: '留中',
    refer: '发部议', escalate: '下廷议', modify: '改批',
    probe: '追问', summon: '传召', admonish: '训诫', praise: '嘉奖',
    'decree': '当庭口述诏令'
  };
  const label = labels[action] || action;
  // 玩家说话
  let pTxt = '';
  if (action === 'approve') pTxt = '准奏。' + (extra ? '（' + extra + '）' : '');
  else if (action === 'reject') pTxt = '驳。';
  else if (action === 'hold') pTxt = '此事留中。';
  else if (action === 'refer') pTxt = '此事发 ' + (extra || '某部') + ' 详议。';
  else if (action === 'escalate') pTxt = '此事兹事体大 · 下廷议。';
  else if (action === 'modify') pTxt = '朕意如此：' + (extra || '〔玩家口述方案〕');
  else if (action === 'probe') pTxt = (extra || '细言之。');
  else if (action === 'summon') pTxt = '传召 ' + (extra || '某员') + ' 入殿。';
  else if (action === 'admonish') pTxt = (extra ? extra + '，' : '') + '尔等所为 · 朕已知之 · 须自警。';
  else if (action === 'praise') pTxt = (extra ? extra + '，' : '') + '卿勤勉可嘉 · 着户部加赐。';
  else if (action === 'decree') pTxt = (extra && extra.text) ? ('（当庭宣旨）' + extra.text) : '（当庭宣旨）';
  addBubble({ kind: 'player', text: pTxt });
  await delay(300);

  // ─── NPC 连锁反应（按动作 + 立场层级触发） ───
  await runActionReactions(action, item, extra);
  await delay(400);

  // ─── P0 GM 状态写入·v3 决议真持久化 ───
  _cc3_writeActionToGM(action, item, extra, label);

  // ─── 抗辩触发判定（高争议·准/驳 后 30%）───
  if ((action === 'approve' || action === 'reject') && item.controversial >= 7 && Math.random() < 0.45) {
    const handled = await runDissentFlow(action, item);
    if (handled === 'wait') return; // 抗辩流程接管·稍后由 resolveDissent 推进
  }

  state.decisions.push({ idx: state.currentIdx, action, item, label, extra });
  state.currentIdx++;
  updateProgress();
  await delay(300);
  return runNextItem();
}

// ─── P0·将朝议动作写入 GM 状态（C3-C8）───
function _cc3_writeActionToGM(action, item, extra, label) {
  if (typeof GM === 'undefined') return;
  const turn = GM.turn || 0;
  const isPostTurn = (typeof state !== 'undefined' && state._isPostTurn != null)
                     ? !!state._isPostTurn
                     : !!GM._isPostTurnCourt;
  const targetTurn = isPostTurn ? (turn + 1) : turn;

  // C5 准奏 → 进诏令追踪表
  if (action === 'approve' || action === 'modify' || action === 'decree') {
    if (!GM._edictTracker) GM._edictTracker = [];
    const decreeText = (action === 'modify') ? (extra || '改批方案') :
                       (action === 'decree') ? (extra && extra.text || '亲诏') :
                       (item.title + '：' + (item.detail || item.content || '').slice(0, 50));
    GM._edictTracker.push({
      id: 'cc3_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      content: decreeText,
      category: item.dept || '常朝',
      turn: turn, status: 'pending',
      assignee: item.presenter || '', feedback: '', progressPercent: 0,
      source: action === 'decree' ? 'changchao_decree' : 'changchao',
      decreeMark: action === 'decree' ? (extra && extra.tier) || 'B' : null
    });
    if (typeof addEB === 'function') addEB('常朝', label + '：' + (item.title || ''));
  }

  // C8 下廷议 → 加廷议待议册
  if (action === 'escalate') {
    if (!GM._pendingTinyiTopics) GM._pendingTinyiTopics = [];
    GM._pendingTinyiTopics.push({
      topic: (item.title || '常朝转入议题') + '：' + (item.detail || item.content || '').slice(0, 80),
      from: item.presenter || '常朝',
      turn: turn,
      _fromChaoyi: true
    });
  }

  // 留中 → 加留中册
  if (action === 'hold') {
    if (!GM._ccHeldItems) GM._ccHeldItems = [];
    GM._ccHeldItems.push({
      dept: item.dept || '', title: item.title || '', content: item.detail || item.content || '',
      type: item.type || 'routine', controversial: item.controversial || 3,
      heldAtTurn: turn
    });
  }

  // 发部议 → 加部议任务
  if (action === 'refer') {
    if (!GM.deptTasks) GM.deptTasks = [];
    GM.deptTasks.push({
      dept: extra || item.dept || '某部',
      task: item.title || '', detail: item.detail || item.content || '',
      assignedAtTurn: turn, dueIn: 3, status: 'pending',
      source: 'changchao_refer'
    });
  }

  // C3·驳奏 → 主奏者记忆
  if (action === 'reject' && item.presenter && typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
    try { NpcMemorySystem.remember(item.presenter, '常朝所奏「' + (item.title || '一事') + '」被驳回', '忧', 4, '陛下'); } catch (_) {}
  }

  // C3+C4·训诫 → NPC 记忆 + 关系
  if (action === 'admonish') {
    const tgt = extra || item.target || item.presenter;
    if (tgt) {
      try { if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) NpcMemorySystem.remember(tgt, '陛下当庭训诫·缘事「' + (item.title || '') + '」', '愤', 7, '陛下'); } catch (_) {}
      try { if (typeof OpinionSystem !== 'undefined' && OpinionSystem.addEventOpinion) OpinionSystem.addEventOpinion(tgt, '玩家', -8, '常朝训诫'); } catch (_) {}
      try {
        const ch = (typeof findCharByName === 'function') ? findCharByName(tgt) : null;
        if (ch && typeof ch.loyalty === 'number') ch.loyalty = Math.max(0, ch.loyalty - 5);
      } catch (_) {}
    }
  }

  // C3+C4·嘉奖 → NPC 记忆 + 关系
  if (action === 'praise') {
    const tgt = extra || item.presenter;
    if (tgt) {
      try { if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) NpcMemorySystem.remember(tgt, '陛下当庭嘉奖·缘事「' + (item.title || '') + '」', '喜', 7, '陛下'); } catch (_) {}
      try { if (typeof OpinionSystem !== 'undefined' && OpinionSystem.addEventOpinion) OpinionSystem.addEventOpinion(tgt, '玩家', 8, '常朝嘉奖'); } catch (_) {}
      try {
        const ch = (typeof findCharByName === 'function') ? findCharByName(tgt) : null;
        if (ch) {
          if (typeof ch.loyalty === 'number') ch.loyalty = Math.min(100, ch.loyalty + 4);
          if (typeof ch.fame === 'number') ch.fame = Math.min(100, ch.fame + 1);
        }
      } catch (_) {}
    }
  }

  // C3·普通议程 → 主奏者轻记一笔（采纳/未采纳）
  if (item.presenter && (action === 'approve' || action === 'reject') &&
      typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
    try {
      const emo = (action === 'approve') ? '喜' : '忧';
      NpcMemorySystem.remember(item.presenter, '常朝所奏「' + (item.title || '') + '」' + (action === 'approve' ? '被采纳' : '被驳'), emo, 3, '陛下');
    } catch (_) {}
  }

  // 频次计数
  if (!GM._chaoyiCount) GM._chaoyiCount = {};
  if (!GM._chaoyiCount[turn]) GM._chaoyiCount[turn] = 0;
  // 整场朝议算一次（在 _cc3_open 时已计·此处不重复）
}

// 议论阶段
async function runDebate() {
  const item = AGENDA[state.currentIdx];
  state.phase = 'debate';
  state.debateRound = 1;
  setPhase('【议 论】 第 1 轮', '百官辩难 · 陛下可即说');
  // 阶段标签状态
  const tag1 = $('cy-phase-tag'); tag1.classList.remove('strict', 'urgent');
  // 议论分隔（精致版）
  const main1 = $('cy-stage-main');
  const div1 = document.createElement('div');
  div1.className = 'round-divider';
  div1.textContent = '殿 中 议 论 · 第 一 轮';
  main1.appendChild(div1);
  main1.scrollTop = main1.scrollHeight;
  await delay(400);
  for (const npc of (item.debate || [])) {
    // AI 流式生成立场+台词·读其档案与他臣已表态
    await _cc3_streamReactBubble(npc, item, 'debate');
    await delay(280);
    // 玩家若已在间隙说过·让一名 NPC 立场化回应玩家（走完整 streaming 路径）
    if (state.pendingPlayerInput) {
      const t = state.pendingPlayerInput; state.pendingPlayerInput = null;
      addBubble({ kind: 'player', text: t });
      await delay(360);
      try { await npcRespondToPlayer(t, 1); } catch (_) {}
    }
    maybeAmbient(0.16);
  }
  showDebateActions();
}

function showDebateActions() {
  const calmBtn = state._chaosFired
    ? '<button class="cy-btn danger" onclick="calmChaos()">🔔 鸣磬肃静</button>'
    : '';
  setActions(`
    ${calmBtn}
    <button class="cy-btn primary" onclick="doAction('approve')">准 奏</button>
    <button class="cy-btn danger" onclick="doAction('reject')">驳 奏</button>
    <button class="cy-btn" onclick="doAction('hold')">留 中</button>
    <button class="cy-btn muted" onclick="toggleMorePopover()">⋯ 更多</button>
    <button class="cy-btn" onclick="anotherDebateRound()">▶ 续议一轮</button>
    <div class="cy-popover" id="more-popover">
      <button class="cy-popover-item" onclick="doMore('refer')">发部议 →</button>
      <button class="cy-popover-item" onclick="doMore('escalate')">下廷议</button>
      <button class="cy-popover-item" onclick="doMore('modify')">改批 →</button>
      <button class="cy-popover-item" onclick="doMore('probe')">追问 →</button>
      <div class="cy-popover-divider"></div>
      <button class="cy-popover-item" onclick="doMore('summon')">传召 →</button>
      <button class="cy-popover-item" onclick="doMore('admonish')">训诫 →</button>
      <button class="cy-popover-item" onclick="doMore('praise')">嘉奖 →</button>
    </div>
  `);
}

// ═══ 抗辩面板 ═══
async function runDissentFlow(action, item) {
  // 选定抗辩者：决断的反方
  const targetStance = (action === 'approve') ? 'oppose' : 'support';
  const candidates = collectByStance(item, targetStance, 1, item.presenter);
  if (candidates.length === 0) return false;
  const dissenter = candidates[0];

  const main = $('cy-stage-main');
  const panel = document.createElement('div');
  panel.className = 'dissent-panel';
  panel.innerHTML = '<div class="dissent-panel-title">━━ ' + escHtml(dissenter) + ' 出 列 严 辞 抗 辩 ━━</div>';
  main.appendChild(panel);
  main.scrollTop = main.scrollHeight;
  await delay(420);

  const argLines = action === 'approve' ? [
    '陛下！臣 ' + dissenter + ' 不敢苟同 · 此事关乎大体 · 若如此行 · 后必致祸 · 望陛下三思！',
    '陛下圣意虽明 · 然臣以为此举有未周之处 · 容臣冒死再陈！',
    '陛下三思！此议若行 · 则祖制有伤 · 民生有困 · 臣愿以死谏！'
  ] : [
    '陛下何以驳之？此事确为臣等再三斟酌 · 望陛下听臣等申辩！',
    '陛下！此驳臣实不敢领旨 · 容臣再陈一二！',
    '陛下！臣等所奏 · 实非妄言 · 望陛下听臣抗辩！'
  ];
  addBubble({ name: dissenter, stance: targetStance, text: argLines[Math.floor(Math.random() * argLines.length)] });
  await delay(500);

  state._dissentItem = item;
  state._dissentAction = action;
  state._dissentTarget = dissenter;
  setActions(`
    <button class="cy-btn" onclick="resolveDissent('listen')">🎤 听其抗辩</button>
    <button class="cy-btn primary" onclick="resolveDissent('override')">🛡️ 朕意已决</button>
    <button class="cy-btn danger" onclick="resolveDissent('reprimand')">⚡ 严斥</button>
  `);
  return 'wait';
}

window.resolveDissent = async function(choice) {
  const dissenter = state._dissentTarget;
  const item = state._dissentItem;
  const action = state._dissentAction;

  if (choice === 'listen') {
    addBubble({ kind: 'player', text: '卿但言之 · 朕听。' });
    await delay(380);
    addBubble({ name: dissenter, stance: 'oppose', text: '臣以为：此举不合祖制 · 又伤民生。「' + (item.title) + '」一事 · 若不慎议 · 后必有祸。臣愿以言官身份冒死再请陛下察之。' });
    await delay(600);
    setActions(`
      <button class="cy-btn primary" onclick="resolveDissentFinal('accept')">📝 从其议</button>
      <button class="cy-btn" onclick="resolveDissentFinal('hold_orig')">🛡️ 朕意已决</button>
    `);
    return;
  }
  if (choice === 'override') {
    addBubble({ kind: 'player', text: '朕意已决 · 卿不必再言。' });
    await delay(380);
    addBubble({ name: dissenter, stance: 'oppose', text: '臣······谨遵旨。（眼神低垂 · 退入班列。）' });
    addBubble({ kind: 'system', sysKind: 'warn', text: '（' + dissenter + ' 暗中怀恨 · loyalty -5 · 派系反弹 +2）' });
    await finishDissent();
    return;
  }
  if (choice === 'reprimand') {
    // 走严斥 5 outcome 流程
    await runActionReactions('admonish', item, dissenter);
    await finishDissent();
    return;
  }
};

window.resolveDissentFinal = async function(choice) {
  const dissenter = state._dissentTarget;
  const item = state._dissentItem;
  const action = state._dissentAction;

  if (choice === 'accept') {
    addBubble({ kind: 'player', text: '卿言有理 · 朕从之。' });
    await delay(380);
    addBubble({ name: dissenter, stance: 'support', text: '陛下纳谏从善 · 实为社稷之福！臣等敬服！' });
    addBubble({ kind: 'system', sysKind: 'success', text: '（陛下从谏如流 · 民心 +1 · 百官信服 +2 · 原决议改为「' + (action === 'approve' ? '驳' : '准') + '」。）' });
  } else {
    addBubble({ kind: 'player', text: '卿之言朕已闻 · 然朕意已决。' });
    await delay(380);
    addBubble({ name: dissenter, stance: 'oppose', text: '陛下······臣无言。（伏首良久 · 泪下沾襟。）' });
    addBubble({ kind: 'system', sysKind: 'warn', text: '（' + dissenter + ' 心灰意冷 · loyalty -3 · 言路阻塞 -1）' });
  }
  await finishDissent();
};

async function finishDissent() {
  // 完成抗辩·继续主流程到下一议程
  state._dissentItem = null;
  state._dissentTarget = null;
  state._dissentAction = null;
  await delay(380);
  state.decisions.push({ idx: state.currentIdx, action: 'approve', item: AGENDA[state.currentIdx], label: '准奏（含抗辩）' });
  state.currentIdx++;
  updateProgress();
  await delay(300);
  return runNextItem();
}

// ═══ 喧哗 / 鸣磬肃静 ═══
async function maybeFireChaos(item) {
  if (state._chaosFired) return false;
  if (state.debateRound < 2) return false;
  if (item.controversial < 8) return false;
  state._chaosFired = true;
  $('cy-stage').classList.add('chaos');
  addBubble({ kind: 'system', sysKind: 'warn', text: '（殿中喧哗 · 几人同声相应！声浪未歇。）' });
  await delay(450);
  addBubble({ kind: 'system', sysKind: 'warn', text: '（' + (item.target ? item.target + ' 与' : '') + '数员争辩不休 · 班次为之微乱。）' });
  await delay(380);
  return true;
}

window.calmChaos = async function() {
  if (!state._chaosFired) return;
  $('cy-stage').classList.remove('chaos');
  state._chaosFired = false;
  addBubble({ kind: 'system', sysKind: 'success', text: '（鸣磬肃静 · 百官噤声 · 朝堂复仪。）' });
  await delay(360);
  showDebateActions();
};

async function anotherDebateRound() {
  state.debateRound++;
  setPhase('【议 论】 第 ' + state.debateRound + ' 轮', '百官辩难继续 · 陛下可即说');
  // 议论分隔
  const mainR = $('cy-stage-main');
  const divR = document.createElement('div');
  divR.className = 'round-divider';
  const cnLabels = ['壹', '贰', '叁', '肆', '伍'];
  divR.textContent = '殿 中 议 论 · 第 ' + (cnLabels[state.debateRound - 1] || state.debateRound) + ' 轮';
  mainR.appendChild(divR);
  mainR.scrollTop = mainR.scrollHeight;
  const item = AGENDA[state.currentIdx];
  // 优先用预写 debate2（真新内容）·没有就回退到原数组首尾互换
  const round = item.debate2 || (item.debate || []).slice().reverse().slice(0, 3).map(d => ({
    name: d.name, stance: d.stance,
    line: '臣之意已具于前 · 伏惟圣裁。' + (d.stance === 'oppose' ? '不可不察。' : '不必再争。')
  }));
  for (const npc of round) {
    // AI 流式·二轮要"承上启下/折中/进展"·读他臣已有立场
    await _cc3_streamReactBubble(npc, item, 'debate2');
    await delay(280);
    if (state.pendingPlayerInput) {
      const t = state.pendingPlayerInput; state.pendingPlayerInput = null;
      addBubble({ kind: 'player', text: t });
      await delay(360);
      try { await npcRespondToPlayer(t, 1); } catch (_) {}
    }
    maybeAmbient(0.18);
  }
  // 二轮议论后·高争议议程触发喧哗
  await maybeFireChaos(item);
  showDebateActions();
}

// 收尾
async function runClosing() {
  state.phase = 'closing';
  // 清阶段标签状态
  const tag = $('cy-phase-tag'); tag.classList.remove('strict', 'urgent');
  setPhase('【退 朝】', '卷帘退朝 · 鸣鞭');
  setActions('<span style="color:var(--ink-500);font-size:12px;">朝会即散……</span>');
  await delay(400);
  addBubble({ kind: 'system', sysKind: 'ceremony', text: '〔 百 官 奏 事 已 毕 〕' });
  await delay(600);
  addBubble({ kind: 'system', text: '（陛下整衣 · 起身。百官伏首恭送。）' });
  await delay(700);
  // 退朝鸣鞭（视觉化）
  const main = $('cy-stage-main');
  const bell = document.createElement('div');
  bell.className = 'bell-ring';
  bell.innerHTML = '<span style="font-size:22px;">铮</span><span style="font-size:22px;">铮</span>';
  main.appendChild(bell);
  main.scrollTop = main.scrollHeight;
  await delay(1400);
  addBubble({ kind: 'system', sysKind: 'ceremony', text: '〔 鸣 鞭 · 卷 帘 退 朝 〕' });
  await delay(700);
  state.done = true;
  // P0 C6·朝会决议持久化到 GM._courtRecords
  _cc3_persistCourtRecord();
  // P0 后朝结束钩子
  if (typeof GM !== 'undefined' && GM._isPostTurnCourt && typeof _onPostTurnCourtEnd === 'function') {
    try { _onPostTurnCourtEnd(); } catch (_) {}
  }
  showSummary();
}

/** C6·朝会快照写入 GM._courtRecords（AI 推演读"上回合圣意"靠它）
 *  现在包含：transcript 对话原文 / stances 真实立场聚合 / decisions 完整动作 / extras 玩家修改
 */
function _cc3_persistCourtRecord() {
  if (typeof GM === 'undefined') return;
  if (!GM._courtRecords) GM._courtRecords = [];
  const turn = GM.turn || 0;
  const isPostTurn = (typeof state !== 'undefined' && state._isPostTurn != null)
                     ? !!state._isPostTurn
                     : !!GM._isPostTurnCourt;

  // ── 聚合 NPC 真实立场（从 AGENDA.selfReact + debate + debate2 + transcript NPC 发言收集） ──
  const stances = {}; // { name: { stance, brief } }
  const collectStance = function(arr) {
    if (!Array.isArray(arr)) return;
    arr.forEach(function(r) {
      if (!r || !r.name || !r.line) return;
      // 后写覆盖前写·debate2 优先·体现立场演化最终态
      stances[r.name] = { stance: r.stance || 'neutral', brief: String(r.line).slice(0, 80) };
    });
  };
  AGENDA.forEach(function(it) {
    collectStance(it.selfReact);
    collectStance(it.debate);
    collectStance(it.debate2);
  });
  // 从 transcript 补足（玩家应答中 NPC 也表过态）
  (state._transcript || []).forEach(function(t) {
    if (t.role === 'npc' && t.speaker && !stances[t.speaker]) {
      stances[t.speaker] = { stance: t.stance || 'neutral', brief: String(t.text).slice(0, 80) };
    }
  });

  // ── adopted/decisions·包含玩家修改 / 追问 / 改批的具体内容 ──
  const adopted = state.decisions
    .filter(d => d.action === 'approve' || d.action === 'modify' || d.action === 'decree')
    .map(d => {
      let content = d.item.title + '：' + String(d.item.detail || d.item.content || '').slice(0, 100);
      if (d.action === 'modify' && d.extra) content += '【玩家改批】' + String(d.extra).slice(0, 150);
      if (d.action === 'decree' && d.extra) content += '【当庭口诏】' + (typeof d.extra === 'object' ? (d.extra.text || JSON.stringify(d.extra)) : String(d.extra)).slice(0, 150);
      return { author: d.item.presenter, content: content, stance: 'support' };
    });

  const decisionsFull = state.decisions.map(d => ({
    title: d.item.title,
    action: d.action,
    presenter: d.item.presenter,
    dept: d.item.dept || '',
    label: d.label,
    extra: d.extra ? (typeof d.extra === 'object' ? JSON.stringify(d.extra).slice(0, 200) : String(d.extra).slice(0, 200)) : ''
  }));

  // ── transcript 摘要·只保留 player + npc·过滤系统·上限 60 条防爆 endturn prompt ──
  const transcript = (state._transcript || [])
    .filter(t => t.role === 'player' || t.role === 'npc')
    .slice(-60)
    .map(t => ({ role: t.role, speaker: t.speaker, text: t.text, stance: t.stance || '', agendaIdx: t.agendaIdx }));

  const record = {
    turn: turn,
    targetTurn: isPostTurn ? (turn + 1) : turn,
    phase: isPostTurn ? 'post-turn' : 'in-turn',
    topic: state.decisions.length > 0 ? '常朝·' + state.decisions.length + ' 议（' + state.decisions.map(d => (d.label || d.action)).slice(0, 3).join('·') + '...）' : '空朝',
    mode: 'changchao',
    participants: state.attendees.slice(),
    stances: stances,
    adopted: adopted,
    decisions: decisionsFull,
    transcript: transcript,
    dismissed: state.decisions.length === 0,
    _secret: false,
    _v3: true
  };
  GM._courtRecords.push(record);
  if (GM._courtRecords.length > 8) GM._courtRecords.shift();
  // 计入 _lastChangchaoDecisions（含 extra·让 endturn 读到玩家改批/口诏）
  GM._lastChangchaoDecisions = state.decisions.map(d => ({
    action: d.action,
    title: d.item.title,
    dept: d.item.dept || '',
    extra: d.extra ? (typeof d.extra === 'object' ? (d.extra.text || JSON.stringify(d.extra)) : String(d.extra)).slice(0, 150) : ''
  }));

  // ── 写起居注 (qijuHistory)·让 纪事 标签页能看到本次朝议 ──
  if (Array.isArray(GM.qijuHistory)) {
    const counts = { approve: 0, reject: 0, hold: 0, modify: 0, refer: 0, escalate: 0, decree: 0, summon: 0, admonish: 0, praise: 0, probe: 0 };
    state.decisions.forEach(d => { if (counts[d.action] != null) counts[d.action]++; });
    const cnArr = [];
    if (counts.approve) cnArr.push('准 ' + counts.approve);
    if (counts.reject)  cnArr.push('驳 ' + counts.reject);
    if (counts.modify)  cnArr.push('改批 ' + counts.modify);
    if (counts.hold)    cnArr.push('留中 ' + counts.hold);
    if (counts.escalate) cnArr.push('转廷议 ' + counts.escalate);
    if (counts.decree)   cnArr.push('当庭口诏 ' + counts.decree);
    const chaoLabel = isPostTurn ? '朔朝' : '常朝';
    const date = (typeof getTSText === 'function') ? getTSText(turn) : ('T' + turn);
    let qjContent = '【' + chaoLabel + '】共议 ' + state.decisions.length + ' 事·' + (cnArr.length ? cnArr.join('·') : '皆无定论');
    // 附 1-3 个具体议题标题
    if (state.decisions.length > 0) {
      const titles = state.decisions.slice(0, 3).map(d => d.item.title).join('、');
      qjContent += '。议：' + titles + (state.decisions.length > 3 ? '等' : '');
    }
    GM.qijuHistory.unshift({ turn: turn, date: date, content: qjContent });
  }

  // ── 重大决议（modify / decree / 高重要性 confrontation）写入编年长期项 ──
  if (Array.isArray(GM.biannianItems)) {
    state.decisions.forEach(d => {
      const isMajor = d.action === 'modify' || d.action === 'decree' ||
                      (d.action === 'approve' && d.item.importance >= 7) ||
                      (d.action === 'reject' && d.item.importance >= 7);
      if (!isMajor) return;
      const date = (typeof getTSText === 'function') ? getTSText(turn) : ('T' + turn);
      const content = (d.label || d.action) + ': ' + d.item.title +
                      (d.extra ? '·' + (typeof d.extra === 'object' ? (d.extra.text || '') : String(d.extra)).slice(0, 100) : '');
      GM.biannianItems.push({
        startTurn: turn,
        turn: turn,
        title: '【' + (isPostTurn ? '朔朝' : '常朝') + '】' + d.item.title,
        date: date,
        content: content,
        category: d.item.type || 'routine',
        _source: 'chaoyi-v3',
        _resolved: false
      });
    });
  }

  // ── 长期落实型决议·挂入 ChronicleTracker·进"纪事"标签页 + AI 推演每回合可见 ──
  // 与廷议同一机制·但只针对 approve/modify/decree 三类被实际推行的决议
  // 关键词覆盖常朝可能涉及的长期工程：
  try {
    const _CC_LONG_KW = /清查|屯田|开海|变法|赈|修河|河漕|塞外|边备|科举|盐法|盐课|盐运|茶法|茶马|钱法|榷|督师|经略|募兵|裁汰|察吏|京察|大计|封贡|和亲|筑城|营造|开矿|铸钱|抚|平定|教化|兴学|兴修|疏浚|徭役|垦荒|镇抚|征讨|经营|工程|赈灾|修缮|减赋|蠲免/;
    if (typeof ChronicleTracker !== 'undefined' && ChronicleTracker.upsert) {
      const chaoLbl = isPostTurn ? '朔朝' : '常朝';
      state.decisions.forEach(d => {
        // 仅 approve/modify/decree 推行类·驳回/留中/转部议不挂
        if (!['approve', 'modify', 'decree'].includes(d.action)) return;
        const ttl = d.item && d.item.title || '';
        const ctn = d.item && (d.item.content || d.item.detail) || '';
        const extraText = d.extra ? (typeof d.extra === 'object' ? (d.extra.text || '') : String(d.extra)) : '';
        const combined = ttl + '·' + ctn + '·' + extraText;
        if (!_CC_LONG_KW.test(combined)) return;
        const trackTitle = ttl.length > 24 ? ttl.slice(0, 22) + '…' : ttl;
        const trackId = 'cc_' + chaoLbl + '_' + turn + '_' + ttl.slice(0, 6).replace(/\s/g, '');
        // 估完工回合·调用 ChronicleTracker.estimateExpectedTurns 按 daysPerTurn 自动换算
        let subkindCC = '默认';
        if (/变法/.test(combined)) subkindCC = '变法';
        else if (/边事|塞外|经略|督师/.test(combined)) subkindCC = '边事';
        else if (/工程|筑城|营造|河漕|修河/.test(combined)) subkindCC = '工程';
        else if (/赈|抚|蠲免|减赋/.test(combined)) subkindCC = '赈抚';
        let expectedTurns = (typeof ChronicleTracker !== 'undefined' && ChronicleTracker.estimateExpectedTurns)
          ? ChronicleTracker.estimateExpectedTurns({ kind: '常朝', subkind: subkindCC, difficulty: d.action === 'modify' ? 'high' : 'medium' })
          : 8;
        let _profileC = (typeof ChronicleTracker !== 'undefined' && ChronicleTracker.estimateEffectProfile)
          ? ChronicleTracker.estimateEffectProfile({ kind: '常朝', subkind: subkindCC })
          : null;
        const stakeholders = [];
        if (d.item && d.item.presenter) stakeholders.push(d.item.presenter);
        if (d.item && d.item.dept) stakeholders.push(d.item.dept);
        ChronicleTracker.upsert({
          id: trackId,
          type: 'changchao_pending',
          category: chaoLbl + '待落实',
          title: trackTitle,
          narrative: '〔' + chaoLbl + '·' + (d.label || d.action) + '〕' + (ctn || ttl).slice(0, 80) + (extraText ? '\n〔朱批〕' + extraText.slice(0, 80) : ''),
          actor: (d.item && d.item.presenter) || '',
          stakeholders: stakeholders,
          startTurn: turn,
          expectedEndTurn: turn + expectedTurns,
          currentStage: '颁诏起手',
          progress: 5,
          priority: d.action === 'modify' ? 'high' : (d.item && d.item.importance >= 7 ? 'high' : 'medium'),
          sourceType: 'changchao',
          sourceId: trackId,
          status: 'active',
          // 效果模型·短期 vs 长期张力 + 玩家可终结
          perTurnEffect: _profileC && _profileC.perTurnEffect,
          finalEffect: _profileC && _profileC.finalEffect,
          shortTermBalance: _profileC && _profileC.shortTermBalance,
          longTermBalance: _profileC && _profileC.longTermBalance,
          terminable: _profileC ? _profileC.terminable : true,
          terminationCost: _profileC && _profileC.terminationCost
        });
      });
    }
  } catch(_ccTrackE) { try{ window.TM&&TM.errors&&TM.errors.captureSilent(_ccTrackE,'cc3·ChronicleTrack'); }catch(_){} }

  // 后朝勤政度
  if (typeof recordCourtHeld === 'function') {
    try { recordCourtHeld({ isPostTurn: isPostTurn, source: 'v3' }); } catch (_) {}
  }
  // G 类·记录各衙门缺席
  try { _cc3_recordDeptAbsence(); } catch (_) {}

  // ── 写入 NPC 个人记忆（NpcMemorySystem.remember）·让 NPC 跨回合记得自己说过/听过什么 ──
  if (typeof NpcMemorySystem !== 'undefined' && typeof NpcMemorySystem.remember === 'function') {
    const chaoLabel = isPostTurn ? '朔朝' : '常朝';
    // 1) 每个有立场表态的 NPC·记其立场
    Object.keys(stances).forEach(function(name) {
      const s = stances[name];
      if (!s || !s.brief) return;
      const text = chaoLabel + '议·' + (s.stance === 'support' ? '我赞同' : s.stance === 'oppose' ? '我反对' : s.stance === 'mediate' ? '我折中' : '我陈见') +
                   '：' + s.brief.slice(0, 60);
      const emo = s.stance === 'support' ? '安' : s.stance === 'oppose' ? '不平' : '思';
      const wt  = s.stance === 'oppose' ? 6 : 4;
      try { NpcMemorySystem.remember(name, text, emo, wt, '朝议'); } catch (_) {}
    });
    // 2) 每个被玩家训诫/嘉奖的 NPC·记忆深刻
    state.decisions.forEach(function(d) {
      if (d.action === 'admonish' || d.action === 'praise' || d.action === 'summon') {
        const tgt = (d.extra && typeof d.extra === 'string') ? d.extra : (d.item && d.item.target) || '';
        if (!tgt) return;
        const text = chaoLabel + '·陛下' + (d.action === 'admonish' ? '当庭训诫' : d.action === 'praise' ? '当庭嘉奖' : '召我入殿') + '：' + (d.item.title || '');
        const emo = d.action === 'admonish' ? '惧/愤' : d.action === 'praise' ? '荣' : '惶';
        const wt  = d.action === 'admonish' ? 9 : d.action === 'praise' ? 7 : 5;
        try { NpcMemorySystem.remember(tgt, text, emo, wt, '朝议'); } catch (_) {}
      }
    });
    // 3) 主奏者·记其奏疏被如何处理（准/驳/改/留中等）
    state.decisions.forEach(function(d) {
      const presenter = d.item && d.item.presenter;
      if (!presenter) return;
      const fateMap = {
        approve: '我所奏获准·当推行', reject: '我所奏被驳·心有不平', hold: '我所奏被留中·悬置未决',
        modify: '我所奏被陛下改批·需按新方案行', refer: '我所奏转部议·待回奏', escalate: '我所奏下廷议',
        probe: '陛下追问我此奏·须详陈', decree: '此事陛下另发口诏', skip: '我所奏未及讨论'
      };
      const text = chaoLabel + '·' + (fateMap[d.action] || ('裁决:' + d.action)) + '：' + (d.item.title || '') +
                   (d.extra ? '·' + String(d.extra).slice(0, 50) : '');
      const emo = (d.action === 'approve' || d.action === 'praise') ? '喜' :
                  (d.action === 'reject' || d.action === 'admonish') ? '忧' : '思';
      const wt = (d.action === 'reject' || d.action === 'modify') ? 7 : 5;
      try { NpcMemorySystem.remember(presenter, text, emo, wt, '朝议'); } catch (_) {}
    });
  }

  console.log('[cc3·persist] 朝议已记入 _courtRecords (转录 ' + transcript.length + ' 条·立场 ' + Object.keys(stances).length + ' 人) + qijuHistory + biannianItems + NpcMemory');
}

function showSummary() {
  const skipPref = (function(){ try { return localStorage.getItem('tm.chaoyi.skipSummary') === '1'; } catch(_) { return false; } })();
  if (skipPref) {
    // 直接关闭朝会·不弹总结
    addBubble({ kind: 'system', text: '（朝会已散 · 总结已隐 · 可在设置中重新启用。）' });
    return;
  }
  // 按 action 分类·v2 借鉴的 tally 形式
  const counts = { approve: 0, reject: 0, hold: 0, skip: 0, refer: 0, escalate: 0, modify: 0, probe: 0, summon: 0, admonish: 0, praise: 0, decree: 0 };
  state.decisions.forEach(d => { if (counts[d.action] != null) counts[d.action]++; });
  // 议程内容简表
  let agendaList = '';
  state.decisions.forEach((d, i) => {
    const labelMap = { approve: '准', reject: '驳', hold: '留', skip: '免', refer: '部议', escalate: '廷议', modify: '改', probe: '问', summon: '召', admonish: '诫', praise: '奖', decree: '诏' };
    const colorMap = { approve: 'celadon-400', reject: 'vermillion-300', hold: 'gold-400', skip: 'ink-500', escalate: 'amber-400', refer: 'amber-400', modify: 'gold-300', probe: 'ink-500', summon: 'celadon-400', admonish: 'vermillion-300', praise: 'celadon-400', decree: 'gold-300' };
    const lbl = labelMap[d.action] || d.action;
    const col = colorMap[d.action] || 'ink-500';
    agendaList += `<div style="display:flex;justify-content:space-between;font-size:12px;line-height:1.9;padding:2px 0;border-bottom:1px dashed var(--border-subtle);">
      <span style="color:var(--ink-500);">${i + 1}. ${escHtml(d.item.title || '?')}</span>
      <span style="color:var(--${col});font-family:var(--font-serif);">${lbl}</span>
    </div>`;
  });

  // 主 tally line（v2 风格：准N 驳N 议N 留N）
  const tallyLine = `
    <div style="text-align:center;font-family:var(--font-serif);letter-spacing:0.18em;font-size:14px;margin-bottom:10px;">
      <span class="tally-pill tally-approve">准 ${counts.approve}</span>
      <span class="tally-pill tally-reject">驳 ${counts.reject}</span>
      <span class="tally-pill tally-hold">留 ${counts.hold}</span>
      ${counts.escalate ? `<span class="tally-pill tally-other">廷议 ${counts.escalate}</span>` : ''}
      ${counts.refer ? `<span class="tally-pill tally-other">部议 ${counts.refer}</span>` : ''}
      ${counts.skip ? `<span class="tally-pill tally-other">免 ${counts.skip}</span>` : ''}
    </div>
    ${(counts.admonish || counts.praise || counts.decree || counts.modify) ? `
    <div style="text-align:center;font-size:11px;color:var(--ink-500);margin:8px 0;letter-spacing:0.15em;">
      ${counts.modify ? `改批 ${counts.modify} · ` : ''}
      ${counts.admonish ? `训诫 ${counts.admonish} · ` : ''}
      ${counts.praise ? `嘉奖 ${counts.praise} · ` : ''}
      ${counts.decree ? `亲诏 ${counts.decree}` : ''}
    </div>` : ''}
  `;

  if (state.decisions.length === 0) {
    agendaList = '<div style="color:var(--ink-500);text-align:center;padding:14px;">本朝未议任何议程。</div>';
  }

  const card = document.createElement('div');
  card.className = 'cy-summary-mask';
  card.innerHTML = `
    <div class="cy-summary-card">
      <h2>〔 朝 会 已 散 〕</h2>
      <div class="cy-summary-tally">
        ${tallyLine}
        <div style="margin-top:6px;">${agendaList}</div>
      </div>
      <div class="skip-row"><label><input type="checkbox" id="skip-summary-cb"> 下次不再弹此总结（可在设置改回）</label></div>
      <div class="actions">
        <button class="cy-btn" onclick="closeSummary(false)">关闭</button>
        <button class="cy-btn primary" onclick="closeSummary(true)">详记入起居注</button>
      </div>
    </div>
  `;
  $('cy-stage').appendChild(card);
}

window.closeSummary = function(detailed) {
  const cb = $('skip-summary-cb');
  if (cb && cb.checked) {
    try { localStorage.setItem('tm.chaoyi.skipSummary', '1'); } catch(_){}
  }
  const m = document.querySelector('.cy-summary-mask');
  if (m) m.remove();
  if (detailed) addBubble({ kind: 'system', text: '（详记入起居注。）' });
};

// ═══════════════════════════════════════════════
// 更多菜单·二级输入
// ═══════════════════════════════════════════════
function doMore(action) {
  const pop = $('more-popover'); if (pop) pop.classList.remove('show');
  const item = AGENDA[state.currentIdx];
  if (action === 'refer') {
    showInputModal({
      title: '发部议',
      hint: '选定承议衙门 · N 回合后该部主官回奏',
      kind: 'select',
      options: (typeof _cc3_getScenarioConfig === 'function' ? _cc3_getScenarioConfig().deptOptions : ['户部', '吏部', '兵部', '礼部', '刑部', '工部', '都察院']),
      submit: (v) => finalizeAction('refer', v)
    });
  } else if (action === 'escalate') {
    finalizeAction('escalate');
  } else if (action === 'modify') {
    showInputModal({
      title: '改批 · 玩家口述方案',
      hint: '陛下口述新方案 · 替代原奏 · 进诏令追踪',
      kind: 'textarea',
      placeholder: '朕意如此：……',
      submit: (v) => finalizeAction('modify', v || '〔玩家口述方案〕')
    });
  } else if (action === 'probe') {
    showInputModal({
      title: '追问 · 问奏报者细节',
      hint: '陛下追问 · 奏报者将详陈一段',
      kind: 'textarea',
      placeholder: '细言之 / 此款几何 / ……',
      submit: (v) => finalizeAction('probe', v || '细言之。')
    });
  } else if (action === 'summon') {
    const pool = _cc3_buildSummonablePool();
    if (pool.length === 0) { alert('当前无可传召之人。'); return; }
    // 风险低者排前·让玩家先看到正常选项
    pool.sort((a, b) => a.risk - b.risk || a.name.localeCompare(b.name));
    showInputModal({
      title: '传召 · 召入殿',
      hint: '正常缺朝即至·破格召后宫/宗室/学子则言官必弹·或成新议',
      kind: 'select',
      options: pool.map(p => ({ value: p.name, label: p.displayLabel })),
      submit: (v) => finalizeAction('summon', v)
    });
  } else if (action === 'admonish' || action === 'praise') {
    showInputModal({
      title: action === 'admonish' ? '训诫 · 当庭训某官' : '嘉奖 · 当庭赏某官',
      hint: action === 'admonish' ? 'loyalty -2 · 派系记仇 +1' : 'loyalty +3 · 名望 +1',
      kind: 'select',
      options: state.attendees,
      submit: (v) => finalizeAction(action, v)
    });
  }
}

function showInputModal(opts) {
  const m = document.createElement('div');
  m.className = 'cy-input-modal';
  let inputHtml = '';
  if (opts.kind === 'textarea') {
    inputHtml = `<textarea id="modal-input" placeholder="${escHtml(opts.placeholder||'')}" rows="3"></textarea>`;
  } else if (opts.kind === 'select') {
    // 选项支持 string 或 {value, label} — 后者用于显示带分类标签的人名
    inputHtml = `<select id="modal-input">${(opts.options||[]).map(o => {
      if (o && typeof o === 'object') {
        return `<option value="${escHtml(o.value)}">${escHtml(o.label || o.value)}</option>`;
      }
      return `<option value="${escHtml(o)}">${escHtml(o)}</option>`;
    }).join('')}</select>`;
  } else {
    inputHtml = `<input id="modal-input" type="text" placeholder="${escHtml(opts.placeholder||'')}" />`;
  }
  m.innerHTML = `
    <div class="cy-input-modal-card">
      <h3>${escHtml(opts.title)}</h3>
      <div class="hint">${escHtml(opts.hint||'')}</div>
      ${inputHtml}
      <div class="row">
        <button class="cy-btn muted" id="modal-cancel">取消</button>
        <button class="cy-btn primary" id="modal-ok">确定</button>
      </div>
    </div>
  `;
  $('cy-stage').appendChild(m);
  setTimeout(() => $('modal-input').focus(), 50);
  $('modal-cancel').onclick = () => m.remove();
  $('modal-ok').onclick = () => {
    const v = $('modal-input').value;
    m.remove();
    if (opts.submit) opts.submit(v);
  };
}

// ═══════════════════════════════════════════════
// 金口·四项工具
// ═══════════════════════════════════════════════
function showJinkouPopover() {
  const existing = document.querySelector('.cy-popover.jinkou');
  if (existing) { existing.remove(); return; }
  const tier = computeDecreeTier();
  const pop = document.createElement('div');
  pop.className = 'cy-popover show jinkou';
  pop.style.bottom = '60px';
  pop.style.right = '12px';
  pop.style.left = 'auto';
  pop.innerHTML = `
    <button class="cy-popover-item" onclick="doJinkou('inquire')">🗣 训问 X 卿 <span class="hint">问任意在场官员立场</span></button>
    <button class="cy-popover-item" onclick="doJinkou('reassign')">👤 指 Y 主奏 <span class="hint">绕开本部尚书</span></button>
    <button class="cy-popover-item" onclick="doJinkou('private')">🤫 私下示意 Z <span class="hint">朝散后入御前问对队列</span></button>
    <div class="cy-popover-divider"></div>
    <button class="cy-popover-item" onclick="doJinkou('decree')">📜 当庭口述诏令 <span class="hint">按皇威皇权效果不同</span></button>
    <div class="tier-preview tier-${tier.code}">
      <div><strong>当前预测 · ${tier.name}</strong></div>
      <div>皇威 ${state.prestige} · 皇权 ${state.power}</div>
      <div style="margin-top:3px;">${tier.desc}</div>
    </div>
  `;
  $('cy-stage').appendChild(pop);
}

function computeDecreeTier() {
  const w = state.prestige, p = state.power;
  if (w >= 70 && p >= 70) return {
    code: 'S', name: '圣旨煌煌',
    desc: '百官山呼遵旨·诏令全效。皇威+1 名望+1。'
  };
  if (w < 30 || p < 30) return {
    code: 'D', name: '危诏激变',
    desc: '当庭抗议跪谏·诏令 blocked。皇威-3 权威-2 派系叛意+。'
  };
  if (w < 50 && p < 50) return {
    code: 'D', name: '诏不下殿',
    desc: '言官即奏封驳·诏令打 50% 折或转廷议。皇权-1。'
  };
  if (w < 50 && p >= 50) return {
    code: 'C', name: '众议汹汹',
    desc: '派系联合抗辩·诏令全效但民心-2·暴名+1。'
  };
  if (w >= 70 || p >= 70) return {
    code: 'A', name: '凛然奉旨',
    desc: '百官面色凝重·默奉旨。诏令全效。反对派 loyalty -1。'
  };
  return {
    code: 'B', name: '勉强尊行',
    desc: '诏令奉行·派系内部记仇·loyalty 略降。'
  };
}

function doJinkou(kind) {
  const pop = document.querySelector('.cy-popover.jinkou');
  if (pop) pop.remove();
  if (kind === 'inquire') {
    showInputModal({
      title: '训问 · X 卿以为如何',
      hint: '选定在场官员 · 该官将立场化回应',
      kind: 'select',
      options: state.attendees,
      submit: (v) => {
        const t = '卿 ' + v + ' · 以为如何？';
        addBubble({ kind: 'player', text: t });
        // 走流式 AI 应答（v 已在文本中·findMentionedChars 会识别为定向回应）
        setTimeout(() => { try { npcRespondToPlayer(t, 1); } catch (_) {} }, 400);
      }
    });
  } else if (kind === 'reassign') {
    showInputModal({
      title: '指定主奏 · 绕开本部尚书',
      hint: '选定本部其他官员重述',
      kind: 'select',
      options: state.attendees,
      submit: (v) => addBubble({ kind: 'system', text: '（' + v + ' 出班 · 替代主奏。）' })
    });
  } else if (kind === 'private') {
    showInputModal({
      title: '私下示意 Z · 朝散后入御前',
      hint: '不当庭奏对·朝散后 Z 单独入御前问对队列',
      kind: 'select',
      options: state.attendees,
      submit: (v) => addBubble({ kind: 'system', text: '（陛下以目示意 ' + v + ' · ' + v + ' 微微颔首。朝散后入御前问对队列。）' })
    });
  } else if (kind === 'decree') {
    const tier = computeDecreeTier();
    showInputModal({
      title: '当庭口述诏令 · ' + tier.name,
      hint: '档位预测：' + tier.desc + ' (后果由 AI 推演定 · 此为提示)',
      kind: 'textarea',
      placeholder: '制曰：……',
      submit: (v) => finalizeAction('decree', { text: v || '〔陛下口述诏令〕', tier: tier.code })
    });
  }
}

// ═══════════════════════════════════════════════
// 动作连锁反应·按 action + 立场层级触发多 NPC 反应
// ═══════════════════════════════════════════════
function collectByStance(item, targetStance, maxCount, exclude) {
  const result = []; const seen = new Set();
  if (exclude) seen.add(exclude);
  // 优先取 debate（有显式立场）
  (item.debate || []).forEach(d => {
    if (d.stance === targetStance && !seen.has(d.name) && CHARS[d.name] && !CHARS[d.name].absent) {
      result.push(d.name); seen.add(d.name);
    }
  });
  // 次选 selfReact
  (item.selfReact || []).forEach(d => {
    if (d.stance === targetStance && !seen.has(d.name) && CHARS[d.name] && !CHARS[d.name].absent) {
      result.push(d.name); seen.add(d.name);
    }
  });
  return result.slice(0, maxCount);
}
function pickLine(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const PRESENTER_AFTER_APPROVE = [
  '臣谢陛下圣裁！臣即办去 · 三日内回奏进展。',
  '陛下圣明 · 臣谨领旨。臣不敢有负圣望。',
  '臣叩首谢恩 · 必竭股肱之力。',
  '陛下既准 · 臣即下文督办 · 不日即见效。'
];
const SUPPORTER_AFTER_APPROVE = [
  '陛下圣明！臣等附议·此乃国之大幸。',
  '陛下睿断·此举固本固民·臣等敬服。',
  '陛下高瞻远瞩·臣愿副 {presenter} 督办。',
  '陛下既决·臣亦愿献绵薄之力。'
];
const OPPOSER_AFTER_APPROVE = [
  '陛下既决·臣谨遵旨·然望陛下后续监察。',
  '臣······虽有未尽之言·谨奉圣意。',
  '陛下圣明·臣不敢再争·然望陛下慎之又慎。',
  '臣以言官身份谨陈：望陛下察其行 · 不徒受其文。'
];

const PRESENTER_AFTER_REJECT = [
  '臣······谨遵圣意·然此事容臣再思一二。',
  '陛下既不准·臣······退而再议。',
  '臣愚见难合圣意·谨退·心中不安。',
  '臣······惶恐 · 谨遵陛下圣意。'
];
const OPPOSER_AFTER_REJECT = [  // 反对原议者·驳奏正合心意
  '陛下圣裁！臣谓此事正不可行·陛下明察。',
  '陛下明察秋毫·臣等敬服。',
  '此驳得当·实乃国之幸·臣 {who} 喜出望外。',
  '陛下既驳·诸臣可释虑矣。'
];
const SUPPORTER_AFTER_REJECT = [  // 支持原议者·驳奏失望
  '陛下三思！此事关乎黎庶·若不行·恐有后患。',
  '臣 {who} 以言官身份谨陈·此驳恐有未察。',
  '陛下既驳·然臣······终是不安。',
  '陛下圣意如此·臣等无言·然心中······',
  '陛下！臣愿伏阙再请·此事实不可缓！'
];
const NEUTRAL_AFTER_HOLD = [
  '陛下既留·臣等且候。',
  '臣随圣意·不敢催促。',
  '此事兹事体大·留议亦是稳重之策。'
];
const URGENT_AFTER_HOLD = [
  '陛下！此事不可久延·望陛下早决。',
  '陛下三思·此事压一日·则民苦一日。',
  '臣······惶恐·然此事确不可缓。'
];

async function runActionReactions(action, item, extra) {
  const presenter = item.presenter;
  // ─── 准奏 ───
  if (action === 'approve') {
    addBubble({ name: presenter, text: pickLine(PRESENTER_AFTER_APPROVE) });
    await delay(420);
    const supporters = collectByStance(item, 'support', 2, presenter);
    for (const s of supporters) {
      addBubble({ name: s, stance: 'support', text: pickLine(SUPPORTER_AFTER_APPROVE).replace('{presenter}', presenter) });
      await delay(380);
    }
    maybeAmbient(0.35);
    const opposers = collectByStance(item, 'oppose', 1, presenter);
    for (const o of opposers) {
      addBubble({ name: o, stance: 'oppose', text: pickLine(OPPOSER_AFTER_APPROVE) });
      await delay(380);
    }
    addBubble({ kind: 'system', text: '（议题进诏令追踪表 · ' + presenter + ' 限 ' + (item.urgency === 'urgent' ? '3' : '7') + ' 日内回报。' + (item.controversial > 6 ? ' 反对派记一笔。' : '') + '）' });
    return;
  }
  // ─── 驳奏 ───
  if (action === 'reject') {
    addBubble({ name: presenter, text: pickLine(PRESENTER_AFTER_REJECT) });
    await delay(420);
    // 反对原议者振奋（但若主奏者本身就是关键反对·此处可能为空）
    const opposers = collectByStance(item, 'oppose', 1, presenter);
    for (const o of opposers) {
      addBubble({ name: o, stance: 'oppose', text: pickLine(OPPOSER_AFTER_REJECT).replace('{who}', o) });
      await delay(380);
    }
    maybeAmbient(0.4);
    // 支持原议者失望/再谏
    const supporters = collectByStance(item, 'support', 2, presenter);
    for (const s of supporters) {
      addBubble({ name: s, stance: 'support', text: pickLine(SUPPORTER_AFTER_REJECT).replace('{who}', s) });
      await delay(420);
    }
    addBubble({ kind: 'system', text: '（' + presenter + ' loyalty -1 · 记入此次心意未达。' + (item.controversial > 6 ? ' 派系反弹未息。' : '') + '）' });
    return;
  }
  // ─── 留中 ───
  if (action === 'hold') {
    const isUrgent = item.urgency === 'urgent' || item.importance >= 8;
    addBubble({ name: presenter, text: isUrgent ? pickLine(URGENT_AFTER_HOLD) : pickLine(NEUTRAL_AFTER_HOLD) });
    await delay(380);
    // 殿中各派各表态（取 1 支持 + 1 反对·或 2 中立）
    const supporters = collectByStance(item, 'support', 1, presenter);
    const opposers = collectByStance(item, 'oppose', 1, presenter);
    for (const s of supporters) {
      addBubble({ name: s, stance: 'support', text: '陛下久不决·恐误时机。臣愿再陈······' });
      await delay(360);
    }
    for (const o of opposers) {
      addBubble({ name: o, stance: 'oppose', text: '陛下从容圣裁·臣谓此事正可缓议。' });
      await delay(360);
    }
    maybeAmbient(0.4);
    addBubble({ kind: 'system', text: '（此事入留中册·下次朝议或再现。' + (isUrgent ? '紧急事项不可久延·朝堂记一笔焦虑。' : '') + '）' });
    return;
  }
  // ─── 发部议 ───
  if (action === 'refer') {
    addBubble({ name: presenter, text: '臣谨遵旨·将本案移交 ' + (extra || '某部') + ' 详议·伏候回奏。' });
    await delay(380);
    // 该部主官发声（如是别部则附议·本部则受命）
    addBubble({ kind: 'system', text: '（' + (extra || '某部') + ' 主官出班受命：「臣即召集本部议覆 · 三日内回奏。」）' });
    await delay(380);
    addBubble({ kind: 'system', text: '（事下 ' + (extra || '某部') + ' · 限期回奏 · GM.deptTasks +1）' });
    return;
  }
  // ─── 下廷议 ───
  if (action === 'escalate') {
    addBubble({ name: presenter, text: '陛下圣裁·此事确兹事体大·宜下廷议。' });
    await delay(380);
    addBubble({ name: '韩爌', stance: 'mediate', text: '陛下圣明·下廷议方可服众。臣即拟召集名单。' });
    await delay(380);
    maybeAmbient(0.3);
    addBubble({ kind: 'system', text: '（议题转入廷议待议册·下次廷议菜单可见。）' });
    return;
  }
  // ─── 改批 ───
  if (action === 'modify') {
    addBubble({ name: presenter, text: '陛下圣裁所改·臣即遵旨改办。' });
    await delay(380);
    // 立场支持者评价改批
    const supporters = collectByStance(item, 'support', 1, presenter);
    for (const s of supporters) {
      addBubble({ name: s, stance: 'support', text: '陛下亲为改批·圣裁高于原奏·臣等敬服。' });
      await delay(380);
    }
    addBubble({ kind: 'system', text: '（原奏被替换为陛下口述方案·进诏令追踪标"亲改"·皇威 +1）' });
    return;
  }
  // ─── 追问 ───
  if (action === 'probe') {
    const probeText = item.detail.split('。')[1] || '其情甚明 · 不敢隐瞒。';
    addBubble({ name: presenter, text: '臣详陈：' + probeText.slice(0, 80) + '。陛下若再有疑·臣无所避。' });
    await delay(380);
    return;
  }
  // ─── 传召 ───
  if (action === 'summon') {
    const tgt = extra || '某员';
    const pool = _cc3_buildSummonablePool();
    // entry 即使在闭合后再次召也要 pool 实时构建
    let entry = pool.find(p => p.name === tgt);
    if (!entry) {
      // 兼容兜底：人不在池里·按"正常缺朝"处理
      entry = { name: tgt, category: 'court_absent', risk: 0, reasonLabel: '远离京师' };
    }

    // 取 GM.chars 详情·建/补 CHARS 条目
    let gmCh = null;
    try { if (typeof findCharByName === 'function') gmCh = findCharByName(tgt); } catch (_) {}
    if (!CHARS[tgt]) {
      const tt = (gmCh && (gmCh.officialTitle || gmCh.title)) || entry.reasonLabel || '在野';
      let cls = 'east';
      if (/将军|总兵|都督|提督|参将|副将/.test(tt)) cls = 'wu';
      else if (/御史|给事中|都察|科道/.test(tt)) cls = 'kdao';
      CHARS[tgt] = {
        title: tt,
        rank: 9,
        faction: (gmCh && gmCh.faction) || '中立',
        party: (gmCh && gmCh.party) || '',
        loyalty:   (gmCh && typeof gmCh.loyalty   === 'number') ? gmCh.loyalty   : 50,
        integrity: (gmCh && typeof gmCh.integrity === 'number') ? gmCh.integrity : 50,
        ambition:  (gmCh && typeof gmCh.ambition  === 'number') ? gmCh.ambition  : 50,
        stanceText: (gmCh && gmCh.stance) || '',
        class: cls,
        initial: tgt.charAt(0),
        absent: null,
        _summoned: true,
        _summonCategory: entry.category
      };
    } else {
      CHARS[tgt].absent = null;
      CHARS[tgt]._summoned = true;
      CHARS[tgt]._summonCategory = entry.category;
    }

    // 移出 absents·加入 attendees
    state.absents = (state.absents || []).filter(a => a.name !== tgt);
    if (state.attendees.indexOf(tgt) < 0) state.attendees.push(tgt);

    // 入殿气泡（按类别不同·烘托违制氛围）
    const arrivalLines = {
      court_absent: '（中使奉旨疾驰·' + tgt + ' 闻召即至·趋入殿前。）',
      inner_palace: '（' + tgt + ' 奉旨入殿·步履徐行·宫娥扶持。殿中诸臣交目相视·颇有不安。）',
      student:      '（' + tgt + ' 草民袍服·奉召入殿·叩首阶下·惶恐战栗。）',
      clan:         '（' + tgt + ' 王驾入朝·百官按宗籍序而拜·然殿中沉肃异常。）',
      commoner:     '（' + tgt + ' 草野之身奉召·惊惶趋入·叩首良久不敢起。）'
    };
    addBubble({ kind: 'system', sysKind: entry.risk > 0 ? 'warn' : '', text: arrivalLines[entry.category] || '（' + tgt + ' 已至。）' });
    await delay(450);

    // 召见者本人开口·走 AI 流式（带其完整档案+议题语境）
    const summonedNpc = { name: tgt, stance: 'neutral', line: '' };
    try { await _cc3_streamReactBubble(summonedNpc, item || {}, 'self'); } catch (_) {}
    await delay(280);

    // 风险 > 0 → 言官当朝抗辩 + 插入新议程
    if (entry.risk > 0) {
      // 找一名在场言官（科道）出列
      let accuser = null;
      const speakers = Object.keys(CHARS).filter(n => CHARS[n] && !CHARS[n].absent && CHARS[n].class === 'kdao' && n !== tgt);
      if (speakers.length > 0) {
        accuser = speakers[Math.floor(Math.random() * speakers.length)];
      }
      // 退而求次·任何在场清流文官
      if (!accuser) {
        const fallback = Object.keys(CHARS).filter(n => {
          const c = CHARS[n];
          return c && !c.absent && n !== tgt && (c.faction === '明朝廷' || /东林|清流/.test(c.party || ''));
        });
        if (fallback.length > 0) accuser = fallback[0];
      }
      if (accuser) {
        const detailMap = {
          inner_palace: '陛下召 ' + tgt + ' 入朝·后宫干政·祖制所禁。妇人不预外朝·此典甚严。臣冒死请陛下察焉·命其速归内廷。',
          clan:         '陛下召 ' + tgt + ' 与议·宗室预政·古者所慎。汉七国之乱、唐玄武之变·皆此覆辙。臣请陛下慎之。',
          student:      '陛下召 ' + tgt + ' 入朝·学子未仕而预朝议·名分既乖·贻人口实。乞陛下令其退归学舍。',
          commoner:     '陛下召 ' + tgt + ' 草野之人入朝·名器轻许·礼度倒置。臣请陛下慎之。',
          court_absent: '陛下今召 ' + tgt + ' 入朝·此员本应回避·而骤召至·恐有偏听之嫌。'
        };
        const protestItem = {
          presenter: accuser,
          dept: '都察院',
          type: 'confrontation',
          urgency: 'normal',
          title: '陛下召 ' + tgt + ' 议',
          announceLine: '臣 ' + accuser + ' 不敢避罪·谨陈一议。',
          detail: detailMap[entry.category] || ('陛下召 ' + tgt + ' 入朝·恐有未当·伏乞圣察。'),
          target: null,
          relatedPeople: [tgt],
          controversial: 7 + entry.risk,
          importance: 6,
          _summonProtest: true
        };
        // 插在当前议程之后·下一拍 runNextItem 自然会处理
        AGENDA.splice(state.currentIdx + 1, 0, protestItem);
        addBubble({ kind: 'system', sysKind: 'warn', text: '（' + accuser + ' 出列举笏 · 当庭抗议陛下召 ' + tgt + '。此事将列下一议。）' });
        if (typeof updateProgress === 'function') updateProgress();
        await delay(420);
      }
    }
    return;
  }
  // ─── 训诫（5 种 outcome·v2 借鉴）───
  if (action === 'admonish') {
    const tgt = extra || item.target || presenter;
    const tgtCh = CHARS[tgt] || {};
    // 厉声开场
    addBubble({ kind: 'system', sysKind: 'warn', text: '（陛下厉声）' + tgt + '，你好大胆！' });
    await delay(450);
    // 5 种结局按权重随机·loyalty + 性格简化判定
    const dice = Math.random();
    const main = $('cy-stage-main');
    const outDiv = document.createElement('div');
    outDiv.className = 'reprimand-outcome';
    let line = '';
    let outClass = '';
    if (dice < 0.25) {
      outClass = 'public_submit';
      line = '【当庭叩首】「臣 ' + tgt + ' 万死罪 · 谨遵陛下训示 · 此后必竭忠诚 · 不敢再有违失。」';
      addBubble({ name: tgt, stance: 'support', text: '臣······万死！万死！臣即遵旨改过。' });
    } else if (dice < 0.50) {
      outClass = 'secret_resent';
      line = '【面服心怨】' + tgt + ' 唯唯而退·然眼神微沉·暗中怀恨。loyalty -8 · 记仇 +5。';
      addBubble({ name: tgt, stance: 'oppose', text: '臣······谨遵旨。（俯首良久·目光低垂。）' });
    } else if (dice < 0.70) {
      outClass = 'resign_request';
      line = '【伏阙请辞】' + tgt + ' 当庭请辞 · 乞骸骨。已记入待批告退册。';
      addBubble({ name: tgt, stance: 'oppose', text: '臣无能 · 致陛下震怒 · 臣愿乞骸骨归乡 · 不敢复居要津！（伏地不起）' });
      addBubble({ kind: 'system', text: '（' + tgt + ' 伏阙请辞 · 待陛下后批。）' });
    } else if (dice < 0.88) {
      outClass = 'secret_plot';
      line = '【表面请罪 · 暗结同党】' + tgt + ' 似服而不服 · 暗中已起密谋之意。loyalty -12 · 派系反弹 +3。';
      addBubble({ name: tgt, stance: 'oppose', text: '臣······有罪 · 谨听陛下训示。（退入班列时与某员目光相接。）' });
    } else {
      outClass = 'public_refute';
      line = '【当庭抗辩】' + tgt + ' 不服 · 当庭据理抗辩。皇威 -3 · 局面尴尬。';
      addBubble({ name: tgt, stance: 'oppose', text: '陛下！臣 ' + tgt + ' 不敢苟同！臣自任职以来 · 未尝有违职守 · 陛下今日训臣 · 实有未察！请陛下听臣分辩！' });
    }
    outDiv.className = 'reprimand-outcome ' + outClass;
    outDiv.innerHTML = line;
    main.appendChild(outDiv);
    main.scrollTop = main.scrollHeight;
    await delay(380);
    return;
  }
  // ─── 嘉奖 ───
  if (action === 'praise') {
    const tgt = extra || presenter;
    addBubble({ name: tgt, text: '臣 ' + tgt + ' 谢陛下隆恩！必竭忠诚·不负圣望。' });
    await delay(380);
    // 殿中羡慕
    addBubble({ kind: 'system', text: '（殿中有臣低语："陛下亲赏 ' + tgt + ' · 殊荣也。"）' });
    addBubble({ kind: 'system', text: '（' + tgt + ' loyalty +3 · 名望 +1）' });
    return;
  }
  // ─── 当庭口述诏令 ───
  if (action === 'decree') {
    await runDecreeFlow(extra);
    return;
  }
}

async function runDecreeFlow(extra) {
  const tier = (extra && extra.tier) || 'B';
  const t = computeDecreeTier();
  await delay(300);
  if (tier === 'S') {
    addBubble({ kind: 'system', text: '（殿中山呼）陛下圣明！' });
    addBubble({ kind: 'system', text: '（诏令全效·进诏令追踪·标"亲诏"。皇威 +1 名望 +1。）' });
  } else if (tier === 'A') {
    addBubble({ kind: 'system', text: '（百官面色凝重 · 默然奉旨。）' });
    addBubble({ kind: 'system', text: '（诏令全效。在场反对派 loyalty -1。）' });
  } else if (tier === 'B') {
    addBubble({ kind: 'system', text: '（百官有低声议论 · 终是奉旨。）' });
    addBubble({ kind: 'system', text: '（诏令奉行·派系记仇。loyalty 略降。）' });
  } else if (tier === 'C') {
    addBubble({ name: '韩爌', stance: 'oppose', text: '陛下！此事关乎民心 · 臣等以为可议而行 · 不宜独断！' });
    addBubble({ kind: 'system', text: '（诏令全效但民心 -2 · 暴名 +1 · 该回合后续奏报激进度↑）' });
  } else if (tier === 'D') {
    if (t.code === 'D' && t.name === '危诏激变') {
      addBubble({ name: '黄景昉', stance: 'oppose', text: '陛下不可！臣愿以死谏！（伏地不起）' });
      addBubble({ kind: 'system', text: '（殿中数员跪谏 · 诏令 blocked · 皇威 -3 · 权威 -2 · 派系叛意 +。）' });
    } else {
      addBubble({ name: '黄景昉', stance: 'oppose', text: '陛下 · 此诏诚有未当 · 臣谨封驳。' });
      addBubble({ kind: 'system', text: '（诏令打 50% 折 · 进诏令追踪标"半行" · AI 推演时部门怠工。皇权 -1。）' });
    }
  }
}

// ═══════════════════════════════════════════════
// 注：preview 测试页遗留的顶部按钮绑定（cy-player-input / mode-changchao /
//     prestige-slider / power-slider / court-mode-tag / restart-btn）已物理删除·
//     这些元素在游戏内 modal 不存在·原绑定在脚本加载时就会因 null.onkeydown 抛错·
//     v3 modal 内的实际事件绑定全部移到 _cc3_createModal 里（L3300+）。
//     refreshCourtModeTag 函数也移除·肃朝/众言判定改由 isStrictCourt() 直读。
// ═══════════════════════════════════════════════


// ───────────────────────────────────────────
// §C · 入口注册（暂不路由·调试用 console 入口）
// ───────────────────────────────────────────

/** v3 朝议入口·暂供 console 测试·后续接 _cy_pickMode */
async function _cc3_open() {
  // 频次计数（与 v2 兼容·in-turn court 受 2/turn 限·post-turn 不受）
  if (typeof GM !== 'undefined') {
    if (!GM._chaoyiCount) GM._chaoyiCount = {};
    if (!GM._chaoyiCount[GM.turn]) GM._chaoyiCount[GM.turn] = 0;
    if (!GM._isPostTurnCourt && GM._chaoyiCount[GM.turn] >= 2) {
      if (typeof toast === 'function') toast('今日已朝议 ' + GM._chaoyiCount[GM.turn] + ' 次·改日再议');
      return;
    }
    GM._chaoyiCount[GM.turn]++;
  }

  // 关 v2 旧 modal（如有）
  const oldModal = document.getElementById('chaoyi-modal');
  if (oldModal) oldModal.remove();

  // ★ 立即捕获是否朔朝·避免 await 期间 GM._isPostTurnCourt 被外部 reset 导致标题/system prompt 错位
  state._isPostTurn = (typeof GM !== 'undefined' && !!GM._isPostTurnCourt);
  state.mode = state._isPostTurn ? 'shuochao' : 'changchao';
  console.log('[cc3] _cc3_open·进入·朔朝=' + state._isPostTurn + '·mode=' + state.mode);

  // 创建 v3 modal
  _cc3_createModal();
  // 立即刷新一次标题·把硬编码"早朝"改为正确名（即使 await 期间也不会闪回）
  if (typeof refreshTitle === 'function') refreshTitle();

  // 用 GM 数据覆盖 mock CHARS / AGENDA / state.prestige/power
  _cc3_overrideMockWithGM();

  // 异步加载议程（AI 生成）
  try {
    console.log('[cc3] _cc3_open·开始 buildAgenda');
    const items = await _cc3_buildAgendaFromGM();
    AGENDA.length = 0;
    items.forEach(it => AGENDA.push(it));
    console.log('[cc3] _cc3_open·议程已载入·共 ' + AGENDA.length + ' 条', AGENDA);
  } catch (e) {
    console.error('[cc3] _cc3_open·buildAgenda 抛错', e);
    try { window.TM && TM.errors && TM.errors.captureSilent(e, 'tm-chaoyi-v3:open'); } catch (_) {}
    // 即使 buildAgenda 失败·也要给个最小议程让流程能跑
    AGENDA.length = 0;
    AGENDA.push({
      presenter: '内侍', dept: '内廷', type: 'routine', urgency: 'normal',
      title: '日常无事', announceLine: '今日并无紧要奏报。',
      detail: '百官今日并无紧要事务奏闻陛下。', controversial: 0, importance: 1, _fallback: true
    });
  }

  // 重置 state·跑 runOpening
  state.currentIdx = 0;
  state.decisions = [];
  state.phase = 'opening';
  state.done = false;
  state.attendees = [];
  state.absents = [];
  // 朝议类型·根据 GM._isPostTurnCourt 决定标题/时间是早朝还是朔朝（流程完全一致）
  state.mode = (typeof GM !== 'undefined' && GM._isPostTurnCourt) ? 'shuochao' : 'changchao';

  // 班次区从真实 CHARS 重建
  if (typeof renderBench === 'function') renderBench();
  if (typeof refreshTitle === 'function') refreshTitle();

  if (typeof runOpening === 'function') {
    runOpening();
  }
}

/** 用 GM 数据覆盖 preview mock 数据 */
function _cc3_overrideMockWithGM() {
  // 覆盖 CHARS（清空再填）
  const gmDict = _cc3_buildCharsFromGM();
  Object.keys(CHARS).forEach(k => delete CHARS[k]);
  Object.assign(CHARS, gmDict);

  // 覆盖皇威/皇权
  state.prestige = _cc3_getPrestige();
  state.power = _cc3_getPower();
  // 诊断：把当前肃朝判定打到 console·让用户能直接验证
  try {
    const info = _cc3_getStrictCourtInfo();
    console.log('[cc3·朝威] 皇威=' + info.prestige + ' 皇权=' + info.power +
                ' 阈值=' + info.thPrestige + '/' + info.thPower +
                ' → ' + (info.isStrict ? '【肃朝】' : '【众言】') +
                (info.note ? ' (' + info.note + ')' : ''));
  } catch (_) {}
}

/** 创建 v3 modal HTML（preview body 结构移植） */
function _cc3_createModal() {
  // 加载 CSS（一次性）
  if (!document.getElementById('cc3-css')) {
    const link = document.createElement('link');
    link.id = 'cc3-css';
    link.rel = 'stylesheet';
    link.href = 'tm-chaoyi-v3.css';
    document.head.appendChild(link);
  }

  // 创建 modal·preview 的 cy-stage 结构
  const stage = document.createElement('div');
  stage.className = 'cy-stage';
  stage.id = 'cy-stage';
  stage.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:5000;';
  stage.innerHTML = `
    <div class="cy-ceremony" id="cy-ceremony">
      <h1 id="cy-ceremony-title">〔 早 朝 〕</h1>
      <div class="sub">奉天门 · 五更三点</div>
      <div class="bell">铮 ── 铮 ── 铮 ──</div>
    </div>
    <div class="cy-titlebar">
      <div class="ttl" id="cy-title">〔 早 朝 〕</div>
      <div class="meta">
        <span class="tag" id="cy-progress-tag">已议 0</span>
        <span class="tag" id="cy-attend-tag">殿中 ?</span>
        <button id="cy-interrupt-btn">⏸ 打断</button>
        <button id="cy-exit-btn">✕ 退朝</button>
      </div>
    </div>
    <div class="cy-bench" id="cy-bench">
      <div class="cy-bench-header" id="cy-bench-header">
        <span id="cy-bench-status">朝堂全景</span>
        <span class="arrow">▼</span>
      </div>
      <div class="cy-bench-body">
        <div class="cy-bench-col cy-bench-col-east">
          <div class="cy-bench-col-title">文 东 班</div>
          <div class="cy-bench-officials" id="bench-east"></div>
        </div>
        <div class="cy-bench-col-throne">御 座</div>
        <div class="cy-bench-col cy-bench-col-west">
          <div class="cy-bench-col-title">武 西 班</div>
          <div class="cy-bench-officials" id="bench-west"></div>
        </div>
        <div class="kdao-row">
          <div class="cy-bench-col-title">科 道 言 官</div>
          <div class="cy-bench-officials" id="bench-kdao"></div>
        </div>
      </div>
    </div>
    <div class="cy-phase-tag" id="cy-phase-tag">
      <span id="cy-phase-label">【鸣 鞭】</span>
      <span class="progress" id="cy-phase-hint">百官入班候旨</span>
    </div>
    <div class="cy-stage-main" id="cy-stage-main"></div>
    <div class="cy-action-bar" id="cy-action-bar"></div>
    <div class="cy-input-row">
      <input type="text" class="cy-input" id="cy-player-input" placeholder="陛下欲言…… 直接打字按 Enter 即可" />
      <button class="cy-btn muted" id="cy-jinkou-btn">▼ 金口</button>
      <button class="cy-btn danger" id="cy-interrupt-input">⏸ 噤声</button>
    </div>
  `;
  document.body.appendChild(stage);

  // 绑定输入和按钮
  const inp = document.getElementById('cy-player-input');
  if (inp) {
    inp.onkeydown = function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const v = (this.value || '').trim();
        if (!v) return;
        this.value = '';
        if (typeof onPlayerSpeak === 'function') onPlayerSpeak(v);
      }
    };
  }
  const exitBtn = document.getElementById('cy-exit-btn');
  if (exitBtn) exitBtn.onclick = _cc3_close;
  const intBtn = document.getElementById('cy-interrupt-btn');
  if (intBtn) intBtn.onclick = function() {
    if (typeof addBubble === 'function') addBubble({ kind: 'system', text: '（陛下拊案 · 群臣噤声。）' });
  };
  const intInp = document.getElementById('cy-interrupt-input');
  if (intInp) intInp.onclick = function() {
    if (typeof addBubble === 'function') addBubble({ kind: 'system', text: '（陛下拊案 · 群臣噤声。）' });
  };
  const jkBtn = document.getElementById('cy-jinkou-btn');
  if (jkBtn) jkBtn.onclick = function() {
    if (typeof showJinkouPopover === 'function') showJinkouPopover();
  };
  const benchHdr = document.getElementById('cy-bench-header');
  if (benchHdr) benchHdr.onclick = function() {
    state.benchExpanded = !state.benchExpanded;
    document.getElementById('cy-bench').classList.toggle('expanded', state.benchExpanded);
  };
}

/** 关闭 v3 modal */
function _cc3_close() {
  const m = document.getElementById('cy-stage');
  if (m) m.remove();
  // 清理 popovers
  document.querySelectorAll('.cy-popover, .cy-summary-mask, .cy-input-modal').forEach(p => p.remove());
  if (typeof CY !== 'undefined') {
    CY.open = false;
    if (CY.abortCtrl) try { CY.abortCtrl.abort(); } catch(_){}
  }
}

try { window._cc3_open = _cc3_open; } catch (_) {}
try { window._cc3_close = _cc3_close; } catch (_) {}

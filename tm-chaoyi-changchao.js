// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// Module: tm-chaoyi-changchao.js — 常朝 v3·preview 移植 + GM Adapter
// Domain: 朝议·常朝
// Status: active · Last Updated: 2026-05-03 (Phase 3·rename v3 → changchao·5→4 文件)
// Owner: TM 团队
// Imports: tm-chaoyi.js (openChaoyi·closeChaoyi·addCYBubble·_cc2_buildAgendaPrompt·_cc2_fallbackAgenda)
//          tm-ai-infra.js (callAI·_aiDialogueTok·_aiDialogueWordHint·extractJSON)·tm-utils.js
// Exports: 76 _cc3_* functions·主入口 _cc3_open·_cc3_createModal·_cc3_close 等
// Used by: tm-chaoyi.js (_cy_pickMode 'changchao' → _cc3_open)
// Side effects: DOM modal (cc3-*)·CSS dynamic load (tm-chaoyi-changchao.css)·CY 状态·GM
// Test: web/scripts/smoke-chaoyi-v3.js (56 assertions)·boot-smoke·render-smoke
// Notes: Phase 3 (2026-05-03) 5→4 文件·原 tm-chaoyi-v3.js·rename → changchao·_cc2 prompts 已入 chaoyi.js
// 姊妹·tm-chaoyi.js·tm-chaoyi-tinyi.js·tm-chaoyi-yuqian.js
//
// R157 章节导航·§A[L1] GM Adapter (_cc3_buildCharsFromGM·etc)
//   §B[L80] preview 移植 (runOpening/Announce/Detail/Debate/Closing)
//   §C[末] 入口 _cc3_open
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
  // 2026-06-11·治「罢官后仍上朝」：officialTitle 一旦被任免系统写过(罢官会清成 ''/null)即以它为准，
  //   防罢官者靠剧本旧 title(描述快照·个别罢官路径未必同步清)回退仍被判「在京大臣」。
  //   仅当从未有该字段(undefined·老档/纯剧本只填 title 的角色)才回退 title——剧本朝官均设了 officialTitle(实查 121 处)，无误伤。
  const t = (ch.officialTitle !== undefined)
    ? (ch.officialTitle || '')
    : (ch.title || '');
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
    // 2026-06-11·治「下狱/流放/逃亡后仍参与朝会」：法律上已不在朝者直接不入百官列(不只标 absent·
    //   防个别参与/展示路径漏查 absent)。致仕/丁忧/病假等暂离仍保留(由 _cc3_classifyAbsent 标缺席·仍在朝籍)。
    if (ch._imprisoned || ch.imprisoned || ch._inJail || ch._jailed || ch._exiled || ch._banished || ch._fled || ch._missing) return;
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
      portrait: ch.portrait || '',
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
      const nc = (typeof GM !== 'undefined' && (GM.neitang || GM.neicang)) || {};
      const _mu = (typeof CurrencyUnit !== 'undefined' && CurrencyUnit.unitOf) ? (CurrencyUnit.unitOf('money') || '两') : '两';
      const finParts = [];
      if (typeof gk.money === 'number') finParts.push('国帑 ' + Math.round(gk.money) + ' ' + _mu);
      if (typeof gk.grain === 'number') finParts.push('粮 ' + Math.round(gk.grain));
      if (typeof nc.money === 'number') finParts.push('内帑 ' + Math.round(nc.money) + ' ' + _mu);
      if (finParts.length) prompt += '\n【国帑现状】' + finParts.join('·') + '·议程可针对吃紧/盈余生成相应（请帑/请赈/加征/裁冗等）';
      if (typeof GM !== 'undefined' && Array.isArray(GM.activeWars) && GM.activeWars.length) {
        const wars = GM.activeWars.slice(0, 3).map(w => (w.enemy || w.opponent || '?') + (w.frontline ? '@' + w.frontline : '') + (w.status ? '(' + w.status + ')' : ''));
        prompt += '\n【在伐之敌】' + wars.join('·') + '·议程可涉边报/请饷/调兵';
      }
      const meterParts = [];
      if (typeof GM !== 'undefined') {
        if (typeof GM.partyStrife === 'number') meterParts.push('党争 ' + Math.round(GM.partyStrife));
        if (typeof GM.unrest === 'number')      meterParts.push('民变 ' + Math.round(GM.unrest));
        const corr = (GM.corruption && typeof GM.corruption.trueIndex === 'number') ? GM.corruption.trueIndex :
          (GM.corruption && typeof GM.corruption.overall === 'number') ? GM.corruption.overall :
          (GM.corruption && typeof GM.corruption.index === 'number') ? GM.corruption.index :
          (typeof GM.corruption === 'number' ? GM.corruption : null);
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
      const _isPostTurnNow = (typeof state !== 'undefined' && state._isPostTurn != null)
        ? !!state._isPostTurn
        : !!(GM && GM._isPostTurnCourt);
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

/**
 * 常朝大改 Slice 2·议题 tag 推导
 * 8 个核心 tag·让 Slice 3 (8D 接入 stance) 和 Slice 5 (persona modulation) 有据可循
 *
 * 来源 3 种·
 *   1. scenario.events 预定义 tag (剧本剧情事件)
 *   2. NPC 推演 LLM 输出含 tags 字段
 *   3. fallback·关键词推导 (本函数)
 *
 * tag list·
 *   foreign-policy        涉外·战和·封贡
 *   penal-harsh           刑罚·诛戮·谳狱
 *   reward-distribution   赏赐·分肥·封赏
 *   etiquette-violation   违礼·僭越·失仪
 *   ritual                祭祀·宗庙·礼制
 *   historicalPrecedent   有先例可援·复古议
 *   execution-detail      执行细节·具体方案
 *   personnel             人事·任免·迁转
 */
function _cc3_inferTagsFromText(item) {
  if (!item) return [];
  const text = (item.title || '') + ' ' + (item.detail || item.content || '');
  if (!text.trim()) return [];
  const tags = [];

  if (/和议|封贡|战守|出师|金人|党项|羁縻|攻守|抚剿|藩夷|互市|抗虏|降虏|和戎|犁庭/.test(text)) tags.push('foreign-policy');
  if (/诛|斩|戮|大辟|谳狱|罪当死|抄家|凌迟|籍没|论死|弃市|赐死|连坐/.test(text)) tags.push('penal-harsh');
  if (/封赏|分赐|食邑|赐田|加禄|加恩|赏赐|进爵|加封|荫袭/.test(text)) tags.push('reward-distribution');
  if (/失仪|僭越|不臣|大不敬|违制|凌君|跋扈|无人臣礼/.test(text)) tags.push('etiquette-violation');
  if (/祭|郊|庙|社稷|宗庙|礼制|大祀|配享|侑食|追尊/.test(text)) tags.push('ritual');
  if (/(汉|唐|宋|明|周|秦|晋|魏|齐|隋)\S{0,8}故事|先朝|祖宗|前事|本朝旧例|国初\S{0,3}事|援.{0,4}故|引为.{0,2}鉴/.test(text)) tags.push('historicalPrecedent');
  if (/方略|具体|施行|条陈|分项|分议|核议|详议|勘报|筹画|举措/.test(text)) tags.push('execution-detail');
  if (/任|免|迁|擢|黜|罢|起复|拜.{0,2}相|入阁|出.{0,2}抚|开缺|休致/.test(text)) tags.push('personnel');

  return tags;
}

/** 给 AI 生成的议程补 selfReact / debate / debate2 字段（让流程不冷场） */
function _cc3_enhanceAgendaItem(item) {
  if (!item || typeof item !== "object") return item;
  // 默认补 detail 字段（v2 用 content·v3 期望 detail）
  if (!item.detail) item.detail = item.content || item.title || "";
  // 默认 controversial / importance
  if (typeof item.controversial !== "number") item.controversial = 3;
  if (typeof item.importance !== "number") item.importance = 5;
  // Slice 2·议题 tag·若 scenario/LLM 未提供·走 fallback 关键词推导
  if (!Array.isArray(item.tags) || !item.tags.length) {
    item.tags = _cc3_inferTagsFromText(item);
  }

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
  function issueAgendaHint(iss) {
    iss = iss || {};
    const title = String(iss.title || "时政要议").trim() || "时政要议";
    const dept = String(iss.dept || iss.category || "时政").trim() || "时政";
    const proposer = String(iss.proposer || iss.from || "通政司").trim() || "通政司";
    const raw = String(iss.description || iss.summary || iss.brief || iss.narrative || iss.text || "").replace(/\s+/g, " ").trim();
    const hint = raw ? raw.slice(0, 42) : "请有司据实核奏";
    return {
      title: title,
      dept: dept,
      proposer: proposer,
      hint: hint,
      content: proposer + "奏称：" + dept + "有“" + title + "”一事，须由有司核明情由、具议处置。",
      detail: "御案线索：" + title + "；要点：" + hint + "。此处为朝会改写摘要，不取御案原文。",
      announceLine: dept + "有事关“" + title + "”者，请旨裁断。"
    };
  }

  // 去重：排除已分配给廷议的 issue·廷议会单独处理这些
  const sourcePool = (typeof _cc2_collectAgendaSources === 'function')
    ? _cc2_collectAgendaSources({ max: 12, includeHeld: true })
    : [];
  const pickedSources = sourcePool.length && typeof _cc2_pickAgendaSourcesForCourt === 'function'
    ? _cc2_pickAgendaSourcesForCourt(sourcePool, 5)
    : sourcePool.slice(0, 5);
  pickedSources.forEach(function(src, idx) {
    if (typeof _cc2_agendaSourceToItem !== 'function') return;
    const base = _cc2_agendaSourceToItem(src, idx);
    const p = pickPresenter(base.dept || src.dept);
    const sourcePresenter = src.presenter && CHARS[src.presenter] && !CHARS[src.presenter].absent ? src.presenter : '';
    base.presenter = sourcePresenter || p.name;
    base.dept = base.dept || p.dept;
    if (src.source === '百官奏疏' || src.source === '鸿雁来书') {
      base.announceLine = (base.dept || p.dept || '通政司') + '代奏“' + (src.title || base.title || '一事') + '”，请旨裁断。';
    }
    items.push(base);
  });
  if (items.length === 0) {
    const pending = ((GM.currentIssues || []).filter(i => i.status === "pending" && i.allocatedTo !== 'tinyi')).slice(0, 3);
    pending.forEach(function(iss) {
      const p = pickPresenter(iss.dept);
      const hint = issueAgendaHint(iss);
      items.push({
        presenter: p.name, dept: p.dept, type: "routine", urgency: "normal",
        title: hint.title.slice(0, 10),
        announceLine: hint.announceLine,
        content: hint.content,
        detail: hint.detail,
        controversial: 3, importance: 5, _fallback: true
      });
    });
  }
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
  s += '【玩家】' + playerName + '·' + playerFaction + '·君主（自称与臣下对其称谓一律依下【称谓感知】所示本朝语境·勿套他朝/现代·勿一味"陛下"）\n';
  // 注入君上称谓感知(单一真相源·带 era 包具体称谓·如宋→官家)·补齐常朝此前缺失的感知行
  try { if (typeof _sovereignLanguagePromptLine === 'function') { var _sovLine = _sovereignLanguagePromptLine(typeof GM !== 'undefined' ? GM : null); if (_sovLine) s += _sovLine + '  · 下文范例/候选辞令中若出现"陛下"仅为占位·须按本朝君上称谓替换(如宋作官家)\n'; } } catch (e) {}
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
  s += '· 不可用现代汉语·不可空泛附和"君上圣明"之类套话·必须有具体观点和理由\n';
  s += '· 立场基于角色档案推导（派系/性格/忠诚/记忆/与君上关系）·不可机械随机\n';
  s += '· 紧扣议题具体内容·不重复他臣已表态·要有差异和进展\n';
  s += '· 涉及自身利害则语气强烈·涉及记忆则态度连贯\n';
  s += '\n【发言信息源】NPC 发言可引用以下游戏状态作为论据（自下文 sysVariable 段读）：\n';
  s += '  · 御案时政（待处理时政清单·只作议题线索，不得原文照搬为奏报正文）·\n';
  s += '  · 国帑·征伐·乱政指数（财政/军事/党争实情·关乎是否切实可行）·\n';
  s += '  · 近回合推演摘要（近事变化·NPC 已知）·\n';
  s += '  · 近期诏令（陛下已下旨·NPC 所言不可与已颁诏书相悖；亦可言其执行中得失）·\n';
  s += '  · 起居注近事（百官昨日动向·可作为佐证或反诘）·\n';
  s += '  · 长期诏书/编年项（仍在执行的政策·NPC 应知其进度反馈）\n';
  s += '※ NPC 发言若涉及上述任一项·须明确点出（如"前番户部所奏…"/"圣上旬日前下严办之诏…"/"近年党争已积…"）\n';

  // v2·PromptComposer 接入·替代手拼 sc.chaoyi.systemPromptExtra + P.conf.aiPersona
  if (typeof TM !== 'undefined' && TM.PromptComposer) {
    s += TM.PromptComposer.buildBookExtra({ chaoyi: cfg });
    s += TM.PromptComposer.buildPersonaExtra(typeof P !== 'undefined' ? P : {});
  } else {
    if (cfg.systemPromptExtra) s += '\n【本朝特设】' + cfg.systemPromptExtra + '\n';
    const personaExtra = (typeof P !== 'undefined' && P.conf && (P.conf.aiPersona || P.conf.systemPrompt)) || '';
    if (personaExtra) s += '\n【陛下附注】' + personaExtra + '\n';
  }

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
  // 顶层时政（御案·最多 6 条·只给线索摘要·排除已分配给廷议的）
  const issues = ((typeof GM !== 'undefined' && GM.currentIssues) || []).filter(i => i && i.status === 'pending' && i.allocatedTo !== 'tinyi').slice(0, 6);
  if (issues.length) {
    s += '【御案时政·待处理】以下只作朝会议题线索，禁止原文照搬为奏报正文；可改写为有司奏称。\n';
    issues.forEach(i => {
      const desc = String(i.description || i.summary || i.brief || i.narrative || i.text || '').replace(/\s+/g, ' ').slice(0, 42);
      s += '  · ' + (i.title || '') + (desc ? '：要点 ' + desc : '') + (i.dept ? '（' + i.dept + '）' : '') + '；须改写，不得照搬。\n';
    });
  }
  // 财政状况（帑廪/内帑/积粮/布）
  if (typeof GM !== 'undefined') {
    const gk = GM.guoku || {};
    const nc = GM.neitang || GM.neicang || {};
    const _mu = (typeof CurrencyUnit !== 'undefined' && CurrencyUnit.unitOf) ? (CurrencyUnit.unitOf('money') || '两') : '两';
    const finParts = [];
    if (typeof gk.money === 'number')  finParts.push('国帑 ' + Math.round(gk.money) + ' ' + _mu);
    if (typeof gk.grain === 'number')  finParts.push('粮 ' + Math.round(gk.grain) + ' 石');
    if (typeof gk.cloth === 'number')  finParts.push('布 ' + Math.round(gk.cloth) + ' 匹');
    if (typeof nc.money === 'number')  finParts.push('内帑 ' + Math.round(nc.money) + ' ' + _mu);
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
    else if (GM.corruption && typeof GM.corruption.trueIndex === 'number') meterParts.push('腐败 ' + Math.round(GM.corruption.trueIndex));
    else if (GM.corruption && typeof GM.corruption.overall === 'number') meterParts.push('腐败 ' + Math.round(GM.corruption.overall));
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
  // 常朝来源池摘要·给 NPC 发言使用，避免只围绕御案时政
  if (typeof _cc2_collectAgendaSources === 'function' && typeof _cc2_formatAgendaSourcesForPrompt === 'function') {
    try {
      const sourcePool = _cc2_collectAgendaSources({ max: 12, includeHeld: true });
      if (sourcePool.length) s += '【常朝候选来源】\n' + _cc2_formatAgendaSourcesForPrompt(sourcePool, 12) + '\n';
    } catch (_) {}
  } else if (typeof GM !== 'undefined' && Array.isArray(GM.zoushuPool)) {
    const pendingZS = GM.zoushuPool.filter(z => z && (z.status === 'pending' || !z.status));
    if (pendingZS.length) {
      s += '【奏疏池】\n';
      pendingZS.slice(0, 6).forEach(z => {
        s += '  · ' + (z.title || z.topic || '未题奏疏') + '：' + String(z.summary || z.content || '').replace(/\s+/g, ' ').slice(0, 60) + '\n';
      });
    }
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

  // 常朝大改 Slice 1·PromptComposer 注入·跟玩家话回应路径 (L1761) 同 paradigm
  // 让自发表态路径 (selfReact / debate / debate2 / dissent) 也吃到 aiPersonaText + recognitionState
  // 而非只读 personality / loyalty / integrity / ambition 等表层字段
  if (typeof TM !== 'undefined' && TM.PromptComposer && gmCh) {
    try {
      const _aiP = TM.PromptComposer.buildAiPersonaText(gmCh);
      if (_aiP) p += _aiP;
      const _rec = TM.PromptComposer.buildRecognitionState(gmCh);
      if (_rec) p += _rec;
    } catch (_) {}
  }

  // 【sc07 升级·S3 消费打通】注入 sc07 NPC 认知画像(自我画像/口吻/知与不知/对陛下态度/恩怨/所求/朝局判断/风闻未证)——
  //   让常朝大臣发言据此立体、像本人、守信息不对称。此前朝议完全没接 sc07 认知(docstring 声称是消费方却缺口)。
  try {
    if (typeof getNpcCognitionSnippet === 'function') {
      const _cogSnip07 = getNpcCognitionSnippet(name);
      if (_cogSnip07) p += _cogSnip07;
    }
  } catch (_) {}

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

  // ─── 常朝大改 Slice 4-7·6 mode 应答策略注入 ───
  // 层 1·debate state·层 2·base mode·层 3·persona modulation·层 4·rank/class tone·层 5·anti-monotony guards
  let _modeTrace = null;
  try {
    const _state = _cc3_analyzeDebate(item, name, gmCh || ch);
    const _baseMode = _cc3_baseMode(_state, gmCh || ch, item);
    // Slice 6 guards·先 cap monotony·再 persona modulation
    const _lastMode = (_state.lastSpeaker && item && (
      ((item.selfReact || []).find(r => r.name === _state.lastSpeaker) || {})._mode ||
      ((item.debate    || []).find(d => d.name === _state.lastSpeaker) || {})._mode
    )) || null;
    const _gaurded = _cc3_applyModeGuards(_baseMode, item, role, _lastMode);
    const _modeResult = _cc3_modulateModeByPersona(_gaurded, gmCh || ch, item, _state);
    _modeResult.modifiers.cite = _cc3_capCite(_modeResult.modifiers.cite, item);  // Guard 4
    const _tone = _cc3_pickTone(gmCh || ch);

    p += _cc3_buildModeInstruction(_modeResult, _tone, _state, gmCh || ch);

    // Slice 9·Tier 2·层 5 累积参考 + 层 6 皇帝意图 cue
    try {
      const _cumHint = _cc3_cumulativeHint(_state, gmCh || ch, item);
      if (_cumHint) p += _cumHint;
      const _empCue = _cc3_emperorCueHint(item, _state);
      if (_empCue) p += _empCue;
    } catch (tier2Err) { console.warn('[cc3·tier2] hint 生成失败·跳过·', tier2Err && tier2Err.message); }

    _modeTrace = {
      mode: _modeResult.mode,
      tone: _tone,
      cite: !!_modeResult.modifiers.cite,
      force: !!_modeResult.modifiers.force,
      reason: _modeResult.modifiers.reason || '',
      lastSpeaker: _state.lastSpeaker || '',
      dimsSource: _modeResult.modifiers.source || '',
    };
  } catch (modeErr) {
    console.warn('[cc3·mode] 应答 mode 推导失败·走 base prompt·', modeErr && modeErr.message);
  }

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
  // v3.1·prompt 末尾再重申一次 mode·让 LLM 因 recency bias 不忘
  if (_modeTrace) {
    p += '\n── 最后重申 ──\n';
    p += '本回应模式 = 「' + _modeTrace.mode + '」·请回看「应答策略」段之【必含】【禁止】【自检】并严格执行。\n';
  }
  p += '\n严格按 JSON 输出（不带其他文字、不带代码块标记）：\n';
  // v3.1·新加 mode 字段·让 LLM 回执自己用了哪个 mode·便于后验
  p += '{"stance":"support|oppose|mediate|neutral","mode":"lead|second|rebut|soften|pivot|augment","line":"..."}\n\n';
  p += '要求：\n';
  p += '· stance 必须基于你档案中的派系/性格/忠诚/与陛下关系/此议之利害·不可机械随机·不可空泛中立\n';
  if (_modeTrace) {
    p += '· **mode 必须 = "' + _modeTrace.mode + '"** (跟"应答策略"段一致)·若你认为另一 mode 更合适·**仍须按所要求的 mode 写**·不可自行换 mode\n';
  } else {
    p += '· mode 须如实回执 (lead / second / rebut / soften / pivot / augment 之一)\n';
  }
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

  // 解析 JSON（截断/畸形→抢救已流式吐出的 line·避免"完整陈述塌缩成 mock 一句"·2026-07-03）
  //   line 过长触 token 顶未闭合 JSON 时·流式已按 extractLineFromPartial 吐出完整发言·此处用同法抢救之。
  function _salvageFromRaw() {
    let ln = extractLineFromPartial(raw);
    if (ln) ln = ln.replace(/[\s"]+$/, '').trim();   // 去截断尾部残引号/空白
    if (!ln || ln.length < 6) return null;
    const sm = raw.match(/"stance"\s*:\s*"(support|oppose|mediate|neutral)"/);
    const salv = { stance: sm ? sm[1] : 'neutral', line: ln, _salvaged: true };
    if (_modeTrace) salv._modeTrace = _modeTrace;
    return salv;
  }
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return _salvageFromRaw();
    const obj = JSON.parse(m[0]);
    if (!obj || typeof obj.line !== 'string' || obj.line.length < 6) return _salvageFromRaw();
    const validStances = ['support', 'oppose', 'mediate', 'neutral'];
    const validModes   = ['lead', 'second', 'rebut', 'soften', 'pivot', 'augment'];
    const stance = validStances.indexOf(obj.stance) >= 0 ? obj.stance : 'neutral';
    const result = { stance: stance, line: obj.line.trim() };

    // v3.1·LLM 回执的 mode·跟我们推的对比·不匹配 warn (不阻断·只 trace)
    if (typeof obj.mode === 'string' && validModes.indexOf(obj.mode) >= 0) {
      result._llmReportedMode = obj.mode;
      if (_modeTrace && _modeTrace.mode && obj.mode !== _modeTrace.mode) {
        console.warn('[cc3·mode-mismatch] expected ' + _modeTrace.mode + '·got ' + obj.mode + '·NPC=' + name + '·line=' + result.line.slice(0, 60));
      }
    }

    if (_modeTrace) result._modeTrace = _modeTrace;  // Slice 7·peer 可读已推之 mode
    return result;
  } catch (e) {
    console.warn('[cc3·react] JSON 解析失败·抢救流式 line·原文:', raw && raw.slice(0, 200));
    return _salvageFromRaw();
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
    // Slice 7·把 mode trace 写回 npc·让后续 NPC guard/cite cooldown 看得见
    if (aiResult._modeTrace) {
      npc._mode = aiResult._modeTrace.mode;
      npc._tone = aiResult._modeTrace.tone;
      npc._cite = !!aiResult._modeTrace.cite;
      // Slice 6·NPC-NPC AffinityMap + memory linkage
      try {
        const _ctrl = (item && typeof item.controversial === 'number') ? item.controversial : 3;
        _cc3_writeNpcInteraction(npc.name, aiResult._modeTrace.mode, aiResult._modeTrace.lastSpeaker, item, _ctrl);
      } catch (_) {}
    }
  } else {
    // AI 失败回退：若流式已吐出实质内容·保留已陈之言（勿用 mock 短句覆盖玩家已看到的完整陈述）·仅无实质流式时才用 mock
    const _streamed = textEl ? String(textEl.textContent || '').trim() : '';
    if (!_streamed || _streamed === '…' || _streamed.length < 6) {
      if (textEl) textEl.textContent = npc.line || '臣随议·伏听圣裁。';
    } else {
      npc.line = _streamed;   // 保留流式内容并同步 npc.line·下游引用一致
    }
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
  const dateInfo = (typeof calcDateFromTurn === 'function') ? calcDateFromTurn(turn || 1) : null;
  const fallbackDpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
  const month = (dateInfo && (dateInfo.lunarMonth || dateInfo.solarMonth)) || ((Math.floor(Math.max(0, turn - 1) * fallbackDpv / 30) % 12) + 1);  // 1-12
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
  // 兜底：按统一每回合天数推算
  const startY = (scenario && scenario.startYear) || (typeof P !== 'undefined' && P.time && P.time.year) || 1628;
  let yearOff = 0, month = (typeof P !== 'undefined' && P.time && P.time.startMonth) || 1;
  // 估算每回合月份偏移（仅作显示兜底·不影响核心 turn 推进）
  const daysPerTurn = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
  const monthsPerTurn = daysPerTurn / 30;
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
  _isPostTurn: null,
  _openSource: '',
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
  return `<div class="cy-bubble-avatar ${cls}${ch.portrait ? ' has-img' : ''}">${ch.portrait ? '<img class="cy-bubble-avatar-img" src="'+escHtml(ch.portrait)+'" loading="lazy" decoding="async">' : escHtml(ch.initial || name.slice(0, 1))}</div>`;
}

// 2026-06·出班者立绘放大焦点（左殿堂·随发言切换·谁奏对则谁立绘）
function _cc3_setPresenter(name) {
  var el = document.getElementById('cc-presenter');
  if (!el || !name) return;
  var ch = CHARS[name] || {};
  var pic = ch.portrait
    ? '<img class="cc-pres-img" src="' + escHtml(ch.portrait) + '" loading="lazy">'
    : '<div class="cc-pres-ph">' + escHtml(String(name).charAt(0)) + '</div>';
  el.innerHTML = '<div class="cc-pres-pic">' + pic + '</div><div class="cc-pres-info"><div class="cc-pres-nm">' + escHtml(name) + '</div><div class="cc-pres-rl">' + escHtml(ch.title || '') + ' · 出班奏对</div></div>';
  el.classList.add('active');
}

// 2026-06·本日议程列表（右栏顶·AGENDA × currentIdx → ✓已决 / ●当前 / ○待奏 + 标签）
function _cc3_renderAgendaList() {
  var el = document.getElementById('cc-agenda'); if (!el) return;
  if (typeof AGENDA === 'undefined' || !AGENDA || !AGENDA.length) { el.innerHTML = ''; return; }
  var cur = (typeof state !== 'undefined' && typeof state.currentIdx === 'number') ? state.currentIdx : 0;
  var done = (typeof state !== 'undefined' && state.decisions) ? state.decisions.length : 0;
  var h = '<div class="cc-ag-h">本日议程 · 已决 <b>' + done + '</b> / 共 <b>' + AGENDA.length + '</b> 事</div><div class="cc-ag-list">';
  for (var i = 0; i < AGENDA.length; i++) {
    var it = AGENDA[i] || {};
    var stt = i < cur ? 'done' : (i === cur ? 'cur' : 'wait');
    var icon = stt === 'done' ? '✓' : (stt === 'cur' ? '●' : '○');
    var tags = '';
    if (it.tags && it.tags.length) { for (var t = 0; t < Math.min(2, it.tags.length); t++) tags += '<span class="cc-ag-tag">' + escHtml(it.tags[t]) + '</span>'; }
    h += '<div class="cc-ag-item ' + stt + '"><span class="cc-ag-st">' + icon + '</span><span class="cc-ag-ti">' + escHtml(it.title || it.presenter || '议题') + '</span><span class="cc-ag-tags">' + tags + '</span></div>';
  }
  h += '</div>';
  el.innerHTML = h;
}

function addBubble(opts) {
  const main = $('cy-stage-main');
  if (!main) return;  // 面板已关·async 链残留调用静默丢弃
  const row = document.createElement('div');
  row.className = 'cy-bubble-row ' + (opts.kind || 'npc');
  let inner = '';
  if (opts.kind === 'system') {
    const sysCls = opts.sysKind ? (' ' + opts.sysKind) : '';
    inner = `<div class="cy-bubble-content"><div class="cy-bubble-text${sysCls}">${opts.text}</div></div>`;
  } else if (opts.kind === 'player') {
    inner = `<div class="cy-bubble-content"><div class="cy-bubble-meta">${(typeof _sovereignAddressTerm === 'function' ? _sovereignAddressTerm(typeof GM !== 'undefined' ? GM : null) : '陛下')}</div><div class="cy-bubble-text">${escHtml(opts.text)}</div></div>`;
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
    try { _cc3_setPresenter(opts.name); } catch(_) {}
  }
  // ─── 收集对话到 transcript·朝议结束写入 _courtRecords·供 AI 推演读取 ───
  try {
    if (!state._transcript) state._transcript = [];
    let role, speaker, text;
    if (opts.kind === 'player') { role = 'player'; speaker = (typeof _sovereignAddressTerm === 'function' ? _sovereignAddressTerm(typeof GM !== 'undefined' ? GM : null) : '陛下'); text = opts.text; }
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
    addBubble({ kind: 'system', text: '（朝会已散 · ' + (typeof _sovereignAddressTerm === 'function' ? _sovereignAddressTerm(typeof GM !== 'undefined' ? GM : null) : '陛下') + '还宫。）' });
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
  addBubble({ name: item.presenter, text: (typeof _sovereignAddressTerm === 'function' ? _sovereignAddressTerm(typeof GM !== 'undefined' ? GM : null) : '陛下') + '圣意未明 · 容臣再启：' + item.announceLine });
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
  addBubble({ kind: 'system', text: (function(){ var _s = (typeof _sovereignAddressTerm === 'function' ? _sovereignAddressTerm(typeof GM !== 'undefined' ? GM : null) : '陛下'); return '（' + _s + '举笏 · 待此官言毕即接' + _s + '之意。）'; })() });
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
  if (intent === 'mediate' || intent === 'doubt') {
    // 折中疑虑·首辅/资深重臣出来调和(取当前局在朝重臣·不写死天启韩爌)
    var _med = _cc3_seniorOfficial('');
    if (_med && !seen.has(_med)) { candidates.unshift(_med); seen.add(_med); }
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

  // 5) 闲人兜底·从当前局在朝者补(不写死天启韩爌/王永光/黄宗周等·别的剧本改补本朝人)
  _cc3_ambientNames(4).forEach(n => {
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

/**
 * 常朝大改 Slice 3·B 方案 fallback·若 traitIds 缺失·从 personality 字符串推 8D dims
 * 中等精度·~70%·覆盖绍宋等 traitIds 为空剧本
 */
function _cc3_inferDimsFromPersonalityText(text) {
  if (!text || typeof text !== 'string') return null;
  const dims = { boldness:0, compassion:0, rationality:0, greed:0, honor:0, sociability:0, vengefulness:0, energy:0 };
  let hits = 0;
  // boldness·勇敢度
  if (/勇敢|勇猛|刚直|刚毅|敢言|不畏|无畏|刚强|果敢|敢于|豪侠|忠勇|沉勇|武人|武勇|善战|骁勇|勇略|勇而|跋扈|彪悍/.test(text))     { dims.boldness += 0.4; hits++; }
  if (/怯懦|畏缩|胆小|怕事|避祸|懦弱|畏怯|软弱|优柔|柔弱/.test(text))                          { dims.boldness -= 0.4; hits++; }
  // compassion·仁善度
  if (/仁善|仁厚|宽仁|爱民|怜悯|不忍|心慈|恻隐|温顺|温和|和善/.test(text))                     { dims.compassion += 0.4; hits++; }
  if (/冷酷|冷漠|残忍|严苛|凉薄|薄情|狠辣|刻薄|无情|严酷|冷峻/.test(text))                              { dims.compassion -= 0.4; hits++; }
  // rationality·理性度
  if (/理性|务实|深思|审慎|稳重|冷静|权衡|计虑|计谋|沉稳|老成持重|机变|机敏|有谋|善守|城府|谨慎|识大体|识进退|不喜形色|节俭|聪慧|持重|聪明|精明|深沉|多谋|权术|老成/.test(text)) { dims.rationality += 0.4; hits++; }
  if (/冲动|偏激|急躁|莽撞|意气|轻率|昏聩|任性|暴躁|脾气暴/.test(text))                                   { dims.rationality -= 0.4; hits++; }
  // greed·贪心
  if (/贪|聚敛|好利|敛财|爱财|图利|逐利|风流/.test(text))                                     { dims.greed += 0.4; hits++; }
  if (/清廉|淡泊|寡欲|不贪|不慕|安贫|节俭|澹泊/.test(text))                                        { dims.greed -= 0.4; hits++; }
  // honor·名节
  if (/名节|气节|清议|清流|耿介|忠直|刚正|节操|大义|守节|贞节|贞烈|贞静|重然诺|忠诚|忠悃|清介|义气|有义|忠义|清雅|诚厚|本分|清正/.test(text)) { dims.honor += 0.5; hits++; }
  if (/失节|无耻|附阉|逢迎|苟合|圆滑/.test(text))                                             { dims.honor -= 0.4; hits++; }
  // sociability·社交
  if (/善交|结好|合群|和气|圆通|长袖善舞|好好先生/.test(text))                                { dims.sociability += 0.4; hits++; }
  if (/孤僻|寡言|不群|独行|孤介|闷葫芦|傲慢|骄横|孤高/.test(text))                                           { dims.sociability -= 0.4; hits++; }
  // vengefulness·复仇
  if (/睚眦必报|记仇|复仇|怀怨|心狭|心狠|险毒|阴狠|阴险|不择手段/.test(text))                                          { dims.vengefulness += 0.5; hits++; }
  if (/宽厚|能容|不计前嫌|大度|隐忍|坚韧/.test(text))                                          { dims.vengefulness -= 0.4; hits++; }
  // energy·精干
  if (/勤勉|精干|干练|励精|尽心|勤政|敏锐|急切|任事|事功|激切|激烈|极烈|锐意|性烈/.test(text))                                    { dims.energy += 0.4; hits++; }
  if (/懒散|怠政|拖沓|疏懒|脾性软弱/.test(text))                                              { dims.energy -= 0.4; hits++; }
  return hits > 0 ? dims : null;
}

/**
 * 常朝大改 Slice 3·orchestrator·先 TM.NpcEngine.aggregateDims·再 fallback B
 */
function _cc3_getDims(ch) {
  let dims = null;
  try {
    if (typeof window !== 'undefined' && window.TM && TM.NpcEngine && TM.NpcEngine.aggregateDims) {
      dims = TM.NpcEngine.aggregateDims(ch);
    }
  } catch (_) {}
  // 全 0 也算"无效"·走 fallback
  const allZero = dims && Object.values(dims).every(v => v === 0);
  if (!dims || allZero) {
    const inferred = _cc3_inferDimsFromPersonalityText(ch && ch.personality);
    if (inferred) {
      dims = inferred;
      dims._source = 'personality-text-fallback';  // debug 标识
    }
  } else if (dims) {
    dims._source = 'trait-aggregate';
  }
  return dims;
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

  // ⑥ 常朝大改 Slice 3·8D personality × 议题 tag 贡献·persona-first 而非 stat-first
  //    实际接入 tm-npc-engine.js 的 8D 聚合·tag 来自 Slice 2 推导
  //    fallback·若 traitIds 缺失 (绍宋等)·从 personality 字符串推 dims (B 方案)
  const dims = _cc3_getDims(ch);
  const tags = Array.isArray(item && item.tags) ? item.tags : [];
  if (dims) {
    // compassion·penal-harsh
    if (tags.indexOf('penal-harsh') >= 0) {
      if (dims.compassion >= 0.5)  score -= 0.30;   // 仁善强反对刑罚
      if (dims.compassion <= -0.5) score += 0.20;   // 冷酷支持严办
    }
    // honor·etiquette / ritual
    if (tags.indexOf('etiquette-violation') >= 0 && dims.honor >= 0.5) score += 0.30;  // 清流支持清算违礼
    if (tags.indexOf('ritual') >= 0 && dims.honor >= 0.5) score -= 0.25;   // 重名节·议题动礼制宁守旧
    // greed·reward-distribution
    if (tags.indexOf('reward-distribution') >= 0) {
      if (dims.greed >= 0.3)  score += 0.25;
      if (dims.greed <= -0.3) score -= 0.10;
    }
    // boldness·foreign-policy·强硬派立场两极化
    if (tags.indexOf('foreign-policy') >= 0) {
      // 党派已确定主战/主和方向·boldness 强化该方向
      if (dims.boldness >= 0.3 && score > 0)  score += 0.15;
      if (dims.boldness >= 0.3 && score < 0)  score -= 0.15;
      if (dims.boldness <= -0.3 && score > 0) score -= 0.10;  // 怯懦削弱主战
      if (dims.boldness <= -0.3 && score < 0) score += 0.10;  // 怯懦缓和主和
    }
    // vengefulness·target 涉旧仇 (查 AffinityMap·若 ≤ -20 算旧仇)
    if (item && item.target && typeof AffinityMap !== 'undefined' && AffinityMap.get) {
      try {
        const aff = AffinityMap.get(name, item.target);
        if (typeof aff === 'number' && aff <= -20 && dims.vengefulness >= 0.5) {
          // 议题针对的人 = 本人旧仇·支持治罪 / 反对宽宥
          if (tags.indexOf('penal-harsh') >= 0) score += 0.25;
          else                                  score -= 0.15;   // 议题为旧仇背书时反对
        }
      } catch (_) {}
    }
    // rationality·controversial ≥ 6·情绪化议题·理性者拉回中立
    if (item && item.controversial >= 6 && dims.rationality >= 0.5) {
      score *= 0.75;
    }
  }

  if (score >= 0.40) return 'support';
  if (score <= -0.30) return 'oppose';
  if (Math.abs(score) < 0.12) return 'neutral';
  return 'mediate';
}

// ============================================================
// 常朝大改 Slice 4·debate state + base mode 推导
// 让朝议从"群聊"升级为"对话"·6 mode·lead / second / rebut / soften / pivot / cite (modifier) / augment
// ============================================================

/** 同党判定·party 字段含义模糊 (可能是"主战派"·"东林"·"清流" 等)·走 substring 匹配 */
function _cc3_sameParty(chA, chB) {
  if (!chA || !chB) return false;
  const pa = (chA.party || '').trim();
  const pb = (chB.party || '').trim();
  if (!pa || !pb) return false;
  if (pa === pb) return true;
  // 子串匹配·例如 "主战派" ⊂ "主战·清流"
  if (pa.indexOf(pb) >= 0 || pb.indexOf(pa) >= 0) return true;
  // 进一步·若 ch.faction 同·也算同党
  if (chA.faction && chB.faction && chA.faction === chB.faction) {
    // 同 faction 但不同 party·算半同党·返 false 让 mode 走 soften
    return false;
  }
  return false;
}

/** 立场对立判定·只 support vs oppose 算对立·mediate/neutral 跟 support/oppose 均不算对立 */
function _cc3_oppositeStance(a, b) {
  if (!a || !b) return false;
  if (a === 'support' && b === 'oppose') return true;
  if (a === 'oppose' && b === 'support') return true;
  return false;
}

/** 判断·target 是否曾损害 ch 本人/同党·查 AffinityMap·若 ≤ -20 算旧仇 */
function _cc3_wasHarmedBy(ch, targetName) {
  if (!ch || !targetName) return false;
  if (typeof AffinityMap === 'undefined' || !AffinityMap.get) return false;
  try {
    const a = AffinityMap.get(ch.name, targetName);
    return typeof a === 'number' && a <= -20;
  } catch (_) {
    return false;
  }
}

/**
 * 分析当前 debate state·返 8 字段
 * 在 _cc3_aiGenReact 调用·此时 item.selfReact / item.debate 是已部分填充
 *
 * @param {Object} item       — 议程项
 * @param {string} speakerName — 当前 NPC 名
 * @param {Object} gmCh       — 当前 NPC 全数据 (findCharByName 结果)
 * @returns {Object} state·或 { priorCount:0, mode:'lead' }
 */
function _cc3_analyzeDebate(item, speakerName, gmCh) {
  if (!item || !speakerName || !gmCh) {
    return { priorCount: 0, lastSpeaker: null, myStance: 'neutral' };
  }
  // 收集 prior·只算 AI 生成过的·避免读 mock 模板
  const prior = ((item.selfReact || []).filter(r => r && r.name !== speakerName && r.line))
    .concat((item.debate || []).filter(d => d && d.name !== speakerName && d.line));

  // 推本人立场 (用 emperor intent 跨发言·若有)
  const myStance = _cc3_computeStanceFromChar(speakerName, item, item._lastEmperorIntent || 'neutral');

  if (!prior.length) {
    const _pn0 = (item && item.presenter) || null, _pu0 = _pn0 && _pn0 !== speakerName;
    return {
      priorCount: 0,
      lastSpeaker: null,
      presenterName: _pn0, refSame: _pu0 ? _pn0 : null, refOpp: _pu0 ? _pn0 : null,
      lastStance: null,
      lastSamePartyAsMe: false,
      myStance,
      sameStanceCount: 0,
      oppStanceCount: 0,
      alliesPiledOn: 0,
      alliesLost: 0,
      momentum: 'opening',
      emperorIntent: (item && item._lastEmperorIntent) || 'neutral',
    };
  }

  const last = prior[prior.length - 1];

  let sameStanceCount = 0, oppStanceCount = 0;
  let alliesPiledOn = 0, alliesLost = 0;
  prior.forEach(r => {
    if (r.stance === myStance) sameStanceCount++;
    if (_cc3_oppositeStance(r.stance, myStance)) oppStanceCount++;
    const rch = (typeof CHARS !== 'undefined') ? CHARS[r.name] : null;
    if (_cc3_sameParty(rch, gmCh)) {
      if (r.stance === myStance) alliesPiledOn++;
      if (_cc3_oppositeStance(r.stance, myStance)) alliesLost++;
    }
  });

  // 阵营态势 (近 3 位)
  const last3 = prior.slice(-3);
  const last3Same = last3.filter(r => r.stance === myStance).length;
  const last3Opp = last3.filter(r => _cc3_oppositeStance(r.stance, myStance)).length;
  let momentum;
  if (last3Same >= 2) momentum = 'consensus-with-me';
  else if (last3Opp >= 2) momentum = 'consensus-against-me';
  else momentum = 'split';

  // 参照锚(修「附议/驳斥」张冠李戴):朝议围绕主奏人[presenter]之议·second(附议)指向与我同立场者·rebut/soften/confront(驳斥)指向异己者·均优先主奏人·兜底沿用 lastSpeaker(不劣旧行为)
  const presenterName = (item && item.presenter) || null;
  const _presUsable = presenterName && presenterName !== speakerName;
  let refSame = null, refOpp = null;
  if (_presUsable) {
    if (myStance === 'oppose') refOpp = presenterName;   // 我反对本议→驳斥锚=主奏人(其奏)
    else refSame = presenterName;                        // 我支持/折中/中立→附议锚=主奏人
  }
  for (let _i = prior.length - 1; _i >= 0; _i--) {        // prior 补:最近的同/异立场发言者
    const _r = prior[_i]; if (!_r) continue;
    if (!refSame && _r.stance === myStance) refSame = _r.name;
    if (!refOpp && _cc3_oppositeStance(_r.stance, myStance)) refOpp = _r.name;
    if (refSame && refOpp) break;
  }
  refSame = refSame || last.name || presenterName || null;
  refOpp = refOpp || last.name || presenterName || null;

  return {
    priorCount: prior.length,
    lastSpeaker: last.name,
    presenterName, refSame, refOpp,
    lastStance: last.stance,
    lastSamePartyAsMe: _cc3_sameParty((typeof CHARS !== 'undefined') ? CHARS[last.name] : null, gmCh),
    myStance,
    sameStanceCount, oppStanceCount,
    alliesPiledOn, alliesLost,
    momentum,
    emperorIntent: (item && item._lastEmperorIntent) || 'neutral',
  };
}

/**
 * 6 base mode 推导·基于 debate state + 议题 context
 * mode·lead / second / rebut / soften / pivot / augment·cite 作为 modifier
 *
 * 注意·persona modulation 在 Slice 5 的 _cc3_modulateModeByPersona 内做·此处只产 base
 */
function _cc3_baseMode(state, gmCh, item) {
  // 2026-05-23 fix·原 default = 'augment' 导致 augment 成吸盘·全场塌缩
  // 改 default 为 'pivot' (pivot 也补充·不锁开场词)·中立分发 3 mode·avoid 单 mode 兜底
  if (!state || !gmCh) return 'pivot';

  // 自辩短路·议题点名你·必 rebut (借模式自辩)
  if (item && item.target === gmCh.name) return 'rebut';

  // 首发
  if (state.priorCount === 0) return 'lead';

  // 同党同立场 → second
  if (state.lastSamePartyAsMe && state.lastStance === state.myStance) return 'second';

  // 异党异立场 (support vs oppose) → rebut
  if (!state.lastSamePartyAsMe && _cc3_oppositeStance(state.lastStance, state.myStance)) return 'rebut';

  // 同党异立场 → soften (婉言劝)
  if (state.lastSamePartyAsMe && state.lastStance !== state.myStance) return 'soften';

  // 中立态度·非首发 → 3 mode 均分 (原 50/50 pivot/augment 改 40/30/30 second/pivot/augment)
  if (state.myStance === 'neutral') {
    const r = Math.random();
    if (r < 0.40) return 'second';   // 中立倾向跟随 (新加)
    if (r < 0.70) return 'pivot';
    return 'augment';
  }

  // 默认·非对立 / 非同党 / 非中立·3 mode 均分 (原 100% augment 改)
  // 历史上"补充新角度"既可 augment·也可 second·也可 pivot
  const r = Math.random();
  if (r < 0.40) return 'second';
  if (r < 0.70) return 'pivot';
  return 'augment';
}

// ============================================================
// 常朝大改 Slice 5·persona modulation + tone modulation + 朝堂语词库
// ============================================================

/**
 * 15 条 8D persona × 议题 tag 修正表·调整 base mode
 * 见 chaoyi-npc-dialogue-design-v3.md §4
 *
 * @param {string} mode  — base mode
 * @param {Object} gmCh  — NPC 全数据
 * @param {Object} item  — 议程·含 tags / target / controversial
 * @param {Object} state — debate state·含 oppStanceCount / alliesLost / lastSpeaker
 * @returns {Object} { mode: 修正后 mode, modifiers: { cite: bool, force: bool, source: string } }
 */
function _cc3_modulateModeByPersona(mode, gmCh, item, state) {
  const result = { mode, modifiers: { cite: false, force: false, source: '' } };
  const dims = _cc3_getDims(gmCh);
  if (!dims) return result;
  result.modifiers.source = dims._source || 'unknown';

  const tags = Array.isArray(item && item.tags) ? item.tags : [];

  // ─── 强制规则 (force·覆盖 base mode·按维度数值高者优先) ───
  const forceCandidates = [];

  // honor·议题涉宗庙/礼制 (ritual)
  if (dims.honor >= 0.7 && tags.indexOf('ritual') >= 0) {
    forceCandidates.push({ rank: dims.honor, mode: 'rebut', reason: 'honor ≥0.7 + ritual·宗庙不可' });
  }
  // honor·议题 etiquette-violation·即便同党也清算
  if (dims.honor >= 0.5 && tags.indexOf('etiquette-violation') >= 0) {
    forceCandidates.push({ rank: dims.honor, mode: 'rebut', reason: 'honor ≥0.5 + etiquette-violation·清议派清算' });
  }
  // compassion·议题 penal-harsh·即便异党异立场·强 soften
  if (dims.compassion >= 0.5 && tags.indexOf('penal-harsh') >= 0) {
    forceCandidates.push({ rank: dims.compassion, mode: 'soften', reason: 'compassion ≥0.5 + penal-harsh·仁善慎刑' });
  }
  // vengefulness·target = 旧仇
  if (dims.vengefulness >= 0.7 && item && item.target && _cc3_wasHarmedBy(gmCh, item.target)) {
    forceCandidates.push({ rank: dims.vengefulness, mode: 'rebut', reason: 'vengefulness ≥0.7 + target=旧仇·必驳' });
  }
  // boldness·target = self·自辩硬刚
  if (dims.boldness >= 0.7 && item && item.target === gmCh.name) {
    forceCandidates.push({ rank: dims.boldness, mode: 'lead', reason: 'boldness ≥0.7 + target=self·硬刚自辩' });
  }
  // greed·议题涉自身/亲族利益 — runtime 难判·仅 reward-distribution tag 替代
  if (dims.greed >= 0.5 && tags.indexOf('reward-distribution') >= 0) {
    forceCandidates.push({ rank: dims.greed, mode: 'second', reason: 'greed ≥0.5 + reward·主动争取' });
  }

  if (forceCandidates.length) {
    forceCandidates.sort((a, b) => b.rank - a.rank);
    result.mode = forceCandidates[0].mode;
    result.modifiers.force = true;
    result.modifiers.reason = forceCandidates[0].reason;
    // 仍可能加 cite·下一步判
  }

  // ─── cite modifier (不替换 mode·补 modifier) ───
  if (dims.rationality >= 0.5 && tags.indexOf('historicalPrecedent') >= 0) {
    result.modifiers.cite = true;
  }

  // ─── 弱修正·只在 force=false 时生效·按 仁善 > 复仇 > 理性 > 名节 > 社交 顺序 ───
  if (!result.modifiers.force) {
    // compassion ≥ 0.3·base rebut + oppStanceCount < 3 → soften
    if (mode === 'rebut' && dims.compassion >= 0.3 && (!state || state.oppStanceCount < 3)) {
      result.mode = 'soften';
      result.modifiers.reason = 'compassion ≥0.3·base rebut → soften·阵营未失势';
    }
    // vengefulness ≥ 0.5·上一位曾损害本人·second/augment → rebut
    else if ((mode === 'second' || mode === 'augment') && dims.vengefulness >= 0.5 && state && state.lastSpeaker) {
      if (_cc3_wasHarmedBy(gmCh, state.lastSpeaker)) {
        result.mode = 'rebut';
        result.modifiers.reason = 'vengefulness ≥0.5 + last=旧仇·second/aug → rebut';
      }
    }
    // sociability ≥ 0.5·alliesLost ≥ 2 + base rebut → soften (找台阶)
    else if (mode === 'rebut' && dims.sociability >= 0.5 && state && state.alliesLost >= 2) {
      result.mode = 'soften';
      result.modifiers.reason = 'sociability ≥0.5 + alliesLost ≥2·找台阶 → soften';
    }
    // energy ≥ 0.5·execution-detail tag·augment / pivot → pivot to specific
    else if ((mode === 'augment' || mode === 'pivot') && dims.energy >= 0.5 && tags.indexOf('execution-detail') >= 0) {
      result.mode = 'pivot';
      result.modifiers.reason = 'energy ≥0.5 + execution-detail·提具体方案';
    }
  }

  return result;
}

/**
 * 5 tone·按 rank / class 选语气层
 * 不改 mode·只调语言风格
 */
function _cc3_pickTone(gmCh) {
  if (!gmCh) return 'default';
  if (gmCh.class === 'kdao')  return 'righteous';  // 言官·激烈
  if (gmCh.class === 'wuchen') return 'martial';   // 武臣·粗朴
  if (gmCh.class === 'houfei') return 'decorum';   // 后妃·婉转
  if (typeof gmCh.rank === 'number' && gmCh.rank <= 2) return 'gravitas';  // 阁臣·稳重
  if (typeof gmCh.rank === 'number' && gmCh.rank >= 5) return 'procedural';// 郎官以下·程序化
  return 'default';
}

/**
 * 朝堂语 instruction 库·6 mode × 池
 * 每 mode 给 2-3 个开头池 + 1-2 个结句池·LLM 任选风格
 */
const _CC3_PHRASE_POOLS = {
  lead: {
    opens: ['"陛下·臣窃以为..."', '"陛下·臣有一议·愿陈之..."', '"启奏陛下·臣谨议..."'],
    closes: ['"伏乞圣裁"', '"伏惟陛下察焉"', '"臣谨奏闻"'],
    structure: '开门见山·提出你的主张并给出 1 条理由',
    requireWords: ['臣'],   // 不再强制"陛下"·君上称谓依【称谓感知】本朝语境(宋→官家)
    requireEither: ['窃以为', '有一议', '谨议', '愚以为'],
    requireClose: ['圣裁', '察焉', '奏闻', '俯纳'],
    example: '陛下·臣窃以为边镇之危·非一日之积。若不即拨饷增兵·恐有崩溃之患。伏乞圣裁。',
    selfCheck: ['是否含"臣"+本朝君上称谓(依称谓感知·如宋作官家·勿硬套陛下)', '是否以"窃以为/有一议/谨议"之类开题', '是否给出 1 条具体理由 (非空泛)', '结句是否含"圣裁/察焉/奏闻"'],
  },
  second: {
    opens: ['"臣附 X 之议·"', '"X 公所言甚是·臣亦以为..."', '"X 公已具陈·臣略补一条..."'],
    closes: ['"不啻 X 之言·愿陛下俯纳"', '"附 X 公之议·伏乞圣裁"'],
    structure: '复述 X 论点 1 句 + 1 条新理由 / 案例·不可全文重复其说',
    requireWords: ['附', 'X'],  // X 会被 lastSpeaker 替换
    requireEither: ['附议', '所言甚是', '亦以为', '正合臣意'],
    requireClose: ['俯纳', '圣裁', '察焉'],
    example: '臣附李公之议·李公方言"宗庙犹存·岂可南幸"·诚为正论。臣再补一条·汴京一失·河朔豪杰必散。愿陛下俯纳。',
    selfCheck: ['是否含"附议/亦以为/所言甚是"附议词', '是否复述 X 论点 1 句', '是否补充 1 条新理由 (非全文重复)', '是否点 X 的名字'],
  },
  rebut: {
    opens: ['"臣窃以为 X 所言未当·"', '"X 公方言...·然臣 不敢同其议..."', '"X 公此论·臣有惑焉..."'],
    closes: ['"伏惟陛下明察·勿堕其策"', '"愚见如此·伏乞圣裁"', '"伏乞陛下察其谬"'],
    structure: '先复述 X 论点 1 句·再用"然/惟/不敢同/未当"转折·给反驳理由 1-2 句',
    requireWords: ['X'],  // X 会被 lastSpeaker 替换·rebut 必须点名
    requireEither: ['然', '惟', '不敢同', '未当', '臣有惑', '臣窃以为不可'],  // 必含转折之一
    requireClose: ['明察', '勿堕', '察其谬', '圣裁'],
    forbidden: ['陛下圣明', '诚为至论', '确为正论'],  // rebut 禁出现空泛附和
    example: '黄相方言"扬州可幸"·然臣窃以为未当。汴京未陷·宗庙犹存·岂可一去千里？金人闻之·必谓宋有畏心。伏惟陛下明察·勿堕其策。',
    selfCheck: ['是否复述对方论点 1 句 (含引号或冒号)', '是否含转折词"然/惟/不敢同/未当"之一', '是否给出 ≥1 条反驳理由 (非空泛)', '是否点名对方', '结句是否含"明察/勿堕/察其谬"'],
  },
  soften: {
    opens: ['"X 公忠悃可嘉·惟..."', '"X 公此心拳拳·然臣愚以为..."', '"X 公所议出于公心·惟一节有疑..."'],
    closes: ['"望陛下兼听·权宜处之"', '"伏乞陛下并察"', '"望陛下圣裁兼采"'],
    structure: '先肯定 X 动机或忠诚 1 句 (用"忠悃/拳拳/出于公心")·再婉言陈己见',
    requireWords: ['X'],
    requireEither: ['忠悃', '拳拳', '公心', '此心', '出于'],  // 必含肯定 X 动机的词
    requireClose: ['兼听', '并察', '兼采', '权宜'],
    example: '宗公忠悃可嘉·一片孤忠诚为可敬。惟今金兵迫近·若死守汴梁恐被困城中。望陛下兼听·权宜处之。',
    selfCheck: ['是否先肯定 X 动机/忠诚 1 句', '是否含"忠悃/拳拳/公心/此心"之一', '是否含转折"惟/然"', '是否给出己见', '结句是否含"兼听/并察/兼采"'],
  },
  pivot: {
    // 2026-05-23 fix·扩 opens 10 句·删 "诸臣所议皆当" 高频套话
    opens: [
      '"此议尚有一端未及..."',
      '"事关 X·或可交 Y 部详议..."',
      '"臣窃以为·此事宜先交有司勘明..."',
      '"前议甚详·然有一节·宜专议..."',
      '"臣观此议·建议先交户部 / 兵部 / 礼部勘报..."',
      '"案此·尚有一节未明·宜专责一员..."',
      '"陛下·臣以为·此事须先勘报·再议..."',
      '"臣愚以为·此议宜分两节·先...后..."',
      '"前议未及之处·臣略陈宜专责..."',
      '"案此·宜先勘明 X·再议 Y..."'
    ],
    closes: ['"俟有定论·再呈陛下"', '"伏乞陛下命有司详议"', '"伏祈陛下察议"'],
    structure: '提议题未被讨论的侧面·或建议交某部 / 三法司 / 都察院 / 户部 再议·避免直接表态·**必含具体部门名 + 具体待勘事项**',
    requireEither: ['尚有', '未及', '另有', '交.{0,3}部', '交有司', '详议', '勘报', '专议', '专责'],
    requireClose: ['有司', '俟有定论', '详议', '勘报', '察议'],
    forbidden: [
      '臣以为应',         // pivot 禁鲜明立场
      '臣坚决主张',
      '诸臣所议皆当',     // 高频套话·禁
      '诸臣所议皆有理',
      '前文已多有陈说'
    ],
    // 5 example 分发
    example: [
      '此议尚有一端未及·禁旅兵粮可支几日尚未勘明。请陛下命兵部户部详议·俟有定论·再呈陛下。',
      '案此·尚有一节未明·某镇近月催饷三次·宜专责户部勘报·再议。',
      '事关诸边·或可交兵部 + 户部会议·勘明各镇粮草余存·再定优先次序。伏乞陛下命有司详议。',
      '臣愚以为·此议宜分两节·先勘明各部欠饷数·再议如何补给。伏祈陛下察议。',
      '前议甚详·然有一节·宜专责有司先按察漕运实情·再议海运是否可行。俟有定论·再呈陛下。'
    ],
    selfCheck: [
      '是否含 "尚有 / 未及 / 另有 / 专议 / 专责" 提新侧面',
      '是否建议交某部 / 有司详议 (必含具体部门名)',
      '是否避免直接战和表态',
      '是否避开 "诸臣所议皆当" / "诸臣所议皆有理" 等高频套话',
      '结句是否含 "详议 / 勘报 / 俟定论 / 察议"'
    ],
  },
  augment: {
    // 2026-05-23 fix·删 "诸臣所议皆有理" / "前文已多有陈说" 高频套话·扩 15 句轮替
    opens: [
      '"案此事·尚有一隅未及..."',
      '"臣窃见前议·缺一关键..."',
      '"臣略备一议·与诸公参..."',
      '"臣观此议·尚有数事可补..."',
      '"前议未及者·臣谨陈..."',
      '"诸公所论·臣略附数语..."',
      '"陛下·臣有数事·恐前议未及..."',
      '"臣案此事·有一隅·诸公或未察..."',
      '"臣窃以为·尚需补一议..."',
      '"案前文·有一未明处·臣略言之..."',
      '"臣略备一议·非敢与诸公争..."',
      '"前议甚详·然臣仍有一议..."',
      '"臣观此议·有一节·宜进一步勘明..."',
      '"案此·尚需一议..."',
      '"诸公论已尽·臣略陈一隅..."'  // 原 3 旧句保留 1 句作变体
    ],
    closes: ['"伏惟陛下察焉"', '"愿与诸臣共商"', '"伏祈陛下俯察"', '"伏请陛下圣裁"'],
    structure: '补充一个未被前文提及的【具体视角】·**必须含 1+ 具体名词 (兵名 / 粮草数 / 边镇名 / 人名 / 数字 / 日期 / 部门)**·禁纯虚词附议·禁全文重复前位',
    requireEither: ['尚有', '补一议', '略陈', '一议', '未及', '尚需', '一节', '一隅'],
    requireClose: ['察焉', '共商', '俯察', '圣裁'],
    forbidden: [
      '诸臣所议皆有理',       // 高频套话·禁
      '前文已多有陈说',       // 高频套话·禁
      '诸臣所议皆当',         // pivot 套话漏到此·禁
      '臣所议皆有理',         // 变体·禁
      '诸公所议皆有理'        // 变体·禁
    ],
    // 5 example 按 topic 分发·避全 LLM 学同 1 个
    example: [
      '臣窃见·边镇兵粮可支三月·然要塞粮仓近罄·若延误半月·军心必乱。臣略陈此一议。伏惟陛下察焉。',
      '前议甚详·然臣仍有一议·某镇守将本月内三次催饷·若不应·恐将士寒心。伏惟陛下察焉。',
      '诸公论已尽·臣略陈一隅·京师米价已涨三倍·用度若不收缩·恐生民变。伏惟陛下察焉。',
      '案此事·尚有一隅未及·某言官近日所上劾权幸一疏·与本议有关·宜并审之。伏祈陛下俯察。',
      '臣略备一议·与诸公参·漕运近来缺船·若转输不通·三月内南粮不能至京。伏请陛下圣裁。'
    ],
    selfCheck: [
      '是否提供 1+ 具体名词 (兵 / 粮 / 钱 / 边镇名 / 人名 / 数字)·非纯虚词',
      '是否避开 "诸臣所议皆有理" / "臣前文已多有陈说" / "诸臣所议皆当" 等高频套话',
      '是否避免全文重复前位发言',
      '结句是否含 "察焉 / 共商 / 俯察 / 圣裁"'
    ],
  },

  // ═══════════════ v2.6 Slice 5·廷议特化 4 mode (confront / cite_classic / clientelism / martyr) ═══════════════
  // 按常朝 8 字段 paradigm·跟上 6 mode 一致 (opens / closes / structure / requireEither / requireClose / forbidden / example / selfCheck)
  // 复用前提·廷议跟常朝共用 _cc3_buildModeInstruction·因此可放在同 MODES_TEMPLATE 内
  confront: {
    opens: [
      '"X 公此论·恕臣不能附"',
      '"X 公方才所言"',
      '"愿与 X 公辩之"',
      '"X 公适才之论·臣有数处不能附"',
      '"X 公此说·恐未尽是·臣略辩一二"',
      '"X 公方才所陈·与臣所见相左"',
      '"窃以为 X 公之论·尚有商榷之处"',
      '"X 公之议·虽出公心·然臣不能默"',
      '"敢请 X 公·容臣一辩"',
      '"X 公此言·恐失之偏"',
      '"X 公论锐·然臣有 X 处不能附"',
      '"臣以为 X 公此议·失之 X (操切/迂腐/...)·略陈一二"'
    ],
    closes: ['"伏请陛下察"', '"伏惟圣鉴"', '"惟陛下裁断"', '"敢请陛下听臣此辩"'],
    structure: '直接点名 {targetName}·正面驳其论·**必含 1+ 具体论点反驳** (数 / 例 / 古今对照 / 后果分析)·禁空泛附议·禁不指名',
    requireEither: ['具体论点反驳', '历史先例对比', '数据 / 后果分析'],
    requireClose: ['察', '圣鉴', '裁断', '听臣此辩'],
    forbidden: ['空泛附议', '不指名', '我亦如是', '诸臣所议皆有理'],
    example: [
      '某公方才言重狱有功·然臣按律考之·三月狱中有 12 人无供而毙·此非"有功"·乃失驭。伏请陛下察。',
      '某公方才论宜据守孤城·然臣观舆图·此城孤悬·若无后军接应·恐重蹈前役覆辙。伏惟圣鉴。',
      '某公议主和·然臣观敌意·非真和也·乃缓我备战。岁内强敌已三次南下·岂可再信。惟陛下裁断。',
      '某公方才言宜宽权幸旧党·然彼当政时·横死诏狱者凡 6 人·此仇未报·何谈宽宥。伏请陛下察。',
      '某公此议虽出公心·然臣以为不可·边镇每月饷银 12 万·若再加调·京师月入仅 18 万·恐有断粮之危。敢请陛下听臣此辩。'
    ],
    selfCheck: ['是否真点名对方', '是否含 1+ 具体论点反驳 (数 / 例 / 后果)', '是否避空泛附议', '是否非"我亦如是"套话']
  },

  cite_classic: {
    opens: [
      '"《尚书》云"',
      '"《大学衍义》载"',
      '"昔者..."',
      '"《通鉴》载..."',
      '"《左传》有云..."',
      '"《孟子》尝言..."',
      '"按《周礼》..."',
      '"《史记》载..."',
      '"洪范九畴·有曰..."',
      '"昔太祖立国之初..."',
      '"昔魏徵之于太宗·有言..."',
      '"昔诸葛武侯出师·尝陈..."'
    ],
    closes: ['"伏祈陛下鉴此古训"', '"愿陛下取法古人"', '"伏请陛下追述"', '"以古为鉴"'],
    structure: '援经引典·**必含书名** (《尚书》《大学衍义》《通鉴》《左传》《孟子》等)·1 经 + 1 史·禁现代词汇·禁无出处',
    requireEither: ['书名', '"昔者" / "古人"'],
    requireClose: ['鉴此', '取法', '追述', '为鉴'],
    forbidden: ['现代词汇', '无书名', '无出处', '空白引经'],
    example: [
      '《尚书·洪范》云：唯辟作福·唯辟作威。陛下若委此权于近幸·乃辟权下移·非治道也。伏祈陛下鉴此古训。',
      '昔诸葛武侯出师·誓诛奸佞·正风纪。今用事之权阉·蠹国已甚·其罪岂可不诛。愿陛下取法古人。',
      '《孟子》尝言：民为贵·社稷次之·君为轻。今近畿大旱·百姓菜色·若再加征赋·恐失民心。伏请陛下追述。',
      '昔魏徵之于太宗·有言：兼听则明·偏信则暗。今独委权一党·有偏信之嫌。以古为鉴。',
      '《通鉴》载汉宣帝中兴·先举贤良·后行变法。今宜先选官·勿急于改制。伏祈陛下鉴此古训。'
    ],
    selfCheck: ['是否含书名', '是否 1 经 1 史', '是否避现代词汇', '出处是否真 (非杜撰)']
  },

  clientelism: {
    opens: [
      '"先师 {mentorName} 之论"',
      '"门生不敢异于先师"',
      '"门人但奉先师所授"',
      '"先师 {mentorName} 议已尽·门人不敢异"',
      '"门生既受先师 {mentorName} 之教·岂敢违"',
      '"先师 {mentorName} 之言·门生服膺"',
      '"先师所示·门人未敢有他"',
      '"门生此议·实先师 {mentorName} 旧训"',
      '"门生奉先师之教·所论与先师同"',
      '"先师论此已周·门生附议"'
    ],
    closes: ['"门生再拜"', '"惟陛下察先师之心"', '"门人不敢有他议"', '"伏请陛下听门生此附"'],
    structure: '附议师·**必含 mentor 名**·"先师 X 论已尽·门人不敢异"·禁直接反驳师·禁立独议',
    requireEither: ['mentor 名', '"门生" / "门人"'],
    requireClose: ['再拜', '察先师', '有他议', '听门生'],
    forbidden: ['直接反驳师', '"先师此议恐未尽" 之类否定', '立独议'],
    example: [
      '先师某公尝论朋党之弊·门生不敢异。今所议·先师所未及·然以先师风骨·必应主严办。门生再拜。',
      '先师方才所陈钱粮事·门人但奉所授·略附数语·边镇兵饷今急·宜按先师议先调其半。惟陛下察先师之心。',
      '先师素以恢复为志·门生岂敢与异。今强敌压境·必战不可和·门生奉师议。门人不敢有他议。',
      '先师之论考课之法·门生服膺·今宜复其旧·以察吏治。门生再拜。',
      '门生既受先师之教·岂敢违·此议实先师旧训·门人附议而已。伏请陛下听门生此附。'
    ],
    selfCheck: ['是否含 mentor 名 (替换 {mentorName})', '是否含 "门生" 或 "门人"', '是否避直接反驳师', '结句是否含 "再拜" / "察先师" 之类']
  },

  martyr: {
    opens: [
      '"臣愿伏阙"',
      '"臣冒死直谏"',
      '"以死谏陛下"',
      '"臣不惧斧钺·愿一言之"',
      '"臣虽万死·不敢欺陛下"',
      '"陛下若不听·臣愿撞死阶下"',
      '"臣以血书此疏·伏请陛下察"',
      '"臣身之所悬·惟天与陛下"',
      '"臣闻直臣不避死·愿冒万死一谏"',
      '"臣此言出·必触怒陛下·然臣不敢不言"',
      '"宁可碎首·不肯顺非"',
      '"臣愿以颈血·溅此朝堂"'
    ],
    closes: ['"虽千万人吾往矣"', '"臣不惧斧钺"', '"惟陛下取臣首"', '"臣以此万死·乞陛下察"'],
    structure: '言官冒死直谏·**尖锐 + 不留余地**·必含 honor-driven 言辞·必含死字 / 诛字 / 斧钺·直陈陛下错',
    requireEither: ['"死" / "诛" / "斧钺" / "万死"', '"陛下" + 直陈错 (如 "陛下纵奸" / "陛下偏听")'],
    requireClose: ['吾往矣', '不惧斧钺', '取臣首', '万死'],
    forbidden: ['含糊', '迂回', '"伏惟陛下察焉" 等温和套话', '空骂无据'],
    example: [
      '臣愿伏阙·陛下委权近幸·必致天下倾覆。若不去此奸·则士心尽失·宁可碎首·不肯顺非·虽千万人吾往矣。',
      '臣冒死直谏·陛下偏听私党·已三月不纳直言。臣此言出·必触陛下怒·然不言则负士林。宁可碎首·惟陛下取臣首。',
      '臣以血书此疏·边镇之败·非将不效命·乃饷不及时·责在有司。陛下若再迟·边军必反·臣不惧斧钺·乞陛下察。',
      '陛下若不听臣此谏·愿撞死阶下。今奸党羽翼布满诸曹·岂可再容。臣以此万死·乞陛下察。',
      '臣闻直臣不避死·愿冒万死一谏。和议必失故土·此耻遗千载之恨·虽千万人吾往矣。'
    ],
    selfCheck: ['是否含死字 / 诛字 / 万死 / 斧钺', '是否直陈陛下错 (非含糊)', '是否避温和套话 (察焉 / 共商)', 'cooldown·1 议题 1 次 (Slice 6 RULES 强制)']
  }
};

const _CC3_TONE_HINTS = {
  gravitas:   '语气稳重委婉·先复对方论点 2 句以示尊重·再陈己见·末加"伏乞圣裁"',
  procedural: '不直接驳·宜建议"交 [部/院] 详议"·或"请陛下命有司勘查"',
  righteous:  '言官风骨·直陈不讳·可点名对方·语气激烈但不失体·朝堂语带"风闻奏事"',
  martial:    '武臣口吻·粗朴直白·少修辞·多军事术语·短句·避免文饰·自称"末将"',
  decorum:    '自抑·先言"妾不当与议"·后言"惟臣妾愿陈一二"·语气婉转重礼',
  default:    '标准朝堂奏对体·"臣……"开头',
};

/**
 * 拼装 prompt 段·6 mode × 5 tone × cite modifier
 * v3.1 polish·加 verb pool / forbidden / example / 自检·从弱约束改强约束
 * 返字符串·拼到 _cc3_aiGenReact 原 prompt 后
 */
function _cc3_buildModeInstruction(modeResult, tone, state, gmCh) {
  const mode = modeResult.mode;
  const pool = _CC3_PHRASE_POOLS[mode] || _CC3_PHRASE_POOLS.augment;
  const toneHint = _CC3_TONE_HINTS[tone] || _CC3_TONE_HINTS.default;

  // mode-specific opener·若 state 含 lastSpeaker·替换 X
  // ★修张冠李戴:参照人按 mode 选·second(附议)→同立场锚 refSame·rebut/soften/confront(驳斥)→异己锚 refOpp(均优先主奏人)·余 mode 沿用 lastSpeaker
  let _refName = state && state.lastSpeaker ? state.lastSpeaker : '前位';
  if (state) {
    if (mode === 'second' && state.refSame) _refName = state.refSame;
    else if ((mode === 'rebut' || mode === 'soften' || mode === 'confront') && state.refOpp) _refName = state.refOpp;
  }
  const lastName = _refName;
  // v2.6 polish·Round 5·clientelism mode·{mentorName} 真替换·非 literal text 留 prompt
  const mentorName = (gmCh && gmCh.mentor) || (state && state.mentorName) || '先师';
  const _swap = function(s) { return String(s || '').replace(/X/g, lastName).replace(/\{mentorName\}/g, mentorName); };
  const opens = pool.opens.map(_swap).join(' / ');
  const closes = pool.closes.map(_swap).join(' / ');
  // 2026-05-23 fix·example 支持 string | string[]·数组时随机挑 1·避全 LLM 学同 1 个 (augment / pivot 已改 array)
  let example;
  if (Array.isArray(pool.example)) {
    const pick = pool.example[Math.floor(Math.random() * pool.example.length)];
    example = _swap(pick);
  } else {
    example = _swap(pool.example);
  }

  let p = '\n── 你的应答策略·必须严格遵守 ──\n';
  p += '【模式·' + mode + '·rebut=驳斥 / second=附议 / soften=缓和 / pivot=转移 / augment=补充 / lead=首发 / confront=对质 / cite_classic=援典 / clientelism=门生附师 / martyr=死谏】\n';
  // v2.6 polish·Round 5·structure 也 {mentorName} 替换 (clientelism mode)
  p += '内容范式·' + _swap(pool.structure) + '\n';
  p += '【语气】' + toneHint + '\n';

  // ── 必含词约束 ──
  if (Array.isArray(pool.requireEither) && pool.requireEither.length) {
    const reqList = pool.requireEither.map(w => '"' + _swap(w) + '"').join(' / ');
    p += '【必含·开题转折】回应中至少含以下之一·' + reqList + '\n';
  }
  if (Array.isArray(pool.requireClose) && pool.requireClose.length) {
    const closeList = pool.requireClose.map(w => '"' + w + '"').join(' / ');
    p += '【必含·结句】结句须含以下之一·' + closeList + '\n';
  }
  if (Array.isArray(pool.forbidden) && pool.forbidden.length) {
    p += '【禁止】不得出现·' + pool.forbidden.map(w => '"' + w + '"').join(' / ') + '\n';
  }

  // ── 候选开头/结句池 (示例·非强制) ──
  p += '朝堂语开头候选·' + opens + '\n';
  p += '朝堂语结句候选·' + closes + '\n';
  // ★引名务确·防张冠李戴(second/rebut/soften/confront 会点名对方)
  if (state && (mode === 'second' || mode === 'rebut' || mode === 'soften' || mode === 'confront') && lastName && lastName !== '前位') {
    p += '【引名务确】本议主奏为「' + (state.presenterName || '') + '」·你' + (mode === 'second' ? '附议(同调)' : '驳斥(异议)') + '的对象是「' + lastName + '」·凡引某人之言必系于其本人·切勿张冠李戴（勿把甲之奏折/原话安到乙头上）\n';
  }

  // ── few-shot example (1 句完整结构) ──
  if (example) {
    p += '【完整范例】(结构参照·勿照抄词汇)·\n  「' + example + '」\n';
  }

  // ── cite modifier ──
  if (modeResult.modifiers.cite) {
    p += '【援引】此议有先例可援·你理性高·可在论述中带入一段史事 (如汉光武渡江 / 唐玄宗幸蜀)·作类比·末加"古今同道·惟陛下察焉"\n';
  }
  // force reason debug
  if (modeResult.modifiers.force) {
    p += '【强约束·' + (modeResult.modifiers.reason || '强制') + '】\n';
  }

  // dims source debug (只在 fallback 时标·便于 sprint summary 对比)
  if (modeResult.modifiers.source === 'personality-text-fallback') {
    p += '【debug·persona dims 来自 personality 字符串 fallback·非 traitIds 聚合】\n';
  }

  // ── 自检 ──
  if (Array.isArray(pool.selfCheck) && pool.selfCheck.length) {
    p += '【生成后自检·任一为否则重写】\n';
    pool.selfCheck.forEach((q, i) => {
      p += '  ' + (i + 1) + '. ' + q.replace(/X/g, lastName) + '\n';
    });
  }

  p += '\n你必须严格遵循上述「' + mode + '」模式·上述【必含】【禁止】【自检】是硬约束·脱离 = 生成失败·须重写。\n';

  return p;
}

// ============================================================
// 常朝大改 Slice 6·anti-monotony guards + NPC-NPC AffinityMap linkage
// ============================================================

/**
 * 4 anti-monotony guards·防 mode 分布塌缩
 *
 * @param {string} mode  — modulated mode
 * @param {Object} item  — 议程·读 selfReact / debate 已有 mode 分布
 * @param {string} role  — 'self' | 'debate' | 'debate2'
 * @param {string} lastMode — 上一位 NPC 的 mode (若 prior 有 _mode 字段)
 * @returns {string} final mode·可能被 guards 改写
 */
function _cc3_applyModeGuards(mode, item, role, lastMode) {
  // 收集本议程 prior 已有 mode
  const modesSoFar = []
    .concat((item.selfReact || []).map(r => r && r._mode).filter(Boolean))
    .concat((item.debate || []).map(d => d && d._mode).filter(Boolean));
  const counts = {};
  modesSoFar.forEach(m => { counts[m] = (counts[m] || 0) + 1; });

  // 2026-05-23 fix·Guards 解吸盘·augment 不再吸所有 mode·分流到 pivot / soften
  // Guard 1·同 mode ≥ 3·改其他相容 mode (分流·非全转 augment)
  if (counts[mode] >= 3) {
    if (mode === 'rebut')   return 'soften';
    if (mode === 'second')  return 'soften';   // 改·原 augment
    if (mode === 'pivot')   return 'augment';  // 保留·pivot→augment 是合理 (都补充类)
    if (mode === 'augment') return 'pivot';    // 新加·augment 自身也 cap·避全场塌缩
    // lead 只可能首位·不会触发
  }

  // Guard 2·避免连续同 mode·40% 换非 augment 同价 mode (分流·避吸盘)
  if (mode === lastMode) {
    if (Math.random() < 0.4) {
      // 分流 map·augment 不再是统一兜底
      const altMap = {
        rebut:   'soften',
        second:  Math.random() < 0.5 ? 'pivot' : 'augment',  // 50/50 分流
        pivot:   'augment',
        augment: 'pivot',   // 改·augment 改换 pivot·非自循环
        soften:  Math.random() < 0.5 ? 'pivot' : 'rebut'     // 加 soften 分流
      };
      return altMap[mode] || mode;
    }
  }

  // Guard 3·debate2 第二轮·rebut → soften (50%)·lead → second (改·原 augment)
  if (role === 'debate2') {
    if (mode === 'rebut' && Math.random() < 0.5) return 'soften';
    if (mode === 'lead') return 'second';  // 改·原 augment·让第二轮 lead 真附议同党
  }

  return mode;
}

/**
 * Guard 4·cite cooldown·已 ≥ 2 个 cite·70% drop
 */
function _cc3_capCite(citeFlag, item) {
  if (!citeFlag) return false;
  const citesSoFar = []
    .concat((item.selfReact || []).filter(r => r && r._cite))
    .concat((item.debate || []).filter(d => d && d._cite))
    .length;
  if (citesSoFar >= 2) {
    return Math.random() < 0.3;  // 70% 丢
  }
  return true;
}

// ============================================================
// 常朝大改·Slice 9·Tier 2·层 5 累积参考 + 层 6 皇帝 cue·2026-05-22
// ============================================================

/**
 * 层 5·累积参考 hint·读 state·返 prompt 段
 * 3 个触发场景·alliesPiledOn ≥ 3 / oppStanceCount ≥ 3 / momentum=consensus-against-me
 * 返空字符串表示无 hint·不影响 prompt
 *
 * @param {Object} state — _cc3_analyzeDebate 返的 state
 * @param {Object} gmCh  — 当前 NPC 数据
 * @param {Object} item  — 议程项
 */
function _cc3_cumulativeHint(state, gmCh, item) {
  if (!state) return '';
  const hints = [];

  // 场景 A·阵营同声·≥ 3 人同党同立场·后续 NPC 应精炼
  if (state.alliesPiledOn >= 3) {
    hints.push('【累积参考·阵营同声】本议题已有 ' + state.alliesPiledOn + ' 位同党表态于"' + (state.myStance || '?') + '"。你不必从头陈词·精炼一句·补一小点新角度。朝堂语转向"一字千钧"·开头如"诸臣所论·臣不敢复赘·臣只一言"·正文短·避免重复同党论据。');
  }

  // 场景 B·势单·对面阵营 ≥ 3·宜 soften / pivot
  if (state.oppStanceCount >= 3 && state.alliesPiledOn < 2) {
    hints.push('【累积参考·势单】本议题已有 ' + state.oppStanceCount + ' 位反对你的立场·而你阵营仅 ' + (state.alliesPiledOn || 0) + ' 人附议。处势单·宜 soften 寻台阶 / pivot 转具体方案。强硬死撑会被群言压倒·除非 honor / vengefulness 极高方可凛然 lead。');
  }

  // 场景 C·共识相反·辩论压倒性 against me·宜 pivot 让步或死硬 lead
  if (state.momentum === 'consensus-against-me') {
    hints.push('【累积参考·共识相反】辩论已形成压倒共识·近 3 位发言中至少 2 位跟你立场相反。宜 pivot 到"暂行 + 徐图"类让步点·或若 honor / vengefulness 极高·则死硬 lead·凛然不让·朝堂语带"虽千万人吾往矣"之气。');
  }

  return hints.length ? '\n\n── 累积参考 (层 5·Tier 2) ──\n' + hints.join('\n') : '';
}

/**
 * 层 6·皇帝意图 cue·读 item._lastEmperorIntent (上一议题写入)·返 prompt 段
 * 影响后续 NPC 对"皇帝刚做了什么"的感知
 *
 * @param {Object} item — 议程项·_lastEmperorIntent 字段
 * @param {Object} state — debate state·含 myStance·用于判断同党 vs 政敌
 */
function _cc3_emperorCueHint(item, state) {
  const cue = item && item._lastEmperorIntent;
  if (!cue || !cue.intent || cue.intent === 'neutral') return '';
  const targetStr = cue.target ? ('·目标=' + cue.target) : '';
  const fromTitle = cue.fromItemTitle || '前议';
  const intentDesc = {
    'praise': '陛下嘉奖 / 准奏了上一议' + (cue.target ? '·重点褒奖 ' + cue.target : '') + '。若你为同党或附议方·可借势 second / augment·朝堂语带"圣明烛照"开篇。若你为政敌方·谨慎反驳·不可正面攻击·宜转 mediate / pivot 提"另有所虑"。',
    'punish': '陛下训斥 / 驳回了上一议' + (cue.target ? '·重点训斥 ' + cue.target : '') + '。若你为政敌方·借势 rebut last speaker·朝堂语用"圣明烛照·X 所言果如圣谕..." / "陛下英断" 开篇。若你为同党方·宜 soften 找台阶·勿步后尘·朝堂语用"X 所论容有未谛·非其本心..." 缓颊。',
    'doubt': '陛下留中 / 转议了上一议' + (cue.target ? '·涉 ' + cue.target : '') + '。表示陛下未决·你可补具体执行细节给陛下定夺·mode 偏 supplementary / pivot·勿再争是非·应陈方略。'
  }[cue.intent] || '';
  if (!intentDesc) return '';
  return '\n\n── 皇帝意图 cue (层 6·Tier 2) ──\n【上一议·' + fromTitle + '·' + (cue.action || '?') + targetStr + '·intent=' + cue.intent + '】\n' + intentDesc;
}

/**
 * action → intent 映射·写入 nextItem._lastEmperorIntent 时用
 * praise / punish / doubt / neutral
 */
function _cc3_actionToIntent(action) {
  if (action === 'approve' || action === 'praise' || action === 'decree') return 'praise';
  if (action === 'reject' || action === 'admonish') return 'punish';
  if (action === 'hold' || action === 'escalate' || action === 'refer' || action === 'modify') return 'doubt';
  // probe / summon → neutral·探询动作非情感
  return 'neutral';
}

/**
 * Slice 9 层 6 写入·把 emperor intent 传给 AGENDA[currentIdx + 1]
 * 在 _cc3_writeActionToGM 末尾调·只覆盖紧邻下一议题·避免污染 N+2 等更远议题
 *
 * @param {string} action — finalize 的动作名
 * @param {*} extra       — action 附带数据 (admonish/praise/summon 时 = NPC name)
 * @param {Object} curItem — 当前结束的议题
 */
function _cc3_writeNextItemEmperorIntent(action, extra, curItem) {
  const intent = _cc3_actionToIntent(action);
  if (intent === 'neutral') return;  // 探询/传召 不传 cue
  if (typeof state === 'undefined' || typeof AGENDA === 'undefined') return;
  const nextIdx = state.currentIdx + 1;
  if (nextIdx >= AGENDA.length) return;  // 末议题·无后继
  const nextItem = AGENDA[nextIdx];
  if (!nextItem) return;
  // 覆盖式写入·避免污染再下议题
  nextItem._lastEmperorIntent = {
    intent: intent,
    action: action,
    target: (typeof extra === 'string' && extra.length < 60) ? extra : null,
    fromItemIdx: state.currentIdx,
    fromItemTitle: (curItem && curItem.title || '').slice(0, 40),
    turn: (typeof GM !== 'undefined' && GM.turn) || 0,
    writtenAt: Date.now()
  };
}

/**
 * NPC-NPC consequence linkage·朝议塑造派系网而非消费完即烧
 * 在 _cc3_aiGenReact 末尾·LLM 返结果后追加
 *
 * AffinityMap 真 API·.add(a, b, delta, reason)·单向·两 NPC 需调 2 次
 * NpcMemorySystem.remember signature·positional·(name, text, '中文 emotion', weight, source)
 */
function _cc3_writeNpcInteraction(name, mode, lastSpeaker, item, controversial) {
  if (!lastSpeaker || lastSpeaker === name) return;
  if (typeof AffinityMap === 'undefined' || !AffinityMap.add) return;

  const intensity = (controversial >= 6) ? 3 : 2;
  const itemTitle = (item && item.title) || '议事';

  switch (mode) {
    case 'rebut':
      try {
        AffinityMap.add(name, lastSpeaker, -intensity, '常朝议事·' + name + '驳' + lastSpeaker);
        AffinityMap.add(lastSpeaker, name, -intensity, '常朝议事·被' + name + '驳');
      } catch (_) {}
      break;
    case 'second':
      try {
        AffinityMap.add(name, lastSpeaker, +intensity, '常朝议事·' + name + '附议' + lastSpeaker);
        AffinityMap.add(lastSpeaker, name, +1, '常朝议事·' + name + '附议');
      } catch (_) {}
      break;
    case 'soften':
      try {
        AffinityMap.add(name, lastSpeaker, +1, '常朝议事·' + name + '婉言劝' + lastSpeaker);
      } catch (_) {}
      break;
    // pivot / augment / lead / cite·不直接互动·不动 affinity
  }

  // memory·NPC 自己记得此事
  if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
    let verb, emotion, weight;
    if (mode === 'rebut') { verb = '驳'; emotion = '怒'; weight = 6; }
    else if (mode === 'second') { verb = '附议'; emotion = '喜'; weight = 4; }
    else if (mode === 'soften') { verb = '婉劝'; emotion = '平'; weight = 3; }
    else return;  // 其他 mode 不入 memory (避免噪音)
    try {
      NpcMemorySystem.remember(
        name,
        '常朝议事·' + verb + lastSpeaker + '于「' + itemTitle + '」',
        emotion,
        weight,
        lastSpeaker
      );
    } catch (_) {}
  }
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
  // ★2026-07-01 S2治「跨界面人格分裂」:改用统一 getMemoryContext(与问对/奏疏/廷议同源·含心绪/人生底色/要事/印象/伤疤)·
  //   而非 recall(3) 浅切片——同一人在常朝/问对读到同一份记忆与心性·人格一致。缓存·token 可控·无则回退旧切片。
  let memorySnippet = '';
  try {
    if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.getMemoryContext) {
      memorySnippet = NpcMemorySystem.getMemoryContext(name) || '';
    }
    if (!memorySnippet && typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.recall) {
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
  // v2·PromptComposer·注入 phase 6 字段·让 cc3 NPC 真用 aiPersonaText / recognitionState
  if (typeof TM !== 'undefined' && TM.PromptComposer && gmCh) {
    try {
      const _aiP = TM.PromptComposer.buildAiPersonaText(gmCh);
      if (_aiP) p += _aiP;
      const _rec = TM.PromptComposer.buildRecognitionState(gmCh);
      if (_rec) p += _rec;
    } catch(_) {}
  }
  // v7.1·F4b·言官 attribution 注入·若 ch 是言官·补 mentor/cohort/strength prompt 块
  if (typeof _kjYanguanPromptHint === 'function' && gmCh) {
    try {
      const _yh = _kjYanguanPromptHint(gmCh);
      if (_yh) p += _yh + '\n';
    } catch(_) {}
  }
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
      <div style="font-size:12px;color:var(--ink-300);margin:8px 0;">注：CORS 限制下·部分官方端点（含 Anthropic）需经代理。已知可直连：兼容 OpenAI 协议的国产 API（DeepSeek/智谱/月之暗面等）和大多数代理端点。</div>
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
  const debaters = (item.debate || []).map(d => d.name).filter(Boolean);
  // 候选=本议辩者 + 当前局在朝百官·不写死天启人名(旧版兜底 '韩爌' 会串到别的剧本·玩家报"死字段")
  const present = Object.keys(CHARS || {}).filter(n => CHARS[n] && !CHARS[n].absent);
  const candidates = [...debaters, ...present];
  return candidates.find(n => n !== exclude && CHARS[n] && !CHARS[n].absent)
      || debaters.find(n => n !== exclude) || present[0] || debaters[0] || '';
}

// 取当前局在朝、非缺席、非玩家的角色名(氛围气泡/调停者发言用·保证串本剧本的人·不写死天启)
function _cc3_ambientNames(n) {
  var names = Object.keys(CHARS || {}).filter(function(k){ return CHARS[k] && !CHARS[k].absent && !CHARS[k].isPlayer; });
  for (var i = names.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = names[i]; names[i] = names[j]; names[j] = t; }
  return names.slice(0, n || 1);
}
// 取一位资深在朝重臣(充"首辅/调停/谏阻"发言)·优先阁/尚书/都御史衔者·无则任取在朝者·再无返 ''
function _cc3_seniorOfficial(exclude) {
  var names = Object.keys(CHARS || {}).filter(function(n){ return n !== exclude && CHARS[n] && !CHARS[n].absent && !CHARS[n].isPlayer; });
  if (!names.length) return '';
  var senior = names.filter(function(n){ var t = (CHARS[n] && (CHARS[n].title || CHARS[n].officialTitle)) || ''; return /首辅|次辅|大学士|阁|太师|太傅|少师|少傅|尚书|侍郎|都御史|总宪|正卿/.test(t); });
  var pool = senior.length ? senior : names;
  return pool[Math.floor(Math.random() * pool.length)];
}
// 资深重臣发一言·无在朝重臣则退成无名系统气泡(避免写死天启人名串场)
function _cc3_officialBubble(stance, text, exclude) {
  var nm = _cc3_seniorOfficial(exclude || '');
  if (nm) addBubble({ name: nm, stance: stance, text: text });
  else addBubble({ kind: 'system', text: '（有大臣出班：「' + text + '」）' });
}

// 朝堂氛围气泡·不影响逻辑·仅渲染殿中活力
// ★不写死人名(旧版硬编码天启满桂/黄宗周/韩爌/温体仁/毕自严·别的剧本串场·玩家报"死字段非常多")·
//   带名句改用当前局在朝者(_cc3_ambientNames)填充·无在朝者则退无名通用句
const AMBIENT_LINES = [   // 无人名·任何朝代/剧本通用
  '（殿中有低声议论。）',
  '（殿中有人微微叹息。）',
  '（科道几员低声相商。）',
  '（远处似有内官传旨之声。）',
  '（殿角铜漏 · 滴答有声。）',
  '（班列之间 · 目光交触。）',
  '（有人扶笏 · 略有沉思。）'
];
const AMBIENT_TEMPLATES = [   // {n}/{n2} 由当前局在朝角色随机填充
  '（{n}凝视前方 · 面无表情。）',
  '（{n}捻须 · 略有沉思。）',
  '（{n}扶笏 · 目光低垂。）',
  '（{n}捏紧手中奏疏。）',
  '（{n}微微颔首。）',
  '（{n}与{n2}目光交触。）'
];
function maybeAmbient(prob) {
  if (Math.random() > (prob == null ? 0.2 : prob)) return;
  var names = _cc3_ambientNames(2);
  var line;
  if (names.length && Math.random() < 0.5) {
    var pool = names.length >= 2 ? AMBIENT_TEMPLATES : AMBIENT_TEMPLATES.filter(function(t){ return t.indexOf('{n2}') < 0; });
    line = pool[Math.floor(Math.random() * pool.length)].replace('{n2}', names[1] || names[0]).replace('{n}', names[0]);
  } else {
    line = AMBIENT_LINES[Math.floor(Math.random() * AMBIENT_LINES.length)];
  }
  addBubble({ kind: 'system', text: line });
}

// 面板存活校验·_cc3_close 后 DOM 已移除·任何 DOM 写入应早退
function _cc3_panelAlive() {
  return !!document.getElementById('cy-stage');
}

function setActions(html) {
  var el = $('cy-action-bar');
  if (!el) return;
  el.innerHTML = html;
}

function setPhase(label, hint) {
  var lbl = $('cy-phase-label'); if (lbl) lbl.textContent = label;
  var ht  = $('cy-phase-hint');  if (ht)  ht.textContent = hint || '';
}

function updateProgress() {
  try { _cc3_renderAgendaList(); } catch(_) {}
  var tg = $('cy-progress-tag'); if (!tg) return;
  tg.textContent = '已议 ' + state.decisions.length;
}

function refreshTitle() {
  if (!_cc3_panelAlive()) return;
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
  var tEl3 = $('cy-title'); if (tEl3) tEl3.textContent = ttl;
  var cEl3 = $('cy-ceremony-title'); if (cEl3) cEl3.textContent = isShuo ? '〔 朔 朝 〕' : '〔 早 朝 〕';
  var ceremEl = $('cy-ceremony');
  var subEl = ceremEl && ceremEl.querySelector('.sub');
  if (subEl) subEl.textContent = isShuo
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
      <div class="bench-avatar-circle ${ch.class === 'wu' ? 'wu' : ch.class === 'kdao' ? 'koudao' : ''}${ch.absent ? ' absent' : ''}${ch.portrait ? ' has-img' : ''}">${ch.portrait ? '<img class="bench-avatar-img" src="'+escHtml(ch.portrait)+'" loading="lazy" decoding="async">' : escHtml(ch.initial)}</div>
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
      html += '<span class="name">' + escHtml(a.name) + '</span><span style="color:var(--ink-300);font-size:12px;">（' + escHtml(a.reason) + '）</span>';
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
  try { _cc3_renderAgendaList(); } catch(_) {}
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

  // ─── 史官实录·常朝议政进纪事(原本常朝不写 jishiRecords·此处补·带 outcome 决议) (2026-06-03) ───
  try { _cc3_writeJishiRecord(action, item, extra, label, pTxt); } catch (jishiErr) { console.warn('[cc3] 纪事写入失败·跳过·', jishiErr && jishiErr.message); }

  // ─── Slice 9 层 6·把 emperor intent 传给下一议题·写在 GM 状态之后·state.currentIdx++ 之前
  try { _cc3_writeNextItemEmperorIntent(action, extra, item); }
  catch (intentErr) { console.warn('[cc3·tier2] emperor intent 写入失败·跳过·', intentErr && intentErr.message); }

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

// ─── 史官实录·常朝决议写入纪事(带 outcome 决议结论·原本常朝缺纪事机制) ───
function _cc3_writeJishiRecord(action, item, extra, label, pTxt) {
  if (typeof GM === 'undefined') return;
  if (!Array.isArray(GM.jishiRecords)) GM.jishiRecords = [];
  item = item || {};
  var topic = String(item.title || item.subject || '常朝议题').slice(0, 60);
  var presenter = item.presenter || '某员';
  var zou = String(item.detail || item.content || '').slice(0, 200);
  var outcomeText = (action === 'approve') ? ('常朝·准奏：' + topic.slice(0, 24))
    : (action === 'reject') ? '常朝·驳奏'
    : (action === 'hold') ? '常朝·留中待议'
    : (action === 'refer') ? ('常朝·发部议' + (extra ? '（' + extra + '）' : ''))
    : (action === 'escalate') ? '常朝·下廷议'
    : (action === 'modify') ? ('常朝·改批：' + String(extra || '').slice(0, 40))
    : (action === 'decree') ? '常朝·当庭口述诏令'
    : (action === 'praise') ? '常朝·嘉奖' : (action === 'admonish') ? '常朝·训诫'
    : ('常朝·' + (label || action));
  GM.jishiRecords.push({
    turn: GM.turn || 1,
    char: presenter,
    topic: topic,
    playerSaid: String(pTxt || ('（' + (label || '裁决') + '）')).slice(0, 200),
    npcSaid: zou ? (presenter + '（' + (item.dept || '') + '）奏：' + zou) : '',
    mode: 'changchao',
    final: (action === 'approve' || action === 'reject' || action === 'decree' || action === 'escalate'),
    outcome: outcomeText
  });
  if (GM.jishiRecords.length > 400) GM.jishiRecords = GM.jishiRecords.slice(-400);
}

function _cc3_courtPolicyText(action, item, extra) {
  item = item || {};
  if (action === 'modify') return String(extra || '改批方案').trim();
  if (action === 'decree') {
    if (extra && typeof extra === 'object') return String(extra.text || '').trim();
    return String(extra || '亲诏').trim();
  }
  return (String(item.title || '常朝裁决') + '：' + String(item.detail || item.content || '')).trim();
}

function _cc3_applyCourtPolicyBridge(tracker, action, item, extra, label) {
  if (typeof GM === 'undefined' || !GM || !tracker) return null;
  if (['approve', 'modify', 'decree'].indexOf(action) < 0) return null;
  if (tracker._policyApplyAttempted) return tracker._policyExecution || null;
  var text = _cc3_courtPolicyText(action, item, extra);
  if (!text) return null;
  tracker._policyApplyAttempted = true;
  var parser = (typeof EdictParser !== 'undefined') ? EdictParser : null;
  var result = null;
  if (parser && typeof parser.tryExecute === 'function') {
    try {
      result = parser.tryExecute(text, {}, {
        source: 'changchao',
        channel: 'court',
        action: action,
        label: label || '',
        trackerId: tracker.id || '',
        topic: item && (item.title || item.subject) || '',
        dept: item && item.dept || '',
        presenter: item && item.presenter || '',
        decreeMark: tracker.decreeMark || null
      });
    } catch(e) {
      result = { ok: false, reason: e && e.message || 'changchao_policy_error' };
    }
  } else {
    result = { ok: false, reason: 'edict_parser_unavailable' };
  }
  tracker._policyExecution = result;
  tracker._policyApplied = !!(result && result.ok);
  if (tracker._policyApplied) {
    tracker.status = 'executed';
    tracker.feedback = '常朝裁决已识别为政务并落账';
    tracker.progressPercent = 100;
  }
  if (!GM._chaoyiPolicyActions) GM._chaoyiPolicyActions = [];
  GM._chaoyiPolicyActions.push({
    turn: GM.turn || 0,
    trackerId: tracker.id || '',
    action: action,
    ok: tracker._policyApplied,
    pathway: result && result.pathway || '',
    typeKey: result && result.classification && result.classification.typeKey || ''
  });
  if (GM._chaoyiPolicyActions.length > 80) GM._chaoyiPolicyActions.splice(0, GM._chaoyiPolicyActions.length - 80);
  return result;
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
    const decreeText = _cc3_courtPolicyText(action, item, extra);
    const tracker = {
      id: 'cc3_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      content: decreeText,
      category: item.dept || '常朝',
      turn: turn, status: 'pending',
      assignee: item.presenter || '', feedback: '', progressPercent: 0,
      source: action === 'decree' ? 'changchao_decree' : 'changchao',
      decreeMark: action === 'decree' ? (extra && extra.tier) || 'B' : null
    };
    GM._edictTracker.push(tracker);
    _cc3_applyCourtPolicyBridge(tracker, action, item, extra, label);
    // minxin feedback: route changchao disposition of a pressure-spawned topic back so the matrix clears it (else it re-spawns)
    try {
      var _miLink = item && (item._sourceRef || item.linkedIssue || item.sourceId || item.ref || (item.sourceType === 'minxin_pressure' ? item.id : ''));
      if (_miLink && typeof TM !== 'undefined' && TM.MinxinPressureActions && typeof TM.MinxinPressureActions.recordPlayerResponse === 'function') {
        TM.MinxinPressureActions.recordPlayerResponse(GM, { channel: 'chaoyi', decision: action, linkedIssue: _miLink, actor: item.presenter || '', topic: item.title || '', text: [item.title, item.detail, item.content].filter(Boolean).join(' ') }, { turn: turn, source: 'changchao-minxin-pressure-response' });
      }
    } catch (_miE) {}
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
        if (ch && typeof ch.loyalty === 'number') {
          if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(ch, -5, '\u5E38\u671D\u8BAD\u8BEB\uFF1A' + (item.title || ''), { source:'changchao-admonish' });
          else ch.loyalty = Math.max(0, ch.loyalty - 5);
        }
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
          if (typeof ch.loyalty === 'number') {
            if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(ch, 4, '\u5E38\u671D\u5609\u5956\uFF1A' + (item.title || ''), { source:'changchao-praise' });
            else ch.loyalty = Math.min(100, ch.loyalty + 4);
          }
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
  if (state._isPostTurn && typeof _onPostTurnCourtEnd === 'function') {
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
  GM._lastChangchaoDecisionMeta = {
    turn: record.turn,
    targetTurn: record.targetTurn,
    phase: record.phase,
    mode: record.mode
  };
  GM._lastChangchaoDecisionsTargetTurn = record.targetTurn;

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
    GM.qijuHistory.unshift({ turn: turn, targetTurn: record.targetTurn, phase: record.phase, date: date, content: qjContent });
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
        authorityLevel: 'official_record',
        confidence: 0.7,
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
    <div style="text-align:center;font-size:12px;color:var(--ink-500);margin:8px 0;letter-spacing:0.15em;">
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
    _cc3_officialBubble('mediate', '陛下圣明·下廷议方可服众。臣即拟召集名单。', presenter);
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
    _cc3_officialBubble('oppose', '陛下！此事关乎民心 · 臣等以为可议而行 · 不宜独断！', '');
    addBubble({ kind: 'system', text: '（诏令全效但民心 -2 · 暴名 +1 · 该回合后续奏报激进度↑）' });
  } else if (tier === 'D') {
    if (t.code === 'D' && t.name === '危诏激变') {
      _cc3_officialBubble('oppose', '陛下不可！臣愿以死谏！（伏地不起）', '');
      addBubble({ kind: 'system', text: '（殿中数员跪谏 · 诏令 blocked · 皇威 -3 · 权威 -2 · 派系叛意 +。）' });
    } else {
      _cc3_officialBubble('oppose', '陛下 · 此诏诚有未当 · 臣谨封驳。', '');
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
async function _cc3_open(opts) {
  opts = opts || {};
  var explicitPostTurn = null;
  if (Object.prototype.hasOwnProperty.call(opts, 'isPostTurn')) explicitPostTurn = !!opts.isPostTurn;
  else if (Object.prototype.hasOwnProperty.call(opts, 'postTurn')) explicitPostTurn = !!opts.postTurn;
  var isPostTurnOpen = explicitPostTurn !== null
    ? explicitPostTurn
    : (typeof GM !== 'undefined' && !!GM._isPostTurnCourt);
  // 频次计数（与 v2 兼容·in-turn court 受 2/turn 限·post-turn 不受）
  if (typeof GM !== 'undefined') {
    if (!GM._chaoyiCount) GM._chaoyiCount = {};
    if (!GM._chaoyiCount[GM.turn]) GM._chaoyiCount[GM.turn] = 0;
    if (!isPostTurnOpen && GM._chaoyiCount[GM.turn] >= 2) {
      if (typeof toast === 'function') toast('今日已朝议 ' + GM._chaoyiCount[GM.turn] + ' 次·改日再议');
      return;
    }
    GM._chaoyiCount[GM.turn]++;
  }

  // 关 v2 旧 modal（如有）
  const oldModal = document.getElementById('chaoyi-modal');
  if (oldModal) oldModal.remove();

  // ★ 立即捕获是否朔朝·避免 await 期间 GM._isPostTurnCourt 被外部 reset 导致标题/system prompt 错位
  state._isPostTurn = !!isPostTurnOpen;
  state._openSource = opts.source || (state._isPostTurn ? 'post-turn' : 'in-turn');
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
  state.mode = state._isPostTurn ? 'shuochao' : 'changchao';

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
    const cssHref = 'tm-chaoyi-changchao.css';
    link.id = 'cc3-css';
    link.rel = 'stylesheet';
    link.href = cssHref;
    link.setAttribute('data-css-base', cssHref);
    link.setAttribute('data-css-fallback', 'https://cdn.jsdelivr.net/gh/misfit-user/tianming@main/tm-chaoyi-changchao.css');
    link.onload = function() {
      if (typeof window !== 'undefined' && window.TM_CSS_LOADED) window.TM_CSS_LOADED(link);
    };
    link.onerror = function() {
      if (typeof window !== 'undefined' && window.TM_CSS_RETRY) window.TM_CSS_RETRY(link);
    };
    document.head.appendChild(link);
  }

  // 创建 modal·preview 的 cy-stage 结构
  const stage = document.createElement('div');
  stage.className = 'cy-stage';
  stage.id = 'cy-stage';
  stage.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:5000;';
  // #1 移动端(安卓 Capacitor)常朝整体偏小修复:fit.js 把桌面舞台等比缩到手机,而常朝又被 CSS
  //   max-width:1080px 卡在舞台 ~56% → 手机上一小块、四周大片空。移动端解除上限、铺满舞台(桌面不动)。
  //   ⚠️ 值待真机微调:仍小可再调大、溢出可调小;fit.js 的 anchorEl 会把这里的内联 vw/vh→px。
  try {
    if (window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()) {
      stage.style.maxWidth = 'none';
      stage.style.width = '96vw';
      stage.style.height = '95vh';
    }
  } catch (_cyFit) {}
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

  // 2026-06 faithful landing·常朝并排版式（左殿堂班次 + 右议程/流程/裁决·对齐预览·保留全部元素/id/handler）
  try {
    var _ccBench = document.getElementById('cy-bench');
    var _ccPhase = document.getElementById('cy-phase-tag');
    var _ccMain = document.getElementById('cy-stage-main');
    var _ccAct = document.getElementById('cy-action-bar');
    var _ccInput = stage.querySelector('.cy-input-row');
    var _ccTitle = stage.querySelector('.cy-titlebar');
    if (_ccBench && _ccMain && _ccTitle && !document.getElementById('cc-body-row')) {
      var _row = document.createElement('div'); _row.id = 'cc-body-row'; _row.className = 'cc-body-row';
      var _hall = document.createElement('div'); _hall.className = 'cc-hall';
      var _rail = document.createElement('div'); _rail.className = 'cc-rail';
      _hall.appendChild(_ccBench);
      // 出班者立绘焦点·移入中央御座（御道·对齐预览）
      var _pres = document.createElement('div'); _pres.id = 'cc-presenter'; _pres.className = 'cc-presenter';
      _pres.innerHTML = '<div class="cc-pres-wait">待奏</div>';
      var _throne = _ccBench.querySelector('.cy-bench-col-throne');
      if (_throne) { _throne.classList.add('has-pres'); _throne.appendChild(_pres); } else { _hall.appendChild(_pres); }
      [_ccPhase, _ccMain, _ccAct, _ccInput].forEach(function(el) { if (el) _rail.appendChild(el); });
      _row.appendChild(_hall); _row.appendChild(_rail);
      _ccTitle.parentNode.insertBefore(_row, _ccTitle.nextSibling);
      _ccBench.classList.add('expanded', 'cc-hall-bench');
      // 皇威/皇权 入顶栏（对齐预览）
      try {
        var _meta = _ccTitle.querySelector('.meta');
        if (_meta && !document.getElementById('cc-authority')) {
          var _prV = (typeof state !== 'undefined' && typeof state.prestige === 'number') ? Math.round(state.prestige) : 55;
          var _pwV = (typeof state !== 'undefined' && typeof state.power === 'number') ? Math.round(state.power) : 60;
          var _au = document.createElement('span'); _au.id = 'cc-authority'; _au.className = 'cc-authority';
          _au.innerHTML = '<span class="cca-item">皇威 <b>' + _prV + '</b><i class="cca-bar"><em style="width:' + _prV + '%"></em></i></span><span class="cca-item">皇权 <b>' + _pwV + '</b><i class="cca-bar"><em style="width:' + _pwV + '%"></em></i></span>';
          _meta.insertBefore(_au, _meta.firstChild);
        }
      } catch(_) {}
    }
  } catch(_ccLayoutErr) { try { window.TM && TM.errors && TM.errors.captureSilent(_ccLayoutErr, 'changchao-sidebyside'); } catch(_) {} }

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
  // 2026-06·常朝班次默认展开（百官真脸全景为主·非折叠薄条·可点表头收起）
  if (typeof state !== 'undefined' && !state._benchAutoExpanded) {
    state._benchAutoExpanded = true;
    state.benchExpanded = true;
    var _cbEl = document.getElementById('cy-bench');
    if (_cbEl) _cbEl.classList.add('expanded');
  }
}

/** 关闭 v3 modal */
function _cc3_close() {
  // 退朝按钮直接关闭时·若是朔朝(post-turn)且 runClosing 未跑过钩子·此处补触发
  // 保证后续 _onPostTurnCourtEnd 能展示推演 loading / 弹史记
  var _wasPostTurn = false;
  try {
    _wasPostTurn = !!(typeof state !== 'undefined' && state._isPostTurn);
  } catch(_) {}
  var _alreadyDone = (typeof state !== 'undefined' && state.done);

  const m = document.getElementById('cy-stage');
  if (m) m.remove();
  // 清理 popovers
  document.querySelectorAll('.cy-popover, .cy-summary-mask, .cy-input-modal').forEach(p => p.remove());
  if (typeof CY !== 'undefined') {
    CY.open = false;
    if (CY.abortCtrl) try { CY.abortCtrl.abort(); } catch(_){}
  }

  // 朔朝退朝兜底·若 runClosing 还没跑过(state.done!=true)·补触发后朝结束钩子
  if (_wasPostTurn && !_alreadyDone && typeof _onPostTurnCourtEnd === 'function') {
    try { _onPostTurnCourtEnd(); } catch(_e) {
      if (window.TM && TM.errors && TM.errors.capture) TM.errors.capture(_e, 'cc3_close] postTurnEnd:');
    }
  }
}

try { window._cc3_open = _cc3_open; } catch (_) {}
try { window._cc3_close = _cc3_close; } catch (_) {}

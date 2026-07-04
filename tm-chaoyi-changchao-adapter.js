// @ts-check
/* ═══════════════════════════════════════════════════════════════════════
 *  tm-chaoyi-changchao-adapter.js — 常朝 v3·§A GM Adapter（2026-07-04 立项拆分·自 tm-chaoyi-changchao.js 保序切出）
 *  内容：_cc3_buildCharsFromGM 等 GM→preview 数据适配层·纯顶层函数·零装载期执行语句
 *  加载序：index.html 中紧挨 tm-chaoyi-changchao.js 之前——执行顺序与拆分前逐字节等价·勿改
 * ═══════════════════════════════════════════════════════════════════════ */
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

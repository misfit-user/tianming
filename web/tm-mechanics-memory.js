// @ts-check
// ═══ 巨石拆分(20260706)：tm-mechanics NPC记忆/成长/性格·机构改革片(原行1478-2604) ═══
// 从 tm-mechanics.js 后缀切出·顶层函数型(列0全局符号·运行时全局名互见·无alias)。
// 须紧接 tm-mechanics.js 之后、tm-mechanics-world.js 之前装载。契约见 lint-split-contracts。

// ============================================================
// NPC 记忆系统 — 每个角色有自己的主观记忆
// ============================================================
function _tmMemoryCanonName(name) {
  if (!name) return name;
  if (typeof TM !== 'undefined' && TM.StartContracts && GM.startContext) { var nativeChar=TM.StartContracts.resolveCharacter(GM,name); return nativeChar ? nativeChar.id : ''; }
  try {
    if (typeof canonicalizeCharName === 'function') return canonicalizeCharName(name) || name;
  } catch (_) {}
  return name;
}

function _tmMemoryCanonNameArray(list) {
  if (!Array.isArray(list)) return list;
  var out = [];
  list.forEach(function(name) {
    var n = _tmMemoryCanonName(name);
    if (n && out.indexOf(n) < 0) out.push(n);
  });
  return out;
}

function _tmMemoryFindChar(name) {
  if (typeof TM !== 'undefined' && TM.StartContracts && GM.startContext) return TM.StartContracts.resolveCharacter(GM,name);
  name = _tmMemoryCanonName(name);
  try {
    if (typeof findCharByName === 'function') {
      var found = findCharByName(name);
      if (found) return found;
    }
  } catch (_) {}
  return (GM.chars || []).find(function(c) { return c && c.name === name; }) || null;
}

// <<<刀B-DETECTOR-START>>> 生死矛盾检测器（NPC 记忆污染消毒·V1 只治生死类矛盾）
// ═══════════════════════════════════════════════════════════════════════════
// 背景（侦察确诊的污染环）：问对等场景 AI 一句史实幻觉（如「魏忠贤已伏诛」而本局魏在世）被
//   remember 无校验持久化进 ch._memory + GM._memoryArchiveFull；且原文进 wenduiHistory、AI 自撰
//   记忆进记忆管家 GM._memoryAccepted。下回合又被 getMemoryContext（问对/奏疏/朝议/廷议/御前/
//   鸿雁/时政/势力/编制 等所有场景共用总入口）、主 sysP 的 <recent-dialogues>/<npc-hearts>、
//   _buildTemporalConstraint、问对回放喂回 prompt，自证自强化。此确定性检测器扫文本，逮住与
//   GM 生死态直接冲突的宣称。取向 = 宁误放勿误杀：拿不准的边界一律放行，绝不静默丢正常记忆。
//
// ── 判定管线（Codex 二/三轮返工·判序重构）─────────────────────────────────────
//   句读切分（。！？；;!?\n\r）。每子句：先「并列主语」预判（名A与/及/、名B+俱/皆/均+死词→组内
//   同判），再逐名按序：①名前近窗传闻标记（传言/据说/听闻/风闻/谣/窃闻/闻…）→放行；②倒装「死词+
//   者，名+也」→判死；③★先存活/否定长模式（并未身亡/未曾亡故/未死/依然健在…最长优先·治「并未
//   身亡」序坑·存活宣称永不享竞态豁免）；④虚拟/推测紧邻闸（名→死讯词间只容过门字·如/将/或/恐/是否
//   落此间→放行）；⑤死亡直陈 + 亲属闸（死词后首段遇标点即止·治「其子/子民」误触）+ 后置否定尾
//   （死词后接 妄言/谣传/讹传/不实/非也/无稽 → 整句放行·治「已伏诛者，妄言也」误杀）；⑥子句级
//   指代（前句或本句已有死亡断言 + 本名后紧跟「亦然/亦如是」句尾→同判·逗号/分号/换行版皆认）。
//   最长实体消歧（镜像另一分支「刀9」的 _textMentionsName·本地实现）：长名消费跨度·短名不另计。
//   名域含 name/zi/haoName/aliases/formerNames（P1-4·官职/泛称与「魏公公/九千岁」无结构字段→V1
//   不覆盖）。V1 边界（宁误放）：口语「去了/没了」隐晦死讯；同句既含真死讯又含语气词者一律放行。
//
// ── 竞态与死亡落库（已 trace 五 sink·均置 deathTurn=GM.turn）────────────────────
//   applyOneDeath / triggerCharacterDeath / 赐死 / 狱中卒 / 御驾亲征战殁 五处先置 alive=false 再
//   deathTurn=GM.turn（不互相 funnel·各自直写）。本检测器「与 GM 一致」以 alive===false||dead===true
//   为准→死者死讯记忆一律放行。deathTurn 仅供**死亡宣称**同回合竞态豁免；★存活宣称永不享此豁免。
//   getMemoryContext 同回合缓存据「本回合已判死人数」签名失效（计 deathTurn===turn·覆盖全五 sink 的判死方向；
//   ★签名只覆盖判死方向·复活翻转不失效·当前无复活写口故不可达·若未来加复活须同步失效·见缓存注）。
// ═══════════════════════════════════════════════════════════════════════════
var _TM_VITAL_SCAN_CAP = 400;   // 只扫文本前 400 字·防长文本性能
var _TM_VITAL_WINDOW = 20;      // 名后 20 字窗口内的生死词才可能指向此人
// 死亡宣称词（形式化古语·避开易撞口语「死了/死心/去了」）
var _TM_DEATH_CLAIM_RE = /已死|已卒|已故|已亡|已殁|殁了|身殁|身亡|身故|亡故|殒命|丧命|毙命|暴毙|暴亡|驾崩|已伏诛|伏诛|正法|问斩|已处决|自缢身[死亡]|自尽身[死亡]|被诛|诛杀|伏法|瘐死|遇害|殉国|殉难|已逝|薨逝|薨/;
// 存活/否定宣称词（长模式在前·最长匹配优先·先于死亡 RE 跑·治「并未身亡」序坑）
var _TM_ALIVE_CLAIM_RE = /并未身亡|未曾身亡|尚未身亡|并未亡故|未曾亡故|不曾亡故|并未身故|未尝身亡|依然健在|仍然在世|仍在人世|尚在人世|仍在世|尚在世|仍健在|尚健在|健在|仍在位|尚在位|依旧在位|官复原职|复起用|复起|复出|东山再起|仍活着|尚活着|还活着|安然无恙|未身亡|未亡故|未死|未亡/;
// 任一生死词的存在性快测（绝大多数记忆无此词→O(1) 直接放行·免全表扫描）
var _TM_VITAL_ANY_RE = /[死卒故亡殁殒毙诛斩缢崩薨逝]|正法|问斩|处决|伏法|瘐死|遇害|殉|健在|在世|在位|在人世|官复|复起|复出|东山再起|活着|无恙/;
// 句读切分（名与死讯词须同句·跨句不牵连·分号/叹号/问号/换行皆切）
var _TM_SENT_SPLIT_RE = /[。！？；;!?\n\r]+/;
// 名—死讯词之间「紧邻」允许的过门字（连接/标点/数字/空白）；出现此集之外的汉字（含虚拟/推测
//   语气词 如/将/或/恐/是否/怕是/想必… 及更长 token 之续字 石）→判为非指本人·非事实断言→放行。
var _TM_VITAL_TIGHT_RE = /^[\s0-9已现今方才刚亦也遂乃经、，·…（）()\[\]【】「」《》“”‘’—-]*$/;
// 名前近窗的传闻/风闻标记（多字为主·补单字「闻」治「闻魏忠贤已伏诛」；不含裸「将/如」免误伤）→放行
var _TM_HEARSAY_RE = /传[言闻]|据[说传闻称报]|听[说闻]|风闻|谣[传言诼]|讹传|坊间|外间|窃[闻谓]|世传|或[传谓]|闻/;
// 亲属/关系词（死讯词紧贴此类→死的是亲属非本人→放行·仅锚定死词后首段·遇标点即止）
var _TM_RELATION_RE = /父|母|兄|弟|姊|姐|妹|子|女|妻|夫|祖|孙|甥|侄|叔|伯|舅|姑|姨|婿|媳|亲|族|眷|嗣|考|妣|先[帝皇君父母]|恩师|门生/;
// 并列主语连接词（名A ? 名B·仅这些+标点算并列组）
var _TM_COORD_RE = /^[与及和同暨、,，\s]*$/;
// 并列收束的集合量词（俱/皆/均… + 死/活词→组内同判）
var _TM_COLLECTIVE_RE = /[俱皆均咸悉尽并同齐]|一同|一并|一齐/;
// 后置否定尾（死讯词后接此类→该死亡宣称被否定·整句放行·治「已伏诛者，妄言也」误杀）
var _TM_NEGATION_TAIL_RE = /妄言|妄语|谣言|谣传|讹传|不实|非也|无稽|无据|子虚|乌有|虚妄|莫须有|绝无此事|并无此事|纯属谣|荒谬|不足信|不可信/;
// 子句级指代尾（名后紧跟此·句尾·前句/本句有死亡断言时对该名同判死）
var _TM_ANAPHORA_TAIL_RE = /^[，,\s]*(亦然|亦复如是|亦如是|亦复然|亦同此|亦如之|莫不如是|亦莫能免)[也矣焉耳尔哉]?[，,。\s]*$/;
// 子句指代标记存在性（供子句级处理闸放行判据·非尾匹配）
var _TM_ANAPHORA_ANY_RE = /亦然|亦复如是|亦如是|亦复然|亦同此|亦如之|莫不如是|亦莫能免/;

/** 收集某 GM 人物的可用称名（name/zi/haoName + aliases/formerNames/_aliases 数组·各≥2字·去重）。
 *  官职 officialTitle/泛称 title 易撞不入；自由文本别称「魏公公/九千岁」本局无结构字段→V1 边界不覆盖。 */
function _tmVitalAppellations(c) {
  var out = [];
  function add(v) { if (v && typeof v === "string" && v.length >= 2 && out.indexOf(v) < 0) out.push(v); }
  if (!c) return out;
  add(c.name); add(c.zi); add(c.haoName);
  ["aliases", "formerNames", "_aliases"].forEach(function (k) { if (Array.isArray(c[k])) c[k].forEach(add); });
  return out;
}

/** 一句内按最长实体消歧扫出被点名 GM 人物·返回 [{char, name, pos, end}]（长名消费跨度·所含短名不再另计） */
function _tmVitalScanMentions(sentence, gm) {
  var out = [];
  gm = gm || (typeof GM !== "undefined" ? GM : null);
  if (!gm || !Array.isArray(gm.chars) || !sentence) return out;
  var pairs = [];
  for (var i = 0; i < gm.chars.length; i++) {
    var c = gm.chars[i], aps = _tmVitalAppellations(c);
    for (var a = 0; a < aps.length; a++) pairs.push({ ap: aps[a], c: c });
  }
  pairs.sort(function (a, b) { return b.ap.length - a.ap.length; });   // 长名优先
  var consumed = new Array(sentence.length);
  for (var p = 0; p < pairs.length; p++) {
    var nm = pairs[p].ap, from = 0, pos;
    while ((pos = sentence.indexOf(nm, from)) >= 0) {
      var end = pos + nm.length, clash = false;
      for (var k = pos; k < end; k++) { if (consumed[k]) { clash = true; break; } }
      if (!clash) { for (var k2 = pos; k2 < end; k2++) consumed[k2] = 1; out.push({ char: pairs[p].c, name: nm, pos: pos, end: end }); }
      from = pos + nm.length;
    }
  }
  out.sort(function (a, b) { return a.pos - b.pos; });
  return out;
}

// 名→死讯词间「过门」判定（先剥多字时间连接词「如今/现今…」以免其首字被当语气词误放）
function _tmVitalGapClean(gap) { return String(gap == null ? "" : gap).replace(/如今|现今|而今|于今|至今|方今|即今/g, ""); }
// 死讯词后「亲属闸」：仅锚定死词后首段（遇标点即止·绝不跨子句）·紧贴亲属词=死的是亲属→true
function _tmVitalRelationAfter(claim, endIdx) {
  var seg = String(claim || "").slice(endIdx).split(/[，,。、；;：！？!?\s（）()]/)[0].slice(0, 3);
  return !!seg && _TM_RELATION_RE.test(seg);
}
// 后置否定尾：死词后 14 字内出现 妄言/谣传/不实… → 该死亡宣称被否定→整句放行。★双重否定（非/并非/
//   绝非/岂是/不是 + 妄言/谣传/不实）=对否定的否定=确认死讯·不放行（治「已伏诛，此非妄言」误放）。
function _tmVitalHasNegationTail(text) {
  var t = String(text || ""), m = _TM_NEGATION_TAIL_RE.exec(t);
  if (!m) return false;
  if (/(非|并非|绝非|岂[是非]|不是|无非|未尝不|何尝不)$/.test(t.slice(Math.max(0, m.index - 3), m.index))) return false;   // 双重否定=确认死讯·非真否定
  return true;
}
function _tmVitalNegatedAfter(sent, deathEndAbs) {
  return _tmVitalHasNegationTail(String(sent || "").slice(deathEndAbs, deathEndAbs + 14));
}

/** 确定性生死矛盾检测·返回首个冲突 {claimTarget, claimType} 或 null（无冲突/放行）
 *  claimType: 'death_of_living'（称在世者已死） | 'alive_of_dead'（称已故者仍在）。gm 缺省取全局 GM。 */
function _tmDetectVitalConflict(text, gm) {
  try {
    if (!text || typeof text !== "string") return null;
    var full = text.length > _TM_VITAL_SCAN_CAP ? text.slice(0, _TM_VITAL_SCAN_CAP) : text;
    if (!_TM_VITAL_ANY_RE.test(full)) return null;          // 无任何生死词→放行（绝大多数记忆走这条）
    gm = gm || (typeof GM !== "undefined" ? GM : null);
    if (!gm) return null;                                   // 无 GM→永不崩·放行
    var curTurn = gm.turn;
    function _isDead(c) { return (c.alive === false || c.dead === true); }
    function _diedThis(c) { return (curTurn != null && c.deathTurn === curTurn); }
    var sentences = full.split(_TM_SENT_SPLIT_RE);
    var prevDeathAssertion = false;                          // 上一子句是否作过死亡断言（供「亦然」指代·⑥）
    for (var si = 0; si < sentences.length; si++) {
      var sent = sentences[si];
      if (!sent) continue;
      if (!_TM_VITAL_ANY_RE.test(sent) && !(prevDeathAssertion && _TM_ANAPHORA_ANY_RE.test(sent))) continue;
      var mentions = _tmVitalScanMentions(sent, gm);
      var sentHadDeath = false;
      // —— 并列主语预判：名A与/及/、名B（+…）+ 俱/皆/均 + 死/活词 → 组内每名同判（治「客氏与魏忠贤俱已伏诛」）——
      for (var gi = 0; gi < mentions.length;) {
        var gj = gi;
        while (gj + 1 < mentions.length) {
          var between = sent.slice(mentions[gj].end, mentions[gj + 1].pos);
          if (between.length >= 1 && between.length <= 4 && /[与及和同暨、]/.test(between) && _TM_COORD_RE.test(between)) gj++; else break;
        }
        if (gj > gi) {
          var _le = mentions[gj].end, _cc = sent.slice(_le, _le + _TM_VITAL_WINDOW);
          if (_TM_COLLECTIVE_RE.test(_cc.slice(0, 5)) && !_tmVitalHasNegationTail(_cc)) {
            var _cAlive = _TM_ALIVE_CLAIM_RE.exec(_cc), _cDeath = _TM_DEATH_CLAIM_RE.exec(_cc);
            for (var gk = gi; gk <= gj; gk++) {
              var _gc = mentions[gk].char;
              if (_cAlive && (!_cDeath || _cAlive.index <= _cDeath.index)) { if (_isDead(_gc)) return { claimTarget: mentions[gk].name, claimType: "alive_of_dead" }; }
              else if (_cDeath) { sentHadDeath = true; if (!_isDead(_gc) && !_diedThis(_gc)) return { claimTarget: mentions[gk].name, claimType: "death_of_living" }; }
            }
          }
        }
        gi = gj + 1;
      }
      // —— 逐名判 ——
      for (var i = 0; i < mentions.length; i++) {
        var m = mentions[i], c = m.char;
        if (_TM_HEARSAY_RE.test(sent.slice(Math.max(0, m.pos - 6), m.pos))) continue;   // ① 名前传闻标记→放行
        // ② 倒装「死词+者，名+也」——死词在名前
        var preInv = sent.slice(Math.max(0, m.pos - 14), m.pos);
        if (/者[，,、\s]*$/.test(preInv) && _TM_DEATH_CLAIM_RE.test(preInv.replace(/者[，,、\s]*$/, "").slice(-6))) {
          sentHadDeath = true;
          if (!_isDead(c) && !_diedThis(c)) return { claimTarget: m.name, claimType: "death_of_living" };
          continue;
        }
        var winEnd = m.end + _TM_VITAL_WINDOW;
        if (i + 1 < mentions.length && mentions[i + 1].pos < winEnd) winEnd = mentions[i + 1].pos;   // 窗口截到下一个被点名者前
        var claim = sent.slice(m.end, winEnd);
        // ③ ★先存活/否定长模式（最长匹配优先）——治「并未身亡」序坑；存活宣称永不享竞态豁免
        var ma = claim ? _TM_ALIVE_CLAIM_RE.exec(claim) : null;
        if (ma && _TM_VITAL_TIGHT_RE.test(_tmVitalGapClean(claim.slice(0, ma.index))) && !_tmVitalRelationAfter(claim, ma.index + ma[0].length)) {
          if (_isDead(c)) return { claimTarget: m.name, claimType: "alive_of_dead" };
          continue;                                          // 活人仍在=一致·放行
        }
        // ④/⑤ 死亡直陈（虚拟由紧邻闸挡·亲属由死词后首段闸挡·后置否定尾挡）
        var md = claim ? _TM_DEATH_CLAIM_RE.exec(claim) : null;
        if (md && _TM_VITAL_TIGHT_RE.test(_tmVitalGapClean(claim.slice(0, md.index))) && !_tmVitalRelationAfter(claim, md.index + md[0].length)
            && !_tmVitalNegatedAfter(sent, m.end + md.index + md[0].length)) {
          sentHadDeath = true;
          if (!_isDead(c) && !_diedThis(c)) return { claimTarget: m.name, claimType: "death_of_living" };
          continue;
        }
        // ⑥ 子句级指代：前句或本句已有死亡断言 + 本名后紧跟「亦然」句尾 → 对该名同判死（逗号/分号/换行版皆认）
        if ((prevDeathAssertion || sentHadDeath) && claim && _TM_ANAPHORA_TAIL_RE.test(claim)) {
          sentHadDeath = true;
          if (!_isDead(c) && !_diedThis(c)) return { claimTarget: m.name, claimType: "death_of_living" };
        }
      }
      prevDeathAssertion = sentHadDeath;
    }
    return null;
  } catch (_) { return null; }   // 任何异常→放行·永不崩
}

// ── 统一过滤器（sink 收口·getMemoryContext 内 + 各直读点 + 写闸共用·各处 typeof 守卫调用）──
/** 记忆条目取事件文本后过检测器·冲突返回 conflict 否则 null（entry 可为字符串或 {event/body/content}） */
function _tmMemEntryConflict(entry, gm) {
  if (!entry) return null;
  var ev = (typeof entry === "string") ? entry : (entry.event || entry.body || entry.content || entry.text || "");
  return _tmDetectVitalConflict(ev, gm);
}
/** 滤掉与 GM 生死态冲突的记忆条目（治老玩家已污染 ch._memory·读侧兜底）·非数组原样返回 */
function _tmFilterMemories(list, gm) {
  if (!Array.isArray(list)) return list;
  return list.filter(function (m) { return !_tmMemEntryConflict(m, gm); });
}
/** 问对历史条目冲突判定：带 _histConflict 标 或 NPC 侧内容运行时侦测出矛盾（帝侧/纪事不检）→冲突 */
function _tmWenduiEntryConflict(entry, gm) {
  if (!entry) return null;
  if (entry._histConflict) return { claimTarget: "", claimType: "flagged" };
  var role = entry.role;
  if (role === "player" || role === "user" || role === "system") return null;
  return _tmDetectVitalConflict(entry.content || entry.text || "", gm);
}
/** 滤掉带标或运行时侦测出生死矛盾的问对历史条目（回放/注入 sink 共用·兼治老存档）·非数组原样返回 */
function _tmFilterWenduiEntries(list, gm) {
  if (!Array.isArray(list)) return list;
  return list.filter(function (e) { return !_tmWenduiEntryConflict(e, gm); });
}

/** 写闸拒写留痕：落弱提示账 GM._aiWeakWriteHints + console.warn（弱纸条·AI 可忽略·非硬规则） */
function _tmRecordVitalConflictHint(npc, conflict, event) {
  try {
    if (typeof GM === "undefined" || !GM) return;
    var claimTarget = (conflict && conflict.claimTarget) || "";
    var hint = {
      kind: "memory_hist_conflict",
      npc: npc || "",
      claimTarget: claimTarget,
      textSlice: String(event || "").slice(0, 60),
      turn: GM.turn || 0,
      label: "memory_hist_conflict",   // 供 tm-endturn-prompt 弱纸条消费者渲染
      itemName: claimTarget
    };
    if (!GM._aiWeakWriteHints) GM._aiWeakWriteHints = [];
    GM._aiWeakWriteHints.push(hint);
    if (GM._aiWeakWriteHints.length > 20) GM._aiWeakWriteHints = GM._aiWeakWriteHints.slice(-20);
    try { console.warn("[记忆消毒·刀B] 拒写生死矛盾记忆·NPC=" + hint.npc + "·" + (conflict && conflict.claimType) + "「" + claimTarget + "」·以本局 GM 为准 · " + hint.textSlice); } catch (_) {}
  } catch (_) {}
}
if (typeof window !== "undefined") {
  window._tmDetectVitalConflict = _tmDetectVitalConflict;
  window._tmVitalScanMentions = _tmVitalScanMentions;
  window._tmFilterMemories = _tmFilterMemories;
  window._tmFilterWenduiEntries = _tmFilterWenduiEntries;
  window._tmMemEntryConflict = _tmMemEntryConflict;
  window._tmWenduiEntryConflict = _tmWenduiEntryConflict;
  window._tmRecordVitalConflictHint = _tmRecordVitalConflictHint;
}
// <<<刀B-DETECTOR-END>>>

var NpcMemorySystem = {
  /**
   * 获取角色的动态记忆容量（根据品位/身份/互动量分级）
   * @param {Object} ch - 角色对象
   * @returns {{active:number, archive:number, scars:number}}
   */
  getCapacity: function(ch) {
    if (!ch) return { active: 28, archive: 16, scars: 16 };

    // 模型上下文倍率（大模型=更多记忆容量）
    var modelScale = 1.0;
    if (typeof getCompressionParams === 'function') {
      var cp = getCompressionParams();
      modelScale = Math.max(0.6, Math.min(cp.scale, 2.5)); // 0.6~2.5
    }

    // 基础容量（所有人都有）·★2026-07-01 记住更多:base 20/12/10→28/17/14→再放大 40/24/18
    var active = 40, archive = 24, scars = 18;

    // ── 身份加成 ──
    // 玩家角色
    if (ch.isPlayer) { active = 180; archive = 96; scars = 64; }
    // 后妃
    else if (typeof _tmIsPlayerConsort === 'function' ? _tmIsPlayerConsort(ch) : ch.spouse === true) { active = 148; archive = 80; scars = 56; }
    else {
      // 官职品位加成
      var rank = 0;
      if (ch.officialTitle || ch.title) {
        var t = (ch.officialTitle || ch.title || '');
        if (/宰相|丞相|太师|太傅|太保|大将军|一品|摄政/.test(t)) rank = 5;
        else if (/尚书|节度使|枢密|中书|门下|二品|都督/.test(t)) rank = 4;
        else if (/侍郎|刺史|知府|三品|四品|将军|转运使/.test(t)) rank = 3;
        else if (/郎中|参军|员外|御史|五品|六品|县令/.test(t)) rank = 2;
        else if (t.length > 0) rank = 1;
      }
      active += rank * 15;  // ★记住更多(再放大):一品+75, 五六品+30, 无品+0
      archive += rank * 8;  // 一品+40
      scars += rank * 5;    // 一品+25

      // 势力首领额外
      if (GM.facs) {
        var isLeader = GM.facs.some(function(f) { return f.leader === ch.name; });
        if (isLeader) { active += 32; archive += 17; scars += 11; }
      }
    }

    // ── 互动加成（与玩家互动越多，记忆越丰富）──
    // D11: 使用GM._charInteractionCount缓存，每回合只计算一次
    var interactionBonus = 0;
    if (!GM._charInteractionCount || GM._charInteractionCountTurn !== GM.turn) {
      // 重建缓存
      GM._charInteractionCount = {};
      GM._charInteractionCountTurn = GM.turn;
      // 统计问对次数
      if (GM.wenduiHistory) {
        for (var _wk in GM.wenduiHistory) {
          GM._charInteractionCount[_wk] = (GM._charInteractionCount[_wk] || 0) + Math.min(20, (GM.wenduiHistory[_wk]||[]).length * 2);
        }
      }
      // 统计朝议参与
      if (GM._courtRecords) {
        GM._courtRecords.forEach(function(cr) {
          if (cr.stances) {
            for (var _cn in cr.stances) { GM._charInteractionCount[_cn] = (GM._charInteractionCount[_cn] || 0) + 4; }
          }
        });
      }
      // 统计纪事出现
      if (GM.jishiRecords) {
        var _jCounts = {};
        GM.jishiRecords.forEach(function(r) { if (r.char) _jCounts[r.char] = (_jCounts[r.char] || 0) + 1; });
        for (var _jk in _jCounts) { GM._charInteractionCount[_jk] = (GM._charInteractionCount[_jk] || 0) + Math.min(10, _jCounts[_jk]); }
      }
    }
    interactionBonus = GM._charInteractionCount[ch.name] || 0;
    active += interactionBonus;
    archive += Math.floor(interactionBonus / 2);

    // ── 模型倍率（大模型能处理更多记忆）──
    active = Math.round(active * modelScale);
    archive = Math.round(archive * modelScale);
    scars = Math.round(scars * modelScale);

    return {
      active: Math.max(16, Math.min(active, 480)),   // ★记住更多(再放大):绝对范围16~480(原10~200)
      archive: Math.max(10, Math.min(archive, 240)),  // 10~240(原5~80)
      scars: Math.max(10, Math.min(scars, 120))       // 10~120(原5~50)
    };
  },

  /**
   * 记录NPC个人记忆
   * @param {string} charName
   * @param {string} event - 事件描述
   * @param {string} emotion - 喜/怒/忧/惧/恨/敬/平
   * @param {number} [importance=5] - 1-10
   * @param {string} [relatedPerson] - 相关人物
   */
  remember: function(charName, event, emotion, importance, relatedPerson, meta) {
    if (!GM.chars) return;
    charName = _tmMemoryCanonName(charName);
    relatedPerson = _tmMemoryCanonName(relatedPerson);
    if (meta && typeof meta === 'object') {
      meta = Object.assign({}, meta);
      if (Array.isArray(meta.participants)) meta.participants = _tmMemoryCanonNameArray(meta.participants);
      if (Array.isArray(meta.witnesses)) meta.witnesses = _tmMemoryCanonNameArray(meta.witnesses);
    }
    var ch = _tmMemoryFindChar(charName);
    if (!ch || ch.alive === false) return;
    // 刀B·写闸：生死矛盾检测——AI 幻觉「X已伏诛」而本局 X 在世等，拒写（不落 _memory / _memoryArchiveFull /
    //   _impressions / _relationHistory / 不镜像），只落弱提示账 + console.warn 留痕。宁误放勿误杀。
    var _vitalConflict = (typeof _tmDetectVitalConflict === "function") ? _tmDetectVitalConflict(event) : null;
    if (_vitalConflict) { _tmRecordVitalConflictHint(charName, _vitalConflict, event); return; }
    if (!ch._memory) ch._memory = [];
    if (!ch._memArchive) ch._memArchive = [];

    // 近窗口完全相同 event 去重(防同一事件每回合重复刷·人物图志记忆清爽·2026-06-13)
    if (event && ch._memory.length) {
      for (var _ddi = ch._memory.length - 1, _ddn = 0; _ddi >= 0 && _ddn < 8; _ddi--, _ddn++) {
        if (ch._memory[_ddi] && ch._memory[_ddi].event === event) return;
      }
    }

    // 4.4: 结构化记忆类型推断
    var memType = (meta && meta.type) || 'general';
    if (memType === 'general') {
      if (/背叛|叛|反|谋|阴谋/.test(event)) memType = 'betrayal';
      else if (/恩|救|助|赏|赐|提拔|擢升/.test(event)) memType = 'kindness';
      else if (/辱|羞|贬|斥|罢/.test(event)) memType = 'humiliation';
      else if (/升|任|封|授|入仕|及第/.test(event)) memType = 'promotion';
      else if (/亡|死|丧|失|败/.test(event)) memType = 'loss';
      else if (/婚|嫁|娶|联姻/.test(event)) memType = 'marriage';
      else if (/战|征|伐|胜|败/.test(event)) memType = 'military';
      else if (/问对|谈|说|议/.test(event)) memType = 'dialogue';
    }

    GM._personalMemorySequence = (Number(GM._personalMemorySequence) || 0) + 1; // arch-ok: owning personal-memory writer allocates its persistent record IDs here
    var memEntry = {
      id: 'npc-memory-' + GM._personalMemorySequence, actorId: ch.id || charName,
      taskId: (meta && meta.taskId) || '',
      factStatus: (meta && meta.factStatus) || ((meta && (meta.source === 'reported' || meta.source === 'rumor')) ? 'unverified_claim' : 'personal_experience'),
      sourceRefs: (meta && Array.isArray(meta.sourceRefs)) ? meta.sourceRefs.slice(0, 12) : [],
      event: event,
      emotion: emotion || '平',
      importance: Math.max(0.1, Math.min(10, importance || 5)),
      turn: GM.turn,
      who: relatedPerson || '',
      type: memType,
      // === 方向4/13：感官+可信度扩展字段 ===
      location: (meta && meta.location) || '',
      witnesses: (meta && Array.isArray(meta.witnesses)) ? meta.witnesses.slice(0, 6) : [],
      source: (meta && meta.source) || 'witnessed',  // witnessed/reported/rumor/intuition
      credibility: (meta && meta.credibility != null) ? Math.max(0, Math.min(100, meta.credibility)) : 95,
      arcId: (meta && meta.arcId) || '',
      participants: (meta && Array.isArray(meta.participants)) ? meta.participants.slice(0, 10) : []
    };
    ch._memory.push(memEntry);
    if (typeof CharFullSchema !== 'undefined' && typeof CharFullSchema.syncInteractionMemory === 'function') {
      try { CharFullSchema.syncInteractionMemory(ch, memEntry, relatedPerson); } catch(_) {}
    }

    // === 方向5：全量无损归档（永不压缩） ===
    if (!GM._memoryArchiveFull) GM._memoryArchiveFull = [];
    var archiveEntry = Object.assign({}, memEntry, { char: charName, archiveTurn: GM.turn });
    GM._memoryArchiveFull.push(archiveEntry);

    // === 方向11：关系历史快照（favor 变化 ≥5 时记录） ===
    if (relatedPerson && relatedPerson !== charName) {
      if (!ch._impressions) ch._impressions = {};
      if (!ch._impressions[relatedPerson]) ch._impressions[relatedPerson] = { favor: 0, events: [] };
      var imp = ch._impressions[relatedPerson];
      var impWeight = Math.max(1, Math.min(importance || 5, 10)) / 5;
      var baseDelta = emotion === '喜' || emotion === '敬' ? 3 : emotion === '怒' || emotion === '恨' ? -4 : emotion === '忧' || emotion === '惧' ? -1 : 0;
      var delta = Math.round(baseDelta * impWeight);
      var oldFavor = imp.favor;
      imp.favor = Math.max(-100, Math.min(100, imp.favor + delta));
      imp.events.push(event.slice(0, 25));
      if (imp.events.length > 8) imp.events = imp.events.slice(-8);
      // 关系变化快照
      if (Math.abs(imp.favor - oldFavor) >= 5) {
        if (!ch._relationHistory) ch._relationHistory = {};
        if (!ch._relationHistory[relatedPerson]) ch._relationHistory[relatedPerson] = [];
        ch._relationHistory[relatedPerson].push({
          turn: GM.turn,
          favor: imp.favor,
          delta: imp.favor - oldFavor,
          reason: event.slice(0, 40),
          trigger: memType
        });
        if (ch._relationHistory[relatedPerson].length > 40) ch._relationHistory[relatedPerson] = ch._relationHistory[relatedPerson].slice(-40);
      }
    }

    NpcMemorySystem._updateMood(ch);
    if (NpcMemorySystem._memCache && NpcMemorySystem._memCache[charName]) delete NpcMemorySystem._memCache[charName];

    var _cap = NpcMemorySystem.getCapacity(ch);
    if (ch._memory.length > _cap.active) {
      if (ch._lastDecayTurn !== GM.turn) {
        ch._lastDecayTurn = GM.turn;
        var _monthScale = (typeof getTimeRatio === 'function') ? getTimeRatio() * 12 : 1;
        ch._memory.forEach(function(m) {
          if (m.turn >= GM.turn) return;
          if ((m.importance || 5) >= 7) return; // imp\u22657=\u523b\u9aa8\u5927\u4e8b\u00b7\u5951\u7ea6(\u89c1L2110\u6ce8\u91ca)\u6c38\u4e0d\u81ea\u52a8\u6de1\u5fd8\u53ea\u538b\u7f29\u6210\u4f24\u75a4\u2014\u2014\u8870\u51cf\u66fe\u628a\u4f24\u75a4\u7ea7\u6084\u7136\u964d\u683c(2026-07-04 \u5ba1\u67e5\u5b9a\u7f6a)
          var baseRate = (m.emotion === '\u6012' || m.emotion === '\u6068') ? 0.02 : 0.05;
          m.importance = Math.max(0.1, Math.min(10, (m.importance || 5) - baseRate * _monthScale));
        });
      }
      NpcMemorySystem._compressMemory(ch, _cap);
    }

    // === 方向2：互动镜像——为 relatedPerson 自动写入对应记忆 ===
    if (!(meta && meta._noMirror) && relatedPerson && relatedPerson !== charName) {
      NpcMemorySystem._mirrorToOther(charName, event, emotion, importance, relatedPerson, meta);
    }

    // === 方向2扩展：为所有 participants 写入（防镜像递归 + 必须是顶层调用）===
    if (meta && !meta._noMirror && Array.isArray(meta.participants) && meta.participants.length > 0) {
      meta.participants.forEach(function(pName) {
        if (!pName || pName === charName || pName === relatedPerson) return;
        NpcMemorySystem._mirrorToOther(charName, event, emotion, importance, pName, Object.assign({}, meta, { _noMirror: true, _asParticipant: true, participants: [] }));
      });
    }
  },

  /** 方向2：把事件镜像到另一方·情绪自动翻转 */
  _mirrorToOther: function(originName, event, emotion, importance, otherName, meta) {
    if (!GM.chars) return;
    originName = _tmMemoryCanonName(originName);
    otherName = _tmMemoryCanonName(otherName);
    var other = _tmMemoryFindChar(otherName);
    if (!other || other.alive === false) return;
    if (other._fakeDeath) return;
    // 情绪翻转映射
    var flipMap = { '怒': '平', '恨': '警', '忧': '察', '惧': '强', '喜': '喜', '敬': '谦', '平': '平' };
    var asParticipant = meta && meta._asParticipant;
    var mirroredEmotion = asParticipant ? emotion : (flipMap[emotion] || '平');
    // 构造镜像事件描述
    var mirroredEvent;
    if (asParticipant) mirroredEvent = '（在场）' + event;
    else mirroredEvent = '（与' + originName + '）' + event;
    // importance 稍衰减（非亲历者记忆稍浅）
    var mirroredImp = Math.max(0.5, (importance || 5) - (asParticipant ? 0 : 1));
    // 镜像 meta·标记 _noMirror 防止死循环
    var mirroredMeta = Object.assign({}, meta || {}, { _noMirror: true });
    // 递归调用 remember·但关闭 mirror
    NpcMemorySystem.remember(otherName, mirroredEvent, mirroredEmotion, mirroredImp, originName, mirroredMeta);
  },

  /**
   * 简化版记忆写入（适配新系统的addMemory调用）
   * @param {string} charName
   * @param {string} event - 事件描述
   * @param {number} importance - 1-10
   * @param {string} [category] - 类别标签（career/scheme/political等，用于事件前缀）
   */
  addMemory: function(charName, event, importance, category) {
    charName = _tmMemoryCanonName(charName);
    // 根据事件内容和重要性推断情绪
    var emotion = '平';
    if (/嘉许|优等|擢升|成功|得逞|入仕|继位|登基|喜|大捷|胜/.test(event)) emotion = '喜';
    else if (/败露|劣等|受害|名裂|驾崩|阴谋|失败/.test(event)) emotion = '忧';
    else if (/识破|不安|忧惧|左迁|贬/.test(event)) emotion = '惧';
    // 委托给remember
    this.remember(charName, event, emotion, importance || 5);
    // 6.2: 写入后使该角色的缓存失效
    if (this._memCache && this._memCache[charName]) delete this._memCache[charName];
  },

  /** 更新角色当前情绪状态（基于近期记忆的主导情绪） */
  _updateMood: function(ch) {
    if (!ch._memory || ch._memory.length === 0) { ch._mood = '平'; return; }
    // 时近加权:越新的情绪记忆越主导当下心绪·过久(>8回合)的事件不再主导·跳过"平"噪声·
    // 近期无显著情绪事件则归于"平"(防低活跃NPC心绪被陈年记忆冻结·衰减只在超容量触发不兜底·2026-06-14)
    var _nowT = (typeof GM !== 'undefined' && GM && GM.turn) || 0;
    var recent = ch._memory.slice(-5);
    var counts = {};
    recent.forEach(function(m) {
      if (!m || !m.emotion || m.emotion === '平') return;
      var age = _nowT - (m.turn || 0);
      if (age > 8) return;
      var recencyW = age <= 1 ? 1 : (age <= 3 ? 0.6 : (age <= 6 ? 0.3 : 0.15));
      counts[m.emotion] = (counts[m.emotion] || 0) + (m.importance || 5) * recencyW;
    });
    var dominant = '平', maxW = 0;
    for (var e in counts) { if (counts[e] > maxW) { maxW = counts[e]; dominant = e; } }
    ch._mood = dominant;
  },

  /**
   * 压缩旧记忆——保留关键事件，提炼摘要，高importance变为"伤疤/勋章"
   */
  _compressMemory: function(ch, cap) {
    if (!cap) cap = NpcMemorySystem.getCapacity(ch);
    var half = Math.floor(ch._memory.length / 2);
    var old = ch._memory.slice(0, half);
    ch._memory = ch._memory.slice(half);

    // 高importance的记忆（>=7）不进入摘要，而是变成永久"伤疤/勋章"
    if (!ch._scars) ch._scars = [];
    var remaining = [];
    old.forEach(function(m) {
      if (m.importance >= 7) {
        ch._scars.push({ event: m.event.slice(0, 40), emotion: m.emotion, turn: m.turn, who: m.who || '' });
        // ★2026-07-01 防失忆:伤疤超容量不再 FIFO 直丢·把移出的最老伤疤折入档案(仍保留痕迹)
        if (ch._scars.length > cap.scars) { var _dsc = ch._scars.shift(); if (_dsc) NpcMemorySystem._archiveAgingMemory(ch, { event: '〔铭刻〕' + (_dsc.event || ''), who: _dsc.who, emotion: _dsc.emotion, turn: _dsc.turn }); }
      } else {
        remaining.push(m);
      }
    });

    // 剩余记忆：按importance排序，保留最重要的事件全文，其余按情绪分组
    if (remaining.length > 0) {
      // 分离：importance>=5的保留详细，<5的压缩
      var importantOnes = remaining.filter(function(m) { return (m.importance || 0) >= 5; });
      var trivialOnes = remaining.filter(function(m) { return (m.importance || 0) < 5; });

      var summaryParts = [];
      // 重要事件保留较长描述
      if (importantOnes.length > 0) {
        summaryParts.push(importantOnes.map(function(m) {
          return m.event.slice(0, 30) + (m.who ? '(' + m.who + ')' : '') + '[' + m.emotion + ']';
        }).join('；'));
      }
      // 琐碎事件按情绪分组压缩
      if (trivialOnes.length > 0) {
        var emotionGroups = {};
        trivialOnes.forEach(function(m) {
          if (!emotionGroups[m.emotion]) emotionGroups[m.emotion] = [];
          emotionGroups[m.emotion].push(m.event.slice(0, 15));
        });
        for (var emo in emotionGroups) {
          summaryParts.push('(' + emo + ')' + emotionGroups[emo].join('、'));
        }
      }
      var turnRange = remaining[0].turn + '-' + remaining[remaining.length - 1].turn;

      if (!ch._memArchive) ch._memArchive = [];
      ch._memArchive.push({
        period: turnRange,
        summary: summaryParts.join('。'),
        count: remaining.length,
        keyEvents: importantOnes.length
      });
      if (ch._memArchive.length > cap.archive) {
        NpcMemorySystem._foldArchive(ch, cap);   // ★防失忆:老段"再压缩"成纪元粗摘要·不再 slice 丢弃
      }
    }
    _dbg('[NpcMem] ' + ch.name + ' 记忆压缩：' + old.length + '条→归档+' + (ch._scars||[]).length + '伤疤');
  },

  /**
   * ★2026-07-01 防失忆核心:档案溢出时把最老的若干段"再压缩"成一条更粗的「纪元概略」·而非 slice 丢弃。
   *   → NPC 早年人生始终保留一条(逐渐粗化但恒在)的痕迹·不再整段失忆。纪元摘要上限 300 字·多次溢出会递归并粗。
   */
  _foldArchive: function(ch, cap) {
    if (!ch || !ch._memArchive) return;
    if (!cap) cap = NpcMemorySystem.getCapacity(ch);
    if (ch._memArchive.length <= cap.archive) return;
    var overflow = ch._memArchive.length - cap.archive;
    var merge = ch._memArchive.slice(0, overflow + 1);   // 多并 1 条给后续段腾位
    var rest = ch._memArchive.slice(overflow + 1);
    var startP = String(merge[0].period || '').split('-')[0] || '';
    var endP = String(merge[merge.length - 1].period || '').split('-').pop() || '';
    var mergedSummary = merge.map(function(a) { return a.summary || ''; }).filter(Boolean).join('｜');
    ch._memArchive = [{
      period: (startP && endP) ? (startP + '-' + endP) : (merge[0].period || ''),
      summary: '〔早年概略〕' + mergedSummary.slice(0, 300),
      _raw: mergedSummary.slice(0, 600),   // ★供 refineEpochSummaries 走次要 API 凝练的原料(确定性摘要仍在 summary 兜底)
      _needsRefine: true,                  // ★标记待 AI 精炼(refineEpochSummaries 节流处理·失败则保留确定性摘要)
      count: merge.reduce(function(s, a) { return s + (a.count || 0); }, 0),
      keyEvents: merge.reduce(function(s, a) { return s + (a.keyEvents || 0); }, 0),
      _epoch: true
    }].concat(rest);
  },

  /**
   * ★2026-07-01 早年概略 AI 精炼:把 _foldArchive 生成的确定性纪元摘要(_raw 零散片段)·交 AI 凝练成一句连贯的
   *   「早年概略」(默认走次要 API·省钱)。节流:每次最多精炼 limit 个 NPC·由回合末后台非阻塞调用·失败/无AI则保留
   *   确定性摘要不阻断。async·返回本次精炼数。
   */
  refineEpochSummaries: async function(opts) {
    opts = opts || {};
    if (typeof callAIMessages !== 'function') return 0;
    if (typeof GM === 'undefined' || !GM || !Array.isArray(GM.chars)) return 0;
    var limit = opts.limit || 2;   // 每回合最多精炼 2 个·防烧钱
    var tier = opts.tier || 'secondary';
    var done = 0;
    for (var i = 0; i < GM.chars.length && done < limit; i++) {
      var ch = GM.chars[i];
      if (!ch || ch.alive === false || !Array.isArray(ch._memArchive)) continue;
      var ep = null;
      for (var j = 0; j < ch._memArchive.length; j++) { if (ch._memArchive[j] && ch._memArchive[j]._needsRefine && ch._memArchive[j]._epoch) { ep = ch._memArchive[j]; break; } }
      if (!ep) continue;
      var raw = String(ep._raw || ep.summary || '').replace(/〔[^〕]*〕/g, '').slice(0, 600).trim();
      if (!raw) { ep._needsRefine = false; continue; }
      try {
        var res = await callAIMessages([
          { role: 'system', content: '你是史官。把某人早年的零散记忆片段·凝练成一句连贯的「早年概略」:第三人称·≤80字·点出其早年关键际遇与由此养成的心性底色·忠于片段不杜撰。只返回概略正文·勿加书名号/引号/前后缀。' },
          { role: 'user', content: (ch.name || '此人') + '·早年记忆片段：\n' + raw }
        ], 400, null, tier);
        var txt = (typeof res === 'string') ? res : ((res && (res.content || res.text)) || '');
        txt = String(txt).replace(/^[\s"「『（(]+|[\s"」』）)]+$/g, '').replace(/[\r\n]+/g, ' ').slice(0, 96).trim();
        if (txt) { ep.summary = '〔早年概略〕' + txt; ep._refined = true; }
      } catch (e) { /* AI 失败不阻断·保留确定性摘要 */ }
      ep._needsRefine = false;
      try { delete ep._raw; } catch (_) {}   // 精炼(或尝试)后原料不再需要·删之省存档
      done++;
    }
    return done;
  },

  /**
   * ★2026-07-01 防失忆:monthlyDecay 中「老化的中要度记忆」与「溢出的最老伤疤」在被删前·先折入档案的一条滚动「散忆」，
   *   而非直接消失。低活跃 NPC(记忆从不撑破容量、不触发压缩归档)因此也不再整段失忆。散忆条上限 ~280 字·满则新起一条。
   */
  _archiveAgingMemory: function(ch, m) {
    if (!ch || !m) return;
    if (!ch._memArchive) ch._memArchive = [];
    var note = String(m.event || '').slice(0, 20) + (m.who ? '(' + m.who + ')' : '') + '[' + (m.emotion || '平') + ']';
    var last = ch._memArchive[ch._memArchive.length - 1];
    if (last && last._loose && String(last.summary || '').length < 280) {
      last.summary += '、' + note;
      last.count = (last.count || 0) + 1;
      last.period = String(last.period || '').split('-')[0] + '-' + (m.turn || GM.turn || 0);
    } else {
      ch._memArchive.push({ period: (m.turn || GM.turn || 0) + '-' + (m.turn || GM.turn || 0), summary: '〔散忆〕' + note, count: 1, keyEvents: 0, _loose: true });
    }
    var cap = NpcMemorySystem.getCapacity(ch);
    if (ch._memArchive.length > cap.archive) NpcMemorySystem._foldArchive(ch, cap);
  },

  /** 获取角色的记忆摘要（供AI使用——像一个人的内心自述）6.2: 带每回合缓存 */
  _memCache: {}, _memCacheTurn: -1,
  getMemoryContext: function(charName, opts) {
    opts = opts || {};
    charName = _tmMemoryCanonName(charName);
    // 6.2: 每回合缓存——同一回合内同一角色只构建一次（读档代际参与失效·读同turn档曾把旧局记忆注入新局prompt·2026-07-04 审查定罪）
    var _mcGen = (typeof window !== 'undefined' && window._tmLoadGen) || 0;
    // 刀B·同回合生死翻转→缓存失效：本回合内某人物改判死/生后，含其生死态的旧 context 须重算(否则 turn+1 才消失)。
    // 生死签名=本回合已判死人数(五个死亡 sink 均置 deathTurn=GM.turn·计此签名免在各 sink ++·覆盖全 sink 的判死方向)。
    // ★边界：签名只覆盖「判死」方向；死→活的复活翻转(若保留 deathTurn)不使缓存失效。Codex 核实当前游戏无复活写口
    //   (策名亦先返回同名死者)故不可达；若未来新增复活写口，须在该处同步 bust 本缓存。
    var _vitalSig = 0, _vgChars = GM.chars || [];
    for (var _vi = 0; _vi < _vgChars.length; _vi++) { var _vgc = _vgChars[_vi]; if (_vgc && (_vgc.deathTurn === GM.turn || _vgc._deathTurn === GM.turn)) _vitalSig++; }
    if (this._memCacheTurn !== GM.turn || this._memCacheGen !== _mcGen || this._memCacheVital !== _vitalSig) { this._memCache = {}; this._memCacheTurn = GM.turn; this._memCacheGen = _mcGen; this._memCacheVital = _vitalSig; }
    // World facts are rebuilt below; only the personal summary is cached.
    if (!GM.chars) return '';
    charName = _tmMemoryCanonName(charName);
    var ch = _tmMemoryFindChar(charName);
    if (!ch) return '';
    var parts = [], liveParts = [];

    // 角色自我认识（字/家族/仕途/心事等，AI 据此保持身份一致）
    if (typeof CharFullSchema !== 'undefined' && typeof CharFullSchema.toAIContext === 'function') {
      var selfCtx = CharFullSchema.toAIContext(ch);
      if (selfCtx) liveParts.push(selfCtx);
    }
    // 角色所知天下大势——货币/央地财政/户口/环境/诏令（精要）
    if (typeof CurrencyEngine !== 'undefined' && typeof CurrencyEngine.getAIContext === 'function') {
      try { var cc = CurrencyEngine.getAIContext(); if (cc) liveParts.push(cc); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-mechanics');}catch(_){}}
    }
    if (typeof CentralLocalEngine !== 'undefined' && typeof CentralLocalEngine.getAIContext === 'function') {
      try { var cl = CentralLocalEngine.getAIContext(); if (cl) liveParts.push(cl); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-mechanics');}catch(_){}}
    }
    if (typeof HujiEngine !== 'undefined' && typeof HujiEngine.getAIContext === 'function') {
      try { var hj = HujiEngine.getAIContext(); if (hj) liveParts.push(hj); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-mechanics');}catch(_){}}
    }
    if (typeof HujiDeepFill !== 'undefined' && typeof HujiDeepFill.getExtendedAIContext === 'function') {
      try { var hjd = HujiDeepFill.getExtendedAIContext(); if (hjd) liveParts.push(hjd); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-mechanics');}catch(_){}}
    }
    if (typeof EnvCapacityEngine !== 'undefined' && typeof EnvCapacityEngine.getAIContext === 'function') {
      try { var env = EnvCapacityEngine.getAIContext(); if (env) liveParts.push(env); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-mechanics');}catch(_){}}
    }
    if (typeof EdictParser !== 'undefined' && typeof EdictParser.getAIContext === 'function') {
      try { var ep = EdictParser.getAIContext(); if (ep) liveParts.push(ep); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-mechanics');}catch(_){}}
    }
    if (typeof AuthorityEngines !== 'undefined' && typeof AuthorityEngines.getAuthorityAIContext === 'function') {
      try { var auth = AuthorityEngines.getAuthorityAIContext(); if (auth) liveParts.push(auth); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-mechanics');}catch(_){}}
    }
    if (typeof AuthorityComplete !== 'undefined' && typeof AuthorityComplete.getExtendedAIContext === 'function') {
      try { var authc = AuthorityComplete.getExtendedAIContext(); if (authc) liveParts.push(authc); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-mechanics');}catch(_){}}
    }
    if (typeof HistoricalPresets !== 'undefined' && typeof HistoricalPresets.getAIContext === 'function') {
      try { var hp = HistoricalPresets.getAIContext(); if (hp) liveParts.push(hp); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-mechanics');}catch(_){}}
    }

    var personalStamp = JSON.stringify([ch.age,ch.stress,ch._mood,ch._mentorId,ch._tenure,ch._impressions,(ch._memory||[]).length,(ch._scars||[]).length,(ch._memArchive||[]).length]);
    this._personalStamps = this._personalStamps || {};
    function combine(text) {
      var topic = opts.topic || opts.query || '';
      var recalled = topic && typeof TM !== 'undefined' && TM.PersonalMemoryRecall ? TM.PersonalMemoryRecall.personal(GM,ch,topic,6) : '';
      return [liveParts.join('。'),text,recalled ? '议题相关原始记忆：'+recalled : ''].filter(Boolean).join('。');
    }
    if(this._memCache[charName] && this._personalStamps[charName]===personalStamp) return combine(this._memCache[charName]);

    // 人生阶段感（基于年龄和经历量）
    if (ch.age) {
      var memCount = (ch._memory || []).length + (ch._memArchive || []).length;
      if (ch.age < 25) parts.push(memCount > 10 ? '年少历多' : '年少气盛');
      else if (ch.age < 35) parts.push('正值壮年');
      else if (ch.age < 50) parts.push(memCount > 15 ? '饱经风霜' : '阅历渐丰');
      else if (ch.age < 65) parts.push('老成持重');
      else parts.push('垂暮之年');
    }

    // 当前情绪（更细腻的表达，叠加压力修正）
    if (ch._mood && ch._mood !== '平') {
      var moodLabels = { '喜': '心中暗喜', '怒': '满腔怒火难平', '忧': '眉头紧锁', '惧': '心中忐忑', '恨': '怨恨难消', '敬': '心怀感念' };
      var ml = moodLabels[ch._mood] || ch._mood;
      if ((ch.stress || 0) > 60) ml += '且压力沉重';
      parts.push(ml);
    } else if ((ch.stress || 0) > 60) {
      parts.push('压力沉重，精神疲惫');
    }

    // 性格沉淀——从归档记忆中提取此人的"人生底色"
    if (ch._memArchive && ch._memArchive.length > 0) {
      // 统计归档中各情绪出现比例→推断人生底色
      var emoCount = { '喜': 0, '怒': 0, '忧': 0, '惧': 0, '恨': 0, '敬': 0 };
      ch._memArchive.forEach(function(a) {
        var s = a.summary || '';
        if (s.indexOf('喜') >= 0) emoCount['喜']++;
        if (s.indexOf('怒') >= 0) emoCount['怒']++;
        if (s.indexOf('忧') >= 0) emoCount['忧']++;
        if (s.indexOf('恨') >= 0) emoCount['恨']++;
        if (s.indexOf('敬') >= 0) emoCount['敬']++;
      });
      var dominant = Object.keys(emoCount).reduce(function(a, b) { return emoCount[a] >= emoCount[b] ? a : b; });
      if (emoCount[dominant] >= 2) {
        var sediment = { '喜': '一生多逢好事，心态乐观', '怒': '一生多遭不平，性格暴躁', '忧': '一生多经忧患，性格沉郁', '恨': '一生多遭背叛，心怀戒备', '敬': '一生多遇贵人，知恩图报' };
        parts.push(sediment[dominant] || '');
      }
      // ★2026-07-01 防失忆闭环:除最近一段·再 surface 最早一段(折叠的「早年概略/散忆」恒在队首)·
      //   让 NPC 忆及早年而非只近事——被保留的老记忆真正读进推演上下文·而非只默默影响"人生底色"。
      var _arch = ch._memArchive;
      if (_arch.length === 1) {
        parts.push('往事：' + String(_arch[0].summary || '').slice(0, 80));
      } else {
        parts.push('往事·近：' + String(_arch[_arch.length - 1].summary || '').slice(0, 80));
        parts.push('往事·早年：' + String(_arch[0].summary || '').slice(0, 90));
      }
    }

    // 4.4: 近期记忆（按重要性前4，结构化格式含类型和重要度）
    // 刀B·单点收口：与本局 GM 生死态冲突的记忆条目不注入（getMemoryContext=问对/奏疏/朝议/廷议/御前/鸿雁/时政/势力/编制 等所有场景共用总入口·此处过滤·全部间接消费者自动受益）
    var _gmcMem = (typeof _tmFilterMemories === 'function') ? _tmFilterMemories(ch._memory, GM) : ch._memory;
    if (_gmcMem && _gmcMem.length > 0) {
      var sorted = _gmcMem.slice().sort(function(a, b) { return b.importance - a.importance; });
      var top = sorted.slice(0, 4);
      var memIdx = 0;
      var circled = ['①','②','③','④','⑤','⑥','⑦','⑧'];
      parts.push('铭记：' + top.map(function(m) {
        var label = circled[memIdx++] || (memIdx + '.');
        var mType = m.type || 'general';
        var imp = Math.round(m.importance) || 5;
        return label + 'T' + (m.turn || GM.turn) + ' 类型:' + mType + ' ' + m.event + (m.who ? '(' + m.who + ')' : '') + '(' + (m.emotion || '平') + ',重' + imp + ')';
      }).join(' '));
    }

    // 对人的感情（更丰富的关系描述，含原因）
    if (ch._impressions) {
      var impParts = [];
      for (var pName in ch._impressions) {
        var imp = ch._impressions[pName];
        if (Math.abs(imp.favor) >= 5) {
          var rel = imp.favor >= 30 ? '感恩戴德' : imp.favor >= 15 ? '视为恩人' : imp.favor >= 5 ? '颇有好感' : imp.favor <= -30 ? '不共戴天' : imp.favor <= -15 ? '恨之入骨' : imp.favor <= -5 ? '心存芥蒂' : '';
          if (rel) {
            var reason = (imp.events && imp.events.length > 0) ? imp.events[imp.events.length - 1] : '';
            impParts.push('对' + pName + rel + (reason ? '(因' + reason.slice(0, 12) + ')' : ''));
          }
        }
      }
      if (impParts.length > 0) parts.push(impParts.slice(0, 5).join('，'));
    }

    // 永久伤疤/勋章（一生中最刻骨铭心的经历，永远影响此人）
    if (ch._scars && ch._scars.length > 0) {
      parts.push('刻骨铭心：' + ch._scars.slice(-3).map(function(s) {
        return s.event + '[' + s.emotion + ']';
      }).join('；'));
    }

    // 师徒关系
    if (ch._mentorId) parts.push('师从' + ch._mentorId);

    // 任职经历
    if (ch._tenure) {
      var posts = [];
      for (var pk in ch._tenure) { if (ch._tenure[pk] >= 3) posts.push(pk + Math.floor(ch._tenure[pk] / 4) + '年'); }
      if (posts.length) parts.push('历任' + posts.slice(-3).join('、'));
    }

    var result = parts.join('。');
    this._memCache[charName] = result;
    this._personalStamps[charName] = personalStamp;
    return combine(result);
  },

  /** 获取对特定人物的印象值 */
  getImpression: function(charName, targetName) {
    if (!GM.chars) return 0;
    charName = _tmMemoryCanonName(charName);
    targetName = _tmMemoryCanonName(targetName);
    var ch = _tmMemoryFindChar(charName);
    if (!ch || !ch._impressions || !ch._impressions[targetName]) return 0;
    return ch._impressions[targetName].favor;
  },

  /** 获取角色当前情绪 */
  getMood: function(charName) {
    if (!GM.chars) return '平';
    charName = _tmMemoryCanonName(charName);
    var ch = _tmMemoryFindChar(charName);
    return (ch && ch._mood) || '平';
  },

  /** 月度记忆衰减（智能版：重要记忆不衰减，低重要记忆缓慢淡忘） */
  monthlyDecay: function() {
    if (!GM.chars) return;
    GM.chars.forEach(function(ch) {
      if (ch.alive === false) return;
      // 确保所有活着的角色都有记忆系统（延迟初始化）
      if (!ch._memory) ch._memory = [];
      if (!ch._memArchive) ch._memArchive = [];
      if (!ch._impressions) ch._impressions = {};
      if (!ch._scars) ch._scars = [];
      if (ch._memory) {
        ch._memory = ch._memory.filter(function(m) {
          var age = GM.turn - (m.turn || 0);
          // importance>=7的记忆永不自动淡忘（会在压缩时变成_scars）
          if (m.importance >= 7) return true;
          // ★2026-07-01 完全不删只压缩:任何要度的记忆老化都不直删·一律 _archiveAgingMemory 折入档案(散忆)·仅移出活跃层。
          // importance 5-6: 超过50回合移出活跃（原30）
          if (m.importance >= 5) { if (age <= 50) return true; NpcMemorySystem._archiveAgingMemory(ch, m); return false; }
          // importance 3-4: 超过30回合移出活跃（原18）
          if (m.importance >= 3) { if (age <= 30) return true; NpcMemorySystem._archiveAgingMemory(ch, m); return false; }
          // importance 1-2: 超过20回合移出活跃（原10）·★琐碎事也折档不直删
          if (age <= 20) return true; NpcMemorySystem._archiveAgingMemory(ch, m); return false;
        });
      }
      // 印象衰减（不对称：恩情慢衰，怨恨更慢衰——人记仇比记恩更久）
      if (ch._impressions) {
        for (var pn in ch._impressions) {
          var imp = ch._impressions[pn];
          if (imp.favor > 0) imp.favor = Math.max(0, imp.favor - 0.4);
          else if (imp.favor < 0) imp.favor = Math.min(0, imp.favor + 0.2); // 怨恨衰减更慢
          if (Math.abs(imp.favor) < 0.5 && (!imp.events || imp.events.length === 0)) delete ch._impressions[pn];
        }
      }
      NpcMemorySystem._updateMood(ch);
    });
  },

  // ═══════════════════════════════════════════════════════════════════
  //  方向 3：ch._arcs 个人剧情弧管理
  // ═══════════════════════════════════════════════════════════════════
  /**
   * 将记忆关联到现有 arc 或创建新 arc
   * @param {string} charName
   * @param {Object} arcData - {id?, title, type, participants?, phase?}
   */
  upsertArc: function(charName, arcData) {
    if (!GM.chars || !arcData || !arcData.title) return null;
    charName = _tmMemoryCanonName(charName);
    if (Array.isArray(arcData.participants)) arcData.participants = _tmMemoryCanonNameArray(arcData.participants);
    var ch = _tmMemoryFindChar(charName);
    if (!ch) return null;
    if (!ch._arcs) ch._arcs = [];
    var arc = null;
    if (arcData.id) arc = ch._arcs.find(function(a) { return a.id === arcData.id; });
    if (!arc) arc = ch._arcs.find(function(a) { return a.title === arcData.title; });
    if (!arc) {
      arc = {
        id: arcData.id || ('arc_' + (GM.turn || 0) + '_' + Math.random().toString(36).slice(2, 7)),
        title: arcData.title,
        type: arcData.type || 'political',
        participants: arcData.participants || [charName],
        phase: arcData.phase || 'brewing',
        startTurn: GM.turn || 0,
        lastUpdateTurn: GM.turn || 0,
        events: [],
        emotionalTrajectory: '',
        unresolved: arcData.unresolved || ''
      };
      ch._arcs.push(arc);
    }
    // 更新字段
    if (arcData.phase) arc.phase = arcData.phase;
    if (arcData.emotionalTrajectory) arc.emotionalTrajectory = arcData.emotionalTrajectory;
    if (arcData.unresolved) arc.unresolved = arcData.unresolved;
    arc.lastUpdateTurn = GM.turn || 0;
    // 限制：每人最多 15 个活跃 arc·resolved 超 10 回合删除
    ch._arcs = ch._arcs.filter(function(a) {
      if (a.phase === 'resolved' && (GM.turn - a.lastUpdateTurn) > 10) return false;
      return true;
    });
    if (ch._arcs.length > 15) {
      // 保留最近活跃的
      ch._arcs.sort(function(a, b) { return b.lastUpdateTurn - a.lastUpdateTurn; });
      ch._arcs = ch._arcs.slice(0, 15);
    }
    return arc;
  },

  /**
   * 把一条 memory 关联到 arc
   */
  linkMemoryToArc: function(charName, memoryIdx, arcId) {
    if (!GM.chars) return;
    charName = _tmMemoryCanonName(charName);
    var ch = _tmMemoryFindChar(charName);
    if (!ch || !ch._memory || !ch._memory[memoryIdx]) return;
    ch._memory[memoryIdx].arcId = arcId;
    if (ch._arcs) {
      var arc = ch._arcs.find(function(a) { return a.id === arcId; });
      if (arc) {
        arc.events.push({ turn: GM.turn || 0, memoryIdx: memoryIdx });
        arc.lastUpdateTurn = GM.turn || 0;
        if (arc.events.length > 30) arc.events = arc.events.slice(-30);
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════════
  //  方向 6：recallMemory API（RAG 式按需检索）
  //  支持 keywords/turnRange/participant/minImportance/arcId/type 过滤
  //  从 GM._memoryArchiveFull（永久档）检索·返回匹配条目数组
  // ═══════════════════════════════════════════════════════════════════
  recallMemory: function(query, opts) {
    query = query || {};
    opts = opts || {};
    if (query.participant) query.participant = _tmMemoryCanonName(query.participant);
    var limit = opts.limit || 20;
    var sortBy = opts.sortBy || 'importance';  // importance|turn|credibility
    var archive = (typeof GM !== 'undefined' && GM._memoryArchiveFull) ? GM._memoryArchiveFull : [];
    if (archive.length === 0) return [];

    var results = archive.filter(function(m) {
      if (!m) return false;
      // 关键词匹配（全文扫）
      if (query.keywords && Array.isArray(query.keywords) && query.keywords.length > 0) {
        var text = (m.event || '') + ' ' + (m.who || '') + ' ' + (m.char || '') + ' ' + (m.location || '');
        var anyMatch = query.keywords.some(function(kw) { return text.indexOf(kw) >= 0; });
        if (!anyMatch) return false;
      }
      // 回合范围
      if (query.turnRange && Array.isArray(query.turnRange)) {
        if (m.turn < query.turnRange[0] || m.turn > query.turnRange[1]) return false;
      }
      // 参与者（who 或 participants[]）
      if (query.participant) {
        var isParticipant = m.who === query.participant ||
                            m.char === query.participant ||
                            (Array.isArray(m.participants) && m.participants.indexOf(query.participant) >= 0) ||
                            (Array.isArray(m.witnesses) && m.witnesses.indexOf(query.participant) >= 0);
        if (!isParticipant) return false;
      }
      // 最低重要度
      if (query.minImportance && (m.importance || 0) < query.minImportance) return false;
      // arcId
      if (query.arcId && m.arcId !== query.arcId) return false;
      // type
      if (query.type && m.type !== query.type) return false;
      // 最低可信度
      if (query.minCredibility && (m.credibility || 0) < query.minCredibility) return false;
      // source 过滤
      if (query.source && m.source !== query.source) return false;
      return true;
    });

    // 排序
    results.sort(function(a, b) {
      if (sortBy === 'turn') return (b.turn || 0) - (a.turn || 0);
      if (sortBy === 'credibility') return (b.credibility || 0) - (a.credibility || 0);
      return (b.importance || 0) - (a.importance || 0);
    });

    return results.slice(0, limit);
  },

  /** 兼容旧调用：按角色名取最近个人记忆，供朝议/旧模块读取 */
  recall: function(charName, limit) {
    limit = limit || 5;
    charName = _tmMemoryCanonName(charName);
    if (!charName) return [];
    var archive = (typeof GM !== 'undefined' && Array.isArray(GM._memoryArchiveFull)) ? GM._memoryArchiveFull : [];
    var hits = archive.filter(function(m) { return m && m.char === charName; });
    if (hits.length > 0) {
      hits.sort(function(a, b) { return (b.turn || 0) - (a.turn || 0); });
      return hits.slice(0, limit);
    }
    var ch = (typeof GM !== 'undefined' && GM.chars) ? GM.chars.find(function(c) { return c && c.name === charName; }) : null;
    if (ch && Array.isArray(ch._memory)) return ch._memory.slice(-limit).reverse();
    return [];
  },

  /** 获取 NPC 的所有活跃 arc（phase ≠ resolved） */
  getActiveArcs: function(charName) {
    if (!GM.chars) return [];
    charName = _tmMemoryCanonName(charName);
    var ch = _tmMemoryFindChar(charName);
    if (!ch || !ch._arcs) return [];
    return ch._arcs.filter(function(a) { return a.phase !== 'resolved'; });
  },

  /** 获取 NPC 对另一人的关系演变快照 */
  getRelationHistory: function(charName, otherName) {
    if (!GM.chars) return [];
    charName = _tmMemoryCanonName(charName);
    otherName = _tmMemoryCanonName(otherName);
    var ch = _tmMemoryFindChar(charName);
    if (!ch || !ch._relationHistory || !ch._relationHistory[otherName]) return [];
    return ch._relationHistory[otherName];
  }
};

// ============================================================
// NPC 成长系统 — 属性随经历自然变化
// ============================================================
var CharacterGrowthSystem = {
  /**
   * 记录角色历练（不是数值升级，而是记录具体的成长经历供AI参考）
   * AI在推演中根据这些经历自然地调整角色的表现
   * @param {string} charName
   * @param {string} domain - 历练领域
   * @param {string} desc - 具体经历描述
   */
  recordExperience: function(charName, domain, desc) {
    if (!GM.chars) return;
    charName = _tmMemoryCanonName(charName);
    var ch = _tmMemoryFindChar(charName);
    if (!ch || ch.alive === false) return;
    if (!ch._lifeExp) ch._lifeExp = [];
    ch._lifeExp.push({ domain: domain, desc: desc, turn: GM.turn });
    if (ch._lifeExp.length > 20) ch._lifeExp = ch._lifeExp.slice(-20);
  },

  /**
   * 每回合更新——基于角色处境积累人生经历
   * 不直接修改属性——属性变化通过AI推演的char_updates字段实现
   */
  /**
   * 每回合更新——静默积累任职时间，仅在关键节点记录经历
   * 真实的人不会每天记录"今天又上班了"，只有里程碑才值得铭记
   */
  autoGainExperience: function() {
    if (!GM.chars) return;
    GM.chars.forEach(function(ch) {
      if (ch.alive === false) return;

      // 静默积累任职时间（不生成经历条目）
      if (!ch._tenure) ch._tenure = {};
      var office = typeof findNpcOffice === 'function' ? findNpcOffice(ch.name) : null;
      if (office) {
        var posKey = (office.deptName || '') + (office.posName || '');
        if (!ch._tenure[posKey]) ch._tenure[posKey] = 0;
        ch._tenure[posKey]++;

        // 里程碑节点：任职满一年(4回合)时记录一次
        if (ch._tenure[posKey] === 4) {
          var domain = (posKey.indexOf('将') >= 0 || posKey.indexOf('军') >= 0) ? '军旅' : (posKey.indexOf('刺史') >= 0 || posKey.indexOf('太守') >= 0 || posKey.indexOf('知') >= 0) ? '治理' : '仕途';
          CharacterGrowthSystem.recordExperience(ch.name, domain, '任' + posKey + '已满一年，渐入佳境');
        }
        // 任职满三年——已是老手
        else if (ch._tenure[posKey] === 12) {
          CharacterGrowthSystem.recordExperience(ch.name, '老练', '任' + posKey + '三年有余，深谙其道');
        }
      }

      // 师徒——不是每回合记录，而是根据师徒关系时长
      if (ch._mentorId) {
        if (!ch._mentorTurns) ch._mentorTurns = 0;
        ch._mentorTurns++;
        var mentor = GM.chars.find(function(c2) { return c2.name === ch._mentorId && c2.alive !== false; });
        if (mentor) {
          // 拜师半年——初有所得
          if (ch._mentorTurns === 2) {
            var mField = (mentor.intelligence || 50) > (mentor.valor || 50) ? '学问' : '武艺';
            CharacterGrowthSystem.recordExperience(ch.name, '师承', '从' + mentor.name + '处研习' + mField + '，初窥门径');
          }
          // 拜师两年——登堂入室
          else if (ch._mentorTurns === 8) {
            CharacterGrowthSystem.recordExperience(ch.name, '师承', '随' + mentor.name + '学艺已久，渐有所成');
          }
        } else {
          NpcMemorySystem.remember(ch.name, '恩师' + ch._mentorId + '已逝', '忧', 9, ch._mentorId);
          CharacterGrowthSystem.recordExperience(ch.name, '丧师', '恩师' + ch._mentorId + '去世，从此独行');
          ch._mentorId = null;
          ch._mentorTurns = 0;
        }
      }

      // 人生阶段转变——只在关键年龄记录
      if (ch.age) {
        if (ch.age === 20 && ch._lastAgeEvent !== 20) { ch._lastAgeEvent = 20; CharacterGrowthSystem.recordExperience(ch.name, '弱冠', '年满二十，束发加冠'); }
        else if (ch.age === 30 && ch._lastAgeEvent !== 30) { ch._lastAgeEvent = 30; CharacterGrowthSystem.recordExperience(ch.name, '而立', '三十而立，当有作为'); }
        else if (ch.age === 40 && ch._lastAgeEvent !== 40) { ch._lastAgeEvent = 40; CharacterGrowthSystem.recordExperience(ch.name, '不惑', '四十不惑，世事洞明'); }
        else if (ch.age === 50 && ch._lastAgeEvent !== 50) { ch._lastAgeEvent = 50; CharacterGrowthSystem.recordExperience(ch.name, '知命', '五十知天命，从心所欲'); }
        else if (ch.age === 60 && ch._lastAgeEvent !== 60) { ch._lastAgeEvent = 60; CharacterGrowthSystem.recordExperience(ch.name, '花甲', '年届花甲，阅尽沧桑'); }
        else if (ch.age === 70 && ch._lastAgeEvent !== 70) { ch._lastAgeEvent = 70; CharacterGrowthSystem.recordExperience(ch.name, '古稀', '古来稀有之年，力不从心'); if (ch.valor && ch.valor > 30) ch.valor -= 2; }
      }

      // 长期闲置的有野心者——不安与筹谋
      if (!office && (ch.ambition || 50) > 70 && GM.turn % 6 === 0) {
        NpcMemorySystem.remember(ch.name, '空有抱负却无施展之地', '忧', 5);
      }

      // 压力——不是每回合记录，只在首次进入高压和崩溃临界时
      if (ch.stress) {
        if (ch.stress > 60 && !ch._stressRecorded60) {
          ch._stressRecorded60 = true;
          CharacterGrowthSystem.recordExperience(ch.name, '磨难', '身心俱疲，夜不能寐');
          NpcMemorySystem.remember(ch.name, '压力山大，濒临极限', '惧', 6);
        } else if (ch.stress <= 40) {
          ch._stressRecorded60 = false; // 压力缓解后重置标记
        }
      }
    });
  },

  /**
   * 设置师徒关系
   */
  setMentor: function(studentName, mentorName) {
    var student = GM.chars ? GM.chars.find(function(c) { return c.name === studentName; }) : null;
    var mentor = GM.chars ? GM.chars.find(function(c) { return c.name === mentorName; }) : null;
    if (!student || !mentor) { toast('角色不存在'); return; }
    if (student.alive === false || mentor.alive === false) { toast('角色已故'); return; }
    student._mentorId = mentorName;
    NpcMemorySystem.remember(studentName, '拜' + mentorName + '为师，虚心求教', '敬', 8, mentorName);
    NpcMemorySystem.remember(mentorName, '收' + studentName + '为徒，悉心教导', '喜', 6, studentName);
    if (typeof AffinityMap !== 'undefined') AffinityMap.add(studentName, mentorName, 10, '师徒之谊');
    addEB('师徒', studentName + '拜' + mentorName + '为师');
    toast(studentName + '拜' + mentorName + '为师');
  },

  /**
   * 玩家培养角色——记录培养经历，AI在推演中体现效果
   */
  playerTrain: function(charName, trainingType) {
    var labels = {
      military_drill: '操练武艺，亲授兵法',
      book_study: '赐下珍本典籍研读',
      governance_practice: '派往地方历练政务',
      mentorship: '御前亲自教诲治国之道'
    };
    var desc = labels[trainingType];
    if (!desc) return;
    CharacterGrowthSystem.recordExperience(charName, '帝师', desc);
    NpcMemorySystem.remember(charName, '蒙圣上栽培——' + desc, '敬', 8, (P.playerInfo && P.playerInfo.characterName) || '陛下');
    var ch = GM.chars ? _tmMemoryFindChar(charName) : null;
    if (ch) {
      if (typeof adjustCharacterLoyalty === 'function') {
        adjustCharacterLoyalty(ch, 3, '\u5E1D\u5E08\u683D\u57F9\uFF1A' + desc, { source:'character-growth-training' });
      } else {
        var oldTrainL = (typeof ch.loyalty === 'number' && isFinite(ch.loyalty)) ? ch.loyalty : 50;
        ch.loyalty = Math.min(100, oldTrainL + 3);
      }
      if (typeof AffinityMap !== 'undefined') AffinityMap.add(charName, (P.playerInfo && P.playerInfo.characterName) || '玩家', 6, '受帝王栽培');
    }
    toast(charName + '感恩涕零，誓以死报');
  },

  /** 获取角色历练上下文（供AI推演参考，让AI自行判断成长结果） */
  getGrowthContext: function() {
    if (!GM.chars) return '';
    var withExp = GM.chars.filter(function(c) {
      return c.alive !== false && c._lifeExp && c._lifeExp.length >= 2;
    });
    if (withExp.length === 0) return '';
    // 只展示最有故事的角色
    withExp.sort(function(a, b) { return (b._lifeExp ? b._lifeExp.length : 0) - (a._lifeExp ? a._lifeExp.length : 0); });
    var ctx = '【角色历练】\n';
    withExp.slice(0, 6).forEach(function(c) {
      var recent = c._lifeExp.slice(-3);
      var parts = [];
      if (c.age) parts.push(c.age + '岁');
      if (c._mentorId) parts.push('师从' + c._mentorId);
      // 任职年限
      if (c._tenure) {
        var longestPost = '', longestYears = 0;
        for (var pk in c._tenure) { if (c._tenure[pk] > longestYears) { longestYears = c._tenure[pk]; longestPost = pk; } }
        if (longestYears >= 4) parts.push('任' + longestPost + Math.floor(longestYears / 4) + '年');
      }
      var expDesc = recent.map(function(e) { return e.desc; }).join('；');
      ctx += '  ' + c.name + (parts.length ? '(' + parts.join('，') + ')' : '') + '：' + expDesc + '\n';
    });
    ctx += '  ※ 请在char_updates中自然体现经历对角色的影响（如久经战阵→武力渐长，治理有方→政声鹊起，年迈体衰→力不从心）。\n';
    return ctx;
  }
};

/**
 * 性格演变——重大经历可能改变角色性格特质
 * 每年检查一次，根据累积的记忆情绪判断是否触发性格转变
 */
function checkPersonalityEvolution() {
  if (!GM.chars || !P.traitDefinitions) return;
  GM.chars.forEach(function(ch) {
    if (ch.alive === false || !ch._memory || ch._memory.length < 5) return;
    if (!ch.traitIds) ch.traitIds = [];

    // 统计近期记忆的情绪比例
    var emoCount = {};
    ch._memory.forEach(function(m) { emoCount[m.emotion] = (emoCount[m.emotion] || 0) + 1; });
    var total = ch._memory.length;

    // 大量怒/恨记忆 → 可能变得"复仇"或"暴怒"
    if ((emoCount['怒'] || 0) + (emoCount['恨'] || 0) > total * 0.5) {
      if (ch.traitIds.indexOf('vengeful') < 0 && ch.traitIds.indexOf('wrathful') < 0) {
        var newTrait = (emoCount['恨'] || 0) > (emoCount['怒'] || 0) ? 'vengeful' : 'wrathful';
        var def = P.traitDefinitions.find(function(t) { return t.id === newTrait; });
        if (def && (!def.opposite || ch.traitIds.indexOf(def.opposite) < 0)) {
          ch.traitIds.push(newTrait);
          if (ch.traitIds.length > 5) ch.traitIds = ch.traitIds.slice(-5);
          NpcMemorySystem.remember(ch.name, '经历了太多不公，性情大变', '怒', 9);
          addEB('性格', ch.name + '因累积怨恨，性情变得' + def.name);
          if (typeof recordCharacterArc === 'function') recordCharacterArc(ch.name, 'achievement', '性格转变——' + def.name);
        }
      }
    }
    // 大量喜/敬记忆 → 可能变得"宽容"或"勤勉"
    else if ((emoCount['喜'] || 0) + (emoCount['敬'] || 0) > total * 0.6) {
      if (ch.traitIds.indexOf('forgiving') < 0 && ch.traitIds.indexOf('diligent') < 0) {
        var posTrait = (emoCount['敬'] || 0) > (emoCount['喜'] || 0) ? 'diligent' : 'forgiving';
        var pDef = P.traitDefinitions.find(function(t) { return t.id === posTrait; });
        if (pDef && (!pDef.opposite || ch.traitIds.indexOf(pDef.opposite) < 0)) {
          ch.traitIds.push(posTrait);
          if (ch.traitIds.length > 5) ch.traitIds = ch.traitIds.slice(-5);
          NpcMemorySystem.remember(ch.name, '心境有所转变，愈发' + pDef.name, '喜', 7);
          addEB('性格', ch.name + '心境转变，变得' + pDef.name);
        }
      }
    }
    // 大量忧/惧记忆 → 可能变得"谨慎"
    else if ((emoCount['忧'] || 0) + (emoCount['惧'] || 0) > total * 0.5) {
      if (ch.traitIds.indexOf('cautious') < 0) {
        var cDef = P.traitDefinitions.find(function(t) { return t.id === 'cautious'; });
        if (cDef && (!cDef.opposite || ch.traitIds.indexOf(cDef.opposite) < 0)) {
          ch.traitIds.push('cautious');
          if (ch.traitIds.length > 5) ch.traitIds = ch.traitIds.slice(-5);
          NpcMemorySystem.remember(ch.name, '经历太多风波，行事愈加谨慎', '忧', 6);
          addEB('性格', ch.name + '变得谨小慎微');
        }
      }
    }
  });
}
function abolishInstitutionExtended(instId, reason) {
  var _tmMechanicsGlobal = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
  var G = _tmMechanicsGlobal.GM;
  if (!G || !Array.isArray(G.dynamicInstitutions)) return;
  var inst = G.dynamicInstitutions.find(function(i) { return i.id === instId; });
  if (!inst) return { ok: false, reason: '未知机构' };
  inst.stage = 'abolished';
  inst.abolishedTurn = G.turn || 0;
  inst.abolishReason = reason || '裁撤';
  if (G.guoku && inst.annualBudget) {
    G.guoku.money = (G.guoku.money || 0) + Math.floor(inst.annualBudget * 0.5);
  }
  if (inst.headOfficial) {
    var head = (G.chars || []).find(function(c) { return c.name === inst.headOfficial; });
    if (head) {
      if (typeof _tmMechanicsGlobal.adjustCharacterLoyalty === 'function') {
        _tmMechanicsGlobal.adjustCharacterLoyalty(head, -10, inst.name + '\u88AB\u88C1\u64A4' + (reason ? '\uFF1A' + reason : ''), { source:'institution-abolished' });
      } else {
        var oldHeadL = (typeof head.loyalty === 'number' && isFinite(head.loyalty)) ? head.loyalty : 50;
        head.loyalty = Math.max(0, oldHeadL - 10);
      }
      head.fame = Math.max(-100, (head.fame || 0) - 5);
    }
  }
  if (_tmMechanicsGlobal.addEB) _tmMechanicsGlobal.addEB('裁撤', inst.name + ' 废弛：' + reason);
  if (typeof _tmMechanicsGlobal.EventBus !== 'undefined') {
    _tmMechanicsGlobal.EventBus.emit('institution.abolished', { inst: inst });
  }
  return { ok: true, inst: inst };
}

function evaluateReformFeasibility(reform) {
  var _tmMechanicsGlobal = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
  var G = _tmMechanicsGlobal.GM;
  var hq = G.huangquan && G.huangquan.index || 55;
  var hw = G.huangwei && G.huangwei.index || 50;
  var mx = G.minxin && G.minxin.trueIndex || 60;
  var requirements = {
    adjustment:    { hq: 30, hw: 40, mx: 35 },
    systematic:    { hq: 50, hw: 55, mx: 45 },
    structural:    { hq: 65, hw: 60, mx: 50 },
    revolutionary: { hq: 80, hw: 70, mx: 55 }
  };
  var scale = reform.scale || 'systematic';
  var req = requirements[scale];
  var failReasons = [];
  if (hq < req.hq) failReasons.push('皇权不足：' + hq + '/' + req.hq);
  if (hw < req.hw) failReasons.push('皇威不足：' + hw + '/' + req.hw);
  if (mx < req.mx) failReasons.push('民心不稳：' + mx + '/' + req.mx);
  var successRate = 0.5;
  successRate += (hq - req.hq) / 200;
  successRate += (hw - req.hw) / 200;
  successRate += (mx - req.mx) / 300;
  if (G.partyStrife > 60) successRate -= (G.partyStrife - 60) / 200;
  successRate = Math.max(0.05, Math.min(0.95, successRate));
  return {
    feasible: failReasons.length === 0,
    failReasons: failReasons,
    successRate: successRate,
    riskLevel: failReasons.length === 0 ? 'low' : failReasons.length === 1 ? 'medium' : 'high'
  };
}

var _tmMechanicsGlobal = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
_tmMechanicsGlobal.MechanicsCore = _tmMechanicsGlobal.MechanicsCore || {};
_tmMechanicsGlobal.MechanicsCore.abolishInstitutionExtended = abolishInstitutionExtended;
_tmMechanicsGlobal.MechanicsCore.evaluateReformFeasibility = evaluateReformFeasibility;
_tmMechanicsGlobal.MechanicsCore.VERSION = 1;
if (typeof _tmMechanicsGlobal.abolishInstitutionExtended === 'undefined') {
  _tmMechanicsGlobal.abolishInstitutionExtended = abolishInstitutionExtended;
}
if (typeof _tmMechanicsGlobal.evaluateReformFeasibility === 'undefined') {
  _tmMechanicsGlobal.evaluateReformFeasibility = evaluateReformFeasibility;
}

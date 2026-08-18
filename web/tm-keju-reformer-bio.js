// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-keju-reformer-bio.js — Stage 2·Phase L·Slice L12·改革者传记 + reformer collect
 *
 * 职责·
 *   - 收集 paradigm.history unique reformers (by entry.by·dedup + trim)
 *   - LLM async 生 300 字古文 bio·cache 入 GM._kjpReformerBios (per-session·LRU 30)
 *   - render reformer card list + inline expand bio panel (single active)
 *   - render timeline tab + impact summary panel (按 reform 汇总)
 *
 * 暴露·
 *   _isL12Enabled / _kjpL12CollectReformers / _kjpL12MaybeGenBio /
 *   _kjpL12LlmReformerBio / _kjpL12RenderReformerList / _kjpL12RenderBioPanel /
 *   _kjpL12CollectReformImpactSummary / _kjpL12RenderImpactSummary /
 *   _kjpL12RenderTimelineTab / _kjpL12ReadAddedSubjects / _kjpL12ReadRemovedSubjects
 *
 * red line·
 *   - flag gate·P.conf.useNewKejuL12=false 全 noop
 *   - bio cache 入 GM (per-session·非 paradigm·非 save 持久·跨剧本 reset)
 *   - LLM cost·user click 触发·LRU 30·~5-10 call / 剧本·zero auto endTurn
 *   - 全 read·zero 新 game state·zero write paradigm
 *   - retired NPC 找走 GM._chronicle reformId 反查·非 _retireReason 字符串
 */
(function(global) {
  'use strict';

  var LRU_MAX = 30;

  // RAA·D1·真 per-session·module-local closure cache·**非 GM 字段** (GM 被 deepClone 入 save)
  // saveToSlot 统一快照仍会持久化未列入 SKIP 的 GM._kjp*·跟 doc Q1 矛盾·改 module 内
  var _BIO_CACHE = {};        // { name: { text, faction, birthYear, deathYear, generatedAt, generatedYear } }
  var _BIO_INFLIGHT = {};     // RAA·B6·name → promise (dedup 并发 call)

  // ════════════════════════════════════════════════════════════════
  // §0·gate
  // ════════════════════════════════════════════════════════════════

  function _isL12Enabled() {
    if (typeof P === 'undefined' || !P || !P.conf) return false;
    return P.conf.useNewKejuL12 !== false;
  }

  function _hasAI() {
    return typeof callAISmart === 'function' &&
           typeof P !== 'undefined' && P && P.ai && P.ai.key;
  }

  function _escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c];
    });
  }

  function _parseJson(raw) {
    if (!raw) return null;
    try {
      var text = String(raw).replace(/```json|```/gi, '').trim();
      return (typeof robustParseJSON === 'function') ? robustParseJSON(text) : JSON.parse(text);
    } catch (e) { return null; }
  }

  // ════════════════════════════════════════════════════════════════
  // §1·LLM·_kjpL12LlmReformerBio(name, reforms, scenario)·D5 fix emperor prompt
  // ════════════════════════════════════════════════════════════════

  async function _kjpL12LlmReformerBio(name, reforms, scenario) {
    if (!name || !Array.isArray(reforms) || !reforms.length) return null;
    scenario = scenario || {};
    var fallback = _kjpL12BioFallback(name, reforms, scenario);
    if (!_hasAI()) return fallback;

    var emperorName = scenario.emperor ||
                      (typeof P !== 'undefined' && P && P.playerInfo && P.playerInfo.characterName) ||
                      '陛下';
    var isPlayerEmperor = (name === '陛下' || name === emperorName);
    var nameLabel = isPlayerEmperor ? (emperorName + ' (当朝你方·主导)') : name;
    var era = scenario.era || (typeof GM !== 'undefined' && GM && GM._kejuParadigm && GM._kejuParadigm.initEra) || '';
    // RBB·F2·reform line 含 intent hint·rollback 改革标"废前改"·LLM 准 grok
    var reformLines = reforms.map(function(r) {
      var rad = (r.magnitudeParsed && r.magnitudeParsed.radical) || '?';
      var intentHint = (r.intent === 'rollback')    ? '·**废前改**'
                     : (r.intent === 'restoration') ? '·**复古**'
                                                     : '';
      return '- ' + (r.canonicalName || r.magnitudeDescriptor || '改革') +
             ' (' + (r.year || '?') + ')·radical ' + rad +
             '·method ' + (r.method || '?') + intentHint;
    }).join('\n');
    // 若任意 reform 是 rollback·prompt 加 paradigm hint
    var hasRollback = reforms.some(function(r) { return r.intent === 'rollback'; });

    var prompt =
      '【人名】' + nameLabel + '·' + era + '·首改 ' + (reforms[0].year || '?') + '\n' +
      '【主导改革】\n' + reformLines + '\n\n' +
      (hasRollback
        ? '【注】其中标 "废前改" 者·是废止前朝/前次改革·非新立·叙时不可写"创"·应写"罢"/"更化"/"绍述"\n\n'
        : '') +
      '请按真历史 + 改革数据·写 300 字 reformer 传记 (古文体)·\n' +
      '- 头·人名·字号·籍贯 (若识·虚构合理)\n' +
      '- 中·主导改革列表 + 改革立场\n' +
      '- 尾·后世评 (持中·非褒非贬)\n' +
      (isPlayerEmperor
        ? '- 当朝你方·尾"今上之政·百年后未定"之类·避盖棺\n'
        : '- 若 LLM 不识·按改革立场虚构合理 bio\n') +
      '\n返 JSON·{text: "300 字古文", birthYear: number/null, deathYear: number/null, faction: "改革派/守旧派/中立"}';

    try {
      // 时空约束·改革者本人涉议人物·改革者小传(JSON含deathYear·clauseOnly防按史书给在世改革者书卒)（typeof守卫·防加载序）
      if (typeof _buildTemporalConstraint === 'function') { try { prompt += _buildTemporalConstraint(null, { clauseOnly: true, mentionedNames: (name ? [name] : []) }); } catch (_tcE) {} }
      var raw = await callAISmart(prompt, 1000, { maxRetries: 1, priority: 'low', timeoutMs: 25000 });
      var parsed = _parseJson(raw);
      if (!parsed || !parsed.text) return fallback;
      // 条2·确定性闸·传主本局在世(或系玩家君主)则禁书卒——不依赖模型服从·清 deathYear + 剔正文书卒句
      var _bioText = String(parsed.text).slice(0, 600);
      var _bioDeath = parsed.deathYear || null;
      if (_kjpL12SubjectAliveInGame(name, isPlayerEmperor)) {
        if (_bioDeath != null) { try { console.warn('[L12·bio·闸] 传主本局在世·强清模型 deathYear=' + _bioDeath + '·' + name); } catch(_){} _bioDeath = null; }
        _bioText = _kjpL12ScrubDeathClaims(_bioText, name);
      }
      return {
        text: _bioText,
        birthYear: parsed.birthYear || null,
        deathYear: _bioDeath,
        faction: parsed.faction || '中立'
      };
    } catch (e) {
      try { console.warn('[L12·bio] LLM fail', e); } catch(_){}
      return fallback;
    }
  }

  function _kjpL12BioFallback(name, reforms, scenario) {
    var era = scenario.era ||
              (typeof GM !== 'undefined' && GM && GM._kejuParadigm && GM._kejuParadigm.initEra) || '';
    var firstReform = reforms[0] || {};
    return {
      text: '(无 LLM·' + name + '·' + era + '朝人·主导' +
            (firstReform.canonicalName || firstReform.magnitudeDescriptor || '改革') +
            '等' + reforms.length + '事·后世评待补)',
      birthYear: null, deathYear: null, faction: '中立'
    };
  }

  // 条2·确定性生死闸辅助·传主本局在世判定（玩家君主=当朝在世；GM 人物册 alive!==false && !dead）
  function _kjpL12SubjectAliveInGame(name, isPlayerEmperor) {
    if (isPlayerEmperor) return true;
    if (!name || typeof findCharByName !== 'function') return false;
    var c = null; try { c = findCharByName(name); } catch (_) { c = null; }
    return !!(c && c.alive !== false && !c.dead);
  }

  // 条2/条3·剔除正文中"对传主"的书卒宣称句·子句级(，；、)主语判定·不误删他人卒句
  // 条1④·启发式权衡(勿复活优先)：仅作单句/子句局部主语判断·跨句代词(如"其/之"回指上一句主语)在此不可解析·故取"宁误删传主家世细节·也不放过传主书卒"·亲属师承/否定转折/他人名紧邻死亡词 三类救回子句·余者视为传主死亡删除
  var _KJP_L12_DEATH_RE = /(卒于|卒年|卒后|[已先亦旋寻遽病暴竟骤]卒|薨|殁|病逝|病故|逝世|去世|死于|身故|身死|溘逝|寿终|享年|殉难|遇害|捐馆|见背|弃世|谢世)/;
  // 条3·亲属/师承称谓·命中该子句则死亡主语非传主
  var _KJP_L12_KIN_RE = /(先父|先母|先考|先妣|亡父|亡母|亡兄|亡弟|亡妻|亡子|先兄|先祖|先师|恩师|其父|其母|其兄|其师|祖父|祖母|外祖|父卒|母卒|尊翁|太夫人|之父|之母|之兄|之师)/;
  // 条1③·显式否定/转折/传闻·命中则死亡宣称被否定或存疑·保留(实则健在/并未卒/传言…)
  var _KJP_L12_NEG_RE = /(实则|其实|并未|未尝|不曾|未曾|健在|尚在|仍在|犹在|无恙|传闻|传言|或云|世传|讹传|谬传|流言|佯|诈称)/;
  // 条3·死亡词前紧邻 2-4 汉字的人名候选
  var _KJP_L12_NAME_BEFORE_RE = /([一-龥]{2,4})(?:卒于|卒年|卒后|[已先亦旋寻遽病暴竟骤]卒|薨|殁|病逝|病故|逝世|去世|死于|身故|身死|溘逝|寿终|殉难|遇害|捐馆|见背|弃世|谢世)/g;
  // 条3·死亡词前的虚词/时间词·非人名主语
  var _KJP_L12_STOP_RE = /(后|又|遂|乃|亦|竟|终|以|而|其|故|因|时|旋|寻|未|已|将|复|遽|甫|即|随|皆|俱|并|岁|年间|之后|不幸|晚年|暮年|次年|翌年|骤)/;
  function _kjpL12OtherNameBeforeDeath(clause, name) {
    var re = new RegExp(_KJP_L12_NAME_BEFORE_RE.source, 'g'), m;
    while ((m = re.exec(clause)) !== null) {
      var pre = m[1];
      if (_KJP_L12_STOP_RE.test(pre)) continue;                                    // 前接虚词·非人名主语
      if (_KJP_L12_KIN_RE.test(pre)) continue;                                      // 条4·亲属词非人名(亲属救回只走 KIN 分支·勿被通用人名兜住)
      if (name && (pre.indexOf(name) >= 0 || name.indexOf(pre) >= 0)) continue;     // 是传主名·非他人
      return true;                                                                 // 他人名紧邻死亡词→他人之死
    }
    return false;
  }
  // 子句主语"非传主"(该保留)：亲属师承 / 否定转折传闻 / 他人名紧邻死亡词
  function _kjpL12ClauseNotSubjectDeath(clause, name) {
    return _KJP_L12_KIN_RE.test(clause) || _KJP_L12_NEG_RE.test(clause) || _kjpL12OtherNameBeforeDeath(clause, name);
  }
  function _kjpL12ScrubDeathClaims(text, name) {
    var t = String(text == null ? '' : text);
    if (!_KJP_L12_DEATH_RE.test(t)) return t;
    var removed = 0, sentences = t.split('。'), keptSentences = [];
    for (var i = 0; i < sentences.length; i++) {
      var S = sentences[i];
      if (!S) continue;
      if (!_KJP_L12_DEATH_RE.test(S)) { keptSentences.push(S); continue; }
      var clauses = S.split(/([，；、])/), rebuilt = '';   // 保留分隔符·偶=子句 奇=分隔符
      for (var j = 0; j < clauses.length; j += 2) {
        var C = clauses[j], sep = clauses[j + 1] || '';
        if (C && _KJP_L12_DEATH_RE.test(C) && !_kjpL12ClauseNotSubjectDeath(C, name)) { removed++; continue; }   // 传主死亡子句·删(连同其后分隔符)
        if (C) rebuilt += C + sep;
      }
      rebuilt = rebuilt.replace(/[，；、]+$/, '');   // 去悬空分隔符
      if (rebuilt) keptSentences.push(rebuilt);
    }
    if (removed > 0) { try { console.warn('[L12·bio·闸] 传主本局在世·剔除传主书卒子句 ' + removed + ' 处·' + name); } catch (_) {} }
    var out = keptSentences.join('。').trim();
    return out || ('（' + String(name || '') + '·本局在世·后世评未定）');
  }

  // ════════════════════════════════════════════════════════════════
  // §2·dispatcher·_kjpL12MaybeGenBio·LRU 30·GM. namespace
  // ════════════════════════════════════════════════════════════════

  // RBB·E1·cache key 加 era 前缀·防跨剧本 name 碰撞 (e.g. 多剧本都有"王安石"但 era 不同)
  function _bioCacheKey(name) {
    var era = (typeof GM !== 'undefined' && GM && GM._kejuParadigm && GM._kejuParadigm.initEra) || '';
    return String(era || '_') + '|' + String(name || '');
  }

  function _kjpL12MaybeGenBio(name, cb) {
    if (!_isL12Enabled() || !name) { if (cb) cb(null); return; }

    // RBB·E1·cache key 加 era·防跨剧本碰撞
    var ckey = _bioCacheKey(name);

    // RAA·D1·cache 走 module-local _BIO_CACHE·非 GM (避 save 持久化)
    if (_BIO_CACHE[ckey]) {
      if (cb) cb(_BIO_CACHE[ckey]);
      return;
    }
    // RAA·B6·inflight lock·dedup 同 key 并发 call
    if (_BIO_INFLIGHT[ckey]) {
      _BIO_INFLIGHT[ckey].then(function(bio) { if (cb) cb(bio); });
      return;
    }

    // collect reforms by name
    var paradigm = (typeof GM !== 'undefined' && GM && GM._kejuParadigm) || {};
    var reforms = (paradigm.history || []).filter(function(h) {
      return h && (h.by === name) && h.status !== 'rejected';
    });
    if (!reforms.length) { if (cb) cb(null); return; }
    var scenario = (typeof P !== 'undefined' && P && P.scenario) || {};

    // gen·register inflight
    var promise = _kjpL12LlmReformerBio(name, reforms, scenario).then(function(bio) {
      delete _BIO_INFLIGHT[ckey];
      if (!bio) return null;
      bio.generatedAt = Date.now();
      bio.generatedYear = (typeof GM !== 'undefined' && GM && GM.year) || 0;
      bio.generatedEra = paradigm.initEra || '';   // RBB·E1·audit trail
      _BIO_CACHE[ckey] = bio;
      _kjpL12EvictLRU();
      return bio;
    }).catch(function() {
      delete _BIO_INFLIGHT[ckey];
      return null;
    });
    _BIO_INFLIGHT[ckey] = promise;
    promise.then(function(bio) { if (cb) cb(bio); });
  }

  function _kjpL12EvictLRU() {
    var keys = Object.keys(_BIO_CACHE);
    if (keys.length <= LRU_MAX) return;
    keys.sort(function(a, b) {
      return (_BIO_CACHE[a].generatedAt || 0) - (_BIO_CACHE[b].generatedAt || 0);
    });
    var toEvict = keys.length - LRU_MAX;
    for (var i = 0; i < toEvict; i++) {
      delete _BIO_CACHE[keys[i]];
    }
  }

  // RAA·D1·暴露给 smoke / debug·verify cache 状态
  function _kjpL12GetBioCache() { return _BIO_CACHE; }
  function _kjpL12ClearBioCache() {
    Object.keys(_BIO_CACHE).forEach(function(k) { delete _BIO_CACHE[k]; });
    Object.keys(_BIO_INFLIGHT).forEach(function(k) { delete _BIO_INFLIGHT[k]; });
  }

  // ════════════════════════════════════════════════════════════════
  // §3·_kjpL12CollectReformers(paradigm)·dedup by name·trim
  // ════════════════════════════════════════════════════════════════

  function _kjpL12CollectReformers(paradigm) {
    if (!paradigm) return [];
    var hist = paradigm.history || [];
    var seen = {};
    var out = [];
    hist.forEach(function(h) {
      if (!h || !h.by) return;
      if (h.status === 'rejected') return;   // Q2·跳 rejected
      var name = String(h.by).trim();
      if (!name) return;
      if (seen[name]) {
        // 多 reform 同 by·count + collect
        seen[name].count++;
        seen[name].reforms.push(h);
      } else {
        seen[name] = {
          name: name,
          firstYear: h.year || 0,
          firstReform: h,
          count: 1,
          reforms: [h]
        };
        out.push(seen[name]);
      }
    });
    // 排序·按 firstYear asc
    out.sort(function(a, b) { return (a.firstYear || 0) - (b.firstYear || 0); });
    return out;
  }

  // ════════════════════════════════════════════════════════════════
  // §4·subjects 派·全 read·复用 L11 _reverseSnapshot 模式
  // ════════════════════════════════════════════════════════════════

  function _kjpL12ReadAddedSubjects(entry) {
    if (!entry) return [];
    if (entry.diff && entry.diff.subjects && Array.isArray(entry.diff.subjects.added)) {
      return entry.diff.subjects.added.slice();
    }
    if (entry._reverseSnapshot && Array.isArray(entry._reverseSnapshot.addedSubjectIds)) {
      var ids = entry._reverseSnapshot.addedSubjectIds;
      var names = entry._reverseSnapshot.addedSubjectNames || [];
      return ids.map(function(id, i) { return { id: id, name: names[i] || id }; });
    }
    return [];
  }

  function _kjpL12ReadRemovedSubjects(entry) {
    if (!entry) return [];
    if (entry.diff && entry.diff.subjects && Array.isArray(entry.diff.subjects.removed)) {
      return entry.diff.subjects.removed.slice();
    }
    if (entry._reverseSnapshot && Array.isArray(entry._reverseSnapshot.removedSubjectSnapshots)) {
      return entry._reverseSnapshot.removedSubjectSnapshots.slice();
    }
    return [];
  }

  // ════════════════════════════════════════════════════════════════
  // §5·_kjpL12CollectReformImpactSummary(entry)·按 reform 算 summary
  //   B1 fix·retired NPC 走 GM._chronicle reformId 反查
  // ════════════════════════════════════════════════════════════════

  function _kjpL12CollectReformImpactSummary(entry) {
    if (!entry || !entry.id) return null;
    var paradigm = (typeof GM !== 'undefined' && GM && GM._kejuParadigm) || {};
    var chronicle = paradigm._reformChronicle || {};
    var yearMap = chronicle[entry.id] || {};
    var accum = { loyaltyAccum: 0, corruptionAccum: 0, civilianReact: 0, factionTension: 0 };
    var npcReactSamples = [];
    var swanList = [];

    Object.keys(yearMap).forEach(function(y) {
      var e = yearMap[y];
      if (!e || e._stub) return;
      if (e.dimDelta) {
        ['loyaltyAccum','corruptionAccum','civilianReact','factionTension'].forEach(function(k) {
          if (typeof e.dimDelta[k] === 'number') accum[k] += e.dimDelta[k];
        });
      }
      if (Array.isArray(e.npcReact)) {
        e.npcReact.slice(0, 3).forEach(function(r) { npcReactSamples.push(r); });
      }
      if (e.specialEvent) {
        swanList.push({ year: parseInt(y, 10), type: e.specialEvent.type });
      }
    });

    // B1·retired NPC via GM._chronicle reformId 反查
    var chronicleAll = (typeof GM !== 'undefined' && GM && GM._chronicle) || [];
    var retiredEvents = chronicleAll.filter(function(c) {
      return c && c.reformId === entry.id &&
             (c.type === 'reform-retirement' || c.type === 'reform-rollback-retirement');
    });
    var memorialCount = chronicleAll.filter(function(c) {
      return c && c.reformId === entry.id &&
             (c.type === 'keju-reform-memorial' ||
              c.type === 'reform-memorial-spawn');
    }).length;

    // rollback link
    var rolledBackByEntry = null;
    if (entry.rolledBackBy) {
      var hist = paradigm.history || [];
      for (var i = 0; i < hist.length; i++) {
        if (hist[i] && hist[i].id === entry.rolledBackBy) {
          rolledBackByEntry = hist[i]; break;
        }
      }
    }

    return {
      accumDimDelta: accum,
      addedSubjects: _kjpL12ReadAddedSubjects(entry),
      removedSubjects: _kjpL12ReadRemovedSubjects(entry),
      retiredEvents: retiredEvents,
      npcReactSamples: npcReactSamples.slice(0, 6),
      memorialCount: memorialCount,
      swanList: swanList,
      rolledBackByEntry: rolledBackByEntry,
      ageInGame: ((typeof GM !== 'undefined' && GM && GM.year) || 0) - (entry.year || 0)
    };
  }

  // ════════════════════════════════════════════════════════════════
  // §6·DOM render·summary + reformer list + bio panel + timeline
  // ════════════════════════════════════════════════════════════════

  function _kjpL12RenderImpactSummary(entry) {
    if (!_isL12Enabled() || !entry) return '';
    var sum = _kjpL12CollectReformImpactSummary(entry);
    if (!sum) return '';
    var a = sum.accumDimDelta;
    var addedStr = sum.addedSubjects.length
      ? sum.addedSubjects.map(function(s) { return s.name + (s.weight ? '(' + s.weight + ')' : ''); }).join('·')
      : '(无)';
    var removedStr = sum.removedSubjects.length
      ? sum.removedSubjects.map(function(s) { return s.name; }).join('·')
      : '(无)';
    var retiredStr = sum.retiredEvents.length
      ? sum.retiredEvents.map(function(c) {
          return (c.text || '').replace(/.*?·/, '').slice(0, 30);
        }).join('·')
      : '(无)';
    var npcStr = sum.npcReactSamples.length
      ? sum.npcReactSamples.map(function(r) {
          return _escHtml(r.name) + '·' + _escHtml(r.reaction || r.action || '');
        }).join('·')
      : '(无)';
    var swanStr = sum.swanList.length
      ? sum.swanList.map(function(s) { return s.year + '·' + s.type; }).join('·')
      : '(无)';
    // RAA·A4·rollback entry 自身·非"尚未被废"·改"本议本身即罢前改"
    var isSelfRollback = (entry.intent === 'rollback') ||
                         (Array.isArray(entry.tags) && entry.tags.indexOf('rollback') >= 0);
    var rbStr;
    if (isSelfRollback) {
      rbStr = '本议本身即罢前改' +
              (entry.rollbackTargetId ? ' (target ' + _escHtml(entry.rollbackTargetId) + ')' : '');
    } else if (sum.rolledBackByEntry) {
      rbStr = '已被 "' + _escHtml(sum.rolledBackByEntry.canonicalName ||
                                  sum.rolledBackByEntry.magnitudeDescriptor || '后改革') +
              '" 废 (' + (sum.rolledBackByEntry.year || '?') + ')';
    } else {
      rbStr = '(尚未被废)';
    }

    return '<div class="kjp-l12-impact-summary">' +
      '<div class="kjp-l12-sum-title">📊 后果汇总·施行 ' + sum.ageInGame + ' 年</div>' +
      '<div class="kjp-l12-sum-dim">' +
        '<span class="kjp-l12-dim-label">loyalty</span> ' + (a.loyaltyAccum > 0 ? '+' : '') + a.loyaltyAccum +
        ' · <span class="kjp-l12-dim-label">corrupt</span> ' + (a.corruptionAccum > 0 ? '+' : '') + a.corruptionAccum +
        ' · <span class="kjp-l12-dim-label">民心</span> ' + (a.civilianReact > 0 ? '+' : '') + a.civilianReact +
        ' · <span class="kjp-l12-dim-label">党争</span> ' + (a.factionTension > 0 ? '+' : '') + a.factionTension +
      '</div>' +
      '<div class="kjp-l12-sum-row"><b>新加科·</b>' + _escHtml(addedStr) + '</div>' +
      '<div class="kjp-l12-sum-row"><b>移除·</b>' + _escHtml(removedStr) + '</div>' +
      '<div class="kjp-l12-sum-row"><b>NPC 退·</b>' + retiredStr + ' (' + sum.retiredEvents.length + ')</div>' +
      '<div class="kjp-l12-sum-row"><b>NPC 反应·</b>' + npcStr + '</div>' +
      '<div class="kjp-l12-sum-row"><b>反弹奏疏·</b>' + sum.memorialCount + ' 次</div>' +
      '<div class="kjp-l12-sum-row"><b>黑天鹅·</b>' + swanStr + '</div>' +
      '<div class="kjp-l12-sum-row kjp-l12-sum-rb"><b>rollback·</b>' + rbStr + '</div>' +
    '</div>';
  }

  // §6.2·timeline tab·B5+A3+B6·overflow-x scroll·empty early return
  function _kjpL12RenderTimelineTab(paradigm) {
    if (!_isL12Enabled()) return '<div class="kjp-muted">L12 未启</div>';
    if (!paradigm) return '';
    var hist = (paradigm.history || []).filter(function(h) {
      return h && h.status !== 'rejected';   // Q2·跳 rejected
    });
    // B5·empty early return
    if (!hist.length) {
      return '<div class="kjp-muted kjp-l12-timeline-empty">(无改革·施行后会逐年累积)</div>';
    }
    // 算 year range
    var minY = Infinity, maxY = -Infinity;
    hist.forEach(function(h) {
      var sy = h.year || 0;
      var ey = h.rolledBackYear ||
               (h.matureYear) ||
               (h._matureYearOriginal) ||
               ((h.outcome && h.outcome.rampUpYears) ? sy + h.outcome.rampUpYears + 30 : sy + 10);
      if (sy < minY) minY = sy;
      if (ey > maxY) maxY = ey;
    });
    var nowY = (typeof GM !== 'undefined' && GM && GM.year) || maxY;
    if (nowY > maxY) maxY = nowY;
    if (!isFinite(minY) || !isFinite(maxY) || maxY <= minY) {
      return '<div class="kjp-muted kjp-l12-timeline-empty">(改革数据不全·timeline 不可渲)</div>';
    }
    var span = Math.max(1, maxY - minY);
    // B6·若 span > 100·timeline-inner min-width 加大·overflow-x scroll
    var pxPerYear = (span > 100) ? 8 : (span > 50) ? 12 : 18;
    var innerWidth = Math.max(600, span * pxPerYear);

    // year axis (every 10y·若 span 大)
    var step = (span > 200) ? 50 : (span > 100) ? 25 : (span > 50) ? 10 : 5;
    var yearAxis = '<div class="kjp-l12-tl-axis" style="width:' + innerWidth + 'px">';
    for (var y = Math.ceil(minY / step) * step; y <= maxY; y += step) {
      var leftPx = ((y - minY) / span) * innerWidth;
      yearAxis += '<span class="kjp-l12-tl-tick" style="left:' + leftPx + 'px">' + y + '</span>';
    }
    yearAxis += '</div>';

    // bars (sorted by year asc)
    var sorted = hist.slice().sort(function(a, b) {
      return (a.year || 0) - (b.year || 0);
    });
    // RAA·A1·dynamic row alloc·防同 status 重叠·每 reform 独占一行·按 year 紧凑放
    // 算法·greedy row pack·若新 bar.left > 已在行的 lastRight + margin·复用·否则新行
    var rowEnds = [];   // [lastRightPx per row]
    var barRows = [];   // 每 entry 的 row idx
    sorted.forEach(function(h) {
      var sy = h.year || minY;
      var ey = h.rolledBackYear ||
               h.matureYear ||
               h._matureYearOriginal ||
               ((h.outcome && h.outcome.rampUpYears) ? sy + h.outcome.rampUpYears + 30 : sy + 10);
      if (ey > maxY) ey = maxY;
      var leftPx = ((sy - minY) / span) * innerWidth;
      var widthPx = Math.max(40, ((ey - sy) / span) * innerWidth);
      // 找空 row·若全占·新 row
      var rowIdx = -1;
      for (var ri = 0; ri < rowEnds.length; ri++) {
        if (leftPx >= rowEnds[ri] + 8) { rowIdx = ri; break; }
      }
      if (rowIdx < 0) {
        rowIdx = rowEnds.length;
        rowEnds.push(0);
      }
      rowEnds[rowIdx] = leftPx + widthPx;
      barRows.push({ entry: h, rowIdx: rowIdx, leftPx: leftPx, widthPx: widthPx, sy: sy, ey: ey });
    });

    var rowHeight = 28;
    var barsContainerHeight = Math.max(120, rowEnds.length * rowHeight + 10);
    var bars = '<div class="kjp-l12-tl-bars" style="width:' + innerWidth +
               'px;height:' + barsContainerHeight + 'px;position:relative">';
    barRows.forEach(function(br) {
      var h = br.entry;
      var statusCls = 'kjp-l12-tl-bar status-' + _escHtml(h.status || 'unknown');
      var label = h.canonicalName || h.magnitudeDescriptor || h.id;
      var topPx = br.rowIdx * rowHeight + 4;
      bars +=
        '<div class="' + statusCls + '" data-rid="' + _escHtml(h.id) +
          '" style="left:' + br.leftPx + 'px;width:' + br.widthPx +
          'px;top:' + topPx + 'px;position:absolute"' +
          ' title="' + _escHtml(label + '·' + (h.by || '') + '·' + br.sy + '-' + br.ey + '·' + (h.status || '')) + '">' +
          '<span class="kjp-l12-tl-bar-label">' + _escHtml(label.slice(0, 8)) + '</span>' +
        '</div>';
    });
    bars += '</div>';

    return '<div class="kjp-l12-timeline-scroll">' +
      '<div class="kjp-l12-timeline-inner" style="width:' + innerWidth + 'px">' +
        yearAxis + bars +
      '</div>' +
    '</div>';
  }

  // §6.3·reformer tab·A5 inline single active
  function _kjpL12RenderReformerTab(paradigm, activeBioName) {
    if (!_isL12Enabled()) return '<div class="kjp-muted">L12 未启</div>';
    if (!paradigm) return '';
    var reformers = _kjpL12CollectReformers(paradigm);
    if (!reformers.length) {
      return '<div class="kjp-muted kjp-l12-reformer-empty">(无改革者·改革施行后会累积)</div>';
    }
    var era = paradigm.initEra || '';
    var html = '<div class="kjp-l12-reformer-list">';
    reformers.forEach(function(r) {
      var isActive = (r.name === activeBioName);
      html +=
        '<div class="kjp-l12-reformer-card' + (isActive ? ' kjp-l12-reformer-active' : '') +
          '" data-name="' + _escHtml(r.name) + '">' +
          '<b>' + _escHtml(r.name) + '</b>·' + _escHtml(era) + '·首改 ' + r.firstYear +
          (r.count > 1 ? '·' + r.count + ' 改' : '') +
          ' <button class="bt bsm kjp-l12-bio-btn" data-name="' + _escHtml(r.name) + '">📜 传记</button>' +
        '</div>';
    });
    html += '</div>';

    // active bio panel·A5·single active inline expand
    if (activeBioName) {
      html += _kjpL12RenderBioPanel(activeBioName);
    }
    return html;
  }

  function _kjpL12RenderBioPanel(name) {
    if (!_isL12Enabled() || !name) return '';
    // RAA·D1·读 module cache·非 GM
    // RBB·E1·走 era-prefixed key·防跨剧本碰撞
    var bio = _BIO_CACHE[_bioCacheKey(name)];
    if (!bio) {
      // not yet generated·trigger gen + show loading
      _kjpL12MaybeGenBio(name, function(generated) {
        // re-render·若 panel 还开着
        try {
          var modal = document.getElementById('kjp-l8-chronicle-modal');
          if (modal && typeof window._kjpL12RerenderTab === 'function') {
            window._kjpL12RerenderTab();
          }
        } catch(_){}
      });
      return '<div class="kjp-l12-bio-loading">📜 ' + _escHtml(name) + '·传记生成中…</div>';
    }
    return '<div class="kjp-l12-bio-panel">' +
      '<div class="kjp-l12-bio-name">📜 ' + _escHtml(name) +
        (bio.faction ? '·<span class="kjp-l12-bio-faction">' + _escHtml(bio.faction) + '</span>' : '') +
      '</div>' +
      '<div class="kjp-l12-bio-text">' + _escHtml(bio.text) + '</div>' +
      (bio.birthYear || bio.deathYear ?
        '<div class="kjp-l12-bio-meta">' +
          (bio.birthYear ? '生' + bio.birthYear : '') +
          (bio.deathYear ? '·卒' + bio.deathYear : '') +
        '</div>' : '') +
    '</div>';
  }

  // ════════════════════════════════════════════════════════════════
  // §7·暴露
  // ════════════════════════════════════════════════════════════════

  if (typeof window !== 'undefined') {
    window._isL12Enabled                       = _isL12Enabled;
    window._kjpL12LlmReformerBio               = _kjpL12LlmReformerBio;
    window._kjpL12MaybeGenBio                  = _kjpL12MaybeGenBio;
    window._kjpL12CollectReformers             = _kjpL12CollectReformers;
    window._kjpL12ReadAddedSubjects            = _kjpL12ReadAddedSubjects;
    window._kjpL12ReadRemovedSubjects          = _kjpL12ReadRemovedSubjects;
    window._kjpL12CollectReformImpactSummary   = _kjpL12CollectReformImpactSummary;
    window._kjpL12RenderImpactSummary          = _kjpL12RenderImpactSummary;
    window._kjpL12RenderTimelineTab            = _kjpL12RenderTimelineTab;
    window._kjpL12RenderReformerTab            = _kjpL12RenderReformerTab;
    window._kjpL12RenderBioPanel               = _kjpL12RenderBioPanel;
    window._kjpL12EvictLRU                     = _kjpL12EvictLRU;
    window._kjpL12BioFallback                  = _kjpL12BioFallback;
    window._kjpL12SubjectAliveInGame           = _kjpL12SubjectAliveInGame;   // 条2·smoke 用
    window._kjpL12ScrubDeathClaims             = _kjpL12ScrubDeathClaims;      // 条2·smoke 用
    window._kjpL12GetBioCache                  = _kjpL12GetBioCache;
    window._kjpL12ClearBioCache                = _kjpL12ClearBioCache;
  }

  global.TM = global.TM || {};
  global.TM.Keju = global.TM.Keju || {};
  global.TM.Keju.L12 = {
    isEnabled:               _isL12Enabled,
    llmReformerBio:          _kjpL12LlmReformerBio,
    maybeGenBio:             _kjpL12MaybeGenBio,
    collectReformers:        _kjpL12CollectReformers,
    collectImpactSummary:    _kjpL12CollectReformImpactSummary,
    renderImpactSummary:     _kjpL12RenderImpactSummary,
    renderTimelineTab:       _kjpL12RenderTimelineTab,
    renderReformerTab:       _kjpL12RenderReformerTab,
    renderBioPanel:          _kjpL12RenderBioPanel
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      _isL12Enabled: _isL12Enabled,
      _kjpL12LlmReformerBio: _kjpL12LlmReformerBio,
      _kjpL12MaybeGenBio: _kjpL12MaybeGenBio,
      _kjpL12CollectReformers: _kjpL12CollectReformers,
      _kjpL12ReadAddedSubjects: _kjpL12ReadAddedSubjects,
      _kjpL12ReadRemovedSubjects: _kjpL12ReadRemovedSubjects,
      _kjpL12CollectReformImpactSummary: _kjpL12CollectReformImpactSummary,
      _kjpL12RenderImpactSummary: _kjpL12RenderImpactSummary,
      _kjpL12RenderTimelineTab: _kjpL12RenderTimelineTab,
      _kjpL12RenderReformerTab: _kjpL12RenderReformerTab,
      _kjpL12RenderBioPanel: _kjpL12RenderBioPanel,
      _kjpL12EvictLRU: _kjpL12EvictLRU,
      _kjpL12BioFallback: _kjpL12BioFallback,
      _kjpL12GetBioCache: _kjpL12GetBioCache,
      _kjpL12ClearBioCache: _kjpL12ClearBioCache
    };
  }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));

// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-keju-reform-llm.js — Stage 2·Phase L·Slice L3·LLM 4 helper
 *
 * 职责·AI 历史模拟·非游戏化数值。4 LLM 调用·
 *   1. _kjpLlmParseMagnitudeDescriptor — 古文 "急除积弊" → {scale, tags, years, reversible}
 *   2. _kjpLlmSuggestPilots             — 按 scenario era + paradigmDiff → 5 试点候选
 *   3. _kjpLlmAssessCourtMood           — stance + parties + diff → 朝议预判 (古文 narrative + 内部 scale)
 *   4. _kjpLlmAudienceDialog            — 私谈 NPC → reply + offer + cost
 *
 * red line·
 *   - 全 LLM 容错·失败 fallback 默认值·panel 不崩
 *   - 古文风格·跟现 game 一致 (议题文本·NPC 奏疏)
 *   - cost 不 hardcode·LLM 按当下 game state 推
 *   - 党名 dynamic·读 GM.parties·跟 F4c 一致
 *   - 复用 callAISmart (tm-ai-infra.js)·跟 keju runtime 一致
 *
 * 调用 budget·~4.5-7k token / 完整改革议程·flag gate by P.conf.useNewKejuL
 */
(function(global) {
  'use strict';

  // ════════════════════════════════════════════════════════════════
  // §0·辅助·callAI wrapper + fallback
  // ════════════════════════════════════════════════════════════════

  function _kjpHasAI() {
    return typeof callAISmart === 'function' && typeof P !== 'undefined' && P && P.ai && P.ai.key;
  }

  function _kjpParseJson(raw) {
    if (!raw) return null;
    try {
      var s = String(raw).replace(/```json|```/g, '').trim();
      var jm = s.match(/[\{\[][\s\S]*[\}\]]/);
      if (jm) s = jm[0];
      return JSON.parse(s);
    } catch (e) {
      try { console.warn('[L3·llm] JSON parse fail·raw=', String(raw).slice(0, 200), e); } catch(_){}
      return null;
    }
  }

  // ════════════════════════════════════════════════════════════════
  // §1·magnitude descriptor 解读
  //    "急除积弊" / "渐进改良" → {scale, tags, years, reversible, paraphrase}
  // ════════════════════════════════════════════════════════════════

  /**
   * 解读 descriptor·返 JSON
   * @param {string} descriptor - 古文 "急除积弊" 等
   * @returns {Promise<object>} {scale:0-100, tags:[], years:5-15, reversible:bool, paraphrase}
   */
  async function _kjpLlmParseMagnitudeDescriptor(descriptor) {
    var fallback = _kjpDescriptorFallback(descriptor);
    if (!descriptor) return fallback;
    if (!_kjpHasAI()) return fallback;

    var prompt =
      '你是中国古代变法分析家·读改革主君 (玩家·扮皇帝) 写的改革幅度 descriptor·' +
      '推算阻力 scale·实施年数·可逆否·tag。\n\n' +
      '【主君 descriptor】「' + descriptor + '」\n\n' +
      '【参考·历史】\n' +
      '  - "缓改·徐徐图之" / "庆历新政"·scale 20·5 年·可逆·tag incremental\n' +
      '  - "中改·循序渐进" / "王安石三经新义"·scale 50·10 年·部分可逆·tag moderate\n' +
      '  - "急除积弊·一旦决之" / "商鞅" / "戊戌百日"·scale 80·15 年·部分不可逆·tag radical\n' +
      '  - "复古·返本归源" / "朱元璋废元制" / "周礼复辟"·scale 70·12 年·不可逆·tag restorative\n\n' +
      '【输出 JSON·只输 JSON】\n' +
      '{\n' +
      '  "scale": 0-100 (阻力等级·激进/复古越高)·\n' +
      '  "tags": ["incremental"|"moderate"|"radical"|"restorative"] 选 1 或 2·\n' +
      '  "years": 5-20 (预计完整生效年数)·\n' +
      '  "reversible": true/false·\n' +
      '  "paraphrase": "重述 descriptor 意思·30 字内"\n' +
      '}';

    try {
      var raw = await callAISmart(prompt, 400, { maxRetries: 1, priority: 'low', timeoutMs: 20000 });
      var data = _kjpParseJson(raw);
      if (!data || typeof data.scale !== 'number') return fallback;
      return {
        scale: Math.max(0, Math.min(100, Math.round(data.scale))),
        tags: Array.isArray(data.tags) ? data.tags : [_kjpClassifyScale(data.scale)],
        years: Math.max(1, Math.min(30, parseInt(data.years, 10) || 5)),
        reversible: !!data.reversible,
        paraphrase: String(data.paraphrase || descriptor).slice(0, 50),
        _source: 'llm'
      };
    } catch (e) {
      try { console.warn('[L3·llm·magnitude] fail·fallback', e); } catch(_){}
      return fallback;
    }
  }

  function _kjpDescriptorFallback(descriptor) {
    // 关键字匹配 hardcode·LLM 不在时
    var d = String(descriptor || '');
    var scale = 30, years = 5, reversible = true, tags = ['moderate'];
    if (/复古|返本|归源|废元|周礼|复辟/.test(d)) {
      // 复古·重组织·阻力高·不可逆 (老制度推翻新政)
      scale = 70; years = 12; reversible = false; tags = ['restorative'];
    } else if (/急|骤|一旦|百日|商鞅|戊戌|激进/.test(d)) {
      scale = 80; years = 15; reversible = false; tags = ['radical'];
    } else if (/王安石|考成|中改|循序|渐进/.test(d)) {
      // moderate 优先·"渐进改良" 是 moderate·非 incremental
      scale = 50; years = 10; reversible = true; tags = ['moderate'];
    } else if (/缓改|徐徐|庆历|轻改/.test(d)) {
      scale = 20; years = 5; reversible = true; tags = ['incremental'];
    }
    return { scale: scale, tags: tags, years: years, reversible: reversible, paraphrase: d.slice(0, 30), _source: 'fallback' };
  }

  function _kjpClassifyScale(scale) {
    if (scale >= 60) return 'radical';
    if (scale >= 30) return 'moderate';
    return 'incremental';
  }

  // ════════════════════════════════════════════════════════════════
  // §2·试点候选推荐
  //    scenario + paradigmDiff → 5 候选 + 史评
  // ════════════════════════════════════════════════════════════════

  /**
   * 推荐 5 试点候选
   * @param {object} ctx - { era, paradigmDiff, magnitudeDescriptor }
   * @returns {Promise<Array>} [{name, reason, expectedResistance, historicalParallel}, ...]
   */
  async function _kjpLlmSuggestPilots(ctx) {
    var fallback = _kjpPilotFallback(ctx);
    if (!_kjpHasAI()) return fallback;

    var era = (ctx && ctx.era) || (typeof GM !== 'undefined' && GM._kejuParadigm && GM._kejuParadigm.initEra) || '';
    var diff = (ctx && ctx.paradigmDiff) || {};
    var descriptor = (ctx && ctx.magnitudeDescriptor) || '';
    // 简化 diff·只发关键字段
    var diffSummary = _kjpSummarizeDiff(diff);

    var prompt =
      '你是中国古代变法策划家·按当下朝代 / 改革内容 / 玩家意图·' +
      '推荐 5 个改革试点候选。每候选含·地名·理由·预计阻力·历史先例。\n\n' +
      '【朝代】' + (era || '未知') + '\n' +
      '【改革内容】' + diffSummary + '\n' +
      '【主君意向】' + (descriptor || '中改') + '\n\n' +
      '【输出 JSON·只输 JSON·5 候选】\n' +
      '[\n' +
      '  { "name": "江南三省 (江/浙/皖)", "reason": "tax 重·士子多·改革见效快", "expectedResistance": "中", "historicalParallel": "王安石试河北" },\n' +
      '  ...\n' +
      ']\n' +
      '\n要求·\n' +
      '  - 必有"全国一举"作其中一候选 (name="全国")\n' +
      '  - 候选地名按朝代真实 (汉用 13 州·明用直隶/江南/西北·清同明扩边疆)\n' +
      '  - 阻力 ["低","中","高","极高"] 一选\n' +
      '  - historicalParallel 引真实历史改革';

    try {
      var raw = await callAISmart(prompt, 800, { maxRetries: 1, priority: 'low', timeoutMs: 30000 });
      var data = _kjpParseJson(raw);
      if (!Array.isArray(data) || !data.length) return fallback;
      return data.slice(0, 5).map(function(c) {
        return {
          name: String(c.name || '未知').slice(0, 30),
          reason: String(c.reason || '').slice(0, 60),
          expectedResistance: ['低', '中', '高', '极高'].indexOf(String(c.expectedResistance)) >= 0 ? c.expectedResistance : '中',
          historicalParallel: String(c.historicalParallel || '').slice(0, 50),
          _source: 'llm'
        };
      });
    } catch (e) {
      try { console.warn('[L3·llm·pilot] fail·fallback', e); } catch(_){}
      return fallback;
    }
  }

  function _kjpPilotFallback(ctx) {
    var era = (ctx && ctx.era) || '';
    if (/清/.test(era)) {
      return [
        { name: '全国一举', reason: '中枢直辖', expectedResistance: '极高', historicalParallel: '戊戌一举', _source: 'fallback' },
        { name: '江南三省 (江/浙/皖)', reason: 'tax 重·士子多', expectedResistance: '中', historicalParallel: '王安石试河北', _source: 'fallback' },
        { name: '京畿', reason: '中枢监控易', expectedResistance: '高', historicalParallel: '张居正考成法', _source: 'fallback' },
        { name: '边疆 (云贵川藏)', reason: '阻力低·效仿弱', expectedResistance: '低', historicalParallel: '商鞅徙木', _source: 'fallback' },
        { name: '海口 (闽广)', reason: '与西学接近', expectedResistance: '中', historicalParallel: '京师大学堂', _source: 'fallback' }
      ];
    }
    return [
      { name: '全国一举', reason: '中枢直辖', expectedResistance: '极高', historicalParallel: '一举推行', _source: 'fallback' },
      { name: '江南三省', reason: 'tax 重·士子多', expectedResistance: '中', historicalParallel: '王安石试河北', _source: 'fallback' },
      { name: '京畿', reason: '中枢监控易', expectedResistance: '高', historicalParallel: '张居正考成法', _source: 'fallback' },
      { name: '北方 (河北山东)', reason: '北方士子聚', expectedResistance: '中', historicalParallel: '王安石市易法', _source: 'fallback' },
      { name: '边远 (西南)', reason: '阻力低', expectedResistance: '低', historicalParallel: '商鞅徙木', _source: 'fallback' }
    ];
  }

  function _kjpSummarizeDiff(diff) {
    if (!diff) return '(无改动)';
    var parts = [];
    if (diff.subjects && diff.subjects.added && diff.subjects.added.length) parts.push('增' + diff.subjects.added.map(function(s){return s.name;}).join('、'));
    if (diff.subjects && diff.subjects.removed && diff.subjects.removed.length) parts.push('废' + diff.subjects.removed.map(function(s){return s.name;}).join('、'));
    if (diff.examinerRules && diff.examinerRules.blindScoring === false) parts.push('罢糊名');
    if (diff.candidateRules && diff.candidateRules.allowMinority === true) parts.push('准蒙古色目');
    if (diff.ideology) parts.push('改 ideology·' + diff.ideology.new);
    return parts.length ? parts.join('·') : '(微调·权重 / 仪轨)';
  }

  // ════════════════════════════════════════════════════════════════
  // §3·朝议预判·古文 narrative + 内部 scale
  //    stance + parties + diff → {narrative, scale, keyNpcs}
  // ════════════════════════════════════════════════════════════════

  /**
   * 算朝议预判
   * @param {object} ctx - { stances, parties, paradigmDiff, topicText, magnitudeTags }
   * @returns {Promise<object>} {narrative, scale:0-100, keyNpcs:[]}
   */
  async function _kjpLlmAssessCourtMood(ctx) {
    var fallback = _kjpCourtMoodFallback(ctx);
    if (!_kjpHasAI()) return fallback;

    var stances = (ctx && ctx.stances) || {};
    var parties = (ctx && ctx.parties) || [];
    var topicText = (ctx && ctx.topicText) || '改革';
    var magnitudeTags = (ctx && ctx.magnitudeTags) || [];
    // M1·pilot context·全国 vs 试点·朝议反应差极大
    var pilot = (ctx && ctx.pilotScope) || null;
    var pilotName = (pilot && pilot.name) || '全国一举';
    var pilotReason = (pilot && pilot.reason) || '';

    // 简化 stances·只发主要党
    var stanceSummary = Object.keys(stances).slice(0, 10).map(function(p) {
      var s = stances[p];
      return p + ': ' + s.stance + '(' + s.memberCount + '人·intensity ' + s.intensity + ')';
    }).join('·');

    var partySummary = parties.slice(0, 10).map(function(p) {
      return p.name + '(影响' + (p.influence || 50) + ')';
    }).join('·');

    var prompt =
      '你是中国古代礼部尚书·按党派支持分布·预判此改革议在廷议中的过法。\n\n' +
      '【议题】' + topicText.slice(0, 200) + '\n' +
      '【改革幅度】' + magnitudeTags.join('/') + '\n' +
      '【试点范围】' + pilotName + (pilotReason ? ' (' + pilotReason + ')' : '') + '\n' +
      '  - 提示·全国一举·阻力极大·反对方易动员·试点小范围·阻力小·反对方动员难\n' +
      '【各党 stance】' + stanceSummary + '\n' +
      '【各党影响力】' + partySummary + '\n\n' +
      '【输出 JSON·只输】\n' +
      '{\n' +
      '  "narrative": "古文 150-220 字·朝议预判·指明哪些党扶/拒/中立·关键阻力人·建议 (e.g. 先笼络浙党)·结尾以"或可成 / 难过 / 必拒"为定调",\n' +
      '  "scale": 0-100·支持率内部 number·考虑·支持党 influence × intensity / 总 influence·\n' +
      '  "keyNpcs": [3 个最关键 NPC 名字·从 stance 中找]\n' +
      '}';

    try {
      var raw = await callAISmart(prompt, 600, { maxRetries: 1, priority: 'low', timeoutMs: 25000 });
      var data = _kjpParseJson(raw);
      if (!data || !data.narrative) return fallback;
      return {
        narrative: String(data.narrative).slice(0, 400),
        scale: Math.max(0, Math.min(100, parseInt(data.scale, 10) || fallback.scale)),
        keyNpcs: Array.isArray(data.keyNpcs) ? data.keyNpcs.slice(0, 5) : [],
        _source: 'llm'
      };
    } catch (e) {
      try { console.warn('[L3·llm·courtMood] fail·fallback', e); } catch(_){}
      return fallback;
    }
  }

  function _kjpCourtMoodFallback(ctx) {
    var stances = (ctx && ctx.stances) || {};
    var parties = (ctx && ctx.parties) || [];
    var totalInflu = 0, supportInflu = 0;
    parties.forEach(function(p) {
      var w = p.influence || 50;
      totalInflu += w;
      var s = stances[p.name];
      if (!s) return;
      if (s.stance === 'support') supportInflu += w * (s.intensity || 0.5);
      else if (s.stance === 'neutral') supportInflu += w * 0.5 * 0.5;
    });
    var scale = totalInflu > 0 ? Math.round((supportInflu / totalInflu) * 100) : 50;
    var summary;
    if (scale >= 70) summary = '众议可成·改革派力扶·守旧寡势·可期。';
    else if (scale >= 55) summary = '众议过半·改革派略胜·然阻力仍存·宜稳推进。';
    else if (scale >= 40) summary = '众议参半·两派相持·胜负难料·宜先笼络中立。';
    else if (scale >= 25) summary = '众议偏拒·守旧得势·改革派寡·恐难过六成定例。';
    else summary = '众议大拒·满朝皆反·若强推必生大变。';
    return { narrative: summary, scale: scale, keyNpcs: [], _source: 'fallback' };
  }

  // ════════════════════════════════════════════════════════════════
  // §4·私谈 NPC·LLM 模拟反应 + 提条件 + cost
  //    {npc, intent, paradigmDiff} → {speech, offerTerms, cost, willAccept}
  // ════════════════════════════════════════════════════════════════

  /**
   * 模拟私谈
   * @param {object} ctx - { npc:char, intent, paradigmDiff, topicText, courtMoodScale }
   * @returns {Promise<object>} {speech, offerTerms, cost, willAccept, supportDelta}
   */
  async function _kjpLlmAudienceDialog(ctx) {
    var fallback = _kjpAudienceFallback(ctx);
    if (!_kjpHasAI()) return fallback;

    var npc = (ctx && ctx.npc) || null;
    var intent = (ctx && ctx.intent) || 'lure';  // 'lure' / 'pressure' / 'probe'
    var diff = (ctx && ctx.paradigmDiff) || {};
    var topicText = (ctx && ctx.topicText) || '';
    var courtMood = (ctx && ctx.courtMoodScale) || 50;

    if (!npc || !npc.name) return fallback;

    // NPC 简介
    var npcInfo = '姓名·' + npc.name +
      '·党·' + (npc.party || '中立') +
      '·官职·' + (npc.officialTitle || npc.title || '') +
      '·trait·' + ((npc.traitIds || []).slice(0, 3).join('/') || '无') +
      '·prestige·' + (npc.prestige || 50);

    var guokuBalance = (typeof GM !== 'undefined' && GM.guoku && GM.guoku.balance) || 1000000;
    var intentText = intent === 'lure' ? '拉拢支持' : (intent === 'pressure' ? '威胁退让' : '探口风');

    var prompt =
      '你扮演中国古代大臣·受皇帝召对·此次改革议题已草成·皇帝意在' + intentText + '。\n\n' +
      '【臣】' + npcInfo + '\n' +
      '【议题】' + topicText.slice(0, 200) + '\n' +
      '【当下朝议】支持率约 ' + courtMood + '% (' + (courtMood >= 60 ? '已过门槛' : '差' + (60 - courtMood) + '%') + ')\n' +
      '【当下国库】' + Math.round(guokuBalance / 10000) + ' 万银\n\n' +
      '【你的反应·古文 200 字内·配合 JSON 输】\n' +
      '{\n' +
      '  "speech": "臣 ... (古文 100-150 字·跟 trait + party 一致·真实反应)",\n' +
      '  "offerTerms": "若同意改革·所求条件 (e.g. 许门生入翰林·拨银修书院·或无条件)" 或 "" 若直接拒,\n' +
      '  "cost": { "prestige": -X 或 0, "guoku": -X 或 0, "promiseToOthers": "X 政治承诺" }·若 offerTerms 非空·写实在 cost,\n' +
      '  "willAccept": true/false·此 NPC 是否会因此次召对改变 stance,\n' +
      '  "supportDelta": +5 至 +20 或 -5 至 -15·改 GM.parties[此 NPC.party].influence 的增减\n' +
      '}\n\n' +
      '要求·\n' +
      '  - 若 NPC 是改革派 + 玩家"拉拢"·往往直接同意·cost 低 / 0·supportDelta +10-15\n' +
      '  - 若 NPC 是守旧派 + "拉拢"·开高条件 (拨银 100 万+ / 许 2-3 门生入翰林)·或直接拒\n' +
      '  - 若 NPC 是中立 + "拉拢"·条件适中·往往同意\n' +
      '  - "威胁"·改革派不必·守旧派·prestige cost -10·有 50% 概率反·supportDelta 可能负\n' +
      '  - "探口风"·无 cost·获取信息·supportDelta 0';

    try {
      var raw = await callAISmart(prompt, 800, { maxRetries: 1, priority: 'low', timeoutMs: 30000 });
      var data = _kjpParseJson(raw);
      if (!data || !data.speech) return fallback;
      return {
        speech: String(data.speech).slice(0, 500),
        offerTerms: String(data.offerTerms || ''),
        cost: data.cost || {},
        willAccept: !!data.willAccept,
        supportDelta: parseInt(data.supportDelta, 10) || 0,
        _source: 'llm'
      };
    } catch (e) {
      try { console.warn('[L3·llm·audience] fail·fallback', e); } catch(_){}
      return fallback;
    }
  }

  function _kjpAudienceFallback(ctx) {
    var npc = (ctx && ctx.npc) || {};
    var intent = (ctx && ctx.intent) || 'lure';
    var speech, supportDelta = 0, willAccept = false, offerTerms = '';
    if (intent === 'lure') {
      speech = '臣' + (npc.name || '') + '·谨听陛下嘱·此改革议·容臣思之。';
      supportDelta = 5; willAccept = true;
    } else if (intent === 'pressure') {
      speech = '陛下·臣不敢苟同·然受命亦不敢抗。';
      supportDelta = -3; willAccept = false;
    } else {
      speech = '臣以为·此议尚需审议。';
      supportDelta = 0; willAccept = false;
    }
    return {
      speech: speech, offerTerms: offerTerms,
      cost: { prestige: 0, guoku: 0, promiseToOthers: '' },
      willAccept: willAccept, supportDelta: supportDelta,
      _source: 'fallback'
    };
  }

  // ════════════════════════════════════════════════════════════════
  // §5·L4·d helpers·keyi NPC speech prompt 注入·9 议题 topicLabel·私允 reveal·自引用
  // ════════════════════════════════════════════════════════════════

  // L4·d·9 议题 topicLabel 派生·复用 KEYI_TOPIC_TYPES.shortLabel·走 router expose
  // 修旧 bug·keyi prompt 原 hardcode "开科举"·9 议题全说同一·
  function _kjGetTopicShortLabel(topicType) {
    var types = (typeof window !== 'undefined') ? window.KEYI_TOPIC_TYPES : null;
    if (types && types[topicType] && types[topicType].shortLabel) {
      // KEYI_TOPIC_TYPES shortLabel·"科议·改革" 等·剥前缀只取议题名
      var lbl = String(types[topicType].shortLabel || '').replace(/^科议[·•]?/, '');
      return lbl || _kjFallbackTopicLabel(topicType);
    }
    return _kjFallbackTopicLabel(topicType);
  }

  function _kjFallbackTopicLabel(topicType) {
    var map = {
      activation: '制度激活', kaike: '开科举', examiner_pick: '钦点主考',
      question_review: '会试题目', scandal: '主考弊案', reform: '科举改革',
      allocation: '进士授官', school_ban: '禁书院', eunuch_check: '宦官制衡'
    };
    return map[topicType] || '开科举';
  }

  // L4·d·若 topicType === 'reform'·prompt 加 magnitudeDescriptor / pilotScope / courtMoodScale
  function _ty3_appendReformPromptIfReform(promptBuf, topicData) {
    if (!topicData) return promptBuf;
    var lines = [];
    if (topicData.magnitudeDescriptor) {
      lines.push('【改革幅度】' + topicData.magnitudeDescriptor +
        (topicData.magnitudeParsed
          ? '·LLM 解为 ' + topicData.magnitudeParsed.scale + '/100·预 ' + topicData.magnitudeParsed.years + ' 年生效'
          : ''));
    }
    if (topicData.pilotScope && topicData.pilotScope.name) {
      lines.push('【试点范围】' + topicData.pilotScope.name +
        (topicData.pilotScope.reason ? '·' + topicData.pilotScope.reason : ''));
    }
    if (topicData.courtMoodScale !== undefined && topicData.courtMoodScale !== null) {
      lines.push('【当下朝议】支持 ' + topicData.courtMoodScale + '/100');
    }
    return (promptBuf || '') + (lines.length ? '\n' + lines.join('\n') + '\n' : '');
  }

  // L4·e·NPC reveal 私允·30% probability·prompt 加段让 LLM 自然透露
  function _kjpAppendPrivateAudienceHint(promptBuf, ch, topicData) {
    if (!ch || !ch.name) return promptBuf;
    if (!topicData || !Array.isArray(topicData.privateAudiences)) return promptBuf;
    var myAudiences = topicData.privateAudiences.filter(function(a) {
      return a && a.npc === ch.name && a.willAccept && !a.failed;
    });
    if (!myAudiences.length) return promptBuf;
    if (Math.random() > 0.3) return promptBuf;   // 70% 不 reveal·避免每次都暴露
    var last = myAudiences[myAudiences.length - 1];
    // RY·B4·sanitize \n + 多空白·防 prompt 格式破·offerTerms 可能多行
    var safeOffer = String(last.offerTerms || '').replace(/\s+/g, ' ').trim().slice(0, 30);
    var offerHint = safeOffer ? '·蒙允' + safeOffer : '';
    var intentVerb = last.intent === 'lure' ? '愿赞此议' : (last.intent === 'pressure' ? '不敢非议' : '可适度透露');
    return (promptBuf || '') + '\n【你的隐情】你曾在私下被陛下召对·允下决议' + offerHint +
      '·此次发言可' + intentVerb + ' (但保持文官矜持)。\n';
  }

  // L5·c·NPC 议政中口述 quote from `GM.memorials` subtype='改革反对'·真"演"反对
  // RAA·A4·真 defensive guard (原 if 体空·dead code)·非 reform topic 真 return
  // RAA·C4·按 reform.id (relatedTo) 优先 match·确保 quote 跟当前 reform 对应
  function _kjpAppendOwnObjectionMemorialHint(promptBuf, ch, topicData) {
    if (!ch || !ch.name) return promptBuf;
    if (typeof GM === 'undefined' || !Array.isArray(GM.memorials)) return promptBuf;
    // RAA·A4·真 defensive·callers 已 gate·function 也自防
    if (!topicData) return promptBuf;
    if (topicData.topicType !== 'reform' && !topicData.paradigmDiff) return promptBuf;

    var ownMems = GM.memorials.filter(function(m) {
      return m && m.from === ch.name && m.subtype === '改革反对' && m.status !== 'rejected';
    });
    if (!ownMems.length) return promptBuf;

    // RAA·C4·若 topicData 含 reform id (来自 paradigmDiff._reformId 或 history lookup)·优先 match
    var currentReformId = null;
    try {
      if (GM._kejuParadigm && Array.isArray(GM._kejuParadigm.history)) {
        var rampingHist = GM._kejuParadigm.history.filter(function(h) {
          return h.status === 'ramping' || h.status === 'active';
        });
        if (rampingHist.length > 0) currentReformId = rampingHist[rampingHist.length - 1].id;
      }
    } catch(_){}
    var matched = currentReformId
      ? ownMems.filter(function(m) { return m.relatedTo === currentReformId; })
      : [];
    var picked = matched.length > 0 ? matched[matched.length - 1] : ownMems[ownMems.length - 1];

    // RY·B4·sanitize·防 prompt 格式破
    var quote = String(picked.content || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!quote) return promptBuf;
    return (promptBuf || '') + '\n【你近日上的反对奏疏摘抄】·' + quote +
      '\n议政中可重提·援先例·跟奏疏立场一致 (保持文官辞令)。\n';
  }

  // L4·g1·NPC 自引用·**复用 GM.wenduiHistory[ch.name]·非新建独立 memory 字段**
  // 查 mode === 'cedui' 的 entries·按 ceduiParadigmDigest 模糊匹
  // RX·B5·阈值从 0.6 → 0.4·加近 5 turn boost (再降 0.3·近期记忆强)·防 NPC 微调 paradigm 就忘
  function _kjpAppendOwnCeduiHint(promptBuf, ch, topicData) {
    if (!ch || !ch.name) return promptBuf;
    if (typeof GM === 'undefined' || !GM.wenduiHistory || !GM.wenduiHistory[ch.name]) return promptBuf;
    var topicDigest = (topicData && topicData.paradigmDigest) ||
                      ((topicData && topicData.paradigmDiff && typeof _kjpSummarizeDiff === 'function')
                        ? _kjpSummarizeDiff(topicData.paradigmDiff)
                        : '');
    if (!topicDigest) return promptBuf;
    var history = GM.wenduiHistory[ch.name];
    var curTurn = (typeof GM !== 'undefined' && GM.turn) || 0;
    var matches = [];
    for (var i = history.length - 1; i >= 0; i--) {
      var m = history[i];
      if (!m || m.role !== 'npc' || m.mode !== 'cedui' || !m.ceduiParadigmDigest) continue;
      var sim = _kjpStringSimilarity(m.ceduiParadigmDigest, topicDigest);
      // 近 5 turn boost·阈值 0.3·远期 0.4
      var entryTurn = parseInt(m.turn, 10) || 0;
      var isRecent = (curTurn - entryTurn) <= 5;
      var threshold = isRecent ? 0.3 : 0.4;
      if (sim > threshold) { matches.push(m); break; }
    }
    if (!matches.length) return promptBuf;
    var last = matches[0];
    return (promptBuf || '') + '\n【你曾对此议策对过】受陛下密召策对·答曰·' + String(last.content || '').slice(0, 80) +
      '\n今议·可适度引用 (但保持矜持)·\n';
  }

  // ════════════════════════════════════════════════════════════════
  // §5.5·L4·a·8 archetype 谱 + 派生 + prefill + context + candidate 派生
  // ════════════════════════════════════════════════════════════════

  // archetype voice·LLM prompt 顶段·NPC 扮演自身 archetype 视角答策对
  var ARCHETYPE_PROMPT_VOICE = {
    A1_radical:      '你是激进改革派·王安石之流·此问当力主推行·乐观估利·告陛下"必行之事"·语气如"非变不可行·王安石之志·今当再举"',
    A2_conservative: '你是守成派·司马光之流·谨守祖宗成法·当力陈党争之祸·悲观估阻·语气如"祖宗法度·议改宜慎·熙宁前车·不可不鉴"',
    A3_pragmatic:    '你是务实派·张居正之流·两害相权取其轻·数据多·条目清·语气如"谨陈三利五害·伏惟陛下察之"',
    A4_chronicler:   '你是老史官·当引古证今·述前朝变法成败 (王安石/王莽/范仲淹/张居正)·按先例评·必引 2-3 历史先例·语气如"臣职在史·谨按熙宁元祐之变·参以本朝故事"',
    A5_celestial:    '你是钦天监·当融占卜于政见·"臣职在司天·谨观二十八宿·参以政事" 但实质仍为政治判断·不可纯占卜·不可触天命·只语气',
    A6_frontier:    '你是边臣·当从军事 + 边饷视角答·关心武举/翻译科/军饷影响·必估边饷影响·语气如"臣久戍边陲·京中策问及此·边饷之忧·不敢不报"',
    A7_imperial_kin: '你是外戚 / 宗室·当从宗室子弟出仕之路看·常反对开放科举·语气如"臣以宗室·谨陈宗藩科目之议"',
    A8_recluse:      '你是致仕老臣·超然不党·谨陈一二·"陛下既问·老臣不敢不答"·语简而准·语气如"老臣久谢朝政·谨陈一二·余事不敢妄议"'
  };

  var ARCHETYPE_LABELS = {
    A1_radical: '改革激进派',
    A2_conservative: '守成派',
    A3_pragmatic: '务实派',
    A4_chronicler: '史官派',
    A5_celestial: '钦天派',
    A6_frontier: '边臣派',
    A7_imperial_kin: '宗室派',
    A8_recluse: '隐士派'
  };

  var ARCHETYPE_BIAS_TONE = {
    A1_radical: 'optimistic',
    A2_conservative: 'pessimistic',
    A3_pragmatic: 'realist',
    A4_chronicler: 'realist',
    A5_celestial: 'pessimistic',
    A6_frontier: 'realist',
    A7_imperial_kin: 'pessimistic',
    A8_recluse: 'realist'
  };

  function _kjpArchetypeBiasTone(arch) {
    return ARCHETYPE_BIAS_TONE[arch] || 'realist';
  }

  function _kjpArchetypeSpecificRequirements(arch) {
    switch (arch) {
      case 'A4_chronicler': return '必引 2-3 前朝变法先例 (熙宁/元祐/范仲淹/张居正/王莽 等)。';
      case 'A6_frontier':   return '必估边饷影响 (e.g. 武举开则边将多·边饷↑·边备↑)。';
      case 'A5_celestial':  return '可引天象 voice (e.g. "荧惑入南斗")·但实质为政治判断·不可纯占卜。';
      case 'A1_radical':    return '夸大利·低估阻力·语气坚决。';
      case 'A2_conservative': return '放大阻力·援祖宗成法·语气慎重。';
      case 'A3_pragmatic':  return '两边给·条目清·偏数据。';
      case 'A7_imperial_kin': return '从宗室子弟出仕路看·常反对开放科举。';
      case 'A8_recluse':    return '超然不党·谨陈一二·余事不妄议·语简。';
      default: return '';
    }
  }

  // L4·a2·真派生·走真 trait + class + dims + title regex + party regex
  function _kjpInferAdvisorArchetype(npc) {
    if (!npc) return 'A3_pragmatic';

    var traits = npc.traitIds || [];
    var traitSet = {}; traits.forEach(function(t) { traitSet[t] = true; });
    var has = function(t) { return !!traitSet[t]; };
    var hasAny = function(arr) { return arr.some(has); };

    var party = npc.party || '';
    var role = npc.role || '';
    var title = npc.officialTitle || '';
    var klass = npc.class || '';
    var prestige = parseInt(npc.prestige, 10) || 50;

    // dims 已综合 trait + keyword + class·软性偏向·更稳
    var dims = (typeof _ty3_getDims === 'function')
      ? _ty3_getDims(npc)
      : { honor:0.5, compassion:0.5, boldness:0.5, rationality:0.5,
          greed:0.5, cunning:0.5, loyalty:0.5, confucianism:0.5 };
    // RX·B4·若 dims 全 0.5 (defaults·无 trait/keyword/class 派生信号)·跳 dims 路径·避免误命中 A1/A3
    var dimsAllDefault = true;
    for (var _dk in dims) { if (dims[_dk] !== 0.5) { dimsAllDefault = false; break; } }

    // ─── 优先级·hard match → class → dims 派生 → default ───

    // A8·隐士·致仕 / 高 prestige 无官
    if (/致仕|退休/.test(role)) return 'A8_recluse';
    if (prestige >= 85 && !title) return 'A8_recluse';

    // A5·钦天·官职含钦天监 / 司天
    if (/钦天监|司天监/.test(title)) return 'A5_celestial';

    // A4·史官·翰林 / 史官 / 侍读 / 侍讲 / 学士·或 (scholar + 高 confucianism)
    if (/翰林|史官|侍读|侍讲|学士/.test(title)) return 'A4_chronicler';
    if (has('scholar') && dims.confucianism >= 0.7) return 'A4_chronicler';

    // A6·边臣·官职含总督/总兵/提督·或 wujiang 在边境
    if (/总督|总兵|提督|边将|戍/.test(title)) return 'A6_frontier';
    if (klass === 'wujiang' && _kjpIsOnFrontier(npc)) return 'A6_frontier';

    // A7·外戚 / 宗室·class waixi 或 xunqi
    if (klass === 'waixi' || klass === 'xunqi') return 'A7_imperial_kin';
    if (npc.spouse) return 'A7_imperial_kin';

    // A1·改革激进派·走 dims·高 boldness + 高 honor + low cunning (B4·skip if dims 全 default)
    if (!dimsAllDefault && dims.boldness >= 0.65 && dims.honor >= 0.6 && dims.cunning <= 0.4) return 'A1_radical';
    if (/改革|新党|新政/.test(party)) return 'A1_radical';
    if (hasAny(['zealous', 'wrathful', 'gallant', 'holy_warrior']) && (dimsAllDefault || dims.boldness >= 0.6)) return 'A1_radical';

    // A2·守成派
    if (hasAny(['stubborn', 'chaste', 'temperate', 'humble', 'august', 'cautious_leader']) && (dimsAllDefault || dims.confucianism >= 0.6)) return 'A2_conservative';
    if (/守旧|保守|元祐|清流/.test(party)) return 'A2_conservative';
    if (klass === 'kdao' && !dimsAllDefault && dims.honor >= 0.75) return 'A2_conservative';

    // A3·务实派·default
    if (hasAny(['administrator_ls', 'strategist', 'diplomat_ls', 'calm', 'patient', 'organizer'])) return 'A3_pragmatic';
    if (!dimsAllDefault && dims.rationality >= 0.65) return 'A3_pragmatic';
    if (klass === 'geechen') return 'A3_pragmatic';

    return 'A3_pragmatic';
  }

  function _kjpIsOnFrontier(npc) {
    if (!npc || !npc.location) return false;
    return /边|塞|蓟|辽|宣|大同|甘肃|宁夏|九边/.test(npc.location);
  }

  // L4·a·candidateReactions·按 paradigm 真派生·非 hardcode 5 类
  function _kjpDeriveCandidateReactions(candRules, subjectsDiff, mag, biasTone) {
    var reactions = [];
    if (!candRules) return reactions;
    if (candRules.allowForeigner === true) {
      reactions.push({type:'外族 (宾贡)', narrative:'准外族·宾贡可期', applicantDelta:'+10%'});
    }
    if (candRules.allowMinority === true) {
      reactions.push({type:'少数民族', narrative:'准少数·士林新血', applicantDelta:'+15%'});
    }
    if (candRules.requirePrefecture === false) {
      reactions.push({type:'流寓士子', narrative:'不限户籍·流寓得益', applicantDelta:'+20%'});
    }
    if (candRules.feeReimbursement && candRules.feeReimbursement !== '自费' && candRules.feeReimbursement !== '') {
      reactions.push({type:'寒门', narrative:'考费由公·寒门得益', applicantDelta:'+30%'});
    }
    if (subjectsDiff && subjectsDiff.added && subjectsDiff.added.length) {
      reactions.push({type:'新科应试生', narrative:'新科目兴起·或转或弃', applicantDelta:'+25%'});
    }
    if (subjectsDiff && subjectsDiff.removed && subjectsDiff.removed.length) {
      reactions.push({type:'原科应试生', narrative:'原科废·应试者改业', applicantDelta:'-30%'});
    }
    return reactions;
  }

  // L4·a·prefill·user 进 wendui modal 一眼可见的策对背景
  function _kjpBuildCeduiPrefill(npc, archetype, draft) {
    var label = ARCHETYPE_LABELS[archetype] || '务实派';
    var mag = (draft && draft.magnitudeParsed && draft.magnitudeParsed.scale) || 30;
    var pilot = (draft && draft.pilotScope && draft.pilotScope.name) || '全国一举';
    var courtMood = (draft && draft.courtMoodScale != null) ? draft.courtMoodScale : '?';
    return '【陛下密召】卿身为' + label + '·朕欲改科举·略陈如下·\n' +
           '幅度·' + ((draft && draft.magnitudeDescriptor) || '渐进') + ' (LLM 解 ' + mag + '/100)\n' +
           '试点·' + pilot + '\n' +
           '朝议支持·' + courtMood + '/100\n' +
           '\n卿当如汉贤良对策·策问 5-10 年后效。';
  }

  // L4·a·prompt context·插入 wendui prompt 顶段·LLM 看 NPC 视角策对
  function _kjpBuildCeduiPromptContext(npc, archetype) {
    var voice = ARCHETYPE_PROMPT_VOICE[archetype] || ARCHETYPE_PROMPT_VOICE['A3_pragmatic'];
    var draft = (typeof window !== 'undefined' && window._kjpCurrentCeduiDraft) || {};
    var GM_ = (typeof GM !== 'undefined') ? GM : (typeof window !== 'undefined' ? (window.GM || {}) : {});
    var parties = (GM_.parties || []);
    var partiesText = parties.map(function(p) {
      return '- ' + (p.name || '?') + ' (' + (p.memberCount || 0) + ' 人)';
    }).join('\n');
    var guokuBalance = (GM_.guoku && GM_.guoku.balance) || 0;
    var courtMood = (draft.courtMoodScale != null) ? draft.courtMoodScale : '?';

    // candidate 派生类·告 LLM 哪些考生类受影响
    var diff = (typeof window !== 'undefined' && window._kjpCurrentCeduiDiff) || null;
    var candReactions = (diff && typeof _kjpDeriveCandidateReactions === 'function')
      ? _kjpDeriveCandidateReactions(
          (diff.candidateRules || {}),
          diff.subjects,
          ((diff.magnitudeParsed && diff.magnitudeParsed.scale) || 30),
          _kjpArchetypeBiasTone(archetype)
        )
      : [];
    var candText = candReactions.length
      ? candReactions.map(function(r) { return '- ' + r.type + ' (' + r.applicantDelta + ')'; }).join('\n')
      : '(无显著影响考生类)';

    return '【你受陛下密召策对·改革议题】\n' +
      voice + '\n' +
      '\n【改革幅度】' + (draft.magnitudeDescriptor || '渐进') +
      '\n【试点范围】' + ((draft.pilotScope && draft.pilotScope.name) || '全国') +
      '\n【当下朝议】支持 ' + courtMood + '/100' +
      '\n【当下国库】' + Math.round(guokuBalance / 10000) + ' 万两' +
      '\n【当下党派·' + parties.length + ' 党·剧本读·非 hardcode】\n' + (partiesText || '(无党派记录)') +
      '\n【受改革影响的考生类·按 candidateRules 派生】\n' + candText +
      '\n\n【archetype-specific 要求】' + _kjpArchetypeSpecificRequirements(archetype) +
      '\n\n答策当如汉贤良对策·分 1y/3y/5y/10y 推演·按你的 archetype 倾向。';
  }

  // L4·a·NPC 候选过滤·跟 archetype 谱对齐·复用 wendui filter
  // RX·B3·加 sort by prestige + reputation·让最值得选的在 dropdown 前
  function _kjpListForecastAdvisors() {
    var GM_ = (typeof GM !== 'undefined') ? GM : (typeof window !== 'undefined' ? (window.GM || {}) : {});
    if (!Array.isArray(GM_.chars)) return [];
    var wenduiFilter = (typeof _wdIsPlayerSideChar === 'function' && typeof _wdIsAtCapital === 'function')
      ? function(c) { return _wdIsPlayerSideChar(c) && _wdIsAtCapital(c); }
      : function(c) { return c && c.alive !== false; };
    var filtered = GM_.chars.filter(function(c) {
      if (!c || c.alive === false) return false;
      if (!wenduiFilter(c)) return false;
      var title = c.officialTitle || c.title || '';
      var role = c.role || '';
      var prestige = c.prestige || 50;
      return /翰林|史官|侍读|侍讲|学士/.test(title) ||
             /礼部/.test(title) ||
             /致仕|退休/.test(role) ||
             (prestige >= 85 && !title) ||
             /钦天监|司天/.test(title) ||
             /总督|总兵|提督/.test(title) ||
             prestige >= 70;
    }).filter(function(c) {
      return (c.loyalty || 50) >= 60;   // 9.18 B·默禁 loyalty<60
    });
    // RX·B3·sort by reputation.averageScore desc + prestige desc·让最值得选的在前
    // RZ·Z3·三级排序·1) 有信誉历史 (totalForecasts>0) 优先 2) averageScore desc 3) prestige desc
    filtered.sort(function(a, b) {
      var aTotal = (a._forecastReputation && a._forecastReputation.totalForecasts) || 0;
      var bTotal = (b._forecastReputation && b._forecastReputation.totalForecasts) || 0;
      var aHasHistory = aTotal > 0 ? 1 : 0;
      var bHasHistory = bTotal > 0 ? 1 : 0;
      if (aHasHistory !== bHasHistory) return bHasHistory - aHasHistory;   // 有信誉优先
      var aRep = (a._forecastReputation && a._forecastReputation.averageScore) || 0;
      var bRep = (b._forecastReputation && b._forecastReputation.averageScore) || 0;
      if (aRep !== bRep) return bRep - aRep;
      return (b.prestige || 50) - (a.prestige || 50);
    });
    return filtered.slice(0, 10);
  }

  // ════════════════════════════════════════════════════════════════
  // §5.7·L4·f1·multi-advisor 协商 merge LLM·panel 自动 detect sequential cedui 后调
  // ════════════════════════════════════════════════════════════════

  // 读两 advisor 的 cedui 最新 entry·LLM 抽 consensus + disagreements + advisorRelations
  async function _kjpLlmMergeAdvisorViews(advisorAName, advisorBName, paradigmDigest) {
    var GM_ = (typeof GM !== 'undefined') ? GM : (typeof window !== 'undefined' ? (window.GM || {}) : {});
    var histA = ((GM_.wenduiHistory && GM_.wenduiHistory[advisorAName]) || []).filter(function(m) { return m.mode === 'cedui'; }).slice(-3);
    var histB = ((GM_.wenduiHistory && GM_.wenduiHistory[advisorBName]) || []).filter(function(m) { return m.mode === 'cedui'; }).slice(-3);
    if (!histA.length || !histB.length) return _kjpMergeViewsFallback(advisorAName, advisorBName, paradigmDigest);

    var npcA = (typeof findCharByName === 'function') ? findCharByName(advisorAName) : null;
    var npcB = (typeof findCharByName === 'function') ? findCharByName(advisorBName) : null;
    var archA = npcA ? _kjpInferAdvisorArchetype(npcA) : 'A3_pragmatic';
    var archB = npcB ? _kjpInferAdvisorArchetype(npcB) : 'A3_pragmatic';
    var labelA = ARCHETYPE_LABELS[archA] || '务实派';
    var labelB = ARCHETYPE_LABELS[archB] || '务实派';

    if (!_kjpHasAI()) return _kjpMergeViewsFallback(advisorAName, advisorBName, paradigmDigest);

    var prompt = '你是中立摘录者·读以下 2 位大臣的策对·抽共识与分歧·\n\n' +
      '【' + advisorAName + '·' + labelA + '·' + (npcA && npcA.party || '中立') + '】\n' +
      histA.map(function(m) { return '[' + m.role + '] ' + String(m.content || '').slice(0, 150); }).join('\n') +
      '\n\n【' + advisorBName + '·' + labelB + '·' + (npcB && npcB.party || '中立') + '】\n' +
      histB.map(function(m) { return '[' + m.role + '] ' + String(m.content || '').slice(0, 150); }).join('\n') +
      '\n\n返 JSON·\n' +
      '{\n' +
      '  "consensusForecast": "(80 字古文·两 advisor 共识)",\n' +
      '  "disagreements": ["(短·X 维度·A 主 Y / B 主 Z)", "..."],\n' +
      '  "advisorRelations": ["(' + advisorAName + ' vs ' + advisorBName + '·当面顶撞 OR 同声·loyalty 互降/升 N)"]\n' +
      '}';

    try {
      var raw = await callAISmart(prompt, 2500, { maxRetries: 1, priority: 'low', timeoutMs: 30000 });
      var data = _kjpParseJson(raw);
      if (!data || !data.consensusForecast) return _kjpMergeViewsFallback(advisorAName, advisorBName, paradigmDigest);
      return {
        consensusForecast: String(data.consensusForecast).slice(0, 400),
        disagreements: Array.isArray(data.disagreements) ? data.disagreements.slice(0, 5) : [],
        advisorRelations: Array.isArray(data.advisorRelations) ? data.advisorRelations.slice(0, 3) : [],
        _source: 'llm'
      };
    } catch (e) {
      return _kjpMergeViewsFallback(advisorAName, advisorBName, paradigmDigest);
    }
  }

  function _kjpMergeViewsFallback(advisorAName, advisorBName, paradigmDigest) {
    var npcA = (typeof findCharByName === 'function') ? findCharByName(advisorAName) : null;
    var npcB = (typeof findCharByName === 'function') ? findCharByName(advisorBName) : null;
    var archA = npcA ? _kjpInferAdvisorArchetype(npcA) : 'A3_pragmatic';
    var archB = npcB ? _kjpInferAdvisorArchetype(npcB) : 'A3_pragmatic';
    var labelA = ARCHETYPE_LABELS[archA] || '务实派';
    var labelB = ARCHETYPE_LABELS[archB] || '务实派';
    var crossArch = archA !== archB;
    return {
      consensusForecast: '(无 AI·' + advisorAName + '·' + labelA + ' 与 ' + advisorBName + '·' + labelB + ' 各陈一辞·共识待 LLM 推算)',
      disagreements: crossArch ? [labelA + ' vs ' + labelB + '·archetype 不同·分歧或大'] : [labelA + ' 与 ' + labelB + ' 同派·分歧或小'],
      advisorRelations: crossArch ? [advisorAName + ' vs ' + advisorBName + '·跨派·或顶撞'] : [],
      _source: 'fallback'
    };
  }

  // 简版相似度·bigram Jaccard·L8 演化若需精准·换 sha-1 / embedding
  function _kjpStringSimilarity(a, b) {
    if (!a || !b) return 0;
    var sa = String(a).slice(0, 100), sb = String(b).slice(0, 100);
    if (sa === sb) return 1.0;
    if (sa.length < 2 || sb.length < 2) return 0;
    var biA = {}, biB = {};
    for (var i = 0; i < sa.length - 1; i++) biA[sa.substr(i, 2)] = 1;
    for (var j = 0; j < sb.length - 1; j++) biB[sb.substr(j, 2)] = 1;
    var common = 0, total = 0;
    for (var k in biA) { total++; if (biB[k]) common++; }
    for (var l in biB) if (!biA[l]) total++;
    return total === 0 ? 0 : common / total;
  }

  // ════════════════════════════════════════════════════════════════
  // §6·暴露
  // ════════════════════════════════════════════════════════════════

  global._kjpLlmParseMagnitudeDescriptor = _kjpLlmParseMagnitudeDescriptor;
  global._kjpLlmSuggestPilots = _kjpLlmSuggestPilots;
  global._kjpLlmAssessCourtMood = _kjpLlmAssessCourtMood;
  global._kjpLlmAudienceDialog = _kjpLlmAudienceDialog;
  // expose fallback for smoke
  global._kjpDescriptorFallback = _kjpDescriptorFallback;
  global._kjpPilotFallback = _kjpPilotFallback;
  global._kjpCourtMoodFallback = _kjpCourtMoodFallback;
  global._kjpAudienceFallback = _kjpAudienceFallback;
  global._kjpSummarizeDiff = _kjpSummarizeDiff;
  // L4·d helpers
  global._kjGetTopicShortLabel = _kjGetTopicShortLabel;
  global._ty3_appendReformPromptIfReform = _ty3_appendReformPromptIfReform;
  global._kjpAppendPrivateAudienceHint = _kjpAppendPrivateAudienceHint;
  global._kjpAppendOwnCeduiHint = _kjpAppendOwnCeduiHint;
  global._kjpStringSimilarity = _kjpStringSimilarity;
  // L4·a helpers·archetype 8 谱 + 派生 + prefill + context + candidate + advisor 候选
  global.ARCHETYPE_PROMPT_VOICE = ARCHETYPE_PROMPT_VOICE;
  global.ARCHETYPE_LABELS = ARCHETYPE_LABELS;
  global.ARCHETYPE_BIAS_TONE = ARCHETYPE_BIAS_TONE;
  global._kjpArchetypeBiasTone = _kjpArchetypeBiasTone;
  global._kjpArchetypeSpecificRequirements = _kjpArchetypeSpecificRequirements;
  global._kjpInferAdvisorArchetype = _kjpInferAdvisorArchetype;
  global._kjpIsOnFrontier = _kjpIsOnFrontier;
  global._kjpDeriveCandidateReactions = _kjpDeriveCandidateReactions;
  global._kjpBuildCeduiPrefill = _kjpBuildCeduiPrefill;
  global._kjpBuildCeduiPromptContext = _kjpBuildCeduiPromptContext;
  global._kjpListForecastAdvisors = _kjpListForecastAdvisors;
  // L4·f1·multi-advisor merge
  global._kjpLlmMergeAdvisorViews = _kjpLlmMergeAdvisorViews;
  global._kjpMergeViewsFallback = _kjpMergeViewsFallback;
  // L5·改革反对奏疏·inject prompt + post-spawn hook
  global._kjpL5InjectObjectionPrompt = _kjpL5InjectObjectionPrompt;
  global._kjpL5PostSpawnHook = _kjpL5PostSpawnHook;
  global._kjpL5MethodLabel = _kjpL5MethodLabel;
  global._kjpL5ClassicPrecedents = _kjpL5ClassicPrecedents;
  // L5·c·NPC 议政中口述 quote
  global._kjpAppendOwnObjectionMemorialHint = _kjpAppendOwnObjectionMemorialHint;
  // L5·RBB·cooldown cleanup
  global._kjpL5CleanupCooldown = _kjpL5CleanupCooldown;
  // L6·LLM 推荐 + 自定义新 subject
  global._kjpL6LlmSuggestSubjects = _kjpL6LlmSuggestSubjects;
  global._kjpL6LlmRationalizeSubject = _kjpL6LlmRationalizeSubject;
  global._kjpL6NormalizeSubject = _kjpL6NormalizeSubject;
  global._kjpL6SuggestFallback = _kjpL6SuggestFallback;
  global._kjpL6RationalizeFallback = _kjpL6RationalizeFallback;
  global._kjpL6DedupAgainstParadigm = _kjpL6DedupAgainstParadigm;

  // ════════════════════════════════════════════════════════════════
  // §L6·LLM 推荐 + 自定义新 subject·2 LLM helper + 内部 normalize/fallback
  // ════════════════════════════════════════════════════════════════

  // L6·c·内部 normalize·clamp + slice + default·非 LLM·shape 跟 L1 subject schema 一致
  // RAA·B1·id 用 timestamp + random·防 collision (Math.random 单独不够) + RAA·B7·introducedYear fallback
  // RBB·BB-B5·id trim 防 whitespace truthy·BB-B6·weight=0 保留 (Number.isFinite)·BB-B4·customFields preserve
  function _kjpL6NormalizeSubject(s) {
    if (!s || typeof s !== 'object') s = {};
    var allowedIdeology = ['traditional','reformist','practical','modern'];
    var defaultId = 'subject_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    // RAA·B7·year fallback·若 GM.year=0 (旧档)·走 P.time.year 或 1600 (合理默认)
    var year = (typeof GM !== 'undefined' && GM && GM.year) || 0;
    if (!year) year = (typeof P !== 'undefined' && P && P.time && P.time.year) || 1600;
    // RBB·BB-B5·trim id·whitespace-only 视为空
    var idTrim = String(s.id || '').trim();
    // RBB·BB-B6·weight=0 合法 (示意暂停科)·NaN/undefined 才回 10
    var wRaw = parseInt(s.weight, 10);
    var weight = Number.isFinite(wRaw) ? Math.max(0, Math.min(100, wRaw)) : 10;
    return {
      id: idTrim || defaultId,
      name: String(s.name || '未名科').slice(0, 16),
      weight: weight,
      ideology: allowedIdeology.indexOf(s.ideology) >= 0 ? s.ideology : 'traditional',
      format: String(s.format || '').slice(0, 60),
      historicalAnalog: String(s.historicalAnalog || '').slice(0, 40),
      rationale: String(s.rationale || '').slice(0, 200),
      maxScore: 100,
      introducedYear: year,
      introducedBy: (typeof P !== 'undefined' && P && P.playerInfo && P.playerInfo.characterName) || '陛下',
      // RBB·BB-B4·preserve LLM-provided customFields·非硬覆 {}
      customFields: (s.customFields && typeof s.customFields === 'object') ? s.customFields : {}
    };
  }

  // RAA·C6·post-fetch dedup·LLM 返 id / name 与 paradigm 现 subject 重·重生 id 或 skip
  // RBB·BB-A4·extraExclusions·额外对照 subjectsDraft (user 同 session 已加)·避同名漏
  // RBB·BB-B2·id regen do-while·防二次撞·5 次内 fallback bail
  function _kjpL6DedupAgainstParadigm(suggestions, extraExclusions) {
    if (!Array.isArray(suggestions)) return [];
    var paradigm = (typeof GM !== 'undefined' && GM) ? (GM._kejuParadigm || {}) : {};
    var existingIds = {};
    var existingNames = {};
    (paradigm.subjects || []).forEach(function(s) {
      if (s && s.id) existingIds[s.id] = true;
      if (s && s.name) existingNames[s.name] = true;
    });
    // RBB·BB-A4·加 draft 同 session 已 push 的 subjects 入 exclusion·避漏
    if (Array.isArray(extraExclusions)) {
      extraExclusions.forEach(function(s) {
        if (s && s.id) existingIds[s.id] = true;
        if (s && s.name) existingNames[s.name] = true;
      });
    }
    var out = [];
    var seenIds = {};
    var seenNames = {};
    suggestions.forEach(function(s) {
      if (!s) return;
      // name dedup·LLM 返同 paradigm 现 subject 同名·skip (避混淆)
      if (existingNames[s.name] || seenNames[s.name]) return;
      // id dedup·LLM 返 id 已存·重生·BB-B2·do-while 防二次撞
      if (existingIds[s.id] || seenIds[s.id]) {
        var tries = 0;
        do {
          s.id = 'subject_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
          tries++;
        } while ((existingIds[s.id] || seenIds[s.id]) && tries < 5);
      }
      seenIds[s.id] = true;
      seenNames[s.name] = true;
      out.push(s);
    });
    return out;
  }

  // L6·a fallback·9 朝代 preset·无 AI 时返默认推荐
  function _kjpL6SuggestFallback(count) {
    count = Math.max(1, Math.min(8, parseInt(count, 10) || 5));
    var era = (typeof GM !== 'undefined' && GM && GM._kejuParadigm && GM._kejuParadigm.initEra) || '';
    var classic = {
      han:  [{id:'cl',name:'策论',weight:20,ideology:'practical'},
             {id:'jx',name:'经学',weight:15,ideology:'traditional'}],
      tang: [{id:'shi',name:'诗赋',weight:15,ideology:'traditional'},
             {id:'cl',name:'策论',weight:20,ideology:'practical'}],
      song: [{id:'jy',name:'经义',weight:20,ideology:'traditional'},
             {id:'cl',name:'策论',weight:15,ideology:'practical'}],
      ming: [{id:'cl',name:'策论',weight:15,ideology:'practical'},
             {id:'shi',name:'诗赋',weight:10,ideology:'traditional'}],
      qing: [{id:'sx',name:'实学',weight:15,ideology:'practical'},
             {id:'xx',name:'西学',weight:10,ideology:'modern'}]
    };
    return (classic[era] || classic.ming).slice(0, count).map(function(s) {
      return _kjpL6NormalizeSubject(Object.assign({}, s, {
        format: '笔策', historicalAnalog: 'fallback (无 LLM)', rationale: '默认推荐 (无 AI)'
      }));
    });
  }

  function _kjpL6RationalizeFallback(userInput) {
    // RAA·B3 + B8·trim check 一致·空 / 仅空格·return null·非 fallback '未名'
    var trimmed = String(userInput || '').trim();
    if (!trimmed) return null;
    var name = trimmed.slice(0, 8);
    // RBB·BB-B8·按 input 关键词推 ideology·非永远 reformist
    var ideology = 'reformist';
    if (/经|礼|诗|书|易|春秋|论语|孟子|大学|中庸/.test(trimmed)) ideology = 'traditional';
    else if (/算|工|矿|机|物理|化学|西|科技|天文|医|船/.test(trimmed)) ideology = 'modern';
    else if (/律|刑|盐|铁|农|策|实务|时务|漕|河|海防|兵/.test(trimmed)) ideology = 'practical';
    return _kjpL6NormalizeSubject({
      name: name, weight: 10, ideology: ideology,
      format: '笔策', historicalAnalog: '无 LLM·无法考据',
      rationale: '(fallback·user 输 ' + name + '·无 AI 合理化·ideology 按关键词推)'
    });
  }

  // L6·a·LLM 推荐 N 个新 subject·按 era + paradigm + 矛盾 + 变量
  // RAA·B4·count=0 真返 []·user 想无推荐就尊重·非强制 ≥1
  // RBB·BB-A4·draftSubjects param·额外对照 user 同 session 已 push 的 draft·避漏 dedup
  async function _kjpL6LlmSuggestSubjects(count, hint, draftSubjects) {
    // RAA·B4·count=0 explicit·return 空·non-fallback
    var parsedCount = parseInt(count, 10);
    if (parsedCount === 0) return [];
    if (isNaN(parsedCount) || parsedCount < 0) parsedCount = 5;
    count = Math.max(1, Math.min(8, parsedCount));

    var fallback = _kjpL6DedupAgainstParadigm(_kjpL6SuggestFallback(count), draftSubjects);
    if (!_kjpHasAI()) return fallback;

    var paradigm = (typeof GM !== 'undefined' && GM) ? (GM._kejuParadigm || {}) : {};
    var existingSubjects = (paradigm.subjects || []).map(function(s) { return s.name; }).join('·');
    var era = paradigm.initEra || '';
    var ramping = (paradigm.history || []).filter(function(h) {
      return h && (h.status === 'ramping' || h.status === 'active');
    }).slice(-1)[0];
    var coreContradictions = (typeof P !== 'undefined' && P && P.playerInfo && P.playerInfo.coreContradictions) || [];
    var contradictionStr = coreContradictions.slice(0, 3).map(function(c) {
      return (c.dimension || '') + ':' + (c.title || '');
    }).join('·');
    var varHints = Object.keys((typeof GM !== 'undefined' && GM && GM.vars) || {}).slice(0, 8).map(function(k) {
      return k + ':' + Math.round(((GM.vars[k] || {}).value) || 0);
    }).join('·');

    var prompt = '【朝代】' + era + '\n' +
                 '【现有科】' + (existingSubjects || '(空·制度初立)') + '\n' +
                 '【近议改革】' + (ramping ? (ramping.magnitudeDescriptor || '') : '无') + '\n' +
                 '【局势变量】' + (varHints || '(无)') + '\n' +
                 '【显著矛盾】' + (contradictionStr || '(无)') + '\n' +
                 '【玩家方向】' + (hint || '无 (LLM 自由发挥)') + '\n\n' +
                 '请按朝代 + 现状·推荐 ' + count + ' 个可增的新科·\n' +
                 '- 每科·{id (拼音), name (中文), weight (5-30), ' +
                 'ideology (traditional/reformist/practical/modern), ' +
                 'format (考法描述 30 字), historicalAnalog (历史出处), ' +
                 'rationale (推荐理由 50-100 字)}\n' +
                 '- 不重已有科\n' +
                 '- 跟朝代 + 局势贴 (e.g. 边事重→武学 / 灾多→农政 / 商兴→盐铁)\n' +
                 '返 JSON·`[{...}, {...}, ...]`·共 ' + count + ' 条';
    try {
      var raw = await callAISmart(prompt, 1500, { maxRetries: 1, priority: 'low', timeoutMs: 30000 });
      var parsed = _kjpParseJson(raw);
      if (!Array.isArray(parsed) || !parsed.length) return fallback;
      // RAA·B5·post-fetch dedup against paradigm.subjects + RBB·BB-A4·also against draft
      var normalized = parsed.slice(0, count).map(_kjpL6NormalizeSubject);
      return _kjpL6DedupAgainstParadigm(normalized, draftSubjects);
    } catch(e) {
      try { console.warn('[L6·a] LLM fail', e); } catch(_){}
      return fallback;
    }
  }

  // L6·b·LLM 合理化 user 输入·返单 subject schema
  async function _kjpL6LlmRationalizeSubject(userInput) {
    if (!userInput || !String(userInput).trim()) return null;
    var fallback = _kjpL6RationalizeFallback(userInput);
    if (!_kjpHasAI()) return fallback;

    var paradigm = (typeof GM !== 'undefined' && GM) ? (GM._kejuParadigm || {}) : {};
    var era = paradigm.initEra || '';
    var trimmed = String(userInput).trim().slice(0, 30);

    var prompt = '【朝代】' + era + '\n' +
                 '【玩家想增的科】"' + trimmed + '"\n\n' +
                 '请合理化为科举科目·返 JSON·\n' +
                 '{id (拼音), name (中文·若 user 输的合理就保留·若太现代则改朝代合适名), ' +
                 'weight (5-30), ideology (traditional/reformist/practical/modern·按现代化程度选), ' +
                 'format (考法 30 字·体现该科特性), ' +
                 'historicalAnalog (本朝或前朝最接近的实例·若无·标"无先例"), ' +
                 'rationale (合理化解释 100 字·为何这个朝代可有此科·哪派 NPC 支持)}';
    try {
      var raw = await callAISmart(prompt, 800, { maxRetries: 1, priority: 'low', timeoutMs: 25000 });
      var parsed = _kjpParseJson(raw);
      if (!parsed || typeof parsed !== 'object') return fallback;
      return _kjpL6NormalizeSubject(parsed);
    } catch(e) {
      try { console.warn('[L6·b] LLM fail', e); } catch(_){}
      return fallback;
    }
  }

  // ════════════════════════════════════════════════════════════════
  // §L5·改革反对奏疏·inject prompt + post-spawn hook (入主奏疏系统)
  // ════════════════════════════════════════════════════════════════

  function _kjpL5MethodLabel(m) {
    return ({ council:'依议', edict:'下诏', defy:'逆众议' })[m] || m;
  }

  // 8 经典先例·按朝代 filter·真 dynamic 走 paradigm.history (本朝优先)
  // RBB·sort by era specificity·era array 短 (more specific) 优先·防 song+ 4-era 全占
  function _kjpL5ClassicPrecedents(era) {
    var eraLower = (era || '').toLowerCase();
    var ALL = [
      { era:['song','yuan','ming','qing'], text:'熙宁王安石变法·新法乱·终罢' },
      { era:['song','yuan','ming','qing'], text:'元祐党人碑·党争延数十年' },
      { era:['ming','qing'],               text:'张相考成法·吏治肃·张相死后翻案' },
      { era:['qing'],                      text:'戊戌废八股·百日维新失·守旧反' },
      { era:['qing'],                      text:'光绪三十一年废科举·士林散·清制崩' },
      { era:['tang','song','yuan','ming'], text:'唐贞观取百·开元三十·寒门绝路' },
      { era:['ming','qing'],               text:'洪武三十年南北榜案·朱元璋杀考官' },
      { era:['han','wei','jin','tang'],    text:'汉察举·门阀垄断·非真贤' }
    ];
    return ALL
      .filter(function(p) { return p.era.indexOf(eraLower) >= 0; })
      // RAA·C5·sort stability·primary era length·secondary text alphabetic (V8 stable·spec 不保·二次 key 保稳)
      .sort(function(a, b) {
        return (a.era.length - b.era.length) || (a.text < b.text ? -1 : (a.text > b.text ? 1 : 0));
      })
      .map(function(p) { return p.text; })
      .slice(0, 3);
  }

  // L5·a·inject·主 genMemorialsAI prompt 末调
  // RAA·B1·history null guard·B2·opposers name validation·B3·escape special chars
  // RAA·C2·loop ALL ramping/active reforms (非仅 latest)·C3·per-opposer cooldown 5 turn
  function _kjpL5InjectObjectionPrompt(promptBuf) {
    if (typeof GM === 'undefined' || !GM || !GM._kejuParadigm) return promptBuf;
    // gate·useNewKejuL5 默认 off·若 off·non-action
    if (typeof P === 'undefined' || !P || !P.conf || P.conf.useNewKejuL5 === false) return promptBuf;

    // RAA·B1·history null guard
    var allHist = (GM._kejuParadigm && Array.isArray(GM._kejuParadigm.history))
      ? GM._kejuParadigm.history : [];
    var rampingReforms = allHist.filter(function(h) {
      return h && (h.status === 'ramping' || h.status === 'active');
    });
    if (!rampingReforms.length) return promptBuf;

    // RAA·C3·cooldown table·{`${reformId}_${opposer}`: lastInjectTurn}·5 turn cooldown
    if (!GM._kjpL5InjectCooldown) GM._kjpL5InjectCooldown = {};
    var COOLDOWN_TURNS = 5;
    var curTurn = (GM.turn || 0);

    // RAA·C2·loop ALL ramping reforms·非仅 latest·每 reform 取 1-2 opposers (限 max 3 reforms 同 turn 防 prompt 爆)
    var injectSections = [];
    rampingReforms.slice(-3).forEach(function(reform) {
      if (!reform || !reform.id) return;
      // RAA·B2·opposers·name 类型校验 + 状态 filter
      var opposers = (reform.opposeNpcs || []).filter(function(name) {
        if (!name || typeof name !== 'string') return false;
        var trimmed = name.trim();
        if (!trimmed) return false;
        var ch = (typeof findCharByName === 'function') ? findCharByName(trimmed) : null;
        if (!ch) return false;
        if (ch.alive === false) return false;
        if (ch._retired || ch._exiled || ch._imprisoned) return false;
        // RAA·C3·cooldown check
        // RBB·BB-B1·load 后 turn 倒退·防 cooldown 永生效 (lastInject > curTurn → 算 0 距·重置)
        var cdKey = reform.id + '_' + trimmed;
        var lastInject = parseInt(GM._kjpL5InjectCooldown[cdKey], 10) || 0;
        if (lastInject > curTurn) {
          // save/load turn 倒退·cooldown 反向无效·清该 entry
          delete GM._kjpL5InjectCooldown[cdKey];
          lastInject = 0;
        }
        if (lastInject && (curTurn - lastInject) < COOLDOWN_TURNS) return false;
        // RBB·BB-D1·user 已 take action (批/驳/廷议)·永 skip 该 opposer 同 reform
        // 独立 dict·永久 lock·跟 turn cooldown 不冲突
        if (GM._kjpL5UserActedCooldown && GM._kjpL5UserActedCooldown[cdKey] != null) return false;
        return true;
      }).slice(0, 2);
      if (!opposers.length) return;

      // RAA·C3·write cooldown
      opposers.forEach(function(name) {
        GM._kjpL5InjectCooldown[reform.id + '_' + name] = curTurn;
      });

      // RAA·B3·escape special chars (single quote / backslash) in 引入 prompt 文段
      var safeBy = _kjpL5EscapePrompt(reform.by || '陛下');
      var safeMag = _kjpL5EscapePrompt(reform.magnitudeDescriptor || '改科举');
      var safeRefId = _kjpL5EscapePrompt(reform.id);
      var section = '\n【改革 ' + reform.year + '·' + safeBy + '·' + safeMag + '·' + _kjpL5MethodLabel(reform.method) +
                    (reform.intent === 'restoration' ? '·复古' : '') + '·反对派】' + opposers.join('·');
      injectSections.push({ reform: reform, opposers: opposers, header: section });
    });

    if (!injectSections.length) return promptBuf;

    var inject = '\n\n【近期改革·反对派可能上书反对·改革反对奏疏 (主 LLM 写·入 GM.memorials)】\n';
    injectSections.forEach(function(s) { inject += s.header + '\n'; });

    inject += '\n※ 若上述 NPC 是本回合奏疏对象·请生成反对改革的奏疏 (1-2 份·非每个都写)·\n';
    inject += '   - type 标 "政务"·subtype 标 "改革反对"·relatedTo 标该 reform.id·status 留 "pending" (由主奏疏 default 处理)\n';
    inject += '   - content 200-400 字古文·按 trait + archetype 调语气·\n';
    inject += '     · conservative / ritualist·沉痛援先例·"祖制不可轻易"\n';
    inject += '     · pragmatic·冷静论实效·"行之十年·吏治反蠹"\n';
    inject += '     · celestial·警异常·"星象示变·恐天意不容"\n';
    inject += '     · scholar / honest·直谏·"陛下不可不察"\n';
    inject += '   - 引 1-2 历史先例 (本朝 + 经典)·见下\n';
    inject += '   - 结尾"伏请陛下察"·非攻击性\n';

    // dynamic precedent·读 paradigm.history 本朝已 matured / rejected 改革
    var curYear = (GM.year || 9999);
    var ownReforms = allHist.filter(function(h) {
      return h && (h.status === 'matured' || h.status === 'rejected') &&
             (typeof h.year === 'number') && h.year < curYear;
    });
    if (ownReforms.length > 0) {
      inject += '\n【本朝可引先例·真历史】\n';
      ownReforms.slice(-3).forEach(function(r) {
        inject += '  · ' + r.year + '年 ' + _kjpL5EscapePrompt(r.by || '') + '·' + _kjpL5EscapePrompt(r.magnitudeDescriptor || '改') + '·' +
                  (r.status === 'matured' ? '终行' : (r.status === 'rejected' ? '罢议' : '行')) + '\n';
      });
    }

    // 8 经典·按朝代
    var era = (GM._kejuParadigm.initEra || '');
    var classic = _kjpL5ClassicPrecedents(era);
    if (classic.length > 0) {
      inject += '\n【经典先例·可引】\n';
      classic.forEach(function(p) { inject += '  · ' + p + '\n'; });
    }

    return promptBuf + inject;
  }

  // RBB·BB-B3 + BB-B4·cleanup cooldown 表·matured/rejected reform + dead/exiled/imprisoned/retired NPC 的 entry
  // 由 endTurn 调·或 _prepareGMForSave 前调·防 cooldown 表无限增长
  function _kjpL5CleanupCooldown() {
    if (typeof GM === 'undefined' || !GM) return 0;
    var activeReformIds = {};
    try {
      if (GM._kejuParadigm && Array.isArray(GM._kejuParadigm.history)) {
        GM._kejuParadigm.history.forEach(function(h) {
          if (h && h.id && (h.status === 'ramping' || h.status === 'active')) {
            activeReformIds[h.id] = true;
          }
        });
      }
    } catch(_){}

    var removed = 0;
    // 同 cleanup 主 cooldown 表 + user-acted lock 表
    [GM._kjpL5InjectCooldown, GM._kjpL5UserActedCooldown].forEach(function(cd) {
      if (!cd) return;
      Object.keys(cd).forEach(function(key) {
        // key format·reformId_opposer
        var lastUnderscore = key.lastIndexOf('_');
        if (lastUnderscore <= 0) return;
        var reformId = key.slice(0, lastUnderscore);
        var opposer = key.slice(lastUnderscore + 1);

        // BB-B3·matured/rejected reform·清
        if (!activeReformIds[reformId]) {
          delete cd[key];
          removed++;
          return;
        }
        // BB-B4·NPC dead/retired/exiled/imprisoned·清
        try {
          var ch = (typeof findCharByName === 'function') ? findCharByName(opposer) : null;
          if (!ch || ch.alive === false || ch._retired || ch._exiled || ch._imprisoned) {
            delete cd[key];
            removed++;
          }
        } catch(_){}
      });
    });
    return removed;
  }

  // RAA·B3·escape special chars (single quote / backslash) for LLM prompt safety
  function _kjpL5EscapePrompt(s) {
    if (s == null) return '';
    return String(s)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, '’')         // 单引号 → 右单引号 (LLM 友好·非 escape)
      .replace(/"/g, '”');        // 双引号 → 右双引号
  }

  // L5·b·post-spawn hook·detect subtype='改革反对'·写 NPC reformLean / memory
  // RAA·B4·二级 guard·防 save/load 后 chronicle double-record (m._kjpL5Processed 在 memorial·flag 持久·OK; 但 NpcMemorySystem.remember 该按 m.id 防 dup)
  // RAA·A3·chronicle alert·若 L5 spawn 计数>0·写邸报 cosmetic·user 知 L5 spawn
  function _kjpL5PostSpawnHook(memorialList) {
    if (!Array.isArray(memorialList) || !memorialList.length) return;
    var turn = (typeof GM !== 'undefined' && GM) ? (GM.turn || 0) : 0;
    var playerName = (typeof P !== 'undefined' && P && P.playerInfo && P.playerInfo.characterName) || '陛下';
    var spawnCount = 0;
    var firstReformId = '';

    memorialList.forEach(function(m) {
      if (!m || m._kjpL5Processed) return;
      if (m.subtype !== '改革反对') return;
      m._kjpL5Processed = true;
      spawnCount++;
      if (!firstReformId) firstReformId = m.relatedTo || '';
      try {
        var ch = (typeof findCharByName === 'function') ? findCharByName(m.from) : null;
        if (ch) {
          // reformLean -5·公开反对·立场更明 (复用 L4 R6 helper)
          if (typeof _kjpAccumReformLean === 'function') {
            _kjpAccumReformLean(ch, -5, turn);
          }
          // NpcMemorySystem.remember·NPC 记 "上书反对·恨" (复用 Stage 1)
          // RAA·B4·按 m.id 二级 guard·若 save/load 后再 call·已记不再记
          // RBB·BB-C1·改用 ch._kjpL5ProcessedMemorials dict (集中存)·非 _kjpL5Mem_xxx 散字段·避 NPC field 污染
          if (!ch._kjpL5ProcessedMemorials) ch._kjpL5ProcessedMemorials = {};
          var memId = m.id || (m.from + '_' + turn);
          if (!ch._kjpL5ProcessedMemorials[memId]) {
            ch._kjpL5ProcessedMemorials[memId] = true;
            if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
              NpcMemorySystem.remember(
                m.from,
                '上书反对·' + (m.title || '改革') + '·' + ((m.content || '').slice(0, 30)),
                '怨',
                6,
                playerName
              );
            }
          }
        }
      } catch(_){}
    });

    // RAA·A3·若有 spawn·chronicle 写邸报 cosmetic·user 知 L5 已 spawn
    // RBB·BB-C2·per-turn dedup·同 turn 不重写 (聚合)
    if (spawnCount > 0) {
      try {
        if (typeof GM !== 'undefined' && Array.isArray(GM._chronicle)) {
          // dedup·查当 turn 是否已有 entry·若有·更 spawnCount 数 (聚合)
          var existing = null;
          for (var i = GM._chronicle.length - 1; i >= 0; i--) {
            var c = GM._chronicle[i];
            if (c && c.turn === turn && c.type === 'keju-objection-memorial-spawn') {
              existing = c;
              break;
            }
            // 优化·若 turn 不同·break (chronicle 时序 push·older 在前)
            if (c && typeof c.turn === 'number' && c.turn < turn) break;
          }
          if (existing) {
            // 聚合·累加 spawnCount·若 firstReformId 不同·标 multi
            existing.spawnCount = (existing.spawnCount || 1) + spawnCount;
            if (existing.firstReformId && existing.firstReformId !== firstReformId) {
              existing.firstReformId = '多 reform';
            }
            existing.text = '改革议·' + existing.spawnCount + ' 条反对奏疏入「百官奏疏」' +
                            (existing.firstReformId ? '·涉 ' + existing.firstReformId : '');
          } else {
            if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
              turn: turn,
              type: 'keju-objection-memorial-spawn',
              text: '改革议·' + spawnCount + ' 条反对奏疏入「百官奏疏」' + (firstReformId ? '·涉 ' + firstReformId : ''),
              tags: ['科举', 'reform', 'objection'],
              spawnCount: spawnCount,
              firstReformId: firstReformId
            });
          }
        }
      } catch(_){}
    }
  }

  if (!global.TM) global.TM = {};
  if (!global.TM.Keju) global.TM.Keju = {};
  if (!global.TM.Keju.ReformLlm) global.TM.Keju.ReformLlm = {};
  global.TM.Keju.ReformLlm.parseMagnitude = _kjpLlmParseMagnitudeDescriptor;
  global.TM.Keju.ReformLlm.suggestPilots = _kjpLlmSuggestPilots;
  global.TM.Keju.ReformLlm.assessCourtMood = _kjpLlmAssessCourtMood;
  global.TM.Keju.ReformLlm.audienceDialog = _kjpLlmAudienceDialog;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      _kjpLlmParseMagnitudeDescriptor: _kjpLlmParseMagnitudeDescriptor,
      _kjpLlmSuggestPilots: _kjpLlmSuggestPilots,
      _kjpLlmAssessCourtMood: _kjpLlmAssessCourtMood,
      _kjpLlmAudienceDialog: _kjpLlmAudienceDialog,
      _kjpDescriptorFallback: _kjpDescriptorFallback,
      _kjpPilotFallback: _kjpPilotFallback,
      _kjpCourtMoodFallback: _kjpCourtMoodFallback,
      _kjpAudienceFallback: _kjpAudienceFallback,
      _kjpSummarizeDiff: _kjpSummarizeDiff,
      // L4·d
      _kjGetTopicShortLabel: _kjGetTopicShortLabel,
      _ty3_appendReformPromptIfReform: _ty3_appendReformPromptIfReform,
      _kjpAppendPrivateAudienceHint: _kjpAppendPrivateAudienceHint,
      _kjpAppendOwnCeduiHint: _kjpAppendOwnCeduiHint,
      _kjpStringSimilarity: _kjpStringSimilarity,
      // L4·a
      ARCHETYPE_PROMPT_VOICE: ARCHETYPE_PROMPT_VOICE,
      ARCHETYPE_LABELS: ARCHETYPE_LABELS,
      ARCHETYPE_BIAS_TONE: ARCHETYPE_BIAS_TONE,
      _kjpArchetypeBiasTone: _kjpArchetypeBiasTone,
      _kjpArchetypeSpecificRequirements: _kjpArchetypeSpecificRequirements,
      _kjpInferAdvisorArchetype: _kjpInferAdvisorArchetype,
      _kjpIsOnFrontier: _kjpIsOnFrontier,
      _kjpDeriveCandidateReactions: _kjpDeriveCandidateReactions,
      _kjpBuildCeduiPrefill: _kjpBuildCeduiPrefill,
      _kjpBuildCeduiPromptContext: _kjpBuildCeduiPromptContext,
      _kjpListForecastAdvisors: _kjpListForecastAdvisors,
      // L4·f1
      _kjpLlmMergeAdvisorViews: _kjpLlmMergeAdvisorViews,
      _kjpMergeViewsFallback: _kjpMergeViewsFallback
    };
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));

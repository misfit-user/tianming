// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// Module: tm-chaoyi-yuqian.js — 御前会议 v2·密召心腹·坦言直陈·可不录
// Domain: 朝议·御前会议
// Status: active · Last Updated: 2026-05-03 (Phase 3·从 tm-chaoyi-v2.js L876-1363 抽出)
// Owner: TM 团队
// Imports: tm-utils.js·tm-index-world.js·tm-chaoyi.js (addCYBubble)·tm-chaoyi-tinyi.js (_cy_suggestBtnHtml)
// Exports: _yq2_openSetup·_yq2_triggerExcludedFeelings·_yq2_phaseQuestion·_yq2_offerFollowUp·_yq2_pickAdvisor·_yq2_askAdvisor·_yq2_enterDecide·_yq2_decide·_yq2_finalEnd·_yq2_doCloseSession·_yq2_globalFooter
// Used by: tm-chaoyi.js (_cy_pickMode 调 _yq2_openSetup)
// Side effects: DOM (yq2-setup-bg)·CY 状态
// Test: web/scripts/cc3-smoke·boot-smoke
// Notes: Phase 3 (2026-05-03) 5→4 文件·从 v2 抽·议题类型·诛戮/托孤/军机/罢相/宫禁/人事/其他·屏退宫人 → 帝出疑问 → 逐人问对 → 密谈 → 决断与保密
// 姊妹·tm-chaoyi.js·tm-chaoyi-changchao.js·tm-chaoyi-tinyi.js
// ============================================================

// ═══════════════════════════════════════════════════════════════════════
//  御前会议 2.0——密召心腹，坦言直陈，可不录
//  议题类型：诛戮/托孤/军机/罢相/宫禁/人事/其他
//  流程：屏退宫人 → 帝出疑问 → 逐人问对 → 密谈 → 决断与保密
// ═══════════════════════════════════════════════════════════════════════

function _yq2_openSetup() {
  var bg = document.createElement('div');
  bg.id = 'yq2-setup-bg';
  bg.style.cssText = 'position:fixed;inset:0;z-index:1300;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;';
  // 候选：同势力 + 高忠诚 + 在玩家所在地（御前密议·异族不入）
  var candidates = (GM.chars||[]).filter(function(c) {
    if (c.alive === false || c.isPlayer || !_isAtCapital(c) || !_isPlayerFactionChar(c)) return false;
    return (c.loyalty||50) >= 50; // 至少中等忠诚可入密议
  }).sort(function(a,b) {
    // 按"机密适合度"排序：忠*0.5 + 品*0.3 + 恩遇*0.2
    var sa = (a.loyalty||50) * 0.5 + (110 - (typeof getRankLevel === 'function' ? getRankLevel(_cyGetRank(a)) : 99)) * 0.5;
    var sb = (b.loyalty||50) * 0.5 + (110 - (typeof getRankLevel === 'function' ? getRankLevel(_cyGetRank(b)) : 99)) * 0.5;
    return sb - sa;
  }).slice(0, 25);
  var autoSelect = candidates.slice(0, 4).map(function(c){return c.name;});

  var html = '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1.3rem 1.7rem;max-width:540px;width:92%;max-height:85vh;overflow-y:auto;">';
  html += '<div style="text-align:center;font-size:var(--text-md);color:var(--gold-400);letter-spacing:0.12em;margin-bottom:0.9rem;">〔 御 前 会 议 · 筹 备 〕</div>';
  html += '<div style="font-size:0.71rem;color:var(--ink-300);text-align:center;margin-bottom:0.8rem;">屏退宫人，与心腹重臣密议机要。</div>';
  // 议题
  html += '<div class="fd" style="margin-bottom:0.7rem;"><label style="font-size:0.72rem;">议题（机密事项）</label>';
  html += '<input id="yq2-topic" placeholder="如：废太子议、罢某相、诛权阉、出兵略西域……" style="width:100%;padding:5px 8px;background:var(--color-elevated);border:1px solid var(--color-border);border-radius:var(--radius-sm);color:var(--color-foreground);">';
  html += '</div>';
  // 议题类型
  html += '<div style="font-size:0.7rem;color:var(--color-foreground-muted);margin-bottom:0.35rem;">议题类型</div>';
  html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:0.8rem;">';
  [['execution','🗡️ 诛戮'],['succession','👑 托孤废立'],['military','🎯 军机'],['removal','🎭 罢相'],['palace','🏯 宫禁'],['appointment','💼 人事'],['plot','🕵️ 密谋'],['other','❓ 其他']].forEach(function(t) {
    html += '<label style="display:flex;align-items:center;gap:3px;padding:4px 6px;background:var(--color-elevated);border-radius:3px;font-size:0.7rem;cursor:pointer;">';
    html += '<input type="radio" name="yq2-type" value="' + t[0] + '"' + (t[0]==='execution'?' checked':'') + '>' + t[1];
    html += '</label>';
  });
  html += '</div>';
  html += '<input id="yq2-type-custom" placeholder="若选其他，描述议题性质……" style="width:100%;padding:5px 8px;margin-bottom:0.8rem;display:none;font-size:0.78rem;background:var(--color-elevated);border:1px solid var(--color-border);border-radius:var(--radius-sm);color:var(--color-foreground);">';
  // 心腹候选
  html += '<div style="font-size:0.7rem;color:var(--color-foreground-muted);margin-bottom:0.35rem;">心腹候选（按忠诚+品级排序，至多 8 人）</div>';
  html += '<div style="max-height:220px;overflow-y:auto;padding:6px;background:var(--color-elevated);border-radius:3px;margin-bottom:0.7rem;">';
  candidates.forEach(function(c) {
    var auto = autoSelect.indexOf(c.name) >= 0;
    html += '<label style="display:flex;align-items:center;gap:5px;padding:3px 5px;font-size:0.7rem;cursor:pointer;">';
    html += '<input type="checkbox" class="yq2-advisor" value="' + escHtml(c.name) + '"' + (auto?' checked':'') + '>';
    html += '<span>' + escHtml(c.name) + '</span>';
    html += '<span style="color:var(--ink-300);font-size:0.68rem;">' + escHtml(c.officialTitle||c.title||'') + ' 忠' + (typeof _fmtNum1==='function'?_fmtNum1(c.loyalty||50):(c.loyalty||50)) + ' 野' + (typeof _fmtNum1==='function'?_fmtNum1(c.ambition||40):(c.ambition||40)) + '</span>';
    html += '</label>';
  });
  html += '</div>';
  // 记录选项
  html += '<div style="font-size:0.7rem;color:var(--color-foreground-muted);margin-bottom:0.35rem;">起居注记录</div>';
  html += '<div style="display:flex;gap:1rem;margin-bottom:0.8rem;">';
  html += '<label style="font-size:0.72rem;"><input type="radio" name="yq2-record" value="keep" checked> 📜 记起居注（正常）</label>';
  html += '<label style="font-size:0.72rem;color:var(--vermillion-400);"><input type="radio" name="yq2-record" value="secret"> 🤐 不录（密议——泄密风险）</label>';
  html += '</div>';
  html += '<div style="font-size:0.68rem;color:var(--ink-300);margin-bottom:0.8rem;">· 不录者：议事不入起居注/纪事；若事后泄密，则成大丑闻</div>';
  html += '<div style="text-align:center;display:flex;gap:var(--space-2);justify-content:center;">';
  html += '<button class="bt bp" onclick="_yq2_startSession()">开议</button>';
  html += '<button class="bt" onclick="this.closest(\'div[style*=fixed]\').remove();">取消</button>';
  html += '</div></div>';
  bg.innerHTML = html;
  document.body.appendChild(bg);

  // 类型"其他"联动
  bg.querySelectorAll('input[name="yq2-type"]').forEach(function(r){
    r.addEventListener('change', function(){
      var cust = _$('yq2-type-custom');
      if (cust) cust.style.display = this.value==='other' ? 'block' : 'none';
    });
  });
  // 选人上限 8
  bg.querySelectorAll('.yq2-advisor').forEach(function(cb){
    cb.addEventListener('change', function(){
      var checked = bg.querySelectorAll('.yq2-advisor:checked').length;
      if (checked > 8) { this.checked = false; toast('至多 8 人'); }
    });
  });
}

async function _yq2_startSession() {
  var topic = (_$('yq2-topic')||{}).value || '';
  topic = topic.trim();
  if (!topic) { toast('请输入议题'); return; }
  var typeR = document.querySelector('input[name="yq2-type"]:checked');
  var ttype = typeR ? typeR.value : 'other';
  var tcustom = (_$('yq2-type-custom')||{}).value || '';
  var recordR = document.querySelector('input[name="yq2-record"]:checked');
  var record = recordR ? recordR.value : 'keep';
  var advisors = [];
  document.querySelectorAll('.yq2-advisor:checked').forEach(function(c){ advisors.push(c.value); });
  if (advisors.length < 1) { toast('至少召 1 位心腹'); return; }
  if (advisors.length > 8) { toast('至多 8 位'); return; }

  if (typeof _spendEnergy === 'function' && !_spendEnergy(10, '御前会议')) return;

  var bg = _$('yq2-setup-bg'); if (bg) bg.remove();

  CY.phase = 'yuqian2';
  CY._yq2 = {
    topic: topic,
    topicType: ttype,
    topicCustom: tcustom,
    advisors: advisors,
    record: record,
    opinions: {},          // name → {line, candor}
    summonedAdvisor: null,
    currentPhase: 'retreating',
    leakRisk: 0,
    excluded: [],         // 被排除的重臣（有资格但未被召）
    candorMap: {}         // B3·预计算 candor·避免 _yq2_oneAdvisorSpeak 每次重算
  };
  // B3·坦白度预计算（一次性为所有心腹算好）
  advisors.forEach(function(_nm) {
    var _ch = findCharByName(_nm); if (!_ch) return;
    var _de = 0;
    var _tids = (_ch.traits||[]).concat(_ch.traitIds||[]);
    if (_tids.indexOf('deceitful') >= 0) _de = 30;
    if (_tids.indexOf('honest') >= 0) _de = -20;
    var _cd = Math.max(0, Math.min(100, (_ch.loyalty||50) * 0.5 + (100 - _de) * 0.3 + 20));
    CY._yq2.candorMap[_nm] = { candor: _cd, level: _cd > 80 ? '\u63A8\u5FC3\u7F6E\u8179' : _cd > 50 ? '\u5927\u81F4\u5766\u8A00' : '\u63E3\u6469\u5723\u610F' };
  });
  // 计算被排除者——资格达标但未被召
  (GM.chars||[]).forEach(function(c) {
    if (c.alive === false || c.isPlayer || !_isAtCapital(c)) return;
    if (advisors.indexOf(c.name) >= 0) return;
    if ((c.loyalty||50) >= 70 && (typeof getRankLevel === 'function' ? getRankLevel(_cyGetRank(c)) : 99) <= 6) {
      CY._yq2.excluded.push(c.name);
    }
  });

  var body = _$('cy-body');
  body.innerHTML = '';
  var topicEl = _$('cy-topic');
  if (topicEl) { topicEl.style.display = 'block'; topicEl.innerHTML = '👑 御前会议·' + escHtml(topic) + (record === 'secret' ? ' <span style="color:var(--vermillion-400);font-size:0.7rem;">[密议不录]</span>' : ''); }

  addCYBubble('内侍', '（陛下入御书房。内侍、宫娥尽皆屏退。）', true);
  addCYBubble('内侍', '（殿中仅余陛下与 ' + advisors.length + ' 员心腹。）', true);

  CY._abortChaoyi = false; CY._pendingPlayerLine = null;
  if (typeof _cyShowInputRow === 'function') _cyShowInputRow(true);

  // 记录被排除感（立即触发，用自然逻辑）
  _yq2_triggerExcludedFeelings();

  // 2026-06 faithful landing·重排为左烛火立绘 + 右心腹列版式（对齐预览）
  try { _yq2_relayout(); _yq2_renderInner(); } catch(_yqLayoutErr) { try { window.TM && TM.errors && TM.errors.captureSilent(_yqLayoutErr, 'yuqian-relayout'); } catch(_) {} }

  // 帝出疑问——等玩家输入具体问题（可用议题作为默认）
  _yq2_phaseQuestion();
}

function _yq2_triggerExcludedFeelings() {
  if (!CY._yq2 || !CY._yq2.excluded.length) return;
  CY._yq2.excluded.forEach(function(nm) {
    var ch = findCharByName(nm);
    if (!ch) return;
    // 每次被排除 -3 loyalty (轻)
    if (typeof adjustCharacterLoyalty === 'function') {
      adjustCharacterLoyalty(ch, -3, '\u5FA1\u524D\u5BC6\u8BAE\u672A\u88AB\u53EC\u5165\uFF1A' + (CY._yq2.topic || '').slice(0, 15), { source:'yuqian-excluded' });
    } else {
      var oldL = (typeof ch.loyalty === 'number' && isFinite(ch.loyalty)) ? ch.loyalty : 50;
      ch.loyalty = Math.max(0, oldL - 3);
    }
    if (typeof NpcMemorySystem !== 'undefined') {
      NpcMemorySystem.remember(nm, '陛下未召我议密事（' + CY._yq2.topic.slice(0,15) + '）——疑心中有他意', '忧', 4);
    }
  });
}

function _yq2_phaseQuestion() {
  CY._yq2.currentPhase = 'question';
  _yq2_emp('朕有一事难决，诸卿可直言——' + CY._yq2.topic);
  var footer = _$('cy-footer');
  footer.innerHTML = '<div style="display:flex;gap:var(--space-1);justify-content:center;flex-wrap:wrap;">'
    + '<button class="bt bp bsm" onclick="_yq2_startRoundQuery()">📣 令众人直陈</button>'
    + '<button class="bt bsm" onclick="_yq2_pickAdvisor()">👤 单独问某人</button>'
    + '</div>' + _yq2_globalFooter();
}

async function _yq2_startRoundQuery() {
  CY._yq2.currentPhase = 'roundQuery';
  var footer = _$('cy-footer');
  footer.innerHTML = '<div style="text-align:center;color:var(--color-foreground-muted);font-size:0.72rem;padding:0.4rem;">心腹依次直言……（可在下方输入框插言或打断）</div>';
  addCYBubble('内侍', '（诸卿依次直陈其议。）', true);

  CY._yq2._transcript = '';
  for (var _rd = 1; _rd <= 2; _rd++) {
    if (_rd === 2) addCYBubble('内侍', '（帝意未决，再令诸卿各抒所见。）', true);
    for (var i = 0; i < CY._yq2.advisors.length; i++) {
      if (CY._abortChaoyi) { CY._abortChaoyi=false; break; }
      // 玩家中途插言
      if (CY._pendingPlayerLine) {
        var _pl = CY._pendingPlayerLine; CY._pendingPlayerLine = null;
        _yq2_emp(_pl);
        if (CY._yq2.record !== 'secret') _cy_jishiAdd('yuqian', CY._yq2.topic, '皇帝', _pl, { playerInterject: true, round: _rd });
        CY._yq2._transcript += '\n皇帝：' + _pl;
      }
      var nm = CY._yq2.advisors[i];
      await _yq2_oneAdvisorSpeak(nm, _rd);
    }
    if (CY._abortChaoyi) { CY._abortChaoyi=false; break; }
  }

  _yq2_offerFollowUp();
}

async function _yq2_oneAdvisorSpeak(name, roundNum) {
  roundNum = roundNum || 1;
  var ch = findCharByName(name);
  if (!ch) return;
  // B3·坦白度从预计算表取·无则兜底
  var _cachedCand = (CY._yq2 && CY._yq2.candorMap && CY._yq2.candorMap[name]) || null;
  var candor, candorLevel;
  if (_cachedCand) {
    candor = _cachedCand.candor; candorLevel = _cachedCand.level;
  } else {
    var deceit = 0;
    var tids = (ch.traits||[]).concat(ch.traitIds||[]);
    if (tids.indexOf('deceitful') >= 0) deceit = 30;
    if (tids.indexOf('honest') >= 0) deceit = -20;
    candor = Math.max(0, Math.min(100, (ch.loyalty||50) * 0.5 + (100 - deceit) * 0.3 + 20));
    candorLevel = candor > 80 ? '推心置腹' : candor > 50 ? '大致坦言' : '揣摩圣意';
  }

  if (!P.ai || !P.ai.key) {
    addCYBubble(name, '（臣以为……）', false);
    CY._yq2.opinions[name] = { line: '(无 AI)', candor: candor };
    return;
  }

  var prompt = '御前会议·坦言直陈（第 ' + roundNum + ' 轮）。议题：' + CY._yq2.topic + '\n';
  prompt += '你扮演' + name + '（' + (ch.officialTitle||ch.title||'') + '）。\n';
  prompt += '性格：' + (ch.personality||'') + '\n';
  prompt += '忠' + (ch.loyalty||50) + ' 野' + (ch.ambition||40) + ' 学识:' + (ch.learning||'') + ' 党:' + (ch.party||'无') + '\n';
  // ★2026-07-01 S2治「跨界面人格分裂」:改用统一 getMemoryContext(与问对/奏疏/廷议/常朝同源·含心绪/人生底色/要事/印象/伤疤)·而非 slice(-3) 浅切片·人格一致·无则回退
  var _yqMem = '';
  try { if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.getMemoryContext) _yqMem = NpcMemorySystem.getMemoryContext(name) || ''; } catch (_yqmE) {}
  prompt += _yqMem ? ('【此人记忆与心性】' + _yqMem + '\n') : ('近期记忆：' + ((ch._memory||[]).slice(-3).map(function(m){return (m.event||'').slice(0,30);}).join('；')||'无') + '\n');
  prompt += '你的坦白度：' + candor + '/100（' + candorLevel + '·\u8D8A\u9AD8\u8D8A\u76F4\u8A00\u00B7\u8D8A\u4F4E\u8D8A\u8FCE\u5408\uFF09\n';
  if (CY._yq2._transcript) {
    prompt += '\n已有对话（仅供参考，你可附议/反驳/补充/转圜）：\n' + CY._yq2._transcript.slice(-1600) + '\n';
  } else {
    prompt += '\n当前无他人先言，你是直接受问。';
  }
  if (roundNum >= 2 && CY._yq2.opinions[name] && CY._yq2.opinions[name].line) {
    prompt += '\n你上轮已陈言：' + CY._yq2.opinions[name].line.slice(0, 120) + '\n此轮可据他人之言修订或坚持。';
  }
  prompt += '\n请给出你的答复（文言/半文言）。' + (typeof _aiDialogueWordHint === 'function' ? _aiDialogueWordHint('cy') + '（发言必须达到此字数范围）' : '') + '\n';
  prompt += '返回 JSON：{"line":"...","stance":"支持/反对/保留/另提/推诿","inwardThought":"真实内心(10-30字)"}';

  // A2: 流式化——建占位气泡·onChunk 渐进显示 "line" 字段
  var _yqDiv = addCYBubble(name, '\u2026', false);
  try { _yq2_setSpeaker(name); if (_yqDiv && CY._yq2 && CY._yq2.candorMap && CY._yq2.candorMap[name] && CY._yq2.candorMap[name].candor <= 50) _yqDiv.classList.add('yq-guard'); } catch(_yqSpErr) {}   // \u8c01\u6df1\u8a00\u5219\u8c01\u7acb\u7ed8 + \u5766\u767d\u5ea6\u6761
  try { _yq2_tagBubbleCandor(_yqDiv, candorLevel); } catch(_yqCdErr) {}   // name 行坦白度标签（对齐预览 .cand）
  var _yqBubble = _yqDiv && _yqDiv.querySelector ? _yqDiv.querySelector('.cy-bubble') : null;
  var _yqRaf = false;
  var _yqRendered = false;  // 1.2.4.3·气泡已渲染则禁止 catch 覆写「未能陈词」
  CY.abortCtrl = new AbortController();  // 每次新建·避免前次 abort 污染
  try {
    var raw = await callAIMessagesStream(
      [{role:'user', content: prompt}],
      (typeof _aiDialogueTok==='function'?_aiDialogueTok("cy", 1):700),
      { signal: CY.abortCtrl.signal,
        tier: (typeof _useSecondaryTier === 'function' && _useSecondaryTier()) ? 'secondary' : undefined,  // M3·御前走次 API
        onChunk: function(txt) {
          if (!_yqBubble || _yqRaf) return;
          _yqRaf = true;
          requestAnimationFrame(function() {
            _yqRaf = false;
            var m = (txt||'').match(/"line"\s*:\s*"((?:[^"\\]|\\.)*)/);
            if (m && m[1]) {
              _yqBubble.textContent = m[1].replace(/\\n/g,'\n').replace(/\\"/g,'"').replace(/\\\\/g,'\\');
              _yqBubble.style.color = '';
            }
          });
      } }
    );
    var obj = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
    if (obj && obj.line) {
      if (_yqBubble) { _yqBubble.innerHTML = '\u3014\u7B2C' + roundNum + '\u8F6E\u3015' + escHtml(obj.line); _yqRendered = true; }
      try { CY._yq2.opinions[name] = { line: obj.line, candor: candor, stance: obj.stance, inward: obj.inwardThought, round: roundNum }; } catch(_oe){ try{window.TM&&TM.errors&&TM.errors.captureSilent(_oe,'yuqian-opinions');}catch(_){} }
      try { if (CY._yq2._transcript != null) CY._yq2._transcript += '\n' + name + '：' + obj.line; } catch(_te){ try{window.TM&&TM.errors&&TM.errors.captureSilent(_te,'yuqian-transcript');}catch(_){} }
      try { if (CY._yq2.record !== 'secret') { _cy_jishiAdd('yuqian', CY._yq2 && CY._yq2.topic, name, obj.line, { candor: candor, stance: obj.stance, round: roundNum }); } } catch(_je){ try{window.TM&&TM.errors&&TM.errors.captureSilent(_je,'yuqian-jishi');}catch(_){} }
      try { if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(name, '御前密议「' + (CY._yq2 && CY._yq2.topic ? String(CY._yq2.topic).slice(0,20) : '') + '」第' + roundNum + '轮陈言——' + (obj.stance||''), '平', 5); } catch(_me){ try{window.TM&&TM.errors&&TM.errors.captureSilent(_me,'yuqian-mem');}catch(_){} }
    } else if (_yqBubble && raw) { _yqBubble.textContent = raw.slice(0, 200); _yqRendered = true; }
  } catch(e){
    try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'yuqian-bubble');}catch(_){}
    // 1.2.4.3\u00B7\u53EA\u5728\u672A\u6E32\u67D3\u8FC7\u4EFB\u4F55\u5185\u5BB9\u65F6\u624D\u8986\u5199\u300C\u672A\u80FD\u9648\u8BCD\u300D\u00B7\u907F\u514D\u6210\u529F\u540E\u88AB\u5F02\u5E38\u526F\u4F5C\u7528\u6253\u56DE\u7EA2\u5B57
    if (_yqBubble && !_yqRendered) { _yqBubble.textContent = '\uFF08\u672A\u80FD\u9648\u8BCD\uFF09'; _yqBubble.style.color = 'var(--red)'; }
  }
}

function _yq2_offerFollowUp() {
  var footer = _$('cy-footer');
  footer.innerHTML = '<div style="display:flex;gap:var(--space-1);justify-content:center;flex-wrap:wrap;">'
    + '<button class="bt bsm" onclick="_yq2_pickAdvisor()">🎯 点某人深问</button>'
    + '<button class="bt bp bsm" onclick="_yq2_enterDecide()">⚖️ 决断</button>'
    + '</div>' + _yq2_globalFooter();
}

function _yq2_pickAdvisor() {
  var bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;z-index:1350;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;';
  var html = '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1rem 1.5rem;max-width:400px;">';
  html += '<div style="color:var(--gold-400);margin-bottom:0.6rem;">深问何人？</div>';
  html += '<div style="display:flex;flex-direction:column;gap:4px;">';
  CY._yq2.advisors.forEach(function(nm) {
    var op = CY._yq2.opinions[nm];
    html += '<button class="bt bsm" style="text-align:left;" onclick="_yq2_askAdvisor(\'' + escHtml(nm).replace(/\'/g,"\\'") + '\');this.closest(\'div[style*=fixed]\').remove();">' + escHtml(nm);
    if (op) html += ' <span style="color:var(--ink-300);font-size:0.7rem;">(坦'+Math.round(op.candor)+')</span>';
    html += '</button>';
  });
  html += '</div>';
  html += '<div style="text-align:center;margin-top:0.6rem;"><button class="bt" onclick="this.closest(\'div[style*=fixed]\').remove();">取消</button></div>';
  html += '</div>';
  bg.innerHTML = html;
  document.body.appendChild(bg);
}

function _yq2_askAdvisor(name) {
  var q = prompt('陛下欲问 ' + name + ' 何事？');
  if (!q || !q.trim()) return;
  _yq2_doAskAdvisor(name, q.trim());
}

async function _yq2_doAskAdvisor(name, question) {
  _yq2_emp('问' + name + '：' + question);
  var ch = findCharByName(name);
  if (!ch) return;
  var candor = (CY._yq2.opinions[name] && CY._yq2.opinions[name].candor) || 70;
  var prompt = '御前密议·深入问答。议题：' + CY._yq2.topic + '\n';
  prompt += '你扮演' + name + '（' + (ch.officialTitle||ch.title||'') + '，性格' + (ch.personality||'') + '，忠' + (ch.loyalty||50) + '）\n';
  prompt += '之前你已陈言：' + ((CY._yq2.opinions[name]&&CY._yq2.opinions[name].line) || '尚未发言') + '\n';
  prompt += '皇帝再深问：' + question + '\n';
  prompt += '坦白度:' + candor + '，' + (candor>80?'推心置腹':candor>50?'大致坦言':'揣摩圣意') + '\n';
  prompt += '请答，可比前言更直率（密谈氛围）。' + (typeof _aiDialogueWordHint === 'function' ? _aiDialogueWordHint() : '') + '\n返回纯文本。';
  // 【降本2026-06-19·time】深问流式化——占位气泡 onChunk 渐显(对齐开场陈言 _yq2_oneAdvisorSpeak·玩家不再干等满)
  var _dqDiv = addCYBubble(name, '…', false);
  try { _yq2_setSpeaker(name); } catch(_dqSpErr) {}   // 谁深言则谁立绘
  try { _yq2_tagBubbleCandor(_dqDiv, candor > 80 ? '推心置腹' : candor > 50 ? '大致坦言' : '揣摩圣意'); } catch(_dqCdErr) {}
  var _dqBubble = _dqDiv && _dqDiv.querySelector ? _dqDiv.querySelector('.cy-bubble') : null;
  var _dqRaf = false;
  var _dqCtrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  try {
    var raw = await callAIMessagesStream(
      [{role:'user', content: prompt}],
      (typeof _aiDialogueTok==='function'?_aiDialogueTok("cy", 1):500),
      { signal: _dqCtrl ? _dqCtrl.signal : undefined,
        tier: (typeof _useSecondaryTier === 'function' && _useSecondaryTier()) ? 'secondary' : undefined,  // M3·御前走次 API
        onChunk: function(txt) {
          if (!_dqBubble || _dqRaf) return;
          _dqRaf = true;
          requestAnimationFrame(function() {
            _dqRaf = false;
            _dqBubble.textContent = '〔深言〕' + (txt || '');
          });
        } }
    );
    var line = (raw || '').trim();
    if (_dqBubble) _dqBubble.innerHTML = '〔深言〕' + escHtml(line);
    else addCYBubble(name, '〔深言〕' + escHtml(line), false, true);
    if (CY._yq2.record !== 'secret') _cy_jishiAdd('yuqian', CY._yq2.topic, name, line, { deep: true });
  } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-chaoyi-keju');}catch(_){}}
  _yq2_offerFollowUp();
}

function _yq2_enterDecide() {
  CY._yq2.currentPhase = 'decide';
  var footer = _$('cy-footer');
  // 决断区·起居注录否 + 泄密风险条（对齐预览 rec-row·record 已在筹备选定·此处只读展示）
  var _rec = (CY._yq2.record === 'secret');
  var _lkSum = 0; (CY._yq2.advisors || []).forEach(function(_n) { var _c = findCharByName(_n); if (_c) _lkSum += Math.max(0, 100 - (_c.loyalty || 50)); });
  var _lkAvg = (CY._yq2.advisors && CY._yq2.advisors.length) ? Math.round(_lkSum / CY._yq2.advisors.length) : 0;
  var _lkLvl = _lkAvg > 60 ? '高' : _lkAvg > 35 ? '中' : '低';
  var _recRow = '<div class="yq-rec-row"><span class="yq-rec-lab">起居注</span>'
    + '<span class="yq-rec-opt' + (_rec ? '' : ' sel keep') + '">📜 记</span>'
    + '<span class="yq-rec-opt' + (_rec ? ' sel secret' : '') + '">🤐 不录</span>'
    + '<span class="yq-leak2">泄密风险 <i class="yq-leak-bar"><em style="width:' + _lkAvg + '%"></em></i> <b>' + _lkLvl + '</b></span></div>';
  footer.innerHTML = _recRow + '<div style="display:flex;gap:var(--space-1);justify-content:center;flex-wrap:wrap;">'
    + '<button class="bt bp bsm" onclick="_yq2_decide(\'approve\')">准行</button>'
    + '<button class="bt bsm" style="color:var(--vermillion-400);" onclick="_yq2_decide(\'reject\')">驳否</button>'
    + '<button class="bt bsm" onclick="_yq2_decide(\'defer\')">再议</button>'
    + '<button class="bt bsm" onclick="_yq2_decide(\'custom\')">自定</button>'
    + '</div>' + _yq2_globalFooter();
}

function _yq2_decide(mode) {
  var actualDir = mode;
  var customText = '';
  if (mode === 'custom') {
    customText = prompt('陛下定夺（自述）：');
    if (!customText) return;
  }
  var line = mode === 'approve' ? '准此事' : mode === 'reject' ? '此事勿议' : mode === 'defer' ? '再议' : customText;
  _yq2_emp('朕决：' + line);
  CY._yq2.decision = { mode: mode, custom: customText };

  // 保密等级写入
  if (CY._yq2.record === 'keep') {
    var _yqOutcome = (mode === 'approve') ? ('御前·准行：' + String(CY._yq2.topic || '').slice(0, 24))
      : (mode === 'reject') ? '御前·驳否'
      : (mode === 'defer') ? '御前·留待再议'
      : ('御前·圣裁：' + String(customText || line).slice(0, 40));
    _cy_jishiAdd('yuqian', CY._yq2.topic, '皇帝', '决：' + line, { final: true, secret: false, outcome: _yqOutcome });
  } else {
    // 不录：单独存 GM._secretMeetings
    if (!GM._secretMeetings) GM._secretMeetings = [];
    GM._secretMeetings.push({
      turn: GM.turn, topic: CY._yq2.topic, advisors: CY._yq2.advisors,
      opinions: CY._yq2.opinions, decision: CY._yq2.decision,
      leaked: false
    });
  }

  // ★ 御前决断 → 后续推演对接（按议题类型区分明诏/密谋）
  if (mode !== 'reject' && mode !== 'defer') {
    var decisionLine = mode === 'approve' ? ('准行此事：' + CY._yq2.topic) : customText;
    // 敏感议题（诛戮/密谋）走 activeSchemes（暗中推进）
    var _isSecretAction = (CY._yq2.topicType === 'execution' || CY._yq2.topicType === 'plot' || CY._yq2.record === 'secret');
    if (_isSecretAction) {
      if (!GM.activeSchemes) GM.activeSchemes = [];
      GM.activeSchemes.push({
        schemer: (P.playerInfo && P.playerInfo.characterName) || '皇帝',
        target: '',
        plan: '【御前密议决】' + CY._yq2.topic + '——' + decisionLine,
        progress: '酝酿中',
        allies: CY._yq2.advisors.join('、'),
        startTurn: GM.turn,
        lastTurn: GM.turn,
        source: 'yuqian2',
        secret: CY._yq2.record === 'secret'
      });
      addEB('密谋', '【御前】' + CY._yq2.topic + '——暗中推进');
    } else {
      // 公开议题 → 诏令
      if (!GM._edictTracker) GM._edictTracker = [];
      var ytLbl = { execution:'诛戮',succession:'立储',military:'军机',removal:'罢相',palace:'宫禁',appointment:'人事',plot:'密谋',other:'' }[CY._yq2.topicType] || '';
      GM._edictTracker.push({
        id: (typeof uid === 'function' ? uid() : 'yq_' + Date.now()),
        content: '御前议决：' + CY._yq2.topic + '——' + decisionLine,
        category: '御前诏令' + (ytLbl?'·'+ytLbl:''),
        turn: GM.turn,
        status: 'pending',
        assignee: CY._yq2.advisors[0] || '',
        feedback: '',
        progressPercent: 0,
        source: 'yuqian2',
        topicType: CY._yq2.topicType,
        secretOrigin: CY._yq2.record === 'secret'
      });
      addEB('御前', CY._yq2.topic + '：' + decisionLine);
    }
  }

  // 给心腹写入机密记忆
  if (typeof NpcMemorySystem !== 'undefined') {
    CY._yq2.advisors.forEach(function(nm) {
      NpcMemorySystem.remember(nm, '【机密】御前议「' + CY._yq2.topic.slice(0,15) + '」——决:' + line.slice(0,30), '重', 8);
    });
  }

  // 泄密判定
  setTimeout(function(){ _yq2_evaluateLeak(); }, 500);
}

async function _yq2_evaluateLeak() {
  var advisors = CY._yq2.advisors;
  if (!advisors.length) return _yq2_finalEnd();
  // 计算平均坦白度（反向——坦白度低者其实更可能揣摩圣意而非坦白，但坦白度高也意味他说得更真，更可能激动泄密）
  // 更准确：按忠诚+deceit判定
  var totalRisk = 0;
  advisors.forEach(function(nm) {
    var ch = findCharByName(nm);
    if (!ch) return;
    var tids = (ch.traits||[]).concat(ch.traitIds||[]);
    var risk = Math.max(0, 100 - (ch.loyalty||50));
    if (tids.indexOf('deceitful') >= 0) risk += 15;
    if (tids.indexOf('gregarious') >= 0) risk += 10; // 话多
    if ((ch.ambition||40) > 70) risk += 10;
    if ((ch.stress||0) > 70) risk += 5;
    totalRisk += risk;
  });
  var avgRisk = totalRisk / advisors.length;
  var leakProb = (avgRisk / 100) * (CY._yq2.record === 'secret' ? 0.5 : 1.2); // 不录反而减小（大家自觉保密）
  // 玩家可以看到的风险提示
  var riskLevel = avgRisk > 60 ? '高' : avgRisk > 35 ? '中' : '低';
  addCYBubble('内侍', '（密议既散。' + (CY._yq2.record === 'secret' ? '不录起居注。' : '已录入起居注。') + ' 泄密风险：' + riskLevel + '。）', true);
  CY._yq2.leakRisk = avgRisk;

  var actuallyLeaks = Math.random() < (leakProb * 0.4); // 实际泄密概率较低
  if (actuallyLeaks && P.ai && P.ai.key) {
    // AI 决定谁泄密、怎么泄
    var prompt = '御前密议结束。议题：' + CY._yq2.topic + '\n';
    prompt += '与会者：' + advisors.join('、') + '\n';
    prompt += '议事结论：' + (CY._yq2.decision && (CY._yq2.decision.mode||'') + (CY._yq2.decision.custom||'')) + '\n';
    prompt += '判定：此次议事已发生泄密。选一人作为泄密者（最可能的），描述泄密方式与严重程度。\n';
    prompt += '返回 JSON：{"leaker":"人名","channel":"枕边风/门生告密/酒后失言/密书外传","severity":"light轻/moderate中/severe重","knownTo":["外界得知者"],"consequence":"后续影响"}';
    try {
      var raw = await callAI(prompt, 500);
      var obj = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
      if (obj && obj.leaker) {
        addCYBubble('内侍', '（机密外泄——' + obj.leaker + ' 经 ' + obj.channel + ' 传出。）', true);
        if (typeof addEB === 'function') addEB('机密', '御前密议外泄：' + obj.leaker);
        // 若之前密议选择"不录"，此时反而入纪事（丑闻）
        if (CY._yq2.record === 'secret') {
          _cy_jishiAdd('yuqian', CY._yq2.topic, obj.leaker, '【泄密】' + (obj.channel||'') + '：' + (obj.consequence||''), { secret: true, leaked: true });
        }
        if (typeof NpcMemorySystem !== 'undefined' && Array.isArray(obj.knownTo)) {
          obj.knownTo.forEach(function(n){
            NpcMemorySystem.remember(n, '获悉御前密议「' + CY._yq2.topic.slice(0,15) + '」内情', '重', 7);
          });
        }
      }
    } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-chaoyi-keju');}catch(_){}}
  }

  setTimeout(_yq2_finalEnd, 800);
}

function _yq2_finalEnd() {
  var footer = _$('cy-footer');
  footer.innerHTML = '<div style="text-align:center;"><button class="bt bp" onclick="_yq2_doCloseSession()">退</button></div>';
}

function _yq2_doCloseSession() {
  CY._yq2 = null;
  if (typeof closeChaoyi === 'function') closeChaoyi();
}

function _yq2_globalFooter() {
  return '<div style="margin-top:var(--space-2);padding-top:var(--space-2);border-top:1px solid var(--color-border-subtle);display:flex;gap:3px;justify-content:center;flex-wrap:wrap;">'
    + _cy_suggestBtnHtml('御前会议')
    + '</div>';
}

// ════ 2026-06 faithful landing·御前密室版式（左烛火立绘+坦白度条 / 右心腹列+密谈+决断·对齐 preview/yuqian-preview.html） ════
// 渲染后 DOM 重排（保留全部 id/handler）+ scoped CSS（styles.css #chaoyi-modal.cy-mode-yuqian）
function _yq2_makeDiv(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild || d; }

// 皇帝气泡（右对齐·朱金·朕印·对齐预览 msg.emp）
function _yq2_emp(text) {
  var d = addCYBubble('皇帝', text, false);
  if (d) {
    d.classList.add('yq-emp');
    var av = d.firstElementChild;
    if (av && av.tagName !== 'IMG') av.textContent = '朕';
  }
  return d;
}

// 给臣气泡 name 行加坦白度标签（推心置腹青/大致坦言金/揣摩圣意灰·对齐预览 msg-name .cand）
function _yq2_tagBubbleCandor(div, level) {
  if (!div || !level) return;
  var cls = level === '推心置腹' ? 'high' : level === '大致坦言' ? 'mid' : 'low';
  try {
    var nmDiv = div.querySelector('div:last-child > div:first-child');
    if (nmDiv && !nmDiv.querySelector('.yq-cand-sp')) {
      var sp = document.createElement('span');
      sp.className = 'yq-cand-sp ' + cls;
      sp.textContent = level;
      nmDiv.appendChild(sp);
    }
  } catch (_e) {}
}

function _yq2_relayout() {
  var modal = document.getElementById('chaoyi-modal');
  if (!modal) return;
  modal.classList.add('cy-mode-yuqian');
  if (document.getElementById('yq-actor')) return;
  var frame = modal.firstElementChild;
  var body = document.getElementById('cy-body');
  if (!frame || !body) return;
  var topic = document.getElementById('cy-topic');
  var inputRow = document.getElementById('cy-input-row');
  var footer = document.getElementById('cy-footer');
  var header = frame.firstElementChild;
  // 左·当前深言者立绘（烛火密室）
  var actor = document.createElement('div'); actor.id = 'yq-actor'; actor.className = 'yq-actor';
  actor.innerHTML = '<div class="yq-actor-stage"><img class="yq-portrait" id="yq-portrait" alt="" style="display:none">'
    + '<div class="yq-actor-vig"></div><span class="yq-candle"></span>'
    + '<span class="yq-actor-tag" id="yq-actor-tag">屏退宫人</span></div>'
    + '<div class="yq-actor-plate"><div><span class="yq-actor-nm" id="yq-actor-nm">御前会议</span><span class="yq-candor-pill" id="yq-candor-pill"></span></div>'
    + '<div class="yq-actor-sub" id="yq-actor-sub">密召心腹 · 坦言直陈 · 可不录</div>'
    + '<div class="yq-candor-meter" id="yq-candor-meter" style="display:none"><div class="yq-cm-l">坦白度 <b id="yq-cm-val"></b></div><div class="yq-cm-bar"><div class="yq-cm-fill" id="yq-cm-fill"></div></div></div>'
    + '<div class="yq-acts">'
    +   '<button class="yq-bt key" onclick="if(typeof _yq2_pickAdvisor===\'function\')_yq2_pickAdvisor()">单独深言</button>'
    +   '<button class="yq-bt" onclick="if(typeof _yq2_startRoundQuery===\'function\')_yq2_startRoundQuery()">令众直陈</button>'
    +   '<button class="yq-bt" onclick="var i=document.getElementById(\'cy-player-input\');if(i)i.focus()">屏退此人</button>'
    +   '<button class="yq-bt key" onclick="if(typeof _yq2_enterDecide===\'function\')_yq2_enterDecide()">入决断 ▾</button>'
    + '</div></div>';
  var main = document.createElement('div'); main.className = 'yq-main';
  var row = document.createElement('div'); row.className = 'yq-row';
  [topic, body, inputRow, footer].forEach(function(el) { if (el) main.appendChild(el); });
  row.appendChild(actor); row.appendChild(main);
  if (header && header.nextSibling) frame.insertBefore(row, header.nextSibling);
  else frame.appendChild(row);
  // 顶栏：密印 + 御前会议
  var label = document.getElementById('cy-mode-label');
  if (label) label.innerHTML = '<span class="yq-seal">密</span><span class="yq-htitle">御前会议</span>';
  var ttypeLbl = { execution:'🗡️ 诛戮',succession:'👑 托孤废立',military:'🎯 军机',removal:'🎭 罢相',palace:'🏯 宫禁',appointment:'💼 人事',plot:'🕵️ 密谋',other:'❓ 其他' }[CY._yq2 && CY._yq2.topicType] || '';
  var rtag = document.getElementById('cy-round-tag');
  if (rtag) { rtag.style.display = 'inline-block'; rtag.innerHTML = (ttypeLbl ? '<span class="yq-ttype">' + ttypeLbl + '</span>' : '') + (CY._yq2 && CY._yq2.record === 'secret' ? '<span class="yq-norec">🤐 不录</span>' : ''); }
  if (topic && CY._yq2 && CY._yq2.topic) topic.innerHTML = '<span class="yq-topic-lab">机密</span> · <b>' + escHtml(CY._yq2.topic) + '</b>';
}

// 心腹列（真头像 + 坦白度档 + 忠值 + 排斥重臣 + 泄密风险估算）
function _yq2_renderInner() {
  var body = _$('cy-body');
  if (!body || !CY._yq2) return;
  var old = document.getElementById('yq2-inner-board'); if (old) old.remove();
  var advisors = CY._yq2.advisors || [];
  var cmap = CY._yq2.candorMap || {};
  var html = '<div id="yq2-inner-board" class="yq-inner">';
  html += '<div class="yq-inner-h"><span class="yq-it">召入心腹</span><span class="yq-isub">' + advisors.length + ' 员 · 忠诚+品级择 · 至多 8</span>';
  html += '<span class="yq-rec ' + (CY._yq2.record === 'secret' ? 'secret' : 'keep') + '">' + (CY._yq2.record === 'secret' ? '🤐 密议不录' : '📜 记起居注') + '</span></div>';
  html += '<div class="yq-confidants">';
  advisors.forEach(function(nm) {
    var ch = (typeof findCharByName === 'function' ? findCharByName(nm) : null) || {};
    var cd = (cmap[nm] && cmap[nm].candor != null) ? cmap[nm].candor : 60;
    var lvl = (cmap[nm] && cmap[nm].level) || '';
    var cls = cd > 80 ? 'high' : cd > 50 ? 'mid' : 'low';
    var pic = ch.portrait
      ? '<img src="' + escHtml(ch.portrait) + '" loading="lazy" onerror="this.style.display=\'none\'">'
      : '<span class="yq-cf-ph">' + escHtml(String(nm).charAt(0)) + '</span>';
    html += '<div class="yq-cf ' + cls + '" data-name="' + escHtml(nm) + '" onclick="_yq2_setSpeaker(\'' + escHtml(nm).replace(/'/g, "\\'") + '\')">'
      + '<div class="yq-cff">' + pic + '</div><div class="yq-cfn">' + escHtml(nm) + '</div>'
      + '<div class="yq-cfc">' + escHtml(lvl) + ' · 忠' + Math.round(ch.loyalty || 50) + '</div></div>';
  });
  html += '</div>';
  var excl = CY._yq2.excluded || [];
  var leakSum = 0; advisors.forEach(function(nm) { var ch = findCharByName(nm); if (ch) leakSum += Math.max(0, 100 - (ch.loyalty || 50)); });
  var leakAvg = advisors.length ? Math.round(leakSum / advisors.length) : 0;
  var leakLvl = leakAvg > 60 ? '高' : leakAvg > 35 ? '中' : '低';
  html += '<div class="yq-excluded">';
  if (excl.length) html += '屏退在外 · 未召之重臣：' + excl.slice(0, 6).map(function(n) { return '<b>' + escHtml(n) + '</b>'; }).join('、') + ' <span class="pen">（心有芥蒂 · 忠 -3）</span>';
  else html += '<span class="yq-ex-none">（无够格而未召之重臣）</span>';
  html += '<span class="yq-leak">泄密风险 <i class="yq-leak-bar"><em style="width:' + leakAvg + '%"></em></i> <b>' + leakLvl + '</b></span>';
  html += '</div></div>';
  if (body.firstChild) body.insertBefore(_yq2_makeDiv(html), body.firstChild);
  else body.innerHTML = html;
}

// 当前深言者立绘随发言切换（谁深言则谁立绘 + 坦白度条联动 + 心腹卡高亮）
function _yq2_setSpeaker(name) {
  if (!name || !CY._yq2) return;
  var ch = (typeof findCharByName === 'function' ? findCharByName(name) : null) || {};
  var cm = (CY._yq2.candorMap && CY._yq2.candorMap[name]) || {};
  var cd = cm.candor != null ? Math.round(cm.candor) : 60;
  var lvl = cm.level || (cd > 80 ? '推心置腹' : cd > 50 ? '大致坦言' : '揣摩圣意');
  var cls = cd > 80 ? 'high' : cd > 50 ? 'mid' : 'low';
  var img = document.getElementById('yq-portrait');
  if (img) { if (ch.portrait) { img.src = ch.portrait; img.style.display = ''; } else { img.removeAttribute('src'); img.style.display = 'none'; } img.alt = name; }
  var tag = document.getElementById('yq-actor-tag'); if (tag) tag.textContent = '深言 · ' + name;
  var nm = document.getElementById('yq-actor-nm'); if (nm) nm.textContent = name;
  var sub = document.getElementById('yq-actor-sub');
  if (sub) sub.textContent = (ch.officialTitle || ch.title || '心腹') + (ch.party ? ' · ' + ch.party : '') + ' · 忠' + Math.round(ch.loyalty || 50);
  var pill = document.getElementById('yq-candor-pill'); if (pill) { pill.textContent = lvl; pill.className = 'yq-candor-pill ' + cls; }
  var meter = document.getElementById('yq-candor-meter'); if (meter) meter.style.display = '';
  var val = document.getElementById('yq-cm-val'); if (val) val.textContent = cd + ' · ' + lvl;
  var fill = document.getElementById('yq-cm-fill'); if (fill) { fill.style.width = cd + '%'; fill.className = 'yq-cm-fill ' + cls; }
  Array.prototype.forEach.call(document.querySelectorAll('#chaoyi-modal .yq-cf'), function(el) {
    el.classList.toggle('on', el.getAttribute('data-name') === name);
  });
}
if (typeof window !== 'undefined') { window._yq2_setSpeaker = _yq2_setSpeaker; window._yq2_relayout = _yq2_relayout; window._yq2_renderInner = _yq2_renderInner; window._yq2_emp = _yq2_emp; window._yq2_tagBubbleCandor = _yq2_tagBubbleCandor; }

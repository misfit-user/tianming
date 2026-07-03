// @ts-check
/// <reference path="types.d.ts" />
/*
 * tm-faction-npc-memorial.js — NPC 奏疏系统 (Phase C1·2026-05-10)
 *
 * Player faction 用 GM.memorials (现有 tm-memorials.js)·收到所有 NPC 上奏·player 批决。
 * 本模块为 NPC faction 提供对称的 memorial 系统:
 *   - NPC 朝臣对自家 ruler 上奏 (不入 GM.memorials·入 fac.npcMemorials[])
 *   - NPC ruler 同回合自动批决 (按 ruler 倾向·派系 alignment·势力 health)
 *   - 影响上奏 char 的 _memorialMemory[] (后续 AI 推演读)
 *   - player 可 read-only inspect (Phase C6 UI)
 *
 * Schema (fac.npcMemorials[i]):
 *   {
 *     id: 'npcm_<turn>_<n>',
 *     from: 'char name',
 *     fromRole: 'court/general/clan',
 *     to: 'ruler name',
 *     type: '政务/军务/民生/经济/人事/密奏',
 *     subtype: '题本/上疏/密折',
 *     content: 'short summary (template·非 LLM)',
 *     status: 'pending' → 'approved/rejected/annotated/referred',
 *     ruling: 'ruler 决定文字',
 *     turn: GM.turn,
 *     resolvedTurn: GM.turn,
 *     impact: { loyaltyDelta, memoryNote }
 *   }
 *
 * 每回合 endturn: generateNpcMemorials() → resolveNpcMemorials()·两步连贯
 * 不调用 LLM·按 paradigm + ruler 倾向 + char attributes 模板生成·~ms 级 (千势力可 scale)
 */
(function(global) {
  'use strict';

  function _safeNum(v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; }
  function _arr(v) { return Array.isArray(v) ? v : []; }
  function _normFactionName(v) { return String(v == null ? '' : v).replace(/\s+/g, '').trim(); }
  function _isMarkedPlayerFaction(f) {
    return !!(f && (f.isPlayer || f.playerControlled || f.controlledBy === 'player' || f.controller === 'player' || f.controlType === 'player'));
  }
  function _resolvePlayerFactionNames() {
    var G = global.GM || {};
    var P0 = global.P || {};
    var names = [];
    function push(v) {
      var s = String(v == null ? '' : v).trim();
      var k = _normFactionName(s);
      if (s && names.map(_normFactionName).indexOf(k) < 0) names.push(s);
    }
    var pi = P0.playerInfo || {};
    push(pi.factionName);
    push(P0.playerFactionName);
    push(P0.playerFaction);
    push(G.playerFactionName);
    push(G.playerFaction);
    if (G.playerInfo) push(G.playerInfo.factionName);
    _arr(G.facs).forEach(function(f){ if (_isMarkedPlayerFaction(f)) push(f.name); });
    _arr(G.chars).forEach(function(c){ if (c && (c.isPlayer || c.playerControlled || c.controlledBy === 'player')) push(c.faction || c.factionName || c.ownerFaction); });
    return names;
  }
  function _isPlayerFaction(f, playerFactionNames) {
    if (!f) return false;
    if (_isMarkedPlayerFaction(f)) return true;
    var k = _normFactionName(f.name);
    return !!k && _arr(playerFactionNames).some(function(n){ return _normFactionName(n) === k; });
  }
  function _isAlive(c) {
    if (!c) return false;
    if (c.alive === false) return false;
    if (c.dead === true) return false;
    return true;
  }
  function _classifyChar(c) {
    if (!c) return 'other';
    var s = String(c.position || c.role || c.title || '');
    // ruler·含游牧/朝贡王/海商首领/欧洲总督/土司
    if (s.indexOf('君主') >= 0 || s.indexOf('皇帝') >= 0 || s.indexOf('国王') >= 0
        || s.indexOf('首领') >= 0 || s.indexOf('可汗') >= 0 || s.indexOf('汗') >= 0
        || s.indexOf('总督') >= 0 || s.indexOf('土司') >= 0
        || s.indexOf('海商首领') >= 0 || s.indexOf('节度使') >= 0) return 'ruler';
    // clan·宗室·游牧贵族·土司族老
    if (s.indexOf('宗室') >= 0 || s.indexOf('亲王') >= 0 || s.indexOf('郡王') >= 0
        || s.indexOf('公主') >= 0 || s.indexOf('贝勒') >= 0
        || s.indexOf('台吉') >= 0 || s.indexOf('族老') >= 0
        || s.indexOf('那颜') >= 0 || s.indexOf('部落贵族') >= 0
        || s.indexOf('头人') >= 0 || s.indexOf('大君') >= 0) return 'clan';
    // general·武将
    if (s.indexOf('总兵') >= 0 || s.indexOf('都督') >= 0 || s.indexOf('参将') >= 0
        || s.indexOf('副将') >= 0 || s.indexOf('提督') >= 0 || s.indexOf('守备') >= 0
        || s.indexOf('游击') >= 0 || s.indexOf('经略') >= 0
        || s.indexOf('大将') >= 0 || s.indexOf('裨将') >= 0
        || s.indexOf('舰队司令') >= 0 || s.indexOf('副帅') >= 0 || s.indexOf('舵手') >= 0
        || s.indexOf('武臣') >= 0 || s.indexOf('都体察使') >= 0 || s.indexOf('都统制') >= 0
        || s.indexOf('旗主总兵') >= 0 || s.indexOf('亲将') >= 0
        || (typeof c.military === 'number' && c.military >= 70 && (c.valor || 0) >= 60)) return 'general';
    // court·朝臣·议政
    if (s.indexOf('尚书') >= 0 || s.indexOf('侍郎') >= 0 || s.indexOf('大学士') >= 0
        || s.indexOf('御史') >= 0 || s.indexOf('给事中') >= 0 || s.indexOf('翰林') >= 0
        || s.indexOf('阁') >= 0 || s.indexOf('卿') >= 0 || s.indexOf('监') >= 0
        || s.indexOf('大臣') >= 0 || s.indexOf('议政') >= 0 || s.indexOf('参议') >= 0
        || s.indexOf('主教') >= 0 || s.indexOf('教士') >= 0 || s.indexOf('帐房') >= 0
        || s.indexOf('军师') >= 0 || s.indexOf('近臣') >= 0
        || s.indexOf('领议政') >= 0 || s.indexOf('判书') >= 0
        || s.indexOf('商团长') >= 0 || s.indexOf('法庭裁判') >= 0) return 'court';
    return 'other';
  }

  // 按 char role + 势力健康 + char personality → memorial type 偏好
  function _pickType(role, fac, char) {
    var dh = fac.derivedHealth || null;
    var de = fac.derivedEconomy || null;
    var pool = [];
    if (role === 'general') {
      pool.push('军务'); pool.push('军务');
      if (dh && dh.militaryStability < 50) pool.push('军务');
      pool.push('密奏');
    } else if (role === 'court') {
      pool.push('政务'); pool.push('民生'); pool.push('人事');
      if (de && de.fiscalStress > 40) pool.push('经济');
      if (dh && dh.courtCohesion < 60) pool.push('政务');
    } else if (role === 'clan') {
      pool.push('政务'); pool.push('密奏');
    } else {
      pool.push('政务');
    }
    // Phase F1·char personality 调 type pool·suspicion 高 → 多密奏·aggressiveness 高 → 多军务/人事
    if (char && global.TM && global.TM.FactionPersonality && global.TM.FactionPersonality.hintsFor) {
      var h = global.TM.FactionPersonality.hintsFor(char);
      if (h.suspicion > 0.65) { pool.push('密奏'); pool.push('密奏'); }
      if (h.aggressiveness > 0.65) { pool.push('军务'); pool.push('人事'); }
      if (h.generosity > 0.65) { pool.push('民生'); }
      if (h.conservatism > 0.65) { pool.push('政务'); }
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // 按 type + paradigm + 势力状态 → 模板内容
  // 不调 LLM·写实例 templates·后续可 LLM enrich
  function _genContent(type, char, fac) {
    var dh = fac.derivedHealth || {};
    var de = fac.derivedEconomy || {};
    var charName = char.name || '臣';
    var loy = _safeNum(char.loyalty);
    var party = char.party || '';

    var TEMPLATES = {
      军务: [
        '臣' + charName + '谨奏：边军欠饷已逾' + (de._source && de._source.arrearsRatio ? Math.round(de._source.arrearsRatio * 6) : 3) + '月·将士怨怼·宜速发库银压之。',
        '臣' + charName + '谨奏：私兵化盛行·恐成藩镇之患·请陛下整军权·收将领家丁入伍。',
        '臣' + charName + '谨奏：边塞探得敌情·宜整旅备战·切勿轻进。'
      ],
      政务: [
        '臣' + charName + '谨奏：朝堂' + (party ? party + '与诸党争' : '诸党争') + '愈烈·宜息党争·以振朝纲。',
        '臣' + charName + '谨奏：法度松弛·宜申严治·察奸佞·进忠良。',
        '臣' + charName + '谨奏：诏令推行不力·州府推诿·乞速察问·明典定罚。'
      ],
      民生: [
        '臣' + charName + '谨奏：地方饥馑·州县已开仓赈·然漕运迟·乞速运河南粮入北以济民。',
        '臣' + charName + '谨奏：流民日众·宜安插耕作·勿令啸聚成乱。',
        '臣' + charName + '谨奏：水旱见频·星象有异·乞陛下修德省刑·以应天意。'
      ],
      经济: [
        '臣' + charName + '谨奏：太仓存银告竭·军费无从出·乞议加派或开矿税。',
        '臣' + charName + '谨奏：辽饷已加·民困不堪·宜罢之·改取勋戚田·杜投献。',
        '臣' + charName + '谨奏：商税征解不力·胥吏中饱·乞清查·补国库。'
      ],
      人事: [
        '臣' + charName + '谨奏：保举' + (party || '同籍') + (party ? '党人' : '良吏') + '某·清慎勤·堪大用·乞陛下擢之。',
        '臣' + charName + '谨奏：参劾某官·' + (loy < 40 ? '阴蓄异志·' : '渎职贪墨·') + '宜罢之。',
        '臣' + charName + '谨奏：外放某员·实贬也·乞陛下察察·勿伤忠良。'
      ],
      密奏: [
        '臣' + charName + '密奏：闻某将与外通·情形可疑·乞陛下密访·勿张扬。',
        '臣' + charName + '密奏：内廷有人构陷臣等·乞陛下察之·以保社稷。',
        '臣' + charName + '密奏：某事关重大·非奏所能尽·乞陛下召对面陈。'
      ]
    };
    var arr = TEMPLATES[type] || TEMPLATES['政务'];
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ruler 决定·按 ruler 与 char 党派关系·char loyalty·势力状态·ruler personality (F1)
  function _rulerDecide(ruler, mem, char, fac) {
    var rulerParty = (ruler && ruler.party) || '';
    var charParty = char.party || '';
    var sameParty = rulerParty && rulerParty === charParty;
    var charLoy = _safeNum(char.loyalty);
    var dh = fac.derivedHealth || {};
    var de = fac.derivedEconomy || {};

    var approveScore = 0;
    if (sameParty) approveScore += 30;
    if (charLoy >= 70) approveScore += 20;
    else if (charLoy < 40) approveScore -= 20;
    if (mem.type === '军务' && dh.militaryStability < 40) approveScore += 15;
    if (mem.type === '经济' && de.fiscalStress > 50) approveScore += 15;
    if (mem.type === '人事' && rulerParty && !sameParty) approveScore -= 25;

    // Phase F1·ruler personality 调权
    if (ruler && global.TM && global.TM.FactionPersonality && global.TM.FactionPersonality.hintsFor) {
      var rh = global.TM.FactionPersonality.hintsFor(ruler);
      // suspicion 高 → 总倾向驳/留中
      approveScore -= Math.round((rh.suspicion - 0.5) * 30);
      // generosity 高 → 倾向准
      approveScore += Math.round((rh.generosity - 0.5) * 25);
      // aggressiveness 高 + 军务 → 准·愿意打
      if (mem.type === '军务') approveScore += Math.round((rh.aggressiveness - 0.5) * 20);
      // conservatism 高 + 政务/人事 → 倾向留中
      if ((mem.type === '政务' || mem.type === '人事') && rh.conservatism > 0.6) approveScore -= 15;
    }

    approveScore += Math.floor(Math.random() * 30) - 15;

    var status, ruling, loyaltyDelta, memoryNote;
    if (approveScore >= 30) {
      status = 'approved';
      ruling = '准奏·' + (sameParty ? '卿言可采。' : '事关紧要·依议行之。');
      loyaltyDelta = 2;
      memoryNote = mem.turn + ': ' + mem.type + '·准奏';
    } else if (approveScore <= -10) {
      status = 'rejected';
      ruling = '不允·' + (sameParty ? '此议尚需斟酌。' : '所言不实·驳还。');
      loyaltyDelta = -3;
      memoryNote = mem.turn + ': ' + mem.type + '·驳回';
    } else if (mem.type === '密奏' || mem.type === '人事') {
      status = 'annotated';
      ruling = '览·留中再议。';
      loyaltyDelta = 0;
      memoryNote = mem.turn + ': ' + mem.type + '·留中';
    } else {
      status = 'referred';
      ruling = '交' + (mem.type === '军务' ? '兵部' : (mem.type === '经济' ? '户部' : '内阁')) + '议处。';
      loyaltyDelta = 0;
      memoryNote = mem.turn + ': ' + mem.type + '·批转';
    }
    return { status: status, ruling: ruling, loyaltyDelta: loyaltyDelta, memoryNote: memoryNote };
  }

  function _ensureMemoryArray(char) {
    if (!Array.isArray(char._memorialMemory)) char._memorialMemory = [];
  }

  // 生成 + 立即 resolve (一回合一轮·NPC 不积压)
  function generateNpcMemorials() {
    if (typeof global.GM === 'undefined') return null;
    var GM = global.GM;
    if (!Array.isArray(GM.facs)) return null;
    var turn = _safeNum(GM.turn) || 1;
    var playerFacNames = _resolvePlayerFactionNames();

    var totalGenerated = 0;
    GM.facs.forEach(function(fac) {
      if (!fac || !fac.name) return;
      if (_isPlayerFaction(fac, playerFacNames)) return;  // skip player·走现有 GM.memorials
      var entry = GM._facIndex && GM._facIndex[fac.name];
      if (!entry) return;
      var alive = (entry.chars || []).filter(_isAlive);
      if (alive.length === 0) return;

      // 找 ruler (charByRole.ruler·若多个取第一个)
      var ruler = alive.find(function(c){ return _classifyChar(c) === 'ruler'; });
      if (!ruler) ruler = alive[0];  // fallback

      // 候选上奏者·非 ruler 的 court/general/clan·loyalty < 95 (满忠不上奏·防 noise)
      var candidates = alive.filter(function(c){
        if (c === ruler) return false;
        // 受限者不上奏(玩家报:已下狱/罢官者仍上奏)·下狱/流放/逃亡/致仕/失踪
        if (c._imprisoned || c.imprisoned || c._inPrison || c._exiled || c.exiled ||
            c._banished || c._fled || c.fled || c._missing || c._retired || c.retired) return false;
        var role = _classifyChar(c);
        return role === 'court' || role === 'general' || role === 'clan';
      });

      // 每回合数量: max(1, min(3, candidates 数 / 4))
      var n = Math.max(1, Math.min(3, Math.floor(candidates.length / 4)));
      if (candidates.length === 0) return;

      // shuffle + take n
      candidates = candidates.slice().sort(function(){ return Math.random() - 0.5; }).slice(0, n);

      if (!Array.isArray(fac.npcMemorials)) fac.npcMemorials = [];
      // 限存量·只保留 last 30
      if (fac.npcMemorials.length > 30) {
        fac.npcMemorials = fac.npcMemorials.slice(-30);
      }

      candidates.forEach(function(char, idx) {
        var role = _classifyChar(char);
        var type = _pickType(role, fac, char);  // F1·传 char 让 personality 影响
        var content = _genContent(type, char, fac);
        var mem = {
          id: 'npcm_' + turn + '_' + fac.name + '_' + idx,
          from: char.name,
          fromRole: role,
          to: ruler.name,
          type: type,
          subtype: type === '密奏' ? '密折' : (role === 'general' ? '题本' : '上疏'),
          content: content,
          status: 'pending',
          turn: turn
        };
        // 立即 resolve
        var dec = _rulerDecide(ruler, mem, char, fac);
        mem.status = dec.status;
        mem.ruling = dec.ruling;
        mem.resolvedTurn = turn;
        mem.impact = { loyaltyDelta: dec.loyaltyDelta, memoryNote: dec.memoryNote };

        // 副作用·char loyalty + 记忆
        char.loyalty = Math.max(0, Math.min(100, _safeNum(char.loyalty) + dec.loyaltyDelta));
        _ensureMemoryArray(char);
        char._memorialMemory.push(dec.memoryNote);
        if (char._memorialMemory.length > 10) char._memorialMemory = char._memorialMemory.slice(-10);

        fac.npcMemorials.push(mem);
        if (global.TM && global.TM.FactionActionEngine && typeof global.TM.FactionActionEngine.recordLocalAction === 'function') {
          try {
            global.TM.FactionActionEngine.recordLocalAction(fac, 'memorial', {
              from: mem.from,
              type: mem.type,
              content: mem.content,
              rulerDecision: mem.status,
              loyaltyDelta: dec.loyaltyDelta
            }, mem);
          } catch(_){}
        }
        // Phase H2·重要事件入近事快报
        if (global.TM && global.TM.FactionNpcNewsBridge) {
          try { global.TM.FactionNpcNewsBridge.pushMemorial(fac, mem); } catch(_){}
        }
        totalGenerated++;
      });
    });
    return { generated: totalGenerated };
  }

  // alias·若用户想分两 step·resolveNpcMemorials 现在 noop (因 generate 内立即 resolve)
  // 留 API 给将来"NPC ruler 决策延迟"留口
  function resolveNpcMemorials() {
    return { resolved: 0 };
  }

  function getNpcMemorialsFor(facName) {
    if (typeof global.GM === 'undefined') return [];
    if (!Array.isArray(global.GM.facs)) return [];
    var f = global.GM.facs.find(function(x){ return x && x.name === facName; });
    return (f && Array.isArray(f.npcMemorials)) ? f.npcMemorials.slice() : [];
  }

  global.TM = global.TM || {};
  global.TM.FactionNpcMemorial = {
    generate: generateNpcMemorials,
    resolve: resolveNpcMemorials,
    getFor: getNpcMemorialsFor,
    _classifyChar: _classifyChar,
    _pickType: _pickType,
    _rulerDecide: _rulerDecide,
    _genContent: _genContent
  };
})(typeof window !== 'undefined' ? window : globalThis);

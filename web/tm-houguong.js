// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-houguong.js — 后宫子系统 (2026-05-28)
//
// 在天命主线中嵌入"后宫·嫔御"模块：位分体系、宠爱度、子嗣、出身家族
// 与外戚联动、回合事件（召幸/有孕/诞育/晋位/失宠/薨）。
//
// 不改动主游戏其他模块；通过 monkey-patch _launchPostTurnJobs 注册
// 一个 'harem' post-turn job，并提供 TM.hougong.renderPanel(gl) 给
// tm-shell-extras.js 调用。
//
// 数据结构 (挂在 GM.harem)：
//   consorts: [{name, rank, age, favor, family, enteredTurn, lastFavoredTurn,
//               pregnant, pregnantSince, children:[], childCount, status, bio}]
//   heirs: [...]          (已存在，子嗣登记)
//   pregnancies: [...]    (已存在，怀孕跟踪)
//   tianxing: { turn, name }  最近一次召幸
//
// 加载顺序：在 tm-shell-extras.js 之后即可（runtime 才用）
// ============================================================

(function(){
  'use strict';
  if (typeof window === 'undefined') return;
  if (!window.TM) window.TM = {};
  if (window.TM.hougong) return;  // 防重复加载

  // ─── 位分体系（清制为主，兼容明制）─────────────────────
  // 由低到高，数值越大越尊
  var RANKS = [
    { key: 'daying',     name: '答应',   tier: 1, maxSlots: Infinity, color: '#9aa6b2' },
    { key: 'changzai',   name: '常在',   tier: 2, maxSlots: Infinity, color: '#b8c4d0' },
    { key: 'guiren',     name: '贵人',   tier: 3, maxSlots: 6,        color: '#cabb8a' },
    { key: 'pin',        name: '嫔',     tier: 4, maxSlots: 6,        color: '#c9a045' },
    { key: 'fei',        name: '妃',     tier: 5, maxSlots: 4,        color: '#b87a3e' },
    { key: 'guifei',     name: '贵妃',   tier: 6, maxSlots: 2,        color: '#a8553a' },
    { key: 'huangguifei',name: '皇贵妃', tier: 7, maxSlots: 1,        color: '#8b3b2a' },
    { key: 'empress',    name: '皇后',   tier: 8, maxSlots: 1,        color: '#c83737' }
  ];

  function rankByName(n) {
    if (!n) return RANKS[0];
    for (var i=0; i<RANKS.length; i++) if (RANKS[i].name === n) return RANKS[i];
    return RANKS[0];
  }
  function rankAbove(cur) {
    var c = rankByName(cur);
    for (var i=0; i<RANKS.length; i++) if (RANKS[i].tier === c.tier + 1) return RANKS[i];
    return null;
  }
  function rankBelow(cur) {
    var c = rankByName(cur);
    for (var i=0; i<RANKS.length; i++) if (RANKS[i].tier === c.tier - 1) return RANKS[i];
    return null;
  }
  function countByRank(rankName) {
    if (!window.GM || !GM.harem || !GM.harem.consorts) return 0;
    return GM.harem.consorts.filter(function(c){ return c.rank === rankName && c.status !== '薨' && c.status !== '废黜'; }).length;
  }

  // ─── 姓氏与名字池（用于自动生成）────────────────────────
  var SURNAMES = ['王','李','张','赵','刘','陈','杨','黄','周','吴','徐','孙','胡','朱','高','林','何','郭','马','罗','梁','宋','郑','谢','韩','唐','冯','于','董','萧','程','曹','袁','邓','许','傅','沈','曾','彭','吕'];
  var GIVENS_F = ['婉','静','妙','慧','清','柔','秀','雅','慈','宁','华','玉','瑶','璇','珂','姝','茵','蓁','婷','怡','嫣','瑾','璧','琬','蕙','薇','芸','绮','纨','素'];
  var BG_DESCS = [
    '高门嫡女', '世家旁支', '勋贵之后', '清流名宦女',
    '寒门秀质', '边将之女', '宗室出身', '翰林女',
    '潜邸旧人', '采女入选', '良家子', '内务府选秀'
  ];

  function pick(arr) {
    if (!arr || !arr.length) return null;
    var r = (typeof rng === 'function') ? rng() : Math.random();
    return arr[Math.floor(r * arr.length) % arr.length];
  }
  function randInt(min, max) {
    var r = (typeof rng === 'function') ? rng() : Math.random();
    return Math.floor(r * (max - min + 1)) + min;
  }
  function chance(p) {
    var r = (typeof rng === 'function') ? rng() : Math.random();
    return r < p;
  }

  function genName(takenSet) {
    for (var tries=0; tries<40; tries++) {
      var sn = pick(SURNAMES);
      var gn = pick(GIVENS_F);
      var nm = sn + gn + '氏';
      if (!takenSet[nm]) { takenSet[nm] = 1; return { name: nm, family: sn + '氏', surname: sn }; }
    }
    return { name: '佚名氏' + Date.now().toString().slice(-3), family: '佚氏', surname: '佚' };
  }

  // ─── seed: 在 GM.harem.consorts 为空时初始化 ────────────
  function seed(opts) {
    if (typeof GM === 'undefined' || !GM) return;
    if (!GM.harem) GM.harem = { heirs: [], succession: 'eldest_legitimate', pregnancies: [] };
    if (!Array.isArray(GM.harem.consorts)) GM.harem.consorts = [];
    if (GM.harem.consorts.length > 0 && !(opts && opts.force)) return GM.harem.consorts;

    var taken = {};
    var curTurn = GM.turn || 1;
    var list = [];

    // 皇后 1 人
    var q = genName(taken);
    list.push({
      name: q.name, rank: '皇后',
      age: randInt(22, 34), favor: randInt(55, 80),
      family: q.family, enteredTurn: -randInt(20, 80), lastFavoredTurn: 0,
      pregnant: false, pregnantSince: null,
      children: [], childCount: 0,
      status: '安宁',
      bio: '潜邸正妃·中宫之主'
    });

    // 贵妃 1-2
    var nGuifei = randInt(1, 2);
    for (var i=0; i<nGuifei; i++) {
      var g = genName(taken);
      list.push({
        name: g.name, rank: '贵妃',
        age: randInt(20, 32), favor: randInt(40, 75),
        family: g.family, enteredTurn: -randInt(10, 60), lastFavoredTurn: 0,
        pregnant: false, pregnantSince: null,
        children: [], childCount: 0,
        status: '安宁',
        bio: pick(BG_DESCS)
      });
    }

    // 妃 2-3
    var nFei = randInt(2, 3);
    for (var j=0; j<nFei; j++) {
      var f = genName(taken);
      list.push({
        name: f.name, rank: '妃',
        age: randInt(18, 30), favor: randInt(30, 65),
        family: f.family, enteredTurn: -randInt(5, 50), lastFavoredTurn: 0,
        pregnant: false, pregnantSince: null,
        children: [], childCount: 0,
        status: '安宁',
        bio: pick(BG_DESCS)
      });
    }

    // 嫔 3-5
    var nPin = randInt(3, 5);
    for (var k=0; k<nPin; k++) {
      var p = genName(taken);
      list.push({
        name: p.name, rank: '嫔',
        age: randInt(17, 28), favor: randInt(20, 55),
        family: p.family, enteredTurn: -randInt(1, 30), lastFavoredTurn: 0,
        pregnant: false, pregnantSince: null,
        children: [], childCount: 0,
        status: '安宁',
        bio: pick(BG_DESCS)
      });
    }

    // 贵人/常在/答应 4-7
    var nLow = randInt(4, 7);
    var lowRanks = ['贵人','贵人','常在','常在','答应'];
    for (var m=0; m<nLow; m++) {
      var lw = genName(taken);
      list.push({
        name: lw.name, rank: pick(lowRanks),
        age: randInt(15, 24), favor: randInt(5, 40),
        family: lw.family, enteredTurn: -randInt(0, 10), lastFavoredTurn: 0,
        pregnant: false, pregnantSince: null,
        children: [], childCount: 0,
        status: '安宁',
        bio: pick(BG_DESCS)
      });
    }

    GM.harem.consorts = list;

    // 标记一次 seed，用于诊断
    GM.harem._seededAtTurn = curTurn;
    GM.harem._seededBy = 'tm-houguong';

    return list;
  }

  // ─── 选秀：从外朝补一名嫔妃 ────────────────────────────
  function selectNew(rank) {
    if (!GM || !GM.harem) return null;
    if (!Array.isArray(GM.harem.consorts)) GM.harem.consorts = [];
    var taken = {};
    GM.harem.consorts.forEach(function(c){ taken[c.name] = 1; });
    var nm = genName(taken);
    var r = rank || pick(['答应','常在','贵人','嫔']);
    var co = {
      name: nm.name, rank: r,
      age: randInt(15, 20), favor: randInt(10, 40),
      family: nm.family, enteredTurn: GM.turn || 1, lastFavoredTurn: 0,
      pregnant: false, pregnantSince: null,
      children: [], childCount: 0,
      status: '安宁',
      bio: pick(BG_DESCS)
    };
    GM.harem.consorts.push(co);
    logChronicle('选秀入宫：' + co.name + '·' + co.rank + '·' + co.bio + '。');
    return co;
  }

  // ─── 玩家操作 ─────────────────────────────────────────
  function findConsort(name) {
    if (!GM || !GM.harem || !Array.isArray(GM.harem.consorts)) return null;
    return GM.harem.consorts.find(function(c){ return c.name === name; }) || null;
  }

  function favor(name) {
    var c = findConsort(name);
    if (!c) return false;
    if (c.status === '薨' || c.status === '废黜') {
      toastSafe(c.name + ' 已无法承宠');
      return false;
    }
    c.lastFavoredTurn = GM.turn || 1;
    c.favor = Math.min(100, (c.favor || 0) + randInt(5, 12));
    GM.harem.tianxing = { turn: GM.turn || 1, name: c.name };

    // 怀孕概率：宠爱越高、年龄越小越易孕；已孕则跳过
    if (!c.pregnant && c.age < 38) {
      var p = 0.08 + (c.favor / 100) * 0.18 + Math.max(0, (28 - c.age)) * 0.005;
      if (chance(p)) {
        c.pregnant = true;
        c.pregnantSince = GM.turn || 1;
        c.status = '有孕';
        logChronicle('内廷：' + c.name + ' 承宠后诊出喜脉。');
      } else {
        logChronicle('夜召 ' + c.name + ' 侍寝。');
      }
    } else {
      logChronicle('夜召 ' + c.name + ' 侍寝。');
    }
    refreshPanel();
    return true;
  }

  function promote(name) {
    var c = findConsort(name);
    if (!c) return false;
    var nx = rankAbove(c.rank);
    if (!nx) { toastSafe(c.name + ' 已位极后宫'); return false; }
    if (nx.maxSlots !== Infinity && countByRank(nx.name) >= nx.maxSlots) {
      toastSafe(nx.name + ' 已满员 (' + nx.maxSlots + ')'); return false;
    }
    var old = c.rank;
    c.rank = nx.name;
    c.favor = Math.min(100, (c.favor || 0) + 8);
    logChronicle('册晋：' + c.name + ' 由 ' + old + ' 晋为 ' + nx.name + '。');
    refreshPanel();
    return true;
  }

  function demote(name) {
    var c = findConsort(name);
    if (!c) return false;
    var nx = rankBelow(c.rank);
    if (!nx) { toastSafe(c.name + ' 已无可降'); return false; }
    var old = c.rank;
    c.rank = nx.name;
    c.favor = Math.max(0, (c.favor || 0) - 12);
    logChronicle('降位：' + c.name + ' 由 ' + old + ' 贬为 ' + nx.name + '。');
    refreshPanel();
    return true;
  }

  function depose(name) {
    var c = findConsort(name);
    if (!c) return false;
    if (c.rank === '皇后' && !confirmSafe('废黜皇后将动摇中宫，是否确认？')) return false;
    c.status = '废黜';
    c.favor = 0;
    logChronicle('废黜：' + c.name + ' 褫位入冷宫。');
    refreshPanel();
    return true;
  }

  function visitWithEmpress() {
    var emp = (GM.harem.consorts || []).find(function(c){ return c.rank === '皇后' && c.status === '安宁'; });
    if (!emp) { toastSafe('中宫无主，宜先册立皇后'); return false; }
    return favor(emp.name);
  }

  // ─── 回合处理：怀孕推进 / 自然年龄 / 失宠 / 薨 ─────────
  function processTurn() {
    if (typeof GM === 'undefined' || !GM || !GM.harem) return;
    if (!Array.isArray(GM.harem.consorts)) return;
    var curTurn = GM.turn || 1;

    GM.harem.consorts.forEach(function(c){
      if (c.status === '薨') return;

      // 年龄按回合数月推进（4 回合 ≈ 1 岁，与游戏节奏匹配）
      if (curTurn % 4 === 0) {
        var _consortAge = typeof getValidAge === 'function' ? getValidAge(c, 20) : (Number.isFinite(c.age) && c.age >= 0 ? Math.floor(c.age) : 20);
        c.age = _consortAge + 1;
      }

      // 怀孕推进：怀胎约 9 回合
      if (c.pregnant && c.pregnantSince != null) {
        var gest = curTurn - c.pregnantSince;
        if (gest >= 9) {
          // 诞育
          var alive = chance(0.88);  // 12% 流产/夭折
          if (alive) {
            var isPrince = chance(0.5);
            // 皇嗣总序命名(2026-07-07·国本刀)：原「皇子N/公主N」按各母 childCount 计数——两妃各得「皇子1」必撞名·
            //   入宗牒(GM.chars)后 findCharByName 混淆。改全局皇嗣序：皇长子/皇次子…（朝代中立）。
            if (!Array.isArray(GM.harem.heirs)) GM.harem.heirs = [];
            var _ord = ['长', '次', '三', '四', '五', '六', '七', '八', '九', '十'];
            var _seq = GM.harem.heirs.filter(function(h){ return h && h.isPrince === isPrince; }).length;
            var babyName = '皇' + (_ord[_seq] || String(_seq + 1)) + (isPrince ? '子' : '女');
            // 国本接通(2026-07-07)：皇嗣登记为真角色+回填玩家 childrenIds——此前皇嗣只是数据对象·
            //   resolveHeir(只认 char)永远选不中·驾崩/禅让轮不到亲子·后宫产出被整体丢弃。
            var _pcH = (window.TM && TM.Succession && typeof TM.Succession.getPlayerCharacter === 'function')
              ? TM.Succession.getPlayerCharacter(GM)
              : (GM.chars || []).find(function(x){ return x && x.isPlayer; });
            if (!_pcH || !window.TM || !TM.Roster || typeof TM.Roster.createChar !== 'function') {
              throw new Error('皇嗣创建缺少玩家角色或统一名册入口');
            }
            var _baby = TM.Roster.createChar({
              name: babyName, age: 0, gender: isPrince ? 'male' : 'female',
              faction: _pcH.faction, factionId: _pcH.factionId, alive: true, loyalty: 100,
              title: isPrince ? '皇子' : '皇女', bio: '生母' + (c.rank || '') + c.name,
              father: _pcH.name, mother: c.name, _royalChild: true,
              bornTurn: curTurn, _createdTurn: curTurn, _origin: 'harem-child'
            }, { world: GM, father: _pcH, defaultAge: 0 });
            c.children.push(babyName);
            if (!Array.isArray(c.childrenIds)) c.childrenIds = [];
            c.childrenIds.push(_baby.id);
            c.childCount = (c.childCount || 0) + 1;
            GM.harem.heirs.push({
              id: _baby.id, characterId: _baby.id,
              name: babyName, mother: c.name, motherRank: c.rank,
              bornTurn: curTurn, isPrince: isPrince, alive: true
            });
            c.favor = Math.min(100, (c.favor || 0) + (isPrince ? 18 : 10));
            // 诞下皇子可获位分提升
            if (isPrince && c.rank !== '皇后' && c.rank !== '皇贵妃') {
              if (chance(0.4)) promote(c.name);
            }
            logChronicle('诞育：' + c.name + ' 诞下' + (isPrince ? '皇子' : '公主') + '。');
          } else {
            c.favor = Math.max(0, (c.favor || 0) - 8);
            logChronicle('哀诏：' + c.name + ' 小产，痛失皇嗣。');
          }
          c.pregnant = false;
          c.pregnantSince = null;
          c.status = '安宁';
        }
      }

      // 失宠衰减：每回合宠爱微减；若多回合未召幸则更明显
      var sinceFav = curTurn - (c.lastFavoredTurn || 0);
      if (sinceFav > 6) {
        var dec = Math.min(6, Math.floor(sinceFav / 4));
        c.favor = Math.max(0, (c.favor || 0) - dec);
      }
      // 状态联动
      if (c.status === '安宁' && c.favor < 8 && sinceFav > 20) c.status = '失宠';
      else if (c.status === '失宠' && c.favor >= 25) c.status = '安宁';

      // 自然薨：年高且无宠
      if (c.age >= 55 && chance(0.02 + (c.age - 55) * 0.01)) {
        c.status = '薨';
        c.favor = 0;
        logChronicle('哀诏：' + c.rank + c.name + ' 薨于宫中，年' + c.age + '。');
      }
    });

    // 偶发：选秀 (每 8 回合，若总人数 < 14)
    if (curTurn > 0 && curTurn % 8 === 0) {
      var living = GM.harem.consorts.filter(function(c){ return c.status !== '薨' && c.status !== '废黜'; });
      if (living.length < 14) selectNew();
    }
  }

  // ─── chronicle / toast helpers ─────────────────────────
  function logChronicle(text) {
    try {
      if (!Array.isArray(GM.evtLog)) GM.evtLog = [];
      GM.evtLog.push({ turn: GM.turn || 1, type: 'harem', text: text });
      if (typeof window.toast === 'function' && (window.GM.uiSettings && GM.uiSettings.haremToast !== false)) {
        // 不主动 toast 每个，避免刷屏；仅诊断时
      }
    } catch(_){ try { window.TM && TM.errors && TM.errors.captureSilent(_, 'houguong:evtlog'); } catch (__) {} }
  }
  function toastSafe(msg) {
    try { if (typeof window.toast === 'function') window.toast(msg); } catch(_){}
  }
  function confirmSafe(msg) {
    try { return window.confirm ? window.confirm(msg) : true; } catch(_){ return true; }
  }

  // ─── 面板渲染 ─────────────────────────────────────────
  function esc(s){
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function jsEsc(s){ return String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

  function refreshPanel() {
    try {
      var gl = document.getElementById('gl');
      if (!gl) return;
      var old = gl.querySelector('[data-panel-key="harem"]');
      if (!old) return;
      var fresh = buildPanelEl();
      if (fresh) old.parentNode.replaceChild(fresh, old);
    } catch(_){}
  }

  function buildPanelEl() {
    if (!GM || !GM.harem) return null;
    if (!Array.isArray(GM.harem.consorts) || GM.harem.consorts.length === 0) seed();
    var consorts = (GM.harem.consorts || []).slice();
    // 按位分由高到低排序
    consorts.sort(function(a, b){
      var ra = rankByName(a.rank).tier, rb = rankByName(b.rank).tier;
      if (rb !== ra) return rb - ra;
      return (b.favor || 0) - (a.favor || 0);
    });

    var living = consorts.filter(function(c){ return c.status !== '薨' && c.status !== '废黜'; });
    var heirs = (GM.harem.heirs || []).filter(function(h){ return h.alive !== false; });
    var princes = heirs.filter(function(h){ return h.isPrince; });

    var panel = document.createElement('div');
    panel.className = 'gs-panel p-harem';
    panel.setAttribute('data-panel-key', 'harem');

    var html = '';
    html += '<div class="gs-panel-hdr">';
    html += '<div class="gs-panel-title">后 宫 嫔 御</div>';
    html += '<span class="gs-panel-cnt">' + living.length + ' / ' + consorts.length + '</span>';
    html += '</div>';

    // 概览行
    html += '<div class="gs-harem-summary">';
    html += '<span class="gs-harem-stat"><span class="k">皇嗣</span><span class="v">' + heirs.length + '</span></span>';
    html += '<span class="gs-harem-stat"><span class="k">皇子</span><span class="v">' + princes.length + '</span></span>';
    var pregN = consorts.filter(function(c){ return c.pregnant; }).length;
    html += '<span class="gs-harem-stat"><span class="k">有孕</span><span class="v">' + pregN + '</span></span>';
    var tx = GM.harem.tianxing;
    if (tx && tx.name) {
      html += '<span class="gs-harem-stat"><span class="k">前夜</span><span class="v">' + esc(tx.name) + '</span></span>';
    }
    html += '</div>';

    // 快捷操作
    html += '<div class="gs-harem-actions">';
    html += '<button class="gs-harem-btn primary" onclick="TM.hougong.visitWithEmpress();">召幸中宫</button>';
    html += '<button class="gs-harem-btn" onclick="TM.hougong.selectNewPick();">选秀入宫</button>';
    html += '</div>';

    // 嫔妃列表（按位分分组）
    var grouped = {};
    living.forEach(function(c){
      var k = c.rank;
      if (!grouped[k]) grouped[k] = [];
      grouped[k].push(c);
    });

    // 按 tier 由高到低输出
    for (var ri = RANKS.length - 1; ri >= 0; ri--) {
      var r = RANKS[ri];
      var arr = grouped[r.name];
      if (!arr || !arr.length) continue;
      html += '<div class="gs-harem-group">';
      html += '<div class="gs-harem-group-hdr"><span class="t">' + esc(r.name) + '</span>';
      if (r.maxSlots !== Infinity) html += '<span class="s">' + arr.length + '/' + r.maxSlots + '</span>';
      else html += '<span class="s">' + arr.length + '</span>';
      html += '</div>';
      arr.forEach(function(c){
        var rCls = r.key;
        var favPct = Math.max(0, Math.min(100, c.favor || 0));
        var favCls = favPct >= 65 ? 'hi' : favPct >= 35 ? 'mid' : 'lo';
        var stCls = c.status === '有孕' ? 'preg' : c.status === '失宠' ? 'fade' : '';
        var nameJs = jsEsc(c.name);
        var portraitCh = (c.name && c.name.charAt(0)) || '?';
        var familyTxt = c.family ? esc(c.family) : '';
        var bioTxt = c.bio ? '·' + esc(c.bio) : '';
        var subtitle = familyTxt + bioTxt + '·' + (c.age || 0) + '岁';
        if (c.childCount > 0) subtitle += '·育' + c.childCount;
        var statusBadge = '';
        if (c.status === '有孕') statusBadge = '<span class="gs-harem-badge preg">孕</span>';
        else if (c.status === '失宠') statusBadge = '<span class="gs-harem-badge fade">失</span>';

        html += '<div class="gs-harem-row ' + rCls + ' ' + stCls + '">';
        html += '<div class="gs-harem-port" style="--rc:' + r.color + ';">' + esc(portraitCh) + '</div>';
        html += '<div class="gs-harem-mid">';
        html += '<div class="gs-harem-name">' + esc(c.name) + statusBadge + '</div>';
        html += '<div class="gs-harem-sub">' + subtitle + '</div>';
        html += '<div class="gs-harem-fav"><span class="gs-harem-fav-bar"><span class="gs-harem-fav-fill ' + favCls + '" style="width:' + favPct + '%;"></span></span><span class="gs-harem-fav-val">' + Math.round(favPct) + '</span></div>';
        html += '</div>';
        html += '<div class="gs-harem-ops">';
        html += '<button class="gs-harem-op call" title="召幸" onclick="TM.hougong.favor(\'' + nameJs + '\');">幸</button>';
        html += '<button class="gs-harem-op up" title="晋位" onclick="TM.hougong.promote(\'' + nameJs + '\');">晋</button>';
        html += '<button class="gs-harem-op down" title="降位" onclick="TM.hougong.demote(\'' + nameJs + '\');">降</button>';
        html += '</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    // 皇嗣
    if (heirs.length) {
      html += '<div class="gs-harem-group">';
      html += '<div class="gs-harem-group-hdr"><span class="t">皇 嗣</span><span class="s">' + heirs.length + '</span></div>';
      html += '<div class="gs-harem-heirs">';
      heirs.slice(0, 12).forEach(function(h){
        var cls = h.isPrince ? 'prince' : 'princess';
        var isCP = (GM.harem.crownPrince === h.name);
        var inChars = (GM.chars || []).some(function(x){ return x && x.name === h.name && x.alive !== false; });
        var nmJs = String(h.name || '').replace(/'/g, '&#39;');
        var canCrown = h.isPrince && !isCP && inChars;
        html += '<div class="gs-harem-heir ' + cls + (isCP ? ' crown' : '') + '"'
          + (canCrown ? ' style="cursor:pointer;" onclick="TM.hougong.crownPrince(\'' + nmJs + '\')" title="母 ' + esc(h.mother||'') + '·点击册立为皇太子"' : ' title="母 ' + esc(h.mother||'') + '"')
          + '>' + (isCP ? '储·' : '') + esc(h.name) + '</div>';
      });
      html += '</div>';
      html += '</div>';
    }

    panel.innerHTML = html;
    return panel;
  }

  function renderPanelInto(gl) {
    if (!gl) return;
    // 移除既有占位（若 shell-extras 已注入旧版本）
    var old = gl.querySelector('[data-panel-key="harem"]');
    if (old) old.parentNode.removeChild(old);
    var el = buildPanelEl();
    if (el) gl.appendChild(el);
  }

  function selectNewPick() {
    var c = selectNew();
    if (c) {
      toastSafe('选秀：' + c.name + '·' + c.rank);
      refreshPanel();
    }
  }

  // ─── 册立皇太子(2026-07-07·国本刀)：写玩家 designatedHeirId=resolveHeir 最高优先级——
  //     驾崩/禅让由储君继统·不再被「同势力最强者」fallback 抢先 ───
  function crownPrince(name) {
    var h = ((GM.harem && GM.harem.heirs) || []).find(function(x){ return x && x.name === name && x.alive !== false && x.isPrince; });
    if (!h) { toastSafe('查无此皇子'); return false; }
    var pc = (window.TM && TM.Player && typeof TM.Player.getCharacter === 'function')
      ? TM.Player.getCharacter(GM)
      : (GM.chars || []).find(function(x){ return x && x.isPlayer === true; });
    if (!pc) { toastSafe('未找到玩家角色'); return false; }
    var heirChar = (GM.chars || []).find(function(x){ return x && x.name === name && x.alive !== false; });
    if (!heirChar) { toastSafe('皇子未入宗牒（旧档所生），恕不可立'); return false; }
    if (GM.harem.crownPrince === name) { toastSafe(name + '已正位东宫'); return false; }
    if (typeof confirm === 'function' && !confirm('册立 ' + name + ' 为皇太子？国本一定，中外瞩目。')) return false;
    if (!heirChar.id || !String(heirChar.id).trim()) { toastSafe('皇子缺少稳定身份，无法册立'); return false; }
    GM.harem.crownPrince = name; // arch-ok 后宫写主保留姓名显示兼容
    GM.harem.crownPrinceId = heirChar.id; // arch-ok 册立太子稳定身份写口
    pc.designatedHeirId = heirChar.id;
    heirChar.isCrownPrince = true;
    heirChar.title = '皇太子';
    if (typeof addEB === 'function') { try { addEB('国本', '册立' + name + '为皇太子·告庙颁诏·国本以定', { credibility: 'high' }); } catch(_){} }
    // 立储乃朝局大事：要臣入记忆(cap12·全朝反应交叙事)
    if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.addMemory) {
      try {
        (GM.chars || []).filter(function(c2){ return c2 && c2.alive !== false && !c2.isPlayer && !c2._royalChild && c2.officialTitle; })
          .slice(0, 12).forEach(function(c2){ NpcMemorySystem.addMemory(c2.name, '天子册立' + name + '为皇太子，国本已定', 7, 'political'); });
      } catch(_){}
    }
    logChronicle('册立：' + name + ' 正位东宫。');
    refreshPanel();
    toastSafe('已册立' + name + '为皇太子');
    return true;
  }

  // ─── 注入 CSS ────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('tm-hougong-style')) return;
    var s = document.createElement('style');
    s.id = 'tm-hougong-style';
    s.textContent = ''
      + '.p-harem .gs-harem-summary{display:flex;gap:10px;flex-wrap:wrap;padding:6px 10px 4px;border-bottom:1px solid rgba(201,168,76,0.15);}'
      + '.p-harem .gs-harem-stat{display:inline-flex;align-items:baseline;gap:4px;font-size:0.74rem;color:#cbb98a;}'
      + '.p-harem .gs-harem-stat .k{color:#9a8a5a;}'
      + '.p-harem .gs-harem-stat .v{color:#f0d893;font-weight:600;}'
      + '.p-harem .gs-harem-actions{display:flex;gap:6px;padding:6px 10px;border-bottom:1px solid rgba(201,168,76,0.12);}'
      + '.p-harem .gs-harem-btn{flex:1;padding:5px 8px;background:rgba(184,154,83,0.12);border:1px solid rgba(201,168,76,0.35);color:#e8d49a;font-size:0.78rem;cursor:pointer;letter-spacing:1px;border-radius:1px;font-family:inherit;}'
      + '.p-harem .gs-harem-btn:hover{background:rgba(201,168,76,0.25);}'
      + '.p-harem .gs-harem-btn.primary{background:rgba(168,85,58,0.2);border-color:rgba(200,55,55,0.6);color:#f3c0a8;}'
      + '.p-harem .gs-harem-btn.primary:hover{background:rgba(200,55,55,0.35);}'
      + '.p-harem .gs-harem-group{margin-top:4px;}'
      + '.p-harem .gs-harem-group-hdr{display:flex;justify-content:space-between;padding:4px 10px;font-size:0.7rem;letter-spacing:3px;color:#bda86a;background:rgba(184,154,83,0.05);border-bottom:1px dashed rgba(201,168,76,0.18);}'
      + '.p-harem .gs-harem-group-hdr .t{color:#e8d49a;}'
      + '.p-harem .gs-harem-group-hdr .s{color:#9a8a5a;}'
      + '.p-harem .gs-harem-row{display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid rgba(201,168,76,0.06);transition:background 0.15s;}'
      + '.p-harem .gs-harem-row:hover{background:rgba(201,168,76,0.05);}'
      + '.p-harem .gs-harem-row.preg{background:rgba(232,180,168,0.06);}'
      + '.p-harem .gs-harem-row.fade{opacity:0.6;}'
      + '.p-harem .gs-harem-port{width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:1rem;color:var(--rc,#c9a045);border:1px solid var(--rc,#c9a045);background:rgba(0,0,0,0.25);border-radius:1px;flex-shrink:0;}'
      + '.p-harem .gs-harem-mid{flex:1;min-width:0;}'
      + '.p-harem .gs-harem-name{font-size:0.85rem;color:#e8d49a;font-weight:500;display:flex;align-items:center;gap:6px;}'
      + '.p-harem .gs-harem-sub{font-size:0.7rem;color:#9a8a5a;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
      + '.p-harem .gs-harem-fav{display:flex;align-items:center;gap:4px;margin-top:3px;}'
      + '.p-harem .gs-harem-fav-bar{flex:1;height:4px;background:rgba(154,138,90,0.15);border-radius:1px;overflow:hidden;}'
      + '.p-harem .gs-harem-fav-fill{display:block;height:100%;background:#c9a045;transition:width 0.3s;}'
      + '.p-harem .gs-harem-fav-fill.hi{background:#c83737;}'
      + '.p-harem .gs-harem-fav-fill.mid{background:#c9a045;}'
      + '.p-harem .gs-harem-fav-fill.lo{background:#7a7058;}'
      + '.p-harem .gs-harem-fav-val{font-size:0.7rem;color:#9a8a5a;width:18px;text-align:right;}'
      + '.p-harem .gs-harem-ops{display:flex;gap:3px;flex-shrink:0;}'
      + '.p-harem .gs-harem-op{width:22px;height:22px;padding:0;background:rgba(184,154,83,0.08);border:1px solid rgba(201,168,76,0.25);color:#cbb98a;font-size:0.72rem;cursor:pointer;border-radius:1px;font-family:inherit;line-height:1;}'
      + '.p-harem .gs-harem-op:hover{background:rgba(201,168,76,0.2);color:#f0d893;}'
      + '.p-harem .gs-harem-op.call:hover{background:rgba(200,55,55,0.3);color:#f3c0a8;border-color:rgba(200,55,55,0.55);}'
      + '.p-harem .gs-harem-op.up:hover{background:rgba(126,184,167,0.25);color:#a8d5c4;border-color:rgba(126,184,167,0.5);}'
      + '.p-harem .gs-harem-op.down:hover{background:rgba(142,106,168,0.25);color:#c9b0d8;border-color:rgba(142,106,168,0.5);}'
      + '.p-harem .gs-harem-badge{display:inline-block;padding:1px 4px;font-size:0.7rem;border-radius:1px;letter-spacing:0;}'
      + '.p-harem .gs-harem-badge.preg{background:rgba(232,180,168,0.25);color:#f3c0a8;border:1px solid rgba(232,131,113,0.45);}'
      + '.p-harem .gs-harem-badge.fade{background:rgba(122,112,88,0.25);color:#a59872;border:1px solid rgba(154,138,90,0.4);}'
      + '.p-harem .gs-harem-heirs{display:flex;flex-wrap:wrap;gap:4px;padding:6px 10px;}'
      + '.p-harem .gs-harem-heir{padding:2px 6px;font-size:0.7rem;border-radius:1px;border:1px solid rgba(201,168,76,0.3);background:rgba(184,154,83,0.08);color:#cbb98a;}'
      + '.p-harem .gs-harem-heir.prince{border-color:rgba(200,55,55,0.5);color:#f3c0a8;background:rgba(200,55,55,0.1);}'
      + '.p-harem .gs-harem-heir.princess{border-color:rgba(142,106,168,0.5);color:#c9b0d8;background:rgba(142,106,168,0.1);}'
      + '.p-harem .gs-harem-heir.crown{border-color:rgba(240,216,147,0.85);color:#f0d893;background:rgba(201,168,76,0.22);font-weight:700;}'
      + '.gs-rail-btn.c-harem{color:#e8d49a;}'
      ;
    document.head.appendChild(s);
  }

  // ─── 挂接 endturn post-turn job ─────────────────────────
  function hookEndturn() {
    if (typeof window._launchPostTurnJobs !== 'function') {
      // 还没 load，过会儿再试
      setTimeout(hookEndturn, 500);
      return;
    }
    if (window._launchPostTurnJobs._haremHooked) return;
    var _orig = window._launchPostTurnJobs;
    window._launchPostTurnJobs = function() {
      var r = _orig.apply(this, arguments);
      try {
        if (typeof window._enqueuePostTurnJob === 'function') {
          window._enqueuePostTurnJob('harem', async function() {
            try { processTurn(); } catch(e) { console.warn('[hougong] processTurn:', e); }
          });
        } else {
          // 兜底：同步调用
          try { processTurn(); } catch(e) { console.warn('[hougong] processTurn sync:', e); }
        }
      } catch(_){}
      return r;
    };
    window._launchPostTurnJobs._haremHooked = true;
  }

  // ─── 公开 API ─────────────────────────────────────────
  window.TM.hougong = {
    RANKS: RANKS,
    seed: seed,
    selectNew: selectNew,
    selectNewPick: selectNewPick,
    favor: favor,
    promote: promote,
    demote: demote,
    depose: depose,
    visitWithEmpress: visitWithEmpress,
    crownPrince: crownPrince,
    processTurn: processTurn,
    findConsort: findConsort,
    renderPanel: renderPanelInto,
    refreshPanel: refreshPanel,
    _build: buildPanelEl
  };

  // 启动：注入样式、挂钩 endturn
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ injectStyles(); hookEndturn(); });
  } else {
    injectStyles();
    hookEndturn();
  }
})();

// @ts-check
// ============================================================
// tm-chronicle-effects.js — ChronicleTracker 效果模型扩展
// ============================================================
// 在 base tm-chronicle-tracker.js 之上扩展三件事:
//   1. estimateExpectedTurns(opts)·按剧本 daysPerTurn 估完工回合·避免 99999 bug
//   2. estimateEffectProfile(opts)·返回长期行动的效果模型(perTurn/final/balance/terminable/termCost)
//   3. applyPerTurnEffect / 包 complete / terminate·让长期行动每回合作用·完成时一次性应用·可中辍
//
// 设计：
//   · 长期行动每回合都在生效·非到点突然触发
//   · 短期当下与长期回报区分·有时矛盾(变法短期党争+长期国强)
//   · 玩家可终结·有相应代价
// ============================================================
(function(global) {
  'use strict';
  if (typeof global.ChronicleTracker !== 'object') return;
  var CT = global.ChronicleTracker;

  // ── 1. 每回合天数 + 完工回合估算 ──────────────────────────
  function getDaysPerTurn() {
    var G = global.GM, P = global.P;
    var sc = (P && P.scenario) || {};
    var d = (P && P.time && P.time.daysPerTurn) ||
            (G && G._daysPerTurn) ||
            sc.daysPerTurn ||
            (P && P.daysPerTurn) ||
            30;
    d = parseInt(d, 10);
    if (!isFinite(d) || d < 1) d = 30;
    return d;
  }
  function estimateExpectedTurns(opts) {
    opts = opts || {};
    var daysPerTurn = getDaysPerTurn();
    var dayMap = {
      '廷议·变法': 1100, '廷议·科举改': 1100, '廷议·盐茶钱法': 1000,
      '廷议·塞外经略': 730, '廷议·筑城营造': 730, '廷议·河漕修河': 900,
      '廷议·赈抚': 180, '廷议·京察': 180, '廷议·清查': 730, '廷议·默认': 365,
      '常朝·变法': 900, '常朝·边事': 540, '常朝·工程': 540, '常朝·赈抚': 120, '常朝·默认': 240,
      'keju': 365, 'edict': 730, 'scheme': 600, 'project': 1095, 'pending_memorial': 90,
      'faction_treaty': 1825, 'npc_action': 365, 'dynasty_event': 1825, 'default': 365
    };
    var key = opts.key || (opts.kind && opts.subkind ? opts.kind + '·' + opts.subkind : opts.kind || 'default');
    var days = dayMap[key];
    if (!days) days = dayMap[opts.kind] || dayMap['default'];
    var difficultyMul = { low: 0.6, medium: 1.0, high: 1.4 }[opts.difficulty] || 1.0;
    days = days * difficultyMul;
    var turns = Math.ceil(days / daysPerTurn);
    if (!isFinite(turns) || isNaN(turns)) turns = 12;
    return Math.max(2, Math.min(120, turns));
  }
  CT.getDaysPerTurn = getDaysPerTurn;
  CT.estimateExpectedTurns = estimateExpectedTurns;

  // ── 2. 效果模型(短期 vs 长期张力 + 可终结) ──────────────────
  // 注：所有 vars 字段使用单字符串 key·避免空格冲突
  function estimateEffectProfile(opts) {
    opts = opts || {};
    var key = opts.key || (opts.kind && opts.subkind ? opts.kind + '·' + opts.subkind : opts.kind || 'default');
    var profiles = {
      '廷议·变法': {
        perTurn: { vars: { '党争': 1.2, '民心': -0.4, '帑廪': -50 }, narrative: '变法推行·守旧者攻讦·施行处骚动' },
        final:   { vars: { '国势': 8, '帑廪': 500, '民心': 6, '皇威': 5 }, narrative: '法成·吏治为之一新·国势焕然' },
        short: 'negative', long: 'positive', terminable: true,
        termCost: { vars: { '皇威': -8, '党争': 5 }, narrative: '半途废法·主奏者抱怨·政敌得势' }
      },
      '廷议·科举改': {
        perTurn: { vars: { '党争': 0.6 }, narrative: '士林议论纷纷·清流尤为不平' },
        final:   { vars: { '国势': 5, '党争': -3 }, narrative: '取士新例既定·士风渐归' },
        short: 'mixed', long: 'positive', terminable: true,
        termCost: { vars: { '皇威': -5 }, narrative: '废新例·士林讥之朝令夕改' }
      },
      '廷议·盐茶钱法': {
        perTurn: { vars: { '帑廪': 80, '民心': -0.3, '党争': 0.5 }, narrative: '榷税渐入·商贾抱怨·有司互争' },
        final:   { vars: { '帑廪': 800, '民心': -2 }, narrative: '法成·岁入大充·然商旅日疏' },
        short: 'mixed', long: 'positive', terminable: true,
        termCost: { vars: { '帑廪': -200 }, narrative: '废法·岁入骤减·主奏蒙羞' }
      },
      '廷议·塞外经略': {
        perTurn: { vars: { '帑廪': -150, '军心': 0.3 }, narrative: '调饷拓边·将士枕戈·帑廪日耗' },
        final:   { vars: { '国势': 6, '皇威': 5 }, narrative: '塞外既定·虏不敢南顾' },
        short: 'negative', long: 'positive', terminable: true,
        termCost: { vars: { '皇威': -10 }, narrative: '弃征·督师含恨·边备虚耗' }
      },
      '廷议·筑城营造': {
        perTurn: { vars: { '帑廪': -200, '民心': -0.5 }, narrative: '征发民夫·工部督工·帑廪日竭' },
        final:   { vars: { '国势': 4, '皇威': 3 }, narrative: '城筑就·屹立北疆' },
        short: 'negative', long: 'positive', terminable: true,
        termCost: { vars: { '帑廪': -300, '民心': -5 }, narrative: '弃工·城基荒废·民夫白苦' }
      },
      '廷议·河漕修河': {
        perTurn: { vars: { '帑廪': -120, '民心': -0.5 }, narrative: '河工连年·征夫不绝·三省之民苦之' },
        final:   { vars: { '民心': 12, '帑廪': 200, '国势': 5 }, narrative: '河堤既成·漕运畅通·民得安居' },
        short: 'negative', long: 'positive', terminable: true,
        termCost: { vars: { '民心': -8 }, narrative: '弃河工·堤基溃决·黄淮复泛' }
      },
      '廷议·赈抚': {
        perTurn: { vars: { '帑廪': -80, '民心': 1.5 }, narrative: '赈粮发施·灾民得活·然帑廪日空' },
        final:   { vars: { '民心': 5, '国势': 2 }, narrative: '灾区渐复·百姓感戴' },
        short: 'positive', long: 'positive', terminable: true,
        termCost: { vars: { '民心': -10 }, narrative: '罢赈·灾民流离·怨声四起' }
      },
      '廷议·京察': {
        perTurn: { vars: { '党争': 1.5 }, narrative: '京察将至·百官惴惴·言路汹汹' },
        final:   { vars: { '党争': -5, '皇威': 4 }, narrative: '黜陟既定·朝纲复振' },
        short: 'negative', long: 'positive', terminable: false, termCost: null
      },
      '廷议·清查': {
        perTurn: { vars: { '党争': 0.8, '帑廪': 30 }, narrative: '清查赋籍·豪强抵制·胥吏推诿' },
        final:   { vars: { '帑廪': 600, '民心': 3 }, narrative: '册籍既清·岁入大增' },
        short: 'mixed', long: 'positive', terminable: true,
        termCost: { vars: { '帑廪': -150 }, narrative: '半途中止·豪强额手·主奏蒙耻' }
      },
      '廷议·默认': {
        perTurn: { vars: { '帑廪': -20 } },
        final:   { vars: { '国势': 3 }, narrative: '事毕·渐有成效' },
        short: 'mixed', long: 'positive', terminable: true,
        termCost: { vars: {}, narrative: '罢议·无以为继' }
      },
      '常朝·变法': {
        perTurn: { vars: { '党争': 0.8, '帑廪': -30 }, narrative: '常朝定法·推行渐起' },
        final:   { vars: { '国势': 5, '帑廪': 300 }, narrative: '渐成成效' },
        short: 'mixed', long: 'positive', terminable: true,
        termCost: { vars: { '皇威': -3 }, narrative: '罢之·朝令前后不一' }
      },
      '常朝·边事': {
        perTurn: { vars: { '帑廪': -80 }, narrative: '调度边饷·军心稍振' },
        final:   { vars: { '皇威': 2 }, narrative: '边事既理' },
        short: 'negative', long: 'positive', terminable: true,
        termCost: { vars: {}, narrative: '罢之·将士寒心' }
      },
      '常朝·工程': {
        perTurn: { vars: { '帑廪': -100, '民心': -0.3 }, narrative: '兴工役·帑廪日耗' },
        final:   { vars: { '民心': 5, '国势': 3 }, narrative: '工成·民得便利' },
        short: 'negative', long: 'positive', terminable: true,
        termCost: { vars: { '民心': -3 }, narrative: '半途·工费白耗' }
      },
      '常朝·赈抚': {
        perTurn: { vars: { '帑廪': -50, '民心': 1.2 }, narrative: '赈粮渐施' },
        final:   { vars: { '民心': 3 }, narrative: '灾区暂平' },
        short: 'positive', long: 'positive', terminable: true,
        termCost: { vars: { '民心': -6 }, narrative: '罢赈·灾民复怨' }
      },
      '常朝·默认': {
        perTurn: { vars: { '帑廪': -10 }, narrative: '事议毕·循例奉行' },
        final:   { vars: {} },
        short: 'mixed', long: 'mixed', terminable: true, termCost: { vars: {} }
      },
      'keju': {
        perTurn: { vars: { '帑廪': -40 }, narrative: '科考经费日费' },
        final:   { vars: { '国势': 2 }, narrative: '殿试取士·新进士入仕' },
        short: 'negative', long: 'positive', terminable: false, termCost: null
      },
      'edict': {
        perTurn: { vars: {} }, final: { vars: {} },
        short: 'mixed', long: 'mixed', terminable: true,
        termCost: { vars: { '皇威': -3 }, narrative: '收回成命·朝令反复' }
      },
      'scheme': {
        perTurn: { vars: { '党争': 0.4 }, narrative: '〔密〕暗中筹谋' },
        final:   { vars: { '党争': 5 }, narrative: '〔密〕谋成·目标遭祸' },
        short: 'negative', long: 'mixed', terminable: false, termCost: null
      },
      'project': {
        perTurn: { vars: { '帑廪': -60 }, narrative: '工程运营' },
        final:   { vars: { '国势': 4 }, narrative: '工程告竣' },
        short: 'negative', long: 'positive', terminable: true,
        termCost: { vars: { '帑廪': -100 }, narrative: '工程半废' }
      },
      'pending_memorial': {
        perTurn: { vars: {} }, final: { vars: {} },
        short: 'negative', long: 'negative', terminable: false, termCost: null
      },
      'default': {
        perTurn: { vars: {} }, final: { vars: {} },
        short: 'mixed', long: 'mixed', terminable: true, termCost: null
      }
    };
    var profile = profiles[key] || profiles[opts.kind] || profiles['default'];
    return {
      perTurnEffect: profile.perTurn || null,
      finalEffect: profile.final || null,
      shortTermBalance: profile.short || 'mixed',
      longTermBalance: profile.long || 'mixed',
      terminable: profile.terminable !== false,
      terminationCost: profile.termCost || null
    };
  }
  CT.estimateEffectProfile = estimateEffectProfile;

  // ── 3. 数值变更应用 ──────────────────────────────────────────
  function applyVarsDelta(varsObj, scaleFactor) {
    var G = global.GM;
    if (!G || !varsObj) return;
    var scale = (typeof scaleFactor === 'number') ? scaleFactor : 1.0;
    var keyMap = {
      '民心': 'minxin.value',
      '帑廪': 'tanglian.silver',
      '党争': 'partyStrife',
      '皇威': 'huangwei.index',
      '皇权': 'huangquan.index',
      '国势': 'prestige',
      '军心': '_junxin'
    };
    Object.keys(varsObj).forEach(function(k) {
      var delta = parseFloat(varsObj[k]);
      if (!isFinite(delta) || isNaN(delta)) return;
      delta = delta * scale;
      var path = keyMap[k];
      if (!path) {
        if (!G._chronicleEffectAccum) G._chronicleEffectAccum = {};
        G._chronicleEffectAccum[k] = (G._chronicleEffectAccum[k] || 0) + delta;
        return;
      }
      var parts = path.split('.');
      var ref = G;
      for (var i = 0; i < parts.length - 1; i++) {
        if (!ref[parts[i]] || typeof ref[parts[i]] !== 'object') ref[parts[i]] = {};
        ref = ref[parts[i]];
      }
      var leaf = parts[parts.length - 1];
      var cur = parseFloat(ref[leaf]) || 0;
      var next = cur + delta;
      // 民心/党争/皇威/皇权/国势 限 0-100
      if (k === '民心' || k === '党争' || k === '皇威' || k === '皇权' || k === '国势') {
        next = Math.max(0, Math.min(100, next));
      }
      ref[leaf] = next;
    });
  }
  CT._applyVarsDelta = applyVarsDelta;

  // 每回合 perTurn 应用
  CT.applyPerTurnEffect = function(track) {
    if (!track || track.status !== 'active' || !track.perTurnEffect || !track.perTurnEffect.vars) return null;
    if ((track.progress || 0) < 5) return null;
    applyVarsDelta(track.perTurnEffect.vars, 1.0);
    if (!track.accumulatedEffect) track.accumulatedEffect = { vars: {} };
    Object.keys(track.perTurnEffect.vars).forEach(function(k) {
      track.accumulatedEffect.vars[k] = (track.accumulatedEffect.vars[k] || 0) + (parseFloat(track.perTurnEffect.vars[k]) || 0);
    });
    return track.perTurnEffect.narrative || '';
  };

  // 包 complete·应用 finalEffect
  var origComplete = CT.complete;
  CT.complete = function(id, result) {
    var G = global.GM;
    var t = (G && Array.isArray(G._chronicleTracks)) ? G._chronicleTracks.find(function(x){return x.id === id;}) : null;
    if (t && t.finalEffect && t.finalEffect.vars) {
      applyVarsDelta(t.finalEffect.vars, 1.0);
      if (typeof addEB === 'function') addEB('编年', '〔功成〕' + (t.title || '') + '：' + (t.finalEffect.narrative || ''));
    }
    return origComplete.call(this, id, result);
  };

  // 玩家终结·应用 terminationCost
  CT.terminate = function(id, byWho, reason) {
    var G = global.GM;
    if (!G || !Array.isArray(G._chronicleTracks)) return false;
    var t = G._chronicleTracks.find(function(x){return x.id === id;});
    if (!t || t.status !== 'active') return false;
    if (t.terminable === false) {
      if (typeof addEB === 'function') addEB('编年', '〔不可中辍〕' + (t.title || ''));
      return false;
    }
    if (t.terminationCost && t.terminationCost.vars) applyVarsDelta(t.terminationCost.vars, 1.0);
    t.status = 'terminated';
    t.terminatedBy = byWho || 'player';
    t.result = '终结·' + (reason || '帝意中辍');
    t.lastUpdateTurn = G.turn || 1;
    if (typeof addEB === 'function') {
      addEB('编年', '〔中辍〕' + (t.title || '') + (t.terminationCost && t.terminationCost.narrative ? '·' + t.terminationCost.narrative : ''));
    }
    if (Array.isArray(G._chronicle)) {
      G._chronicle.push({
        turn: G.turn || 0,
        date: G._gameDate || (typeof getTSText === 'function' ? getTSText(G.turn) : ''),
        category: '长期工程·中辍',
        title: (t.title || '') + '·' + (byWho === 'player' ? '帝意' : '事变') + '罢',
        content: '〔历〕' + ((G.turn || 0) - (t.startTurn || 0)) + ' 回合·进度 ' + (t.progress || 0) + '%·' + (t.terminationCost && t.terminationCost.narrative || ''),
        tags: ['长期工程', '中辍', t.type || '?']
      });
    }
    return true;
  };

  // 包 add·让外部传入新 schema 字段时正确填充·并 sanity expectedEndTurn
  var origAdd = CT.add;
  CT.add = function(track) {
    if (!track) track = {};
    var G = global.GM;
    var sT = parseInt(track.startTurn, 10) || (G && G.turn) || 1;
    // sanity expectedEndTurn
    if (track.expectedEndTurn != null) {
      var n = parseInt(track.expectedEndTurn, 10);
      if (!isFinite(n) || isNaN(n) || n <= sT) track.expectedEndTurn = null;
      else if (n > sT + 200) track.expectedEndTurn = sT + 120;
    }
    var id = origAdd.call(this, track);
    if (id && G && Array.isArray(G._chronicleTracks)) {
      var t = G._chronicleTracks.find(function(x){return x.id === id;});
      if (t) {
        // 显式赋扩展字段
        if (track.perTurnEffect) t.perTurnEffect = track.perTurnEffect;
        if (track.finalEffect) t.finalEffect = track.finalEffect;
        if (track.shortTermBalance) t.shortTermBalance = track.shortTermBalance;
        if (track.longTermBalance) t.longTermBalance = track.longTermBalance;
        if (track.terminable !== undefined) t.terminable = !!track.terminable;
        if (track.terminationCost) t.terminationCost = track.terminationCost;
        if (!t.accumulatedEffect) t.accumulatedEffect = { vars: {} };
      }
    }
    return id;
  };

  // 扩 getAIContextString·在原输出后追加 effect 信息
  var origGetCtx = CT.getAIContextString;
  CT.getAIContextString = function(opts) {
    var base = origGetCtx.call(this, opts) || '';
    var G = global.GM;
    if (!G || !Array.isArray(G._chronicleTracks)) return base;
    var tracks = G._chronicleTracks.filter(function(t){return t && t.status === 'active';});
    if (!tracks.length) return base;
    var extras = [];
    tracks.forEach(function(t) {
      var lines = [];
      var titleStr = (t.title || '').slice(0, 18);
      // 短长期张力
      if (t.shortTermBalance && t.longTermBalance) {
        var bL = function(b){ return b === 'positive' ? '利' : b === 'negative' ? '害' : '互见'; };
        var tens = '';
        if (t.shortTermBalance === 'negative' && t.longTermBalance === 'positive') tens = '【短害长利·当下苦其费·将来享其功】';
        else if (t.shortTermBalance === 'positive' && t.longTermBalance === 'negative') tens = '【短利长害·当下舒缓·种祸日深】';
        else if (t.shortTermBalance === 'positive' && t.longTermBalance === 'positive') tens = '【双利·当下与长远皆善】';
        else if (t.shortTermBalance === 'negative' && t.longTermBalance === 'negative') tens = '【双害·宜速议处】';
        else tens = '短:' + bL(t.shortTermBalance) + '·长:' + bL(t.longTermBalance);
        lines.push('  · ' + titleStr + ' ' + tens);
      }
      // 每回合作用
      if (t.perTurnEffect && t.perTurnEffect.vars && Object.keys(t.perTurnEffect.vars).length) {
        var keys = Object.keys(t.perTurnEffect.vars);
        var kvs = keys.map(function(k){
          var v = t.perTurnEffect.vars[k];
          return k + (v >= 0 ? '+' : '') + v;
        }).join('·');
        lines.push('    每回合作用：' + kvs + (t.perTurnEffect.narrative ? '〔' + t.perTurnEffect.narrative + '〕' : ''));
      }
      // 累积已成
      if (t.accumulatedEffect && t.accumulatedEffect.vars) {
        var akeys = Object.keys(t.accumulatedEffect.vars).filter(function(k){ return Math.abs(t.accumulatedEffect.vars[k]) >= 0.5; });
        if (akeys.length) {
          var kvs2 = akeys.map(function(k){
            var v = t.accumulatedEffect.vars[k];
            return k + (v >= 0 ? '+' : '') + v.toFixed(1);
          }).join('·');
          lines.push('    累计已成：' + kvs2);
        }
      }
      // 终结性
      if (t.terminable === false) lines.push('    [不可中辍] 已成势·必演进至完结');
      else if (t.terminationCost && t.terminationCost.narrative) lines.push('    [可中辍] 终结代价：' + t.terminationCost.narrative);
      if (lines.length) extras.push(lines.join('\n'));
    });
    if (!extras.length) return base;
    return base + '\n\n【★ 长期行动·短长期张力 + 每回合作用】\n' + extras.join('\n');
  };

  // 玩家终结入口·console / UI 可调用
  global.terminateChronicleTrack = function(id, reason) {
    if (!CT.terminate) return false;
    var ok = CT.terminate(id, 'player', reason || '帝意中辍');
    if (ok && typeof toast === 'function') toast('〔已中辍〕长期工程已废止·后果已应用');
    else if (!ok && typeof toast === 'function') toast('〔不可中辍〕该项不可终结');
    return ok;
  };
  global.listTerminableTracks = function() {
    var G = global.GM;
    if (!G || !Array.isArray(G._chronicleTracks)) return [];
    return G._chronicleTracks.filter(function(t){
      return t && t.status === 'active' && t.terminable !== false;
    }).map(function(t){
      return {
        id: t.id, title: t.title, progress: t.progress,
        short: t.shortTermBalance, long: t.longTermBalance,
        termCost: t.terminationCost && t.terminationCost.narrative
      };
    });
  };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));

// tm-keju-dianshi-events.js
// D4·钦点三甲 finalize·剧本无关化事件链。
// 提供·1) 党争联动 (4 分支)·2) 寒门状元 fallback (读 GM.classes)·3) 失败 UX 主考有偏 warning·4) confirm 入口聚合。
// 党 / 阶层 全 0 hardcode·读 GM.parties + GM.classes 动态。
// 浏览器 + Node 双兼容·无 LLM 依赖。

(function () {
  'use strict';

  /**
   * _kjResolveClassName(category) → string | null
   * 寒门 / 门阀 阶层 fallback·读 GM.classes 现名·关键字模糊匹配。
   * @param {'commoner'|'aristocrat'} category
   */
  function _kjResolveClassName(category) {
    var GM = (typeof window !== 'undefined' && window.GM) || (typeof global !== 'undefined' && global.GM);
    if (!GM || !GM.classes || !Array.isArray(GM.classes)) return null;
    var keywords;
    if (category === 'commoner') {
      // v7.1·audit P1·扩 keyword·绍宋 classes 含"农/工匠"等
      keywords = ['寒门', '寒族', '庶族', '庶民', '平民', '黎庶', '百姓', '农', '工匠'];
    } else if (category === 'aristocrat') {
      // v7.1·audit P1·扩 keyword·绍宋 classes 含"士大夫/士绅/宗室"等
      keywords = ['门阀', '望族', '士族', '士大夫', '士绅', '贵族', '勋贵', '显宦', '宗室'];
    } else {
      return null;
    }
    for (var i = 0; i < GM.classes.length; i++) {
      var name = (GM.classes[i] && GM.classes[i].name) || '';
      for (var j = 0; j < keywords.length; j++) {
        if (name.indexOf(keywords[j]) >= 0) return name;
      }
    }
    return null;
  }

  /**
   * _kjBumpSatisfaction(className, delta, reason)
   * 阶层满意度调整·缺类 graceful skip·返 boolean (true=已调)。
   */
  function _kjBumpSatisfaction(className, delta, reason) {
    var GM = (typeof window !== 'undefined' && window.GM) || (typeof global !== 'undefined' && global.GM);
    if (!className || !GM || !GM.classes) return false;
    var cls = GM.classes.find(function (c) { return c && c.name === className; });
    if (!cls) return false;
    var TMx = (typeof window !== 'undefined' && window.TM) || (typeof global !== 'undefined' && global.TM);
    if (TMx && TMx.ClassEngine && typeof TMx.ClassEngine.gateSatisfaction === 'function') {
      TMx.ClassEngine.gateSatisfaction(GM, cls, delta, { turn: GM.turn, source: 'keju', reason: reason || '殿试' });
    } else {
      var cur = (typeof cls.satisfaction === 'number') ? cls.satisfaction : 50;
      cls.satisfaction = Math.max(0, Math.min(100, cur + delta));
    }
    if (typeof addEB === 'function') {
      addEB('阶层', className + (delta >= 0 ? '+' : '') + delta + '·' + (reason || ''));
    }
    return true;
  }

  /**
   * _kjQinDianPickPartyEffects(slot, ch, examiner)
   * 钦点三甲·党争联动·剧本无关。
   * 4 分支·
   *  - 同党 → tension+2
   *  - 已知反方 (走 _kjGetEnemyParties) → tension+3
   *  - 异党 (非已知反方) → tension+1
   *  - 任一无党 → skip
   * 非 examiner 前 3 建议 → 皇威+5·中立派 affinity+3。
   */
  function _kjQinDianPickPartyEffects(slot, ch, examiner) {
    if (!ch || !examiner) return;
    if (!ch.party || !examiner.party) return; // 无党·skip
    var updFn = (typeof window !== 'undefined' && window._kjUpdateFactionTension) ||
                (typeof _kjUpdateFactionTension === 'function' ? _kjUpdateFactionTension : null);
    if (typeof updFn !== 'function') return;

    var slotLabel = { zhuangyuan: '状元', bangyan: '榜眼', tanhua: '探花' }[slot] || slot;

    if (ch.party === examiner.party) {
      updFn({ party: examiner.party, delta: +2, reason: '钦点同党·' + slotLabel });
    } else {
      var enemyFn = (typeof window !== 'undefined' && window._kjGetEnemyParties) ||
                    (typeof _kjGetEnemyParties === 'function' ? _kjGetEnemyParties : null);
      var enemies = (typeof enemyFn === 'function') ? (enemyFn(examiner.party) || []) : [];
      if (enemies.indexOf(ch.party) >= 0) {
        updFn({ party: ch.party, delta: +3, reason: '钦点主考反方·' + slotLabel });
      } else {
        updFn({ party: ch.party, delta: +1, reason: '钦点异党·' + slotLabel });
      }
    }

    // 非 examiner 前 3 建议·prestige+5 (走 _adjustHuangwei·缺 _adjustPrestige) + 中立派 affinity+3
    var sugs = (typeof P !== 'undefined' && P.keju && P.keju.currentExam && P.keju.currentExam.examinerSuggestions) || {};
    var chiefKey = Object.keys(sugs).find(function (k) { return k.indexOf(examiner.name) === 0; });
    var chiefTop3 = chiefKey ? (sugs[chiefKey] || []).slice(0, 3).map(function (s) { return s.name; }) : [];
    if (chiefTop3.length && chiefTop3.indexOf(ch.name) < 0) {
      var hwFn = (typeof _adjustPrestige === 'function') ? _adjustPrestige :
                 (typeof _adjustHuangwei === 'function') ? _adjustHuangwei : null;
      if (hwFn) hwFn(+5, '钦点独断·非主考所荐·' + slotLabel);

      var GM = (typeof window !== 'undefined' && window.GM) || (typeof global !== 'undefined' && global.GM);
      var P_ = (typeof window !== 'undefined' && window.P) || (typeof global !== 'undefined' && global.P);
      var playerName = (P_ && P_.playerInfo && P_.playerInfo.characterName) || '陛下';
      var neutrals = ((GM && GM.chars) || []).filter(function (c) {
        return c && c.alive !== false && (!c.party || c.party === '中立' || c.party === '无党' || c.party === '无党派');
      }).slice(0, 5);
      if (typeof AffinityMap !== 'undefined' && AffinityMap && typeof AffinityMap.add === 'function') {
        neutrals.forEach(function (c) {
          try { AffinityMap.add(c.name, playerName, +3, '陛下独断·中立派敬'); } catch (_) {}
        });
      }
    }
  }

  /**
   * _kjCommonerZhuangyuanEvent(ch)
   * 寒门状元事件·剧本无关·读 GM.classes 寒门/门阀 fallback·全缺 skip event·prestige 仍走 party effects。
   */
  function _kjCommonerZhuangyuanEvent(ch) {
    if (!ch) return;
    var familyTier = String(ch.familyTier || '');
    var className = String(ch.class || ch.socialClass || ch.className || ch.origin || '');
    if (familyTier !== 'common' && familyTier !== 'commoner' && !/寒门|庶|平民|百姓|农|工匠/.test(className)) return;

    var commonerCls = _kjResolveClassName('commoner');
    var aristocratCls = _kjResolveClassName('aristocrat');

    var fired = false;
    if (commonerCls) {
      _kjBumpSatisfaction(commonerCls, +10, '寒门状元·' + ch.name + '·跃龙门');
      fired = true;
    }
    if (aristocratCls) {
      _kjBumpSatisfaction(aristocratCls, -5, '寒门压门阀·' + ch.name);
      fired = true;
    }

    if (fired) {
      if (typeof toast === 'function') toast('🌟 寒门状元·' + ch.name + '·跃龙门');
      if (typeof addEB === 'function') addEB('科举', '寒门状元·' + ch.name);
      if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem && typeof NpcMemorySystem.remember === 'function') {
        var P_ = (typeof window !== 'undefined' && window.P) || (typeof global !== 'undefined' && global.P);
        var playerName = (P_ && P_.playerInfo && P_.playerInfo.characterName) || '陛下';
        try {
          NpcMemorySystem.remember(ch.name, '蒙陛下亲点状元·寒门跃龙门·誓死报国', '喜', 9, playerName);
        } catch (_) {}
      }
    }
    // 无寒门/门阀·skip event 但 prestige + affinity 由 _kjQinDianPickPartyEffects 走
  }

  /**
   * _kjExaminerBiasWarning(top20, examiner)
   * 失败 UX·若 20 卷无 examiner.preferRegion 籍贯 → toast warning + 皇威+3。
   */
  function _kjExaminerBiasWarning(top20, examiner) {
    if (!examiner || !top20 || !top20.length) return;
    var viewFn = (typeof window !== 'undefined' && window._kejuExaminerView) ||
                 (typeof _kejuExaminerView === 'function' ? _kejuExaminerView : null);
    if (typeof viewFn !== 'function') return;
    var view;
    try { view = viewFn(examiner); } catch (_) { return; }
    if (!view || !view.preferRegion) return;

    var matched = top20.some(function (c) {
      var bp = c && (c.birthplace || c.origin);
      return bp && bp.indexOf(view.preferRegion) >= 0;
    });
    if (!matched) {
      if (typeof toast === 'function') toast('⚠ 主考有偏·20卷无 ' + view.preferRegion + ' 籍·陛下不偏');
      var hwFn = (typeof _adjustPrestige === 'function') ? _adjustPrestige :
                 (typeof _adjustHuangwei === 'function') ? _adjustHuangwei : null;
      if (hwFn) hwFn(+3, '主考有偏·陛下持平');
      if (typeof addEB === 'function') addEB('科举', '主考有偏·陛下持平·prestige+3');
    }
  }

  /**
   * _kjConfirmRankingEffects(ranking, exam)
   * confirmFinalRanking 时调·跑·
   *  1) 3 甲党争·_kjQinDianPickPartyEffects
   *  2) 寒门状元·_kjCommonerZhuangyuanEvent
   *  3) 失败 UX·_kjExaminerBiasWarning
   */
  function _kjConfirmRankingEffects(ranking, exam) {
    if (!ranking || !exam || !exam.chiefExaminer) return;
    var examiner = (typeof findCharByName === 'function') ? findCharByName(exam.chiefExaminer) : null;
    if (!examiner) return;

    // 3 甲·每个跑党争 effects
    ['zhuangyuan', 'bangyan', 'tanhua'].forEach(function (slot) {
      var name = ranking[slot];
      if (!name) return;
      var ch = (typeof findCharByName === 'function') ? findCharByName(name) : null;
      if (!ch) return;
      try { _kjQinDianPickPartyEffects(slot, ch, examiner); }
      catch (e) { console.warn('[D4] party effects ' + slot + ' 失败', e); }
    });

    // 寒门状元 event (仅状元·非榜眼/探花)
    var zyName = ranking.zhuangyuan;
    if (zyName) {
      var zyCh = (typeof findCharByName === 'function') ? findCharByName(zyName) : null;
      if (zyCh) {
        try { _kjCommonerZhuangyuanEvent(zyCh); }
        catch (e) { console.warn('[D4] commoner zy event 失败', e); }
      }
    }

    // 失败 UX·主考有偏
    var resultsArr = exam.dianshiResults || exam.dianshiCandidates || [];
    var top20 = resultsArr.map(function (c) {
      var name = (typeof c === 'string') ? c : (c && c.name);
      if (!name) return c;
      return (typeof findCharByName === 'function' ? findCharByName(name) : null) || c;
    }).filter(Boolean);
    try { _kjExaminerBiasWarning(top20, examiner); }
    catch (e) { console.warn('[D4] bias warning 失败', e); }
  }

  // 暴露
  if (typeof window !== 'undefined') {
    window._kjResolveClassName        = _kjResolveClassName;
    window._kjBumpSatisfaction        = _kjBumpSatisfaction;
    window._kjQinDianPickPartyEffects = _kjQinDianPickPartyEffects;
    window._kjCommonerZhuangyuanEvent = _kjCommonerZhuangyuanEvent;
    window._kjExaminerBiasWarning     = _kjExaminerBiasWarning;
    window._kjConfirmRankingEffects   = _kjConfirmRankingEffects;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      _kjResolveClassName: _kjResolveClassName,
      _kjBumpSatisfaction: _kjBumpSatisfaction,
      _kjQinDianPickPartyEffects: _kjQinDianPickPartyEffects,
      _kjCommonerZhuangyuanEvent: _kjCommonerZhuangyuanEvent,
      _kjExaminerBiasWarning: _kjExaminerBiasWarning,
      _kjConfirmRankingEffects: _kjConfirmRankingEffects
    };
  }
})();

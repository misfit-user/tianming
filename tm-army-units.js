/* tm-army-units.js — 御驾亲征接入 · Phase 0「编制地基」
 * 把 army 现有 composition:[{type,count}] 派生为持久 units[](队·每队≤1000人·"填满+余数")。
 * composition 原样保留(作自动同步摘要·所有现成读者不受影响);units[] 是接入实时战术战斗的数据脊梁。
 * 兵种识别走「五级瀑布」(见集成设计文档 §3/§12.2):①结构化标签 ②字根/部首(主力·朝代中立) ③装备反推 ④LLM(待Phase4) ⑤杂兵兜底。
 * 朝代中立(CLAUDE.md 红线):识别匹配字根非整词·不锁单朝。纯数据派生·载入时一次性·幂等·永不崩(失败保留 composition·不破存档)。
 * 此文件只定义 window.TMArmyUnits·不改任何 composition 读者·零运行时行为变更(无消费方时纯增量)。
 */
(function () {
  'use strict';

  /* 字根表(§12.2)·望文生义匹配字根而非整词→杜撰词(象兵/白杆兵/藤甲)多被接住 */
  /* 「枪」一字两义:长枪(冷兵)vs 火枪(枪械)。FIREARM_QIANG=火器语境的「枪」(燧发枪/步枪/火绳枪…)→归 musket·非长枪 */
  var FIREARM_QIANG = /(?:燧发|火绳|火|步|手|洋|排|滑膛|线膛|来复|毛瑟|卡宾|机关|机|冲锋|猎|霰弹|连珠|转轮|自动|半自动|加特林|马克沁)枪/;
  var RX = {
    art:      /炮|砲|熕|红夷|佛朗机|虎蹲|楼车|车营|回回|砲车/,
    /* 近代火器步兵(无「枪」字者):掷弹兵/散兵/猎兵/线列…直接归 musket;带「枪」者经 FIREARM_QIANG 消歧 */
    musket:   new RegExp('铳|鸟铳|三眼|火器|火铳|铅子|铅弹|快枪|神机|线列|排铳|掷弹|散兵|猎兵|' + FIREARM_QIANG.source),
    crossbow: /弩|神臂|劲弩|床弩/,
    bow:      /弓|矢|箭|射/,
    halberd:  /戟|镋|钯|筅|狼筅/,
    spear:    /枪|矛|槊|殳|杆/,
    sword:    /刀|剑|牌|盾|斧|锤|镖/,
    horse:    /骑|马|骠|骁|驎|拐子/
  };
  /* 长枪判定:有矛/槊/殳/杆=真长枪;有「枪」须剔除火器枪后仍余独立「枪」才算(燧发枪兵→火铳·非长枪;长枪+燧发枪混编→长枪+火铳) */
  function hasSpear(s) {
    if (/矛|槊|殳|杆/.test(s)) return true;
    if (!/枪/.test(s)) return false;
    return /枪/.test(s.replace(new RegExp(FIREARM_QIANG.source, 'g'), ''));
  }
  /* 修饰位(独立叠 flag·不改基础桶) */
  var MOD = {
    guard:   /御营|亲军|禁卫|羽林|大内|宿卫|锦衣/,
    elite:   /卫|锐|陷|牙|亲|家丁|白甲|护军|选锋|精|劲|敢死|背嵬/,
    heavy:   /甲|铁|具装|重装|浮屠|铁浮|重甲|铁骑/,
    shield:  /牌|盾|藤牌/,
    baggage: /辎|辅|夫|工|粮|弹药|运卒|辎重|民壮/
  };

  /* ── 兵种识别第4层:已学词典(learnUnknownTypes 用次级 LLM 归类生僻名·记忆化沉淀·同步命中)── */
  var _LEX = {};                                    // normKey → {arm,sub}·会话内活缓存(_syncLexicon 从 GM._unitLexicon 水合)
  var _VALID_ARM = { step: 1, cav: 1, bow: 1, art: 1, guard: 1 };
  function _normType(s) { return String(s == null ? '' : s).replace(/\s+/g, ''); }
  function _defSub(arm) { return arm === 'cav' ? 'horse' : arm === 'bow' ? 'bow' : arm === 'art' ? 'cannon' : arm === 'guard' ? 'guard' : 'sword'; }
  /* 从 GM._unitLexicon(持久·随存档)水合活缓存·载入/学习后调 */
  function _syncLexicon(g) {
    try { var lx = g && g._unitLexicon; if (lx && typeof lx === 'object') { for (var k in lx) { if (lx[k] && _VALID_ARM[lx[k].arm]) _LEX[k] = { arm: lx[k].arm, sub: lx[k].sub || _defSub(lx[k].arm) }; } } } catch (e) {}
  }
  /* BYOK 就绪(读全局 localStorage.tm_api 的 key·无 key→不触发失败 LLM 调用) */
  function _aiReady() {
    try { if (typeof localStorage === 'undefined') return false; var cfg = JSON.parse(localStorage.getItem('tm_api') || '{}'); return !!(cfg && (cfg.key || cfg.apiKey)); } catch (e) { return false; }
  }

  /* 兵种识别瀑布 → {arm(step/cav/bow/art/guard), sub, flags[], src} */
  function classifyUnitType(typeStr, army) {
    var s = String(typeStr == null ? '' : typeStr);
    var flags = [];
    if (MOD.elite.test(s))   flags.push('elite');
    if (MOD.heavy.test(s))   flags.push('heavy');
    if (MOD.shield.test(s))  flags.push('shield');
    if (MOD.baggage.test(s)) flags.push('baggage');

    /* level1:结构化标签优先(若 composition 条目带显式 unitTypeId/arm 枚举) */
    // (当前 composition 仅 {type,count}·留接口·暂无结构化枚举)

    /* 御营/亲军 → guard(独立兵种) */
    if (MOD.guard.test(s)) return { arm: 'guard', sub: 'guard', flags: flags, src: 'radical' };

    /* 机枪/速射火器:明确火器·先于骑射(否则"马克沁机枪"的「马」被当战马误判骑射) */
    if (/机枪|加特林|马克沁/.test(s)) return { arm: 'bow', sub: 'musket', flags: flags, src: 'radical' };

    /* 骑射特办:有"骑/马"且有远程字根(弓/弩/铳)→骑射(cav·骑射手)·先于字根顺序(否则"弓骑"被弓抢成步弓) */
    if (RX.horse.test(s) && (RX.bow.test(s) || RX.crossbow.test(s) || RX.musket.test(s)))
      return { arm: 'cav', sub: 'horse', flags: flags, src: 'radical' };

    /* 骑乘近战:有"骑"且有近战字根(枪/矛/刀/槊/戟…)→骑兵(枪骑兵=lancer·非步兵长枪·先于步兵字根·用「骑」非「马」避开马克沁等) */
    if (/骑/.test(s) && (hasSpear(s) || RX.sword.test(s) || RX.halberd.test(s)))
      return { arm: 'cav', sub: (flags.indexOf('heavy') >= 0 ? 'heavy' : (flags.indexOf('elite') >= 0 ? 'shock' : 'horse')), flags: flags, src: 'radical' };

    var arm = null, sub = null;
    /* level2:字根(主力)·优先级 高→低 */
    if (RX.art.test(s))           { arm = 'art';  sub = 'cannon'; }
    else if (RX.musket.test(s))   { arm = 'bow';  sub = 'musket'; }
    else if (RX.crossbow.test(s)) { arm = 'bow';  sub = 'crossbow'; }
    else if (RX.bow.test(s))      { arm = 'bow';  sub = 'bow'; }
    else if (RX.halberd.test(s))  { arm = 'step'; sub = 'halberd'; }
    else if (hasSpear(s))         { arm = 'step'; sub = 'spear'; }
    else if (RX.horse.test(s))    { arm = 'cav';  sub = (flags.indexOf('heavy') >= 0 ? 'heavy' : (flags.indexOf('elite') >= 0 ? 'shock' : 'horse')); }
    else if (RX.sword.test(s))    { arm = 'step'; sub = 'sword'; }

    if (arm) return { arm: arm, sub: sub, flags: flags, src: 'radical' };

    /* level3:装备反推(名字不透明→翻母军 equipment[]) */
    var eq = army && army.equipment;
    if (Array.isArray(eq) && eq.length) {
      var ej = eq.join(' ');
      if (RX.art.test(ej))           return { arm: 'art',  sub: 'cannon',   flags: flags, src: 'equipment' };
      if (RX.musket.test(ej))        return { arm: 'bow',  sub: 'musket',   flags: flags, src: 'equipment' };
      if (RX.horse.test(ej) || /战马|乘马/.test(ej)) return { arm: 'cav', sub: (flags.indexOf('heavy') >= 0 ? 'heavy' : 'horse'), flags: flags, src: 'equipment' };
      if (RX.crossbow.test(ej))      return { arm: 'bow',  sub: 'crossbow', flags: flags, src: 'equipment' };
      if (RX.bow.test(ej))           return { arm: 'bow',  sub: 'bow',      flags: flags, src: 'equipment' };
      if (RX.spear.test(ej))         return { arm: 'step', sub: 'spear',    flags: flags, src: 'equipment' };
    }

    /* level4:已学词典(learnUnknownTypes 沉淀·次级 LLM 归类生僻名·同步命中·前三层接不住的开放词) */
    var _lk = _LEX[_normType(s)];
    if (_lk && _VALID_ARM[_lk.arm]) return { arm: _lk.arm, sub: _lk.sub || _defSub(_lk.arm), flags: flags, src: 'lexicon' };

    /* level5:杂兵兜底(中庸近战·无专长 flag)·永不崩 */
    flags.push('miscellaneous');
    return { arm: 'step', sub: 'sword', flags: flags, src: 'fallback' };
  }

  /* 检测一个条目里出现的「非骑」武器类别(按优先级·去重)→ 供混编拆分。刀/牌同属短兵(只记一次) */
  function detectWeaponCats(s) {
    var cats = [];
    function add(arm, sub) { for (var i = 0; i < cats.length; i++) if (cats[i].sub === sub) return; cats.push({ arm: arm, sub: sub }); }
    if (RX.art.test(s))      add('art', 'cannon');
    if (RX.musket.test(s))   add('bow', 'musket');
    if (RX.crossbow.test(s)) add('bow', 'crossbow');
    if (RX.bow.test(s))      add('bow', 'bow');
    if (RX.halberd.test(s))  add('step', 'halberd');
    if (hasSpear(s))         add('step', 'spear');
    if (RX.sword.test(s))    add('step', 'sword');
    return cats;
  }

  /* 混编拆分(§12.2):一个 composition 条目含多种武器字根(如"长矛刀牌"/"弓弩手")→拆成多兵种·按权重分人数。
   * 骑/御营/杂兵/装备反推得来者不拆(单一);多武器才拆·首类(主武器)略加权。 */
  function splitTypeMix(typeStr, army) {
    var s = String(typeStr == null ? '' : typeStr);
    var single = classifyUnitType(s, army);
    if (single.arm === 'guard' || single.arm === 'cav' || single.src === 'fallback' || single.src === 'equipment' || single.src === 'lexicon')
      return [{ arm: single.arm, sub: single.sub, flags: single.flags.slice(), weight: 1, src: single.src }];
    var cats = detectWeaponCats(s);
    if (cats.length <= 1)
      return [{ arm: single.arm, sub: single.sub, flags: single.flags.slice(), weight: 1, src: single.src }];
    return cats.map(function (c, i) {
      return { arm: c.arm, sub: c.sub, flags: single.flags.slice(), weight: (i === 0 ? 1.2 : 1), src: 'mixed' };
    });
  }

  /* 一段人数 → 队 size 列表(填满+余数·≤1000)+ 防碎牌(§12.1:余队<200 并入同兵种相邻队) */
  function splitMen(total) {
    var sizes = [], rem = Math.max(0, Math.round(total));
    while (rem > 0) { var men = Math.min(1000, rem); sizes.push(men); rem -= men; }
    if (sizes.length >= 2 && sizes[sizes.length - 1] < 200) { sizes[sizes.length - 2] += sizes.pop(); }   // 防碎牌:尾队<200并入前队(宁可一队略超编·不留幽灵小队)
    return sizes;
  }

  /* 历练初值(§12.3)·按品质映射(新募~15·精锐稀有) */
  function vetFromQuality(q) {
    q = String(q == null ? '' : q);
    if (/精锐|百战|劲旅/.test(q)) return 55;
    if (/精兵/.test(q)) return 40;
    if (/普通/.test(q)) return 25;
    if (/新兵|新募|乌合|老弱|羸|疲|屯田/.test(q)) return 15;
    return 20;
  }

  /* ═══════════ 历练(veterancy)持久化 + 战后增长/稀释(§12.3·御驾亲征 Phase3 整编屏地基) ═══════════
   * 模型:units[] 历练 = vetFromQuality(quality) 基线 + army.veterancy(战后累计·数值·持久)·army 级统一(units[] 是派生视图)。
   * army.veterancy 纳入 compSig→变则重派(签名自愈)·effective 历练封顶 90。本组纯逻辑·活线接入(flag-gated 会战阶段)属后续刀。
   * 注:veterancy 默认 0/未设→effectiveVet = 基线·与改动前完全一致(零行为变更·须 gain 后才升)。 */
  function _vnum(x) { x = +x; return isFinite(x) ? x : 0; }
  function clampVet(v) { return Math.max(0, Math.min(90, Math.round(_vnum(v)))); }
  /* 一军当前有效历练 = 品质基线 + 累计 veterancy(封顶90) */
  function effectiveVet(army) { return clampVet(vetFromQuality(army && army.quality) + _vnum(army && army.veterancy)); }
  /* 战后历练增长(§12.3):烈度=该军减员率·Δ=4+6×烈度+血战加成(减员率>0.4 加4)·递减×(1−当前历练/100)·封顶90。返实得Δ。 */
  function gainBattleVeterancy(army, lossRatio) {
    if (!army) return 0;
    var lr = Math.max(0, Math.min(1, _vnum(lossRatio)));
    var cur = effectiveVet(army);
    var raw = 4 + 6 * lr + (lr > 0.4 ? 4 : 0);          // 轻松≈4 / 苦战≈10 / 血战≈14
    var delta = Math.round(raw * (1 - cur / 100));       // 递减:精锐稀有(70→85 远慢于 10→50)
    if (delta <= 0) return 0;
    var base = vetFromQuality(army.quality);
    var maxBonus = Math.max(0, 90 - base);               // effective 封顶90
    var before = _vnum(army.veterancy);
    army.veterancy = Math.min(maxBonus, before + delta);
    army._unitsStale = true;                              // 标脏→下次 ensure 重派(units[] 历练随之更新)
    return Math.round(army.veterancy - before);
  }
  /* 新兵稀释老兵(§12.3):oldCount 老兵(当前有效历练)+ newCount 新募(历练15)→加权平均·写回 veterancy 持久。返稀释后有效历练。 */
  function diluteVeterancy(army, oldCount, newCount) {
    if (!army) return 0;
    oldCount = Math.max(0, _vnum(oldCount)); newCount = Math.max(0, _vnum(newCount));
    if (newCount <= 0) return effectiveVet(army);
    var oldEff = effectiveVet(army), recruitVet = 15;    // §12.3 新募初值
    var blended = (oldCount * oldEff + newCount * recruitVet) / Math.max(1, oldCount + newCount);
    var base = vetFromQuality(army.quality);
    army.veterancy = Math.max(0, Math.round(blended - base));
    army._unitsStale = true;
    return clampVet(blended);
  }

  /* composition → units[]:混编拆分(§12.2)→每兵种"填满+余数"切队(≤1000)+防碎牌(§12.1)·总人数守恒 */
  function deriveArmyUnits(army) {
    if (!army) return [];
    var comp = (army.composition && Array.isArray(army.composition) && army.composition.length) ? army.composition : null;
    if (!comp) {
      /* 无 composition → 用总兵力兜底成一种(永不崩) */
      var tot0 = Math.max(0, Math.round(army.soldiers || army.strength || army.size || 0));
      if (!tot0) return [];
      comp = [{ type: army.quality || '杂兵', count: tot0 }];
    }
    // ★units 反映真实兵力(整编屏刀4):战损/募兵后 army.soldiers 变而 composition 未同步→按比例缩放·避免 units[] 陈旧(整编随之自动·填满+余数自然合并残队)
    var _compSum = 0; comp.forEach(function (c) { _compSum += Math.max(0, Math.round((c && c.count) || 0)); });
    var _total;
    if (typeof army.soldiers === 'number' && isFinite(army.soldiers)) _total = Math.max(0, Math.round(army.soldiers));        // soldiers 为数(含0)→权威总兵力·0则全歼→units空
    else if (typeof army.strength === 'number' && isFinite(army.strength)) _total = Math.max(0, Math.round(army.strength));
    else if (typeof army.size === 'number' && isFinite(army.size)) _total = Math.max(0, Math.round(army.size));
    else _total = _compSum;                                  // 兵力字段都未设→用 composition 和(向后兼容)
    var _scale = (_compSum > 0) ? (_total / _compSum) : 1;   // 真实兵力 ÷ 编制和·=1 无变化(新军/已同步=零行为变更)
    var units = [], uid = 0, vet = effectiveVet(army), aid = army.id || army.name || 'army';   // 历练=品质基线+累计veterancy(veterancy=0时=基线·不变)
    comp.forEach(function (c) {
      var type = (c && (c.type || c.unitTypeId)) || '杂兵';
      var count = Math.max(0, Math.round(((c && c.count) || 0) * _scale));   // ★按真实兵力缩放(战损/募兵反映·_scale=1时不变)
      if (!count) return;
      var parts = splitTypeMix(type, army);          // 混编→多兵种(单一则1个)
      var wsum = 0; parts.forEach(function (p) { wsum += p.weight; });
      var alloc = 0;
      parts.forEach(function (p, pi) {
        var pc = (pi === parts.length - 1) ? (count - alloc) : Math.round(count * p.weight / wsum);   // 末部分领余数→总数守恒
        alloc += pc;
        if (pc <= 0) return;
        splitMen(pc).forEach(function (men) {        // 填满+余数+防碎牌
          units.push({
            id: aid + '#u' + (uid++),
            番号: type, name: type,
            arm: p.arm, sub: p.sub, tacClass: p.arm + '/' + p.sub, flags: p.flags.slice(),
            men: men, 历练: vet,
            status: men >= 1000 ? '满编' : '不满编',
            parentArmyId: aid
          });
        });
      });
    });
    return units;
  }

  /* 派生源签名(composition + 总兵力 + 品质):源一变→签名变→下次 ensure 自动重派。
   * ★这是应对「玩家扩军裁军」+「AI 高自由度推演改军」的关键:units[] 是派生视图·按源签名自愈·
   *   无须在 660 文件里逐个 mutation 点埋同步钩(AI 自由度高必漏)·渲染时 ensure 即得最新。 */
  function compSig(army) {
    var c = army && army.composition;
    var base = (Array.isArray(c) && c.length)
      ? c.map(function (x) { return (x && (x.type || x.unitTypeId) || '') + ':' + Math.round((x && x.count) || 0); }).join('|')
      : 'S';
    return base + '#' + Math.round((army && (army.soldiers || army.strength || army.size)) || 0) + '@' + String((army && army.quality) || '') + '^' + clampVet(army && army.veterancy);   // ^veterancy 纳入签名→战后历练增长触发重派
  }
  /* 幂等 + 自愈:无 units[] / 源签名变 / 标脏 → 重派;否则原样返回(渲染热路径可放心每帧调) */
  function ensureArmyUnits(army) {
    if (!army) return [];
    var sig = compSig(army);
    if (!Array.isArray(army.units) || army._unitsSig !== sig || army._unitsStale) {
      army.units = deriveArmyUnits(army);
      army._unitsSig = sig;
      army._unitsStale = false;
    }
    return army.units;
  }

  /* 全军派生(载入钩子用)·永不崩:单军失败保留 composition·置空 units·不阻断其余 */
  function ensureAllArmies(GMref) {
    var g = GMref || (typeof GM !== 'undefined' ? GM : (typeof window !== 'undefined' ? window.GM : null));
    _syncLexicon(g);                                 // 水合已学词典→本轮派生命中 lexicon 层
    var ok = 0, fail = 0;
    if (g && Array.isArray(g.armies)) {
      for (var i = 0; i < g.armies.length; i++) {
        var a = g.armies[i];
        try { ensureArmyUnits(a); ok++; }
        catch (e) { fail++; if (a && !Array.isArray(a.units)) a.units = []; }
      }
    }
    return { ok: ok, fail: fail };
  }

  /* 次级 LLM 归类 prompt(朝代中立·枚举给定 arm/sub·JSON 数组输出) */
  function _buildLexiconPrompt(names) {
    return '你是兵种归类器。把下列（前几层字根/装备规则接不住的）生僻/架空/近代兵种名，各归入一个基础兵种。\n'
      + '【arm 枚举】step(步兵) cav(骑兵) bow(远程) art(火炮) guard(禁卫/精锐护卫)\n'
      + '【sub 枚举】sword(刀盾/短兵) spear(长枪/矛) halberd(戟镋钯) bow(弓) crossbow(弩) musket(火铳/火枪) horse(骑乘) heavy(重甲骑) shock(冲击骑) cannon(炮) guard(禁卫)\n'
      + '规则:按名字语义与武器/机动特征归类·朝代中立(古今中外架空皆可)·拿不准就归最接近的桶。\n'
      + '只输出 JSON 数组,每项 {"name":"原名","arm":"...","sub":"..."},不要解释。\n'
      + '待归类:\n' + names.map(function (n, i) { return (i + 1) + '. ' + n; }).join('\n');
  }
  /* 解析回复 → {normKey: {arm,sub}}(robust·剥 code fence·容错) */
  function _parseLexiconReply(raw) {
    var out = {};
    if (!raw) return out;
    var t = String(raw).replace(/```json/gi, '').replace(/```/g, '').trim();
    var arr = null;
    try { arr = JSON.parse(t); } catch (e) { var m = t.match(/\[[\s\S]*\]/); if (m) { try { arr = JSON.parse(m[0]); } catch (e2) {} } }
    if (!Array.isArray(arr)) return out;
    arr.forEach(function (o) { if (o && o.name && _VALID_ARM[o.arm]) out[_normType(o.name)] = { arm: o.arm, sub: o.sub || _defSub(o.arm) }; });
    return out;
  }
  /* 第4层活线:扫兜底(fallback)兵种名 → 次级 LLM 归类 → 写持久词典 GM._unitLexicon+活缓存 → 标受影响军 _unitsStale
   * (签名自愈重派→命中词典层)。记忆化(只问一次·负缓存 _unitLexiconMiss)·无 key/无生僻则 no-op·永不崩·异步(会战阶段前调·出热路径)。
   * opts:{callAI(测试注入),cap=40,maxTok=900,maxRetries=1} */
  function learnUnknownTypes(GMref, opts) {
    opts = opts || {};
    var g = GMref || (typeof GM !== 'undefined' ? GM : (typeof window !== 'undefined' ? window.GM : null));
    if (!g || !Array.isArray(g.armies)) return Promise.resolve({ learned: 0, reason: 'no-armies' });
    _syncLexicon(g);
    g._unitLexicon = g._unitLexicon || {};
    g._unitLexiconMiss = g._unitLexiconMiss || {};
    var unknown = {};
    g.armies.forEach(function (a) {
      if (!a || !Array.isArray(a.composition)) return;
      a.composition.forEach(function (c) {
        var type = (c && (c.type || c.unitTypeId)) || ''; if (!type) return;
        var key = _normType(type);
        if (_LEX[key] || g._unitLexicon[key] || g._unitLexiconMiss[key] || unknown[key]) return;
        try { if (classifyUnitType(type, a).src === 'fallback') unknown[key] = type; } catch (e) {}   // 只学真兜底的(前几层接不住)
      });
    });
    var keys = Object.keys(unknown);
    if (!keys.length) return Promise.resolve({ learned: 0, reason: 'none-unknown' });
    var callAI = opts.callAI || (typeof window !== 'undefined' && window.callAISmart) || (typeof callAISmart !== 'undefined' ? callAISmart : null);
    if (typeof callAI !== 'function') return Promise.resolve({ learned: 0, reason: 'no-ai', pending: keys.length });
    if (!opts.callAI && !_aiReady()) return Promise.resolve({ learned: 0, reason: 'no-key', pending: keys.length });
    var cap = opts.cap || 40;
    var batch = keys.slice(0, cap).map(function (k) { return unknown[k]; });
    return Promise.resolve().then(function () { return callAI(_buildLexiconPrompt(batch), opts.maxTok || 900, { temperature: 0, maxRetries: opts.maxRetries != null ? opts.maxRetries : 1 }); })
      .then(function (raw) {
        var parsed = _parseLexiconReply(raw), learned = 0, affected = {};
        batch.forEach(function (typeStr) {
          var key = _normType(typeStr), r = parsed[key];
          if (r && _VALID_ARM[r.arm]) { var e = { arm: r.arm, sub: r.sub || _defSub(r.arm) }; g._unitLexicon[key] = e; _LEX[key] = e; affected[key] = 1; learned++; }
          else { g._unitLexiconMiss[key] = 1; }        // 归不了→负缓存·不再问
        });
        if (learned) g.armies.forEach(function (a) { if (a && Array.isArray(a.composition) && a.composition.some(function (c) { return affected[_normType((c && (c.type || c.unitTypeId)) || '')]; })) a._unitsStale = true; });
        return { learned: learned, asked: batch.length, remaining: keys.length - batch.length };
      })
      .catch(function (e) { return { learned: 0, reason: 'ai-error', err: String((e && e.message) || e) }; });
  }

  var API = {
    deriveArmyUnits: deriveArmyUnits,
    ensureArmyUnits: ensureArmyUnits,
    ensureAllArmies: ensureAllArmies,
    classifyUnitType: classifyUnitType,
    vetFromQuality: vetFromQuality,
    effectiveVet: effectiveVet,
    gainBattleVeterancy: gainBattleVeterancy,
    diluteVeterancy: diluteVeterancy,
    compSig: compSig,
    learnUnknownTypes: learnUnknownTypes,
    _clearLexicon: function () { _LEX = {}; }         // 测试用:清活缓存(隔离用例)
  };
  if (typeof window !== 'undefined') window.TMArmyUnits = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();

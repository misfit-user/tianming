// tm-social-foundation.js — 社会层地基：阶层结构基线/稳定器 + 议程引擎 + 党派单源对账（2026-06-12）
// 三件事：
// ① 结构基线：满意度不再是「无主随机游走的积分器」——每回合从实况（税负/灾域/战区/欠饷/民心）
//    派生各阶层「应然势位」，实际满意度向它缓变回归（±1.2/回合·闸外恢复通道）。
//    暴跌必有结构性理由，低谷有恢复路径，近账可查——治「无缘无故跌到 0」。
// ② 议程引擎：诉求 = 结构化条目（seed 本位 + struct 结构触发 + ai 补充槽），按各阶层
//    暴露度确定性派生，议程必然各异且随局势消长；条件解除自动「得偿」回satisfaction——治「议程都一样」。
// ③ 党派对账：parties[]（剧本/AI/UI 面）与 partyState（引擎面）双写者每回合合流——治双源漂移。
// 跨朝代通用：只读通用引擎数据（taxFactor/statusEffects/warZone/payArrears），文案按身份桶取词，
// 朝代专名只能来自剧本 demands 种子。
(function(global) {
  'use strict';
  var TM = global.TM = global.TM || {};

  function clamp(n, min, max) {
    n = Number(n);
    if (!isFinite(n)) n = 0;
    return Math.max(min, Math.min(max, n));
  }
  function round2(n) { return Math.round(Number(n) * 100) / 100; }
  function toArray(v) {
    if (Array.isArray(v)) return v.slice();
    if (v === undefined || v === null || v === '') return [];
    return [v];
  }
  function compact(v, n) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n || 80); }
  function numOr(v, d) { var n = Number(v); return isFinite(n) ? n : d; }

  // ── 区划叶子（镜像 class-minxin-bridge 的取法） ──
  function leafDivisions(P, GM) {
    var leaves = [];
    function walk(nodes) {
      toArray(nodes).forEach(function(node) {
        if (!node || typeof node !== 'object') return;
        var kids = toArray(node.children || node.divisions || node.subs);
        if (!kids.length) leaves.push(node);
        else walk(kids);
      });
    }
    [P && P.adminHierarchy, GM && GM.adminHierarchy].forEach(function(ah) {
      if (!ah || typeof ah !== 'object' || leaves.length) return;
      if (Array.isArray(ah.divisions)) walk(ah.divisions);
      else Object.keys(ah).forEach(function(k) {
        var fac = ah[k];
        walk(fac && (fac.divisions || fac.children || fac.subs));
      });
    });
    return leaves;
  }

  // ── 结构输入：一回合算一次，挂 GM._socialStructInputs ──
  function structuralInputs(GM, P) {
    GM = GM || {};
    var turn = numOr(GM.turn, 0);
    var cached = GM._socialStructInputs;
    if (cached && cached.turn === turn) return cached;
    var leaves = leafDivisions(P, GM);
    var n = leaves.length;
    var FP = TM.FieldPipes;
    var taxSum = 0, taxN = 0, disasterN = 0, warN = 0, mxSum = 0, mxN = 0;
    leaves.forEach(function(div) {
      if (FP && typeof FP.taxBurdenFactor === 'function') {
        var tf = Number(FP.taxBurdenFactor(div));
        if (isFinite(tf) && tf > 0) { taxSum += tf; taxN++; }
      }
      var hasDisaster = toArray(div.statusEffects).some(function(e) { return e && e.kind === 'disaster'; })
        || numOr(div.disasterPenalty, 0) > 0.05;
      if (hasDisaster) disasterN++;
      if (div.warZone || div._warZone || div.isWarZone) warN++;
      var mx = Number(div.minxin);
      if (isFinite(mx)) { mxSum += mx; mxN++; }
    });
    var arrSum = 0, arrN = 0;
    toArray(GM.armies).forEach(function(a) {
      if (!a || typeof a !== 'object') return;
      arrSum += clamp(numOr(a.payArrearsMonths, 0), 0, 12);
      arrN++;
    });
    var corrSum = 0, corrN = 0;
    var subDepts = GM.corruption && GM.corruption.subDepts;
    if (subDepts && typeof subDepts === 'object') {
      Object.keys(subDepts).forEach(function(k) {
        var v = subDepts[k];
        var c = Number(v && typeof v === 'object' ? (v.corruption != null ? v.corruption : v.value) : v);
        if (isFinite(c)) { corrSum += c; corrN++; }
      });
    }
    var inputs = {
      turn: turn,
      leaves: n,
      taxFactor: taxN ? round2(taxSum / taxN) : 1,
      disasterShare: n ? round2(disasterN / n) : 0,
      warShare: n ? round2(warN / n) : 0,
      arrearsMonths: arrN ? round2(arrSum / arrN) : 0,
      minxin: mxN ? round2(mxSum / mxN) : numOr(GM.minxin && (GM.minxin.trueIndex != null ? GM.minxin.trueIndex : GM.minxin.index), 55),
      corruption: corrN ? round2(corrSum / corrN) : 0
    };
    GM._socialStructInputs = inputs;
    return inputs;
  }

  // ── 身份桶（跨朝代通用：按经济角色/通称取桶，朝代专名不进引擎） ──
  function bucketOf(cls) {
    if (!cls) return 'agrarian';
    var name = String(cls.name || '');
    var role = String(cls.economicRole || cls.role || '');
    var status = String(cls.status || '');
    if (/军|兵|卒|戍|武/.test(name) || /军/.test(status)) return 'military';
    if (/僧|道|寺|庙|教|祝|巫/.test(name) || /宗教/.test(role)) return 'clergy';
    if (/治理/.test(role) || /皇族|宗亲|贵/.test(status)) return 'governing';
    if (/商|贾|匠|工|市|坊/.test(name) || /经营|流通|工商/.test(role)) return 'trade';
    return 'agrarian';
  }

  // ── 暴露度：优先用剧本 economicIndicators，缺省按身份桶 ──
  var EXPOSURE_BY_BUCKET = {
    agrarian:  { tax: 0.8, disaster: 1.0, war: 0.6, arrears: 0 },
    trade:     { tax: 0.6, disaster: 0.5, war: 0.4, arrears: 0 },
    military:  { tax: 0.4, disaster: 0.5, war: 1.0, arrears: 1 },
    governing: { tax: 0.15, disaster: 0.3, war: 0.3, arrears: 0 },
    clergy:    { tax: 0.3, disaster: 0.6, war: 0.3, arrears: 0 }
  };
  function classExposure(cls) {
    var bucket = bucketOf(cls);
    var base = EXPOSURE_BY_BUCKET[bucket] || EXPOSURE_BY_BUCKET.agrarian;
    var exp = { bucket: bucket, tax: base.tax, disaster: base.disaster, war: base.war, arrears: base.arrears };
    var ei = cls && cls.economicIndicators;
    var tb = Number(ei && ei.taxBurden);
    if (isFinite(tb) && tb >= 0) exp.tax = round2(clamp(tb / 100, 0, 1));
    // E·描述符 fiscalStatus 驱动税/饷暴露（开放词表·优免→加派 incidence≈0·负担挤到编户自动涌现；受饷→吃欠饷）
    var fs = cls && cls.descriptor && cls.descriptor.fiscalStatus;
    if (fs === '优免') exp.tax = Math.min(exp.tax, 0.05);
    else if (fs === '法外') exp.tax = Math.min(exp.tax, 0.1);
    else if (fs === '受饷') exp.arrears = Math.max(exp.arrears, 1);
    return exp;
  }

  // ── E·阶层描述符 schema + 现生对账（2026-06-16·未 ship 未 commit）──
  //   多标签描述符：stratum（上/中/下·唯一强制闭合字段·保底地板）+ economicBase/fiscalStatus/unrestArchetype（开放词表）。
  //   主标+对账兜底：AI/种子给的 cls.descriptor 可选非阻塞（sticky·只补缺·尊重表外原词）；确定性对账器从 economicRole/name/privileges 派生缺栏。
  //   开放词表+待补账：开放栏出现表外 novel 标签→记 GM._descriptorLedger（高频者后续升格配专属驱动）。描述符是 sticky 输入·SoL/满意度仍每回合派生。
  var _DESC_KNOWN = {
    stratum: ['上', '中', '下'],
    fiscalStatus: ['优免', '编户', '受饷', '法外'],
    unrestArchetype: ['暴烈', '撤离', '不合作', '哗变', '倒戈', '请愿']
  };
  function _descStratum(cls) {
    var infl = Number(cls.influence);
    var nm = String(cls.name || '') + String(cls.status || '');
    var role = String(cls.economicRole || cls.role || '');
    if (/士|绅|宗室|皇|贵|官|阀|世家|高门/.test(nm) || /治理/.test(role) || (isFinite(infl) && infl >= 60)) return '上';
    if (/农|佃|流|匠|工|卒|贱|奴|乐户|疍/.test(nm) || (isFinite(infl) && infl <= 25)) return '下';
    return '中';
  }
  function _descFiscal(cls) {
    var t = String(cls.privileges || '') + String(cls.obligations || '') + String(cls.status || '') + String(cls.name || '');
    if (/免徭役|免杂税|优免|免科|免税|不纳税|不服役/.test(t) || /宗室|皇族/.test(String(cls.name || ''))) return '优免';
    if (/军籍|受饷|饷/.test(t)) return '受饷';
    if (/法外|隐户|逃户|无籍|流民/.test(t)) return '法外';
    return '编户';
  }
  function _descEconBase(cls) {
    var role = String(cls.economicRole || ''), nm = String(cls.name || '');
    if (/自耕/.test(nm)) return '自耕';
    if (/佃/.test(nm)) return '佃租';
    if (/绅|地主|豪强/.test(nm)) return '地租';
    if (/商|贾/.test(nm) || /商贸|流通/.test(role)) return '工商';
    if (/匠|工/.test(nm) || /手工/.test(role)) return '工役';
    if (/军|卒|戍/.test(nm) || /军事/.test(role)) return '俸饷';
    if (/僧|道|寺|教/.test(nm)) return '教权';
    if (/治理/.test(role)) return '俸禄';
    return role || '杂业';
  }
  function _descUnrest(cls, stratum, bucket) {
    if (bucket === 'military') return '哗变';
    if (stratum === '上') return '不合作';   // 隐田/抗税/通敌——上层安静而致命
    if (bucket === 'trade') return '撤离';    // 逃税/外流
    if (stratum === '下') return '暴烈';      // 揭竿/流寇
    return '请愿';
  }
  function reconcileClassDescriptor(cls, root) {
    if (!cls || typeof cls !== 'object') return null;
    var d = (cls.descriptor && typeof cls.descriptor === 'object') ? cls.descriptor : {};
    // stratum 强制闭合地板（缺失/非法值→派生纠正）
    if (!d.stratum || _DESC_KNOWN.stratum.indexOf(d.stratum) < 0) d.stratum = _descStratum(cls);
    // 开放词表三栏：缺则派生·有则尊重（含表外原词）
    if (!d.fiscalStatus) d.fiscalStatus = _descFiscal(cls);
    if (!d.economicBase) d.economicBase = _descEconBase(cls);
    if (!d.unrestArchetype) d.unrestArchetype = _descUnrest(cls, d.stratum, bucketOf(cls));
    // 待补账：开放栏 novel 标签（表外）记 ledger
    var ledger = root && (root._descriptorLedger = root._descriptorLedger || []);
    if (ledger) {
      ['fiscalStatus', 'unrestArchetype'].forEach(function(field) {
        var v = d[field];
        if (v && _DESC_KNOWN[field] && _DESC_KNOWN[field].indexOf(v) < 0) {
          if (!d._adjudicated) d._needsAdjudication = true;   // ⑤·表外 novel 标签→交 secondary-LLM 裁(归一通用词表)·已裁过不重裁
          var hit = ledger.filter(function(e) { return e.field === field && e.tag === v; })[0];
          if (hit) hit.count++; else ledger.push({ field: field, tag: v, count: 1, firstClass: cls.name || '' });
        }
      });
    }
    d._reconciled = true;
    cls.descriptor = d;
    return d;
  }

  // ⑤·E 现生管线「硬骨头升 secondary-LLM 裁」的结果落地（纯逻辑·可 smoke·AI 调用在 apply 层）：
  //   把 secondary-LLM 归一出的通用词表标签采用为 canonical（表外原词存 _raw_*·开放词表「留原词」）；
  //   非法/不在词表的值不采用（保确定性兜底）；置 _adjudicated 止重裁。返 applied 布尔。
  function applyAdjudicatedDescriptor(cls, parsed) {
    if (!cls || !cls.descriptor || !parsed || typeof parsed !== 'object') return false;
    var d = cls.descriptor, applied = false;
    if (parsed.stratum && _DESC_KNOWN.stratum.indexOf(parsed.stratum) >= 0 && parsed.stratum !== d.stratum) { d.stratum = parsed.stratum; applied = true; }
    ['fiscalStatus', 'unrestArchetype'].forEach(function(field) {
      var val = parsed[field];
      if (val && _DESC_KNOWN[field] && _DESC_KNOWN[field].indexOf(val) >= 0 && val !== d[field]) {
        if (d[field] && _DESC_KNOWN[field].indexOf(d[field]) < 0) d['_raw_' + field] = d[field];   // 表外原词留档
        d[field] = val; applied = true;
      }
    });
    d._adjudicated = true; d._needsAdjudication = false;
    return applied;
  }

  // ── 结构基线：实况 → 各阶层「应然势位」 ──
  function structuralBaseline(cls, inputs) {
    inputs = inputs || {};
    var exp = classExposure(cls);
    var parts = [];
    var base = 55;
    var taxHit = (numOr(inputs.taxFactor, 1) - 1) * 45 * exp.tax;
    if (Math.abs(taxHit) >= 1) { base -= taxHit; parts.push((taxHit > 0 ? '税负沉重' : '赋役宽减') + round2(-taxHit)); }
    else base -= taxHit;
    var disHit = Math.min(numOr(inputs.disasterShare, 0) * 40, 18) * exp.disaster;
    if (disHit >= 1) { base -= disHit; parts.push('灾域' + Math.round(numOr(inputs.disasterShare, 0) * 100) + '%·-' + round2(disHit)); }
    else base -= disHit;
    var warHit = Math.min(numOr(inputs.warShare, 0) * 50, 20) * exp.war;
    if (warHit >= 1) { base -= warHit; parts.push('兵燹-' + round2(warHit)); }
    else base -= warHit;
    var arrHit = Math.min(numOr(inputs.arrearsMonths, 0) * 3, 15) * exp.arrears;
    if (arrHit >= 1) { base -= arrHit; parts.push('欠饷-' + round2(arrHit)); }
    else base -= arrHit;
    if (exp.bucket === 'agrarian' || exp.tax >= 0.5) {
      var mxAdj = (numOr(inputs.minxin, 55) - 55) * 0.15;
      base += mxAdj;
      if (Math.abs(mxAdj) >= 1) parts.push('民心' + (mxAdj > 0 ? '+' : '') + round2(mxAdj));
    }
    if (exp.bucket === 'governing') base += 6;
    return { baseline: round2(clamp(base, 5, 95)), parts: parts, exposure: exp };
  }

  // ── 议程引擎 ──
  // 文案按 kind×身份桶取词（通用古语，朝代专名只能来自剧本种子）
  var AGENDA_TEXT = {
    tax: { agrarian: '减田赋·缓加派', trade: '减市税·弛关榷', military: '足军食·免摊买', governing: '减浮派·清虚耗', clergy: '免常住杂派' },
    disaster: { agrarian: '开仓赈济·蠲灾域钱粮', trade: '平籴止饥·宽灾年逋欠', military: '拨粮济军屯', governing: '遣使察灾·议蠲免', clergy: '施粥济民·请蠲寺租' },
    war: { agrarian: '止兵燹·守乡土', trade: '靖商路·护行旅', military: '增戍备·恤阵亡', governing: '议和战·固城守', clergy: '禳兵灾·安流亡' },
    arrears: { military: '清积欠·发饷银' },
    corruption: { governing: '惩贪墨·肃吏治', agrarian: '惩苛吏·禁私敛', trade: '禁勒索·平市税', military: '惩克扣·查空额', clergy: '禁渔夺常住' }
  };
  function agendaText(kind, bucket) {
    var row = AGENDA_TEXT[kind] || {};
    return row[bucket] || row.agrarian || '';
  }

  function ensureAgenda(cls, turn) {
    if (!cls._agenda || typeof cls._agenda !== 'object' || !Array.isArray(cls._agenda.items)) {
      cls._agenda = { items: [], builtTurn: turn };
    }
    // 本位种子只取一次快照——之后任何覆盖都不丢身份
    if (!Array.isArray(cls._seedDemands)) {
      var raw = cls.demands;
      var text = Array.isArray(raw) ? raw.join('·') : String(raw || '');
      cls._seedDemands = text.split(/[·;；，,、/]/).map(function(x) { return x.trim(); }).filter(Boolean).slice(0, 4);
      cls._seedDemands.forEach(function(t, i) {
        cls._agenda.items.push({ id: 'seed:' + i, kind: 'seed', text: compact(t, 40), urgency: 1, sinceTurn: turn, source: 'seed' });
      });
    }
    return cls._agenda;
  }

  function structTriggers(cls, inputs, exp) {
    var list = [];
    if (numOr(inputs.taxFactor, 1) >= 1.12 && exp.tax >= 0.45) {
      list.push({ kind: 'tax', urgency: inputs.taxFactor >= 1.25 ? 3 : 2 });
    }
    if (numOr(inputs.disasterShare, 0) >= 0.08 && exp.disaster >= 0.5) {
      list.push({ kind: 'disaster', urgency: inputs.disasterShare >= 0.25 ? 3 : 2 });
    }
    if (numOr(inputs.warShare, 0) >= 0.05 && exp.war >= 0.5) {
      list.push({ kind: 'war', urgency: inputs.warShare >= 0.2 ? 3 : 2 });
    }
    if (numOr(inputs.arrearsMonths, 0) >= 1 && exp.arrears >= 0.8) {
      list.push({ kind: 'arrears', urgency: inputs.arrearsMonths >= 3 ? 3 : 2 });
    }
    if (numOr(inputs.corruption, 0) >= 60 && (exp.bucket === 'governing' || exp.tax >= 0.6)) {
      list.push({ kind: 'corruption', urgency: 2 });
    }
    return list;
  }

  function rebuildDemandString(cls) {
    var items = (cls._agenda && cls._agenda.items || []).slice()
      .sort(function(a, b) {
        if ((b.urgency || 1) !== (a.urgency || 1)) return (b.urgency || 1) - (a.urgency || 1);
        return (b.sinceTurn || 0) - (a.sinceTurn || 0);
      });
    if (!items.length) return;
    cls.demands = items.slice(0, 3).map(function(it) { return it.text; }).join('·');
    cls.currentDemand = items[0].text;
  }

  // AI/校准器补充诉求：只占一个槽位，不再整体覆盖
  function setAiDemand(root, cls, text, info) {
    if (!cls || typeof cls !== 'object') return false;
    text = compact(Array.isArray(text) ? text.join('·') : text, 60);
    if (!text) return false;
    info = info || {};
    var turn = numOr(info.turn != null ? info.turn : root && root.turn, 0);
    var agenda = ensureAgenda(cls, turn);
    var slot = null;
    agenda.items.forEach(function(it) { if (it && it.id === 'ai:demand') slot = it; });
    if (slot) {
      slot.text = text;
      slot.sinceTurn = turn;
      slot.urgency = 2;
    } else {
      agenda.items.push({ id: 'ai:demand', kind: 'ai', text: text, urgency: 2, sinceTurn: turn, source: compact(info.source || 'ai', 30) });
    }
    rebuildDemandString(cls);
    return true;
  }

  function tickClassAgenda(GM, cls, inputs, turn) {
    var exp = classExposure(cls);
    var agenda = ensureAgenda(cls, turn);
    var active = structTriggers(cls, inputs, exp);
    var activeKinds = {};
    active.forEach(function(t) { activeKinds[t.kind] = t; });
    var changed = false;
    // 条件解除 → 得偿：移条目 + 满意度小幅回礼（过总闸）
    var kept = [];
    agenda.items.forEach(function(it) {
      if (!it) return;
      if (it.kind !== 'seed' && it.kind !== 'ai' && !activeKinds[it.kind]) {
        changed = true;
        if (!Array.isArray(cls._agendaResolved)) cls._agendaResolved = [];
        cls._agendaResolved.push({ t: turn, kind: it.kind, text: it.text });
        if (cls._agendaResolved.length > 6) cls._agendaResolved = cls._agendaResolved.slice(-6);
        var CE = TM.ClassEngine;
        if (CE && typeof CE.gateSatisfaction === 'function') {
          CE.gateSatisfaction(GM, cls, 2, { turn: turn, source: 'agenda-resolved', reason: '诉求得偿·' + it.text });
        }
        return;
      }
      kept.push(it);
    });
    agenda.items = kept;
    // 新触发 → 立项；既有 → 续期/升级
    active.forEach(function(t) {
      var found = null;
      agenda.items.forEach(function(it) { if (it && it.kind === t.kind && it.id === 'struct:' + t.kind) found = it; });
      if (!found) {
        agenda.items.push({
          id: 'struct:' + t.kind, kind: t.kind, text: agendaText(t.kind, exp.bucket) || agendaText(t.kind, 'agrarian'),
          urgency: t.urgency, sinceTurn: turn, source: 'struct'
        });
        changed = true;
      } else {
        var dur = turn - numOr(found.sinceTurn, turn);
        var want = Math.max(t.urgency, dur >= 6 ? 3 : 1);
        if (found.urgency !== want) { found.urgency = want; changed = true; }
      }
    });
    if (agenda.items.length > 8) agenda.items = agenda.items.slice(-8);
    if (changed || !agenda._strung) { rebuildDemandString(cls); agenda._strung = true; }
    return changed;
  }

  // 升米恩斗米仇：境遇恶化（gap<0·满意度高于实况→向下修正）激进快，回升（gap>0·实况好转）信任慢。
  // 不对称缓变，替代旧对称 ×0.12/±cap。rate/cap 日后可移入 engineConstants 调参。
  function asymDrift(gap, baseCap) {
    if (!isFinite(gap) || gap === 0) return 0;
    if (gap < 0) return clamp(gap * 0.18, -baseCap * 1.6, 0);   // 恶化向：快
    return clamp(gap * 0.08, 0, baseCap * 0.75);                 // 回升向：慢
  }

  // ── 稳定器：满意度向结构基线缓变（闸外恢复通道·近账可查·不对称：恶化快/回升慢） ──
  function tickClassDrift(GM, cls, inputs, turn) {
    var sb = structuralBaseline(cls, inputs);
    cls._structBaseline = sb.baseline;
    cls._structParts = sb.parts.slice(0, 4);
    var sat = Number(cls.satisfaction);
    if (!isFinite(sat)) return 0;
    var drift = asymDrift(sb.baseline - sat, 1.2);
    cls._lastDrift = drift;   // 供乱民层(B)读「本回合骤跌」做急性恶化信号
    if (Math.abs(drift) < 0.05) return 0;
    cls.satisfaction = round2(clamp(sat + drift, 0, 100));
    if (!Array.isArray(cls._satLedger)) cls._satLedger = [];
    cls._satLedger.push({
      t: turn, d: round2(drift), src: 'struct-drift',
      why: '结构回归·势位' + sb.baseline + (sb.parts.length ? '·' + sb.parts.slice(0, 2).join('·') : '')
    });
    if (cls._satLedger.length > 12) cls._satLedger = cls._satLedger.slice(-12);
    return drift;
  }

  // ── 地域分账（2026-06-12 backlog 落地）：阶层 regionalVariants 活化 ──
  // 同一阶层在不同地块境遇悬殊（陕西自耕农 vs 江南自耕农）。变体满意度向「当地实况」
  // 派生的局部基线缓变——地方灾异/兵燹只压当地分账，全国账仍由全国基线管。
  function localInputsFor(GM, P, regionName) {
    GM = GM || {};
    var turn = numOr(GM.turn, 0);
    if (!GM._socialLocalInputs || GM._socialLocalInputs.turn !== turn) {
      GM._socialLocalInputs = { turn: turn, byRegion: {} };
    }
    var key = compact(regionName, 40);
    if (!key) return null;
    if (GM._socialLocalInputs.byRegion[key] !== undefined) return GM._socialLocalInputs.byRegion[key];
    // 找顶级区划：名字双向包含（剧本 variant.region 常是「陕西」「江南苏松」类泛称）
    var root = null;
    [P && P.adminHierarchy, GM && GM.adminHierarchy].forEach(function(ah) {
      if (root || !ah || typeof ah !== 'object') return;
      var tops = [];
      if (Array.isArray(ah.divisions)) tops = ah.divisions;
      else Object.keys(ah).forEach(function(k) {
        var fac = ah[k];
        toArray(fac && (fac.divisions || fac.children || fac.subs)).forEach(function(d) { tops.push(d); });
      });
      for (var i = 0; i < tops.length && !root; i += 1) {
        var n = String(tops[i] && tops[i].name || '');
        if (!n) continue;
        if (n.indexOf(key) >= 0 || key.indexOf(n) >= 0) root = tops[i];
      }
    });
    if (!root) { GM._socialLocalInputs.byRegion[key] = null; return null; }
    var leaves = [];
    (function walk(d) {
      var kids = toArray(d.children || d.divisions || d.subs);
      if (!kids.length) leaves.push(d);
      else kids.forEach(walk);
    })(root);
    var FP = TM.FieldPipes;
    var taxSum = 0, taxN = 0, disasterN = 0, warN = 0, mxSum = 0, mxN = 0;
    leaves.forEach(function(div) {
      if (FP && typeof FP.taxBurdenFactor === 'function') {
        var tf = Number(FP.taxBurdenFactor(div));
        if (isFinite(tf) && tf > 0) { taxSum += tf; taxN++; }
      }
      var hasDisaster = toArray(div.statusEffects).some(function(e) { return e && e.kind === 'disaster'; })
        || numOr(div.disasterPenalty, 0) > 0.05;
      if (hasDisaster) disasterN++;
      if (div.warZone || div._warZone || div.isWarZone) warN++;
      var mx = Number(div.minxin);
      if (isFinite(mx)) { mxSum += mx; mxN++; }
    });
    var national = structuralInputs(GM, P);
    var n = leaves.length;
    var out = !n ? null : {
      turn: turn,
      leaves: n,
      taxFactor: taxN ? round2(taxSum / taxN) : national.taxFactor,
      disasterShare: round2(disasterN / n),
      warShare: round2(warN / n),
      arrearsMonths: national.arrearsMonths,
      minxin: mxN ? round2(mxSum / mxN) : national.minxin,
      corruption: national.corruption
    };
    GM._socialLocalInputs.byRegion[key] = out;
    return out;
  }

  function tickClassRegional(GM, P, cls, inputs, turn) {
    var variants = toArray(cls.regionalVariants).filter(function(v) { return v && v.region; });
    if (!variants.length) return 0;
    var moved = 0;
    variants.slice(0, 8).forEach(function(v) {
      var li = localInputsFor(GM, P, String(v.region));
      var sb = structuralBaseline(cls, li || inputs);
      var cur = Number(v._satLocal != null ? v._satLocal : v.satisfaction);
      if (!isFinite(cur)) cur = numOr(cls.satisfaction, 50);
      var drift = asymDrift(sb.baseline - cur, 1.5);
      v._satLocal = round2(clamp(cur + drift, 0, 100));
      v.satisfaction = Math.round(v._satLocal);
      v._structBaseline = sb.baseline;
      v._lastDrift = round2(drift);
      // ④·per-region radicalFrac（地域化乱民蓄水·2026-06-17）：本地满意度 + 急性骤跌驱动·快激进(≤0.12)/慢平复(≤0.04)
      //   同 national tickClassRadical 动力学（不含 agenda/bandwagon·那是全局政治项）；national cls._radicalFrac 仍由 tickClassRadical 独算·此为附加地域分辨率（C4 真跨省凝聚据此）。
      var _vsc = clamp((48 - v._satLocal) / 48, 0, 1);
      var _vw = clamp(-(drift || 0) / 4, 0, 0.3);
      var _vp = clamp(_vsc * 0.7 + _vw, 0, 1);
      var _vcur = Number(v._radicalFrac); if (!isFinite(_vcur)) _vcur = round2(clamp(_vsc * 0.4, 0, 1));
      var _vd = _vp - _vcur; var _vstep = _vd > 0 ? Math.min(_vd, 0.12) : Math.max(_vd, -0.04);
      v._radicalFrac = round2(clamp(_vcur + _vstep, 0, 1));
      if (Math.abs(drift) >= 0.05) moved++;
    });
    return moved;
  }

  // AI 指域事件（class_changes.region）：只动当地分账（全国账已由 gateSatisfaction 管）
  function applyRegionalDelta(root, cls, regionName, delta, info) {
    if (!cls || typeof cls !== 'object') return false;
    var key = compact(regionName, 40);
    var d = clamp(Number(delta), -12, 12);
    if (!key || !d) return false;
    var variants = toArray(cls.regionalVariants);
    var hit = null;
    for (var i = 0; i < variants.length && !hit; i += 1) {
      var rn = String(variants[i] && variants[i].region || '');
      if (rn && (rn.indexOf(key) >= 0 || key.indexOf(rn) >= 0)) hit = variants[i];
    }
    if (!hit) return false;
    var cur = Number(hit._satLocal != null ? hit._satLocal : hit.satisfaction);
    if (!isFinite(cur)) cur = numOr(cls.satisfaction, 50);
    hit._satLocal = round2(clamp(cur + d, 0, 100));
    hit.satisfaction = Math.round(hit._satLocal);
    hit._lastDeltaTurn = numOr(info && info.turn != null ? info.turn : root && root.turn, 0);
    return true;
  }

  // ── 党派单源对账：parties[]（canonical）与 partyState（引擎）双写者合流 ──
  function syncPartyTruth(GM) {
    GM = GM || {};
    var parties = toArray(GM.parties);
    var ps = GM.partyState;
    var out = { synced: 0, engineMerged: 0, agendaRefreshed: 0 };
    if (!parties.length || !ps || typeof ps !== 'object') return out;
    var turn = numOr(GM.turn, 0);
    parties.forEach(function(p) {
      if (!p || !p.name || !ps[p.name]) return;
      var st = ps[p.name];
      ['influence', 'cohesion'].forEach(function(key) {
        var canonical = Number(p[key]);
        if (!isFinite(canonical)) canonical = key === 'influence' ? 30 : 50;
        var last = Number(st['_synced_' + key]);
        var engineDelta = isFinite(last) ? (numOr(st[key], canonical) - last) : 0;
        engineDelta = clamp(engineDelta, -10, 10);
        if (engineDelta) {
          canonical = clamp(canonical + engineDelta, 0, 100);
          out.engineMerged++;
          if (!Array.isArray(st.historyLog)) st.historyLog = [];
          st.historyLog.push({ turn: turn, field: key, delta: round2(engineDelta), reason: '朝局推移并账' });
          if (st.historyLog.length > 16) st.historyLog = st.historyLog.slice(-16);
        }
        p[key] = round2(canonical);
        st[key] = p[key];
        st['_synced_' + key] = p[key];
      });
      // 盟敌单源对账：AI 运行时盟敌只写 partyState.alliedWith/conflictWith，
      // 而反对目标派生(opposingPartyNames)读 parties[].allies/enemies——旧版只剩剧本 seed·runtime 漂移读不到。
      // 并账：runtime 盟约/敌意并回 canonical·同名冲突以 runtime 为准。
      var runtimeAlly = toArray(st.alliedWith);
      var runtimeFoe = toArray(st.conflictWith);
      if (runtimeAlly.length || runtimeFoe.length) {
        var entryName = function(v) { return (v && typeof v === 'object') ? String(v.name || v.party || '') : String(v || ''); };
        var allies = toArray(p.allies).slice();
        var enemies = toArray(p.enemies).slice();
        runtimeAlly.forEach(function(v) {
          var nm = entryName(v);
          if (!nm || nm === p.name) return;
          if (allies.map(entryName).indexOf(nm) < 0) allies.push(nm);
          enemies = enemies.filter(function(e) { return entryName(e) !== nm; });
        });
        runtimeFoe.forEach(function(v) {
          var nm = entryName(v);
          if (!nm || nm === p.name) return;
          if (enemies.map(entryName).indexOf(nm) < 0) enemies.push(nm);
          allies = allies.filter(function(a) { return entryName(a) !== nm; });
        });
        p.allies = allies;
        p.enemies = enemies;
      }
      // 议程保鲜：8 回合无鲜议程且有活跃目标 → 由 top 目标派生
      var agendaTurn = Number(p._agendaTurn);
      var stale = !isFinite(agendaTurn) || (turn - agendaTurn) >= 8;
      if (stale && TM.PartyGoals && typeof TM.PartyGoals.getActiveGoals === 'function') {
        try {
          var goals = TM.PartyGoals.getActiveGoals(GM, p, { turn: turn, source: 'social-foundation' });
          var top = goals && goals[0];
          var text = top && compact(top.text, 60);
          if (text && text !== compact(p.currentAgenda, 60)) {
            p.currentAgenda = text;
            p._agendaTurn = turn;
            p._agendaSource = 'party-goal';
            out.agendaRefreshed++;
          }
        } catch (_goalE) {}
      }
      out.synced++;
    });
    return out;
  }

  // ── 总 tick：endturn-core 挂载 ──
  // ── 乱民层（B·2026-06-16）：满意度与民变之间的政治蓄水池 ──
  // _radicalFrac（0..1）由「低满意度均衡 + 急性恶化(本回合骤跌·读 _lastDrift) + 政治边缘化(未得偿高急议程) + 上行受阻(科举通道塞·G 刀)」推高，
  // 快激进、慢平复（升米恩斗米仇的政治版）。挂 GM.classes 侧；C 刀再经 resolvePopulationKeys 摊到人口格子驱动流民。
  function agendaUrgencyLoad(cls) {
    var items = cls && cls._agenda && Array.isArray(cls._agenda.items) ? cls._agenda.items : [];
    var load = 0;
    for (var i = 0; i < items.length; i += 1) {
      var it = items[i];
      if (!it || it.kind === 'ai') continue;   // AI 补充槽不计政治边缘化
      var u = Number(it.urgency) || 1;
      load += u >= 3 ? 0.25 : (u >= 2 ? 0.12 : 0.05);
    }
    return clamp(load, 0, 0.6);
  }

  function tickClassRadical(GM, cls, inputs, turn) {
    var sat = Number(cls && cls.satisfaction);
    if (!isFinite(sat)) return undefined;
    var satComp = clamp((48 - sat) / 48, 0, 1);                          // ① 低满意度均衡乱民
    var worsenComp = clamp(-(Number(cls._lastDrift) || 0) / 4, 0, 0.3);  // ② 急性恶化（本回合满意度骤跌）
    var agendaComp = agendaUrgencyLoad(cls);                             // ③ 政治边缘化（未得偿高急议程）
    var aspirationComp = clamp(Number(cls._aspirationBlock) || 0, 0, 0.5); // ⑤ 上行受阻（科举通道塞·范进式怨望·G 刀于结案注入·本函数下方逐回合衰减）
    // ④ 墙头草/士绅离心：皇威低（王朝可见倾危）→ 激进加速，高 clout 阶层（权贵）离心更烈（树倒猢狲散·闭合死亡螺旋）
    var hw = (GM && GM.huangwei && isFinite(Number(GM.huangwei.index))) ? Number(GM.huangwei.index) : 100;
    var bandwagon = hw < 45 ? clamp((45 - hw) / 45, 0, 1) * 0.5 * ((CLOUT_BUCKET_W[bucketOf(cls)] || 1.0) / 2.2) : 0;
    var movementComp = classMovementLoad(GM, cls);                       // ⑥ 政治运动成势/鼎沸（§三E）
    var marginalComp = (cls._marginalPatronTurn != null && (turn - Number(cls._marginalPatronTurn)) <= 1) ? 0.05 : 0;  // ⑦ 奥援边缘化（所倚党派被逐出朝局·three-systems-ext 政柄格局戳）
    var pressure = clamp(satComp * 0.7 + worsenComp + agendaComp + bandwagon + aspirationComp + movementComp + marginalComp, 0, 1);
    var cur = Number(cls._radicalFrac);
    if (!isFinite(cur)) cur = round2(clamp(satComp * 0.4, 0, 1));        // 首回合播种（苦难阶层非0）
    var d = pressure - cur;
    var step = d > 0 ? Math.min(d, 0.12) : Math.max(d, -0.04);           // 快激进 / 慢平复
    cls._radicalFrac = round2(clamp(cur + step, 0, 1));
    cls._radicalPressure = round2(pressure);
    if (cls._aspirationBlock) cls._aspirationBlock = round2(Math.max(0, (Number(cls._aspirationBlock) || 0) - 0.04));  // 受阻怨望随时间自平复（不被新一科再塞则消退）
    return cls._radicalFrac;
  }

  // ── §三E·政治运动（V3式·2026-07-03）──
  // 阶层的结构性诉求（struct:*议程项）高急且持续未偿 → 凝成「政治运动」实体（初起<40/成势≥40/鼎沸≥70）。
  // 未偿则壮大（天命权重失衡·|divergence|≥25 时更快=合法性接机制）；诉求得偿/消失则退潮消散
  // （得偿的 +2 满意已在 tickClassAgenda·此处不重赏）。成势/鼎沸经 tickClassRadical ⑥ 项压激进；
  // 廷议议题生成与 AI prompt 另行消费 GM._politicalMovements。只用既有账本·不造平行系统。
  var MOVEMENT_CAP = 12;
  function tickMovements(GM, classes, turn) {
    if (!Array.isArray(GM._politicalMovements)) GM._politicalMovements = [];
    var moves = GM._politicalMovements;
    var alive = {};
    var leg = GM._legitimacy;
    var imbalance = !!(leg && isFinite(Number(leg.divergence)) && Math.abs(Number(leg.divergence)) >= 25);
    classes.forEach(function(cls) {
      var name = cls && (cls.name || cls.className);
      if (!name) return;
      var items = cls._agenda && Array.isArray(cls._agenda.items) ? cls._agenda.items : [];
      items.forEach(function(it) {
        if (!it || it.kind === 'ai' || String(it.kind).indexOf('seed') === 0) return;   // 只有结构性诉求会凝成运动
        var u = Number(it.urgency) || 1;
        var dur = turn - (Number(it.sinceTurn) || turn);
        var key = name + '·' + it.kind;
        var m = null;
        for (var j = 0; j < moves.length; j += 1) { if (moves[j] && moves[j].key === key) { m = moves[j]; break; } }
        if (!m && u >= 3 && dur >= 4 && moves.length < MOVEMENT_CAP) {
          m = { key: key, className: name, kind: String(it.kind), label: compact(it.text, 40), support: 20, sinceTurn: turn, phase: '初起' };
          moves.push(m);
        }
        if (m) {
          alive[key] = true;
          if (it.text) m.label = compact(it.text, 40);
          m.support = clamp(round2((Number(m.support) || 0) + (u >= 3 ? 6 : 3) + (imbalance ? 4 : 0)), 0, 100);
        }
      });
    });
    var PHASE_RANK = { '初起': 0, '成势': 1, '鼎沸': 2 };
    for (var i = moves.length - 1; i >= 0; i -= 1) {
      var mv = moves[i];
      if (!mv || !mv.key) { moves.splice(i, 1); continue; }
      if (!alive[mv.key]) {
        mv.support = round2((Number(mv.support) || 0) - 18);
        if (mv.support <= 0) { moves.splice(i, 1); continue; }
      }
      var oldPhase = mv.phase || '初起';
      mv.phase = mv.support >= 70 ? '鼎沸' : (mv.support >= 40 ? '成势' : '初起');
      // ★2026-07-04 方向B·运动升相入党魁记忆(仅升相·退潮降相不写)——民情从此在人的脑子里
      if (mv.phase !== oldPhase && (PHASE_RANK[mv.phase] || 0) > (PHASE_RANK[oldPhase] || 0) && mv.phase !== '初起') {
        _movementMemory(GM, mv);
      }
    }
    return moves.length;
  }
  // ★2026-07-04 方向B·运动入党魁记忆：民间运动成势/鼎沸→社会基础相合的党魁记「根基之民可为请命」·
  //   秉政党魁记「朝局承压」——否则推演/问对里党魁对自家根基的民间运动无知无觉。至多4人/次·
  //   NpcMemorySystem 缺位(如引擎单测)静默跳过·不触碰 support 数学。
  function _movementMemory(GM, mv) {
    try {
      if (typeof NpcMemorySystem === 'undefined' || !NpcMemorySystem.remember) return;
      var hot = mv.phase === '鼎沸';
      var n = 0;
      toArray(GM.parties).forEach(function(p) {
        if (n >= 4 || !p || !p.leader) return;
        var lc = null;
        (GM.chars || []).some(function(c) { if (c && c.name === p.leader) { lc = c; return true; } return false; });
        if (!lc || lc.alive === false || lc.isPlayer) return;
        var sb = p.socialBase || p.social_base || p.baseClasses;
        var sbStr = Array.isArray(sb) ? sb.map(function(b) { return (b && typeof b === 'object') ? (b.name || b.className || '') : b; }).join('、') : String(sb || '');
        var isBase = sbStr && mv.className && sbStr.indexOf(mv.className) >= 0;
        var isGov = p.standing === 'governing';
        if (isBase) {
          NpcMemorySystem.remember(p.leader, '民间「' + (mv.label || mv.kind) + '」之请' + mv.phase + '·此乃吾党根基之民·可为请命亦须善抚', hot ? '忧' : '喜', hot ? 8 : 7, mv.className, { type: 'political' });
          n += 1;
        } else if (isGov) {
          NpcMemorySystem.remember(p.leader, '民间「' + (mv.label || mv.kind) + '」之请' + mv.phase + '·朝局承压·当筹应对', hot ? '惧' : '忧', hot ? 8 : 6, mv.className, { type: 'political' });
          n += 1;
        }
      });
    } catch (_mmE) {}
  }
  function classMovementLoad(GM, cls) {
    var name = cls && (cls.name || cls.className);
    if (!name || !GM || !Array.isArray(GM._politicalMovements)) return 0;
    var top = 0;
    GM._politicalMovements.forEach(function(m) {
      if (m && m.className === name && Number(m.support) > top) top = Number(m.support);
    });
    return top >= 70 ? 0.15 : (top >= 40 ? 0.07 : 0);
  }
  function movementsForClass(GM, className) {
    if (!className || !GM || !Array.isArray(GM._politicalMovements)) return [];
    return GM._politicalMovements.filter(function(m) { return m && m.className === className; });
  }

  // ── §三D·合法性 clout 加权读模型（2026-06-16）──
  // Vic3 合法性按政治权力加权（缙绅作乱 ≫ 等量农户）；现状 GM.minxin.trueIndex 是人口加权。
  // 此处算 clout 加权满意度 + 与人口加权民心的背离旗标，作**只读信号**喂 LLM（不动刻意自由的皇威）。
  var CLOUT_BUCKET_W = { governing: 2.2, military: 1.6, clergy: 1.2, trade: 1.1, agrarian: 1.0 };
  function classClout(cls) {
    var infl = Number(cls && cls.influence);
    if (!isFinite(infl) || infl < 0) infl = 0;
    return infl * (CLOUT_BUCKET_W[bucketOf(cls)] || 1.0);
  }
  function computeLegitimacy(GM) {
    var classes = toArray(GM.classes).filter(function(c) { return c && (c.name || c.className) && isFinite(Number(c.satisfaction)); });
    if (!classes.length) return null;
    var sumCS = 0, sumC = 0;
    classes.forEach(function(cls) {
      var sat = clamp(Number(cls.satisfaction), 0, 100);
      var rf = Number(cls._radicalFrac) || 0;
      var loyalty = clamp(sat - rf * 60, 0, 100);   // 乱民化拉低忠诚：高 radicalFrac 阶层纵满意度尚可亦不忠（士绅离心即在此现形）
      var clout = classClout(cls);
      sumCS += loyalty * clout; sumC += clout;
    });
    var cloutIdx = sumC > 0 ? round2(sumCS / sumC) : round2(sumCS / Math.max(1, classes.length));
    var popIdx = (GM.minxin && isFinite(Number(GM.minxin.trueIndex))) ? round2(Number(GM.minxin.trueIndex)) : null;
    var div = (popIdx != null) ? round2(cloutIdx - popIdx) : 0;
    var flag = '';
    if (popIdx != null) flag = div <= -12 ? '缙绅离心' : (div >= 12 ? '民怨上达' : '相安');
    var leg = { clout: cloutIdx, pop: popIdx, divergence: div, flag: flag, turn: numOr(GM.turn, 0) };
    GM._legitimacy = leg;
    return leg;
  }

  function tick(GM, P) {
    GM = GM || (typeof global.GM === 'object' ? global.GM : {});
    P = P || (typeof global.P === 'object' ? global.P : {});
    var out = { classes: 0, drifted: 0, agendaChanged: 0, radical: 0, party: null };
    var turn = numOr(GM.turn, 0);
    var classes = toArray(GM.classes).filter(function(c) { return c && typeof c === 'object' && (c.name || c.className); });
    if (classes.length) {
      var inputs = structuralInputs(GM, P);
      out.movements = tickMovements(GM, classes, turn);   // §三E·先于逐阶层过账（读上回合议程态·运动是慢实体·本回合 radical ⑥ 项即读最新 support）
      classes.forEach(function(cls) {
        out.classes++;
        if (!cls.descriptor || !cls.descriptor._reconciled) reconcileClassDescriptor(cls, GM);   // E·描述符对账（sticky·首遇固化·补缺）
        if (tickClassAgenda(GM, cls, inputs, turn)) out.agendaChanged++;
        if (tickClassDrift(GM, cls, inputs, turn)) out.drifted++;
        var rf = tickClassRadical(GM, cls, inputs, turn);
        if (isFinite(rf) && rf >= 0.1) out.radical++;
        out.regionalMoved = (out.regionalMoved || 0) + tickClassRegional(GM, P, cls, inputs, turn);
      });
    }
    out.party = syncPartyTruth(GM);
    out.legitimacy = computeLegitimacy(GM);
    GM._socialFoundationLastTick = { turn: turn, classes: out.classes, drifted: out.drifted, agendaChanged: out.agendaChanged, party: out.party };
    return out;
  }

  var api = {
    structuralInputs: structuralInputs,
    classExposure: classExposure,
    bucketOf: bucketOf,
    structuralBaseline: structuralBaseline,
    ensureAgenda: ensureAgenda,
    setAiDemand: setAiDemand,
    rebuildDemandString: rebuildDemandString,
    localInputsFor: localInputsFor,
    applyRegionalDelta: applyRegionalDelta,
    syncPartyTruth: syncPartyTruth,
    tickClassRadical: tickClassRadical,
    tickMovements: tickMovements,
    movementsForClass: movementsForClass,
    classMovementLoad: classMovementLoad,
    computeLegitimacy: computeLegitimacy,
    reconcileClassDescriptor: reconcileClassDescriptor,
    applyAdjudicatedDescriptor: applyAdjudicatedDescriptor,
    tick: tick
  };
  TM.SocialFoundation = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

// 国势四项：吏治、民心、皇权、皇威的详情。内容与次序照老抽屉（tm-var-drawers.js 皇威/皇权/民心三抽屉、tm-lizhi-panel.js 吏治面板），
// 读成统一的结构交屏幕画：总览数行、色谱、分维、源降两账、警示、名目诸列。
// 可见之律：
//   · 奏报失真层（严格史实模式）开着且该项未揭真时（内核 _barFlipToPerceived，与顶栏同一判定），只给朝廷视野，
//     真值与由真值推出的分账（诸源、分阶层、分区、分部门真账、税赋三数等）一概封存——老抽屉在此处会露真值，新界面不露；
//   · 吏治另有监察之律（老面板 getCorrVisibility）：监察不足五十，真浊度与分部门真账不显，只据地方所奏。
// 皇权、皇威内核不设失真，照老抽屉直显。只读，处置去诏令、奏疏、问对、朝议。
const w = window;
const G = () => w.GM || {};
const fn = (name) => (typeof w[name] === 'function' ? w[name] : null);
const n0 = (v, fb = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fb; };
const r = (v) => Math.round(n0(v));
const pct100 = (v) => `${Math.round(n0(v) * 100)}%`;
const fmt = (v) => { const n = n0(v); const a = Math.abs(n); return a >= 1e8 ? `${(n / 1e8).toFixed(2)}亿` : a >= 1e4 ? `${(n / 1e4).toFixed(1)}万` : String(Math.round(n)); };
const signed = (v) => `${v >= 0 ? '+' : ''}${n0(v).toFixed(1)}`;
const toneOf = (v, good = 60, mid = 40) => (v >= good ? 'good' : v >= mid ? 'mid' : 'bad');
const trendSym = (t) => (t === 'rising' || t === 'up' ? '↑' : t === 'falling' || t === 'down' ? '↓' : '');
const flipped = (domain) => { const f = fn('_barFlipToPerceived'); try { return !!(f && f(domain, 'index')); } catch (_e) { return false; } };
const SEALED_NOTE = '据奏之数——实情须厂卫、推问、查案方得掀见';
// 区划号 → 名（民心分区按区划号记；老抽屉截号前六字，显成「div_mp」）
function divisionName(id) {
  const ah = G().adminHierarchy || (w.P && w.P.adminHierarchy) || {};
  let hit = null;
  const walk = (list) => { for (const d of list || []) { if (hit) return; if (d && d.id === id) hit = d; else if (d) walk(d.children || d.divisions); } };
  for (const k of Object.keys(ah)) walk(ah[k] && ah[k].divisions);
  return hit && hit.name ? String(hit.name) : String(id);
}

export const GAUGES = [['lizhi', '吏治', '吏'], ['minxin', '民心', '民'], ['huangquan', '皇权', '权'], ['huangwei', '皇威', '威']];

// ---------- 吏治 ----------
const LZ_PHASE = (v) => (v < 25 ? '清明' : v < 50 ? '尚可' : v < 70 ? '渐弊' : v < 85 ? '颓靡' : '积重');
const inkDots = (v) => { const x = Math.max(0, Math.min(100, n0(v))); return x < 25 ? 0 : x < 50 ? 1 : x < 70 ? 2 : x < 85 ? 3 : 4; };
const DEPTS = [['central', '京察'], ['provincial', '地方'], ['military', '军队'], ['fiscal', '税司'], ['judicial', '司法'], ['imperial', '内廷']];
const SUP_HINT = { accurate: '御史布于郡县，百官无所遁形', moderate: '常设监察，地方尚有粉饰余地', vague: '监察松弛，地方报喜不报忧', blind: '御史缺员，朝廷如盲人摸象' };
const SUP_NAME = { accurate: '洞察', moderate: '略知', vague: '朦胧', blind: '蒙蔽' };
function lizhi() {
  const g = G(), c = g.corruption || {};
  const t = n0(c.trueIndex, n0(c.overall));
  const p = c.perceivedIndex !== undefined ? n0(c.perceivedIndex) : t;
  const sup = n0((c.supervision || {}).level);
  const vis = sup >= 80 ? 'accurate' : sup >= 50 ? 'moderate' : sup >= 20 ? 'vague' : 'blind';
  const flip = flipped('corruption');
  const showTrue = !flip && (vis === 'accurate' || vis === 'moderate');
  const rows = [{ label: '朝廷视野', dots: inkDots(p), value: LZ_PHASE(p) }];
  if (showTrue) {
    rows.push({ label: '真实浊度', dots: inkDots(t), value: LZ_PHASE(t) });
    const gap = Math.abs(Math.round(t - p));
    if (gap > 10) rows.push({ label: '粉饰差距', value: `Δ${gap}（地方粉饰）`, tone: 'bad' });
  }
  const sd = c.subDepts || {};
  const sections = [
    { kind: 'meter', title: '监察力度', badge: `${r(sup)} / 100`, value: sup, note: SUP_HINT[vis] }
  ];
  const monthly = g.guoku && n0(g.guoku.monthlyIncome);
  if (!flip && monthly > 0 && fn('computeTaxThreeNumber')) {
    try {
      const f = w.computeTaxThreeNumber(monthly);
      const gl = { clerk: '州县吏胥', official: '各级私分', power: f.collectionDeclared ? '豪强截留' : '豪强抵偿', transit: '在途损耗', unallocated: '未分计' };
      const gaps = f.totalLoss > 0 ? ['clerk', 'official', 'power', 'transit'].concat(f.collectionDeclared ? ['unallocated'] : []).map((k) => ({ label: gl[k], value: n0(f.gaps && f.gaps[k]), share: Math.round(n0(f.gaps && f.gaps[k]) / f.totalLoss * 100) })) : [];
      const notes = [];
      if (f.governmentScope === 'central-and-regional') {
        notes.push(`官收合计中央上供与地方留用。民间额外实缴 ${fmt(f.extraCollected)} 两。`);
        const nc = f.notCollected;
        if (nc) notes.push(`尚未征到：豪强抗纳 ${fmt(nc.resistance)}，其余欠征 ${fmt(nc.other)} 两；另有核减及征前损折 ${fmt(nc.assessmentReduction)} 两。未缴之数不列入截留差额。`);
      }
      sections.push({ kind: 'tax', title: '税赋三数', badge: '名义 / 实收 / 民缴', label: '正赋钱粮 · 月入', nominal: n0(f.nominal), received: n0(f.actualReceived), paid: n0(f.peasantPaid), loss: n0(f.totalLoss), gaps, notes });
    } catch (_e) { /* 账未齐则不列 */ }
  }
  const DEPT_NAME = Object.fromEntries(DEPTS);
  sections.push({ kind: 'depts', title: '部门污浊分布', badge: '监察越强 · 数字越准', items: DEPTS.map(([k, label]) => {
    const d = sd[k] || {};
    const v = showTrue ? n0(d.true) : n0(d.perceived);
    return { label, dots: inkDots(v), value: LZ_PHASE(v), trend: trendSym(d.trend) };
  }) });
  const insts = (c.supervision || {}).institutions || [];
  sections.push({ kind: 'list', title: '监察机构', badge: `${insts.length} 个`, empty: '未设监察机构——可在制度设计中创设御史台/都察院/巡按等',
    items: insts.map((i) => ({ title: i.name || '未命名', meta: `覆盖：${(i.coverage || []).map((k) => DEPT_NAME[k] || k).join('/') || '—'} · 独立 ${n0(i.independence)}`, side: `腐败 ${n0(i.corruption)} · 缺员 ${Math.round(n0(i.vacancies) * 100)}%` })) });
  const cases = (c.activeCases || []).slice().reverse();
  if (cases.length) sections.push({ kind: 'list', title: '待决弹章', badge: `${cases.length} 件 · 超期即有代价`, tone: 'bad', go: 'docket',
    items: cases.map((a) => { const left = n0(a.expireTurn) - n0(g.turn); return { title: String(a.text || ''), meta: `${a.severity === 'major' ? '大案' : a.severity === 'moderate' ? '中案' : '小案'} · ${a.dept || ''}`, side: left > 0 ? `余 ${left} 月` : '已逾期', tone: 'bad' }; }) });
  const rumors = fn('_collectRecentCases') ? w._collectRecentCases() : [];
  const CRED = { high: '可信', medium: '参考', low: '风闻' };
  sections.push({ kind: 'list', title: '近期风闻', badge: `${rumors.length} 条`, empty: '暂无相关风闻——或监察力度不足以察觉', go: rumors.length ? 'docket' : '',
    items: rumors.map((x) => ({ title: String(x.text || ''), meta: x.type || '弹章', side: `${CRED[x.credibility] || '偏颇'} · ${x.time || 'T' + (x.turn != null ? x.turn : '?')}` })) });
  if (g.juanna && g.juanna.active) sections.push({ kind: 'alert', title: '捐纳', lines: [`捐纳（卖官）已开——月入 ${Math.round(n0(g.juanna.monthlyIncome) / 1000)} 千两 · 长期腐败`] });
  const facs = c.entrenchedFactions || [];
  if (facs.length) sections.push({ kind: 'list', title: '腐败集团', badge: `${facs.length} 个`, tone: 'bad',
    items: facs.map((f) => ({ title: f.name || '某集团', meta: `部门：${f.dept || '—'} · 势力：${n0(f.strength)} · 历时：${n0(f.years)} 年` })) });
  sections.push({ kind: 'hints', title: '如何措置', items: [
    ['写诏（派钦差/肃贪/俸禄改革/开罢捐纳/酷吏/特务 皆由诏令发起）', 'edict'], ['看奏疏（御史/监察/科道 的弹劾与建言）', 'docket'],
    ['问对御史大夫/都察院 察朝政风气', 'audience'], ['朝议（设特务机构/肃贪运动 等重大争议）', 'court']
  ], note: '※ AI 按当前腐败/民心/皇权/派系局势推演诏令结果（含党争反噬、冤狱、清流士人心离等副作用）。' });
  return {
    key: 'lizhi', title: '吏治', sub: `监察 ${r(sup)}·${SUP_NAME[vis]}`, rows, sealed: !showTrue, sealedNote: flip ? SEALED_NOTE : '监察不足，实情不详——仅据地方所奏',
    spectrum: null, sections
  };
}

// ---------- 民心 ----------
const MX_SRC = { taxation: '赋税', corvee: '徭役', disasterRelief: '赈济', judicialFairness: '司法', localOfficial: '官吏', priceStability: '物价', security: '治安', socialMobility: '仕路', culturalPolicy: '文治', heavenSign: '天象', auspicious: '祥瑞', prophecy: '谶纬', warResult: '兵事', imperialVirtue: '帝德', policyBalance: '中道', policyExtreme: '极端' };
const MX_PHASE = { revolt: '揭竿', angry: '窃盗', uneasy: '忍耐', peaceful: '安居', adoring: '颂圣' };
const mxBand = (v) => (v < 20 ? '揭竿' : v < 40 ? '窃盗' : v < 60 ? '忍耐' : v < 80 ? '安居' : '颂圣');
const CLASS_NAMES = { shidafu: '士大夫', shang: '商贾', nong: '农户', gongjiang: '工匠', youmin: '游民', imperial: '皇族', gentry_high: '门阀', gentry_mid: '中小士族', scholar: '寒士', merchant: '商贾', landlord: '地主', peasant_self: '自耕农', peasant_tenant: '佃农', craftsman: '工匠', debased: '贱民', clergy: '僧道', slave: '奴婢' };
function minxin() {
  const g = G(), m = g.minxin || {};
  const t = n0(m.trueIndex, n0(m.index, n0(m.value, 60)));
  const p = m.perceivedIndex !== undefined ? n0(m.perceivedIndex) : t;
  const flip = flipped('minxin');
  const shown = flip ? p : t;
  const rows = flip
    ? [{ label: '朝廷视野', value: `${r(p)} / 100`, tone: toneOf(p), big: true }]
    : [{ label: '真实民心', value: `${r(t)} / 100`, tone: toneOf(t), big: true }, { label: '朝廷视野', value: `${r(p)}（粉饰 ${p - t >= 0 ? '+' : ''}${r(p - t)}）` }];
  rows.push({ label: '段位', value: flip ? mxBand(p) : MX_PHASE[m.phase] || m.phase || mxBand(t), tone: toneOf(shown) });
  if (!flip) {
    if (g._conscriptEffMult !== undefined) rows.push({ label: '征兵效率', value: `${(n0(g._conscriptEffMult) * 100).toFixed(0)}%` });
    if (g._reformToleranceMult !== undefined) rows.push({ label: '改革容忍度', value: `×${n0(g._reformToleranceMult).toFixed(2)}` });
    if (g._scholarRecruitmentMult !== undefined) rows.push({ label: '士人投效', value: `×${n0(g._scholarRecruitmentMult).toFixed(2)}` });
  }
  const sections = [];
  if (!flip && m.sources) sections.push({ kind: 'ledger', title: '十四源 · 民心所由', badge: '累计', items: Object.keys(MX_SRC).filter((k) => m.sources[k] !== undefined).map((k) => ({ label: MX_SRC[k], value: signed(m.sources[k]), tone: m.sources[k] > 0 ? 'good' : m.sources[k] < 0 ? 'bad' : '' })) });
  if (!flip && m.byClass && Object.keys(m.byClass).length) {
    const ledger = Array.isArray(g._classMinxinBridgeLedger) ? g._classMinxinBridgeLedger : [];
    const norm = (v) => String(v || '').replace(/[\s　'"`.,;:!?()[\]{}<>/\\|_-]+/g, '').toLowerCase().trim();
    sections.push({ kind: 'bars', title: '分阶层 · 阶层民心', badge: `${Object.keys(m.byClass).length} 层`, items: Object.keys(m.byClass).map((cl) => {
      const cv = m.byClass[cl] || {};
      let v = Number(cv.index != null ? cv.index : cv.true);
      if (!Number.isFinite(v)) v = 60;
      let cause = cv.lastPressure || null;
      if (!cause) for (let i = ledger.length - 1; i >= 0; i -= 1) { const row = ledger[i] || {}; if (norm(row.classKey) === norm(cl) || norm(row.className) === norm(cv.className)) { cause = row; break; } }
      const why = cause ? [cause.sourceSystem || cause.source || '', cause.linkedIssue || '', cause.reason || ''].filter(Boolean).join(' · ').slice(0, 160) : '';
      const regions = cause && Array.isArray(cause.appliedRegions) ? cause.appliedRegions.map((x) => x && (x.region || x.name || x.id || x)).filter(Boolean).slice(0, 3).join(' / ') : '';
      return { label: cv.className || CLASS_NAMES[cl] || cl, value: v, trend: trendSym(cv.trend), tone: toneOf(v), note: why ? `近因 ${why}${regions ? `　牵动 ${regions}` : ''}` : '' };
    }) });
  }
  if (!flip && m.byRegion && Object.keys(m.byRegion).length) {
    sections.push({ kind: 'tiles', title: '天下民情图', badge: `${Object.keys(m.byRegion).length} 区`, items: Object.keys(m.byRegion).slice(0, 40).map((rid) => { const v = n0((m.byRegion[rid] || {}).index, 60); return { label: divisionName(rid), value: r(v), tone: v >= 60 ? 'good' : v >= 40 ? 'mid' : 'bad' }; }) });
  }
  const LEVELS = (w.AuthorityComplete && w.AuthorityComplete.REVOLT_LEVELS) || [];
  if (LEVELS.length) {
    const ongoing = (m.revolts || []).filter((x) => x.status === 'ongoing');
    sections.push({ kind: 'chain', title: '民变 · 五级升级链', badge: '流言→聚啸→暴动→起义→改朝', tone: 'bad',
      levels: LEVELS.map((lv) => ({ label: lv.name, count: ongoing.filter((x) => x.level === lv.id).length, note: lv.description || '' })),
      items: ongoing.map((x) => { const lv = LEVELS[(x.level || 1) - 1] || { name: 'L' + x.level }; return { title: `［${lv.name}］${x.region || '某地'} · 众 ${fmt(x.scale || 5000)}${x.cause ? ' · 因 ' + x.cause : ''}`, meta: x._suppressionOrder ? `官军 ${fmt(x._suppressionOrder.strength)} 讨伐中` : '', tone: 'bad' }; }) });
  }
  const signs = (g.heavenSigns || []).filter((s) => n0(g.turn) - n0(s.turn) < 12);
  if (signs.length) sections.push({ kind: 'list', title: '近年天象·祥瑞', badge: String(signs.length), items: signs.slice(-10).map((s) => ({ title: String(s.name || ''), meta: `T${s.turn}`, tone: s.type === 'good' ? 'good' : 'bad' })) });
  if (m.prophecy) {
    const pend = m.prophecy.pendingTriggers || [];
    if (pend.length || n0(m.prophecy.intensity) > 0.05) sections.push({ kind: 'list', title: '谶纬·童谣', badge: String(pend.length), lead: `流传强度 ${pct100(m.prophecy.intensity)}`, items: pend.slice(-6).map((x) => ({ title: `「${x.text}」`, side: `信度 ${pct100(x.credibility != null ? x.credibility : 0.5)}`, tone: 'mid' })) });
  }
  const FLAT = (w.PhaseD && w.PhaseD.FLATTERY_PHRASES) || [];
  if (g.huangwei && g.huangwei.tyrantSyndrome && g.huangwei.tyrantSyndrome.active && FLAT.length) sections.push({ kind: 'quotes', title: '粉饰辞藻 · 暴君段常见', items: FLAT.slice(0, 5) });
  if ((g._fengwenRecord || []).length) sections.push({ kind: 'list', title: '风闻录事', badge: '近 15', items: g._fengwenRecord.slice(-15).reverse().map((f) => ({ title: String(f.text || ''), meta: `${f.type || ''}·T${f.turn}` })) });
  const HC = (w.PhaseG1 && w.PhaseG1.HISTORICAL_CASES) || {};
  if ((HC.rebellion || []).length) sections.push({ kind: 'cases', title: '历代民变 · 鉴古', badge: String(HC.rebellion.length), items: HC.rebellion.slice(0, 15).map((c) => `［L${c.level}］${c.name}（${c.dynasty} ${c.year}）因 ${c.cause || ''} → ${c.result || ''}`) });
  return {
    key: 'minxin', title: '民心', sub: flip ? `视 ${r(p)} · ${mxBand(p)}` : `真 ${r(t)} · 视 ${r(p)} · ${MX_PHASE[m.phase] || m.phase || ''}`, rows, sealed: flip, sealedNote: SEALED_NOTE,
    spectrum: { bands: [['揭竿', 0, 20, 'bad'], ['窃盗', 20, 40, 'warn'], ['忍耐', 40, 60, 'mid'], ['安居', 60, 80, 'good'], ['颂圣', 80, 100, 'gold']], mark: shown },
    sections
  };
}

// ---------- 皇权 ----------
const HQ_SRC = { purge: '清洗', secretPolice: '厂卫', personalRule: '亲政', structureReform: '改制', militaryCentral: '收军权', tour: '巡狩', heirDecision: '定储', executePM: '诛权臣' };
const HQ_DRN = { trustedMinister: '托孤臣', eunuchsRelatives: '宦外戚', youngOrIllness: '主幼病', factionConsuming: '党争', idleGovern: '怠政', militaryDefeat: '大败', cabinetization: '票拟制', memorialObjection: '抗疏' };
function huangquan() {
  const g = G(), hq = g.huangquan || {};
  const i = n0(hq.index, 50);
  const phase = i >= 70 ? '专制' : i >= 35 ? '制衡' : '权臣';
  const tone = i >= 70 ? 'warn' : i >= 35 ? 'mid' : 'bad';
  const rows = [{ label: '皇权指数', value: `${r(i)} / 100`, tone, big: true }, { label: '段位', value: `${phase}段`, tone }];
  if (hq.executionRate) rows.push({ label: '诏令执行率', value: `${(n0(hq.executionRate) * 100).toFixed(0)}%` });
  if (w.AuthorityComplete && typeof w.AuthorityComplete.getAuthorityQuadrant === 'function') {
    try { const q = w.AuthorityComplete.getAuthorityQuadrant(); if (q) rows.push({ label: '四象限', value: q.name, note: q.description || '', tone: 'good' }); } catch (_e) { /* 未齐 */ }
  }
  if (hq.ministerFreedomToSpeak !== undefined) rows.push({ label: '进谏自由', value: pct100(hq.ministerFreedomToSpeak) });
  if (hq.memorialQuality !== undefined) rows.push({ label: '奏疏质量', value: pct100(hq.memorialQuality) });
  if (hq.reformDifficulty !== undefined) rows.push({ label: '改革难度', value: `×${n0(hq.reformDifficulty).toFixed(2)}` });
  const sections = [];
  if (hq.subDims) sections.push({ kind: 'dims', title: '四维 · 纲权所及', items: [['central', '中央'], ['provincial', '地方'], ['military', '军队'], ['imperial', '内廷']].map(([k, label]) => { const v = n0((hq.subDims[k] || {}).value); return { label, value: r(v), tone: toneOf(v, 70, 50) }; }) });
  if (hq.sources) sections.push({ kind: 'ledger', title: '八源 · 权所由立', badge: '累计', items: Object.keys(HQ_SRC).map((k) => ({ label: HQ_SRC[k], value: `+${n0(hq.sources[k]).toFixed(1)}`, tone: n0(hq.sources[k]) > 1 ? 'good' : '' })) });
  if (hq.drains) sections.push({ kind: 'ledger', title: '八降 · 权所由夺', badge: '累计', items: Object.keys(HQ_DRN).map((k) => ({ label: HQ_DRN[k], value: `-${n0(hq.drains[k]).toFixed(1)}`, tone: n0(hq.drains[k]) > 1 ? 'bad' : '' })) });
  if (hq.powerMinister) {
    const pm = hq.powerMinister;
    sections.push({ kind: 'alert', title: '权臣坐大', lead: pm.name, lines: [`控制度 ${Math.round(n0(pm.controlLevel) * 100)}% · 党羽 ${(pm.faction || []).length} · 拦截 ${n0(pm.interceptions)} · 自拟 ${n0(pm.counterEdicts)}`,
      (pm.faction || []).length ? `党羽：${pm.faction.slice(0, 8).join('、')}` : ''].filter(Boolean),
    note: '反击诸策（密诏/分党/借兵/清议/等死 等）可通过【诏令】【奏疏朱批】【鸿雁传书】诸渠道进行。' });
  }
  const pend = (g._pendingMemorials || []).filter((x) => x.status === 'drafted');
  if (pend.length) sections.push({ kind: 'list', title: '奏疏待朱批', badge: `${pend.length} 本`, tone: 'mid', go: 'docket', items: pend.slice(0, 6).map((x) => ({ title: `${x.subject || x.typeName || ''} · ${x.drafter || '某官'}`, meta: `${String(x.draftText || '').slice(0, 80)}…` })) });
  const ab = (g._abductions || []).filter((a) => n0(g.turn) - n0(a.turn) < 6 && !a.status);
  if (ab.length) sections.push({ kind: 'list', title: '抗疏', badge: String(ab.length), tone: 'bad', go: 'docket', items: ab.map((a) => ({ title: a.objector || '某官', meta: `${String(a.content || '').slice(0, 80)}…`, tone: 'bad' })) });
  const AB12 = (w.PhaseG3 && w.PhaseG3.ABDUCTION_12_CASES) || [];
  if (AB12.length) sections.push({ kind: 'cases', title: '十二抗疏典范', badge: '历代', items: AB12.map((c) => `${c.name}（${c.dynasty} ${c.year}）→ ${c.outcome || ''}`) });
  const clar = (g._pendingClarifications || []).filter((c) => c.status === 'awaiting_answer');
  if (clar.length) sections.push({ kind: 'list', title: '侍臣问疑', badge: String(clar.length), tone: 'mid', go: 'docket', items: clar.map((c) => ({ title: `诏："${String(c.originalText || '').slice(0, 60)}…"`, meta: (c.questions && c.questions[0]) || '' })) });
  const di = Array.isArray(g.dynamicInstitutions) ? g.dynamicInstitutions : (() => {
    const out = [], src = g.dynamicInstitutions;
    if (src && typeof src === 'object') ['ministries', 'regions', 'militaryUnits'].forEach((pool) => { const p = src[pool]; if (p && typeof p === 'object') Object.keys(p).forEach((k) => { if (p[k]) out.push(p[k]); }); });
    return out;
  })();
  const pendInst = (g._pendingReforms || []).filter((it) => it && it.status === '拟制中');
  if (di.length || pendInst.length) sections.push({ kind: 'list', title: '动态机构 · 制度志', badge: String(di.length + pendInst.length), items: [
    ...di.map((inst) => (inst._migratedToTree
      ? { title: inst.name, meta: '已归官制树·著为定制（员额俸给循官制·详见官制册页）', tone: 'good' }
      : { title: inst.name, meta: `品 ${inst.rank != null ? inst.rank : '—'} · ${inst.stage} · 员额 ${n0(inst.staffSize)} · 岁支 ${fmt(inst.annualBudget)}${inst.effectiveness !== undefined ? ` · 效率 ${Math.round(n0(inst.effectiveness) * 100)}% · 腐败 ${r(inst.corruption)}` : ''}`, tone: inst.stage === 'abolished' ? 'bad' : inst.stage === 'running' ? 'good' : 'mid' })),
    ...pendInst.map((it) => ({ title: `${it.reformDetail || '改制'} ${it.dept || ''}`, meta: ['待廷议裁定', it.reason ? String(it.reason).slice(0, 40) : '',
      it._charter && Array.isArray(it._charter.positions) ? `章程已拟${it._charterRevised ? '·御笔批红改定' : ''}·«${it._charter.name || it.dept || ''}» ${it._charter.positions.map((cp) => `${cp.name}(${cp.rank}×${cp.count})`).join('·')} · 开办 ${fmt(it._charter.setupCost)} 两` : ''].filter(Boolean).join(' · '), tone: 'mid' }))
  ] });
  if ((g._permanentReforms || []).length) sections.push({ kind: 'list', title: '永制 · 跨朝遗产', items: g._permanentReforms.map((x) => ({ title: String(x.id), meta: `立于 ${x.enactedDynasty || '某朝'} 第 ${x.enactedTurn} 回合${x.effects && x.effects.memorialBurdenMult ? ` · 奏疏负担 ×${x.effects.memorialBurdenMult}` : ''}` })) });
  const HC = (w.PhaseG1 && w.PhaseG1.HISTORICAL_CASES) || {};
  if ((HC.powerMinister || []).length) sections.push({ kind: 'cases', title: '历代权臣 · 鉴往知来', badge: String(HC.powerMinister.length), items: HC.powerMinister.slice(0, 10).map((c) => `${c.name}（${c.dynasty} ${c.year}）控 ${Math.round(n0(c.control) * 100)}% → ${c.ending || ''}`) });
  return { key: 'huangquan', title: '皇权', sub: `${r(i)} / 100 · ${phase}`, rows, sealed: false,
    spectrum: { bands: [['权臣', 0, 35, 'warn'], ['制衡', 35, 70, 'good'], ['专制', 70, 100, 'bad']], mark: i }, sections };
}

// ---------- 皇威 ----------
const HW_SRC = { militaryVictory: '军胜', territoryExpansion: '拓疆', grandCeremony: '大典', executeRebelMinister: '诛逆', suppressRevolt: '平乱', auspicious: '祥瑞', benevolence: '德政', selfBlame: '罪己', tribute: '朝贡', imperialFuneral: '国丧', rehabilitation: '昭雪', culturalAchievement: '文治', personalCampaign: '亲征', structuralReform: '新制' };
const HW_DRN = { militaryDefeat: '军败', diplomaticHumiliation: '辱国', idleGovern: '怠政', courtScandal: '宫闱', heavenlySign: '天象', forcedAbdication: '逼禅', brokenPromise: '食言', deposeFailure: '废立挫', imperialFlight: '出奔', capitalFall: '京畿陷', personalCampaignFail: '亲征败', familyScandal: '帝家丑', memorialObjection: '抗疏', lostVirtueRumor: '失德谣' };
const HW_PHASE = { tyrant: '暴君', majesty: '威严', normal: '常望', decline: '衰微', lost: '失威' };
function huangwei() {
  const g = G(), hw = g.huangwei || {};
  const i = n0(hw.index, 50);
  const p = hw.perceivedIndex !== undefined ? n0(hw.perceivedIndex) : i;
  const phase = hw.phase || 'normal';
  const tone = phase === 'tyrant' ? 'bad' : phase === 'majesty' ? 'good' : phase === 'normal' ? 'mid' : phase === 'decline' ? 'warn' : 'bad';
  const exec = phase === 'tyrant' ? 1.3 : phase === 'majesty' ? 1.0 : phase === 'normal' ? 0.85 : phase === 'decline' ? 0.65 : 0.35;
  const rows = [
    { label: '真实威望', value: `${r(i)} / 100`, tone, big: true },
    { label: '朝廷视野', value: `${r(p)}（粉饰 ${p - i >= 0 ? '+' : ''}${r(p - i)}）` },
    { label: '段位', value: `${HW_PHASE[phase] || phase}段`, tone },
    { label: '执行度乘数', value: `×${exec.toFixed(2)}（${exec >= 1.2 ? '令出必行' : exec >= 0.9 ? '诏命畅达' : exec >= 0.6 ? '诏行有阻' : '诏不出京'}）`, tone: exec >= 1 ? 'good' : exec >= 0.7 ? 'mid' : 'bad' }
  ];
  if (g.dynasty && w.PhaseG1 && w.PhaseG1.DYNASTY_AUTHORITY_PRESETS && w.PhaseG1.DYNASTY_AUTHORITY_PRESETS[g.dynasty]) rows.push({ label: '朝代', value: `${g.dynasty}（参朝代预设表）` });
  const sections = [];
  if (hw.subDims) sections.push({ kind: 'dims', title: '四维分项 · 天威所及', items: [['court', '朝廷'], ['provincial', '藩屏'], ['military', '军中'], ['foreign', '外邦']].map(([k, label]) => { const d = hw.subDims[k] || {}; const v = n0(d.value); return { label, value: r(v), trend: trendSym(d.trend), tone: v >= 70 ? 'good' : v >= 50 ? 'mid' : v >= 30 ? 'warn' : 'bad' }; }) });
  if (hw.sources) sections.push({ kind: 'ledger', title: '十四源 · 威所由生', badge: '累计', items: Object.keys(HW_SRC).map((k) => ({ label: HW_SRC[k], value: `+${n0(hw.sources[k]).toFixed(1)}`, tone: n0(hw.sources[k]) > 1 ? 'good' : '' })) });
  if (hw.drains) sections.push({ kind: 'ledger', title: '十四降 · 威所由损', badge: '累计', items: Object.keys(HW_DRN).map((k) => ({ label: HW_DRN[k], value: `-${n0(hw.drains[k]).toFixed(1)}`, tone: n0(hw.drains[k]) > 1 ? 'bad' : '' })) });
  const ts = hw.tyrantSyndrome;
  if (ts && ts.active) {
    const hd = ts.hiddenDamage || {};
    const TRIG = (w.PhaseD && w.PhaseD.TYRANT_AWAKENING_TRIGGERS) || [];
    sections.push({ kind: 'alert', title: '暴君综合症激活', lead: `第 ${n0(ts.activatedTurn)} 回合激活`, lines: [
      `颂圣奏疏率 ${Math.round(n0(ts.flatteryMemorialRatio) * 100)}%`, `过度执行记录 ${(ts.overExecutionLog || []).length} 条`,
      ...(ts.overExecutionLog || []).slice(-3).map((e) => `· T${e.turn} ${e.id || e.plan || '某诏'} 放大×${e.overScale || 1.3}`),
      `隐伤四累：民心暗降 ${r(hd.unreportedMinxinDrop)} · 腐败掩盖 ${r(hd.concealedCorruption)} · 错判积累 ${r(hd.accumulatedMisjudgement)} · 帑廪虚账 ${fmt(hd.fiscalBubble)}`,
      ...(TRIG.length ? [`五觉醒触发：${TRIG.map((t) => t.name).join('、')}`] : [])
    ], note: '诸隐伤将于觉醒时一次兑现（皇威 -25）' });
  }
  const la = hw.lostAuthorityCrisis;
  if (la && la.active) sections.push({ kind: 'alert', title: '失威危机激活', lead: `第 ${n0(la.activatedTurn)} 回合激活`, lines: [
    `抗疏倍频 ×${n0(la.objectionFrequency, 1).toFixed(1)}（失威段日甚）`, `地方观望 ${la.provincialWatching ? '已是' : '未现'}（执行速度 ×0.5）`, `外邦蠢动 ${Math.round(n0(la.foreignEmboldened) * 100)}%`, la._tributeStopped ? '朝贡已止' : ''
  ].filter(Boolean) });
  const hi = hw.history || {};
  const hum = hi.pastHumiliations || [];
  if ((hi.tyrantPeriods || []).length || (hi.crisisPeriods || []).length || hum.length) sections.push({ kind: 'list', title: '史 · 往日积压', items: [
    (hi.tyrantPeriods || []).length ? { title: `暴君期 ${hi.tyrantPeriods.length} 度`, tone: 'warn' } : null,
    (hi.crisisPeriods || []).length ? { title: `失威期 ${hi.crisisPeriods.length} 度`, tone: 'warn' } : null,
    hum.length ? { title: `耻辱史 ${hum.length} 件`, meta: hum.slice(-5).map((x) => x.name || x.id || '耻辱').join('、'), tone: 'bad' } : null
  ].filter(Boolean) });
  return { key: 'huangwei', title: '皇威', sub: `真 ${r(i)} · 视 ${r(p)} · ${HW_PHASE[phase] || phase}`, rows, sealed: false,
    spectrum: { bands: [['失威', 0, 30, 'bad'], ['衰微', 30, 50, 'warn'], ['常望', 50, 70, 'mid'], ['威严', 70, 90, 'good'], ['暴君', 90, 100, 'bad']], mark: i }, sections };
}

export function detail(key) {
  return key === 'lizhi' ? lizhi() : key === 'minxin' ? minxin() : key === 'huangquan' ? huangquan() : huangwei();
}

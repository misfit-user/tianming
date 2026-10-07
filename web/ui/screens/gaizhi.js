// 科举改制册（科举册「更定取士之法」）：左叶是奏稿——所改诸条随改随录，各党预判、朝议揣度、议题文字，末了「付科议」；
// 右叶十门（宗旨、科目、考期、考生、主考、录取、授官、身份、仪轨、筹议）逐项更定：选项作签，立罢作章，旧制处留「旧」字为记。
// 草稿只在本册里，付科议才交出（game.gaizhi → 内核 _kjpSubmitReform → 科议）；科议没开成，草稿原样还回。
import { h, replaceChildren } from '../core/dom.js';
import { bus } from '../core/bus.js';
import { num } from '../core/numerals.js';
import { juan } from '../kit/index.js';

const toast = (text) => bus.emit('kernel:toast', { text });
const zh = (s) => String(s || '').replace(/\d+/g, (m) => num(Number(m)));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const TABS = ['zhi', 'ke', 'qi', 'sheng', 'kao', 'qu', 'guan', 'shen', 'li', 'yi'];

export function createGaizhi({ root, game, onOpen, onClose, onPerson }) {
  const Z = game.gaizhi;
  let d = null;              // 草稿
  let tab = 'zhi';
  let topicEdited = null;    // 玩家手改的议题；null 则随条陈自生
  let opened = false;
  let pending = false;       // 已付科议、待其开成
  let who = '';              // 召对之人
  let whoIntent = 'probe';
  let whoFilter = '';
  let otherEras = false;

  const title = h('h2', '改制');
  const sub = h('small');
  const left = h('section.ce-leaf.left.kg-left');
  const tabsEl = h('nav.kg-tabs');
  const pane = h('div.kg-pane');
  const right = h('section.ce-leaf.right.kg-right', tabsEl, pane);
  const shut = h('button.ce-close.q-yapai', { type: 'button', onclick: () => hide() }, '合册');
  const book = h('div.ce-book', h('div.ce-ling'), left, h('div.ce-gutter'), right, shut);
  const ov = h('div.ce-ov.kg-ov', { role: 'dialog', 'aria-label': '科举改制' }, book);
  ov.addEventListener('pointerdown', (e) => { if (e.target === ov) hide(); });
  root.append(ov);

  // ---------- 小器 ----------
  const entries = (m) => (Array.isArray(m) ? m : Object.entries(m));
  function row(label, body, note) {
    return h('div.kg-row', h('span.kg-k', label), h('div.kg-v', body, note ? h('small.kg-note', note) : null));
  }
  function block(name, note, ...body) {
    return h('section.kg-block', h('h5', h('span', name), note ? h('small', note) : null), ...body);
  }
  // 签：单选或多选；旧制所在的那一签描虚边
  function chips(map, cur, base, pick, multi) {
    return h('div.kg-chips', entries(map).map(([k, label]) => {
      const on = multi ? (cur || []).includes(k) : cur === k;
      const was = multi ? (base || []).includes(k) : base === k;
      return h('button' + (on ? '.on' : '') + (was ? '.was' : ''), { type: 'button', title: was ? '旧制如此' : '', onclick: () => { pick(k); changed(); } }, label);
    }));
  }
  // 章：立／罢
  function toggle(label, cur, base, set) {
    return h('button.kg-tog' + (cur ? '.on' : '') + (!!cur !== !!base ? '.chg' : ''), { type: 'button', title: !!cur !== !!base ? `旧制${base ? '立' : '罢'}` : '', onclick: () => { set(!cur); changed(); } },
      h('i', cur ? '立' : '罢'), h('span', label));
  }
  function stepper(cur, base, { min = 0, max = 100, step = 1, unit = '' }, set) {
    const v = Number(cur) || 0;
    const inp = h('input.kg-num', { type: 'number', min, max, step, value: v });
    const put = (x) => { set(Math.max(min, Math.min(max, Math.round(Number(x) || 0)))); changed(); };
    inp.addEventListener('change', () => put(inp.value));
    return h('span.kg-step' + (v !== Number(base) ? '.chg' : ''),
      h('button', { type: 'button', onclick: () => put(v - step) }, '−'), inp, h('button', { type: 'button', onclick: () => put(v + step) }, '＋'),
      unit ? h('small', unit) : null, v !== Number(base) ? h('em.kg-was', `旧${zh(base)}`) : null);
  }
  // 文字：改完离手（change）才记，不重画右叶——免得吞掉下一下点击
  function text(cur, base, ph, set) {
    const inp = h('input.kg-in' + (cur !== base ? '.chg' : ''), { type: 'text', value: cur || '', placeholder: ph || '' });
    inp.addEventListener('change', () => { set(inp.value.trim()); inp.classList.toggle('chg', inp.value.trim() !== (base || '')); changed(false); });
    return inp;
  }
  function aiBtn(label, key, f) {
    const on = Z.isBusy(d, key);
    return h('button.q-yapai.kg-ai', { type: 'button', disabled: on, onclick: () => runAI(key, f) }, on ? '议中…' : label);
  }
  async function runAI(key, f) {
    const p = f();
    renderPane();
    try { await p; } catch (e) { toast(e.message); }
    if (opened) changed();
  }
  const aiNote = (src) => (src === 'fallback' ? h('small.kg-fb', Z.aiReady() ? '（AI 未答，按成法推断）' : '（未接 AI，按成法推断）') : null);

  // ---------- 左叶：奏稿 ----------
  function topicText() { return topicEdited != null ? topicEdited : Z.topic(d); }
  function renderLeft() {
    const list = Z.items(d);
    const wt = Z.weight(d);
    const era = Z.era();
    sub.textContent = [era.name, '更定取士之法'].filter(Boolean).join(' · ');
    const intent = d.intent === 'restoration' ? `复古${d.restorationDynasty ? `·${d.restorationDynasty}制` : ''}` : '更张';
    const mag = Z.MAGNITUDE.find((m) => m.key === d.magnitudeDescriptorPreset);
    const head = h('div.kg-state',
      h('span.kg-seal', intent),
      h('span', h('small', '其势'), h('b', mag ? mag.name : d._l10PresetId ? '依成例' : d.magnitudeDescriptor ? '自道' : '未定')),
      h('span.kg-size', h('small', '所改'), h('i', h('u', { style: { width: `${Math.min(100, wt.magnitude)}%` } })), h('b', wt.magnitude >= 60 ? '大' : wt.magnitude >= 30 ? '中' : wt.magnitude > 0 ? '小' : '无')));
    const tiao = block('条陈', list.length ? `${num(list.length)}条` : '',
      list.length ? h('ol.kg-items', list.map((x) => h('li', { onclick: () => { tab = x.sec; renderRight(); } }, zh(x.text))))
        : h('p.kg-empty', '尚未更动一条。在右叶各门里改动，所改即录于此。'),
      d._l10PresetCanonicalName ? h('p.kg-preset', `援引成例：${d._l10PresetCanonicalName}${d._l10PresetBy ? `（${d._l10PresetBy}）` : ''}`) : null);
    replaceChildren(left, h('header.ce-head', title, sub), head, tiao, stanceBlock(), topicBlock(), actsBlock());
  }
  function stanceBlock() {
    const st = Z.stance(d);
    const sum = st.reduce((a, r) => ({ s: a.s + r.support, n: a.n + r.neutral, o: a.o + r.oppose }), { s: 0, n: 0, o: 0 });
    const all = sum.s + sum.n + sum.o;
    const stale = Z.moodStale(d);
    const keys = (d.courtMoodKeyNpcs || []).filter(Boolean);
    return block('朝议预判', '科议过六成可行',
      all ? h('div.kg-tally', h('i.s', { style: { flexGrow: sum.s } }), h('i.n', { style: { flexGrow: sum.n } }), h('i.o', { style: { flexGrow: sum.o } })) : null,
      all ? h('p.kg-tally-note', h('span.s', `赞成${num(sum.s)}`), h('span.n', `观望${num(sum.n)}`), h('span.o', `反对${num(sum.o)}`)) : h('p.kg-empty', '朝中无党籍之臣可推。'),
      st.length ? h('div.kg-parties', st.map((r) => h('div.kg-party.' + r.stance, h('b', r.party),
        h('div.bar', h('i.s', { style: { flexGrow: r.support } }), h('i.n', { style: { flexGrow: r.neutral } }), h('i.o', { style: { flexGrow: r.oppose } })),
        h('small', `${Z.STANCE[r.stance] || ''} · ${num(r.members)}人`)))) : null,
      d.courtMoodNarrative ? h('div.kg-mood' + (stale ? '.stale' : ''), h('p', d.courtMoodNarrative),
        h('small', stale ? '条款已改，此揣度已旧' : `众议约${num(Math.round(d.courtMoodScale))}分可成`),
        keys.length ? h('p.kg-keys', h('span', '关节之人'), keys.map((n) => h('button.link', { type: 'button', onclick: () => { who = n; tab = 'yi'; renderRight(); } }, n))) : null) : null,
      h('div.kg-row-acts', aiBtn(d.courtMoodNarrative ? '再揣度' : '揣度朝议', 'mood', () => Z.courtMood(d))));
  }
  function topicBlock() {
    const ta = h('textarea.kg-topic', { rows: 4, spellcheck: false, placeholder: '条陈既定，议题自成；亦可手改。' });
    ta.value = topicText();
    ta.addEventListener('input', () => { topicEdited = ta.value; });
    return block('议题', topicEdited != null ? '已手改' : '随条陈自成', ta,
      topicEdited != null ? h('div.kg-row-acts', h('button.link', { type: 'button', onclick: () => { topicEdited = null; renderLeft(); } }, '复原为条陈所成')) : null);
  }
  function actsBlock() {
    const c = Z.check(d, topicText());
    return h('div.kg-acts',
      h('button.q-yapai', { type: 'button', onclick: reset }, '重拟'),
      h('button.q-yapai.main', { type: 'button', disabled: !c.ok, title: c.why, onclick: submit }, '付科议'),
      c.ok ? null : h('small', c.why));
  }

  // ---------- 右叶：十门 ----------
  function counts() {
    const n = {};
    for (const x of Z.items(d)) n[x.sec] = (n[x.sec] || 0) + 1;
    n.yi = (d.privateAudiences || []).length + (d.pilotScope && !/^全国/.test(d.pilotScope.name || '') ? 1 : 0);
    return n;
  }
  function renderTabs() {
    const n = counts();
    replaceChildren(tabsEl, TABS.map((k) => {
      const [g, name] = Z.SECTIONS[k];
      return h('button' + (tab === k ? '.on' : ''), { type: 'button', onclick: () => { tab = k; renderRight(); } }, h('i', g), h('b', name), h('small', n[k] ? `改${num(n[k])}` : ''));
    }));
  }
  function renderPane() {
    const top = pane.scrollTop;
    const f = { zhi: paneZhi, ke: paneKe, qi: paneQi, sheng: paneSheng, kao: paneKao, qu: paneQu, guan: paneGuan, shen: paneShen, li: paneLi, yi: paneYi }[tab];
    const [, name, note] = Z.SECTIONS[tab];
    replaceChildren(pane, h('header.kg-head', h('h3', name), h('p', note)), f());
    pane.scrollTop = top;
  }
  function renderRight() { renderTabs(); renderPane(); }
  function changed(pane = true) {
    if (!opened) return;
    renderLeft();
    renderTabs();
    if (pane) renderPane();
  }

  // 一、宗旨
  function paneZhi() {
    const out = [];
    out.push(row('意向', chips(Z.INTENT, d.intent, 'reform', (k) => { d.intent = k; if (k === 'reform') d.restorationDynasty = ''; })));
    if (d.intent === 'restoration') out.push(row('所复', chips([['', '祖宗成法']].concat(Z.DYNASTIES.map((x) => [x, `${x}制`])), d.restorationDynasty, '', (k) => { d.restorationDynasty = k; })));
    const mp = d.magnitudeParsed;
    // 阻力：AI 所解是 0~100 之数；历代成例里 scale 是等第名（major 等），数在 radical
    const resist = mp ? [mp.scale, mp.radical].map(Number).find((v) => Number.isFinite(v)) : null;
    const desc = h('input.kg-in', { type: 'text', value: Z.MAGNITUDE.some((m) => m.key === d.magnitudeDescriptorPreset) ? '' : d.magnitudeDescriptor, placeholder: '或自道其势，如「先试三科，十年乃行」' });
    desc.addEventListener('change', () => { if (desc.value.trim()) { Z.setMagnitude(d, '', desc.value); changed(); } });
    out.push(row('其势', [
      h('div.kg-mags', Z.MAGNITUDE.map((m) => h('button.kg-mag' + (d.magnitudeDescriptorPreset === m.key ? '.on' : ''), { type: 'button', onclick: () => { Z.setMagnitude(d, m.key); changed(); } },
        h('b', m.name), h('small', m.note)))),
      h('div.kg-line', desc, d.magnitudeDescriptor ? aiBtn(mp ? '重解' : '解读其势', 'mag', () => Z.parseMagnitude(d)) : null),
      mp ? h('p.kg-parsed', h('b', mp.paraphrase || d.magnitudeDescriptor), resist != null ? h('span', `阻力${zh(resist)}`) : null, h('span', `约${zh(mp.years)}年见效`), h('span', mp.reversible ? '尚可反复' : '难以反复'), aiNote(mp._source)) : null
    ], '其势越急，阻力越大，见效越快'));
    out.push(row('取士之本', chips(Z.IDEOLOGY, d.ideologyDraft, d.ideologyBase, (k) => { d.ideologyDraft = k; }), Z.IDEOLOGY_NOTE[d.ideologyDraft]));
    const known = Object.keys(Z.LANGUAGE).includes(d.languageDraft);
    out.push(row('试卷文体', [chips(Z.LANGUAGE, d.languageDraft, d.languageBase, (k) => { d.languageDraft = k; }),
      text(known ? '' : d.languageDraft, known ? '' : d.languageBase, '或另定，如「文言兼蒙文」', (v) => { if (v) d.languageDraft = v; })]));
    // 历代成例
    const ps = Z.presets();
    const mine = ps.filter((p) => p.same);
    const others = ps.filter((p) => !p.same);
    const card = (p) => h('div.kg-case' + (d._l10PresetId === p.id ? '.on' : ''), h('header', h('b', p.name), h('small', `${p.era} · ${p.by} · ${p.year < 0 ? `前${zh(-p.year)}` : zh(p.year)}年`)),
      p.context ? h('p', p.context) : null, p.note ? h('p.dim', p.note) : null,
      h('button.q-yapai', { type: 'button', onclick: () => { try { toast(`已援引${Z.applyPreset(d, p.id)}，可再增删`); } catch (e) { toast(e.message); } changed(); } }, d._l10PresetId === p.id ? '再援引' : '援引'));
    out.push(block('历代成例', '援引则并入草稿：科目、宗旨、考期、其势',
      mine.length ? h('div.kg-cases', mine.map(card)) : h('p.kg-empty', '本朝无现成之例。'),
      others.length ? h('button.link.kg-more', { type: 'button', onclick: () => { otherEras = !otherEras; renderPane(); } }, otherEras ? '收起他朝成例' : `他朝成例${num(others.length)}条`) : null,
      otherEras ? h('div.kg-cases', others.map(card)) : null));
    // 改制沿革
    const hist = Z.history();
    const ip = Z.inProgress();
    out.push(block('改制沿革', ip ? `前番改制推行中，${num(ip.years)}年乃定` : '',
      hist.length ? h('ol.kg-hist', hist.map((e) => h('li', h('header', h('b', e.name), h('small', [e.year ? `${zh(e.year)}年` : '', e.by, e.method, e.status].filter(Boolean).join(' · '))), e.text ? h('p', e.text) : null)))
        : h('p.kg-empty', '本朝未尝改制。')));
    return out;
  }
  // 二、科目
  function paneKe() {
    const base = new Map((d.subjectsBase || []).map((s) => [s.id, s]));
    const sumEl = h('p.kg-sum');
    const updateSum = () => {
      const s = d.subjectsDraft.reduce((a, x) => a + (Number(x.weight) || 0), 0);
      sumEl.className = 'kg-sum' + (s > 100 ? ' over' : s < 100 ? ' under' : '');
      sumEl.textContent = `诸科合计${zh(s)}%${s > 100 ? '，已过十成' : s < 100 ? '，未足十成' : ''}`;
    };
    const rows = d.subjectsDraft.map((s, i) => {
      const b = base.get(s.id);
      const val = h('b.w', `${zh(s.weight)}%`);
      const rg = h('input.kg-range', { type: 'range', min: 0, max: 100, step: 5, value: Number(s.weight) || 0 });
      rg.addEventListener('input', () => { s.weight = Number(rg.value); val.textContent = `${zh(s.weight)}%`; updateSum(); });
      rg.addEventListener('change', () => { Z.edited(d); changed(); });
      return h('div.kg-subj' + (!b ? '.new' : b.weight !== s.weight ? '.chg' : ''),
        h('span.nm', s.name), h('small.fmt', [Z.IDEOLOGY[s.ideology], s.format].filter(Boolean).join(' · ')), rg, val,
        b ? (b.weight !== s.weight ? h('em.kg-was', `旧${zh(b.weight)}%`) : h('em')) : h('em.kg-new', '新增'),
        h('button.kg-x', { type: 'button', title: '罢此一科', onclick: () => { d.subjectsDraft.splice(i, 1); Z.edited(d); changed(); } }, '罢'));
    });
    const gone = (d.subjectsBase || []).filter((b) => !d.subjectsDraft.some((s) => s.id === b.id)).map((b) => h('div.kg-subj.gone',
      h('span.nm', b.name), h('small.fmt', b.format || ''), h('span'), h('b.w', `${zh(b.weight)}%`), h('em.kg-was', '已罢'),
      h('button.kg-x', { type: 'button', title: '复此一科', onclick: () => { d.subjectsDraft.push(JSON.parse(JSON.stringify(b))); Z.edited(d); changed(); } }, '复')));
    updateSum();
    const cands = Z.candidates(d);
    const sug = d.l6Suggestions || [];
    const mine = h('input.kg-in', { type: 'text', placeholder: '自拟一科，如「河工：试治水之策」' });
    return [h('div.kg-subjs', rows, gone), sumEl,
      block('增科', '', cands.length ? h('div.kg-chips', cands.map((c) => h('button', { type: 'button', title: c.format, onclick: () => { Z.addCandidate(d, c.id); changed(); } }, `＋${c.name}`))) : null),
      block('访求新科', '由 AI 依时势荐科，或自拟一科由 AI 酌定其体',
        h('div.kg-row-acts', aiBtn(sug.length ? '再访' : '访求', 'l6', () => Z.suggestSubjects(d))),
        sug.length ? h('div.kg-sugs', sug.map((s) => {
          const inn = d.subjectsDraft.some((x) => x.id === s.id || x.name === s.name);
          return h('div.kg-sug', h('header', h('b', s.name), h('small', [Z.IDEOLOGY[s.ideology], `${zh(s.weight)}%`, s.format].filter(Boolean).join(' · '))),
            s.rationale ? h('p', s.rationale) : null, s.historicalAnalog ? h('p.dim', s.historicalAnalog) : null,
            h('button.q-yapai', { type: 'button', disabled: inn, onclick: () => { try { Z.acceptSubject(d, s); } catch (e) { toast(e.message); } changed(); } }, inn ? '已收入' : '收入'));
        })) : null,
        h('div.kg-line', mine, aiBtn('拟成', 'l6', () => Z.customSubject(d, mine.value))))];
  }
  // 三、考期
  function paneQi() {
    return [
      row('几年一科', stepper(d.examIntervalDraft, d.examIntervalBase, { min: 0, max: 20, unit: '年一科' }, (v) => { d.examIntervalDraft = v; }), '〇为不定期'),
      row('落第再试', chips(Z.RETAKE, d.retakePolicyDraft, d.retakePolicyBase, (k) => { d.retakePolicyDraft = k; })),
      row('试级', h('p.kg-chain', Z.tiers(d).map((t, i) => [i ? h('i', '→') : null, h('span', t)])), '试级之增删，此番不能更定')
    ];
  }
  // 四、考生
  function paneSheng() {
    const c = d.candidateRulesDraft, b = d.candidateRulesBase;
    const ex = c.excludedClasses || (c.excludedClasses = []);
    const all = [...new Set(Z.CLASSES.concat(ex, b.excludedClasses || []))];
    return [
      row('应考之限', h('div.kg-togs',
        toggle('须有本籍', c.requirePrefecture, b.requirePrefecture, (v) => { c.requirePrefecture = v; }),
        toggle('须有保举', c.requireRecommendation, b.requireRecommendation, (v) => { c.requireRecommendation = v; }),
        toggle('许外国宾贡', c.allowForeigner, b.allowForeigner, (v) => { c.allowForeigner = v; }),
        toggle('许诸族应考', c.allowMinority, b.allowMinority, (v) => { c.allowMinority = v; }))),
      row('年岁', h('div.kg-line', stepper(c.minAge, b.minAge, { min: 0, max: 100, unit: '岁起' }, (v) => { c.minAge = v; }),
        stepper(c.maxAge, b.maxAge, { min: 0, max: 120, unit: '岁止' }, (v) => { c.maxAge = v; })), c.minAge > c.maxAge ? '起岁大于止岁，无人可考' : ''),
      row('考费', chips(Z.FEE, c.feeReimbursement, b.feeReimbursement, (k) => { c.feeReimbursement = k; })),
      row('禁考之人', h('div.kg-classes', all.map((k) => {
        const banned = ex.includes(k);
        const was = (b.excludedClasses || []).includes(k);
        return h('button' + (banned ? '.ban' : '') + (banned !== was ? '.chg' : ''), { type: 'button', title: banned !== was ? `旧制${was ? '禁' : '准'}` : '',
          onclick: () => { c.excludedClasses = banned ? ex.filter((x) => x !== k) : ex.concat(k); changed(); } }, h('i', banned ? '禁' : '准'), k);
      })), '点之则禁准互换')
    ];
  }
  // 五、主考
  function paneKao() {
    const e = d.examinerRulesDraft, b = d.examinerRulesBase;
    const av = e.avoidanceRules || (e.avoidanceRules = {});
    const bav = b.avoidanceRules || {};
    return [
      row('主考许用', chips(Z.EXAMINER, e.type || [], b.type || [], (k) => { const t = e.type || []; e.type = t.includes(k) ? t.filter((x) => x !== k) : t.concat(k); }, true), (e.type || []).length ? '' : '无人可任主考'),
      row('在官年数', stepper(e.minYears, b.minYears, { min: 0, max: 50, unit: '年以上' }, (v) => { e.minYears = v; })),
      row('防弊', h('div.kg-togs', toggle('糊名', e.blindScoring, b.blindScoring, (v) => { e.blindScoring = v; }), toggle('誊录', e.blindCopying, b.blindCopying, (v) => { e.blindCopying = v; }))),
      row('回避', h('div.kg-togs', Object.entries(Z.AVOID).map(([k, label]) => toggle(label, av[k], bav[k], (v) => { av[k] = v; })))),
      row('考场监临', chips(Z.INSPECTION, e.inspectionLevel, b.inspectionLevel, (k) => { e.inspectionLevel = k; })),
      row('座主门生', chips(Z.MENTOR, e.mentorBondStrength, b.mentorBondStrength, (k) => { e.mentorBondStrength = k; })),
      row('泄题之罚', chips(Z.PENALTY, e.leakPenalty, b.leakPenalty, (k) => { e.leakPenalty = k; }))
    ];
  }
  // 六、录取
  function paneQu() {
    const q = d.quotaDraft, b = d.quotaBase;
    q.ratios = q.ratios || {};
    const dims = Object.entries(Z.RATIO).map(([k, label]) => {
      const r = q.ratios[k] || (q.ratios[k] = { enabled: false, strategy: 'none', values: {}, strictness: 'guidance' });
      const br = (b.ratios || {})[k] || { enabled: false, values: {} };
      r.values = r.values || {};
      const vals = Object.entries(r.values);
      const sum = vals.reduce((a, [, v]) => a + (Number(v) || 0), 0);
      const key = h('input.kg-in.short', { type: 'text', placeholder: '名目' });
      const amt = h('input.kg-num', { type: 'number', min: 0, max: 100, placeholder: '分' });
      const add = () => { const k2 = key.value.trim(); if (!k2) return; r.values = Object.assign({}, r.values, { [k2]: Number(amt.value) || 0 }); changed(); };
      return h('div.kg-ratio' + (!same({ e: r.enabled, v: r.values }, { e: br.enabled, v: br.values || {} }) ? '.chg' : ''),
        toggle(label, r.enabled, br.enabled, (v) => { r.enabled = v; }),
        r.enabled ? h('div.kg-vals', vals.map(([k2, v]) => {
          const inp = h('input.kg-num', { type: 'number', min: 0, max: 100, value: Number(v) || 0 });
          inp.addEventListener('change', () => { r.values = Object.assign({}, r.values, { [k2]: Number(inp.value) || 0 }); changed(false); });
          return h('span.kg-val', h('b', k2), inp, h('button.kg-x', { type: 'button', title: '删去', onclick: () => { const o = Object.assign({}, r.values); delete o[k2]; r.values = o; changed(); } }, '删'));
        }), h('span.kg-val.add', key, amt, h('button.kg-x', { type: 'button', onclick: add }, '添')), vals.length ? h('small', `合${zh(sum)}`) : null) : null);
    });
    return [
      row('每科取士', stepper(q.total, b.total, { min: 0, max: 9999, step: 10, unit: '名' }, (v) => { q.total = v; })),
      row('名次', chips(Z.RANKING, d.rankingRuleDraft, d.rankingRuleBase, (k) => { d.rankingRuleDraft = k; })),
      row('分卷分额', h('div.kg-ratios', dims), '如南北分卷：南卷若干、北卷若干')
    ];
  }
  // 七、授官
  function paneGuan() {
    const a = d.allocationRulesDraft, b = d.allocationRulesBase;
    return [
      ...Object.entries(Z.ALLOC).map(([k, label]) => {
        const c = a[k] || (a[k] = { count: 0, positions: [], ranks: {}, privileges: {} });
        const bc = b[k] || { count: 0, positions: [] };
        return row(label, h('div.kg-line',
          stepper(c.count, bc.count, { min: 0, max: 999, unit: '人' }, (v) => { c.count = v; }),
          text((c.positions || []).join('、'), (bc.positions || []).join('、'), '授何官，以顿号分', (v) => { c.positions = v.split(/[,，、\s]+/).filter(Boolean); })));
      }),
      row('候选', stepper(a.waitingYears, b.waitingYears, { min: 0, max: 20, unit: '年' }, (v) => { a.waitingYears = v; }), '新科及第至授官，候选几年'),
      row('授官', h('div.kg-togs', toggle('须经亲审', a.imperialReviewRequired, b.imperialReviewRequired, (v) => { a.imperialReviewRequired = v; }),
        toggle('许身后改定门生', a.posthumousAdjustment, b.posthumousAdjustment, (v) => { a.posthumousAdjustment = v; })))
    ];
  }
  // 八、身份与联动
  function paneShen() {
    const t = d.taxPrivilegeDraft || (d.taxPrivilegeDraft = {}), bt = d.taxPrivilegeBase || {};
    return [
      row('登第之称', text(d.graduateTitleDraft, d.graduateTitleBase, '进士', (v) => { d.graduateTitleDraft = v; })),
      row('同年', chips(Z.COHORT, d.cohortBondStrengthDraft, d.cohortBondStrengthBase, (k) => { d.cohortBondStrengthDraft = k; })),
      row('座主谱系', toggle('录座主门生谱系', d.mentorLineageDraft, d.mentorLineageBase, (v) => { d.mentorLineageDraft = v; })),
      row('学校', chips(Z.SCHOOL, d.schoolIntegrationDraft, d.schoolIntegrationBase, (k) => { d.schoolIntegrationDraft = k; })),
      row('优免', h('div.kg-togs', Object.entries(Z.TAX).map(([k, label]) => toggle(label, t[k], bt[k], (v) => { t[k] = v; })),
        toggle('宗族优免', d.clanPrivilegeDraft, d.clanPrivilegeBase, (v) => { d.clanPrivilegeDraft = v; }))),
      row('荫叙', chips(Z.SHADOW, d.shadowDraft, d.shadowBase, (k) => { d.shadowDraft = k; }), '官员子孙不由科举而得官')
    ];
  }
  // 九、仪轨与刑罚
  function paneLi() {
    const c = d.ceremonyDraft || (d.ceremonyDraft = {}), b = d.ceremonyBase || {};
    const p = d.penaltiesDraft || (d.penaltiesDraft = {}), bp = d.penaltiesBase || {};
    return [
      row('殿试', text(c.palaceTest, b.palaceTest, '如「殿试·亲策」', (v) => { c.palaceTest = v; })),
      row('放榜', text(c.rosterRelease, b.rosterRelease, '如「金榜·传胪大典」', (v) => { c.rosterRelease = v; })),
      row('诸仪', h('div.kg-togs', Object.entries(Z.CEREMONY_FLAGS).map(([k, label]) => toggle(label, c[k], b[k], (v) => { c[k] = v; })))),
      row('谢恩叩拜', stepper(c.kowtowRound, b.kowtowRound, { min: 0, max: 20, unit: '次' }, (v) => { c.kowtowRound = v; })),
      ...Object.entries(Z.CRIME).map(([k, label]) => row(`${label}之罚`, chips(Z.PENALTY, p[k], bp[k], (v) => { p[k] = v; })))
    ];
  }
  // 十、筹议：试点、私下召对
  function paneYi() {
    const ps = d.pilotScope || {};
    const cands = d.pilotCandidates || [];
    const own = h('input.kg-in', { type: 'text', placeholder: '自定试点，如「南直隶」' });
    const pilot = block('试点', '先于一隅试行，见效再推天下',
      h('p.kg-pilot', h('b', ps.name || '全国一举'), ps.reason && ps.source !== 'default' ? h('small', ps.reason) : null,
        !/^全国/.test(ps.name || '') ? h('button.link', { type: 'button', onclick: () => { d.pilotScope = { name: '全国一举', reason: '默认·中枢直辖', source: 'default' }; changed(); } }, '复为全国一举') : null),
      h('div.kg-row-acts', aiBtn(cands.length ? '再荐' : '荐试点', 'pilot', () => Z.suggestPilots(d))),
      cands.length ? h('div.kg-sugs', cands.map((c) => h('div.kg-sug' + (ps.name === c.name ? '.on' : ''), h('header', h('b', c.name), h('small', [c.expectedResistance ? `阻力${c.expectedResistance}` : '', c.historicalParallel].filter(Boolean).join(' · '))),
        c.reason ? h('p', c.reason) : null, h('button.q-yapai', { type: 'button', onclick: () => { Z.setPilot(d, c); changed(); } }, ps.name === c.name ? '已定' : '定为试点')))) : null,
      h('div.kg-line', own, h('button.q-yapai', { type: 'button', onclick: () => { const v = own.value.trim(); if (!v) return; Z.setPilot(d, { name: v, source: 'custom' }); changed(); } }, '定')));
    // 召对
    const ms = Z.ministers();
    const keys = new Set(d.courtMoodKeyNpcs || []);
    const search = h('input.kg-in', { type: 'text', value: whoFilter, placeholder: '查人：名、党、官' });
    search.addEventListener('input', () => { whoFilter = search.value; renderPeople(); });
    const people = h('div.kg-people');
    function renderPeople() {
      const ff = whoFilter.trim();
      const list = ms.filter((m) => !ff || m.name.includes(ff) || m.party.includes(ff) || m.title.includes(ff)).sort((a, b) => (keys.has(b.name) ? 1 : 0) - (keys.has(a.name) ? 1 : 0)).slice(0, 14);
      replaceChildren(people, list.length ? list.map((m) => h('button' + (who === m.name ? '.on' : '') + (keys.has(m.name) ? '.key' : ''), { type: 'button', onclick: () => { who = m.name; renderPane(); } },
        h('b', m.name), h('small', [m.party, m.title].filter(Boolean).join(' · ')), m.lean ? h('em' + (m.lean > 0 ? '.s' : '.o'), m.lean > 0 ? '倾改' : '倾守') : null)) : h('p.kg-empty', '无合此者。'));
    }
    renderPeople();
    const recs = (d.privateAudiences || []).slice().reverse();
    const aud = block('私下召对', '先于议前私见其人：许以好处、施以威压，或探其口风',
      h('div.kg-line', search), people,
      h('div.kg-line', h('span.kg-who', who ? h('b', who) : h('small', '未择其人'), who && onPerson ? h('button.link', { type: 'button', onclick: () => onPerson(who) }, '列传') : null),
        chips(Z.AUDIENCE, whoIntent, '', (k) => { whoIntent = k; }), who ? aiBtn('召对', 'aud', () => Z.audience(d, who, whoIntent)) : null),
      recs.length ? h('div.kg-recs', recs.map((r) => h('div.kg-rec' + (r.failed ? '.fail' : r.willAccept ? '.yes' : '.no'),
        h('header', h('b', r.npc), h('small', Z.AUDIENCE[r.intent] || ''), h('i', r.failed ? '未成' : r.willAccept ? '允' : '未允'),
          r.supportDelta ? h('em' + (r.supportDelta > 0 ? '.s' : '.o'), `${r.supportDelta > 0 ? '+' : '−'}${zh(Math.abs(r.supportDelta))}`) : null),
        h('p', r.speech || ''), r.offerTerms ? h('p.dim', `所求：${r.offerTerms}`) : null, Z.costText(r.cost) ? h('p.dim', `代价：${zh(Z.costText(r.cost))}`) : null, r.fallback ? aiNote('fallback') : null))) : null);
    return [pilot, aud];
  }

  // ---------- 开合与付议 ----------
  function ask(text, ok) {
    return new Promise((resolve) => {
      let yes = false;
      const j = juan({ title: '改制', width: '26rem', content: h('p', { style: { margin: 0, lineHeight: 2 } }, text), actions: [{ label: ok, onclick: ({ close }) => { yes = true; close('ok'); } }] });
      j.closed.then(() => resolve(yes));
    });
  }
  async function reset() {
    if (Z.items(d).length && !(await ask('弃去此稿，从现行之制重拟？', '重拟'))) return;
    d = Z.draft();
    topicEdited = null;
    tab = 'zhi';
    render();
  }
  async function submit() {
    const text = topicText();
    const c = Z.check(d, text);
    if (!c.ok) return toast(c.why);
    if (c.weightSum > 100 && !(await ask(`诸科所占合计${zh(c.weightSum)}%，已过十成，议时恐生枝节。仍付科议？`, '仍付科议'))) return;
    pending = true;
    hide('submit');
    try { Z.submit(d, text); } catch (e) { pending = false; show(); toast(e.message); }
  }
  // 科议没开成：草稿还回；开成了：此稿已交出
  bus.on('keyi:declined', () => { if (pending) { pending = false; show(); toast('科议未开，草稿仍在'); } });
  bus.on('keyi:changed', (s) => { if (pending && s && s.open) { pending = false; d = null; topicEdited = null; } });
  bus.on('ui:gaizhi', () => show());

  function render() { renderLeft(); renderRight(); }
  function show() {
    const ok = Z.available();
    if (!ok.ok) { toast(ok.why); return false; }
    if (!d) { try { d = Z.draft(); } catch (e) { toast(e.message); return false; } }
    opened = true;
    onOpen?.();
    render();
    ov.classList.add('on');
    return true;
  }
  function hide(reason) {
    if (!opened) return;
    opened = false;
    ov.classList.remove('on');
    onClose?.(reason);
  }
  window.addEventListener('keydown', (e) => {
    if (!opened || document.querySelector('.q-juan-veil')) return;
    if (e.key === 'Escape' && !/^(INPUT|TEXTAREA)$/.test((document.activeElement || {}).tagName || '')) { e.stopPropagation(); hide(); }
  }, true);
  return { show, hide, get opened() { return opened; } };
}

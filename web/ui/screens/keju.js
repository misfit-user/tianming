// 科举册：左叶制度、本科进程（各阶段与日数）、经费、历届、特科与学派；右叶是此刻要办的那一步——
// 选主考、阅定会试题、开榜、拟殿试策问、开殿试、读卷钦定三甲、金榜放榜（纳入人物志、授官、收科），没开科时看历届金榜与特科。
// 阅卷展一卷，答卷誊在朱丝栏试卷上竖写，主考批语朱书卷首。数据与动作经 game.keju（adapter/keju.js）；
// 科议（筹办、礼部议题）由 game.keyi 拉起，画在殿上（screens/keyi.js）。叫法取 profile().keju。
import { h, replaceChildren } from '../core/dom.js';
import { bus } from '../core/bus.js';
import { num } from '../core/numerals.js';
import { juan } from '../kit/index.js';

const toast = (text) => bus.emit('kernel:toast', { text });
const SLOTS = [['zhuangyuan', '状元'], ['bangyan', '榜眼'], ['tanhua', '探花']];

export function createKeju({ root, game, profile, onPerson }) {
  const K = game.keju;
  let data = null;
  let mode = 'exam';       // exam 本科 · hist 历届某科 · eco 特科与学派
  let hist = 0;
  let busy = '';
  let progress = null;
  let opened = false;

  const title = h('h2');
  const sub = h('small');
  const left = h('section.ce-leaf.left.kj-left');
  const right = h('section.ce-leaf.right.kj-right');
  const busyEl = h('div.kj-busy', h('i.au-brush'), h('b'), h('div.track', h('i')));
  const shut = h('button.ce-close.q-yapai', { type: 'button', onclick: () => hide() }, '合册');
  const book = h('div.ce-book', h('div.ce-ling'), left, h('div.ce-gutter'), right, busyEl, shut);
  const ov = h('div.ce-ov.kj-ov', { role: 'dialog' }, book);
  ov.addEventListener('pointerdown', (e) => { if (e.target === ov && !busy) hide(); });
  root.append(ov);

  const T = () => profile().keju || {};
  const pct = (a, b) => (b > 0 ? Math.min(100, Math.round((a * 100) / b)) : 0);
  const money = (v) => (v >= 10000 ? `${num(Math.round(v / 10000))}万` : num(Math.round(v)));
  const ratios = (label, list) => (list && list.length ? h('div.kj-ratio', h('span', label), h('div.bar', list.map(([k, v], i) => h('i', { style: { flexGrow: v, '--hue': i } }, `${k}${num(v)}%`)))) : null);

  // ---------- 左叶 ----------
  function renderLeft() {
    const t = T(), d = data;
    title.textContent = t.title || '科举';
    sub.textContent = t.sub || '';
    const parts = [h('header.ce-head', title, sub)];
    if (!d.enabled) {
      parts.push(h('section.kj-off', h('b', '科举制度未行'), h('p', d.preKeju ? '本朝尚未以科举取士，可议选官制度改革以启之。' : '今以特殊之故停罢科举。'),
        d.cooldown ? h('p.dim', `前议缓行，${num(d.cooldown)}年后可再议`) : null,
        h('button.q-yapai', { type: 'button', onclick: () => run(() => K.enable(d.preKeju ? 'reform' : 'enable'), d.preKeju ? '廷臣评议改制' : '廷臣评议开科') }, d.preKeju ? (t.reform || '发起科举改革') : (t.enable || '请求启用科举'))));
    } else {
      parts.push(h('dl.kj-sys', [['间隔', d.interval], ['科目', d.subjects], ['取士', d.quota ? `每科${num(Number(d.quota) || 0) || d.quota}人入殿试` : ''], ['规则', d.rules], ['上科', d.last || '从未举办']]
        .filter(([, v]) => v).map(([k, v]) => [h('dt', k), h('dd', { title: '点开看全', onclick: (e) => e.currentTarget.classList.toggle('open') }, v)])));
      if (d.restrictions) parts.push(h('p.kj-note', `试点：${d.restrictions.provinces.join('、')} · ${num(d.restrictions.yearsBeforeFull || 3)}年后议全国`));
    }
    // 本科进程
    const ex = d.exam;
    if (ex) {
      const at = ex.plan.findIndex((s) => s.key === ex.stage);
      parts.push(h('section.kj-plan', h('h5', h('span', ex.type === 'enke' ? '恩科' : '本科'), h('small', ex.start ? `${ex.start}开办` : '')),
        h('ol', ex.plan.map((s, i) => h('li' + (i < at ? '.done' : i === at ? '.now' : ''), { onclick: i === at ? () => { mode = 'exam'; renderRight(); } : null },
          h('i'), h('b', s.name), s.key === 'finished' ? null : h('small', i === at && s.days ? `${num(ex.elapsed)}／${num(s.days)}日` : s.days ? `${num(s.days)}日` : ''),
          i === at && s.days && s.key !== 'finished' ? h('div.track', h('i', { style: { width: `${pct(ex.elapsed, s.days)}%` } })) : null)))));
      const spent = ex.costs.local + ex.costs.provincial + ex.costs.central;
      parts.push(h('div.kj-cost', h('span', '经费'), h('b', `累扣${money(spent)}两`), h('small', `国库余${money(ex.treasury)} · 内帑余${money(ex.privy)}`),
        ex.costs.shortfall ? h('em', '经费断粮·本科流产') : ex.treasury + ex.privy < 4000 ? h('em', '两库合计不足四千两，殿试或将流产') : null));
    } else if (d.enabled) {
      parts.push(h('section.kj-plan.idle', h('h5', h('span', '本科'), h('small', d.preparing ? '筹办中' : '')), h('p', d.preparing ? '正在筹办，进展见于推演。' : '今无开科。')));
    }
    if (d.enke) parts.push(h('p.kj-note', `恩科进行中 · ${d.enke.stage}`));
    // 历届
    if (d.history.length) {
      parts.push(h('section.kj-hist', h('h5', h('span', '历届'), h('small', `${num(d.history.length)}科`)),
        d.history.slice(0, 8).map((x, i) => h('button' + (mode === 'hist' && hist === i ? '.on' : ''), { type: 'button', onclick: () => { mode = 'hist'; hist = i; renderLeft(); renderRight(); } },
          h('b', x.date), h('span', x.top3[0] ? `状元${x.top3[0]}` : x.national ? '主考取士' : ''), h('small', x.passed != null ? `取${num(Number(x.passed) || 0)}人` : '')))));
    }
    const e = d.ecology;
    parts.push(h('section.kj-eco', h('h5', h('span', '特科与学派')),
      h('button' + (mode === 'eco' ? '.on' : ''), { type: 'button', onclick: () => { mode = 'eco'; renderLeft(); renderRight(); } },
        [['恩科', e.enke.length, '次'], ['武举', e.wuju.length, '次'], ['童子科', e.tongzi.length, '童'], ['书院', e.academies, '处'], ['学派', e.lineages, '家']]
          .map(([k, n, u]) => h('span', h('small', k), h('b', num(n)), h('small', u))))));
    if (d.canPropose) parts.push(h('div.kj-left-acts', h('button.q-yapai', { type: 'button', onclick: propose }, t.propose || '提议筹办科举')));
    replaceChildren(left, parts);
  }

  // ---------- 右叶 ----------
  function head(name, note) { return h('header.kj-head', h('h3', name), note ? h('p', note) : null); }
  function examinerBar(e) {
    if (!e) return null;
    const v = e.view;
    return h('div.kj-examiner', h('span', '主考'), h('div', h('b', e.name, onPerson ? h('button.link', { type: 'button', onclick: () => person(e.name) }, '列传') : null),
      h('p', [e.party, v && v.summary].filter(Boolean).join(' · ')),
      v ? h('p.dim', `偏好${v.prefer} · 籍贯${v.region || '无'} · 严格${num(v.strict)}（${v.strictLabel}）· 派系偏向${v.biasLabel}`) : null));
  }
  function topicBox(value, ph, onsave) {
    const ta = h('textarea.kj-ta', { rows: 5, spellcheck: false, placeholder: ph });
    ta.value = value || '';
    const al = h('p.kj-align');
    const sync = () => { const a = K.alignment(ta.value); al.className = 'kj-align ' + (a ? a.tone : ''); al.textContent = a && ta.value.trim() ? `契合${num(a.score)} · ${a.text}` : ''; };
    ta.addEventListener('input', sync);
    ta.addEventListener('change', () => { try { onsave(ta.value); } catch (er) { toast(er.message); } });
    sync();
    return { el: h('div.kj-topic', ta, al), get value() { return ta.value; }, save() { onsave(ta.value); } };
  }
  function acts(list) { return h('div.kj-acts', list.filter(Boolean).map(([label, f, cls]) => h('button.q-yapai' + (cls ? '.' + cls : ''), { type: 'button', disabled: !!busy, onclick: f }, label))); }
  function progressStage(ex, note) {
    const s = ex.plan.find((x) => x.key === ex.stage) || {};
    return [head(ex.stageName, note || ex.tierNote || '按日推进，阶段满日自然入下一步'),
      h('div.kj-days', h('div.track', h('i', { style: { width: `${pct(ex.elapsed, s.days)}%` } })), h('small', `已过${num(ex.elapsed)}日 · 共${num(s.days || 0)}日`))];
  }
  function prelimBlock(p) {
    if (!p) return null;
    return h('section.kj-block', h('h5', '地方选拔'), h('p', `报名${num(p.total)}人，通过${num(p.passed)}人入会试`), p.narrative ? h('p.dim', p.narrative) : null,
      ratios('阶层', p.classes), ratios('党派', p.parties));
  }
  function statsBlock(s) {
    if (!s) return null;
    return h('section.kj-block', h('h5', '会试统计'), h('p', `录取${num(s.passed)}人 · 质量「${s.quality}」`), s.note ? h('p.dim', `考官评语：${s.note}`) : null,
      s.local ? h('p.dim', `地方吏治：${s.local}`) : null, ratios('民族', s.ethnic), ratios('阶层', s.classes), ratios('党派', s.parties));
  }

  function renderExam(ex) {
    const t = T();
    const out = [];
    switch (ex.stage) {
      case 'preliminary_local': case 'preliminary_provincial':
        out.push(...progressStage(ex));
        break;
      case 'examiner_select': {
        out.push(head('选任主考官', '主考之位各党必争——其党派立场影响出题与评判，取中之士结为门生；然忠正之士未必因座师而易其守。'), prelimBlock(ex.prelim));
        if (ex.examiner) out.push(examinerBar(ex.examiner));
        out.push(h('div.kj-cands', ex.candidates.length ? ex.candidates.map((c) => h('button' + (ex.examiner && ex.examiner.name === c.name ? '.on' : ''), { type: 'button', disabled: !!busy,
          onclick: () => act(() => K.selectExaminer(c.name)) },
          h('b', c.name), c.rec ? h('em', `${c.rec}荐`) : null, h('small', c.title), h('span', `智${num(c.int)} 治${num(c.adm)}${c.party ? ' · ' + c.party : ''}`))) : [h('p.ce-unk', '无合格主考人选')]));
        out.push(acts([ex.examiner ? ['进入会试出题', () => act(() => K.toHuishi())] : null]));
        break;
      }
      case 'huishi_draft': case 'huishi': {
        const draft = ex.stage === 'huishi_draft';
        out.push(head(ex.stageName, draft ? '主考拟题呈览，可亲改或另拟；逾期采主考首选。' : '贡院锁院，四方举子云集京师；题目留空则考官自行出题。'), examinerBar(ex.examiner));
        if (ex.memorial && ex.memorial.text) out.push(h('section.kj-block', h('h5', '主考题本'), h('p', ex.memorial.text), ex.memorial.hint ? h('p.dim', ex.memorial.hint) : null));
        if (ex.topicCands.length) out.push(h('div.kj-slips', ex.topicCands.map((c) => h('button' + (c.topic === ex.topic ? '.on' : ''), { type: 'button', title: c.rationale || '', onclick: () => { box.el.querySelector('textarea').value = c.topic; box.save(); renderRight(); } },
          c.style ? h('em', c.style) : null, c.topic))));
        const box = topicBox(ex.topic, '待考官拟题，或径自写下……', (v) => K.setTopic(v));
        out.push(h('section.kj-block', h('h5', `${ex.stageName.replace(/拟题$/, '')}试题`), box.el));
        out.push(h('p.kj-meta', [ex.subjects && `科目 ${ex.subjects}`, ex.rules && `规则 ${ex.rules}`, ex.prelim && `地方通过${num(ex.prelim.passed)}人`].filter(Boolean).join(' · ')));
        out.push(acts([
          draft && !ex.memorial ? ['令主考呈题本', () => run(() => K.genMemorial(), '主考拟题本')] : null,
          ['考官拟题呈报', () => run(async () => { box.save(); await K.proposeTopic(); }, '考官拟题')],
          [t.libu || '召礼部商议', () => { try { box.save(); K.libuReview(); } catch (er) { toast(er.message); } }],
          draft ? ['定此题', () => act(() => { box.save(); if (!box.value.trim()) throw new Error('题目尚空'); toast('会试题已定'); })] : null,
          !draft ? ['开榜·批卷', () => run(async () => { box.save(); await K.openHuishi(); }, '会试批卷'), 'main'] : null
        ]));
        if (draft) out.push(...progressStage(ex, '').slice(1));
        break;
      }
      case 'dianshi_draft': case 'dianshi': {
        out.push(head(ex.stageName, `会试取中，${num(ex.dianshiCount)}名佳士入大殿，待亲发策问，试其治国经世之才。`), statsBlock(ex.stats));
        const box = topicBox(ex.question, '例：朝廷积弊日深，外患未已。昔管仲相齐……何以教之？', (v) => K.setQuestion(v));
        out.push(h('section.kj-block', h('h5', t.question || '策问'), box.el));
        out.push(acts([
          ['代拟策问', () => run(() => K.genQuestion(), '代拟策问')],
          [t.libu || '召礼部商议', () => { try { box.save(); K.libuReview(); } catch (er) { toast(er.message); } }],
          ['开殿试', () => run(async () => { box.save(); await K.startDianshi(); }, '殿试'), 'main']
        ]));
        if (ex.stage === 'dianshi_draft') out.push(...progressStage(ex, '').slice(1));
        break;
      }
      case 'finished':
        if (!ex.palace) out.push(...rosterNational(ex));
        else if (!ex.ranking && ex.results.length >= 3) out.push(...rankStage(ex));
        else if (ex.results.length) out.push(...goldList(ex));
        else out.push(head('放榜', '本科未有答卷，静候推演收科。'));
        break;
      default:
        out.push(head(ex.stageName));
    }
    return out;
  }
  // 读卷钦定三甲
  function rankStage(ex) {
    const t = T();
    const pend = ex.pending;
    const ready = pend.zhuangyuan && pend.bangyan && pend.tanhua;
    return [
      head(t.rank || '钦定三甲', `殿试题：${ex.question.slice(0, 60)}${ex.question.length > 60 ? '…' : ''}`),
      ex.suggestions.length ? h('section.kj-block', h('h5', '考官建议'), ex.suggestions.map((s) => h('p.kj-sug', h('b', s.who), s.names.map((n, i) => h('span', `${num(i + 1)}.${n}`))))) : null,
      h('div.kj-slots', SLOTS.map(([k, label]) => h('div' + (pend[k] ? '.on' : ''), h('small', label), h('b', pend[k] || '　')))),
      h('div.kj-roll', ex.results.map((c) => h('div.kj-cand' + (c.slot ? '.' + c.slot : ''),
        h('i', num(c.rank)), h('div', h('b', c.name, c.historical ? h('em', '史') : null), h('small', [c.age ? `${num(Number(c.age) || 0)}岁` : '', c.origin, c.klass, `分${num(c.score)}`].filter(Boolean).join(' · ')),
          c.evaluation ? h('p', c.evaluation) : null),
        h('div.kj-cand-acts', h('button', { type: 'button', onclick: () => readAnswer(c.i) }, '阅卷'),
          SLOTS.map(([k, label]) => h('button' + (c.slot === k ? '.on' : ''), { type: 'button', onclick: () => act(() => K.pick(c.name, k)) }, label)))))),
      acts([[t.publish || '钦定·张榜', () => act(() => K.confirmRanking()), ready ? 'main' : 'off']])
    ];
  }
  // 金榜
  function goldList(ex) {
    const t = T();
    const top = ex.results.slice(0, 3), rest = ex.results.slice(3);
    return [
      h('div.kj-bang', h('h3', '金榜题名'), h('div.cols',
        h('section.jia', h('h6', '第一甲'), top.map((c, i) => h('p', h('small', SLOTS[i][1]), h('b', c.name)))),
        rest.length ? h('section', h('h6', '第二甲'), rest.slice(0, Math.ceil(rest.length / 2)).map((c) => h('p', h('b', c.name)))) : null,
        rest.length > 1 ? h('section', h('h6', '第三甲'), rest.slice(Math.ceil(rest.length / 2)).map((c) => h('p', h('b', c.name)))) : null),
        ex.ranking && ex.ranking.auto ? h('small.auto', '未亲钦三甲，按综合分定') : null),
      h('div.kj-roll.gold', ex.results.map((c, i) => h('div.kj-cand' + (i < 3 ? '.' + SLOTS[i][0] : ''),
        h('i', i < 3 ? SLOTS[i][1].charAt(0) : num(c.rank)), h('div', h('b', c.name, c.inChars && onPerson ? h('button.link', { type: 'button', onclick: () => person(c.name) }, '列传') : null),
          h('small', [c.age ? `${num(Number(c.age) || 0)}岁` : '', c.origin, c.klass, `分${num(c.score)}`, c.office].filter(Boolean).join(' · '))),
        h('div.kj-cand-acts', h('button', { type: 'button', onclick: () => readAnswer(c.i) }, '阅卷'),
          c.inChars ? h('span.done', '已入人物志') : h('button', { type: 'button', onclick: () => act(() => { if (K.recruit(c.i)) toast(`${c.name}已入人物志`); }) }, '纳入人物志'),
          i < 3 && c.inChars && !c.office ? h('button', { type: 'button', onclick: () => assign(c) }, '授官') : null)))),
      acts([[t.finish || '完成科举', () => act(() => K.finish()), 'main']])
    ];
  }
  function rosterNational(ex) {
    return [head(`${ex.stageName}放榜`, `本场取士${num(ex.results.length)}人，取得${ex.graduateTitle}，候铨叙用。`),
      ex.topic ? h('p.kj-quote', ex.topic) : null,
      h('div.kj-roll', ex.results.map((c) => h('div.kj-cand', h('i', num(c.rank)), h('div', h('b', c.name), h('small', [c.origin, c.klass].filter(Boolean).join(' · ')), c.evaluation ? h('p', c.evaluation) : null),
        h('div.kj-cand-acts', h('button', { type: 'button', onclick: () => readAnswer(c.i) }, '阅卷'), c.inChars ? h('span.done', '已入人物志') : h('button', { type: 'button', onclick: () => act(() => K.recruit(c.i)) }, '阅人'))))),
      acts([['收榜·候铨', () => act(() => K.finish()), 'main']])];
  }
  function renderHist(x) {
    if (!x) return [h('p.ce-unk', '无此科')];
    return [head(`${x.date}${x.enke ? '·恩科' : ''}`, [x.examiner && `主考${x.examiner}${x.party ? `（${x.party}）` : ''}`, x.passed != null && `取${num(Number(x.passed) || 0)}人`, x.quality && `质量「${x.quality}」`].filter(Boolean).join(' · ')),
      x.top3.length ? h('div.kj-bang', h('h3', '金榜'), h('div.cols', h('section.jia', h('h6', '第一甲'), x.top3.map((n, i) => h('p', h('small', SLOTS[i] ? SLOTS[i][1] : ''), h('b', n)))))) : null,
      x.question ? h('section.kj-block', h('h5', '策题'), h('p.kj-quote', x.question)) : null];
  }
  function renderEco() {
    const e = data.ecology;
    const rows = (list, unit) => (list.length ? list.map((r) => h('p.kj-eco-row', h('b', r.year || '—'), r.reason ? h('em', r.reason) : null, r.examiner ? h('span', `主考${r.examiner}`) : null,
      h('span', `${unit}${r.count != null ? num(Number(r.count) || 0) : '?'}${unit === '选童' ? '名' : '人'}`), r.names.length ? h('small', r.names.slice(0, 8).join('、') + (r.names.length > 8 ? '等' : '')) : null)) : [h('p.dim', '暂无开科记录')]);
    return [head('特科与学派', '特科随朝廷事故而开（寿诞、乱后、祥瑞、战功……），学派由山长自驱讲会。'),
      h('section.kj-block', h('h5', '恩科'), rows(e.enke, '中式')), h('section.kj-block', h('h5', '武举'), rows(e.wuju, '中式')), h('section.kj-block', h('h5', '童子科'), rows(e.tongzi, '选童')),
      h('section.kj-block', h('h5', '书院与学派'), h('p', `私学书院${num(e.academies)}处 · 学派${num(e.lineages)}家`))];
  }
  function renderRight() {
    let out;
    if (mode === 'hist') out = renderHist(data.history[hist]);
    else if (mode === 'eco') out = renderEco();
    else if (data.exam) out = renderExam(data.exam);
    else if (data.history.length) { out = renderHist(data.history[0]); out.unshift(h('p.kj-tag', '今无开科 · 上一科')); }
    else out = [h('p.ce-unk', data.enabled ? '今无开科，亦无前科可稽' : '科举未行')];
    replaceChildren(right, out.filter(Boolean));
  }

  // ---------- 阅卷 ----------
  async function readAnswer(i) {
    let a;
    if (!data.exam.results[i].hasAnswer) {
      try { setBusy('考生作答'); a = await K.answer(i); } catch (e) { toast(e.message); return; } finally { setBusy(''); }
    } else {
      try { a = await K.answer(i); } catch (e) { toast(e.message); return; }
    }
    const paper = h('div.kj-paper', a.comment ? h('p.pi', h('small', '主考批'), a.comment, h('small.sig', `—— ${a.examiner || '主考'}`)) : null,
      ...String(a.text || '（无文）').split(/\n+/).filter((s) => s.trim()).map((s) => h('p', s.trim())));
    paper.addEventListener('wheel', (e) => { if (paper.scrollWidth <= paper.clientWidth) return; e.preventDefault(); paper.scrollLeft -= e.deltaY || e.deltaX; }, { passive: false });
    juan({
      title: `${a.name}　答卷`, note: [`第${num(a.rank)}名`, a.age ? `${num(Number(a.age) || 0)}岁` : '', a.origin, a.style, a.hint, `${num(a.score)}分`].filter(Boolean).join(' · '),
      width: 'min(68rem, 92vw)', height: 'min(40rem, 82vh)',
      content: h('div.kj-answer', paper,
        a.evaluation ? h('p.kj-eval', h('span', '考官综评'), a.evaluation) : null,
        a.estimate ? h('p.kj-eval', h('span', '主考估分'), `${a.examiner}（${a.estimate.summary}）· ${a.estimate.fit ? '籍贯契合' : '籍贯非其所偏'}`) : null,
        a.historical && a.shiliao ? h('details.kj-shiliao', h('summary', '史料原文'), h('p', a.shiliao)) : null)
    });
    requestAnimationFrame(() => { paper.scrollLeft = paper.scrollWidth; });
    reload();
  }
  // 授官：空缺之职
  function assign(c) {
    const posts = K.vacancies();
    if (!posts.length) { toast('当前无空缺官职'); return; }
    let q = '';
    const list = h('div.kj-posts');
    const draw = () => replaceChildren(list, posts.filter((p) => !q || p.label.includes(q)).slice(0, 80).map((p) => h('button', { type: 'button', onclick: () => {
      j.close('ok');
      act(() => { K.assign(c.i, p); toast(`${c.name}已授${p.label}`); });
    } }, h('b', p.label), p.rank ? h('small', p.rank) : null)));
    const search = h('input.ce-search', { type: 'search', placeholder: '检衙署、官名', oninput: (e) => { q = e.target.value.trim(); draw(); } });
    draw();
    const j = juan({ title: `授${c.name}官职`, note: `第${num(c.rank)}名 · ${c.origin}`, width: '30rem', height: 'min(34rem, 80vh)', content: h('div.kj-assign', search, list) });
  }
  function person(name) { hide(); onPerson(name); }

  // ---------- 动作 ----------
  function setBusy(label) {
    busy = label;
    busyEl.classList.toggle('on', !!label);
    busyEl.querySelector('b').textContent = label ? `${label}中……` : '';
    if (!label) { progress = null; busyEl.querySelector('.track i').style.width = '0'; }
  }
  game.on('kernel:loading', (p) => { if (busy && p.text) busyEl.querySelector('b').textContent = p.text; });
  bus.on('keju:progress', (p) => {
    progress = p.open ? p : null;
    if (busy && p.open) {
      busyEl.querySelector('b').textContent = p.status || p.sub || `${busy}中……`;
      busyEl.querySelector('.track i').style.width = `${p.pct || 0}%`;
    }
  });
  function act(f) {
    try { f(); } catch (e) { toast(e.message); }
    reload();
  }
  async function run(f, label) {
    if (busy) return;
    setBusy(label);
    try { await f(); } catch (e) { toast(e.message); } finally { setBusy(''); reload(); }
  }
  function propose() {
    try { K.propose(); } catch (e) { toast(e.message); }
  }
  bus.on('keju:outcome', (o) => {
    juan({ title: o.title || '科举之议', width: '34rem', content: h('div.kj-outcome', o.lines.map((l) => h('p', l))), actions: [{ label: '知道了', onclick: ({ close }) => close('ok') }] });
    if (opened) reload();
  });

  function reload() {
    try { data = K.overview(); } catch (e) { toast(e.message); return; }
    if (mode === 'hist' && !data.history[hist]) mode = 'exam';
    renderLeft();
    renderRight();
  }
  function show(what) {
    if (what === 'eco') mode = 'eco';
    else mode = 'exam';
    reload();
    ov.setAttribute('aria-label', T().title || '科举');
    ov.classList.add('on');
    opened = true;
  }
  function hide() {
    if (busy) return;
    ov.classList.remove('on');
    opened = false;
  }
  window.addEventListener('keydown', (e) => {
    if (!opened || document.querySelector('.q-juan-veil')) return;
    if (e.key === 'Escape') { e.stopPropagation(); hide(); }
  }, true);
  game.on('game:changed', () => { if (opened && !busy) reload(); });
  return { show, hide, get opened() { return opened; } };
}

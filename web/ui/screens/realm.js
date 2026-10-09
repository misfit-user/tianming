// 朝野：朝野册，三页。
//   势力：左叶天下诸势力（本朝居首，敌对者标朱），右叶所选势力的谱牒——印、名、类、述、要数，六卷（君臣、版图、军略、财计、邦交、史略）；
//   党派：左叶诸党（秉政、在野、边缘，影响为条），右叶党籍——纲领、党人、党势、议程、事链五卷，卷底召党魁、付议、拟令；
//   阶层：左叶诸阶层（满意据奏），右叶阶层志——本末、诉求、民情、人物、事链五卷，卷底召代表、付议、拟令（叫法随身份）；
//   家族：左叶天下门第（按声望），右叶一族之谱——门第、族人、姻仇、家史四卷，族人在册者可翻图志。
// 卷首一排小签可跳卷。人名可翻人物图志，党名阶层名互相跳。经 game.realm（势力）与 game.social（党派、阶层）。
import { h, replaceChildren } from '../core/dom.js';
import { bus } from '../core/bus.js';
import { num, roundSig } from '../core/numerals.js';
import { qianzi } from '../kit/index.js';

const toast = (text) => bus.emit('kernel:toast', { text });
const amt = (v) => num(roundSig(Math.abs(v || 0), 3));
// 内核写好的说明文字里夹着阿拉伯数字（「民心 49 忧」），按记数设置改写；小数照旧
const digits = (t) => String(t).replace(/(?<![\d.])\d+(?![\d.])/g, (m) => num(Number(m)));
const signed = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${num(Math.abs(Math.round(v * 10) / 10))}`;
const TABS = [['factions', '势力'], ['parties', '党派'], ['classes', '阶层'], ['families', '家族'], ['dongtai', '动态'], ['nian', '逆案']];
const DT_WINS = [[3, '三回合'], [6, '六回合'], [12, '十二回合'], [0, '全部']];
const JUAN_MARK = { 门第: '门', 族人: '族', 姻仇: '姻', 家史: '史', 君臣: '君', 版图: '图', 军略: '军', 财计: '财', 邦交: '交', 史略: '史', 纲领: '纲', 党人: '人', 党势: '势', 议程: '议', 事链: '链', 本末: '本', 诉求: '诉', 民情: '情', 人物: '人' };
const NUM_WORD = ['一', '二', '三', '四', '五', '六', '七'];
const REL = { meng: '盟好', di: '敌对', zhong: '中立' };

// profile().social：卷底三样动作的叫法（召人、付议、拟令）；不设则此身份不列动作
export function createRealm({ root, game, profile, onPerson, onAudience, onCourt, onRegion, onCircuit }) {
  const R = game.realm;
  const S = game.social;
  let tab = 'factions';
  const sel = { factions: '', parties: '', classes: '', families: '', dongtai: '', nian: '' };
  let dtWin = 6;
  let opened = false;
  let rows = [];

  const tabs = qianzi(TABS.map(([value, label]) => ({ value, label })), { value: tab, onchange: (v) => { tab = v; render(); } });
  const leftNote = h('p.rm-lnote');
  const leftBody = h('div.rm-lbody');
  const left = h('section.ce-leaf.left.rm-left', h('header.ce-head', h('h2', '朝野'), h('small', '天下之势')), h('div.fi-tabs', tabs), leftNote, leftBody);
  const right = h('section.ce-leaf.right.rm-right');
  const shut = h('button.ce-close.q-yapai', { type: 'button', onclick: () => hide() }, '合册');
  const book = h('div.ce-book', h('div.ce-ling'), left, h('div.ce-gutter'), right, shut);
  const ov = h('div.ce-ov.rm-ov', { role: 'dialog', 'aria-label': '朝野册' }, book);
  ov.addEventListener('pointerdown', (e) => { if (e.target === ov) hide(); });
  root.append(ov);

  // ---------- 左叶 ----------
  function render() {
    if (tab === 'dongtai' || tab === 'nian') return renderIntrigue();
    try { rows = tab === 'factions' ? R.factions() : tab === 'parties' ? S.parties() : tab === 'families' ? R.families() : S.classes(); } catch (e) { rows = []; toast(e.message); }
    if (!rows.some((r) => r.key === sel[tab])) sel[tab] = (rows[0] || {}).key || '';
    replaceChildren(leftNote, ...noteOf());
    leftNote.hidden = !leftNote.childNodes.length;
    const max = Math.max(1, ...rows.map((f) => f.strength || 0));
    replaceChildren(leftBody, rows.length ? rows.map((r) => h('button.rm-fac' + (r.key === sel[tab] ? '.on' : '') + (r.hostile ? '.hostile' : '') + (r.mine ? '.mine' : ''),
      { type: 'button', dataset: { key: r.key }, onclick: () => { sel[tab] = r.key; renderRight(); markSel(); } }, ...rowOf(r, max)))
      : [h('p.ce-unk', tab === 'factions' ? '天下无势力在册' : tab === 'parties' ? '朝中无党派在册' : tab === 'families' ? '天下无家族在册' : '此世无阶层在册')]);
    if (sel[tab]) renderRight(); else replaceChildren(right);
  }
  // ---------- 动态、逆案 ----------
  // 动态：群臣在诏令之外的举动（招募、构陷、结纳……），按回合分；逆案：已露形之谋在前，已发之案在后
  const who = (name, isChar = true) => (name && isChar && onPerson ? h('a.rm-who', { onclick: () => onPerson(name) }, name) : h('span', name || ''));
  function renderIntrigue() {
    let groups = [];
    try {
      if (tab === 'dongtai') {
        rows = S.dongtai(dtWin);
        const byWhen = new Map();
        for (const r of rows) { if (!byWhen.has(r.when)) byWhen.set(r.when, []); byWhen.get(r.when).push(r); }
        groups = [...byWhen.entries()];
      } else {
        const d = S.nian();
        rows = [...d.brewing, ...d.past];
        groups = [['暗流酝酿', d.brewing], ['逆案录', d.past]].filter(([, list]) => list.length);
      }
    } catch (e) { rows = []; toast(e.message); }
    if (!rows.some((r) => r.key === sel[tab])) sel[tab] = (rows[0] || {}).key || '';
    replaceChildren(leftNote, ...(tab === 'dongtai'
      ? [h('span', '近'), ...DT_WINS.map(([n, label]) => h('button.rm-win' + (dtWin === n ? '.on' : ''), { type: 'button', onclick: () => { dtWin = n; render(); } }, label))]
      : [h('span', '只列已发之案与已露形之谋；隐秘未露者不在此列')]));
    leftNote.hidden = false;
    replaceChildren(leftBody, rows.length
      ? groups.map(([head, list]) => h('section.rm-grp', h('h5', head, h('small', `${num(list.length)}桩`)), list.map((r) =>
          h('button.rm-fac.rm-ev' + (r.key === sel[tab] ? '.on' : '') + (r.tone === 'bad' || r.ripe || r.success === true ? '.hostile' : ''),
            { type: 'button', dataset: { key: r.key }, onclick: () => { sel[tab] = r.key; renderRight(); markSel(); } },
            h('b', r.actor || r.who), h('em', r.verb || r.act), r.target ? h('small', `→ ${r.target}`) : null,
            h('small.rm-ev-meta', r.kind === 'plot' ? r.heat : r.kind === 'past' ? `${r.when} · ${r.outcome}` : r.say.slice(0, 18))))))
      : [h('p.ce-unk', tab === 'dongtai' ? '近来朝野无甚动静' : '本朝尚无逆案')]);
    renderRight();
  }
  function intrigueDoc() {
    const r = rows.find((x) => x.key === sel[tab]);
    if (tab === 'dongtai') {
      const byActor = new Map();
      for (const x of rows) byActor.set(x.actor, (byActor.get(x.actor) || 0) + 1);
      const busy = [...byActor.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
      const bad = rows.filter((x) => x.tone === 'bad').length, good = rows.filter((x) => x.tone === 'good').length;
      return h('div.rm-intr',
        h('header.rm-intr-head', h('h3', '朝野动态'), h('small', `${(profile() && profile().annals && profile().annals.orders) || '号令'}之外，众人各自在动`)),
        r ? h('section.rm-ev-doc',
          h('p.rm-ev-line', who(r.actor), h('em.' + r.tone, r.verb), r.target ? [h('span', ' → '), who(r.target, r.targetIsChar)] : null),
          r.say ? h('p', h('b', '称　'), r.say) : null, h('p.rm-ev-when', r.when)) : null,
        h('section.rm-ev-sum', h('h5', '提要'),
          h('p', `${dtWin ? `近${num(dtWin)}回合` : '历来'}朝野共${num(rows.length)}桩动静：交恶${num(bad)}、交好${num(good)}、其余${num(rows.length - bad - good)}。`),
          busy.length ? h('p', '最活跃：', busy.map(([n, c], i) => [i ? '、' : '', who(n), `（${num(c)}）`])) : null));
    }
    const d = { brewing: rows.filter((x) => x.kind === 'plot'), past: rows.filter((x) => x.kind === 'past') };
    const succ = d.past.filter((x) => x.success).length;
    return h('div.rm-intr',
      h('header.rm-intr-head', h('h3', '逆案录'), h('small', '谋逆、政变、弑君诸案')),
      r ? h('section.rm-ev-doc',
        h('p.rm-ev-line', who(r.who), h('em.bad', r.act), r.target ? [h('span', ' → '), who(r.target)] : null),
        r.kind === 'plot' ? h('p', h('b', '热度　'), r.heat, r.ripe ? '（将发）' : '') : h('p', h('b', '结局　'), r.outcome, h('small', `　${r.when}`)),
        r.allies.length ? h('p', h('b', '从党　'), r.allies.map((n, i) => [i ? '、' : '', who(n)])) : h('p', h('b', '从党　'), '尚无'),
        r.reason ? h('p', h('b', '缘由　'), r.reason) : null) : null,
      h('section.rm-ev-sum', h('h5', '提要'),
        h('p', `已发${num(d.past.length)}案：得逞${num(succ)}、败露${num(d.past.length - succ)}。已露形之谋${num(d.brewing.length)}桩${d.brewing.some((x) => x.ripe) ? '，其中有将发者' : ''}。`)));
  }
  function noteOf() {
    if (tab === 'families') return [h('span', `天下门第${num(rows.length)}家，按声望`)];
    if (tab !== 'classes') return [];
    const o = S.classOverview();
    return [h('span', '平均满意', h('b', num(o.avg)), o.sealedAny ? h('i', '据奏') : null),
      o.legitimacy ? (o.legitimacy.sealed ? h('span', '天命权重', h('b', '封存')) : h('span', '天命权重', h('b', o.legitimacy.flag), h('small', `权贵${num(o.legitimacy.clout)}／民心${num(o.legitimacy.pop)}`))) : null];
  }
  function rowOf(r, max) {
    if (tab === 'factions') return [h('b', r.name), r.mine ? h('em.mine', '本朝') : r.attitude ? h('em', r.attitude.slice(0, 6)) : null,
      h('span.meta', [r.type, r.leader].filter(Boolean).join(' · ')), h('i.bar', h('b', { style: { width: `${(r.strength / max) * 100}%` } })), h('small', r.soldiers ? `兵${amt(r.soldiers)}` : '')];
    if (tab === 'parties') return [h('b', r.name), r.standing ? h('em' + (r.standing === '秉政' ? '.mine' : ''), r.standing) : null,
      h('span.meta', [r.status, r.leader && `魁${r.leader}`, r.allies || r.foes ? `盟${num(r.allies)}／敌${num(r.foes)}` : ''].filter(Boolean).join(' · ')),
      h('i.bar', h('b', { style: { width: `${r.influence}%` } })), h('small', `影响${num(r.influence)}`)];
    if (tab === 'families') return [h('b', r.name), r.tier ? h('em' + (r.declining ? '.low' : ''), r.tier) : null,
      h('span.meta', [r.head && `宗主${r.head}`, r.members ? `族人${num(r.members)}` : '', r.prominence].filter(Boolean).join(' · ')),
      h('i.bar', h('b', { style: { width: `${Math.max(0, Math.min(100, r.renown))}%` } })), h('small', `望${num(r.renown)}`)];
    const tone = r.sat < 45 ? '.low' : r.sat > 62 ? '.high' : '';
    return [h('b', r.name), h('em' + tone, `满意${num(r.sat)}`, r.sealed ? h('i', '奏') : null),
      h('span.meta', [r.trend ? `${r.trend > 0 ? '▲' : '▼'}${num(Math.abs(r.trend))}` : '', r.pressure, r.radical, r.brief].filter(Boolean).join(' · ')),
      h('i.bar.sat' + tone, h('b', { style: { width: `${r.sat}%` } })), h('small', `影响${num(r.influence)}`)];
  }
  function markSel() { leftBody.querySelectorAll('.rm-fac').forEach((b) => b.classList.toggle('on', b.dataset.key === sel[tab])); }
  function jump(t, key) {
    tab = t;
    sel[t] = key;
    tabs.setValue(t);
    render();
    const b = leftBody.querySelector(`[data-key="${CSS.escape(key)}"]`);
    if (b) b.scrollIntoView({ block: 'nearest' });
  }

  // ---------- 右叶 ----------
  function renderRight() {
    if (tab === 'dongtai' || tab === 'nian') { replaceChildren(right, intrigueDoc()); return; }
    let d;
    try { d = tab === 'factions' ? R.faction(sel[tab]) : tab === 'parties' ? partyDoc(S.party(sel[tab])) : tab === 'families' ? familyDoc(R.family(sel[tab])) : classDoc(S.klass(sel[tab])); } catch (e) { toast(e.message); replaceChildren(right); return; }
    const juans = d.juan.filter(([, , body]) => hasBody(body));
    const nav = h('nav.rm-nav', juans.map(([title]) => h('button', { type: 'button', title, onclick: () => { const t = right.querySelector(`[data-juan="${title}"]`); if (t) right.scrollTo({ top: t.offsetTop - nav.offsetHeight - 8, behavior: 'smooth' }); } }, JUAN_MARK[title] || title.charAt(0))));
    replaceChildren(right,
      h('header.rm-head' + (d.hostile ? '.hostile' : ''),
        h('div.rm-seal', d.short),
        h('div.rm-id', h('h3', d.name, h('small', d.type)), d.pills.length ? h('div.rm-pills', d.pills.map((p) => h('span' + (/敌|承压|乱民/.test(p) ? '.hostile' : ''), p))) : null,
          d.note ? h('p.rm-seal-note', d.note) : null, d.desc ? h('p.rm-desc', d.desc) : null)),
      d.stats.length ? h('div.rm-stats', d.stats.map(([k, v]) => h('div', h('span', k), h('b', v)))) : null,
      nav,
      juans.map(([title, sub, body], i) => h('section.rm-juan', { dataset: { juan: title } },
        h('h4', h('span.no', `卷${NUM_WORD[i]}`), h('span', title), h('small', sub)), juanBody(body))),
      d.acts && d.acts.length ? h('div.rm-acts', d.acts.map((a) => h('button.q-yapai', { type: 'button', disabled: a.disabled, title: a.title || '', onclick: a.onclick }, a.label))) : null);
    right.scrollTop = 0;
  }
  // 版图：区划预警（本方），诸道一行一道（道名开通志，展开见所辖府州、点州开方志），未设省道者平铺
  const fmtN = (v) => (v == null ? '—' : Math.abs(v) >= 1e4 ? amt(v) : num(Math.round(v)));
  const regionBtn = (x) => (onRegion ? h('button', { type: 'button', title: '展其方志', onclick: () => { hide(); onRegion(x.id); } }, x.name) : h('em', x.name));
  function daoEl(d) {
    const al = d.alerts;
    return h('div.rm-dao',
      h('p.rm-dao-sum', `据有${num(d.count)}州，分隶${num(d.groups.length)}道`, d.none.length ? `，未设省道${num(d.none.length)}块` : '', '。'),
      al && (al.common.length || al.rows.length) ? h('section.rm-alerts', h('h5', '区划预警', h('small', '民心吏治据奏 · 按问题轻重')),
        al.common.length ? h('p.rm-common', '通国皆然：', h('b', digits(al.common.join(' · '))), '。下列只标各州独有之患。') : null,
        al.rows.map((x) => h('p', regionBtn(x), x.circuit ? h('small', x.circuit) : null, h('span', digits(x.reasons.join('；'))))),
        al.more ? h('small.rm-more', `另有${num(al.more)}州次之`) : null) : null,
      d.groups.length ? h('div.rm-daolist',
        h('p.rm-daohead', ['省道', '府州', '户口', '民心', '吏治'].map((t) => h('span', t))),
        d.groups.map((g) => h('details.rm-daorow',
          h('summary',
            onCircuit ? h('button.rm-daoname', { type: 'button', title: '展其通志', onclick: (e) => { e.preventDefault(); hide(); onCircuit(g.key); } }, g.label) : h('b.rm-daoname', g.label),
            h('span', g.held === g.of ? num(g.held) : `${num(g.held)}／${num(g.of)}`),
            h('span', fmtN(g.pop)),
            h('span' + (g.moodWarn ? '.warn' : ''), g.mood == null ? '—' : [num(Math.round(g.mood)), h('i', g.moodMark)]),
            h('span' + (g.officeWarn ? '.warn' : ''), g.office == null ? '—' : [num(Math.round(g.office)), h('i', g.officeMark)])),
          h('div.rm-daoregs', g.regions.map(regionBtn))))) : null,
      d.none.length ? h('div.rm-chips.links', h('span', '未设省道'), h('div', d.none.map(regionBtn))) : null);
  }
  const BODY_KEYS = ['dao', 'people', 'rows', 'chips', 'places', 'breakdown', 'relations', 'strengths', 'weaknesses', 'texts', 'links', 'lines', 'bars', 'chain', 'sealed'];
  function hasBody(b) { return BODY_KEYS.some((k) => Array.isArray(b[k]) ? b[k].length : !!b[k]); }
  const rowsEl = (list) => (list && list.length ? h('div.rm-rows', list.map((r) => h('p' + (r.tone === 'zhu' ? '.zhu' : ''), h('span', r.k), h('b', r.v)))) : null);
  const chipGroups = (groups) => (groups || []).map((g) => h('div.rm-chips', h('span', g.title), h('div', g.items.map((c) => h('em' + (c.warn ? '.warn' : ''), c.label, c.value != null && c.value !== '' ? h('b', c.value) : null)))));
  function juanBody(b) {
    const parts = [];
    if (b.sealed) parts.push(h('p.rm-sealed', b.sealed));
    if (b.people && b.people.length) parts.push(h('div.rm-people', b.people.map((p) => h('div' + (p.main ? '.main' : ''),
      h('i', String(p.name).replace(/[\s（）()]/g, '').charAt(0)), h('div', h('b', `${p.title} · ${p.name}`), p.meta ? h('span', p.meta) : null, p.bio ? h('p', p.bio) : null)))));
    if (b.breakdown && b.breakdown.length) {
      const total = b.breakdown.reduce((s, x) => s + x.value, 0) || 1;
      parts.push(h('div.rm-break', h('div.bar', b.breakdown.map((x, i) => h('i.c' + i, { style: { flexGrow: String(x.value) }, title: `${x.label} ${amt(x.value)}` }))),
        h('div.legend', b.breakdown.map((x, i) => h('span', h('i.c' + i), `${x.label} ${amt(x.value)}`)), h('small', `总 ${amt(total)}`))));
    }
    if (b.dao) parts.push(daoEl(b.dao));
    if (b.places && b.places.length) parts.push(h('div.rm-places', h('span', `所辖 ${num(b.places.length)} 块`), h('div', b.places.slice(0, 80).map((p) => h('em', p)), b.places.length > 80 ? h('small', `余${num(b.places.length - 80)}块`) : null)));
    if (b.relations && b.relations.length) parts.push(h('div.rm-rel', b.relations.map((r) => h('p.' + r.kind, h('i'), r.onclick ? h('button', { type: 'button', onclick: r.onclick }, r.name) : h('b', r.name), h('em', REL[r.kind]), r.note ? h('small', r.note) : null))));
    if (b.bars && b.bars.length) parts.push(h('div.rm-bars', b.bars.map((x) => h('p', h('span', x.label), h('i', h('b', { style: { width: `${Math.max(0, Math.min(100, x.value))}%` } })), h('small', num(x.value))))));
    parts.push(rowsEl(b.rows));
    for (const g of b.links || []) parts.push(h('div.rm-chips.links', h('span', g.title), h('div', g.items.map((c) => (c.onclick
      ? h('button' + (c.tone ? '.' + c.tone : ''), { type: 'button', title: c.title || '', onclick: c.onclick }, c.label, c.sub ? h('small', c.sub) : null)
      : h('em' + (c.tone ? '.' + c.tone : ''), { title: c.title || '' }, c.label, c.sub ? h('small', c.sub) : null))))));
    parts.push(...chipGroups(b.chips));
    if ((b.strengths && b.strengths.length) || (b.weaknesses && b.weaknesses.length)) parts.push(h('div.rm-youlie',
      b.strengths && b.strengths.length ? h('div.you', h('b', '所长'), b.strengths.map((s) => h('span', s))) : null,
      b.weaknesses && b.weaknesses.length ? h('div.lie', h('b', '所短'), b.weaknesses.map((s) => h('span', s))) : null));
    for (const g of b.lines || []) parts.push(h('div.rm-lines', h('h5', g.title, g.sub ? h('small', g.sub) : null),
      g.items.map((x) => h('p', x.head ? h('span' + (x.tone ? '.' + x.tone : ''), x.head) : null, h('b', x.body)))));
    if (b.chain && b.chain.length) parts.push(h('ol.rm-chain', b.chain.map((s) => h('li' + (s.empty ? '.empty' : ''), h('span', s.k),
      s.onclick ? h('button', { type: 'button', onclick: s.onclick }, s.v) : h('b', s.v)))));
    if (b.texts && b.texts.length) parts.push(h('div.rm-texts', b.texts.map(([k, t]) => h('p', h('b', `【${k}】`), t))));
    return parts.filter(Boolean);
  }

  // 人、党、阶层：点即跳
  // 人：{ name, note, known } 或名字；在人物册里的才可点
  const personLink = (x, sub) => { const p = typeof x === 'string' ? { name: x, known: true } : x; return { label: p.name || p.note, sub: sub || (p.name ? p.note : ''), onclick: p.known && onPerson ? () => onPerson(p.name) : null, title: p.known ? '翻人物图志' : '' }; };
  // 「阉党(附者)」「浙党(部分)」也认得是哪一党
  const partyLink = (n) => { const k = String(n).split(/[（(]/)[0].trim(); return { label: n, onclick: S.parties().some((p) => p.key === k) ? () => jump('parties', k) : null }; };
  const classLink = (n, sub) => ({ label: n, sub, onclick: S.classes().some((c) => c.key === n) ? () => jump('classes', n) : null });
  const causeLines = (list) => list.map((c) => ({ head: `T${c.turn ?? '?'}${c.source ? ' · ' + c.source : ''}`, body: c.text }));
  const ecoLines = (eco) => [
    eco.edges.length ? { title: '生态关系', sub: '动态亲和', items: eco.edges.map((e) => ({ head: e.peer, body: `${e.status} · 亲和${e.affinity} · 信${e.trust} · 怨${e.grievance}${e.note ? ' · ' + e.note : ''}` })) } : null,
    eco.signals.length ? { title: '生态信号', items: eco.signals.map((s) => ({ head: `T${s.turn ?? '?'} ${s.kind}`, body: s.note || '暂无细节' })) } : null
  ].filter(Boolean);
  // 卷底动作：叫法取 profile().social；某样不设即不列
  function actsOf(type, who) {
    const t = (profile && profile().social) || null;
    if (!t) return [];
    const party = type === 'party';
    const name = party ? t.summonParty : t.summonClass;
    const draft = party ? t.partyDraft : t.classDraft;
    return [
      name ? { label: name, disabled: !who.audience, title: who.audience ? `召${who.audience}` : party ? '党中无在世可召之人' : '此阶层未有在世可召的代表人物', onclick: () => audienceWith(who.audience) } : null,
      t.court ? { label: t.court, onclick: () => courtWith(type, who.name) } : null,
      draft ? { label: draft, onclick: () => edictWith(type, who.name) } : null
    ].filter(Boolean);
  }
  function courtWith(type, key) {
    try { const topic = S.courtTopic(type, key); toast(`已付廷议：${key}`); if (onCourt) { hide(); onCourt(topic); } } catch (e) { toast(e.message); }
  }
  function edictWith(type, key) {
    try { toast(S.edictDraft(type, key)); } catch (e) { toast(e.message); }
  }
  function audienceWith(name) { if (onAudience && name) { hide(); onAudience(name); } }

  // 一族之谱：族人带注（「侄·宁国公」），在人物册里的可点
  const kinLink = (x, role) => ({ label: x.name, sub: [role, x.note].filter(Boolean).join(' · '), onclick: x.known && onPerson ? () => onPerson(x.name) : null, title: x.known ? '翻人物图志' : '' });
  function familyDoc(f) {
    return {
      short: String(f.name).charAt(0), name: f.name, type: f.tier, desc: f.fortunes ? `近况：${f.fortunes}` : '',
      pills: [f.prominence, f.seat && `祖籍${f.seat}`].filter(Boolean),
      stats: [['声望', num(f.renown)], ['族人', num(f.members.length || f.branches.reduce((s, b) => s + b.members.length, 0))], f.branches.length ? ['支系', num(f.branches.length)] : null].filter(Boolean),
      juan: [
        ['门第', '祖籍·家业·家风', { rows: f.menDi }],
        ['族人', '宗主·嗣·支系', { links: [
          f.head ? { title: '宗主', items: [kinLink(f.head)] } : null,
          f.heir ? { title: '嗣', items: [kinLink(f.heir)] } : null,
          f.members.length ? { title: '族人', items: f.members.map((x) => kinLink(x)) } : null,
          ...f.branches.filter((b) => !(f.members.length && f.branches.length === 1)).map((b) => ({ title: b.name, items: [b.head ? kinLink(b.head, '房长') : null, ...b.members.filter((x) => !b.head || x.name !== b.head.name).map((x) => kinLink(x))].filter(Boolean) }))
        ].filter(Boolean) }],
        ['姻仇', '联姻·宿怨·往来', { rows: f.yinChou }],
        ['家史', '族中大事', { lines: f.history.length ? [{ title: '近事', items: f.history.map((x) => ({ head: x.turn != null ? `第${num(x.turn)}回合` : '', body: [x.event, x.desc].filter(Boolean).join('：') })) }] : [] }]
      ],
      acts: []
    };
  }
  function partyDoc(p) {
    const memberSet = new Set(p.lead.flatMap((l) => l.people.map((x) => x.name)));
    return {
      short: p.short, name: p.name, type: [p.standing, p.status].filter(Boolean).join(' · '), desc: p.desc,
      pills: [p.faction && `属${p.faction}`, p.hot ? '活跃' : ''].filter(Boolean),
      stats: [['影响', num(p.influence)], ['凝聚', num(p.cohesion)], ['党人', num(p.memberCount || p.members.length)], ['据要津', num(p.offices.length)]],
      juan: [
        ['纲领', '立场·目标', { rows: p.rows.map(([k, v]) => ({ k, v })), chips: p.stances.length ? [{ title: '立场签', items: p.stances.map((s) => ({ label: s })) }] : null, strengths: p.strengths, weaknesses: p.weaknesses }],
        ['党人', '党魁·羽翼', { links: [
          p.lead.length ? null : p.leader.name ? { title: '党魁', items: [personLink(p.leader)] } : null,
          ...p.lead.map((l) => ({ title: l.role, items: l.people.map((x) => personLink(x)) })),
          p.members.length ? { title: '核心成员', items: p.members.filter((x) => !memberSet.has(x.name)).slice(0, 40).map((x) => personLink(x)) } : null,
          p.offices.length ? { title: '据要津', items: p.offices.map((o) => ({ label: o })) } : null,
          p.base.length ? { title: '社会根基', items: p.base.map((b) => Object.assign(classLink(b.cls, Number.isFinite(b.affinity) ? (b.affinity > 0 ? '亲' : b.affinity < 0 ? '疏' : '平') + num(Math.round(Math.abs(b.affinity) * 100)) : ''), { tone: b.affinity < 0 ? 'warn' : '' })) } : null
        ].filter(Boolean) }],
        ['党势', '盟敌·消长', {
          relations: [...p.allies.map((n) => ({ name: n, kind: 'meng' })), ...p.foes.map((n) => ({ name: n, kind: 'di' })), ...p.neutrals.map((n) => ({ name: n, kind: 'zhong' }))]
            .map((r) => { const k = r.name.split(/[（(]/)[0]; return Object.assign(r, S.parties().some((x) => x.key === k) ? { onclick: () => jump('parties', k) } : {}); }),
          lines: [
            p.ledger.length ? { title: '党势近账', sub: '何因消长', items: p.ledger.map((e) => ({ head: `T${e.turn ?? '?'} ${e.label}${signed(e.d)}`, tone: e.d < 0 ? 'neg' : 'pos', body: e.why || '—' })) } : null,
            { title: '近因', items: p.causes.length ? causeLines(p.causes) : [{ body: '暂无可追溯变化' }] },
            p.disputes.length ? { title: '争端', items: p.disputes.map((d) => ({ head: d.rival ? `对${d.rival}` : '', body: `${d.topic}${d.stakes ? ' —— ' + d.stakes : ''}` })) } : null
          ].filter(Boolean) }],
        ['议程', '沿革·史略', {
          lines: p.agendaHistory.length ? [{ title: '议程沿革', items: p.agendaHistory.map((a) => ({ head: a.turn != null ? (a.turn > 0 ? `T${a.turn}` : a.turn === 0 ? '开局' : '前事') : '', body: `${a.agenda}${a.outcome ? ' → ' + a.outcome : ''}` })) }] : [],
          texts: p.history ? [['史略', p.history]] : [] }],
        ['事链', '诉求→议题→裁决', {
          chain: [{ k: '目标', v: p.chain.demand }, { k: '党派', v: p.chain.party }, { k: '议题', v: p.chain.issue || '待付廷议', empty: !p.chain.issue, onclick: p.chain.issue && onCourt ? () => { hide(); onCourt(p.chain.issue); } : null },
            { k: '裁决', v: p.chain.ruling || '暂无裁决', empty: !p.chain.ruling }, { k: '风险', v: p.chain.risk }],
          lines: [p.actions.length ? { title: '正在行动', items: p.actions.map((a) => ({ head: a.head, body: a.body })) } : null, ...ecoLines(p.ecology)].filter(Boolean) }]
      ],
      acts: actsOf('party', p)
    };
  }
  function classDoc(c) {
    const pills = [`满意${num(c.sat)}${c.sealed ? '（据奏）' : ''}`, `影响${num(c.influence)}`, c.trend ? `${c.trend > 0 ? '▲' : '▼'}${num(Math.abs(c.trend))}` : '', c.pressure, c.radical].filter(Boolean);
    const grp = (title, list) => (list.length ? { title, items: list.map((p) => personLink(p.name, `${p.role} 亲${p.affinity} 怨${p.grievance}`)) } : null);
    return {
      short: c.short, name: c.name, type: c.rows.find(([k]) => k === '经济角色')?.[1] || '', desc: c.desc, pills, note: c.sealedNote,
      stats: [],
      juan: [
        ['本末', '身份·权利·家计', { rows: c.rows.map(([k, v]) => ({ k, v })), bars: c.indicators,
          lines: c.factions.length ? [{ title: '内分', items: c.factions.map((f) => ({ head: `${f.name}${f.size ? ' ' + f.size : ''}`, body: f.stance || '—' })) }] : [] }],
        ['诉求', '议程·运动·党援', { links: [
          c.agenda.length ? { title: '诉求', items: c.agenda.map((a) => ({ label: a.text, title: a.kind, tone: a.urgency >= 3 ? 'warn' : '' })) } : null,
          c.movements.length ? { title: '运动', items: c.movements.map((m) => ({ label: m.label, tone: m.level >= 3 ? 'warn' : '' })) } : null,
          c.parties.length ? { title: '支持党派', items: c.parties.map((n) => partyLink(n)) } : null
        ].filter(Boolean) }],
        ['民情', '地域·近账·民心', c.sealed ? { sealed: `据奏之下，满意的分地、分账与升降一概封存。${c.sealedNote}` } : {
          lines: [
            c.regions.length ? { title: '地域分账', sub: '同阶不同地', items: c.regions.map((v) => ({ head: `${v.region} ${num(v.sat)}`, tone: v.sat < 35 ? 'neg' : 'pos', body: [v.base != null ? `势位${num(v.base)}` : '', v.note].filter(Boolean).join(' · ') || '—' })) } : null,
            c.ledger.length ? { title: '满意近账', sub: '何因增减', items: c.ledger.map((e) => ({ head: `T${e.turn ?? '?'} ${signed(e.d)}`, tone: e.d < 0 ? 'neg' : 'pos', body: e.why || '—' })) } : null,
            { title: '近因', items: c.causes.length ? causeLines(c.causes) : [{ body: '暂无可追溯变化' }] },
            c.minxin ? { title: '阶层民心', sub: '民心联动', items: [
              c.minxin.true != null ? { head: '民心', body: `真实${num(c.minxin.true)} · 感知${num(c.minxin.perceived)}${c.minxin.phase ? ' · ' + c.minxin.phase : ''}${c.minxin.pressure ? ' · ' + c.minxin.pressure : ''}` } : null,
              ...c.minxin.ledger.map((x) => ({ head: `T${x.turn ?? '?'} ${x.source}`, body: x.note || '—' }))].filter(Boolean) } : null
          ].filter(Boolean) }],
        ['人物', '代表·受益·怨恨', { links: [
          c.representatives.length ? { title: '名册代表', items: c.representatives.map((r) => personLink(r)) } : null,
          grp('代表人物', c.people.reps), grp('受益人物', c.people.bene), grp('怨恨人物', c.people.foes)
        ].filter(Boolean) }],
        ['事链', '诉求→代理→裁决', {
          chain: [{ k: '诉求', v: c.chain.demand }, { k: '代理', v: c.chain.delegate || '待定代理人物', empty: !c.chain.delegate, onclick: c.chain.delegate && onPerson ? () => onPerson(c.chain.delegate) : null },
            { k: '党援', v: c.chain.party || '待形成支持党派', empty: !c.chain.party, onclick: c.chain.party && S.parties().some((p) => p.key === c.chain.party) ? () => jump('parties', c.chain.party) : null },
            { k: '议题', v: c.chain.issue || '待付廷议', empty: !c.chain.issue, onclick: c.chain.issue && onCourt ? () => { hide(); onCourt(c.chain.issue); } : null },
            { k: '裁决', v: c.chain.ruling || '暂无裁决', empty: !c.chain.ruling }, { k: '风险', v: c.chain.risk }],
          lines: [c.actions.length ? { title: '正在行动', items: c.actions.map((a) => ({ head: a.head, body: a.body })) } : null, ...ecoLines(c.ecology)].filter(Boolean) }]
      ],
      acts: actsOf('class', c)
    };
  }

  // key：直开某势力；{ tab, key }：直开某页某条
  // key：直开某势力；{ tab, key, juan }：直开某页某条（juan 为势力谱牒的卷名，翻到该卷）
  function show(key) {
    if (key && typeof key === 'object') { tab = key.tab || tab; if (key.key) sel[tab] = key.key; tabs.setValue(tab); } else if (key) { tab = 'factions'; sel.factions = key; tabs.setValue(tab); }
    render();
    ov.classList.add('on');
    opened = true;
    const juanTo = key && typeof key === 'object' ? key.juan : '';
    const go = () => { if (!juanTo) return; const el = right.querySelector(`.rm-juan[data-juan="${juanTo}"]`); if (el) el.scrollIntoView({ block: 'start' }); };
    // 省道分组随老地名模块载入；未载时先平铺，载好再画一遍
    if (game.fangzhi && !game.fangzhi.circuitsReady()) game.fangzhi.ensureCircuits().then(() => { if (opened) { render(); go(); } });
    else go();
  }
  function hide() {
    ov.classList.remove('on');
    opened = false;
  }
  window.addEventListener('keydown', (e) => {
    if (!opened || document.querySelector('.q-juan-veil')) return;
    if (e.key === 'Escape') { e.stopPropagation(); hide(); }
  }, true);
  game.on('game:changed', () => { if (opened) render(); });
  return { show, hide, get opened() { return opened; } };
}

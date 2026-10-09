// 列传：一人的全卷，册页两叶。左叶卷首——立像、名字、官职、处境、加衔，十卷卷目，对此人的批注，动作；
// 右叶展开一卷：总览（八维五常两盘、心性、功名、志向特质）、身份（档案、功名出身、公私身份、形貌传略）、心绪、
// 关系（对君上之心、君上之疑、人际图谱、亲疏细览、观感五维、印象、血亲）、纪传（长卷、任事、历练）、家族（五代谱、统览、后宫子嗣）、
// 记忆、文事、视角、史料、任官（在世臣僚：任官参考，点一职走官制册的任命流程）。人名可翻其列传。
// 数据经 game.bio、game.offices；叫法（君上、批注、追赠）取 profile().bio。
import { h, replaceChildren } from '../core/dom.js';
import { bus } from '../core/bus.js';
import { num } from '../core/numerals.js';
import { pinned, togglePin } from '../core/pins.js';
import { zhou, juan } from '../kit/index.js';

const toast = (text) => bus.emit('kernel:toast', { text });
const SVGNS = 'http://www.w3.org/2000/svg';
function s(tag, attrs, ...kids) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
  for (const c of kids.flat()) if (c != null) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
const VOLS = [['overview', '总览'], ['identity', '身份'], ['mind', '心绪'], ['relations', '关系'], ['career', '纪传'], ['family', '家族'], ['memory', '记忆'], ['works', '文事'], ['pov', '视角'], ['sources', '史料'], ['office', '任官']];
const EMO = ['喜', '怒', '忧', '惧', '恨', '敬', '平'];
const signed = (v) => (v > 0 ? `+${num(v)}` : v < 0 ? `−${num(-v)}` : '0');
// 记忆的回合：开局前的旧事记成负回合，写作「前事」，第零回合写作「开局」
const when = (t) => (t == null ? '?' : t < 0 ? '前事' : t === 0 ? '开局' : `T${t}`);

// 雷达：axes = [[字, 0..100|null], …]
function radar(axes, color, size = 250) {
  const n = axes.length, c = size / 2, R = size * 0.31;
  const pt = (i, f) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [c + Math.cos(a) * R * f, c + Math.sin(a) * R * f]; };
  const ring = (f) => axes.map((_, i) => pt(i, f).map((x) => x.toFixed(1)).join(',')).join(' ');
  const val = axes.map(([, v], i) => pt(i, Math.max(0, Math.min(100, v || 0)) / 100).map((x) => x.toFixed(1)).join(',')).join(' ');
  return s('svg', { viewBox: `0 0 ${size} ${size}`, class: 'lz-radar' },
    [0.25, 0.5, 0.75, 1].map((f) => s('polygon', { points: ring(f), class: 'grid' })),
    axes.map((_, i) => { const [x, y] = pt(i, 1); return s('line', { x1: c, y1: c, x2: x.toFixed(1), y2: y.toFixed(1), class: 'spoke' }); }),
    s('polygon', { points: val, class: 'val', style: `--rc:${color}` }),
    axes.map(([k, v], i) => { const [x, y] = pt(i, 1.2); return s('text', { x: x.toFixed(1), y: (y + 4).toFixed(1), 'text-anchor': 'middle', class: 'lab' }, k, s('tspan', { class: 'v', x: x.toFixed(1), dy: '1.05em' }, v == null ? '?' : String(v))); }));
}

export function createBio({ root, game, profile, onAudience, onLetter, onOffices, onEdict, onAtlas }) {
  const B = game.bio;
  let cur = null;
  let vol = 'overview';
  let opened = false;
  let srcToken = 0;

  const head = h('div.lz-head');
  const vols = h('nav.lz-vols');
  const noteBox = h('div.lz-note');
  const acts = h('div.lz-acts');
  const left = h('section.ce-leaf.left.lz-left', head, vols, noteBox, acts);
  const right = h('section.ce-leaf.right.lz-right');
  const shut = h('button.ce-close.q-yapai', { type: 'button', onclick: () => hide() }, '合册');
  const book = h('div.ce-book', h('div.ce-ling'), left, h('div.ce-gutter'), right, shut);
  const ov = h('div.ce-ov.lz-ov', { role: 'dialog', 'aria-label': '列传' }, book);
  ov.addEventListener('pointerdown', (e) => { if (e.target === ov) hide(); });
  root.append(ov);

  const T = () => Object.assign({ lord: '主上', now: '主上', note: '批注', posthumous: '', mind: '自省心志' }, profile().bio || {});
  const link = (name, ok, label) => (ok ? h('button.lz-link', { type: 'button', onclick: () => show(name) }, label || name) : h('span', label || name));
  const sec = (title, sub, ...body) => h('section.lz-sec', h('h4', title, sub ? h('small', sub) : null), ...body);
  const rows = (list) => h('div.lz-rows', list.map(([k, v]) => h('p', h('span', k), h('b', v || '未录'))));
  const bar = (k, v, tone) => h('div.lz-bar' + (tone ? '.' + tone : ''), h('span', k), h('i', h('b', { style: { width: `${Math.max(0, Math.min(100, v || 0))}%` } })), h('em', v == null ? '—' : num(v)));
  const prose = (t, cls = '') => h('p.lz-prose' + cls, t);
  const stub = (t) => h('p.lz-stub', t);

  // ---------- 左叶 ----------
  function renderLeft() {
    const p = cur, t = T();
    replaceChildren(head,
      zhou({ name: p.name, src: p.portrait, dead: !p.alive }),
      h('div.lz-id',
        h('h2', p.name, p.zi ? h('small', `字${p.zi}`) : null),
        h('p.line', [p.age != null ? `${num(p.age)}岁` : '', p.gender].filter(Boolean).join(' · ')),
        h('p.office', p.office[0] || '布衣', p.rank ? h('em', p.rank) : null),
        p.office.length > 1 ? h('p.conc', `兼　${p.office.slice(1).join('、')}`) : null,
        h('p.line', [p.faction, p.party ? `${p.party}${p.partyRank ? '·' + p.partyRank : ''}` : ''].filter(Boolean).join(' · ')),
        p.honorary.length ? h('div.lz-hon', p.honorary.map((x) => h('span', { title: '加衔或身份称号' }, `衔 ${x}`))) : null),
      p.banner ? h('div.lz-banner', h('i', p.banner.glyph), h('div', h('b', p.banner.title), p.banner.note ? h('small', p.banner.note) : null)) : null);
    const count = { relations: p.relations.length, career: p.career.length, family: p.blood.length, memory: p.memory.length, works: p.works.length };
    if (vol === 'office' && !canOffice(p)) vol = 'overview';
    replaceChildren(vols, VOLS.filter(([k]) => k !== 'office' || canOffice(p)).map(([k, label]) => h('button' + (k === vol ? '.on' : ''), { type: 'button', dataset: { vol: k }, onclick: () => { vol = k; markVol(); renderRight(); } },
      h('b', label), count[k] ? h('small', num(count[k])) : null)));
    const text = B.note(p.name);
    replaceChildren(noteBox, h('h5', t.note, h('button', { type: 'button', onclick: editNote }, text ? '改' : '批')), text ? h('p', text) : h('p.empty', '未批'));
    const btn = (label, onclick, title) => h('button.q-yapai', { type: 'button', onclick, title: title || '' }, label);
    const list = [];
    if (p.isPlayer) list.push(btn(t.mind, () => { vol = 'pov'; markVol(); renderRight(); }));
    else if (!p.alive) {
      list.push(btn('阅其遗著', () => { vol = 'works'; markVol(); renderRight(); }));
      if (t.posthumous && onEdict) list.push(btn(t.posthumous, () => { hide(); toast(`${t.posthumous}：${p.name}`); onEdict(p.name); }));
    } else {
      if (onAudience) list.push(btn('召对', () => { hide(); onAudience(p.name); }));
      if (onLetter) list.push(btn('传书', () => { hide(); onLetter(p.name); }));
      if (onOffices) list.push(btn('官制', () => { hide(); onOffices(p.name); }));
    }
    if (!p.isPlayer && p.alive) list.push(btn(pinned(p) ? '去钉' : '钉选', () => { const on = togglePin(p); toast(on ? `${p.name}已钉选：书案图志与召对名单列在前头` : `${p.name}已去钉`); renderLeft(); }, '钉选之人在书案人物图志与召对名单里排在前头'));
    if (onAtlas) list.push(btn('图志', () => { hide(); onAtlas(p.name); }, '回人物图志'));
    list.push(btn('导出', exportBio, '存成一份列传文本'));
    replaceChildren(acts, list);
  }
  // 任官：在世、非君上本人，且本身份可任免（元首档有官制册）
  const canOffice = (p) => p.alive && !p.isPlayer && !!game.offices && !!onOffices;
  let vacantOnly = false;
  function officeSecs(p) {
    let rows = [];
    try { rows = game.offices.fitFor(p.name, vacantOnly); } catch (e) { return [stub(e.message)]; }
    const toggle = h('label.lz-vac', h('input', { type: 'checkbox', checked: vacantOnly, onchange: (e) => { vacantOnly = e.target.checked; renderRight(); } }), '只看缺额');
    return [sec('任官参考', '能力六成 · 五常四成',
      h('p.lz-prose', '依现行官制，按此人才具与各职所需打适配分。分数只作参考，不是任命资格或履职保证。任命照官制册之法：即时生效，并录入本回合所颁；要撤销去官制册。'), toggle,
      rows.length ? h('div.lz-fits', rows.map((r) => h('article.lz-fit' + (r.held ? '.held' : ''),
        h('header', h('b', r.pos.name, r.pos.rank ? h('small', r.pos.rank) : null), h('span.score', h('span.track', h('i', { style: { width: `${Math.max(0, Math.min(100, r.score))}%` } })), h('em', `适配${num(Math.round(r.score))}`))),
        h('p.path', r.deptPath, r.profile ? `　·　${r.profile}` : ''),
        h('p.stat', `额${num(r.pos.head)}　在${num(r.pos.actual)}${r.pos.vacant ? `　缺${num(r.pos.vacant)}` : ''}${r.pos.holders.length ? `　现任${r.pos.holders.map((x) => x.name).join('、')}` : ''}`),
        h('details', h('summary', '评分依据'), h('p', r.basis), r.missing.length ? h('p', `未录之项暂按五十估：${r.missing.join('、')}`) : null),
        (() => { const pend = r.pos.pending && String(r.pos.pending.line || '').includes(p.name);   // 本回合所任（撤销去官制册）
          return h('button.q-yapai', { type: 'button', disabled: r.held || pend, title: pend ? '本回合所任，已生效；要撤销去官制册' : '', onclick: () => appointTo(p, r) }, pend ? '本回合新任' : r.held ? '已在此职' : r.pos.holders.length && !r.pos.vacant ? '改换为此' : '任此职'); })())))
        : stub(vacantOnly ? '官制中暂无缺额。去掉「只看缺额」可看全部官职。' : '本剧本尚无可读的官制。'))];
  }
  // 照官制册的任命：先核此人在不在该职可选名册（年龄、所属、现任），一身两职另问辞旧或兼任
  function appointTo(p, r) {
    let data;
    try { data = game.offices.candidates(r.pos); } catch (e) { toast(e.message); return; }
    const c = data.list.find((x) => x.name === p.name);
    if (!c) { toast(`${p.name}不在${r.pos.name}的可选名册内（年龄、所属或现任情形不合）`); return; }
    const go = (mode) => { try { game.offices.appoint(r.pos, p.name, mode); } catch (e) { toast(e.message); } renderRight(); };   // 成否内核自以提示告知
    const old = r.pos.holders[0] && !r.pos.vacant ? r.pos.holders[0].name : '';
    const k = juan({ title: old ? '改换' : '任命', note: `${r.pos.dept}·${r.pos.name}`, width: '30rem', content: h('div.au-pick',
      h('p.of-ask', old ? `以${p.name}代${old}为${r.pos.name}。` : `以${p.name}为${r.pos.name}。`),
      c.holdsPost && c.holdsPost !== r.pos.name
        ? [h('button.au-pick-row', { type: 'button', onclick: () => { k.close('ok'); go('resign'); } }, h('b', '辞旧就新'), h('small', `免去原职${c.holdsPost}，全力赴任新职`)),
          h('button.au-pick-row', { type: 'button', onclick: () => { k.close('ok'); go('concurrent'); } }, h('b', '兼任两职'), h('small', '原职依旧，新职兼管；精力分散，效率打折'))]
        : h('button.au-pick-row', { type: 'button', onclick: () => { k.close('ok'); go('resign'); } }, h('b', '任之'), h('small', `胜任${num(c.match)}${c.travelDays ? `　赴任约${num(c.travelDays)}日` : ''}`))) });
  }
  function markVol() { vols.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.vol === vol)); }
  function editNote() {
    const t = T();
    const ta = h('textarea.lz-ta', { rows: 4, placeholder: `${t.note}于此人……（留空即撤）` });
    ta.value = B.note(cur.name);
    juan({ title: t.note, note: cur.name, width: '32rem', content: ta, actions: [{ label: '钤定', onclick: ({ close }) => { close('ok'); const v = B.setNote(cur.name, ta.value); toast(v ? `${t.note}已钤` : `${t.note}已撤`); renderLeft(); } }] });
    setTimeout(() => ta.focus(), 400);
  }

  // ---------- 右叶 ----------
  function renderRight() {
    const p = cur, t = T();
    const self = p.isPlayer ? profile().self : '吾';
    let body = [];
    if (vol === 'overview') {
      body = [
        sec('禀赋命盘', p.wuchang.some(([, v]) => v != null) ? '八维评量 · 五常心性' : '八维评量',
          h('div.lz-pans', h('figure', radar(p.eight, '#a83228'), h('figcaption', '八维评量')),
            p.wuchang.some(([, v]) => v != null) ? h('figure', radar(p.wuchang, '#557f6f'), h('figcaption', '五常心性')) : h('figure.none', stub('此人未录五常。')))),
        sec('心性状态', '', h('div.lz-bars', p.heart.map(([k, v]) => bar(k, v, { 忠诚: 'jade', 野心: 'violet', 压力: 'verm', 康健: 'gold', 廉介: 'jade', 名望: 'gold' }[k])))),
        sec('功名', '累积政绩 · 升迁凭据', h('div.lz-merit', h('b', p.gongming.merit == null ? '—' : num(p.gongming.merit)), p.gongming.tier ? h('span', p.gongming.tier) : null, h('small', '六阶累进 · 处事建功而得 · 用于升迁')),
          p.gongming.log.length ? h('div.lz-log', h('h6', '近期功名升降'), p.gongming.log.map((m) => h('p', h('span', `第${num(m.turn)}回`), h('b' + (m.delta > 0 ? '.up' : m.delta < 0 ? '.dn' : ''), m.delta ? signed(m.delta) : '功绩'), h('em', m.reason)))) : null),
        h('div.lz-two', sec('当前志向', '', prose(p.goal || '未录')),
          sec('性格特质', '', p.traits.length ? h('div.lz-traits', p.traits.map((x) => h('span' + (x.tone ? '.' + x.tone : ''), x.name))) : stub('未录特质'), p.personality ? prose(p.personality) : null))
      ];
    } else if (vol === 'identity') {
      const o = p.origin;
      body = [
        sec('身份档案', '', h('div.lz-idgrid', p.identity.map(([k, v]) => h('div' + (['学识', '家族', '辞令'].includes(k) ? '.two' : ''), h('span', k), h('b', v || '未录'))))),
        o ? sec('功名出身', '资格 · 仕途所凭',
          h('div.lz-origin', h('b', o.title), o.honors.map((x) => h('span.hon', x)), h('span' + (o.zhengtu ? '.zheng' : '.yi'), o.zhengtu ? '正途' : '异途'), h('span.liu.' + o.liupin, o.liupinLabel)),
          h('div.lz-stats', [['仕途天花板', o.ceiling, '循资所及'], ['个人优免', `${num(o.youmian)} 丁`, '免役之额'], ['政绩', `${p.gongming.tier || '—'}${p.gongming.merit != null ? `（${num(p.gongming.merit)}）` : ''}`, '积功而得']]
            .map(([k, v, sub]) => h('div', h('span', k), h('b', v), h('small', sub)))),
          h('p.lz-fnote', o.note + (o.inferred ? '　〔出身据官职推定·剧本未明载〕' : ''))) : null,
        h('div.lz-two',
          h('div.lz-dual', h('span', p.role), h('b', p.office[0] || '布衣'), p.office.length > 1 ? h('em', `兼　${p.office.slice(1).join('、')}`) : null,
            h('small', [p.faction, p.party ? `${p.party}${p.partyRank ? '（' + p.partyRank + '）' : ''}` : '', p.rank].filter(Boolean).join(' · '))),
          h('div.lz-dual.priv', h('span', '私人身份'), h('b', `${p.name}${p.age != null ? `，${num(p.age)}岁` : ''}`), h('small', p.personality || '—'))),
        sec('形貌与传略', '', p.appearance ? prose(p.appearance, '.look') : null, prose(p.bio || '传略未录。', '.indent'))
      ];
    } else if (vol === 'mind') {
      const m = p.mind;
      body = [
        h('div.lz-two',
          sec('当前心绪', '', h('div.lz-mood', h('b', `〔${m.mood}〕${m.moodText}`), h('small', `压力 ${num(m.stress)} / 100 · ${m.stressLabel}`))),
          sec('心性变量', '', h('div.lz-bars', bar('压力', p.heart[2][1], 'verm'), bar('野心', p.heart[1][1], 'violet'), bar('廉介', p.heart[4][1], 'jade')))),
        sec('五常心性', '', h('div.lz-wc', p.wuchang.map(([k, v]) => h('span.' + (v == null ? 'mid' : v >= 60 ? 'hi' : v >= 30 ? 'mid' : 'lo'), k, h('small', v == null ? '?' : num(v)))))),
        sec('内省与行止', '', prose([p.personality, p.bio].filter(Boolean).join('　') || '未录', '.indent'))
      ];
    } else if (vol === 'relations') {
      body = [
        p.toLord ? sec(`对${t.lord}之心`, '', h('div.lz-lord', h('b' + (p.toLord.favor >= 0 ? '.good' : '.bad'), signed(p.toLord.favor)), h('span', p.toLord.label), h('small', '受恩与受屈、共事与争执，日积月累，见于今日的亲疏。'))) : null,
        p.doubts.length ? sec(`${t.lord}之疑`, '问对识破 · 君臣嫌隙', h('div.lz-doubt', p.doubts.map((d) => h('p', h('b', `第${num(d.turn)}回`),
          `${t.lord}${d.caught ? '当面识破' : '隐隐觉出'}其有所隐瞒${d.hiding ? `：所隐者「${d.hiding}」` : ''}`)))) : null,
        p.relations.length ? sec('人际关系图谱', '点姓名可阅其列传', egonet(p)) : null,
        sec('关系强弱细览', '', p.relations.length ? h('div.lz-rels', p.relations.map((r) => h('div' + (r.strength == null ? '.bare' : ''), link(r.name, r.known), h('span.' + (r.tone || 'neu'), r.label),
          r.strength == null ? null : h('i.meter', h('b.' + (r.strength >= 0 ? 'pos' : 'neg'), { style: { left: `${r.strength >= 0 ? 50 : 50 - Math.abs(r.strength) / 2}%`, width: `${Math.abs(r.strength) / 2}%` } })),
          r.strength == null ? null : h('em', signed(r.strength)), r.desc ? h('p', r.desc) : null))) : stub('暂无关系。')),
        p.wuwei.length ? sec('观感五维', '此人对诸人的亲·信·敬·畏·敌', h('div.lz-rows', p.wuwei.map((x) => h('p', h('span', link(x.name, x.known)), h('b', `亲${x.affinity} · 信${x.trust} · 敬${x.respect} · 畏${x.fear} · 敌${x.hostility}`))))) : null,
        h('div.lz-two',
          sec('对他人印象', '', p.impressions.length ? h('div.lz-rows', p.impressions.map((x) => h('p', h('span', link(x.name, x.known)), h('b.' + (x.favor >= 0 ? 'good' : 'bad'), `${x.label}（${signed(x.favor)}）`)))) : stub('暂无印象记录。')),
          sec('血亲', '', p.blood.length ? h('div.lz-rows', p.blood.map((m) => h('p', h('span', m.relation), h('b', link(m.name, m.known, m.name + (m.dead ? ' †' : '')))))) : stub('暂无血亲记录。')))
      ];
    } else if (vol === 'career') {
      body = [
        sec('纪传长卷', '履历·近事 编年', p.career.length ? h('ol.lz-ribbon', p.career.map((c) => h('li' + (c.key ? '.key' : ''), h('span', c.when), h('em', c.tag), h('b', c.title), c.desc ? h('p', c.desc) : null))) : stub('尚无履历近事。')),
        sec('官制与任事', '', rows(p.post)),
        p.domains.length ? sec('人生历练', '按领域', h('div.lz-traits', p.domains.map(([d, n]) => h('span', `${d} ×${num(n)}`))), h('div.lz-life', p.lifeExp.map((e) => h('p', h('span', `〔${e.domain}〕`), e.desc)))) : null
      ];
    } else if (vol === 'family') {
      const f = p.family;
      body = [
        sec('五代家谱', '金框为本人 · 虚线为姻亲 · † 已故', tree(p)),
        sec('家族统览', '', h('div.lz-clan', [['门第', f.tier || '—'], ['族丁', num(f.members)], ['名望', f.fame == null ? '—' : num(f.fame), f.fame], ['家族', f.family || '—']]
          .map(([k, v, bv]) => h('div', h('span', k), h('b', v), bv != null ? h('i', h('b', { style: { width: `${Math.max(0, Math.min(100, bv))}%` } })) : null)))),
        p.house ? sec('后宫与子嗣', '', rows([p.house.spouse ? ['配偶', `${p.house.spouse}${p.house.spouseRank ? '（' + p.house.spouseRank + '）' : ''}`] : null, p.house.children.length ? ['子嗣', p.house.children.join('、')] : null].filter(Boolean))) : null
      ];
    } else if (vol === 'memory') {
      body = [
        sec('此人记忆', `${num(p.memory.length)} 条`, p.memory.length ? h('div.lz-mems', p.memory.map((m) => h('p', h('span', { title: m.turn != null ? `第${m.turn}回合` : '' }, when(m.turn)), h('i.' + (EMO.includes(m.emotion) ? 'e' + EMO.indexOf(m.emotion) : 'e6'), m.emotion), h('b', m.event, m.who ? h('small', ` → ${m.who}`) : null)))) : stub('暂无活跃记忆。'),
          p.archive.length ? h('details.lz-arc', h('summary', `往事归档（${num(p.archive.length)}段）`), h('div.lz-mems', p.archive.map((a) => h('p', h('span', a.period), h('b', a.summary))))) : null),
        sec('角色弧线', '', p.arcs.length ? h('div.lz-rows', p.arcs.map((a) => h('p', h('span', `T${a.turn} · ${a.type}`), h('b', a.desc)))) : stub('暂无角色弧线。'))
      ];
    } else if (vol === 'works') {
      body = [sec('著述文事', p.works.length ? `${num(p.works.length)} 篇` : '', p.works.length ? h('div.lz-works', p.works.map((x) => h('div', h('b', x.preserved ? h('i', '★') : null, `《${x.title}》`),
        h('small', [x.genre, x.mood, `T${x.turn}`, `品 ${num(x.quality)}`].filter(Boolean).join(' · '))))) : stub('此人未有著述传世。'))];
    } else if (vol === 'pov') {
      const v = p.pov;
      body = [
        sec('此人眼中', '主观视角', h('p.lz-povlead', h('b', `${p.name}自陈：`), v.lead || '未录')),
        sec(`${self}眼中诸人`, '', v.eyes.length ? h('div.lz-eyes', v.eyes.map((e) => h('p', h('span', e.lord ? `视${t.lord}` : `视${e.name}`),
          h('b.' + (e.tone || 'neu'), e.lord ? `${self}于${t.now}，${e.label}。` : `${self}视${e.name}，${e.label}${e.lean ? `（${e.lean}）` : ''}。`)))) : stub(`${self}与朝中诸人未有深交。`)),
        sec('萦怀之事', '近日记忆', p.memory.length ? h('div.lz-eyes', p.memory.slice(0, 3).map((m) => h('p', h('span', when(m.turn)), h('b', `〔${m.emotion}〕${m.event}`)))) : stub('近来心绪未着痕迹。')),
        sec(`${self}之立场`, '', rows([['立场', v.stance], ['党派', v.side], ['所求', v.goal || '—']]))
      ];
    } else if (vol === 'sources') {
      body = [sourcesSec(p)];
    } else if (vol === 'office') {
      body = officeSecs(p);
    }
    replaceChildren(right, h('header.lz-rhead', h('span', VOLS.find(([k]) => k === vol)[1]), h('small', p.name)), ...body.filter(Boolean));
    right.scrollTop = 0;
  }

  // 人际图谱：本人居中，至多八人环列；线色记亲疏，粗细记强弱
  function egonet(p) {
    const list = p.relations.slice(0, 8);
    const W = 560, H = 300, cx = W / 2, cy = H / 2, rx = 210, ry = 112;
    const nodes = list.map((r, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / list.length; return { r, x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }; });
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'lz-ego' },
      nodes.map(({ r, x, y }) => s('line', { x1: cx, y1: cy, x2: x.toFixed(1), y2: y.toFixed(1), class: 'edge ' + (r.tone || 'neu'), 'stroke-width': r.strength == null ? 1 : (1 + Math.abs(r.strength) / 30).toFixed(1) })),
      s('g', { class: 'me', transform: `translate(${cx},${cy})` }, s('circle', { r: 26 }), s('text', { y: 5, 'text-anchor': 'middle' }, p.name.length > 3 ? p.name.slice(0, 3) : p.name)),
      nodes.map(({ r, x, y }) => {
        const wv = Math.max(34, r.name.length * 15 + 14);
        const g = s('g', { class: 'node ' + (r.tone || 'neu') + (r.known ? ' link' : ''), transform: `translate(${x.toFixed(1)},${y.toFixed(1)})` },
          s('rect', { x: -wv / 2, y: -15, width: wv, height: 30, rx: 2 }), s('text', { y: 5, 'text-anchor': 'middle' }, r.name), s('title', {}, `${r.name} · ${r.label}${r.strength == null ? '' : ' ' + signed(r.strength)}`));
        if (r.known) g.addEventListener('click', () => show(r.name));
        return g;
      }));
    return h('div.lz-egowrap', svg, h('p.lz-legend', h('span.good', '亲善'), h('span.bad', '嫌隙'), h('span.neu', '泛交'), h('small', '粗线记已知亲疏')));
  }
  // 五代家谱：按辈分五排，本人在同辈一排
  function tree(p) {
    const gens = { '-2': '祖辈', '-1': '父辈', 0: '同辈', 1: '子辈', 2: '孙辈' };
    const by = { '-2': [], '-1': [], 0: [], 1: [], 2: [] };
    for (const m of p.blood) (by[String(Math.max(-2, Math.min(2, m.generation)))] || by[0]).push(m);
    by[0].unshift({ name: p.name, relation: '本人', self: true });
    const cell = (m) => h('div' + (m.self ? '.self' : '') + (m.inLaw ? '.inlaw' : '') + (m.dead ? '.dead' : ''), m.self || !m.known ? h('b', m.name + (m.dead ? ' †' : '')) : h('button', { type: 'button', onclick: () => show(m.name) }, m.name + (m.dead ? ' †' : '')), h('small', m.relation));
    const rowsEl = Object.keys(gens).sort((a, b) => a - b).filter((k) => by[k].length).map((k) => h('div.lz-gen', h('span', gens[k]), h('div', by[k].map(cell))));
    return p.blood.length ? h('div.lz-tree', rowsEl) : stub('暂无血亲记录。');
  }
  function sourcesSec(p) {
    const box = h('div.lz-src');
    const paras = [prose('这里是玩家阅览的史家资料，不是人物记忆。后事、异文和任命日待考分别标注；不会据此预定本局未来。', '.faint')];
    if (p.fictional) paras.push(prose(`此人为剧本虚构角色，不配造古籍原文。${p.fictionalNotes.join('；')}`));
    const loading = p.sourceKey ? prose('正在读取独立史料参考文件……', '.faint') : null;
    replaceChildren(box, paras, loading, ...tail(p, null));
    const my = ++srcToken;
    B.sources(p.name).then((r) => {
      if (my !== srcToken || !cur || cur.name !== p.name || vol !== 'sources') return;
      const out = [...paras];
      if (r.entry) {
        if (r.entry.pending) out.push(prose('原文待核：已找到资料线索，但未完成可靠逐字释读，不以转述冒充原文。'));
        r.entry.quotes.forEach((q, i) => out.push(h('article.lz-quote', h('h6', `${i + 1}．${q.book}`), prose(q.text), q.url ? h('a', { href: q.url, target: '_blank', rel: 'noopener noreferrer' }, '查看原始出处 ↗') : null)));
        if (r.entry.note) out.push(h('h6', '时点、异文与写入边界'), prose(r.entry.note));
        r.entry.refs.forEach((q) => out.push(h('p.lz-ref', q.book, q.url ? h('a', { href: q.url, target: '_blank', rel: 'noopener noreferrer' }, ' ↗') : null)));
      } else {
        p.looseSources.forEach((x) => out.push(prose(x)));
        if (r.error) out.push(prose(`${r.error} 已保留人物自带的参考条目。`, '.faint'));
        else if (!p.looseSources.length && !p.fictional) out.push(prose('暂未嵌入可靠原文。', '.faint'));
      }
      replaceChildren(box, out, ...tail(p, r));
    }).catch((e) => { if (my === srcToken) toast(e.message); });
    return sec('史料与校勘', '', box);
  }
  function tail(p, r) {
    const out = [];
    if (p.officeNote) out.push(h('h6', '官职校记'), prose(p.officeNote));
    if (p.recorded.length || p.kin.length) out.push(h('h6', '已录资料', h('small', '未证内容保持未知，不由立绘或数值反推')), rows(p.recorded), ...p.kin.map((x) => prose(x)));
    if (r && (r.wuchang || r.wuchangError)) {
      out.push(h('h6', '五常评定依据'), prose('这里记录剧本开局的编者评定，不是古籍中的数字或对古人的测量。当前五常以人物面板为准；本局行为可以改变其后表现。', '.faint'));
      if (r.wuchang) { out.push(rows(r.wuchang.rows)); if (r.wuchang.note) out.push(prose(r.wuchang.note)); r.wuchang.refs.forEach((q) => out.push(h('p.lz-ref', q.book, q.url ? h('a', { href: q.url, target: '_blank', rel: 'noopener noreferrer' }, ' ↗') : null))); } else out.push(prose(r.wuchangError, '.faint'));
    }
    return out;
  }

  // ---------- 导出 ----------
  function exportBio() {
    const p = cur;
    const L = [`【${p.name}${p.zi ? '　字' + p.zi : ''}】`, `${p.office.join('、')}${p.rank ? '　' + p.rank : ''}　${p.faction}${p.party ? '·' + p.party : ''}`];
    if (p.appearance) L.push('', `形貌：${p.appearance}`);
    if (p.bio) L.push('', p.bio);
    L.push('', `才具：${p.eight.map(([k, v]) => `${k}${v}`).join(' ')}`, `五常：${p.wuchang.map(([k, v]) => `${k}${v ?? '?'}`).join(' ')}`, `心性：${p.heart.filter(([, v]) => v != null).map(([k, v]) => `${k}${v}`).join(' ')}`);
    if (p.goal) L.push(`志向：${p.goal}`);
    if (p.career.length) { L.push('', '纪传：'); p.career.forEach((c) => L.push(`　${c.when}　${c.title}${c.desc ? '　' + c.desc : ''}`)); }
    const url = URL.createObjectURL(new Blob([L.join('\n')], { type: 'text/plain;charset=utf-8' }));
    const a = h('a', { href: url, download: `${p.name}·列传.txt` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('列传已导出');
  }

  function show(name, at) {
    try { cur = B.person(name); } catch (e) { toast(e.message); return; }
    if (at) vol = at;
    else if (!opened) vol = 'overview';
    renderLeft();
    renderRight();
    ov.classList.add('on');
    opened = true;
  }
  function hide() {
    ov.classList.remove('on');
    opened = false;
  }
  window.addEventListener('keydown', (e) => {
    if (!opened || document.querySelector('.q-juan-veil')) return;
    if (e.key === 'Escape') { e.stopPropagation(); hide(); }
  }, true);
  game.on('game:changed', () => { if (opened && cur) { try { cur = B.person(cur.name); renderLeft(); if (vol !== 'sources') renderRight(); } catch (_e) { hide(); } } });
  return { show, hide, get opened() { return opened; } };
}

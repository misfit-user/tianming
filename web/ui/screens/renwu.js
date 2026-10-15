// 人物窗：照 CK3 的角色窗口，靠左展开，舆图露着（同志 10-11：「人物图志没必要做成专门 UI，可以做成 CK3 那种」）。
// 点任何一处人像（案前诸人、提纲、寻人、各册里的人名、右键可为单）都开这一扇；再点别人就换人，左上「‹」退回上一位。
//   卷首：立像铺满（剧本立像本是带景的画），左缘一列圆钮是能对此人做的事（见、书、任、钉、参，做不了的灰着写缘由），
//         右下配偶与子嗣两枚小像，左上压处境印（殁、狱、谪、行、谋）。
//   名衔：姓名与字、年齿、职衔与品级章、与我（此即本人／视我亲疏与好感）。
//   性情一行、才具八项、心性声望一行（忠诚、野心、名望、贤能，九品刻度）。
//   职掌：现职、所在（点了舆图镜头飞去）、所掌之地与兵；势力、党派、家族门第、出身。
//   四页：家人（尊长、配偶、子女、同辈，人像可点）、交游（亲疏与好感）、履历、生平。
//   卷底：详传（列传全卷）、寻人。
// 数据：game.bio.person（列传同源，tm-renwu-tuzhi.js adaptChar）、game.select.people（品秩、处境）、game.standing（所掌）。
import { h, replaceChildren } from '../core/dom.js';
import { num } from '../core/numerals.js';
import { bus } from '../core/bus.js';
import { pinned, togglePin } from '../core/pins.js';
import { pin, tiao } from '../kit/index.js';

const SKILL_NAMES = { 智: '智略', 武: '武勇', 军: '军略', 政: '政务', 管: '理财', 交: '交际', 魅: '魅力', 仁: '仁德' };
const KIN_GROUPS = [['elders', '尊长'], ['spouses', '配偶'], ['children', '子女'], ['peers', '同辈']];
const SPOUSE_RE = /妻|夫$|丈夫|配|妃|嫔|妾|后$|夫人/;
// 关系字认辈分（名册血亲自带辈分；剧本所载亲属只有关系字）
const genOfRel = (rel) => (/祖/.test(rel) ? -2 : /父|母|叔|伯|舅|姑|姨/.test(rel) ? -1 : /孙/.test(rel) ? 2 : /子|女|嗣|儿|侄|甥/.test(rel) ? 1 : 0);
// 一家人：名册血亲在前，剧本所载亲属补上名册没连上的
function kinOf(b) {
  const out = (b.blood || []).map((m) => ({ ...m }));
  for (const m of b.kinList || []) if (!out.some((x) => x.name === m.name)) out.push({ ...m, generation: genOfRel(m.relation) });
  return out;
}
const TABS = [['kin', '家人'], ['rel', '交游'], ['career', '履历'], ['life', '生平']];
const signed = (v) => (v > 0 ? `+${num(v)}` : v < 0 ? `−${num(-v)}` : '〇');

// viewer() → { name, player: 是否玩家本人（非借视角）, sovereign: 是否元首一档（见臣下之心）, lord: 称君上之词 }
// 人心（所知之律，同列传）：元首见他人的忠诚、野心；余者只见自己的，他人只列名望、贤能这类公论
// can(name) → { audience: 缘由或空, letter: 缘由或空, office: 缘由或空（空即可行）, readOnly }
export function createRenwu({ root, game, viewer, can, onAudience, onLetter, onOffice, onBio, onFind, locate, compare }) {
  let cur = null;               // 当前之人的名
  let back = [];                // 看过的人，「‹」退回
  let tab = 'kin';

  const pic = h('div.rw-pic');
  const seal = h('div.rw-state');
  const acts = h('nav.rw-acts');
  const kin = h('div.rw-kin');
  const backBtn = h('button.rw-ctl', { type: 'button', title: '退回上一位', onclick: () => goBack() }, '‹');
  const shutBtn = h('button.rw-ctl', { type: 'button', title: '收起（Esc）', onclick: () => hide() }, '×');
  const hero = h('section.rw-hero', pic, seal, acts, kin, h('div.rw-ctls', backBtn, shutBtn));
  const name = h('header.rw-name');
  const traits = h('div.rw-traits');
  const skills = h('ol.rw-skills');
  const gauges = h('div.rw-gauges');
  const post = h('section.rw-post');
  const tabBar = h('nav.rw-tabs');
  const page = h('div.rw-page.q-scroll');
  const foot = h('footer.rw-foot');
  const body = h('div.rw-body', name, traits, skills, gauges, post, tabBar, page);
  const el = h('aside.rw', { role: 'dialog', 'aria-label': '人物' }, hero, body, foot);
  root.append(el);

  let peopleCache = null;
  const peopleRow = (n) => {
    if (!peopleCache) { try { peopleCache = new Map(game.select.people({ dead: true }).map((p) => [p.name, p])); } catch (_e) { peopleCache = new Map(); } }
    return peopleCache.get(n) || null;
  };
  const face = (n, src, cls = '') => {
    const row = n ? peopleRow(n) : null;
    const url = src || (row && row.portrait) || '';
    const initial = h('i', [...(n || '？')][0]);
    if (!url) return h('span.rw-face' + cls, initial);
    const img = h('img', { src: url, alt: n, loading: 'lazy', decoding: 'async' });
    img.addEventListener('error', () => img.replaceWith(initial), { once: true });
    return h('span.rw-face' + cls, img);
  };
  // 人名可点（在名册里才可点）：换人
  const who = (n, known, label) => (known ? h('button.rw-who', { type: 'button', dataset: { person: n }, onclick: () => show(n) }, label || n) : h('span.rw-who.plain', label || n));

  // ---------- 与我：此即本人；他人看我——先看此人与我的交游、印象，玩家本人再看对君上那一条 ----------
  function tome(b) {
    const v = viewer();
    if (b.name === v.name) return { self: true };
    const rel = (b.relations || []).find((r) => r.name === v.name);
    const imp = (b.impressions || []).find((x) => x.name === v.name);
    if (rel || imp) return { label: (rel && rel.label) || (imp && imp.label) || '平', score: rel && rel.strength != null ? rel.strength : imp ? imp.favor : null };
    if (v.sovereign) return b.toLord ? { label: b.toLord.label || '平', score: b.toLord.favor, lord: true } : null;   // 君上那一条没记就不写
    return { label: '素无往来', score: null };
  }

  function render() {
    const b = (() => { try { return game.bio.person(cur); } catch (_e) { return null; } })();
    if (!b) { replaceChildren(name, h('p.rw-none', '此人不在名册')); return; }
    const row = peopleRow(cur) || {};
    const v = viewer();
    const self = b.name === v.name;
    const c = can(b.name) || {};

    // 卷首
    replaceChildren(pic, b.portrait ? h('img', { src: b.portrait, alt: b.name, decoding: 'async', onerror: (e) => e.target.replaceWith(h('i', [...b.name][0])) }) : h('i', [...b.name][0]));
    el.classList.toggle('dead', !b.alive);
    replaceChildren(seal, b.banner ? tiao(h('b', b.banner.glyph), () => ({ title: b.banner.title, text: b.banner.note || '' })) : null);
    const act = (glyph, label, off, onclick, on) => tiao(h('button.rw-act' + (off ? '.off' : '') + (on ? '.on' : ''), { type: 'button', 'aria-label': label, 'aria-disabled': off ? 'true' : 'false',
      onclick: () => { if (!off) onclick(); } }, h('b', glyph)), () => ({ title: label, text: off || '' }));
    const list = [];
    if (!self && b.alive) {
      list.push(act('见', c.audienceTitle || '召见', c.audience, () => onAudience(b.name)));
      list.push(act('书', c.letterTitle || '传书', c.letter, () => onLetter(b.name)));
      if (c.office != null) list.push(act('任', '任官', c.office, () => onOffice(b.name)));
    }
    if (!self && b.alive) list.push(act('钉', pinned(row.id ? row : b) ? '撤钉选' : '钉选（排在提纲、寻人之首）', '', () => { togglePin(row.id ? row : b); render(); }, pinned(row.id ? row : b)));
    if (compare) list.push(act('参', compare.has(b.name) ? '移出对参' : '放进对参（至多三人并看）', '', () => { compare.toggle(b.name); render(); }, compare.has(b.name)));
    replaceChildren(acts, list);
    // 配偶与子嗣：各取一位在世者（剧本名册里有的），小像压在卷首右下
    const blood = kinOf(b);
    const spouse = blood.find((m) => !m.dead && m.generation === 0 && SPOUSE_RE.test(m.relation) && !/嫂|弟妇|弟媳/.test(m.relation));
    const heir = blood.filter((m) => !m.dead && m.generation > 0).sort((x, y) => (/长/.test(y.relation) ? 1 : 0) - (/长/.test(x.relation) ? 1 : 0))[0];
    replaceChildren(kin, [spouse, heir].filter(Boolean).map((m) => h('button.rw-medal', { type: 'button', disabled: !m.known, dataset: { person: m.known ? m.name : '' }, title: `${m.relation}　${m.name}`, onclick: () => show(m.name) },
      face(m.name), h('small', m.relation.length > 3 ? m.relation.slice(-2) : m.relation))));
    backBtn.hidden = !back.length;

    // 名衔
    const t = tome(b);
    const fam = (b.family && b.family.family) || '';
    const ages = [b.age != null ? `${num(b.age)}岁` : '', b.gender, fam.replace(/[（(].*$/, '')].filter(Boolean).join(' · ');
    replaceChildren(name,
      h('div.rw-title', h('h2', b.name, b.zi ? h('small', `字${b.zi}`) : null), b.rank ? h('span.rw-rank', b.rank) : null),
      h('p.rw-office', b.office.join('、') || '布衣'),
      h('p.rw-line', ages),
      !t ? null : t.self ? h('p.rw-tome.self', h('i', '我'), '此即本人')
        : h('p.rw-tome' + (t.score > 0 ? '.good' : t.score < 0 ? '.bad' : ''), h('i', '与'), t.lord ? `视${v.lord}：${t.label}` : `视我：${t.label}`, t.score != null ? h('em', signed(t.score)) : null));

    // 性情、才具、心性声望
    replaceChildren(traits, (b.traits || []).length ? b.traits.map((x) => h('span.' + (x.tone || 'plain'), x.name)) : h('span.none', '性情未详'));
    replaceChildren(skills, (b.eight || []).map(([k, val]) => tiao(h('li' + (val >= 80 ? '.hi' : val > 0 && val <= 30 ? '.lo' : ''), h('i', k), h('b', num(val))), () => ({ title: SKILL_NAMES[k] || k, text: `${num(val)}` }))));
    const fame = game.select.fameRank(row.fame);
    const virtue = game.select.virtueRank(row.merit);
    const heart = v.sovereign || self ? Object.fromEntries(b.heart || []) : {};
    replaceChildren(gauges,
      heart['忠诚'] != null ? pin('忠诚', heart['忠诚']) : null,
      heart['野心'] != null ? pin('野心', heart['野心']) : null,
      pin('名望', fame.meter, { text: fame.text, note: `${fame.full}（${num(fame.value)}）` }),
      pin('贤能', virtue.meter, { text: virtue.text, note: `第${num(virtue.stage)}阶·${virtue.text}（${num(virtue.value)}）` }));

    // 职掌：现职、所在、所掌；势力、党派、家族、出身
    let st = null;
    if (b.alive) { try { st = game.standing(b.name); } catch (_e) { st = null; } }
    const charges = st ? st.charges.filter((x) => x.kind !== 'household') : [];
    const KIND = { region: '地', circuit: '省', army: '兵', office: '署' };
    const place = b.location ? h('button.rw-place', { type: 'button', title: '舆图镜头飞往此地', disabled: !locate, onclick: () => locate && !locate(b.location) && bus.emit('kernel:toast', { text: `舆图上认不出「${b.location}」` }) },
      b.location, b.travelTo ? h('small', ` → ${b.travelTo}`) : null) : h('span', '未详');
    const chips = [b.faction, b.party ? `${b.party}${b.partyRank ? '·' + b.partyRank : ''}` : '', (b.family && b.family.tier) || '', b.origin && b.origin.title && b.origin.title !== '布衣' ? b.origin.title : ''].filter(Boolean);
    replaceChildren(post,
      h('div.rw-kv', h('span', '所在'), place),
      charges.length ? h('div.rw-kv', h('span', '所掌'), h('div.rw-charges', charges.map((x) => h('button.rw-charge', { type: 'button', disabled: !(locate && (x.kind === 'region' || x.kind === 'circuit' || x.kind === 'army')),
        onclick: () => locate && locate(x.kind === 'army' ? x.location : x.name) }, h('i', KIND[x.kind] || '掌'), x.name.replace(/布政使司$/, ''), x.kind === 'army' ? h('small', `${num(x.soldiers)}人`) : null)))) : null,
      chips.length ? h('div.rw-chips', chips.map((x) => h('span', x))) : null);

    // 四页
    const counts = { kin: blood.length, rel: (b.relations || []).length, career: (b.career || []).length };
    replaceChildren(tabBar, TABS.map(([k, label]) => h('button' + (k === tab ? '.on' : ''), { type: 'button', onclick: () => { tab = k; render(); } }, label, counts[k] ? h('small', num(counts[k])) : null)));
    replaceChildren(page, ...pageOf(b));
    page.scrollTop = 0;

    // 卷底
    replaceChildren(foot,
      h('button.q-yapai', { type: 'button', onclick: () => onBio(b.name) }, '详传'),
      h('button.q-yapai', { type: 'button', onclick: () => onFind(b.name) }, '寻人'),
      v.player || self ? null : h('small', '借视角：只读'));
  }

  function pageOf(b) {
    if (tab === 'kin') {
      const blood = kinOf(b);
      if (!blood.length) return [h('p.rw-none', '名册与剧本里都未见其亲属。'), b.family && b.family.family ? h('p.rw-note', `${b.family.family}${b.family.tier ? ' · ' + b.family.tier : ''}`) : null].filter(Boolean);
      const groups = { elders: [], spouses: [], children: [], peers: [] };
      for (const m of blood) groups[m.generation < 0 ? 'elders' : m.generation > 0 ? 'children' : SPOUSE_RE.test(m.relation) && !/嫂|弟妇|弟媳/.test(m.relation) ? 'spouses' : 'peers'].push(m);
      return KIN_GROUPS.filter(([k]) => groups[k].length).map(([k, label]) => h('section.rw-group', h('h4', label, h('small', num(groups[k].length))),
        h('div.rw-cards', groups[k].map((m) => h('button.rw-card' + (m.dead ? '.dead' : ''), { type: 'button', disabled: !m.known, dataset: { person: m.known ? m.name : '' }, onclick: () => show(m.name) },
          face(m.name), h('b', m.name), h('small', { title: m.note || '' }, m.relation + (m.dead ? ' · 殁' : '')))))));
    }
    if (tab === 'rel') {
      const rels = (b.relations || []).slice().sort((x, y) => Math.abs(y.strength || 0) - Math.abs(x.strength || 0));
      if (!rels.length) return [h('p.rw-none', '交游未详。')];
      return [h('div.rw-rels', rels.map((r) => h('div.rw-rel.' + (r.tone || 'plain'),
        h('button.rw-relface', { type: 'button', disabled: !r.known, dataset: { person: r.known ? r.name : '' }, onclick: () => show(r.name) }, face(r.name)),
        h('div', h('p', who(r.name, r.known), h('span', r.label)), r.desc ? h('small', r.desc) : null),
        r.strength != null ? h('em', signed(r.strength)) : null)))];
    }
    if (tab === 'career') {
      const list = b.career || [];
      if (!list.length) return [h('p.rw-none', '履历未详。')];
      return [h('ol.rw-career', list.map((x) => h('li' + (x.key ? '.key' : ''), h('time', x.when), h('div', h('b', x.title), x.desc ? h('p', x.desc) : null))))];
    }
    const out = [];
    if (b.personality) out.push(h('section.rw-group', h('h4', '性情'), h('p.rw-prose', b.personality)));
    if (b.goal) out.push(h('section.rw-group', h('h4', '所求'), h('p.rw-prose', b.goal)));
    if (b.bio) out.push(h('section.rw-group', h('h4', '生平'), h('p.rw-prose', b.bio)));
    if (b.appearance) out.push(h('section.rw-group', h('h4', '形貌'), h('p.rw-prose', b.appearance)));
    return out.length ? out : [h('p.rw-none', '生平未详。')];
  }

  // show(名, { tab })：tab 是 kin 家人、rel 交游、career 履历、life 生平（书目「家」「史」直翻那一页）
  function show(n, { fresh = false, tab: at = '' } = {}) {
    if (!n) return;
    if (at && TABS.some(([k]) => k === at)) tab = at;
    if (cur && cur !== n && !fresh && el.classList.contains('on')) back = [...back.filter((x) => x !== cur), cur].slice(-12);
    if (fresh || !el.classList.contains('on')) back = [];
    cur = n;
    peopleCache = null;
    render();
    el.classList.add('on');
    bus.emit('renwu:shown', { name: n });
  }
  function goBack() {
    const prev = back.pop();
    if (!prev) return;
    cur = prev;
    peopleCache = null;
    render();
    bus.emit('renwu:shown', { name: prev });
  }
  function hide() {
    if (!el.classList.contains('on')) return;
    el.classList.remove('on');
    back = [];
    bus.emit('renwu:hidden', {});
  }
  // 回合过后、钉选变了：开着就重画
  bus.on('game:advanced', () => { if (el.classList.contains('on')) { peopleCache = null; render(); } });
  bus.on('pins:changed', () => { if (el.classList.contains('on')) render(); });

  return { show, hide, get open() { return el.classList.contains('on'); }, get current() { return el.classList.contains('on') ? cur : null }, refresh: () => { if (el.classList.contains('on')) render(); } };
}

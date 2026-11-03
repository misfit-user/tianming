// 人物窗：照 CK3 的角色窗口，靠左展开，舆图露着（同志 10-11：「人物图志没必要做成专门 UI，可以做成 CK3 那种」）。
// 点任何一处人像（案前诸人、提纲、寻人、各册里的人名、右键可为单）都开这一扇；再点别人就换人，左上「‹」退回上一位。
//   一整卷只有一处滚动：往下读时立像收成一条压着姓名职衔的窄带，页签吸在窄带之下，读生平不必在一条缝里翻；卷底的事一直在手边。
//   卷首：立像按卷首的高铺、顶对齐，两侧化入同一张图的虚影，脸总落在亮处；点立像展开看全像，再点收回。右下配偶与子嗣两枚小像，左上压处境印（殁、狱、谪、行、谋），底下势力印、姓名、品级、职衔。
//   年齿与亲疏（此即本人／视我亲疏与好感）一行，性情一行、才具八项、心性声望一行（忠诚、野心、名望、贤能，九品刻度）。
//   职掌：所在（点了舆图镜头飞去）、所掌之地与兵；势力、党派、门第、出身。
//   四页：家人（尊长、同辈、晚辈一条线排成世系，本人居中；门生、同僚、所事之主另列）、交游（亲疏与好感）、履历、生平（史料一条一条列）。
//   卷底：能对此人做的事（召见、传书、任官、钉选、对参，做不了的灰着写缘由），详传（列传全卷）、寻人。
// 数据：game.bio.person（列传同源，tm-renwu-tuzhi.js adaptChar）、game.select.people（品秩、处境）、game.standing（所掌）。
import { h, replaceChildren } from '../core/dom.js';
import { num, numText } from '../core/numerals.js';
import { bus } from '../core/bus.js';
import { pinned, togglePin } from '../core/pins.js';
import { pin, tiao } from '../kit/index.js';

const SKILL_NAMES = { 智: '智略', 武: '武勇', 军: '军略', 政: '政务', 管: '理财', 交: '交际', 魅: '魅力', 仁: '仁德' };
const SPOUSE_RE = /妻|夫$|丈夫|配|妃|嫔|妾|后$|夫人/;
const isSpouse = (m) => m.generation === 0 && SPOUSE_RE.test(m.relation) && !/嫂|弟妇|弟媳/.test(m.relation);
// 剧本的亲属栏里也记门生、同僚、部将、所事之主（「所事之汗」「所近那颜」）：这些不是亲属，不排进世系
const NON_KIN_RE = /^(?:门生|门徒|弟子|徒|师|私淑|法脉|法嗣|道团|教|同(?!母)|上[司官相]|盟|战友|部将|君|臣|所|国师|外戚|辅政|宿将|权臣|党友|本支|护部|统军|掌)|那颜|萨满|别乞|哈敦|长老|勇士|部酋|使者|商首|戍将|占婚|结亲/;
const isKin = (m) => !NON_KIN_RE.test(m.relation || '');
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
// 履历的年份：光一个数的按年份写（一六二二年），不念成「一千六百二十二」
const whenText = (w) => numText(/^\d{3,4}$/.test(String(w)) ? `${w}年` : w);
// 生平里「【史料记载】」之后是一串引文：拆开，一条一条列，书名单独压出来
function splitBio(text) {
  const [main, ...rest] = String(text).split('【史料记载】');
  const src = rest.join('').trim();
  const items = !src ? [] : src.split(/(?<=[。！？；」』）])\s*(?=[^。！？；，、《]{0,8}《[^》]+》[：:])/).map((x) => {
    const m = x.trim().match(/^([^《]{0,8}《[^》]+》)[：:]\s*([\s\S]*)$/);
    return m ? { book: m[1], text: m[2] } : { book: '', text: x.trim() };
  }).filter((x) => x.text);
  return { main: main.trim(), items };
}

// viewer() → { name, player: 是否玩家本人（非借视角）, sovereign: 是否元首一档（见臣下之心）, lord: 称君上之词 }
// 人心（所知之律，同列传）：元首见他人的忠诚、野心；余者只见自己的，他人只列名望、贤能这类公论
// can(name) → { audience: 缘由或空, letter: 缘由或空, office: 缘由或空（空即可行）, readOnly }
// sealOf(势力名) → { key, name, short, hostile, color } 名衔旁那枚势力印；onFaction(key) 点印开势力窗
export function createRenwu({ root, game, viewer, can, onAudience, onLetter, onOffice, onBio, onFind, locate, compare, sealOf = null, onFaction = null }) {
  let cur = null;               // 当前之人的名
  let back = [];                // 看过的人，「‹」退回
  let tab = 'kin';

  const pic = h('div.rw-pic');
  const seal = h('div.rw-state');
  const acts = h('nav.rw-acts');
  const kin = h('div.rw-kin');
  const backBtn = h('button.rw-ctl', { type: 'button', title: '退回上一位', onclick: () => goBack() }, '‹');
  const shutBtn = h('button.rw-ctl', { type: 'button', title: '收起（Esc）', onclick: () => hide() }, '×');
  const name = h('header.rw-name');
  const hero = h('section.rw-hero', pic, seal, kin, name);
  const lead = h('div.rw-lead');
  const traits = h('div.rw-traits');
  const skills = h('ol.rw-skills');
  const gauges = h('div.rw-gauges');
  const post = h('section.rw-post');
  const tabBar = h('nav.rw-tabs');
  const page = h('div.rw-page');
  const footMore = h('div.rw-more');
  const foot = h('footer.rw-foot', acts, footMore);
  const body = h('div.rw-body', lead, traits, skills, gauges, post);
  const scroller = h('div.rw-scroll.q-scroll', hero, body, tabBar, page);
  const el = h('aside.rw', { role: 'dialog', 'aria-label': '人物' }, scroller, h('div.rw-ctls', backBtn, shutBtn), foot);
  root.append(el);
  // 展像：点立像，卷首展开到正好露全这幅画（立像都是整幅的画，平时只露上半截）；窗矮就展到窗底。再点收回
  function gaze(on) {
    const fg = pic.querySelector('.fg');
    if (on && !fg) return;
    el.classList.toggle('gaze', on);
    if (on) {
      scroller.scrollTop = 0;
      const band = parseFloat(getComputedStyle(tabBar).top);
      const ratio = fg.naturalWidth ? fg.naturalHeight / fg.naturalWidth : 4 / 3;
      el.style.setProperty('--rw-hero', `${Math.min(scroller.clientHeight, Math.round(scroller.clientWidth * ratio + band * .45))}px`);
    } else el.style.removeProperty('--rw-hero');
  }
  pic.addEventListener('click', () => gaze(!el.classList.contains('gaze')));
  window.addEventListener('resize', () => gaze(false));
  // 往下读时卷首右下的小像先淡去（窄带里放不下，也别压到右上的按钮）
  let rollTick = 0;
  scroller.addEventListener('scroll', () => {
    if (rollTick) return;
    rollTick = requestAnimationFrame(() => {
      rollTick = 0;
      const t = Math.min(1, scroller.scrollTop / Math.max(1, hero.offsetHeight - parseFloat(getComputedStyle(tabBar).top)));
      el.style.setProperty('--rw-roll', t.toFixed(3));
      el.classList.toggle('rolled', t > .4);
    });
  }, { passive: true });
  // 页签吸住时卷身该滚到的位置：卷身到底，减去窄带的高（页签的 top）
  const tabsStuckAt = () => body.offsetTop + body.offsetHeight - parseFloat(getComputedStyle(tabBar).top);

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
    // 同一人重画（翻页签、过回合）不换图，免得闪；没有立像写粉本（一幅只勾了轮廓的绢）
    pic.title = b.portrait ? '看全像' : '';
    const picKey = `${b.name}|${b.portrait || ''}`;
    if (pic.dataset.key !== picKey) {
      pic.dataset.key = picKey;
      const blank = () => h('i', [...b.name][0]);
      replaceChildren(pic, b.portrait ? [h('img.bg', { src: b.portrait, alt: '', 'aria-hidden': 'true', decoding: 'async' }),
        h('img.fg', { src: b.portrait, alt: b.name, decoding: 'async', onerror: () => replaceChildren(pic, blank()) })] : blank());
    }
    el.classList.toggle('dead', !b.alive);
    replaceChildren(seal, b.banner ? tiao(h('b', b.banner.glyph), () => ({ title: b.banner.title, text: b.banner.note || '' })) : null);
    const act = (label, note, off, onclick, on) => tiao(h('button.q-yapai' + (off ? '.off' : '') + (on ? '.on' : ''), { type: 'button', 'aria-disabled': off ? 'true' : 'false',
      onclick: () => { if (!off) onclick(); } }, label), () => (off || note ? { title: note || label, text: off || '' } : null));
    const list = [];
    if (!self && b.alive) {
      list.push(act(c.audienceTitle || '召见', '', c.audience, () => onAudience(b.name)));
      list.push(act(c.letterTitle || '传书', '', c.letter, () => onLetter(b.name)));
      if (c.office != null) list.push(act('任官', '', c.office, () => onOffice(b.name)));
    }
    if (!self && b.alive) list.push(act(pinned(row.id ? row : b) ? '撤钉' : '钉选', pinned(row.id ? row : b) ? '' : '排在提纲、寻人之首', '', () => { togglePin(row.id ? row : b); render(); }, pinned(row.id ? row : b)));
    if (compare) list.push(act('对参', compare.has(b.name) ? '已在对参，再点移出' : '放进对参，至多三人并看', '', () => { compare.toggle(b.name); render(); }, compare.has(b.name)));
    replaceChildren(acts, list);
    // 配偶与子嗣：各取一位在世者（剧本名册里有的），小像压在卷首右下
    const blood = kinOf(b);
    const spouse = blood.find((m) => !m.dead && isKin(m) && isSpouse(m));
    const heir = blood.filter((m) => !m.dead && isKin(m) && m.generation > 0).sort((x, y) => (/长/.test(y.relation) ? 1 : 0) - (/长/.test(x.relation) ? 1 : 0))[0];
    replaceChildren(kin, [spouse, heir].filter(Boolean).map((m) => h('button.rw-medal', { type: 'button', disabled: !m.known, dataset: { person: m.known ? m.name : '' }, title: `${m.relation}　${m.name}`, onclick: () => show(m.name) },
      face(m.name), h('small', m.relation.length > 3 ? m.relation.slice(-2) : m.relation))));
    backBtn.hidden = !back.length;

    // 名衔
    const t = tome(b);
    const fam = (b.family && b.family.family) || '';
    const ages = [b.age != null ? `${num(b.age)}岁` : '', b.gender, fam.replace(/[（(].*$/, '')].filter(Boolean).join(' · ');
    // 名衔左边一枚势力印（国色、简称，同势力窗的印），点开势力窗
    const fac = b.faction && sealOf ? sealOf(b.faction) : null;
    replaceChildren(name,
      fac ? tiao(h('button.zw-seal.sw-seal.rw-fseal' + (fac.hostile ? '.hostile' : ''), { type: 'button', style: fac.color ? { background: fac.color } : {}, onclick: () => onFaction && onFaction(fac.key) }, fac.short),
        () => ({ title: fac.name, text: '点开其势力' })) : null,
      h('div.rw-names',
        h('div.rw-title', h('h2', b.name, b.zi ? h('small', `字${b.zi}`) : null), b.rank ? h('span.rw-rank', b.rank) : null),
        h('p.rw-office', { title: b.office.length > 1 ? b.office.join('、') : null }, b.office.join('、') || '布衣')));
    replaceChildren(lead,
      h('p.rw-line', ages),
      !t ? null : t.self ? h('p.rw-tome.self', h('i', '我'), '此即本人')
        : h('p.rw-tome' + (t.score > 0 ? '.good' : t.score < 0 ? '.bad' : ''), h('i', '与'), t.lord ? `视${v.lord}：${t.label}` : `视我：${t.label}`, t.score != null ? h('em', signed(t.score)) : null));

    // 性情、才具、心性声望
    // 没有词条就空着：性情的文字在生平页。悬停写加成与行事（特质库里有的）
    replaceChildren(traits, (b.traits || []).map((x) => tiao(h('span.' + (x.tone || 'plain'), x.name), () => (x.note || x.tend ? { title: x.name, text: [numText(x.note || ''), x.tend].filter(Boolean).join('　') } : null))));
    replaceChildren(skills, (b.eight || []).map(([k, val]) => tiao(h('li' + (val >= 80 ? '.hi' : val > 0 && val <= 30 ? '.lo' : ''), { '--v': `${Math.max(0, Math.min(100, val))}%` }, h('i', k), h('b', num(val))), () => ({ title: SKILL_NAMES[k] || k, text: `${num(val)}` }))));
    const fame = game.select.fameRank(row.fame);
    const virtue = game.select.virtueRank(row.merit);
    const heart = v.sovereign || self ? Object.fromEntries(b.heart || []) : {};
    replaceChildren(gauges,
      heart['忠诚'] != null ? pin('忠诚', heart['忠诚']) : null,
      heart['野心'] != null ? pin('野心', heart['野心']) : null,
      pin('名望', fame.meter, { text: fame.text, note: `${fame.full}（${num(fame.value)}）` }),
      pin('贤能', virtue.meter, { text: virtue.text, note: `第${num(virtue.stage)}阶·${virtue.text}（${num(virtue.value)}）` }));

    // 职掌：现职、所在、所掌；势力、党派、家族、出身（内核按品级推定的出身不写：皇帝、太监也会被推成进士）
    let st = null;
    if (b.alive) { try { st = game.standing(b.name); } catch (_e) { st = null; } }
    const charges = st ? st.charges.filter((x) => x.kind !== 'household') : [];
    const KIND = { region: '地', circuit: '省', army: '兵', office: '署' };
    const place = b.location ? h('button.rw-place', { type: 'button', title: '舆图镜头飞往此地', disabled: !locate, onclick: () => locate && !locate(b.location) && bus.emit('kernel:toast', { text: `舆图上认不出「${b.location}」` }) },
      b.location, b.travelTo ? h('small', ` → ${b.travelTo}`) : null) : h('span', '未详');
    const facts = [['势力', fac ? '' : b.faction], ['党派', b.party ? `${b.party}${b.partyRank ? '·' + b.partyRank : ''}` : ''], ['门第', (b.family && b.family.tier) || ''], ['出身', b.origin && !b.origin.inferred && b.origin.title && b.origin.title !== '布衣' ? b.origin.title : '']].filter((x) => x[1]);
    // 所在、所掌短就并一行；所掌有几处或名字长才各占一行
    const longCharge = charges.length > 1 || (charges[0] && charges[0].name.length > 10);
    replaceChildren(post,
      h('div.rw-kv' + (longCharge ? '.wide' : ''), h('span', '所在'), place),
      charges.length ? h('div.rw-kv' + (longCharge ? '.wide' : ''), h('span', '所掌'), h('div.rw-charges', charges.map((x) => h('button.rw-charge', { type: 'button', disabled: !(locate && (x.kind === 'region' || x.kind === 'circuit' || x.kind === 'army')),
        onclick: () => locate && locate(x.kind === 'army' ? x.location : x.name) }, h('i', KIND[x.kind] || '掌'), x.name.replace(/布政使司$/, ''), x.kind === 'army' ? h('small', `${num(x.soldiers)}人`) : null)))) : null,
      facts.map(([k, x]) => h('div.rw-kv', h('span', k), h('b', x))));

    // 四页
    const counts = { kin: blood.length, rel: (b.relations || []).length, career: (b.career || []).length };
    replaceChildren(tabBar, TABS.map(([k, label]) => h('button' + (k === tab ? '.on' : ''), { type: 'button', onclick: () => turnTab(k) }, label, counts[k] ? h('small', num(counts[k])) : null)));
    replaceChildren(page, ...pageOf(b));
    // 换页、换人时字轻轻浮上来（过回合、钉选重画不动）
    const pageKey = `${b.name}|${tab}`;
    if (page.dataset.key !== pageKey) {
      page.dataset.key = pageKey;
      page.classList.remove('turn');
      void page.offsetWidth;
      page.classList.add('turn');
    }

    // 卷底
    replaceChildren(footMore,
      h('button.q-yapai', { type: 'button', onclick: () => onBio(b.name) }, '详传'),
      h('button.q-yapai', { type: 'button', onclick: () => onFind(b.name) }, '寻人'),
      v.player || self ? null : h('small', '借视角：只读'));
  }

  // 翻页签：已经往下读了的，新一页从页签底下开始（短的一页不至于把人甩回卷首）
  function turnTab(k) {
    tab = k;
    const was = scroller.scrollTop;
    render();
    scroller.scrollTop = Math.min(was, tabsStuckAt());
  }

  function pageOf(b) {
    if (tab === 'kin') {
      const all = kinOf(b);
      if (!all.length) return [h('p.rw-none', '名册与剧本里都未见其亲属。'), b.family && b.family.family ? h('p.rw-note', `${b.family.family}${b.family.tier ? ' · ' + b.family.tier : ''}`) : null].filter(Boolean);
      const tiers = { elders: [], peers: [], youngers: [], others: [] };
      for (const m of all) tiers[!isKin(m) ? 'others' : m.generation < 0 ? 'elders' : m.generation > 0 ? 'youngers' : 'peers'].push(m);
      tiers.peers.sort((x, y) => (isSpouse(y) ? 1 : 0) - (isSpouse(x) ? 1 : 0));   // 同辈里配偶挨着本人
      const card = (m) => h('button.rw-card' + (m.dead ? '.dead' : ''), { type: 'button', disabled: !m.known, dataset: { person: m.known ? m.name : '' }, onclick: () => show(m.name) },
        face(m.name), h('b', m.name), h('small', { title: m.note || '' }, m.relation + (m.dead ? ' · 殁' : '')));
      const tier = (label, list, ...head) => h('section.rw-tier', h('h4', label), h('div.rw-cards', head, list.map(card)));
      const me = h('div.rw-card.me', face(b.name, b.portrait), h('b', b.name), h('small', '本人'));
      const kinCount = tiers.elders.length + tiers.peers.length + tiers.youngers.length;
      return [
        kinCount ? h('div.rw-tree', tiers.elders.length ? tier('尊长', tiers.elders) : null, tier('同辈', tiers.peers, me), tiers.youngers.length ? tier('晚辈', tiers.youngers) : null) : null,
        tiers.others.length ? h('section.rw-group', h('h4', '师友僚属', h('small', num(tiers.others.length))), h('div.rw-cards', tiers.others.map(card))) : null
      ].filter(Boolean);
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
      return [h('ol.rw-career', list.map((x) => h('li' + (x.key ? '.key' : ''), h('time', whenText(x.when)), h('div', h('b', x.title), x.desc ? h('p', x.desc) : null))))];
    }
    const out = [];
    if (b.personality) out.push(h('section.rw-group', h('h4', '性情'), h('p.rw-prose', b.personality)));
    if (b.goal) out.push(h('section.rw-group', h('h4', '所求'), h('p.rw-prose', b.goal)));
    if (b.bio) {
      const { main, items } = splitBio(b.bio);
      if (main) out.push(h('section.rw-group', h('h4', '生平'), h('p.rw-prose', main)));
      if (items.length) out.push(h('section.rw-group', h('h4', '史料'), h('ul.rw-cite', items.map((x) => h('li', x.book ? h('cite', x.book) : null, x.text)))));
    }
    if (b.appearance) out.push(h('section.rw-group', h('h4', '形貌'), h('p.rw-prose', b.appearance)));
    return out.length ? out : [h('p.rw-none', '生平未详。')];
  }

  // show(名, { tab })：tab 是 kin 家人、rel 交游、career 履历、life 生平（书目「家」「史」直翻那一页）
  function show(n, { fresh = false, tab: at = '' } = {}) {
    if (!n) return;
    if (at && TABS.some(([k]) => k === at)) tab = at;
    if (cur && cur !== n && !fresh && el.classList.contains('on')) back = [...back.filter((x) => x !== cur), cur].slice(-12);
    if (fresh || !el.classList.contains('on')) back = [];
    if (cur !== n) gaze(false);
    cur = n;
    peopleCache = null;
    render();
    el.classList.add('on');
    scroller.scrollTop = 0;
    // 指明翻哪一页（书目「家」「史」）而窗太矮看不见页签的，直接翻到页签
    if (at && tabBar.offsetTop + tabBar.offsetHeight + page.firstElementChild?.offsetHeight > scroller.clientHeight) scroller.scrollTop = tabsStuckAt();
    bus.emit('renwu:shown', { name: n });
  }
  function goBack() {
    const prev = back.pop();
    if (!prev) return;
    gaze(false);
    cur = prev;
    peopleCache = null;
    render();
    scroller.scrollTop = 0;
    bus.emit('renwu:shown', { name: prev });
  }
  function hide() {
    if (!el.classList.contains('on')) return;
    el.classList.remove('on');
    gaze(false);
    back = [];
    bus.emit('renwu:hidden', {});
  }
  // 回合过后、钉选变了：开着就重画
  bus.on('game:advanced', () => { if (el.classList.contains('on')) { peopleCache = null; render(); } });
  bus.on('pins:changed', () => { if (el.classList.contains('on')) render(); });

  return { show, hide, get open() { return el.classList.contains('on'); }, get current() { return el.classList.contains('on') ? cur : null }, refresh: () => { if (el.classList.contains('on')) render(); } };
}

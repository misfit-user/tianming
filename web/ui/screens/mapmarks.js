// 舆图标记（照 CK3 图上的军队与事态标记）：本方诸军一处一面军旗（旗上主将之姓、缺帅的写番号首字，旗下兵数，告急朱边闪），
// 别家之军照其疆域底色插旗（所知之律见 desk.js sightOfFoes）；
// 行军的画一道虚线箭头指向去处；民变各股所在一处一面墨旗；交战处一枚「战」字圆章。DOM 层，每帧跟着镜头摆位，压在舆图题名之上、界面之下。
// 看得见哪些由调用方定（knows：所知之律——通用一套只见本人所统与所掌辖区内的）：返回 'exact' 知其确数，'rough' 只见其大概
// （无官之人在本籍亲见驻军，只知数百、数千、数万），假则不画。
import { h, replaceChildren } from '../core/dom.js';
import { num, numeralStyle, cnNum } from '../core/numerals.js';
import { tiao } from '../kit/index.js';
import { REALM_INKS } from '../scene/map/politics.js';

// 兵数写短：一万八、三万二、五千六、八百（阿拉伯数字时 1.8万）
export function shortCount(n) {
  n = Math.max(0, Math.round(Number(n) || 0));
  if (numeralStyle() === 'arabic') return n >= 1e4 ? `${(n / 1e4).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '')}万` : String(n);
  // 九千九百五十起，千位四舍五入就进到一万，归「万」这一档写「一万」，不写「十千」（晚唐银州军九千九百余人原先就写成十千）
  if (n >= 9950) { const k = Math.round(n / 1e3), a = Math.floor(k / 10), b = k % 10; return `${cnNum(a)}万${b ? cnNum(b) : ''}`; }
  if (n >= 1e3) { const k = Math.round(n / 100), a = Math.floor(k / 10), b = k % 10; return `${cnNum(a)}千${b ? cnNum(b) : ''}`; }
  return cnNum(Math.round(n / 10) * 10) || '〇';
}
// 旗分三等（一面旗连同并进来的一堆合计）：不足一万小旗，一万到三万中旗，三万以上大旗（双燕尾）
const tierOf = (n) => (n >= 30000 ? 't3' : n >= 10000 ? 't2' : 't1');
// 只见其大概：数百、千余、数千、万余、数万、十余万
export function roughCount(n) {
  n = Math.max(0, Number(n) || 0);
  return n < 1000 ? '数百' : n < 2000 ? '千余' : n < 10000 ? '数千' : n < 20000 ? '万余' : n < 100000 ? '数万' : '十余万';
}
// 番号取一个字上旗，同一衙门、同一路下的几军要分得开：
//   无「·」的去掉京城、御营之类的冠称取头一字（关宁军 → 关、御营右军 → 右）；
//   有「·」的取末段头一字（京营·神机营 → 神、荆湖·岳飞部 → 岳、宁远副总兵·祖氏家丁 → 祖），八旗取旗色（后金·两黄旗 → 黄）；
//   末段是正兵、残部、总览、主力这类泛称的仍取前段（东京留守司·正兵 → 东、察哈尔·主力 → 察）
const partsOf = (name) => String(name || '军').replace(/[（(][^）)]*[）)]/g, '').split('·').map((s) => s.trim()).filter(Boolean);
// 八旗取旗色：两黄旗、正白旗、镶蓝旗
const bannerOf = (name) => { const parts = partsOf(name), m = parts.length ? /^(?:两|正|镶)?([黄红白蓝])旗/.exec(parts[parts.length - 1]) : null; return m ? m[1] : ''; };
function flagChar(name) {
  const parts = partsOf(name);
  if (!parts.length) return '军';
  const last = parts[parts.length - 1];
  const banner = bannerOf(name);
  if (banner) return banner;
  if (parts.length > 1 && !/^(正|残|总|余|本|全|诸|主)/.test(last)) return [...last][0];
  return [...parts[0].replace(/^(南京|北京|御营)(?=..)/, '')][0] || '军';
}
// 旗上写什么（同志 11-22 依议：军是有人统的）：八旗写旗色；有帅的写主将之姓（袁、毛、宗、岳、何——换了将旗跟着变，姓取法见
//   adapter/army.js commandOf）；缺帅的（无帅、主将已殁）写番号首字、旗褪色（.vacant），一眼看得出
const markOf = (a) => bannerOf(a.name) || (!a.vacant && a.surname) || flagChar(a.name);

// 别家的旗色：那一家在舆图上的底色（map.realmColorOf，与疆域同一色）；没有地盘的（群盗、游牧诸部）从同一套颜料里按家取定一色
function inkOf(map, key) {
  const c = map.realmColorOf ? map.realmColorOf(key) : null;
  if (c) return c;
  let h = 0;
  for (const ch of String(key || '?')) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return REALM_INKS[1 + (h % (REALM_INKS.length - 1))];
}

// 落点：诸军读内核绑定的地块（军上的 site：一块，或粗区、两可的几块候选），regionOf(候选, 是否一片) 挑一块；
//   绑不上的、民变、交战按地名认：placeOf(地名) → 舆图上的府州（先问内核，再按 model/place.js；书案镜头落点同一份）。旗落其治所
// 别家之军：sightOfFoes() 给一个 (府州) → 'exact' | 'rough' | false 的所知之律（desk.js）；点了 onFoe(势力键) 翻谱牒里那一家
export function createMapMarks({ layer, map, game, isLive, placeOf, regionOf, knows, sightOfFoes, onArmy, onFoe, onRebels }) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'mk-routes');
  svg.innerHTML = '<defs><marker id="mk-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 L3,5 z" fill="#a3281b"/></marker>' +
    '<marker id="mk-stop" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="11" markerHeight="11" orient="auto"><path d="M5,0.5 L5,9.5" stroke="#a3281b" stroke-width="2.8" stroke-linecap="round"/></marker></defs>';
  const marks = h('div.mk-pins');
  layer.append(svg, marks);
  let pins = [], routes = [];
  // 图上点选的预览线（书案 startPick，同志 11-23 定乙·③）：从此军所在沿路到鼠标所指那块；ids 为空收起
  const previewPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  previewPath.setAttribute('class', 'mk-route preview');
  previewPath.setAttribute('marker-end', 'url(#mk-arrow)');
  let previewPts = null;
  function preview(ids) {
    const pts = (ids || []).map((id) => regionOf([id], false)).filter(Boolean).map((r) => r.center);
    previewPts = pts.length >= 2 ? pts : null;
    if (previewPts) svg.append(previewPath); else previewPath.remove();
  }

  function refresh() {
    let rows = [], foes = [], rebels = [], battles = [];
    try { rows = game.army.roster().groups.flatMap((g) => g.rows); } catch (_e) { rows = []; }
    try { foes = sightOfFoes ? game.army.foreign() : []; } catch (_e) { foes = []; }
    try { rebels = game.army.rebels(); } catch (_e) { rebels = []; }
    try { battles = game.army.battles().active; } catch (_e) { battles = []; }
    // 诸军按所在府州归堆：一处一面旗
    const byPlace = new Map();
    for (const a of rows) {
      if (a.site && a.site.dispersed) continue;
      const r = (a.site && regionOf(a.site.ids, a.site.area)) || placeOf(a.location);
      const k = r && knows({ army: a, region: r });
      if (!k) continue;
      const key = String(r.id || r.name);
      if (!byPlace.has(key)) byPlace.set(key, { r, list: [], rough: false });
      const g = byPlace.get(key);
      g.list.push(a);
      if (k === 'rough') g.rough = true;
    }
    // 驻地没绑到一块的（只知一片、两处，剧本记的粗区代表点，或按地名约略认的），悬停注明原写的驻地
    const about = (a, r) => (a.site && a.site.exact) || !a.location || a.location === r.name ? '' : `　约在${a.location}`;
    pins = [];
    routes = [];
    const els = [];
    for (const { r, list, rough } of byPlace.values()) {
      const total = list.reduce((s, a) => s + (a.soldiers || 0), 0);
      const lead = list.slice().sort((a, b) => (b.soldiers || 0) - (a.soldiers || 0))[0];
      const hot = list.some((a) => a.hot), marching = list.some((a) => a.march);
      // 只见其大概的：不写番号字、不记几部、点了不翻军务册（册里本无此军）
      const n = h('span.mk-n'), c = h('em.mk-c');
      const pin = { kind: rough ? 'rough' : 'army', rough, x: r.center[0], y: r.center[1], place: r.name, total, count: list.length, weight: (hot ? 1e9 : 0) + total, n, c, absorbed: [], sig: null };
      const el = h('button.mk.mk-army.' + tierOf(total) + (hot ? '.hot' : '') + (marching ? '.march' : '') + (rough ? '.rough' : '') + (lead.naval ? '.navy' : '') + (!rough && lead.vacant ? '.vacant' : ''), { type: 'button', 'aria-label': `${r.name}驻军`,
        onclick: rough ? null : () => onArmy(pin.absorbed.length ? null : lead.key) },
        h('i.mk-pole'), h('i.mk-flag2'), h('b.mk-flag', rough ? '兵' : markOf(lead)), n, c);
      const lines = list.map((a) => `${a.name}　${num(a.soldiers)}人${a.commander ? '　' + a.commander : '　缺帅'}${about(a, r)}${a.hot ? '　告急' : ''}${a.march ? `　行军往${a.march.to}${a.march.blocked ? `，为${a.march.blocked.army}所阻（敌驻${a.march.blocked.at}）` : ''}` : ''}`);
      pin.line = `${r.name}　${rough ? '驻军' : list.length > 1 ? `${lead.name}等${num(list.length)}部` : lead.name}　${rough ? roughCount(total) : shortCount(total)}${hot ? '　告急' : ''}`;
      tiao(el, () => (pin.absorbed.length ? stackTip(pin)
        : rough ? { title: `${r.name} · 驻军`, text: `约${roughCount(total)}人\n本地所见，不知其番号、主将与确数` }
        : { title: `${r.name} · ${list.length > 1 ? `${num(list.length)}部` : lead.name}`, text: lines.join('\n') }));
      els.push(el);
      pins.push(Object.assign(pin, { el }));
      for (const a of list) {
        if (!a.march) continue;
        // 逐块行军的令沿实际路线画（现在这块 → 余下要经的各块 → 去处）；受阻的只画到与挡路那块的交界、线头一道横杠、线不流动
        //   （画到挡路那块的中心，横杠正压在敌旗底下看不见）。旧令没有路线的照旧从此处到去处画一道弧
        const way = (a.march.path || []).map((id) => regionOf([id], false)).filter(Boolean);
        const stop = a.march.blocked && regionOf([a.march.blocked.regionId], false);
        const to = stop || (way.length ? way[way.length - 1] : (a.march.toIds && a.march.toIds.length && regionOf(a.march.toIds, a.march.toIds.length > 2)) || placeOf(a.march.to));
        if (!to || to === r) continue;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'mk-route' + (stop ? ' blocked' : ''));
        path.setAttribute('marker-end', stop ? 'url(#mk-stop)' : 'url(#mk-arrow)');
        const pts = stop ? [r.center, [(r.center[0] + to.center[0]) / 2, (r.center[1] + to.center[1]) / 2]]
          : way.length < 2 ? [r.center, to.center] : [r.center].concat(way.filter((x, i) => i > 0 || x !== r).map((x) => x.center));
        routes.push({ path, pts, arc: !stop && way.length < 2 });
      }
    }
    // 别家之军：照那一家在舆图上的底色插旗、旗顶铁色（本方金顶朱旗），所知之律定画不画——知其确数的旗上番号字、牌上兵数，
    //   悬停列番号与主将；只知大概的旗上无字、牌上只写数千数万。同一家、同一档的才并作一堆；点了翻谱牒里那一家。
    //   叠旗先让本方：别家之军排在本方之后，同处撞上了由它让开。
    //   只落内核绑定的地块，不按地名约略认——后金「辽东·辽西诸卫」的归附部按地名会落到山海关，像是敌兵到了关下
    const see = sightOfFoes ? sightOfFoes() : null;
    const foesAt = new Map();
    for (const a of see ? foes : []) {
      const r = a.site && regionOf(a.site.ids, a.site.area);
      const k = r && see(r);
      if (!k) continue;
      const fac = a.factionKey || a.faction || '?';
      const key = `${k}|${fac}|${r.id || r.name}`;
      if (!foesAt.has(key)) foesAt.set(key, { r, rough: k === 'rough', fac, name: a.faction || '别家', list: [] });
      foesAt.get(key).list.push(a);
    }
    for (const { r, rough, fac, name, list } of foesAt.values()) {
      const total = list.reduce((s, a) => s + (a.soldiers || 0), 0);
      const lead = list.slice().sort((a, b) => (b.soldiers || 0) - (a.soldiers || 0))[0];
      const n = h('span.mk-n'), c = h('em.mk-c');
      const pin = { kind: (rough ? 'foe~' : 'foe:') + fac, rough, foe: name, x: r.center[0], y: r.center[1], place: r.name, total, count: list.length, weight: total - 1e9, n, c, absorbed: [], sig: null };
      const el = h('button.mk.mk-army.mk-foe.' + tierOf(total) + (rough ? '.dim' : '') + (lead.naval ? '.navy' : '') + (!rough && lead.vacant ? '.vacant' : ''), { type: 'button', 'aria-label': `${r.name}${name}之军`, '--mk-fc': inkOf(map, fac), onclick: () => onFoe && onFoe(fac) },
        h('i.mk-pole'), h('i.mk-flag2'), h('b.mk-flag', rough ? '' : markOf(lead)), n, c);
      const lines = list.map((a) => `${a.name}　${num(a.soldiers)}人${a.commander ? '　' + a.commander : ''}${about(a, r)}`);
      pin.line = rough ? `${r.name}　${name}之军约${roughCount(total)}` : `${r.name}　${name}·${list.length > 1 ? `${lead.name}等${num(list.length)}部` : lead.name}　${shortCount(total)}`;
      tiao(el, () => (pin.absorbed.length ? stackTip(pin)
        : rough ? { title: `${r.name} · ${name}之军`, text: `约${roughCount(total)}人\n传闻所及，不知其番号、主将与确数` }
        : { title: `${r.name} · ${name}${list.length > 1 ? `${num(list.length)}部` : ''}`, text: lines.join('\n') }));
      els.push(el);
      pins.push(Object.assign(pin, { el }));
    }
    // 民变：各股落在所在州（认法同诸军），一处一面墨旗（旗上仍写「寇」）——旗下记众、旗角记几股，悬停逐股列首领、众与能战之数
    const rebelsAt = new Map();
    for (const rb of rebels) {
      const r = placeOf(rb.place);
      if (!r || !knows({ rebel: rb, region: r })) continue;
      if (!rebelsAt.has(r.name)) rebelsAt.set(r.name, { r, list: [] });
      rebelsAt.get(r.name).list.push(rb);
    }
    const bandLine = (rb) => `${rb.leader}　${rb.place}　众${shortCount(rb.followers)}${rb.army ? `　能战${shortCount(rb.soldiers)}${rb.routed ? '（已溃）' : ''}` : ''}`;
    for (const { r, list } of rebelsAt.values()) {
      const total = list.reduce((s, rb) => s + rb.followers, 0), one = list.length === 1 ? list[0] : null;
      const n = h('span.mk-n'), c = h('em.mk-c');
      const pin = { kind: 'rebel', x: r.center[0] + 4, y: r.center[1] + 3, place: r.name, total, count: list.length, weight: 5e8 + total, n, c, absorbed: [], sig: null,
        line: list.map(bandLine).join('\n') };
      const el = h('button.mk.mk-army.mk-rebel.' + tierOf(total), { type: 'button', 'aria-label': `${r.name}民变`, onclick: () => onRebels() },
        h('i.mk-pole'), h('i.mk-flag2'), h('b.mk-flag', '寇'), n, c);
      tiao(el, () => (pin.absorbed.length ? stackTip(pin)
        : one ? { title: `${one.leader} · ${one.place}`, text: [`众约${num(one.followers)}人`, one.army ? `能战${num(one.soldiers)}（${one.army}${one.routed ? '，已溃' : ''}）` : '', one.since ? `起于${one.since}` : '', one.cause ? `起因：${one.cause}` : ''].filter(Boolean).join('\n') }
        : { title: `${r.name} · 民变${num(list.length)}股`, text: pin.line }));
      els.push(el);
      pins.push(Object.assign(pin, { el }));
    }
    // 交战：一枚战字圆章
    for (const b of battles) {
      const r = placeOf(b.location);
      if (!r || !knows({ battle: b, region: r })) continue;
      const el = h('button.mk.mk-battle', { type: 'button', 'aria-label': `${r.name}交战`, onclick: () => onArmy(null) }, h('b', '战'));
      tiao(el, () => ({ title: `${r.name} · ${b.phase || '交战'}`, text: [b.attacker, b.defender].filter(Boolean).join(' 对 ') }));
      els.push(el);
      pins.push({ el, kind: 'battle', x: r.center[0] - 4, y: r.center[1] - 2, weight: 2e9 });
    }
    pins.sort((a, b) => b.weight - a.weight);      // 叠旗时先占位的：交战、告急的、民变，再按兵多寡
    replaceChildren(marks, els);
    for (const c of [...svg.querySelectorAll('.mk-route')]) c.remove();
    for (const rt of routes) svg.append(rt.path);
    if (previewPts) svg.append(previewPath);
  }

  // 每帧摆位：旗杆脚落在治所上；镜头后面、出了屏的藏起来。远看（全图）旗小一号；天下一档（.far）小旗收起兵数牌。
  //   上下挨着的旗，屏上靠上的压在前（--mk-z）：下面那面的旗杆、旗角往上伸，原先会遮住上面那面的兵数牌（天启开局太原的旗角遮了大同的「三万五」）
  let shown = true, far = null;
  // 根字号随窗宽变（流式 rem）：量一次，窗口变了再量，不每帧读样式
  let rem = 16;
  const measureRem = () => { rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16; };
  measureRem();
  addEventListener('resize', measureRem);
  map.onFrame(() => {
    const live = isLive();
    if (live !== shown) { shown = live; layer.classList.toggle('off', !live); }
    if (!live) return;
    const dist = map.pose().dist;
    layer.style.setProperty('--mk-s', Math.max(0.72, Math.min(1, 900 / dist)).toFixed(3));
    const isFar = map.tier === 'realm';
    if (isFar !== far) { far = isFar; layer.classList.toggle('far', isFar); }
    const W = innerWidth, H = innerHeight;
    // 叠旗（照 CK3 远看时诸军并作一堆）：屏上挨得太近的同类旗，先占位的一面留着、并下邻旗——兵数记总、旗角记几部、悬停逐处列；镜头拉近散开各归其处
    const s = Math.max(0.72, Math.min(1, 900 / dist));
    const gx = 4 * rem * s, gy = 4.3 * rem * s;            // 横看兵数牌宽、竖看旗杆连牌高（大旗杆高一成半，原先 3.8 时相州的牌压着开封的大旗）
    const kept = [];
    for (const p of pins) {
      const [sx, sy] = map.worldToScreen(p.x, p.y);
      const out = !(sx > -40 && sx < W + 40 && sy > -40 && sy < H + 60);
      const host = out || p.kind === 'battle' ? null : kept.find((k) => k.kind === p.kind && Math.abs(k.ox - sx) < gx && Math.abs(k.sy - sy) < gy);
      let x = sx;
      if (host) host.absorbed.push(p);
      else if (!out && p.kind !== 'battle') {
        // 别类的旗（本方与别家、别家与别家）同处撞上了：后摆的往右让开大半面旗宽，至多让两回
        for (let t = 0; t < 2 && kept.some((k) => k.kind !== p.kind && Math.abs(k.sx - x) < gx * 0.75 && Math.abs(k.sy - sy) < gy * 0.6); t++) x += gx * 0.75;
        p.ox = sx; p.sx = x; p.sy = sy; p.absorbed = []; kept.push(p);
      }
      const hide = out || !!host;
      p.el.style.visibility = hide ? 'hidden' : '';
      if (!hide) {
        p.el.style.transform = `translate(${x.toFixed(1)}px, ${sy.toFixed(1)}px)`;
        const z = (p.kind === 'battle' ? 6000 : 3000) - Math.round(sy);
        if (z !== p.z) { p.z = z; p.el.style.setProperty('--mk-z', String(z)); }
      }
    }
    for (const k of kept) paintStack(k);
    for (const rt of routes) drawRoute(rt.path, rt.pts, rt.arc);
    if (previewPts) drawRoute(previewPath, previewPts, false);
  });

  // 镜头背后的点投出来会翻到画面另一头（拉近看辽东时，往贵阳的路线斜穿整幅）：只画镜头前连着的几截
  function drawRoute(el, pts, arc) {
    const runs = [];
    let run = [];
    for (const c of pts) {
      const [x, y, behind] = map.worldToScreen(c[0], c[1]);
      if (behind) { if (run.length) runs.push(run); run = []; } else run.push([x, y - 6]);
    }
    if (run.length) runs.push(run);
    el.setAttribute('d', runs.filter((p) => p.length >= 2).map((p) => routeD(p, arc)).join(' '));
  }
  // 一截行军线的 path：两点的弧一点（旧令中点往左手偏开两成；受阻的不弧，直指挡路那块）；
  //   多点的沿路走——过各块治所两两连线的中点连二次曲线，线穿过各块而不在治所上折角
  function routeD(p, arc) {
    const f = (q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`;
    if (arc || p.length < 3) {
      const a = p[0], b = p[p.length - 1], k = arc ? 0.2 : 0;
      return `M${f(a)} Q${f([(a[0] + b[0]) / 2 - (b[1] - a[1]) * k, (a[1] + b[1]) / 2 + (b[0] - a[0]) * k])} ${f(b)}`;
    }
    let d = `M${f(p[0])}`;
    for (let i = 1; i < p.length - 1; i++) d += ` Q${f(p[i])} ${f([(p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2])}`;
    return `${d} L${f(p[p.length - 1])}`;
  }

  // 一面旗（或一堆）的兵数牌与旗角：成员变了才重写
  function paintStack(p) {
    const all = [p, ...p.absorbed];
    const sig = all.map((q) => q.place).join('|');
    if (sig === p.sig) return;
    p.sig = sig;
    const total = all.reduce((t, q) => t + q.total, 0), count = all.reduce((t, q) => t + q.count, 0);
    p.n.textContent = p.rough ? roughCount(total) : shortCount(total);
    p.c.textContent = count > 1 && !p.rough ? num(count) : '';
    p.c.hidden = !p.c.textContent;
    p.el.classList.toggle('stack', all.length > 1);
    const tier = tierOf(total);
    for (const t of ['t1', 't2', 't3']) p.el.classList.toggle(t, t === tier);
  }
  function stackTip(p) {
    const all = [p, ...p.absorbed];
    const total = all.reduce((t, q) => t + q.total, 0);
    const head = p.kind === 'rebel' ? `民变${num(all.reduce((t, q) => t + q.count, 0))}股` : p.foe ? `${p.foe}之军${num(all.length)}处` : `${num(all.length)}处驻军`;
    return { title: `${head} · 合${p.rough ? '约' + roughCount(total) : shortCount(total)}`, text: all.map((q) => q.line).join('\n') + '\n镜头拉近即各归其处' };
  }

  return { refresh, preview };
}

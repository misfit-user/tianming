// 舆图标记（照 CK3 图上的军队与事态标记）：本方诸军一处一面军旗（旗上番号首字、旗下兵数，告急朱边闪），
// 行军的画一道虚线箭头指向去处；民变各股所在一处一面墨旗；交战处一枚「战」字圆章。DOM 层，每帧跟着镜头摆位，压在舆图题名之上、界面之下。
// 看得见哪些由调用方定（knows：所知之律——通用一套只见本人所统与所掌辖区内的）：返回 'exact' 知其确数，'rough' 只见其大概
// （无官之人在本籍亲见驻军，只知数百、数千、数万），假则不画。
import { h, replaceChildren } from '../core/dom.js';
import { num, numeralStyle, cnNum } from '../core/numerals.js';
import { tiao } from '../kit/index.js';

// 兵数写短：一万八、三万二、五千六、八百（阿拉伯数字时 1.8万）
export function shortCount(n) {
  n = Math.max(0, Math.round(Number(n) || 0));
  if (numeralStyle() === 'arabic') return n >= 1e4 ? `${(n / 1e4).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '')}万` : String(n);
  // 九千九百五十起，千位四舍五入就进到一万，归「万」这一档写「一万」，不写「十千」（晚唐银州军九千九百余人原先就写成十千）
  if (n >= 9950) { const k = Math.round(n / 1e3), a = Math.floor(k / 10), b = k % 10; return `${cnNum(a)}万${b ? cnNum(b) : ''}`; }
  if (n >= 1e3) { const k = Math.round(n / 100), a = Math.floor(k / 10), b = k % 10; return `${cnNum(a)}千${b ? cnNum(b) : ''}`; }
  return cnNum(Math.round(n / 10) * 10) || '〇';
}
// 只见其大概：数百、千余、数千、万余、数万、十余万
export function roughCount(n) {
  n = Math.max(0, Number(n) || 0);
  return n < 1000 ? '数百' : n < 2000 ? '千余' : n < 10000 ? '数千' : n < 20000 ? '万余' : n < 100000 ? '数万' : '十余万';
}
// 番号取一个字上旗，同一衙门、同一路下的几军要分得开：
//   无「·」的去掉京城、御营之类的冠称取头一字（关宁军 → 关、御营右军 → 右）；
//   有「·」的取末段头一字（京营·神机营 → 神、荆湖·岳飞部 → 岳、宁远副总兵·祖氏家丁 → 祖），八旗取旗色（后金·两黄旗 → 黄）；
//   末段是正兵、残部、总览这类泛称的仍取前段（东京留守司·正兵 → 东）
function flagChar(name) {
  const parts = String(name || '军').replace(/[（(][^）)]*[）)]/g, '').split('·').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return '军';
  const last = parts[parts.length - 1];
  const banner = /^(?:两|正|镶)?([黄红白蓝])旗/.exec(last);   // 八旗取旗色：两黄旗、正白旗、镶蓝旗
  if (banner) return banner[1];
  if (parts.length > 1 && !/^(正|残|总|余|本|全|诸)/.test(last)) return [...last][0];
  return [...parts[0].replace(/^(南京|北京|御营)(?=..)/, '')][0] || '军';
}

// 落点：诸军读内核绑定的地块（军上的 site：一块，或粗区、两可的几块候选），regionOf(候选, 是否一片) 挑一块；
//   绑不上的、民变、交战按地名认：placeOf(地名) → 舆图上的府州（先问内核，再按 model/place.js；书案镜头落点同一份）。旗落其治所
export function createMapMarks({ layer, map, game, isLive, placeOf, regionOf, knows, onArmy, onRebels }) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'mk-routes');
  svg.innerHTML = '<defs><marker id="mk-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 L3,5 z" fill="#a3281b"/></marker></defs>';
  const marks = h('div.mk-pins');
  layer.append(svg, marks);
  let pins = [], routes = [];

  function refresh() {
    let rows = [], rebels = [], battles = [];
    try { rows = game.army.roster().groups.flatMap((g) => g.rows); } catch (_e) { rows = []; }
    try { rebels = game.army.rebels(); } catch (_e) { rebels = []; }
    try { battles = game.army.battles().active; } catch (_e) { battles = []; }
    // 诸军按所在府州归堆：一处一面旗
    const byPlace = new Map();
    for (const a of rows) {
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
      const pin = { kind: rough ? 'rough' : 'army', x: r.center[0], y: r.center[1], place: r.name, total, count: list.length, weight: (hot ? 1e9 : 0) + total, n, c, absorbed: [], sig: null };
      const el = h('button.mk.mk-army' + (hot ? '.hot' : '') + (marching ? '.march' : '') + (rough ? '.rough' : ''), { type: 'button', 'aria-label': `${r.name}驻军`,
        onclick: rough ? null : () => onArmy(pin.absorbed.length ? null : lead.key) },
        h('i.mk-pole'), h('i.mk-flag2'), h('b.mk-flag', rough ? '兵' : flagChar(lead.name)), n, c);
      const lines = list.map((a) => `${a.name}　${num(a.soldiers)}人${a.commander ? '　' + a.commander : '　缺帅'}${about(a, r)}${a.hot ? '　告急' : ''}${a.march ? `　行军往${a.march.to}` : ''}`);
      pin.line = `${r.name}　${rough ? '驻军' : list.length > 1 ? `${lead.name}等${num(list.length)}部` : lead.name}　${rough ? roughCount(total) : shortCount(total)}${hot ? '　告急' : ''}`;
      tiao(el, () => (pin.absorbed.length ? stackTip(pin)
        : rough ? { title: `${r.name} · 驻军`, text: `约${roughCount(total)}人\n本地所见，不知其番号、主将与确数` }
        : { title: `${r.name} · ${list.length > 1 ? `${num(list.length)}部` : lead.name}`, text: lines.join('\n') }));
      els.push(el);
      pins.push(Object.assign(pin, { el }));
      for (const a of list) {
        if (!a.march) continue;
        const to = (a.march.toIds && a.march.toIds.length && regionOf(a.march.toIds, a.march.toIds.length > 2)) || placeOf(a.march.to);
        if (!to || to === r) continue;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'mk-route');
        path.setAttribute('marker-end', 'url(#mk-arrow)');
        routes.push({ path, from: r.center, to: to.center });
      }
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
      const el = h('button.mk.mk-army.mk-rebel', { type: 'button', 'aria-label': `${r.name}民变`, onclick: () => onRebels() },
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
  }

  // 每帧摆位：旗杆脚落在治所上；镜头后面、出了屏的藏起来。远看（全图）旗小一号
  let shown = true;
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
    const W = innerWidth, H = innerHeight;
    // 叠旗（照 CK3 远看时诸军并作一堆）：屏上挨得太近的同类旗，先占位的一面留着、并下邻旗——兵数记总、旗角记几部、悬停逐处列；镜头拉近散开各归其处
    const s = Math.max(0.72, Math.min(1, 900 / dist));
    const gx = 4 * rem * s, gy = 3.8 * rem * s;            // 横看兵数牌宽、竖看旗杆连牌高
    const kept = [];
    for (const p of pins) {
      const [sx, sy] = map.worldToScreen(p.x, p.y);
      const out = !(sx > -40 && sx < W + 40 && sy > -40 && sy < H + 60);
      const host = out || p.kind === 'battle' ? null : kept.find((k) => k.kind === p.kind && Math.abs(k.sx - sx) < gx && Math.abs(k.sy - sy) < gy);
      if (host) host.absorbed.push(p);
      else if (!out && p.kind !== 'battle') { p.sx = sx; p.sy = sy; p.absorbed = []; kept.push(p); }
      const hide = out || !!host;
      p.el.style.visibility = hide ? 'hidden' : '';
      if (!hide) p.el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
    }
    for (const k of kept) paintStack(k);
    for (const rt of routes) {
      const [ax, ay] = map.worldToScreen(rt.from[0], rt.from[1]);
      const [bx, by] = map.worldToScreen(rt.to[0], rt.to[1]);
      // 弧一点：中点往左手偏开两成
      const mx = (ax + bx) / 2, my = (ay + by) / 2, dx = bx - ax, dy = by - ay;
      const cx = mx - dy * 0.2, cy = my + dx * 0.2;
      rt.path.setAttribute('d', `M${ax.toFixed(1)},${(ay - 6).toFixed(1)} Q${cx.toFixed(1)},${(cy - 6).toFixed(1)} ${bx.toFixed(1)},${(by - 6).toFixed(1)}`);
    }
  });

  // 一面旗（或一堆）的兵数牌与旗角：成员变了才重写
  function paintStack(p) {
    const all = [p, ...p.absorbed];
    const sig = all.map((q) => q.place).join('|');
    if (sig === p.sig) return;
    p.sig = sig;
    const total = all.reduce((t, q) => t + q.total, 0), count = all.reduce((t, q) => t + q.count, 0);
    p.n.textContent = p.kind === 'rough' ? roughCount(total) : shortCount(total);
    p.c.textContent = count > 1 && p.kind !== 'rough' ? num(count) : '';
    p.c.hidden = !p.c.textContent;
    p.el.classList.toggle('stack', all.length > 1);
  }
  function stackTip(p) {
    const all = [p, ...p.absorbed];
    const total = all.reduce((t, q) => t + q.total, 0);
    const head = p.kind === 'rebel' ? `民变${num(all.reduce((t, q) => t + q.count, 0))}股` : `${num(all.length)}处驻军`;
    return { title: `${head} · 合${p.kind === 'rough' ? roughCount(total) : shortCount(total)}`, text: all.map((q) => q.line).join('\n') + '\n镜头拉近即各归其处' };
  }

  return { refresh };
}

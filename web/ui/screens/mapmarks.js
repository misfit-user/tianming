// 舆图标记（照 CK3 图上的军队与事态标记）：本方诸军一处一面军旗（旗上番号首字、旗下兵数，告急朱边闪），
// 行军的画一道虚线箭头指向去处；流寇一面墨旗；交战处一枚「战」字圆章。DOM 层，每帧跟着镜头摆位，压在舆图题名之上、界面之下。
// 看得见哪些由调用方定（knows：所知之律——通用一套只见本人所统与所掌辖区内的）。
import { h, replaceChildren } from '../core/dom.js';
import { num, numeralStyle, cnNum } from '../core/numerals.js';
import { tiao } from '../kit/index.js';

// 兵数写短：一万八、三万二、五千六、八百（阿拉伯数字时 1.8万）
export function shortCount(n) {
  n = Math.max(0, Math.round(Number(n) || 0));
  if (numeralStyle() === 'arabic') return n >= 1e4 ? `${(n / 1e4).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '')}万` : String(n);
  if (n >= 1e4) { const k = Math.round(n / 1e3), a = Math.floor(k / 10), b = k % 10; return `${cnNum(a)}万${b ? cnNum(b) : ''}`; }
  if (n >= 1e3) { const k = Math.round(n / 100), a = Math.floor(k / 10), b = k % 10; return `${cnNum(a)}千${b ? cnNum(b) : ''}`; }
  return cnNum(Math.round(n / 10) * 10) || '〇';
}
// 番号取一个字上旗：去掉「京营」「镇军」之类的通名，取头一字（关宁军 → 关、延绥镇军 → 延）
const flagChar = (name) => [...String(name || '军').replace(/^(南京|北京)/, '')][0] || '军';

export function createMapMarks({ layer, map, game, isLive, regionsOf, capitalOf = () => null, knows, onArmy, onRebels }) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'mk-routes');
  svg.innerHTML = '<defs><marker id="mk-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 L3,5 z" fill="#a3281b"/></marker></defs>';
  const marks = h('div.mk-pins');
  layer.append(svg, marks);
  let pins = [], routes = [];

  // 地名 → 舆图上的落点（府州治所）：全名、或以之开头、或拆开的某一段（「山东·登州」先试登州；打头那段多是省名，只认全名）。
  // 京师、北京落到京城；南京落到应天府
  const ALIAS = { 南京: '应天府' };
  function placeOf(text) {
    const list = regionsOf();
    const t = String(text || '');
    if (/^(京师|京城|北京)/.test(t) && capitalOf()) return capitalOf();
    const segs = t.split(/[·・,，\s→>-]+/).filter(Boolean);
    const tries = [t, ...segs.slice(1).reverse()].map((x) => ALIAS[x] || x);
    for (const seg of tries) {
      const r = list.find((x) => x.name === seg) || list.find((x) => x.name && (seg.startsWith(x.name) || (seg.length >= 2 && x.name.startsWith(seg))));
      if (r) return r;
    }
    const head = ALIAS[segs[0]] || segs[0];
    return (head && segs.length > 1 && list.find((x) => x.name === head || x.name === head + '府')) || null;
  }

  function refresh() {
    let rows = [], rebels = [], battles = [];
    try { rows = game.army.roster().groups.flatMap((g) => g.rows); } catch (_e) { rows = []; }
    try { rebels = game.army.rebels(); } catch (_e) { rebels = []; }
    try { battles = game.army.battles().active; } catch (_e) { battles = []; }
    // 诸军按所在府州归堆：一处一面旗
    const byPlace = new Map();
    for (const a of rows) {
      const r = placeOf(a.location);
      if (!r || !knows({ army: a, region: r })) continue;
      if (!byPlace.has(r.name)) byPlace.set(r.name, { r, list: [] });
      byPlace.get(r.name).list.push(a);
    }
    pins = [];
    routes = [];
    const els = [];
    for (const { r, list } of byPlace.values()) {
      const total = list.reduce((s, a) => s + (a.soldiers || 0), 0);
      const lead = list.slice().sort((a, b) => (b.soldiers || 0) - (a.soldiers || 0))[0];
      const hot = list.some((a) => a.hot), marching = list.some((a) => a.march);
      const el = h('button.mk.mk-army' + (hot ? '.hot' : '') + (marching ? '.march' : ''), { type: 'button', 'aria-label': `${r.name}驻军`, onclick: () => onArmy(lead.key) },
        h('i.mk-pole'), h('b.mk-flag', flagChar(lead.name)), h('span.mk-n', shortCount(total)), list.length > 1 ? h('em.mk-c', num(list.length)) : null);
      tiao(el, () => ({ title: `${r.name} · ${list.length > 1 ? `${num(list.length)}部` : lead.name}`,
        text: list.map((a) => `${a.name}　${num(a.soldiers)}人${a.commander ? '　' + a.commander : '　缺帅'}${a.hot ? '　告急' : ''}${a.march ? `　行军往${a.march.to}` : ''}`).join('\n') }));
      els.push(el);
      pins.push({ el, x: r.center[0], y: r.center[1] });
      for (const a of list) {
        if (!a.march) continue;
        const to = placeOf(a.march.to);
        if (!to || to === r) continue;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'mk-route');
        path.setAttribute('marker-end', 'url(#mk-arrow)');
        routes.push({ path, from: r.center, to: to.center });
      }
    }
    // 流寇：所在头一处一面墨旗
    for (const rb of rebels) {
      const r = rb.regions.map(placeOf).find(Boolean);
      if (!r || !knows({ rebel: rb, region: r })) continue;
      const el = h('button.mk.mk-army.mk-rebel', { type: 'button', 'aria-label': rb.name, onclick: () => onRebels() },
        h('i.mk-pole'), h('b.mk-flag', '寇'), h('span.mk-n', shortCount(rb.strength)));
      tiao(el, () => ({ title: `${rb.name} · ${rb.tier}`, text: `约${num(rb.strength)}人\n出没：${rb.regions.join('、')}` }));
      els.push(el);
      pins.push({ el, x: r.center[0] + 4, y: r.center[1] + 3 });
    }
    // 交战：一枚战字圆章
    for (const b of battles) {
      const r = placeOf(b.location);
      if (!r || !knows({ battle: b, region: r })) continue;
      const el = h('button.mk.mk-battle', { type: 'button', 'aria-label': `${r.name}交战`, onclick: () => onArmy(null) }, h('b', '战'));
      tiao(el, () => ({ title: `${r.name} · ${b.phase || '交战'}`, text: [b.attacker, b.defender].filter(Boolean).join(' 对 ') }));
      els.push(el);
      pins.push({ el, x: r.center[0] - 4, y: r.center[1] - 2, battle: true });
    }
    replaceChildren(marks, els);
    for (const c of [...svg.querySelectorAll('.mk-route')]) c.remove();
    for (const rt of routes) svg.append(rt.path);
  }

  // 每帧摆位：旗杆脚落在治所上；镜头后面、出了屏的藏起来。远看（全图）旗小一号
  let shown = true;
  map.onFrame(() => {
    const live = isLive();
    if (live !== shown) { shown = live; layer.classList.toggle('off', !live); }
    if (!live) return;
    const dist = map.pose().dist;
    layer.style.setProperty('--mk-s', Math.max(0.72, Math.min(1, 900 / dist)).toFixed(3));
    const W = innerWidth, H = innerHeight;
    for (const p of pins) {
      const [sx, sy] = map.worldToScreen(p.x, p.y);
      const out = !(sx > -40 && sx < W + 40 && sy > -40 && sy < H + 60);
      p.el.style.visibility = out ? 'hidden' : '';
      if (!out) p.el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
    }
    for (const rt of routes) {
      const [ax, ay] = map.worldToScreen(rt.from[0], rt.from[1]);
      const [bx, by] = map.worldToScreen(rt.to[0], rt.to[1]);
      // 弧一点：中点往左手偏开两成
      const mx = (ax + bx) / 2, my = (ay + by) / 2, dx = bx - ax, dy = by - ay;
      const cx = mx - dy * 0.2, cy = my + dx * 0.2;
      rt.path.setAttribute('d', `M${ax.toFixed(1)},${(ay - 6).toFixed(1)} Q${cx.toFixed(1)},${(cy - 6).toFixed(1)} ${bx.toFixed(1)},${(by - 6).toFixed(1)}`);
    }
  });

  return { refresh };
}

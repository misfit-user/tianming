// 战事三卷（御驾亲征开启时，推演的会战阶段由内核逐场等玩家）：请旨（亲征，或委之而定方略）、会战战报（可当场补员）、他方战事旁观。
// 老遮罩由 adapter/battle.js 认领、挪到画外；这里画新卷，所选转点老按钮。卷都不许随手收：请旨必择其一，战报以「整编归伍」收，旁观以「散朝」收。
// 内核在等这一卷，回合推演悬着——别处换场收卷（closeScrolls）时，卷若非所选而收，就再展开一次。
// 战场页（亲征时那一场实时战斗）是另一个世界，照旧铺满全屏，不在此画。
import { h, replaceChildren } from '../core/dom.js';
import { bus } from '../core/bus.js';
import { num, roundSig } from '../core/numerals.js';
import { juan } from '../kit/index.js';

const toast = (text) => bus.emit('kernel:toast', { text });
const FATE = { 全身而退: 'safe', 负伤: 'hurt', 被俘: 'lost', 阵殁: 'lost', 溃走: 'hurt' };

export function createBattle({ game }) {
  const open = new Map();         // 老遮罩 id → 当下的卷
  const act = (f) => { try { f(); } catch (e) { toast(e.message); } };
  // 展一卷并守着：非「ok」而收（被别处收掉）且老遮罩仍在，就再展
  function keep(id, make) {
    const j = make();
    open.set(id, j);
    j.closed.then((reason) => { if (reason !== 'ok' && open.get(id) === j) keep(id, make); });
    return j;
  }
  const settle = (id) => { const j = open.get(id); open.delete(id); return j; };

  // ---------- 请旨 ----------
  bus.on('battle:ask', (q) => {
    const C = game.battle.CHOICES;
    const odds = Math.max(0, Math.min(100, q.odds || 0));
    const tone = odds >= 70 ? 'up' : odds <= 30 ? 'down' : 'even';
    // 战力是庙算的估数，取两位（「三万零九百八十四」在窄卷里折成两行，也无须精到个位）
    const side = (label, s, cls) => h('div.bt-side.' + cls, h('small', label), h('b', `${num(s.men)}众`), h('span', `战力约${num(roundSig(s.power, 2))}`));
    const pick = (i) => { const j = settle(q.id); if (j) j.close('ok'); act(() => q.pick(i)); };
    keep(q.id, () => juan({ title: `兵临${q.where || '前线'}`, note: '请旨', width: '34rem', closable: false,
      content: h('div.bt-ask',
        h('div.bt-sides', side('我军', q.us, 'us'), h('i', '对'), side('敌军', q.them, 'them')),
        h('div.bt-odds.' + tone, h('span', '庙算把握'), h('div.meter', h('u', { style: { width: `${odds}%` } })), h('b', `${num(odds)}%`), h('em', q.situation || '')),
        h('button.bt-main', { type: 'button', onclick: () => pick(0) }, h('b', C[0][0]), h('small', C[0][1])),
        h('div.bt-delegate', C.slice(1).map(([name, note], k) => h('button', { type: 'button', onclick: () => pick(k + 1) }, h('b', name), h('small', note.replace(/^委之偏裨[：，]?/, '')))))) }));
  });

  // 补员一钮：内核写「募兵补员 +1275（银2550·粮1275）」，拆成名目、可补几人、所费，数照记数设置写
  function fillEl(f, onclick) {
    const m = f.label.match(/^(.+?)\s*\+(\d+)\s*[（(](.*?)[）)]$/);
    if (!m) return h('button', { type: 'button', disabled: f.disabled, onclick }, f.label.replace(/\d+/g, (d) => num(+d)));
    const cost = m[3].replace(/银(\d+)/, (_, v) => `银${num(+v)}两`).replace(/粮(\d+)/, (_, v) => `粮${num(+v)}石`);
    return h('button', { type: 'button', disabled: f.disabled, onclick }, h('b', m[1]), h('span', +m[2] ? `+${num(+m[2])}人` : '无可补'), h('small', cost));
  }

  // ---------- 会战战报（补员会改写，同 id 再来即就地重画）----------
  const last = new Map();
  function reportBody(q) {
    return h('div.bt-report', q.rows.map((r, i) => h('section.bt-army' + (r.destroyed ? '.gone' : ''),
      h('header', h('b', r.name), r.destroyed ? h('em.lost', '全军覆没') : [h('span', `损${num(r.loss)}`), h('span', `余${num(r.soldiers)}`), h('span', `历练${num(r.vet)}`)]),
      r.fate ? h('p.bt-fate.' + (FATE[r.fate.outcome] || 'safe'), `主将${r.fate.name}　${r.fate.outcome}`) : null,
      r.fills.length || r.gap || r.full ? h('div.bt-fill', r.fills.map((f, k) => fillEl(f, () => act(() => q.fill(i, k)))),
        h('small', r.full ? '已补齐' : r.gap ? `缺员${num(r.gap)}` : '')) : null)));
  }
  bus.on('battle:report', (q) => {
    const seen = last.get(q.id);
    last.set(q.id, q);
    if (seen) { const j = open.get(q.id); if (j) replaceChildren(j.el.querySelector('.bt-host'), reportBody(q)); return; }
    keep(q.id, () => juan({ title: '会战战报', note: '整编归伍', width: '34rem', closable: false, content: h('div.bt-host', reportBody(last.get(q.id))),
      actions: [{ label: '整编归伍', onclick: () => { const j = settle(q.id); if (j) j.close('ok'); act(() => last.get(q.id).done()); } }] }));
  });

  // ---------- 他方战事旁观 ----------
  bus.on('battle:observe', (q) => {
    const go = (f) => { const j = settle(q.id); if (j) j.close('ok'); act(f); };
    keep(q.id, () => juan({ title: '他方战事', note: '可遣人观之，观之不改其果', width: '32rem', closable: false,
      content: h('div.bt-observe', q.rows.map((t, i) => h('div.bt-obs', h('span', t), h('button.q-yapai', { type: 'button', onclick: () => go(() => q.watch(i)) }, '旁观')))),
      actions: [{ label: '散朝', onclick: () => go(() => q.done()) }] }));
  });

  // 内核自己收了（或已开战场）：卷随之收
  bus.on('battle:closed', ({ id }) => {
    last.delete(id);
    const j = settle(id);
    if (j) j.close('ok');
  });
}

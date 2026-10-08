// 战事（御驾亲征开启时）：回合推演的会战阶段，内核 tm-battle-turn.js 的 runPending 逐场等玩家——
//   请旨（promptCombatChoice：亲征，或委之而定方略主攻／持重／速决）→ 亲征则开战场页（tm-battle-embed.js，#tm-battle-overlay 里一个 iframe）
//   → 会战战报（showBattleReport：各军损、余、历练、主将命运，可当场补员）→ 他方战事旁观（_offerObserve，可遣人观之）。
// 这三张卷都是闭包里现搭的无 id 全屏遮罩（z 2147483500），换不掉函数；照老办法认领：认出后挪到画外（不移出 body，按钮照点），
// 读其文字发 battle:* 事件由 screens/battle.js 画成新卷，玩家所选转点老按钮。补员会改写战报行，盯住该遮罩，变了再发一次。
// 战场页是另一个世界（自带画面与操作），#tm-battle-overlay 只认领不挪——挪进新前端根节点会让 iframe 重载。
import { bus } from '../core/bus.js';
import { claimOverlays } from './kernel.js';

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const int = (s) => { const m = /-?\d+/.exec(String(s || '')); return m ? Number(m[0]) : 0; };
let seq = 0;

export const CHOICES = [['亲征', '御驾亲征，会参其事，亲操此战'], ['委之·主攻', '委之偏裨，庙算决之：主攻更决定性'], ['委之·持重', '委之偏裨：持重以保实力'], ['委之·速决', '委之偏裨：速决，胜负起伏大']];
const KIND = [[/兵\s*临/, 'ask'], [/会战战报/, 'report'], [/他方战事/, 'observe']];
const kindOf = (n) => { const t = n.textContent || ''; const k = KIND.find(([re]) => re.test(t)); return k ? k[1] : ''; };
const isPrompt = (n) => n.tagName === 'DIV' && n.style && n.style.position === 'fixed' && n.style.zIndex === '2147483500' && !!kindOf(n);

function hideAway(n) {
  n.style.transform = 'translateX(-300vw)';
  n.style.opacity = '0';
  n.style.pointerEvents = 'none';
}
const buttons = (n) => [...n.querySelectorAll('button')];
const press = (n, b) => { if (!n.isConnected) throw new Error('此卷已收'); if (!b || b.disabled) throw new Error('不可'); b.click(); };

// 请旨：兵临何处、彼此兵力战力、庙算把握与局势；按钮依次为亲征、委之主攻、持重、速决
function readAsk(n) {
  const box = n.firstElementChild || n;
  const rows = [...box.children];
  const where = clean(rows[0] && rows[0].textContent).replace(/^\W*兵\s*临\s*/, '');
  const spans = rows[1] ? [...rows[1].querySelectorAll('span')] : [];
  const side = (s) => { const t = clean(s && s.textContent); return { men: int((/(\d+)\s*众/.exec(t) || [])[1]), power: int((/战力\s*(-?\d+)/.exec(t) || [])[1]) }; };
  const odds = clean(rows[2] && rows[2].textContent);
  return { where, us: side(spans[0]), them: side(spans[1]), odds: int((/(\d+)\s*%/.exec(odds) || [])[1]), situation: (/局势\s*(\S+)/.exec(odds) || [])[1] || '' };
}
// 战报：每军一行（名、损、余、历练、全军覆没、主将命运），可补员者行下两钮与「缺员」
function readReport(n) {
  const box = n.firstElementChild || n;
  const rows = [...box.children].filter((d) => d.tagName === 'DIV' && d.querySelector('b') && !/会战战报/.test(d.textContent));
  return rows.map((r) => {
    const name = clean(r.querySelector('b') && r.querySelector('b').textContent);
    const body = clean(r.querySelector('[data-rb]') && r.querySelector('[data-rb]').textContent);
    const fateM = /主将\s*(\S+?)：(全身而退|负伤|被俘|阵殁|溃走)/.exec(clean(r.textContent));
    const bs = buttons(r).filter((b) => b.style.display !== 'none');
    const info = clean([...r.querySelectorAll('span')].pop() && [...r.querySelectorAll('span')].pop().textContent);
    return {
      name, destroyed: /全军覆没/.test(body), loss: int((/损\s*(\d+)/.exec(body) || [])[1]), soldiers: int((/余\s*(\d+)/.exec(body) || [])[1]), vet: int((/历练\s*(\d+)/.exec(body) || [])[1]),
      fate: fateM ? { name: fateM[1], outcome: fateM[2] } : null,
      fills: bs.map((b) => ({ label: clean(b.textContent), disabled: !!b.disabled })), gap: /缺员/.test(info) ? int(info) : 0, full: /已补齐/.test(info)
    };
  });
}
function readObserve(n) {
  const box = n.firstElementChild || n;
  return [...box.children].filter((d) => d.tagName === 'DIV' && d.querySelector('span') && d.querySelector('button')).map((d) => clean(d.querySelector('span').textContent));
}

claimOverlays((n) => {
  if (n.id === 'tm-battle-overlay') return true;      // 战场页：只认领，不挪
  if (!isPrompt(n)) return false;
  const kind = kindOf(n);
  const id = ++seq;
  hideAway(n);
  const gone = () => !n.isConnected;
  if (kind === 'ask') {
    bus.emit('battle:ask', { id, ...readAsk(n), pick: (i) => press(n, buttons(n)[i]) });
  } else if (kind === 'report') {
    const send = () => bus.emit('battle:report', { id, rows: readReport(n),
      fill: (row, which) => { const r = [...(n.firstElementChild || n).children].filter((d) => d.tagName === 'DIV' && d.querySelector('b') && !/会战战报/.test(d.textContent))[row];
        const bs = r ? buttons(r).filter((b) => b.style.display !== 'none') : [];
        press(n, bs[which]); },
      done: () => press(n, buttons(n).pop()) });
    send();
    const mo = new MutationObserver(() => { if (gone()) { mo.disconnect(); return; } send(); });
    mo.observe(n, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['disabled', 'style'] });
  } else if (kind === 'observe') {
    const bs = buttons(n);
    bus.emit('battle:observe', { id, rows: readObserve(n), watch: (i) => press(n, bs[i]), done: () => press(n, bs[bs.length - 1]) });
  }
  // 内核自己收卷（选定、整编、散朝）后告知画面
  const mo2 = new MutationObserver(() => { if (gone()) { mo2.disconnect(); bus.emit('battle:closed', { id }); } });
  mo2.observe(document.body, { childList: true });
  return true;
});

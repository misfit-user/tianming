// 展卷对话框：一幅手卷，两根轴先并在中间，展开时各回两边，卷心由中线向两边展开。
// const j = juan({ title, note, content, actions: [{ label, primary, onclick }], width });
// await j.closed（关卷时 resolve，带关闭原因）；j.close(reason)
// side：靠边的阅读卷（邸报之类）——卷上只记一笔 .side，摆在哪由界面的样式定（舆图为家时靠右、不压暗，见 screens/atlas.css）；
// 确认、择选这类要人回话的卷不带，照旧居中压暗
import { h, overlayHost } from '../../core/dom.js';
import { yapai } from './controls.js';

const stack = [];

export function juan({ title, note, content, actions = [], width = '46rem', height, closable = true, onclose, side = false } = {}) {
  const foot = [
    ...actions.map((a) => yapai(a.label, { onclick: () => a.onclick?.({ close }) })),
    closable ? h('span.close', yapai('收卷', { onclick: () => close('dismiss') })) : null
  ].filter(Boolean);
  const body = h('div.body', { style: { width, height } },
    h('div.tiantou', h('h2', title), note ? h('small', note) : null),
    h('div.xin', h('div.content.q-scroll.ink', content), foot.length ? h('footer', foot) : null));
  const scroll = h('div.q-juan', { role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, h('div.axis.l'), body, h('div.axis.r'));
  const veil = h('div.q-juan-veil' + (side ? '.side' : ''), scroll);
  let resolveClosed;
  const closed = new Promise((r) => { resolveClosed = r; });
  let done = false;

  function close(reason = 'close') {
    if (done) return;
    done = true;
    veil.classList.remove('open');
    const i = stack.indexOf(api);
    if (i >= 0) stack.splice(i, 1);
    const ms = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--t-4')) || 800;
    setTimeout(() => { veil.remove(); onclose?.(reason); resolveClosed(reason); }, ms);
  }

  veil.addEventListener('pointerdown', (e) => { if (e.target === veil && closable) close('dismiss'); });
  overlayHost().append(veil);
  // 两轴起始并在中线：各自向中间挪半个卷心宽
  scroll.style.setProperty('--juan-half', `${body.getBoundingClientRect().width / 2}px`);
  requestAnimationFrame(() => requestAnimationFrame(() => veil.classList.add('open')));

  const api = { el: veil, body, close, closed, closable, side };
  stack.push(api);
  return api;
}

// Esc 收最上面那一卷
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !stack.length) return;
  const top = stack[stack.length - 1];
  if (top.closable) {
    e.stopPropagation();
    top.close('dismiss');
  }
}, true);

export function openScrolls() {
  return stack.length;
}

// 收起靠边的阅读卷（右边另开一扇时用）
export function closeSideScrolls() {
  for (const j of [...stack]) if (j.side) j.close('dismiss');
}

// 收起此刻展着的各卷（换场时用，如朝议开场时收掉案头的时政卷）；keep 里的不收
export function closeScrolls(keep = []) {
  for (const j of [...stack]) if (!keep.includes(j)) j.close('sync');
}

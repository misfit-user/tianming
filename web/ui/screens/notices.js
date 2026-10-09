// 急报与驻留提示：内核的全屏急报（人物死亡、开战、亡国……）展一卷，须点「知道了」才收，收时照原样执行内核的回调
// （例如缺密钥时去开典章）；驻留提示走提示条。急报的收语取身份档（元首档「朕已知晓」）。
import { h } from '../core/dom.js';
import { bus } from '../core/bus.js';
import { juan } from '../kit/index.js';
import { pendingStorageAlarm } from '../adapter/kernel.js';

export function installNotices({ game, profile }) {
  game.on('kernel:urgent', (u) => {
    const ack = (profile() && profile().urgentAck) || '知道了';
    juan({
      title: u.title || '急报', note: '急报', width: '34rem', closable: false,
      content: h('p', { style: { margin: 0, lineHeight: 2, whiteSpace: 'pre-wrap' } }, u.detail || ''),
      actions: [{ label: ack, onclick: ({ close }) => { close('ok'); u.confirm(); } }]
    });
  });
  game.on('kernel:notice', (n) => { if (n.text) bus.emit('kernel:toast', { text: n.text }); });
  // 本机存储不可用（桌面版）：存档已暂停，须让玩家看见；「重试并重新载入」转点内核横幅上的钮
  let storageShown = false;
  const storage = (s) => {
    if (!s || storageShown) return;
    storageShown = true;
    const j = juan({
      title: s.title, note: '急报', width: '34rem',
      content: h('p', { style: { margin: 0, lineHeight: 2, whiteSpace: 'pre-wrap' } }, s.detail),
      actions: [{ label: '重试并重新载入', onclick: ({ close }) => { close('ok'); s.retry(); } }]
    });
    j.closed.then(() => { storageShown = false; });
  };
  game.on('kernel:storage', storage);
  storage(pendingStorageAlarm());
}

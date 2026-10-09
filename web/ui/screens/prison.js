// 狱中问对：召对下狱之人时，先一卷说明罪名、羁押、探问次数，问是否亲往；入狱后一卷——左列六动作（各标代价），
// 右列问答实录，卷底自由对话。有代价的动作先问一句。一切经 game.prison（adapter/prison.js 镜内核 tm-wendui-prison.js）。
// 叫法：君上一方取 profile().audience（「上」「曰」），其余取 profile().prison，缺则用通名。
import { h, replaceChildren } from '../core/dom.js';
import { bus } from '../core/bus.js';
import { num } from '../core/numerals.js';
import { juan } from '../kit/index.js';

const toast = (text) => bus.emit('kernel:toast', { text });
const signed = (v) => `${v > 0 ? '+' : '−'}${num(Math.abs(v))}`;
const heldText = (n) => (n > 0 ? `已${num(n)}回合` : '本回合下狱');
// 内核动作说明里的半角括号、间隔点换成中文的
const prose = (t) => String(t || '').replace(/·/g, '，').replace(/\s*\(([^)]*)\)/g, '（$1）');

export function createPrison({ game, profile }) {
  const R = game.prison;
  const T = () => ({ title: '诏狱', go: '亲往探问', leave: '退出', ...(profile() && profile().prison) });
  const A = () => (profile() && profile().audience) || { me: '上', ask: '曰', reply: '对曰', send: '问', hint: '' };
  let j = null;
  let actsBox, logBox, ta, sendBtn, headBox;

  function costs(a) {
    const e = a.effects;
    return [a.energy ? `精力${signed(-a.energy)}` : '', e.minxin ? `民心${signed(e.minxin)}` : '', e.huangwei ? `威望${signed(e.huangwei)}` : '',
      e.loyalty ? `忠诚${signed(e.loyalty)}` : '', e.health ? `体魄${signed(e.health)}` : ''].filter(Boolean).join(' · ');
  }

  // ---------- 赴狱前 ----------
  bus.on('prison:prompt', (p) => {
    const rows = [['罪名', p.reason], ['羁押', heldText(p.held)], ['体魄', `${num(p.health)} / ${num(100)}`],
      ['探问', `本回合已${num(p.visitsTurn)}次（至多两次）· 累计${num(p.visitsTotal)}次${p.visitsTotal >= 4 ? '（满五次朝中将有非议）' : ''}`]];
    juan({
      title: T().title, note: p.name, width: '32rem',
      content: h('div.pr-prompt',
        h('p', `${p.name}目下身陷囹圄，不便召对。可亲往探问，或鸿雁传书。`),
        h('dl', rows.map(([k, v]) => [h('dt', k), h('dd', v)]))),
      actions: [{ label: T().go, primary: true, onclick: ({ close }) => { close('ok'); p.proceed(); } }]
    });
  });

  // ---------- 狱中 ----------
  bus.on('prison:open', () => open());
  bus.on('prison:changed', () => render());
  bus.on('prison:closed', () => { if (j) { const x = j; j = null; x.close('gone'); } });

  function open() {
    if (j) return render();
    headBox = h('div.pr-head');
    actsBox = h('div.pr-acts');
    logBox = h('div.pr-log.q-scroll');
    ta = h('textarea.pr-ta', { rows: 2, placeholder: '对其说些什么……（Ctrl+Enter 送出；也可作下列动作的旁白）' });
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); say(); } });
    sendBtn = h('button.q-yapai', { type: 'button', onclick: () => say() }, A().send || '问');
    const s = R.session();
    j = juan({
      title: T().title, note: s ? s.name : '', width: '58rem', height: 'min(44rem, 86vh)',
      content: h('div.pr', headBox, h('div.pr-body', actsBox, logBox), h('div.pr-say', ta, sendBtn)),
      onclose: (why) => { if (why !== 'gone') { j = null; R.leave(); } }
    });
    render();
    setTimeout(() => ta.focus(), 60);
  }

  function render() {
    if (!j) return;
    const s = R.session();
    if (!s) return;
    replaceChildren(headBox,
      h('span', h('b', '罪名'), s.reason), h('span', h('b', '羁押'), heldText(s.held)),
      h('span', h('b', '体魄'), `${num(s.health)}`), h('span', h('b', '本回合探问'), `${num(s.visitsTurn)} / ${num(2)}`));
    replaceChildren(actsBox, s.acts.map((a) => h('button.pr-act' + (a.confirm ? '.grave' : ''), { type: 'button', disabled: s.waiting, onclick: () => act(a, s) },
      h('b', a.label), h('small', prose(a.desc)), h('em', costs(a)))));
    const me = A();
    replaceChildren(logBox, s.log.length
      ? s.log.map((x) => x.role === 'sovereign'
          ? h('p.pr-me', h('b', `${me.me}${me.ask}：`), x.text)
          : x.role === 'prisoner'
            ? h('p.pr-them', h('b', `${s.name}${me.reply || '曰'}：`), x.text)
            : h('p.pr-note', `〔${x.tag || '记'}〕${x.text}`))
      : h('p.pr-note', '（可自由对话，或选左列一事）'));
    if (s.waiting) logBox.append(h('p.pr-wait', `${s.name}……`));
    logBox.scrollTop = logBox.scrollHeight;
    sendBtn.disabled = s.waiting;
  }

  function say() {
    const text = ta.value.trim();
    if (!text) return toast('先写下要说的话');
    if (R.act('chat', text)) ta.value = '';
  }
  async function act(a, s) {
    if (a.confirm) {
      const ok = await new Promise((resolve) => {
        let yes = false;
        const c = juan({
          title: `${a.label}${s.name}`, width: '28rem',
          content: h('div.pr-prompt', h('p', prose(a.desc)), h('p.pr-cost', `影响：${costs(a)}`), a.release ? h('p', '此后其人出狱。') : null),
          actions: [{ label: a.label, primary: true, onclick: ({ close }) => { yes = true; close('ok'); } }]
        });
        c.closed.then(() => resolve(yes));
      });
      if (!ok) return;
    }
    if (R.act(a.key, ta.value.trim())) ta.value = '';
  }

  return { get opened() { return !!j; } };
}

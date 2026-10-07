// 时政：案头那一托盘花笺（元首一档即御案时政）。展一卷花笺清册——待决、省览、已决；点一张展其详卷，
// 看详情、关涉之人与势力、风势推演、史馆旧案，拍板（内核可能先请 AI 据国势裁定后果，故有「裁断中」）。
// 召对群臣、独召密问要等朝议、问对两页接上。名目取身份档 issues。
import { h, replaceChildren } from '../core/dom.js';
import { bus } from '../core/bus.js';
import { num } from '../core/numerals.js';
import { juan } from '../kit/index.js';

const GROUPS = [['open', '待决'], ['info', '省览'], ['done', '已决']];

export function createIssues({ game, profile, onConvene }) {
  let listBody = null;

  function card(it) {
    const stamp = it.group === 'open' ? '待决' : it.group === 'info' ? '省览' : '已决';
    const desc = it.description.length > 70 ? it.description.slice(0, 70) + '……' : it.description;
    return h('button.iss-card.' + it.group, { type: 'button', onclick: () => openOne(it.id) },
      h('i.stamp', stamp),
      h('b', it.title),
      h('small', [it.raised, it.category].filter(Boolean).join(' · ')),
      h('p', desc));
  }

  function renderList() {
    if (!listBody) return;
    const all = game.select.issueList();
    const by = Object.fromEntries(GROUPS.map(([g]) => [g, all.filter((i) => i.group === g)]));
    if (!all.length) {
      replaceChildren(listBody, h('div.iss-empty', profile().issues.empty));
      return;
    }
    replaceChildren(listBody,
      h('div.iss-count', GROUPS.filter(([g]) => by[g].length).map(([g, label]) => `${label}${num(by[g].length)}`).join(' · ')),
      GROUPS.filter(([g]) => by[g].length).map(([g, label]) => h('section.iss-group',
        h('h4', label),
        h('div.iss-grid', by[g].map(card)))));
  }

  function open() {
    listBody = h('div.iss-list');
    renderList();
    const j = juan({ title: profile().issues.title, note: '案头花笺', width: '62rem', height: 'min(46rem, 84vh)', content: listBody });
    const off = game.on('game:changed', (e) => { if (!e || e.what === 'issue') renderList(); });
    j.closed.then(() => { off(); listBody = null; });
    return j;
  }

  function openOne(id) {
    const it = game.select.issueList().find((i) => i.id === id);
    if (!it) { bus.emit('kernel:toast', { text: '议题已失效' }); return; }
    const t = profile().issues;
    const sec = (label, ...body) => h('section.iss-sec', h('h5', `〔 ${label} 〕`), ...body);
    const choiceBtns = it.choices.map((c) => h('button.iss-choice', { type: 'button', onclick: () => choose(c) }, h('b', c.text), c.desc ? h('small', c.desc) : null));
    const busy = h('div.iss-busy', { hidden: true }, '裁断中……');
    const content = h('div.iss-detail',
      it.legacyRelief ? h('p.iss-warn', '旧版独立试验案，仅保留历史数据；本页不再提供独立立案、拨款或撤止。请先核对原流水，勿重复支付。') : null,
      h('div.iss-desc', it.description),
      it.narrative ? sec('详情', h('div.iss-text', it.narrative)) : null,
      it.chars.length || it.factions.length ? h('div.iss-links',
        it.chars.length ? sec(t.people, h('div.iss-tags', it.chars.map((n) => h('span', n)))) : null,
        it.factions.length ? sec('牵动势力', h('div.iss-tags.fac', it.factions.map((n) => h('span', n)))) : null) : null,
      it.consequences.length ? sec('风势推演', it.consequences.map(([k, v]) => h('p.iss-conseq', h('b', k + '：'), v))) : null,
      it.history ? sec('史馆旧案', h('div.iss-text.history', it.history)) : null,
      it.chosen ? sec(t.chosen, h('div.iss-chosen', it.chosen)) : null,
      it.group === 'open' && it.choices.length ? sec(t.decide, h('div.iss-choices', choiceBtns), busy) : null,
      it.resolvedOn ? h('div.iss-when', `· 于 ${it.resolvedOn} 议决 ·`) : null);
    const meta = [it.raised, it.category, it.severity, it.region ? '影响·' + it.region : ''].filter(Boolean).join(' · ');
    const later = (label) => () => juan({ title: label, width: '28rem', content: h('p', { style: { margin: 0, lineHeight: 2 } }, '朝议、问对两页随后接上；眼下可先在此拍板。') });
    const j = juan({
      title: it.title, note: meta, width: '50rem', height: 'min(44rem, 84vh)', content,
      actions: it.group === 'open' ? [{ label: t.convene, onclick: onConvene ? ({ close }) => { close('ok'); onConvene(it.id); } : later(t.convene) }, { label: t.secret, onclick: later(t.secret) }] : []
    });

    async function choose(c) {
      choiceBtns.forEach((b) => { b.disabled = true; });
      choiceBtns[c.index]?.classList.add('picked');
      busy.hidden = false;
      let r;
      try {
        r = await game.act.issue(it.id, c.index);
      } catch (err) {
        r = { ok: false, code: String(err && err.message || err) };
      }
      busy.hidden = true;
      if (r && r.ok === false) {
        choiceBtns.forEach((b) => { b.disabled = false; b.classList.remove('picked'); });
        bus.emit('kernel:toast', { text: `未能决断（${r.code || '内核未受理'}）` });
        return;
      }
      j.close('ok');
      bus.emit('kernel:toast', { text: `${t.chosen}：${c.text}` });
    }
  }

  return { open, openOne };
}

// 典章：三卷——推演之器（主 API、次要 API、生图 API：服务商预设、拉取模型、思考、体检、存之）、画面声音、玩法开关。
// 新前端自己的偏好（画质、记数、动效）存本机；AI 与玩法经适配层 game.config 写内核（照老面板的存法，不经老 DOM）。
import { h, replaceChildren } from '../core/dom.js';
import { bus } from '../core/bus.js';
import { num } from '../core/numerals.js';
import { juan, qianzi, kaiguan, chi } from '../kit/index.js';
import { getSetting, setSetting } from '../core/settings.js';
import { quality } from '../core/quality.js';
import { game } from '../adapter/game.js';

const THINK_PROTOCOLS = [['auto', '自动识别'], ['openai', 'OpenAI · reasoning_effort'], ['deepseek', 'DeepSeek · thinking'], ['qwen', 'Qwen · enable_thinking'],
  ['openrouter', 'OpenRouter · reasoning'], ['gemini', 'Gemini · thinking_config'], ['anthropic', 'Claude 原生 · thinking']];
const TIERS = [['primary', '主 API'], ['secondary', '次要 API'], ['image', '生图 API']];
const toast = (text) => bus.emit('kernel:toast', { text });

export function openSettings({ tab = 'ai' } = {}) {
  const cfg = game.config;
  const body = h('div.st');
  const tabs = h('div.st-tabs');
  let current = tab;
  let tier = 'primary';

  function renderTabs() {
    replaceChildren(tabs, [['ai', '推演之器'], ['infer', '推演之法'], ['view', '画面声音'], ['play', '玩法']].map(([k, label]) =>
      h('button' + (k === current ? '.on' : ''), { type: 'button', onclick: () => { current = k; renderTabs(); render(); } }, label)));
  }
  function render() {
    if (current === 'ai') replaceChildren(body, aiPane());
    else if (current === 'view') replaceChildren(body, viewPane());
    else if (current === 'infer') replaceChildren(body, inferPane());
    else replaceChildren(body, playPane());
  }

  // ---------- 一行：左题右件，件下一行小注 ----------
  const row = (label, control, note) => h('div.st-row', h('label', label), h('div', control, note ? h('small.st-note', note) : null));
  const input = (value, { type = 'text', placeholder = '', width } = {}) => h('input.st-in', { type, value: value ?? '', placeholder, spellcheck: false, autocomplete: 'off', style: width ? { width } : null });

  // ---------- 推演之器 ----------
  function aiPane() {
    const seg = h('div.st-seg', TIERS.map(([k, label]) => h('button' + (k === tier ? '.on' : ''), { type: 'button', onclick: () => { tier = k; render(); } }, label)));
    return h('div', seg, tier === 'image' ? imageForm() : apiForm(tier));
  }

  function apiForm(t) {
    const c = cfg.aiConfig(t);
    const ps = cfg.presets();
    const hint = h('small.st-note');
    const url = input(c.url, { placeholder: 'https://…/v1' });
    const prov = h('select.st-in', { onchange: () => {
      const p = ps.find((x) => x.id === prov.value);
      if (!p) return;
      if (p.url) url.value = p.url;
      hint.textContent = [p.keyHint && `Key 去这里拿：${p.keyHint}`, p.modelHint || (p.model && `Model_ID 参考：${p.model}`)].filter(Boolean).join('；');
    } }, h('option', { value: '' }, '择一家（只填地址）'), ps.map((p) => h('option', { value: p.id }, p.name)));
    const key = input(c.key, { type: 'password', placeholder: '密钥' });
    const show = h('button.st-mini', { type: 'button', onclick: () => { key.type = key.type === 'password' ? 'text' : 'password'; show.textContent = key.type === 'password' ? '显' : '隐'; } }, '显');
    const model = input(c.model, { placeholder: 'Model_ID' });
    const models = h('div.st-models');
    const pull = h('button.st-mini', { type: 'button', onclick: async () => {
      pull.disabled = true;
      pull.textContent = '拉取中…';
      try {
        const r = await cfg.listModels({ url: url.value, key: key.value, model: model.value });
        replaceChildren(models, r.models.length
          ? r.models.map((m) => h('button' + (m === model.value ? '.on' : ''), { type: 'button', onclick: () => { model.value = m; replaceChildren(models); } }, m))
          : [h('small.st-note', '接口返回空列表')]);
      } catch (e) { replaceChildren(models, h('small.st-note.bad', e.message || String(e))); }
      pull.disabled = false;
      pull.textContent = '拉取模型';
    } }, '拉取模型');
    let think = c.thinking;
    const proto = h('select.st-in', { disabled: think == null }, THINK_PROTOCOLS.map(([v, label]) => h('option', { value: v, selected: v === c.thinkingProtocol }, label)));
    const thinkSel = qianzi([{ value: 'default', label: '默认' }, { value: 'on', label: '开' }, { value: 'off', label: '关' }],
      { value: think == null ? 'default' : think ? 'on' : 'off', onchange: (v) => { think = v === 'default' ? null : v === 'on'; proto.disabled = think == null; } });
    const temp = input(c.temp, { type: 'number', width: '5rem' });
    const mem = input(c.mem, { type: 'number', width: '5rem' });
    const ctx = input(c.contextK || '', { type: 'number', width: '6rem', placeholder: '自动' });
    const enabled = t === 'secondary' ? kaiguan('启用（关则一律走主 API）', { checked: c.enabled }) : null;
    const status = h('div.st-status');
    const draft = () => ({ url: url.value, key: key.value, model: model.value, provider: prov.value || c.provider, thinking: think, thinkingProtocol: proto.value,
      temp: temp.value, mem: mem.value, contextK: ctx.value, enabled: enabled ? enabled.querySelector('input').checked : true });
    const test = h('button.q-yapai', { type: 'button', onclick: async () => {
      test.disabled = true;
      replaceChildren(status, h('small.st-note', '体检中……'));
      const r = await cfg.testAi(t, draft(), (m) => replaceChildren(status, h('small.st-note', m)));
      test.disabled = false;
      replaceChildren(status, r.ok ? report(r) : h('small.st-note.bad', '✕ ' + r.error));
    } }, '体检');
    const save = h('button.q-yapai.go', { type: 'button', onclick: () => {
      const d = draft();
      const r = cfg.saveAi(t, d);
      toast(r.ok ? (t === 'secondary' && !d.key && !d.url && !d.model ? '已清空次要 API，回退主 API' : `${t === 'secondary' ? '次要' : '主'} API 已存`) : r.error);
    } }, '存之');
    return h('div.st-form',
      h('p.st-lead', t === 'secondary' ? '次要 API 承担问对、朝议等小调用，可用更快更省的模型；不填则一律走主 API。' : '推演、来文、史记都靠这一路。填好先「体检」，看评语再「存之」。'),
      row('服务商', prov), hint,
      row('地址', url),
      row('Key', h('div.st-inline', key, show)),
      row('Model_ID', h('div.st-inline', model, pull)), models,
      row('思考', h('div.st-inline', thinkSel, proto), '默认即不添思考参数；需服务商支持所选协议。'),
      t === 'primary' ? row('温度', h('div.st-inline', temp, h('small.st-note', '记忆'), mem, h('small.st-note', '上下文（K，空为自动）'), ctx)) : null,
      enabled ? row('', enabled) : null,
      h('div.st-acts', test, save), status);
  }

  // 体检报告：评语、几项通否、上下文与输出上限、提醒
  function report(r) {
    const chip = (ok, label) => h('span.' + (ok ? 'ok' : 'no'), (ok ? '✓ ' : '✕ ') + label);
    const v = r.verdict;
    return h('div.st-report' + (v ? '.g' + v.grade : ''),
      v ? h('b', v.label) : null,
      h('div.st-chips', chip(true, `连通 ${num(r.latencyMs)} 毫秒`), chip(r.stream, '流式'), chip(r.json, '严格 JSON'),
        chip(r.echo !== 'mismatch', r.echo === 'match' ? '模型回声相符' : r.echo === 'mismatch' ? '模型回声不符（疑中转换了模型）' : '模型回声未详'), chip(r.usageSeen, '用量回报')),
      h('small.st-note', [r.ctxK ? `上下文约 ${num(r.ctxK)}K（${r.ctxSource}）` : '上下文未测出', r.outTok ? `输出上限约 ${num(Math.round(r.outTok / 1024))}K` : ''].filter(Boolean).join('　')),
      v && v.notes.length ? h('ul', v.notes.map((n) => h('li', n))) : null,
      r.warnings.length ? h('ul.warn', r.warnings.map((n) => h('li', n))) : null);
  }

  function imageForm() {
    const c = cfg.imageConfig();
    const url = input(c.url, { placeholder: '服务商基址或完整生图端点' });
    const key = input(c.key, { type: 'password', placeholder: '空则沿用主 API 的 Key' });
    const model = input(c.model, { placeholder: 'dall-e-3' });
    const status = h('div.st-status');
    const d = () => ({ url: url.value, key: key.value, model: model.value });
    const test = async () => {
      replaceChildren(status, h('small.st-note', '体检中……'));
      const r = await cfg.testImage(d());
      replaceChildren(status, h('small.st-note' + (r.ok ? '' : '.bad'), (r.ok ? '✓ ' + r.text : '✕ ' + r.error) + (r.endpoint ? `（端点：${r.endpoint}）` : '')));
    };
    return h('div.st-form',
      h('p.st-lead', '人物立绘等生图用。不出图也能体检：故意用极小尺寸去请求，服务商以尺寸不合拒绝即证明已通，不计费。'),
      row('地址', url), row('Key', key), row('Model_ID', model),
      h('div.st-acts',
        h('button.q-yapai', { type: 'button', onclick: test }, '体检'),
        h('button.q-yapai.go', { type: 'button', onclick: () => { const r = cfg.saveImage(d()); toast(r.ok ? '生图 API 已存' : r.error); } }, '存之')),
      status);
  }

  // ---------- 画面声音 ----------
  function viewPane() {
    const q = quality();
    const tierSel = qianzi([{ value: 'auto', label: '自定' }, { value: 'high', label: '上' }, { value: 'medium', label: '中' }, { value: 'low', label: '下' }],
      { value: getSetting('quality'), onchange: (v) => setSetting('quality', v) });
    const a = cfg.audio();
    const vol = (value, key) => chi({ min: 0, max: 100, step: 1, value, format: (v) => num(Math.round(v)), onchange: (v) => cfg.setAudio({ [key]: v }) });
    return h('div.st-form',
      row('画质', tierSel, `本机测为「${{ high: '上', medium: '中', low: '下' }[q.detected.tier]}」档（${q.detected.reason}）。改档下次启动生效。`),
      row('字号', qianzi([{ value: 'std', label: '标准' }, { value: 'large', label: '大' }, { value: 'xlarge', label: '特大' }],
        { value: getSetting('textSize'), onchange: (v) => setSetting('textSize', v) }), '正文字号。小屏上已自动放到看得清，仍嫌小可再放大。'),
      row('记数', kaiguan('汉字记数（关则用阿拉伯数字）', { checked: getSetting('numerals') !== 'arabic', onchange: (on) => setSetting('numerals', on ? 'cn' : 'arabic') })),
      row('动效', kaiguan('少动效（只留淡入淡出）', { checked: getSetting('motion') === 'less', onchange: (on) => setSetting('motion', on ? 'less' : 'full') })),
      row('显示', qianzi([{ value: 'fs', label: '全屏' }, { value: 'win', label: '窗口' }], { value: cfg.fullscreen() ? 'fs' : 'win', onchange: (v) => cfg.setFullscreen(v === 'fs') }), '偏好存本机。'),
      a ? row('殿乐', h('div.st-inline', kaiguan('', { checked: a.music, onchange: (on) => cfg.setAudio({ music: on }) }), vol(a.musicVolume, 'musicVolume'))) : null,
      a ? row('曲库', musicBox(), '点曲名即奏；导入之曲存本机，可移除。') : null,
      a ? row('音效', h('div.st-inline', kaiguan('', { checked: a.sound, onchange: (on) => cfg.setAudio({ sound: on }) }), vol(a.soundVolume, 'soundVolume'))) : null);
  }

  // 曲库：循环之法、导入；曲目一行一首，当前所奏标朱
  function musicBox() {
    const box = h('div.st-music');
    const pick = () => {
      const inp = h('input', { type: 'file', accept: 'audio/*', multiple: true });
      inp.addEventListener('change', async () => { await cfg.importMusic(inp.files); draw(); });
      inp.click();
    };
    function draw() {
      const pl = cfg.playlist();
      if (!pl) { replaceChildren(box, h('small.st-note', '曲库未就绪')); return; }
      replaceChildren(box,
        h('div.st-inline', qianzi([{ value: 'sequence', label: '顺序' }, { value: 'single', label: '单曲' }, { value: 'random', label: '随机' }], { value: pl.loop, onchange: (v) => cfg.setLoop(v) }),
          h('button.q-yapai', { type: 'button', onclick: pick }, '导入乐曲')),
        pl.tracks.length ? h('ol.st-tracks', pl.tracks.map((t) => h('li' + (t.id === pl.current ? '.on' : ''),
          h('button', { type: 'button', title: '奏此曲', onclick: () => { cfg.playTrack(t.id); draw(); } }, t.title, t.meta ? h('small', t.meta) : null),
          t.user ? h('button.del', { type: 'button', title: '移除此导入之曲', onclick: () => { cfg.removeTrack(t.id); draw(); } }, '去') : null)))
          : h('small.st-note', '曲库无曲'));
    }
    draw();
    return box;
  }

  // ---------- 推演之法 ----------
  // 随改随存（写 P.conf），作用于此后的推演
  function inferPane() {
    const s = cfg.inference();
    const set = (key, value) => { try { cfg.setInference(key, value); } catch (e) { toast(e.message); } };
    const pick = (key, items) => qianzi(items.map(([value, label]) => ({ value, label })), { value: s[key], onchange: (v) => set(key, v) });
    const numIn = (key, label, note) => {
      const el = input(String(s.nums[key]), { type: 'number', width: '6rem' });
      el.addEventListener('change', () => { set(key, el.value); el.value = String(cfg.inference().nums[key]); });
      return h('label.st-num', h('span', label), el, note ? h('small', note) : null);
    };
    const custom = h('textarea.st-in.st-ta', { rows: 2, placeholder: '另述文风，如：仿《资治通鉴》笔法，简括凝重' });
    custom.value = s.customStyle;
    custom.addEventListener('change', () => set('customStyle', custom.value));
    const verbs = [['concise', '精简'], ['standard', '标准'], ['detailed', '详尽']];
    if (s.verbosity === 'custom') verbs.push(['custom', '自定义']);
    return h('div.st-form',
      h('p.st-lead', '诸项随改随存，作用于此后的推演。'),
      row('文风', pick('style', cfg.STYLES.map((x) => [x, x])), '推演叙事的笔调。'),
      row('自定文风', custom, '留空则只用上面所选。'),
      row('难度', pick('difficulty', [['narrative', '叙事·温和'], ['standard', '标准'], ['hardcore', '硬核']])),
      row('模式', pick('gameMode', [['yanyi', '演义'], ['light_hist', '轻度史实'], ['strict_hist', '严格史实']]), '严格史实下奏报会失真，须查访方知实情。'),
      row('推演深度', pick('aiCallDepth', [['full', '完整'], ['standard', '标准'], ['lite', '精简']]), '完整每回合约十八次调用；标准约十四次（合并后续推演）；精简约十次（略去部分人物后续推演）。越精简越省，所知越少。'),
      row('篇幅', pick('verbosity', verbs), '实录、时政记、文书、问对等的长短：精简约六成、详尽约一倍半。'),
      row('省道长官', h('div.st-inline', kaiguan('履职', { checked: s.governor, onchange: (on) => set('governor', on) }), pick('governorStrength', [['light', '轻'], ['normal', '中'], ['strong', '强']])),
        '各道主官的称职与失职只作用本道，离驻地越远越弱。力度：执行率每月至多变动一个半、三、六个百分点。'),
      h('details.st-more',
        h('summary', '细项（记忆、读取、预算）'),
        row('回合读取', h('div.st-nums', numIn('qijuLookback', '起居注'), numIn('shijiLookback', '史记')), '推演时回看最近几回合的起居注与史记。'),
        row('记忆容量', h('div.st-nums', numIn('memoryAnchorKeep', '记忆锚点'), numIn('memoryArchiveKeep', '年代归档'), numIn('characterArcKeep', '角色弧线'),
          numIn('playerDecisionKeep', '决策记录'), numIn('chronicleKeep', '叙事记忆'), numIn('convKeep', '对话历史')), '超过所设回合数的记忆压缩为年代摘要。'),
        row('预算档位', h('div.st-nums', numIn('turnTokenBudget', '每回合预算', '零为不限'), numIn('contextSizeK', '上下文（K）', '零为自动'), numIn('maxOutputTokens', '输出上限', '零为自动')),
          '预算超支只示警、不阻断。上下文、输出上限留零则按模型探测。'),
        row('模型档位', pick('modelTier', [['auto', '自动'], ['high', '高'], ['medium', '中'], ['low', '低']]), '手动指定时按此裁剪结构化输出。')));
  }

  // ---------- 玩法 ----------
  function playPane() {
    return h('div.st-form',
      h('p.st-lead', '诸开关随点随存，作用于此后的推演。标「实验」者尚在试行。'),
      cfg.toggles().map((g) => h('section.st-group', h('h5', g.group),
        h('div.st-toggles', g.rows.map((r) => kaiguan(r.label, { checked: r.on, onchange: (on) => { try { cfg.setToggle(r.key, on); } catch (e) { toast(e.message); } } }))))));
  }

  renderTabs();
  render();
  return juan({ title: '典章', note: '规制条例', width: '58rem', height: 'min(46rem, 86vh)', content: h('div.st-wrap', tabs, body) });
}

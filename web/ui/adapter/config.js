// 典章（设置）的内核接口：AI 连接（主、次、生图）、体检、拉取模型、玩法开关、音量。
// 存法照老面板（tm-patches.js 的 sSaveAPI、sSaveSecondaryAPI、_sSaveImgAPI、_togglePConf），但不经老 DOM：
// 直接写 P.ai／P.conf，本机 localStorage「tm_api」「tm_api_image」，再 saveP()。写前先问存储可写否（TM_SaveDB.assertWritable）。
const w = window;
const Pj = () => w.P || {};
const conf = () => { const p = Pj(); p.conf = p.conf || {}; return p.conf; };

function writableError() {
  try { if (w.TM_SaveDB && typeof w.TM_SaveDB.assertWritable === 'function') w.TM_SaveDB.assertWritable(); return ''; } catch (e) { return e.message || String(e); }
}
function persistAi() {
  const text = JSON.stringify(Pj().ai);
  localStorage.setItem('tm_api', text);
  if (localStorage.getItem('tm_api') !== text) throw new Error('配置写后回读不一致');
  try { if (typeof w.tmApplyInsecureTlsConfig === 'function') w.tmApplyInsecureTlsConfig(); } catch (_e) { /* 放行白名单刷新失败不碍保存 */ }
  if (typeof w.saveP === 'function') w.saveP();
}

// 服务商预设：选中只填地址（Model_ID 由玩家自填，示例仅作提示——方舟等家的 Model_ID 是接入点 ID）
export function presets() {
  return Object.entries(w.TM_PROVIDER_PRESETS || {}).map(([id, p]) => ({
    id, name: p.name, url: p.url || '', model: p.model || '', keyHint: p.keyHint || '', modelHint: String(p.modelHint || '').replace(/<[^>]+>/g, '')
  }));
}

// 某一路的现值。主 API 从未配过（无 Key 且地址、模型仍是出厂 OpenAI 默认）时各栏留空
export function aiConfig(tier = 'primary') {
  const ai = Pj().ai || {};
  const c = tier === 'secondary' ? ai.secondary || {} : ai;
  const virgin = tier === 'primary' && typeof w._sAiVirgin === 'function' && w._sAiVirgin();
  return {
    key: virgin ? '' : c.key || '', url: virgin ? '' : c.url || '', model: virgin ? '' : c.model || '', provider: c.provider || '',
    temp: ai.temp ?? 0.8, mem: ai.mem ?? 20, contextK: conf().contextSizeK || 0,
    thinking: typeof c.thinking === 'boolean' ? c.thinking : null, thinkingProtocol: c.thinkingProtocol || 'auto',
    enabled: tier === 'secondary' ? conf().secondaryEnabled !== false : true, configured: !!c.key
  };
}

// 拉取此地址、此 Key 的模型列表（不经老 DOM）
export async function listModels(d, signal) {
  if (!w.TM || !w.TM.APIModels || typeof w.TM.APIModels.list !== 'function') throw new Error('内核缺 TM.APIModels');
  const r = await w.TM.APIModels.list({ url: d.url.trim(), key: d.key.trim(), model: (d.model || '').trim() }, { signal });
  return { models: (r.models || []).map((m) => m.id), partial: !!r.partial };
}

function applyThinking(target, d) {
  if (d.thinking == null) delete target.thinking; else target.thinking = !!d.thinking;
  target.thinkingProtocol = d.thinkingProtocol || 'auto';
}

// 保存一路。次 API 三栏全空即清除（回退主 API）
export function saveAi(tier, d) {
  const bad = writableError();
  if (bad) return { ok: false, error: '未保存：' + bad };
  const p = Pj();
  p.ai = p.ai || {};
  if (tier === 'secondary') {
    const key = (d.key || '').trim(), url = (d.url || '').trim(), model = (d.model || '').trim();
    if (key || url || model) {
      p.ai.secondary = { key, url, model, provider: d.provider || 'openai' };
      applyThinking(p.ai.secondary, d);
    } else delete p.ai.secondary;
    conf().secondaryEnabled = d.enabled !== false;
  } else {
    p.ai.key = (d.key || '').trim();
    p.ai.url = (d.url || '').trim();
    p.ai.model = (d.model || '').trim();
    const t = parseFloat(d.temp);
    p.ai.temp = Number.isFinite(t) ? t : 0.8;
    const m = parseInt(d.mem, 10);
    p.ai.mem = Number.isFinite(m) ? m : 20;
    const k = parseInt(d.contextK, 10);
    conf().contextSizeK = Number.isFinite(k) && k > 0 ? k : 0;
    applyThinking(p.ai, d);
  }
  try { persistAi(); } catch (_e) { return { ok: false, error: 'API 配置未保存，请检查本机存储' }; }
  return { ok: true };
}

// 体检：三小调用（连通、延迟、模型回声；流式；严格 JSON）＋主 API 再探上下文窗口，给评语。
// 用未保存的值临时测，测完还原（与老面板 sTestConn 同法）
export async function testAi(tier, d, onProgress = () => {}) {
  if (typeof w.probeModelQuickCheck !== 'function') return { ok: false, error: '内核缺 probeModelQuickCheck' };
  const p = Pj();
  p.ai = p.ai || {};
  const key = (d.key || '').trim(), url = (d.url || '').trim(), model = (d.model || '').trim();
  if (!key || !url) return { ok: false, error: '先填地址与 Key' };
  const keep = tier === 'secondary' ? (p.ai.secondary ? { ...p.ai.secondary } : null) : { key: p.ai.key, url: p.ai.url, model: p.ai.model };
  const keepEnabled = conf().secondaryEnabled;
  try {
    if (tier === 'secondary') { p.ai.secondary = { ...(p.ai.secondary || {}), key, url, model }; conf().secondaryEnabled = true; }
    else Object.assign(p.ai, { key, url, model });
    const qr = await w.probeModelQuickCheck({ tier, onProgress });
    let det = 0;
    if (tier === 'primary' && typeof w.detectModelContextSize === 'function') {
      try {
        delete conf()._detectedContextK; delete conf()._ctxCacheKey; delete conf()._ctxDetectLayer;
        det = await w.detectModelContextSize({ force: true, onProgress: (m) => onProgress('连通 ✓ · ' + m) });
      } catch (_e) { det = 0; }
    }
    const wlCtx = typeof w._matchModelCtx === 'function' ? w._matchModelCtx(model) : 0;
    const ctxK = det || wlCtx || 0;
    const wlOut = (typeof w._matchModelOutput === 'function' ? w._matchModelOutput(model) : 0) * 1024;
    const c = conf();
    const outTok = c.maxOutputTokens || c._measuredMaxOutput || c._detectedMaxOutput || wlOut || 0;
    const v = typeof w._sConnVerdict === 'function' ? w._sConnVerdict(qr, ctxK, outTok) : null;
    return {
      ok: true, ctxK, ctxSource: det ? c._ctxDetectLayer || 'API 探测' : wlCtx ? '白名单' : '', outTok,
      latencyMs: qr.latencyMs, model: qr.model, responseModel: qr.responseModel, echo: qr.echo, usageSeen: qr.usageSeen,
      stream: !!(qr.stream && qr.stream.ok), json: !!(qr.json && qr.json.ok), warnings: (qr.warnings || []).map(String),
      verdict: v ? { grade: v.grade, label: v.label, notes: v.notes.slice() } : null
    };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  } finally {
    if (tier === 'secondary') { if (keep) p.ai.secondary = keep; else delete p.ai.secondary; conf().secondaryEnabled = keepEnabled; }
    else Object.assign(p.ai, keep);
  }
}

// ---------- 生图 API（本机 localStorage「tm_api_image」；Key 空则沿用主 API 的 Key） ----------
export function imageConfig() {
  try { const c = JSON.parse(localStorage.getItem('tm_api_image') || 'null') || {}; return { key: c.key || '', url: c.url || '', model: c.model || 'dall-e-3' }; }
  catch (_e) { return { key: '', url: '', model: 'dall-e-3' }; }
}
export function saveImage(d) {
  const key = (d.key || '').trim(), url = (d.url || '').trim(), model = (d.model || '').trim() || 'dall-e-3';
  try {
    if (key || url) localStorage.setItem('tm_api_image', JSON.stringify({ key, url, model }));
    else localStorage.removeItem('tm_api_image');
    return { ok: true };
  } catch (_e) { return { ok: false, error: '生图配置未保存，请检查本机存储' }; }
}
// 生图体检：故意用极小尺寸请求——服务商以「尺寸不合」拒绝即证明认证、地址、模型路由全通，且不出图、不计费
export async function testImage(d) {
  const saved = saveImage(d);
  if (!saved.ok) return saved;
  const cfg = w.ImageAPI && typeof w.ImageAPI.getConfig === 'function' ? w.ImageAPI.getConfig() : null;
  if (!cfg || !cfg.supported) return { ok: false, error: '未配置生图 API（Key 或地址为空）' };
  try {
    const resp = await fetch(cfg.url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.key },
      body: JSON.stringify({ model: cfg.model || 'dall-e-3', prompt: 'test', n: 1, size: '256x256', response_format: 'url' }) });
    let msg = '';
    if (!resp.ok) { try { const j = await resp.json(); msg = (j.error && j.error.message) || ''; } catch (_e) { msg = ''; } }
    if (resp.ok) return { ok: true, text: '连接成功，生图可用' };
    if ((resp.status === 400 || resp.status === 422) && /size|pixel|resolution|width|height|尺寸|分辨率/i.test(msg)) return { ok: true, text: '连接正常：认证、地址与 Model_ID 均可达（服务商校验到尺寸参数即证明已通）' };
    return { ok: false, error: `HTTP ${resp.status}${msg ? '：' + msg.slice(0, 80) : ''}${resp.status === 404 ? '（接口路径不对？）' : resp.status === 401 || resp.status === 403 ? '（Key 无效或无权限？）' : ''}`, endpoint: cfg.url };
  } catch (e) {
    return { ok: false, error: '网络错误：' + (e.message || e) };
  }
}

// ---------- 玩法开关（统一走内核 _togglePConf：写 P.conf、saveP、出提示） ----------
// 标签照录老面板原文；def 为没写过时的默认
const TOGGLES = [
  ['推演与开销', [
    ['recallGateEnabled', '启用召回节流（省 API）', false],
    ['sc1RepairUncapped', '主台账修复不设帽', false],
    ['memorySynthesisEnabled', '后台记忆固化／综合', true],
    ['semanticRecallAutoload', '本地语义检索自动加载', true],
    ['npcAiCosmeticEnrich', 'NPC 文字润色（不改数据）', true]
  ]],
  ['问天', [
    ['wentianAgentMode', '问天·先查证后裁定', true],
    ['wentianFulfillAudit', '问天·兑现对账（实验）', false],
    ['wentianUndo', '问天·直改可撤销（实验）', false]
  ]],
  ['世事', [
    ['borderInvasionEnabled', '边患·真实入侵（实验）', true],
    ['revoltRejectionEscalation', '义军拒抚·真备战', true],
    ['partyInferenceEnabled', '党争演绎·党派自主行动', true],
    ['officeActivationEnabled', '官制活化', true],
    ['rigidHistEventsOff', '演义模式·关闭注定史实事件', false]
  ]],
  ['科举', [
    ['useNewKejuD2', '特科·总开关', true],
    ['useNewKejuG2', '恩科（需总开关）', true],
    ['useNewKejuG3', '武举（需总开关）', true],
    ['useNewKejuG5', '童子科（需总开关）', true],
    ['useNewKejuH', '私学／书院', true],
    ['useNewKejuScandal', '科场弊案', true]
  ]],
  ['实验', [
    ['agentAdaptiveDeepen', '自适应深化（省调用）', true],
    ['agentSelfReflectEnabled', '自我反思·校准', false],
    ['agentQualityGateEnabled', '内容质量闸', false],
    ['agentEdictOversightEnabled', '跨回合一致·诏令督查', false],
    ['agentAnomalyEnabled', '冷门动作深查', false],
    ['agentUpgradesEnabled', '启用全部 LLM 升级', false],
    ['factionToolDecisionEnabled', '势力按需取数', false],
    ['eventUnificationEnabled', '事件系统统一', false],
    ['talentCohortEnabled', '人才范式渗透', false]
  ]]
];
// 本局开关：存在档里（GM），只在局中列出；走内核 tm-battle-turn.js 的设置处理器（会出提示）
const GAME_TOGGLES = ['战事（本局）', [
  ['game:_yujiaQinzheng', '御驾亲征·战术战斗（直辖军接敌可亲操此战）', '_tmSetYujiaQinzheng'],
  ['game:_yujiaObserve', '他方战事旁观（回合末可遣人观之，不改战果）', '_tmSetYujiaObserve']
]];
export function toggles() {
  const c = conf();
  const master = w.TM && w.TM.OfficeFlags && typeof w.TM.OfficeFlags.masterOn === 'function' ? () => w.TM.OfficeFlags.masterOn() : null;
  const out = TOGGLES.map(([group, rows]) => ({
    group,
    rows: rows.map(([key, label, def]) => ({ key, label, on: key === 'officeActivationEnabled' && master ? !!master() : c[key] === undefined ? def : !!c[key] }))
  }));
  const g = w.GM;
  if (g && g.running) out.unshift({ group: GAME_TOGGLES[0], rows: GAME_TOGGLES[1].filter(([, , f]) => typeof w[f] === 'function').map(([key, label]) => ({ key, label, on: !!g[key.slice(5)] })) });
  return out.filter((x) => x.rows.length);
}
export function setToggle(key, on) {
  const game = GAME_TOGGLES[1].find(([k]) => k === key);
  if (game) {
    if (typeof w[game[2]] !== 'function') throw new Error('内核缺战事开关');
    w[game[2]](!!on);
    return;
  }
  if (typeof w._togglePConf !== 'function') throw new Error('内核缺 _togglePConf');
  w._togglePConf(key, !!on);
}

// ---------- 声音（AudioSystem） ----------
export function audio() {
  const a = w.AudioSystem;
  if (!a) return null;
  return { music: a.bgmEnabled !== false, sound: a.enabled !== false, musicVolume: Math.round((a.bgmVolume ?? 0.5) * 100), soundVolume: Math.round((a.sfxVolume ?? a.volume ?? 0.5) * 100) };
}
// 走老面板的同名助手（_settingsAudio*：开关时起停殿乐、试一声、存设置），音量 0～100
export function setAudio(patch) {
  const call = (name, v) => { if (typeof w[name] === 'function') w[name](v); };
  if ('music' in patch) call('_settingsAudioToggleBgm', !!patch.music);
  if ('sound' in patch) call('_settingsAudioToggleSfx', !!patch.sound);
  if ('musicVolume' in patch) call('_settingsAudioSetBgmVolume', patch.musicVolume);
  if ('soundVolume' in patch) call('_settingsAudioSetSfxVolume', patch.soundVolume);
}

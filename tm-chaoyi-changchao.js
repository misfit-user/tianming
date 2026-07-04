// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// Module: tm-chaoyi-changchao.js — 常朝 v3·preview 移植 + GM Adapter
// Domain: 朝议·常朝
// Status: active · Last Updated: 2026-05-03 (Phase 3·rename v3 → changchao·5→4 文件)
// Owner: TM 团队
// Imports: tm-chaoyi.js (openChaoyi·closeChaoyi·addCYBubble·_cc2_buildAgendaPrompt·_cc2_fallbackAgenda)
//          tm-ai-infra.js (callAI·_aiDialogueTok·_aiDialogueWordHint·extractJSON)·tm-utils.js
// Exports: 76 _cc3_* functions·主入口 _cc3_open·_cc3_createModal·_cc3_close 等
// Used by: tm-chaoyi.js (_cy_pickMode 'changchao' → _cc3_open)
// Side effects: DOM modal (cc3-*)·CSS dynamic load (tm-chaoyi-changchao.css)·CY 状态·GM
// Test: web/scripts/smoke-chaoyi-v3.js (56 assertions)·boot-smoke·render-smoke
// Notes: Phase 3 (2026-05-03) 5→4 文件·原 tm-chaoyi-v3.js·rename → changchao·_cc2 prompts 已入 chaoyi.js
// 姊妹·tm-chaoyi.js·tm-chaoyi-tinyi.js·tm-chaoyi-yuqian.js
//
// R157 章节导航·§A[L1] GM Adapter (_cc3_buildCharsFromGM·etc)
//   §B[L80] preview 移植 (runOpening/Announce/Detail/Debate/Closing)
//   §C[末] 入口 _cc3_open
// ============================================================

// ═══════════════════════════════════════════════════════════════════════
//  【立项拆分 2026-07-04】§A GM Adapter → tm-chaoyi-changchao-adapter.js（载于本文件之前）
//  抗辩面板起(原§3914-末) → tm-chaoyi-changchao-flows.js（载于本文件之后）·保序切割·全局名跨文件解析
// ═══════════════════════════════════════════════════════════════════════
// 数据·朝堂角色（mock·明末崇祯朝实在臣）
// ═══════════════════════════════════════════════
const CHARS = {}; // mock 数据·_cc3_open 时由 _cc3_overrideMockWithGM 从 GM.chars 填充

// ═══════════════════════════════════════════════
// 数据·议程（mock·7 条·涵盖各类型）
// ═══════════════════════════════════════════════
const AGENDA = []; // mock 数据·_cc3_open 时由 _cc3_buildAgendaFromGM (走 v2 _cc2_buildAgendaPrompt) 填充

// ═══════════════════════════════════════════════
// 状态机
// ═══════════════════════════════════════════════
const state = {
  mode: 'changchao',           // 'changchao' | 'shuochao'
  _isPostTurn: null,
  _openSource: '',
  phase: 'opening',
  currentIdx: 0,
  decisions: [],               // {idx, action, item, label, extra?}
  pendingPlayerInput: null,
  benchExpanded: false,
  debateRound: 0,
  prestige: 55,                // 皇威
  power: 60,                   // 皇权
  attendees: [],               // present chars
  absents: [],                 // absent chars
  done: false
};

// ═══════════════════════════════════════════════
// 工具
// ═══════════════════════════════════════════════
function $(id) { return document.getElementById(id); }
function escHtml(s) { return String(s||'').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":"&#39;"}[c])); }
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function avatarHtml(name, opts = {}) {
  const ch = CHARS[name] || { initial: name.slice(0, 1), class: 'east' };
  const cls = ch.class === 'wu' ? 'wu' : ch.class === 'kdao' ? 'koudao' : '';
  return `<div class="cy-bubble-avatar ${cls}${ch.portrait ? ' has-img' : ''}">${ch.portrait ? '<img class="cy-bubble-avatar-img" src="'+escHtml(ch.portrait)+'" loading="lazy" decoding="async">' : escHtml(ch.initial || name.slice(0, 1))}</div>`;
}

// 2026-06·出班者立绘放大焦点（左殿堂·随发言切换·谁奏对则谁立绘）
function _cc3_setPresenter(name) {
  var el = document.getElementById('cc-presenter');
  if (!el || !name) return;
  var ch = CHARS[name] || {};
  var pic = ch.portrait
    ? '<img class="cc-pres-img" src="' + escHtml(ch.portrait) + '" loading="lazy">'
    : '<div class="cc-pres-ph">' + escHtml(String(name).charAt(0)) + '</div>';
  el.innerHTML = '<div class="cc-pres-pic">' + pic + '</div><div class="cc-pres-info"><div class="cc-pres-nm">' + escHtml(name) + '</div><div class="cc-pres-rl">' + escHtml(ch.title || '') + ' · 出班奏对</div></div>';
  el.classList.add('active');
}

// 2026-06·本日议程列表（右栏顶·AGENDA × currentIdx → ✓已决 / ●当前 / ○待奏 + 标签）
function _cc3_renderAgendaList() {
  var el = document.getElementById('cc-agenda'); if (!el) return;
  if (typeof AGENDA === 'undefined' || !AGENDA || !AGENDA.length) { el.innerHTML = ''; return; }
  var cur = (typeof state !== 'undefined' && typeof state.currentIdx === 'number') ? state.currentIdx : 0;
  var done = (typeof state !== 'undefined' && state.decisions) ? state.decisions.length : 0;
  var h = '<div class="cc-ag-h">本日议程 · 已决 <b>' + done + '</b> / 共 <b>' + AGENDA.length + '</b> 事</div><div class="cc-ag-list">';
  for (var i = 0; i < AGENDA.length; i++) {
    var it = AGENDA[i] || {};
    var stt = i < cur ? 'done' : (i === cur ? 'cur' : 'wait');
    var icon = stt === 'done' ? '✓' : (stt === 'cur' ? '●' : '○');
    var tags = '';
    if (it.tags && it.tags.length) { for (var t = 0; t < Math.min(2, it.tags.length); t++) tags += '<span class="cc-ag-tag">' + escHtml(it.tags[t]) + '</span>'; }
    h += '<div class="cc-ag-item ' + stt + '"><span class="cc-ag-st">' + icon + '</span><span class="cc-ag-ti">' + escHtml(it.title || it.presenter || '议题') + '</span><span class="cc-ag-tags">' + tags + '</span></div>';
  }
  h += '</div>';
  el.innerHTML = h;
}

function addBubble(opts) {
  const main = $('cy-stage-main');
  if (!main) return;  // 面板已关·async 链残留调用静默丢弃
  const row = document.createElement('div');
  row.className = 'cy-bubble-row ' + (opts.kind || 'npc');
  let inner = '';
  if (opts.kind === 'system') {
    const sysCls = opts.sysKind ? (' ' + opts.sysKind) : '';
    inner = `<div class="cy-bubble-content"><div class="cy-bubble-text${sysCls}">${opts.text}</div></div>`;
  } else if (opts.kind === 'player') {
    inner = `<div class="cy-bubble-content"><div class="cy-bubble-meta">${(typeof _sovereignAddressTerm === 'function' ? _sovereignAddressTerm(typeof GM !== 'undefined' ? GM : null) : '陛下')}</div><div class="cy-bubble-text">${escHtml(opts.text)}</div></div>`;
  } else {
    const ch = CHARS[opts.name] || {};
    const stance = opts.stance ? `<span class="stance stance-${opts.stance}">${stanceLbl(opts.stance)}</span>` : '';
    const itemType = opts.itemType ? `<span class="type-badge t-${opts.itemType}">${typeLbl(opts.itemType)}</span>` : '';
    const meta = `${escHtml(opts.name)} · ${escHtml(ch.title || '')}${itemType}${stance}`;
    const urgTag = opts.urgent ? '<span class="urg-tag">⚡ 急</span>' : '';
    const detailCls = opts.detail ? (' detail' + (opts.itemType ? ' type-' + opts.itemType : '')) : '';
    const urgCls = opts.urgent ? ' urgent' : '';
    inner = `${avatarHtml(opts.name)}<div class="cy-bubble-content"><div class="cy-bubble-meta">${meta}</div><div class="cy-bubble-text${detailCls}${urgCls}">${urgTag}${escHtml(opts.text)}</div></div>`;
  }
  row.innerHTML = inner;
  main.appendChild(row);
  main.scrollTop = main.scrollHeight;
  // 记录最后说话者·"你说/其他人" 代词识别用
  if (!opts.kind && opts.name) {
    state._lastNpcSpeaker = opts.name;
    try { _cc3_setPresenter(opts.name); } catch(_) {}
  }
  // ─── 收集对话到 transcript·朝议结束写入 _courtRecords·供 AI 推演读取 ───
  try {
    if (!state._transcript) state._transcript = [];
    let role, speaker, text;
    if (opts.kind === 'player') { role = 'player'; speaker = (typeof _sovereignAddressTerm === 'function' ? _sovereignAddressTerm(typeof GM !== 'undefined' ? GM : null) : '陛下'); text = opts.text; }
    else if (opts.kind === 'system') { role = 'system'; speaker = '内侍'; text = opts.text; }
    else if (opts.name) { role = 'npc'; speaker = opts.name; text = opts.text; }
    if (text && (role === 'player' || role === 'npc')) {
      // 对系统旁白做较弱过滤·只保留有意义的（如召见/抗辩等结构化标记）
      // 玩家+NPC 全保留
      state._transcript.push({
        role: role,
        speaker: speaker,
        text: String(text).replace(/<[^>]+>/g, '').slice(0, 400),
        stance: opts.stance || '',
        agendaIdx: typeof state.currentIdx === 'number' ? state.currentIdx : -1,
        phase: state.phase || ''
      });
      // 上限 200 条·防爆
      if (state._transcript.length > 200) state._transcript.shift();
    }
  } catch (_) {}
  return row;
}

function typeLbl(t) {
  return { routine: '日常', request: '请旨', warning: '预警', emergency: '紧急', personnel: '人事', confrontation: '弹劾', joint_petition: '联名', personal_plea: '请旨' }[t] || t;
}

function stanceLbl(s) {
  return { support: '支持', oppose: '反对', neutral: '中立', mediate: '折中' }[s] || s;
}

// ═══════════════════════════════════════════════
// 玩家说话主入口·按阶段分发 + 关键词解析 + NPC 回应
// ═══════════════════════════════════════════════
async function onPlayerSpeak(text) {
  if (!text) return;
  // 弹层关闭
  document.querySelectorAll('.cy-popover.show').forEach(p => p.classList.remove('show'));
  const jp = document.querySelector('.cy-popover.jinkou'); if (jp) jp.remove();

  if (state.done) {
    addBubble({ kind: 'player', text });
    addBubble({ kind: 'system', text: '（朝会已散 · ' + (typeof _sovereignAddressTerm === 'function' ? _sovereignAddressTerm(typeof GM !== 'undefined' ? GM : null) : '陛下') + '还宫。）' });
    return;
  }
  if (state.phase === 'opening' || state.phase === 'closing') {
    addBubble({ kind: 'player', text });
    addBubble({ kind: 'system', text: '（朝礼未及奏对 · 百官无应。）' });
    return;
  }
  if (state.phase === 'announce') return onSpeakAnnounce(text);
  if (state.phase === 'detail') return onSpeakDetail(text);
  if (state.phase === 'debate') return onSpeakDebateLive(text);
}

async function onSpeakAnnounce(text) {
  const t = text.replace(/[。·，。，！？\s]/g, '');
  if (/^奏来$|奏闻|讲|说|何事|讲来|奏明/.test(t)) {
    addBubble({ kind: 'player', text });
    await delay(280);
    return onAnnounceChoice('proceed');
  }
  if (/免议|不议|不必|算了|不必再奏|此事不议/.test(t)) {
    addBubble({ kind: 'player', text });
    await delay(280);
    return onAnnounceChoice('skip');
  }
  if (/再奏|改日|稍后|留中/.test(t)) {
    addBubble({ kind: 'player', text });
    await delay(280);
    return onAnnounceChoice('hold');
  }
  // 自由话语·让奏报者重新启奏
  addBubble({ kind: 'player', text });
  await delay(320);
  const item = AGENDA[state.currentIdx];
  addBubble({ name: item.presenter, text: (typeof _sovereignAddressTerm === 'function' ? _sovereignAddressTerm(typeof GM !== 'undefined' ? GM : null) : '陛下') + '圣意未明 · 容臣再启：' + item.announceLine });
}

async function onSpeakDetail(text) {
  addBubble({ kind: 'player', text });
  await delay(320);
  const action = parseDetailKeyword(text);
  if (action) return doAction(action);
  // 自由话语 → 主奏者回应 + 一名 NPC 跟话
  await npcRespondToPlayer(text, 2);
}

async function onSpeakDebateLive(text) {
  // 议论中玩家直接说·插入到队列·主流程（runDebate 循环里）会下一拍消费
  // 但若玩家在按钮已显示后说的话·直接走 npcRespondToPlayer
  if (document.querySelector('.cy-action-bar .cy-btn')) {
    addBubble({ kind: 'player', text });
    await delay(320);
    const action = parseDetailKeyword(text);
    if (action) return doAction(action);
    await npcRespondToPlayer(text, 2);
    return;
  }
  // 否则·入队列·让 runDebate 循环消化
  state.pendingPlayerInput = text;
  addBubble({ kind: 'system', text: (function(){ var _s = (typeof _sovereignAddressTerm === 'function' ? _sovereignAddressTerm(typeof GM !== 'undefined' ? GM : null) : '陛下'); return '（' + _s + '举笏 · 待此官言毕即接' + _s + '之意。）'; })() });
}

function parseDetailKeyword(text) {
  const t = text.replace(/[。·，。，！？\s]/g, '');
  if (/^准奏$|^准$|^可$|准了|可办|从之|奏可/.test(t)) return 'approve';
  if (/^驳$|^驳奏$|不准|不可|否|不行|不允/.test(t)) return 'reject';
  if (/留中|从长计议|容朕|缓议|且听/.test(t)) return 'hold';
  if (/下廷议|集议|付廷议/.test(t)) return 'escalate';
  if (/部议|发部|交部/.test(t)) {
    // 简化：默认转户部·真实场景应弹下拉
    return null; // 仍走自由话语·以免失误
  }
  return null;
}

async function npcRespondToPlayer(playerText, count) {
  const item = AGENDA[state.currentIdx];
  const intent = inferPlayerIntent(playerText);
  const mentioned = findMentionedChars(playerText);

  // 代词识别：你说/请说/讲来 → 指上一个发言者；其他人/诸卿/众卿 → 排除上一个发言者
  const t = (playerText || '').trim();
  // 单字/极短指令也算·常朝里"说"/"讲"/"继续"/"续言"等是对刚才发言者的省略主语指令
  const shortCmd = /^(说|讲|继续|续言|续奏|再言|再奏|续之|进之|具陈|具言|且|然|然后|往下|接着|更陈|续陈|展开|细之|精之|准之|何也|何如)[。！？.\s!?·]*$/;
  const refsLastSpeaker = /^(你说|请说|尔言|尔说|且言|且说|讲来|细言|说来|你来说|你具陈|你陈之|尔陈|尔续|尔再言|尔以为|你怎么看|你看)/.test(t)
                         || /\b你说\b|\b你讲\b/.test(t)
                         || shortCmd.test(t);
  const askOthers = /其他人|余者|余下|其余|诸卿|众卿|他人|别人|余等|余卿/.test(t);
  const lastSpeaker = state._lastNpcSpeaker || '';

  const seen = new Set();
  const candidates = [];

  // 0) "你说/请说" 类·定向给上一个发言者
  if (refsLastSpeaker && lastSpeaker && CHARS[lastSpeaker] && !CHARS[lastSpeaker].absent) {
    candidates.push(lastSpeaker); seen.add(lastSpeaker);
  }

  // 1) 被玩家点名的人优先（任何在场 NPC 都识别·不止 item.target）
  mentioned.forEach(n => {
    if (CHARS[n] && !CHARS[n].absent && !seen.has(n)) {
      candidates.push(n); seen.add(n);
    }
  });

  // "其他人" 时·上一个发言者排除·标记 seen 不再选
  if (askOthers && lastSpeaker) seen.add(lastSpeaker);

  // 2) intent 触发的特殊抢答（被针对者/言官/折中派）
  if (intent === 'punish') {
    if (item.target && CHARS[item.target] && !CHARS[item.target].absent && !seen.has(item.target)) {
      // 被批者抢辩
      candidates.unshift(item.target); seen.add(item.target);
    }
    // 言官响应
    ['黄宗周', '黄景昉', '倪元璐'].forEach(n => {
      if (CHARS[n] && !CHARS[n].absent && !seen.has(n) && candidates.length < count + 1) {
        candidates.push(n); seen.add(n);
      }
    });
  }
  if (intent === 'mediate' || intent === 'doubt') {
    // 折中疑虑·首辅/资深重臣出来调和(取当前局在朝重臣·不写死天启韩爌)
    var _med = _cc3_seniorOfficial('');
    if (_med && !seen.has(_med)) { candidates.unshift(_med); seen.add(_med); }
  }

  // 3) 主奏者
  if (!seen.has(item.presenter)) {
    candidates.push(item.presenter); seen.add(item.presenter);
  }

  // 4) debate / selfReact 中已有立场者
  (item.debate || []).forEach(d => {
    if (!seen.has(d.name) && CHARS[d.name] && !CHARS[d.name].absent) {
      candidates.push(d.name); seen.add(d.name);
    }
  });
  (item.selfReact || []).forEach(d => {
    if (!seen.has(d.name) && CHARS[d.name] && !CHARS[d.name].absent) {
      candidates.push(d.name); seen.add(d.name);
    }
  });

  // 5) 闲人兜底·从当前局在朝者补(不写死天启韩爌/王永光/黄宗周等·别的剧本改补本朝人)
  _cc3_ambientNames(4).forEach(n => {
    if (CHARS[n] && !CHARS[n].absent && !seen.has(n)) {
      candidates.push(n); seen.add(n);
    }
  });

  // 点名时·让回应数 +1（点名的不挤主奏者位）
  const explicitTarget = (refsLastSpeaker && lastSpeaker) || mentioned.length > 0;
  const respondN = explicitTarget ? Math.min(count + 1, candidates.length) : Math.min(count, candidates.length);
  const picked = candidates.slice(0, respondN);

  for (let i = 0; i < picked.length; i++) {
    const name = picked[i];
    const isMentionedNow = mentioned.indexOf(name) >= 0 || (refsLastSpeaker && name === lastSpeaker);
    const stance = inferStanceForResponder(name, item, playerText, intent, isMentionedNow);
    // 流式：先放空气泡·再随 chunk 增量更新
    const row = addBubble({ name, stance, text: '…' });
    const textEl = row && row.querySelector('.cy-bubble-text');
    const main = $('cy-stage-main');
    const onChunk = (partial) => {
      if (textEl) {
        textEl.textContent = (partial || '').trim() || '…';
        if (main) main.scrollTop = main.scrollHeight;
      }
    };
    const line = await generateNpcReply(name, item, playerText, stance, intent, isMentionedNow, onChunk);
    if (textEl) textEl.textContent = line;
    if (main) main.scrollTop = main.scrollHeight;
    await delay(280);
  }
}

// ─── 玩家话意图识别（punish 优先于 aggressive·因「严办 X」更属惩处）───
function inferPlayerIntent(text) {
  const t = text || '';
  if (/严办|惩之|治罪|不察|可斩|罢黜|查办|严斥|拿下/.test(t)) return 'punish';
  if (/[!！]{2,}/.test(t) || /必须|即办|速行|不容|刻不容缓|不得有违|断不可/.test(t)) return 'aggressive';
  if (/民苦|忧|痛|哀|怜|可怜|惜民|百姓苦/.test(t)) return 'sympathetic';
  if (/善|嘉许|勤勉|可嘉|有功|忠勇|赏之/.test(t)) return 'praise';
  if (/恐有|未必|疑|或非|姑妄|存疑|不可不察/.test(t)) return 'doubt';
  if (/两全|折中|分发|分批|可缓|商榷|或可|稍议/.test(t)) return 'mediate';
  if (/何如|如何|可乎|几何|详言|细言|奈何|怎样|何意|何谓|可言之|讲来/.test(t)) return 'inquire';
  return 'neutral';
}

// ─── 在场 NPC 名识别 ───
function findMentionedChars(text) {
  if (!text) return [];
  const found = [];
  Object.keys(CHARS).forEach(name => {
    if (text.indexOf(name) >= 0) found.push(name);
  });
  return found;
}

function inferStanceForResponder(name, item, playerText, intent, isMentioned) {
  // 自辩刚性规则
  if (isMentioned && item.target === name) return 'oppose';
  if (isMentioned && !item.target) return 'support';
  const inDebate = (item.debate || []).find(d => d.name === name);
  if (inDebate) return inDebate.stance;
  return _cc3_computeStanceFromChar(name, item, intent);
}

/**
 * 常朝大改 Slice 3·B 方案 fallback·若 traitIds 缺失·从 personality 字符串推 8D dims
 * 中等精度·~70%·覆盖绍宋等 traitIds 为空剧本
 */
function _cc3_inferDimsFromPersonalityText(text) {
  if (!text || typeof text !== 'string') return null;
  const dims = { boldness:0, compassion:0, rationality:0, greed:0, honor:0, sociability:0, vengefulness:0, energy:0 };
  let hits = 0;
  // boldness·勇敢度
  if (/勇敢|勇猛|刚直|刚毅|敢言|不畏|无畏|刚强|果敢|敢于|豪侠|忠勇|沉勇|武人|武勇|善战|骁勇|勇略|勇而|跋扈|彪悍/.test(text))     { dims.boldness += 0.4; hits++; }
  if (/怯懦|畏缩|胆小|怕事|避祸|懦弱|畏怯|软弱|优柔|柔弱/.test(text))                          { dims.boldness -= 0.4; hits++; }
  // compassion·仁善度
  if (/仁善|仁厚|宽仁|爱民|怜悯|不忍|心慈|恻隐|温顺|温和|和善/.test(text))                     { dims.compassion += 0.4; hits++; }
  if (/冷酷|冷漠|残忍|严苛|凉薄|薄情|狠辣|刻薄|无情|严酷|冷峻/.test(text))                              { dims.compassion -= 0.4; hits++; }
  // rationality·理性度
  if (/理性|务实|深思|审慎|稳重|冷静|权衡|计虑|计谋|沉稳|老成持重|机变|机敏|有谋|善守|城府|谨慎|识大体|识进退|不喜形色|节俭|聪慧|持重|聪明|精明|深沉|多谋|权术|老成/.test(text)) { dims.rationality += 0.4; hits++; }
  if (/冲动|偏激|急躁|莽撞|意气|轻率|昏聩|任性|暴躁|脾气暴/.test(text))                                   { dims.rationality -= 0.4; hits++; }
  // greed·贪心
  if (/贪|聚敛|好利|敛财|爱财|图利|逐利|风流/.test(text))                                     { dims.greed += 0.4; hits++; }
  if (/清廉|淡泊|寡欲|不贪|不慕|安贫|节俭|澹泊/.test(text))                                        { dims.greed -= 0.4; hits++; }
  // honor·名节
  if (/名节|气节|清议|清流|耿介|忠直|刚正|节操|大义|守节|贞节|贞烈|贞静|重然诺|忠诚|忠悃|清介|义气|有义|忠义|清雅|诚厚|本分|清正/.test(text)) { dims.honor += 0.5; hits++; }
  if (/失节|无耻|附阉|逢迎|苟合|圆滑/.test(text))                                             { dims.honor -= 0.4; hits++; }
  // sociability·社交
  if (/善交|结好|合群|和气|圆通|长袖善舞|好好先生/.test(text))                                { dims.sociability += 0.4; hits++; }
  if (/孤僻|寡言|不群|独行|孤介|闷葫芦|傲慢|骄横|孤高/.test(text))                                           { dims.sociability -= 0.4; hits++; }
  // vengefulness·复仇
  if (/睚眦必报|记仇|复仇|怀怨|心狭|心狠|险毒|阴狠|阴险|不择手段/.test(text))                                          { dims.vengefulness += 0.5; hits++; }
  if (/宽厚|能容|不计前嫌|大度|隐忍|坚韧/.test(text))                                          { dims.vengefulness -= 0.4; hits++; }
  // energy·精干
  if (/勤勉|精干|干练|励精|尽心|勤政|敏锐|急切|任事|事功|激切|激烈|极烈|锐意|性烈/.test(text))                                    { dims.energy += 0.4; hits++; }
  if (/懒散|怠政|拖沓|疏懒|脾性软弱/.test(text))                                              { dims.energy -= 0.4; hits++; }
  return hits > 0 ? dims : null;
}

/**
 * 常朝大改 Slice 3·orchestrator·先 TM.NpcEngine.aggregateDims·再 fallback B
 */
function _cc3_getDims(ch) {
  let dims = null;
  try {
    if (typeof window !== 'undefined' && window.TM && TM.NpcEngine && TM.NpcEngine.aggregateDims) {
      dims = TM.NpcEngine.aggregateDims(ch);
    }
  } catch (_) {}
  // 全 0 也算"无效"·走 fallback
  const allZero = dims && Object.values(dims).every(v => v === 0);
  if (!dims || allZero) {
    const inferred = _cc3_inferDimsFromPersonalityText(ch && ch.personality);
    if (inferred) {
      dims = inferred;
      dims._source = 'personality-text-fallback';  // debug 标识
    }
  } else if (dims) {
    dims._source = 'trait-aggregate';
  }
  return dims;
}

/** 从角色实际属性 + 党派 + 议题语境 推导立场·替代纯随机 */
function _cc3_computeStanceFromChar(name, item, intent) {
  const ch = CHARS[name] || {};
  const cfg = (typeof _cc3_getScenarioConfig === 'function') ? _cc3_getScenarioConfig() : { factionMap: {} };
  const factionMap = cfg.factionMap || {};

  // intent 强约束（保留确定性短路）
  if (item && item.target === name) return 'oppose';
  if (intent === 'mediate') return 'mediate';
  if (intent === 'inquire') return 'neutral';

  // ── score: -1 (强反对) ~ +1 (强支持) ──
  let score = 0;

  // ① 党派立场表（scenario.chaoyi.factionMap·剧本可配）
  const partyKey = ch.party || '';
  for (const k of Object.keys(factionMap)) {
    if (partyKey && partyKey.indexOf(k) >= 0) {
      const tone = factionMap[k] && factionMap[k].tone;
      if (tone === 'support') score += 0.45;
      else if (tone === 'oppose') score -= 0.45;
      else if (tone === 'mediate') score += 0.0; // 倾折中
      break;
    }
  }

  // ② 忠诚度·高=偏支持·低=偏反对
  const loyalty = (typeof ch.loyalty === 'number') ? ch.loyalty : 50;
  score += (loyalty - 50) / 100; // -0.5 ~ +0.5

  // ③ 角色 stance 文本（如"中立·将崛起"/"清流"/"附阉"）
  const stxt = ch.stanceText || '';
  if (/清流|耿介|刚直|敢言|忠直/.test(stxt)) score += 0.15;
  if (/附阉|逢迎|柔佞|阴狡|工心术/.test(stxt)) {
    // 这类人会看皇帝意图行事·intent=praise/punish 时附和·sympathetic 时折中
    if (intent === 'praise' || intent === 'punish' || intent === 'aggressive') score += 0.35;
    else if (intent === 'sympathetic') score -= 0.05;
  }

  // ④ intent 与角色性质叠加
  if (intent === 'punish') {
    if (ch.class === 'kdao') score += 0.35;       // 言官响应严办
    if (/东林|清流/.test(partyKey)) score += 0.15;
  }
  if (intent === 'sympathetic') {
    const integrity = (typeof ch.integrity === 'number') ? ch.integrity : 50;
    score += (integrity - 50) / 200;              // 高清廉者更易共情民苦
  }
  if (intent === 'aggressive') {
    // 阁臣（rank<=2）经验老到·常委婉劝谏；言官则附和
    if (ch.rank && ch.rank <= 2) score -= 0.15;
    if (ch.class === 'kdao') score += 0.15;
  }
  if (intent === 'doubt') {
    if (ch.rank && ch.rank <= 2) score -= 0.05;   // 阁臣更慎·偏折中
  }
  if (intent === 'praise') {
    score += 0.20;                                // 嘉奖时大多附和
  }

  // ⑤ 极小随机扰动（避免完全可预测·但权重远低于属性）
  score += (Math.random() - 0.5) * 0.12;

  // ⑥ 常朝大改 Slice 3·8D personality × 议题 tag 贡献·persona-first 而非 stat-first
  //    实际接入 tm-npc-engine.js 的 8D 聚合·tag 来自 Slice 2 推导
  //    fallback·若 traitIds 缺失 (绍宋等)·从 personality 字符串推 dims (B 方案)
  const dims = _cc3_getDims(ch);
  const tags = Array.isArray(item && item.tags) ? item.tags : [];
  if (dims) {
    // compassion·penal-harsh
    if (tags.indexOf('penal-harsh') >= 0) {
      if (dims.compassion >= 0.5)  score -= 0.30;   // 仁善强反对刑罚
      if (dims.compassion <= -0.5) score += 0.20;   // 冷酷支持严办
    }
    // honor·etiquette / ritual
    if (tags.indexOf('etiquette-violation') >= 0 && dims.honor >= 0.5) score += 0.30;  // 清流支持清算违礼
    if (tags.indexOf('ritual') >= 0 && dims.honor >= 0.5) score -= 0.25;   // 重名节·议题动礼制宁守旧
    // greed·reward-distribution
    if (tags.indexOf('reward-distribution') >= 0) {
      if (dims.greed >= 0.3)  score += 0.25;
      if (dims.greed <= -0.3) score -= 0.10;
    }
    // boldness·foreign-policy·强硬派立场两极化
    if (tags.indexOf('foreign-policy') >= 0) {
      // 党派已确定主战/主和方向·boldness 强化该方向
      if (dims.boldness >= 0.3 && score > 0)  score += 0.15;
      if (dims.boldness >= 0.3 && score < 0)  score -= 0.15;
      if (dims.boldness <= -0.3 && score > 0) score -= 0.10;  // 怯懦削弱主战
      if (dims.boldness <= -0.3 && score < 0) score += 0.10;  // 怯懦缓和主和
    }
    // vengefulness·target 涉旧仇 (查 AffinityMap·若 ≤ -20 算旧仇)
    if (item && item.target && typeof AffinityMap !== 'undefined' && AffinityMap.get) {
      try {
        const aff = AffinityMap.get(name, item.target);
        if (typeof aff === 'number' && aff <= -20 && dims.vengefulness >= 0.5) {
          // 议题针对的人 = 本人旧仇·支持治罪 / 反对宽宥
          if (tags.indexOf('penal-harsh') >= 0) score += 0.25;
          else                                  score -= 0.15;   // 议题为旧仇背书时反对
        }
      } catch (_) {}
    }
    // rationality·controversial ≥ 6·情绪化议题·理性者拉回中立
    if (item && item.controversial >= 6 && dims.rationality >= 0.5) {
      score *= 0.75;
    }
  }

  if (score >= 0.40) return 'support';
  if (score <= -0.30) return 'oppose';
  if (Math.abs(score) < 0.12) return 'neutral';
  return 'mediate';
}

// ============================================================
// 常朝大改 Slice 4·debate state + base mode 推导
// 让朝议从"群聊"升级为"对话"·6 mode·lead / second / rebut / soften / pivot / cite (modifier) / augment
// ============================================================

/** 同党判定·party 字段含义模糊 (可能是"主战派"·"东林"·"清流" 等)·走 substring 匹配 */
function _cc3_sameParty(chA, chB) {
  if (!chA || !chB) return false;
  const pa = (chA.party || '').trim();
  const pb = (chB.party || '').trim();
  if (!pa || !pb) return false;
  if (pa === pb) return true;
  // 子串匹配·例如 "主战派" ⊂ "主战·清流"
  if (pa.indexOf(pb) >= 0 || pb.indexOf(pa) >= 0) return true;
  // 进一步·若 ch.faction 同·也算同党
  if (chA.faction && chB.faction && chA.faction === chB.faction) {
    // 同 faction 但不同 party·算半同党·返 false 让 mode 走 soften
    return false;
  }
  return false;
}

/** 立场对立判定·只 support vs oppose 算对立·mediate/neutral 跟 support/oppose 均不算对立 */
function _cc3_oppositeStance(a, b) {
  if (!a || !b) return false;
  if (a === 'support' && b === 'oppose') return true;
  if (a === 'oppose' && b === 'support') return true;
  return false;
}

/** 判断·target 是否曾损害 ch 本人/同党·查 AffinityMap·若 ≤ -20 算旧仇 */
function _cc3_wasHarmedBy(ch, targetName) {
  if (!ch || !targetName) return false;
  if (typeof AffinityMap === 'undefined' || !AffinityMap.get) return false;
  try {
    const a = AffinityMap.get(ch.name, targetName);
    return typeof a === 'number' && a <= -20;
  } catch (_) {
    return false;
  }
}

/**
 * 分析当前 debate state·返 8 字段
 * 在 _cc3_aiGenReact 调用·此时 item.selfReact / item.debate 是已部分填充
 *
 * @param {Object} item       — 议程项
 * @param {string} speakerName — 当前 NPC 名
 * @param {Object} gmCh       — 当前 NPC 全数据 (findCharByName 结果)
 * @returns {Object} state·或 { priorCount:0, mode:'lead' }
 */
function _cc3_analyzeDebate(item, speakerName, gmCh) {
  if (!item || !speakerName || !gmCh) {
    return { priorCount: 0, lastSpeaker: null, myStance: 'neutral' };
  }
  // 收集 prior·只算 AI 生成过的·避免读 mock 模板
  const prior = ((item.selfReact || []).filter(r => r && r.name !== speakerName && r.line))
    .concat((item.debate || []).filter(d => d && d.name !== speakerName && d.line));

  // 推本人立场 (用 emperor intent 跨发言·若有)
  const myStance = _cc3_computeStanceFromChar(speakerName, item, item._lastEmperorIntent || 'neutral');

  if (!prior.length) {
    const _pn0 = (item && item.presenter) || null, _pu0 = _pn0 && _pn0 !== speakerName;
    return {
      priorCount: 0,
      lastSpeaker: null,
      presenterName: _pn0, refSame: _pu0 ? _pn0 : null, refOpp: _pu0 ? _pn0 : null,
      lastStance: null,
      lastSamePartyAsMe: false,
      myStance,
      sameStanceCount: 0,
      oppStanceCount: 0,
      alliesPiledOn: 0,
      alliesLost: 0,
      momentum: 'opening',
      emperorIntent: (item && item._lastEmperorIntent) || 'neutral',
    };
  }

  const last = prior[prior.length - 1];

  let sameStanceCount = 0, oppStanceCount = 0;
  let alliesPiledOn = 0, alliesLost = 0;
  prior.forEach(r => {
    if (r.stance === myStance) sameStanceCount++;
    if (_cc3_oppositeStance(r.stance, myStance)) oppStanceCount++;
    const rch = (typeof CHARS !== 'undefined') ? CHARS[r.name] : null;
    if (_cc3_sameParty(rch, gmCh)) {
      if (r.stance === myStance) alliesPiledOn++;
      if (_cc3_oppositeStance(r.stance, myStance)) alliesLost++;
    }
  });

  // 阵营态势 (近 3 位)
  const last3 = prior.slice(-3);
  const last3Same = last3.filter(r => r.stance === myStance).length;
  const last3Opp = last3.filter(r => _cc3_oppositeStance(r.stance, myStance)).length;
  let momentum;
  if (last3Same >= 2) momentum = 'consensus-with-me';
  else if (last3Opp >= 2) momentum = 'consensus-against-me';
  else momentum = 'split';

  // 参照锚(修「附议/驳斥」张冠李戴):朝议围绕主奏人[presenter]之议·second(附议)指向与我同立场者·rebut/soften/confront(驳斥)指向异己者·均优先主奏人·兜底沿用 lastSpeaker(不劣旧行为)
  const presenterName = (item && item.presenter) || null;
  const _presUsable = presenterName && presenterName !== speakerName;
  let refSame = null, refOpp = null;
  if (_presUsable) {
    if (myStance === 'oppose') refOpp = presenterName;   // 我反对本议→驳斥锚=主奏人(其奏)
    else refSame = presenterName;                        // 我支持/折中/中立→附议锚=主奏人
  }
  for (let _i = prior.length - 1; _i >= 0; _i--) {        // prior 补:最近的同/异立场发言者
    const _r = prior[_i]; if (!_r) continue;
    if (!refSame && _r.stance === myStance) refSame = _r.name;
    if (!refOpp && _cc3_oppositeStance(_r.stance, myStance)) refOpp = _r.name;
    if (refSame && refOpp) break;
  }
  refSame = refSame || last.name || presenterName || null;
  refOpp = refOpp || last.name || presenterName || null;

  return {
    priorCount: prior.length,
    lastSpeaker: last.name,
    presenterName, refSame, refOpp,
    lastStance: last.stance,
    lastSamePartyAsMe: _cc3_sameParty((typeof CHARS !== 'undefined') ? CHARS[last.name] : null, gmCh),
    myStance,
    sameStanceCount, oppStanceCount,
    alliesPiledOn, alliesLost,
    momentum,
    emperorIntent: (item && item._lastEmperorIntent) || 'neutral',
  };
}

/**
 * 6 base mode 推导·基于 debate state + 议题 context
 * mode·lead / second / rebut / soften / pivot / augment·cite 作为 modifier
 *
 * 注意·persona modulation 在 Slice 5 的 _cc3_modulateModeByPersona 内做·此处只产 base
 */
function _cc3_baseMode(state, gmCh, item) {
  // 2026-05-23 fix·原 default = 'augment' 导致 augment 成吸盘·全场塌缩
  // 改 default 为 'pivot' (pivot 也补充·不锁开场词)·中立分发 3 mode·avoid 单 mode 兜底
  if (!state || !gmCh) return 'pivot';

  // 自辩短路·议题点名你·必 rebut (借模式自辩)
  if (item && item.target === gmCh.name) return 'rebut';

  // 首发
  if (state.priorCount === 0) return 'lead';

  // 同党同立场 → second
  if (state.lastSamePartyAsMe && state.lastStance === state.myStance) return 'second';

  // 异党异立场 (support vs oppose) → rebut
  if (!state.lastSamePartyAsMe && _cc3_oppositeStance(state.lastStance, state.myStance)) return 'rebut';

  // 同党异立场 → soften (婉言劝)
  if (state.lastSamePartyAsMe && state.lastStance !== state.myStance) return 'soften';

  // 中立态度·非首发 → 3 mode 均分 (原 50/50 pivot/augment 改 40/30/30 second/pivot/augment)
  if (state.myStance === 'neutral') {
    const r = Math.random();
    if (r < 0.40) return 'second';   // 中立倾向跟随 (新加)
    if (r < 0.70) return 'pivot';
    return 'augment';
  }

  // 默认·非对立 / 非同党 / 非中立·3 mode 均分 (原 100% augment 改)
  // 历史上"补充新角度"既可 augment·也可 second·也可 pivot
  const r = Math.random();
  if (r < 0.40) return 'second';
  if (r < 0.70) return 'pivot';
  return 'augment';
}

// ============================================================
// 常朝大改 Slice 5·persona modulation + tone modulation + 朝堂语词库
// ============================================================

/**
 * 15 条 8D persona × 议题 tag 修正表·调整 base mode
 * 见 chaoyi-npc-dialogue-design-v3.md §4
 *
 * @param {string} mode  — base mode
 * @param {Object} gmCh  — NPC 全数据
 * @param {Object} item  — 议程·含 tags / target / controversial
 * @param {Object} state — debate state·含 oppStanceCount / alliesLost / lastSpeaker
 * @returns {Object} { mode: 修正后 mode, modifiers: { cite: bool, force: bool, source: string } }
 */
function _cc3_modulateModeByPersona(mode, gmCh, item, state) {
  const result = { mode, modifiers: { cite: false, force: false, source: '' } };
  const dims = _cc3_getDims(gmCh);
  if (!dims) return result;
  result.modifiers.source = dims._source || 'unknown';

  const tags = Array.isArray(item && item.tags) ? item.tags : [];

  // ─── 强制规则 (force·覆盖 base mode·按维度数值高者优先) ───
  const forceCandidates = [];

  // honor·议题涉宗庙/礼制 (ritual)
  if (dims.honor >= 0.7 && tags.indexOf('ritual') >= 0) {
    forceCandidates.push({ rank: dims.honor, mode: 'rebut', reason: 'honor ≥0.7 + ritual·宗庙不可' });
  }
  // honor·议题 etiquette-violation·即便同党也清算
  if (dims.honor >= 0.5 && tags.indexOf('etiquette-violation') >= 0) {
    forceCandidates.push({ rank: dims.honor, mode: 'rebut', reason: 'honor ≥0.5 + etiquette-violation·清议派清算' });
  }
  // compassion·议题 penal-harsh·即便异党异立场·强 soften
  if (dims.compassion >= 0.5 && tags.indexOf('penal-harsh') >= 0) {
    forceCandidates.push({ rank: dims.compassion, mode: 'soften', reason: 'compassion ≥0.5 + penal-harsh·仁善慎刑' });
  }
  // vengefulness·target = 旧仇
  if (dims.vengefulness >= 0.7 && item && item.target && _cc3_wasHarmedBy(gmCh, item.target)) {
    forceCandidates.push({ rank: dims.vengefulness, mode: 'rebut', reason: 'vengefulness ≥0.7 + target=旧仇·必驳' });
  }
  // boldness·target = self·自辩硬刚
  if (dims.boldness >= 0.7 && item && item.target === gmCh.name) {
    forceCandidates.push({ rank: dims.boldness, mode: 'lead', reason: 'boldness ≥0.7 + target=self·硬刚自辩' });
  }
  // greed·议题涉自身/亲族利益 — runtime 难判·仅 reward-distribution tag 替代
  if (dims.greed >= 0.5 && tags.indexOf('reward-distribution') >= 0) {
    forceCandidates.push({ rank: dims.greed, mode: 'second', reason: 'greed ≥0.5 + reward·主动争取' });
  }

  if (forceCandidates.length) {
    forceCandidates.sort((a, b) => b.rank - a.rank);
    result.mode = forceCandidates[0].mode;
    result.modifiers.force = true;
    result.modifiers.reason = forceCandidates[0].reason;
    // 仍可能加 cite·下一步判
  }

  // ─── cite modifier (不替换 mode·补 modifier) ───
  if (dims.rationality >= 0.5 && tags.indexOf('historicalPrecedent') >= 0) {
    result.modifiers.cite = true;
  }

  // ─── 弱修正·只在 force=false 时生效·按 仁善 > 复仇 > 理性 > 名节 > 社交 顺序 ───
  if (!result.modifiers.force) {
    // compassion ≥ 0.3·base rebut + oppStanceCount < 3 → soften
    if (mode === 'rebut' && dims.compassion >= 0.3 && (!state || state.oppStanceCount < 3)) {
      result.mode = 'soften';
      result.modifiers.reason = 'compassion ≥0.3·base rebut → soften·阵营未失势';
    }
    // vengefulness ≥ 0.5·上一位曾损害本人·second/augment → rebut
    else if ((mode === 'second' || mode === 'augment') && dims.vengefulness >= 0.5 && state && state.lastSpeaker) {
      if (_cc3_wasHarmedBy(gmCh, state.lastSpeaker)) {
        result.mode = 'rebut';
        result.modifiers.reason = 'vengefulness ≥0.5 + last=旧仇·second/aug → rebut';
      }
    }
    // sociability ≥ 0.5·alliesLost ≥ 2 + base rebut → soften (找台阶)
    else if (mode === 'rebut' && dims.sociability >= 0.5 && state && state.alliesLost >= 2) {
      result.mode = 'soften';
      result.modifiers.reason = 'sociability ≥0.5 + alliesLost ≥2·找台阶 → soften';
    }
    // energy ≥ 0.5·execution-detail tag·augment / pivot → pivot to specific
    else if ((mode === 'augment' || mode === 'pivot') && dims.energy >= 0.5 && tags.indexOf('execution-detail') >= 0) {
      result.mode = 'pivot';
      result.modifiers.reason = 'energy ≥0.5 + execution-detail·提具体方案';
    }
  }

  return result;
}

/**
 * 5 tone·按 rank / class 选语气层
 * 不改 mode·只调语言风格
 */
function _cc3_pickTone(gmCh) {
  if (!gmCh) return 'default';
  if (gmCh.class === 'kdao')  return 'righteous';  // 言官·激烈
  if (gmCh.class === 'wuchen') return 'martial';   // 武臣·粗朴
  if (gmCh.class === 'houfei') return 'decorum';   // 后妃·婉转
  if (typeof gmCh.rank === 'number' && gmCh.rank <= 2) return 'gravitas';  // 阁臣·稳重
  if (typeof gmCh.rank === 'number' && gmCh.rank >= 5) return 'procedural';// 郎官以下·程序化
  return 'default';
}

/**
 * 朝堂语 instruction 库·6 mode × 池
 * 每 mode 给 2-3 个开头池 + 1-2 个结句池·LLM 任选风格
 */
const _CC3_PHRASE_POOLS = {
  lead: {
    opens: ['"陛下·臣窃以为..."', '"陛下·臣有一议·愿陈之..."', '"启奏陛下·臣谨议..."'],
    closes: ['"伏乞圣裁"', '"伏惟陛下察焉"', '"臣谨奏闻"'],
    structure: '开门见山·提出你的主张并给出 1 条理由',
    requireWords: ['臣'],   // 不再强制"陛下"·君上称谓依【称谓感知】本朝语境(宋→官家)
    requireEither: ['窃以为', '有一议', '谨议', '愚以为'],
    requireClose: ['圣裁', '察焉', '奏闻', '俯纳'],
    example: '陛下·臣窃以为边镇之危·非一日之积。若不即拨饷增兵·恐有崩溃之患。伏乞圣裁。',
    selfCheck: ['是否含"臣"+本朝君上称谓(依称谓感知·如宋作官家·勿硬套陛下)', '是否以"窃以为/有一议/谨议"之类开题', '是否给出 1 条具体理由 (非空泛)', '结句是否含"圣裁/察焉/奏闻"'],
  },
  second: {
    opens: ['"臣附 X 之议·"', '"X 公所言甚是·臣亦以为..."', '"X 公已具陈·臣略补一条..."'],
    closes: ['"不啻 X 之言·愿陛下俯纳"', '"附 X 公之议·伏乞圣裁"'],
    structure: '复述 X 论点 1 句 + 1 条新理由 / 案例·不可全文重复其说',
    requireWords: ['附', 'X'],  // X 会被 lastSpeaker 替换
    requireEither: ['附议', '所言甚是', '亦以为', '正合臣意'],
    requireClose: ['俯纳', '圣裁', '察焉'],
    example: '臣附李公之议·李公方言"宗庙犹存·岂可南幸"·诚为正论。臣再补一条·汴京一失·河朔豪杰必散。愿陛下俯纳。',
    selfCheck: ['是否含"附议/亦以为/所言甚是"附议词', '是否复述 X 论点 1 句', '是否补充 1 条新理由 (非全文重复)', '是否点 X 的名字'],
  },
  rebut: {
    opens: ['"臣窃以为 X 所言未当·"', '"X 公方言...·然臣 不敢同其议..."', '"X 公此论·臣有惑焉..."'],
    closes: ['"伏惟陛下明察·勿堕其策"', '"愚见如此·伏乞圣裁"', '"伏乞陛下察其谬"'],
    structure: '先复述 X 论点 1 句·再用"然/惟/不敢同/未当"转折·给反驳理由 1-2 句',
    requireWords: ['X'],  // X 会被 lastSpeaker 替换·rebut 必须点名
    requireEither: ['然', '惟', '不敢同', '未当', '臣有惑', '臣窃以为不可'],  // 必含转折之一
    requireClose: ['明察', '勿堕', '察其谬', '圣裁'],
    forbidden: ['陛下圣明', '诚为至论', '确为正论'],  // rebut 禁出现空泛附和
    example: '黄相方言"扬州可幸"·然臣窃以为未当。汴京未陷·宗庙犹存·岂可一去千里？金人闻之·必谓宋有畏心。伏惟陛下明察·勿堕其策。',
    selfCheck: ['是否复述对方论点 1 句 (含引号或冒号)', '是否含转折词"然/惟/不敢同/未当"之一', '是否给出 ≥1 条反驳理由 (非空泛)', '是否点名对方', '结句是否含"明察/勿堕/察其谬"'],
  },
  soften: {
    opens: ['"X 公忠悃可嘉·惟..."', '"X 公此心拳拳·然臣愚以为..."', '"X 公所议出于公心·惟一节有疑..."'],
    closes: ['"望陛下兼听·权宜处之"', '"伏乞陛下并察"', '"望陛下圣裁兼采"'],
    structure: '先肯定 X 动机或忠诚 1 句 (用"忠悃/拳拳/出于公心")·再婉言陈己见',
    requireWords: ['X'],
    requireEither: ['忠悃', '拳拳', '公心', '此心', '出于'],  // 必含肯定 X 动机的词
    requireClose: ['兼听', '并察', '兼采', '权宜'],
    example: '宗公忠悃可嘉·一片孤忠诚为可敬。惟今金兵迫近·若死守汴梁恐被困城中。望陛下兼听·权宜处之。',
    selfCheck: ['是否先肯定 X 动机/忠诚 1 句', '是否含"忠悃/拳拳/公心/此心"之一', '是否含转折"惟/然"', '是否给出己见', '结句是否含"兼听/并察/兼采"'],
  },
  pivot: {
    // 2026-05-23 fix·扩 opens 10 句·删 "诸臣所议皆当" 高频套话
    opens: [
      '"此议尚有一端未及..."',
      '"事关 X·或可交 Y 部详议..."',
      '"臣窃以为·此事宜先交有司勘明..."',
      '"前议甚详·然有一节·宜专议..."',
      '"臣观此议·建议先交户部 / 兵部 / 礼部勘报..."',
      '"案此·尚有一节未明·宜专责一员..."',
      '"陛下·臣以为·此事须先勘报·再议..."',
      '"臣愚以为·此议宜分两节·先...后..."',
      '"前议未及之处·臣略陈宜专责..."',
      '"案此·宜先勘明 X·再议 Y..."'
    ],
    closes: ['"俟有定论·再呈陛下"', '"伏乞陛下命有司详议"', '"伏祈陛下察议"'],
    structure: '提议题未被讨论的侧面·或建议交某部 / 三法司 / 都察院 / 户部 再议·避免直接表态·**必含具体部门名 + 具体待勘事项**',
    requireEither: ['尚有', '未及', '另有', '交.{0,3}部', '交有司', '详议', '勘报', '专议', '专责'],
    requireClose: ['有司', '俟有定论', '详议', '勘报', '察议'],
    forbidden: [
      '臣以为应',         // pivot 禁鲜明立场
      '臣坚决主张',
      '诸臣所议皆当',     // 高频套话·禁
      '诸臣所议皆有理',
      '前文已多有陈说'
    ],
    // 5 example 分发
    example: [
      '此议尚有一端未及·禁旅兵粮可支几日尚未勘明。请陛下命兵部户部详议·俟有定论·再呈陛下。',
      '案此·尚有一节未明·某镇近月催饷三次·宜专责户部勘报·再议。',
      '事关诸边·或可交兵部 + 户部会议·勘明各镇粮草余存·再定优先次序。伏乞陛下命有司详议。',
      '臣愚以为·此议宜分两节·先勘明各部欠饷数·再议如何补给。伏祈陛下察议。',
      '前议甚详·然有一节·宜专责有司先按察漕运实情·再议海运是否可行。俟有定论·再呈陛下。'
    ],
    selfCheck: [
      '是否含 "尚有 / 未及 / 另有 / 专议 / 专责" 提新侧面',
      '是否建议交某部 / 有司详议 (必含具体部门名)',
      '是否避免直接战和表态',
      '是否避开 "诸臣所议皆当" / "诸臣所议皆有理" 等高频套话',
      '结句是否含 "详议 / 勘报 / 俟定论 / 察议"'
    ],
  },
  augment: {
    // 2026-05-23 fix·删 "诸臣所议皆有理" / "前文已多有陈说" 高频套话·扩 15 句轮替
    opens: [
      '"案此事·尚有一隅未及..."',
      '"臣窃见前议·缺一关键..."',
      '"臣略备一议·与诸公参..."',
      '"臣观此议·尚有数事可补..."',
      '"前议未及者·臣谨陈..."',
      '"诸公所论·臣略附数语..."',
      '"陛下·臣有数事·恐前议未及..."',
      '"臣案此事·有一隅·诸公或未察..."',
      '"臣窃以为·尚需补一议..."',
      '"案前文·有一未明处·臣略言之..."',
      '"臣略备一议·非敢与诸公争..."',
      '"前议甚详·然臣仍有一议..."',
      '"臣观此议·有一节·宜进一步勘明..."',
      '"案此·尚需一议..."',
      '"诸公论已尽·臣略陈一隅..."'  // 原 3 旧句保留 1 句作变体
    ],
    closes: ['"伏惟陛下察焉"', '"愿与诸臣共商"', '"伏祈陛下俯察"', '"伏请陛下圣裁"'],
    structure: '补充一个未被前文提及的【具体视角】·**必须含 1+ 具体名词 (兵名 / 粮草数 / 边镇名 / 人名 / 数字 / 日期 / 部门)**·禁纯虚词附议·禁全文重复前位',
    requireEither: ['尚有', '补一议', '略陈', '一议', '未及', '尚需', '一节', '一隅'],
    requireClose: ['察焉', '共商', '俯察', '圣裁'],
    forbidden: [
      '诸臣所议皆有理',       // 高频套话·禁
      '前文已多有陈说',       // 高频套话·禁
      '诸臣所议皆当',         // pivot 套话漏到此·禁
      '臣所议皆有理',         // 变体·禁
      '诸公所议皆有理'        // 变体·禁
    ],
    // 5 example 按 topic 分发·避全 LLM 学同 1 个
    example: [
      '臣窃见·边镇兵粮可支三月·然要塞粮仓近罄·若延误半月·军心必乱。臣略陈此一议。伏惟陛下察焉。',
      '前议甚详·然臣仍有一议·某镇守将本月内三次催饷·若不应·恐将士寒心。伏惟陛下察焉。',
      '诸公论已尽·臣略陈一隅·京师米价已涨三倍·用度若不收缩·恐生民变。伏惟陛下察焉。',
      '案此事·尚有一隅未及·某言官近日所上劾权幸一疏·与本议有关·宜并审之。伏祈陛下俯察。',
      '臣略备一议·与诸公参·漕运近来缺船·若转输不通·三月内南粮不能至京。伏请陛下圣裁。'
    ],
    selfCheck: [
      '是否提供 1+ 具体名词 (兵 / 粮 / 钱 / 边镇名 / 人名 / 数字)·非纯虚词',
      '是否避开 "诸臣所议皆有理" / "臣前文已多有陈说" / "诸臣所议皆当" 等高频套话',
      '是否避免全文重复前位发言',
      '结句是否含 "察焉 / 共商 / 俯察 / 圣裁"'
    ],
  },

  // ═══════════════ v2.6 Slice 5·廷议特化 4 mode (confront / cite_classic / clientelism / martyr) ═══════════════
  // 按常朝 8 字段 paradigm·跟上 6 mode 一致 (opens / closes / structure / requireEither / requireClose / forbidden / example / selfCheck)
  // 复用前提·廷议跟常朝共用 _cc3_buildModeInstruction·因此可放在同 MODES_TEMPLATE 内
  confront: {
    opens: [
      '"X 公此论·恕臣不能附"',
      '"X 公方才所言"',
      '"愿与 X 公辩之"',
      '"X 公适才之论·臣有数处不能附"',
      '"X 公此说·恐未尽是·臣略辩一二"',
      '"X 公方才所陈·与臣所见相左"',
      '"窃以为 X 公之论·尚有商榷之处"',
      '"X 公之议·虽出公心·然臣不能默"',
      '"敢请 X 公·容臣一辩"',
      '"X 公此言·恐失之偏"',
      '"X 公论锐·然臣有 X 处不能附"',
      '"臣以为 X 公此议·失之 X (操切/迂腐/...)·略陈一二"'
    ],
    closes: ['"伏请陛下察"', '"伏惟圣鉴"', '"惟陛下裁断"', '"敢请陛下听臣此辩"'],
    structure: '直接点名 {targetName}·正面驳其论·**必含 1+ 具体论点反驳** (数 / 例 / 古今对照 / 后果分析)·禁空泛附议·禁不指名',
    requireEither: ['具体论点反驳', '历史先例对比', '数据 / 后果分析'],
    requireClose: ['察', '圣鉴', '裁断', '听臣此辩'],
    forbidden: ['空泛附议', '不指名', '我亦如是', '诸臣所议皆有理'],
    example: [
      '某公方才言重狱有功·然臣按律考之·三月狱中有 12 人无供而毙·此非"有功"·乃失驭。伏请陛下察。',
      '某公方才论宜据守孤城·然臣观舆图·此城孤悬·若无后军接应·恐重蹈前役覆辙。伏惟圣鉴。',
      '某公议主和·然臣观敌意·非真和也·乃缓我备战。岁内强敌已三次南下·岂可再信。惟陛下裁断。',
      '某公方才言宜宽权幸旧党·然彼当政时·横死诏狱者凡 6 人·此仇未报·何谈宽宥。伏请陛下察。',
      '某公此议虽出公心·然臣以为不可·边镇每月饷银 12 万·若再加调·京师月入仅 18 万·恐有断粮之危。敢请陛下听臣此辩。'
    ],
    selfCheck: ['是否真点名对方', '是否含 1+ 具体论点反驳 (数 / 例 / 后果)', '是否避空泛附议', '是否非"我亦如是"套话']
  },

  cite_classic: {
    opens: [
      '"《尚书》云"',
      '"《大学衍义》载"',
      '"昔者..."',
      '"《通鉴》载..."',
      '"《左传》有云..."',
      '"《孟子》尝言..."',
      '"按《周礼》..."',
      '"《史记》载..."',
      '"洪范九畴·有曰..."',
      '"昔太祖立国之初..."',
      '"昔魏徵之于太宗·有言..."',
      '"昔诸葛武侯出师·尝陈..."'
    ],
    closes: ['"伏祈陛下鉴此古训"', '"愿陛下取法古人"', '"伏请陛下追述"', '"以古为鉴"'],
    structure: '援经引典·**必含书名** (《尚书》《大学衍义》《通鉴》《左传》《孟子》等)·1 经 + 1 史·禁现代词汇·禁无出处',
    requireEither: ['书名', '"昔者" / "古人"'],
    requireClose: ['鉴此', '取法', '追述', '为鉴'],
    forbidden: ['现代词汇', '无书名', '无出处', '空白引经'],
    example: [
      '《尚书·洪范》云：唯辟作福·唯辟作威。陛下若委此权于近幸·乃辟权下移·非治道也。伏祈陛下鉴此古训。',
      '昔诸葛武侯出师·誓诛奸佞·正风纪。今用事之权阉·蠹国已甚·其罪岂可不诛。愿陛下取法古人。',
      '《孟子》尝言：民为贵·社稷次之·君为轻。今近畿大旱·百姓菜色·若再加征赋·恐失民心。伏请陛下追述。',
      '昔魏徵之于太宗·有言：兼听则明·偏信则暗。今独委权一党·有偏信之嫌。以古为鉴。',
      '《通鉴》载汉宣帝中兴·先举贤良·后行变法。今宜先选官·勿急于改制。伏祈陛下鉴此古训。'
    ],
    selfCheck: ['是否含书名', '是否 1 经 1 史', '是否避现代词汇', '出处是否真 (非杜撰)']
  },

  clientelism: {
    opens: [
      '"先师 {mentorName} 之论"',
      '"门生不敢异于先师"',
      '"门人但奉先师所授"',
      '"先师 {mentorName} 议已尽·门人不敢异"',
      '"门生既受先师 {mentorName} 之教·岂敢违"',
      '"先师 {mentorName} 之言·门生服膺"',
      '"先师所示·门人未敢有他"',
      '"门生此议·实先师 {mentorName} 旧训"',
      '"门生奉先师之教·所论与先师同"',
      '"先师论此已周·门生附议"'
    ],
    closes: ['"门生再拜"', '"惟陛下察先师之心"', '"门人不敢有他议"', '"伏请陛下听门生此附"'],
    structure: '附议师·**必含 mentor 名**·"先师 X 论已尽·门人不敢异"·禁直接反驳师·禁立独议',
    requireEither: ['mentor 名', '"门生" / "门人"'],
    requireClose: ['再拜', '察先师', '有他议', '听门生'],
    forbidden: ['直接反驳师', '"先师此议恐未尽" 之类否定', '立独议'],
    example: [
      '先师某公尝论朋党之弊·门生不敢异。今所议·先师所未及·然以先师风骨·必应主严办。门生再拜。',
      '先师方才所陈钱粮事·门人但奉所授·略附数语·边镇兵饷今急·宜按先师议先调其半。惟陛下察先师之心。',
      '先师素以恢复为志·门生岂敢与异。今强敌压境·必战不可和·门生奉师议。门人不敢有他议。',
      '先师之论考课之法·门生服膺·今宜复其旧·以察吏治。门生再拜。',
      '门生既受先师之教·岂敢违·此议实先师旧训·门人附议而已。伏请陛下听门生此附。'
    ],
    selfCheck: ['是否含 mentor 名 (替换 {mentorName})', '是否含 "门生" 或 "门人"', '是否避直接反驳师', '结句是否含 "再拜" / "察先师" 之类']
  },

  martyr: {
    opens: [
      '"臣愿伏阙"',
      '"臣冒死直谏"',
      '"以死谏陛下"',
      '"臣不惧斧钺·愿一言之"',
      '"臣虽万死·不敢欺陛下"',
      '"陛下若不听·臣愿撞死阶下"',
      '"臣以血书此疏·伏请陛下察"',
      '"臣身之所悬·惟天与陛下"',
      '"臣闻直臣不避死·愿冒万死一谏"',
      '"臣此言出·必触怒陛下·然臣不敢不言"',
      '"宁可碎首·不肯顺非"',
      '"臣愿以颈血·溅此朝堂"'
    ],
    closes: ['"虽千万人吾往矣"', '"臣不惧斧钺"', '"惟陛下取臣首"', '"臣以此万死·乞陛下察"'],
    structure: '言官冒死直谏·**尖锐 + 不留余地**·必含 honor-driven 言辞·必含死字 / 诛字 / 斧钺·直陈陛下错',
    requireEither: ['"死" / "诛" / "斧钺" / "万死"', '"陛下" + 直陈错 (如 "陛下纵奸" / "陛下偏听")'],
    requireClose: ['吾往矣', '不惧斧钺', '取臣首', '万死'],
    forbidden: ['含糊', '迂回', '"伏惟陛下察焉" 等温和套话', '空骂无据'],
    example: [
      '臣愿伏阙·陛下委权近幸·必致天下倾覆。若不去此奸·则士心尽失·宁可碎首·不肯顺非·虽千万人吾往矣。',
      '臣冒死直谏·陛下偏听私党·已三月不纳直言。臣此言出·必触陛下怒·然不言则负士林。宁可碎首·惟陛下取臣首。',
      '臣以血书此疏·边镇之败·非将不效命·乃饷不及时·责在有司。陛下若再迟·边军必反·臣不惧斧钺·乞陛下察。',
      '陛下若不听臣此谏·愿撞死阶下。今奸党羽翼布满诸曹·岂可再容。臣以此万死·乞陛下察。',
      '臣闻直臣不避死·愿冒万死一谏。和议必失故土·此耻遗千载之恨·虽千万人吾往矣。'
    ],
    selfCheck: ['是否含死字 / 诛字 / 万死 / 斧钺', '是否直陈陛下错 (非含糊)', '是否避温和套话 (察焉 / 共商)', 'cooldown·1 议题 1 次 (Slice 6 RULES 强制)']
  }
};

const _CC3_TONE_HINTS = {
  gravitas:   '语气稳重委婉·先复对方论点 2 句以示尊重·再陈己见·末加"伏乞圣裁"',
  procedural: '不直接驳·宜建议"交 [部/院] 详议"·或"请陛下命有司勘查"',
  righteous:  '言官风骨·直陈不讳·可点名对方·语气激烈但不失体·朝堂语带"风闻奏事"',
  martial:    '武臣口吻·粗朴直白·少修辞·多军事术语·短句·避免文饰·自称"末将"',
  decorum:    '自抑·先言"妾不当与议"·后言"惟臣妾愿陈一二"·语气婉转重礼',
  default:    '标准朝堂奏对体·"臣……"开头',
};

/**
 * 拼装 prompt 段·6 mode × 5 tone × cite modifier
 * v3.1 polish·加 verb pool / forbidden / example / 自检·从弱约束改强约束
 * 返字符串·拼到 _cc3_aiGenReact 原 prompt 后
 */
function _cc3_buildModeInstruction(modeResult, tone, state, gmCh) {
  const mode = modeResult.mode;
  const pool = _CC3_PHRASE_POOLS[mode] || _CC3_PHRASE_POOLS.augment;
  const toneHint = _CC3_TONE_HINTS[tone] || _CC3_TONE_HINTS.default;

  // mode-specific opener·若 state 含 lastSpeaker·替换 X
  // ★修张冠李戴:参照人按 mode 选·second(附议)→同立场锚 refSame·rebut/soften/confront(驳斥)→异己锚 refOpp(均优先主奏人)·余 mode 沿用 lastSpeaker
  let _refName = state && state.lastSpeaker ? state.lastSpeaker : '前位';
  if (state) {
    if (mode === 'second' && state.refSame) _refName = state.refSame;
    else if ((mode === 'rebut' || mode === 'soften' || mode === 'confront') && state.refOpp) _refName = state.refOpp;
  }
  const lastName = _refName;
  // v2.6 polish·Round 5·clientelism mode·{mentorName} 真替换·非 literal text 留 prompt
  const mentorName = (gmCh && gmCh.mentor) || (state && state.mentorName) || '先师';
  const _swap = function(s) { return String(s || '').replace(/X/g, lastName).replace(/\{mentorName\}/g, mentorName); };
  const opens = pool.opens.map(_swap).join(' / ');
  const closes = pool.closes.map(_swap).join(' / ');
  // 2026-05-23 fix·example 支持 string | string[]·数组时随机挑 1·避全 LLM 学同 1 个 (augment / pivot 已改 array)
  let example;
  if (Array.isArray(pool.example)) {
    const pick = pool.example[Math.floor(Math.random() * pool.example.length)];
    example = _swap(pick);
  } else {
    example = _swap(pool.example);
  }

  let p = '\n── 你的应答策略·必须严格遵守 ──\n';
  p += '【模式·' + mode + '·rebut=驳斥 / second=附议 / soften=缓和 / pivot=转移 / augment=补充 / lead=首发 / confront=对质 / cite_classic=援典 / clientelism=门生附师 / martyr=死谏】\n';
  // v2.6 polish·Round 5·structure 也 {mentorName} 替换 (clientelism mode)
  p += '内容范式·' + _swap(pool.structure) + '\n';
  p += '【语气】' + toneHint + '\n';

  // ── 必含词约束 ──
  if (Array.isArray(pool.requireEither) && pool.requireEither.length) {
    const reqList = pool.requireEither.map(w => '"' + _swap(w) + '"').join(' / ');
    p += '【必含·开题转折】回应中至少含以下之一·' + reqList + '\n';
  }
  if (Array.isArray(pool.requireClose) && pool.requireClose.length) {
    const closeList = pool.requireClose.map(w => '"' + w + '"').join(' / ');
    p += '【必含·结句】结句须含以下之一·' + closeList + '\n';
  }
  if (Array.isArray(pool.forbidden) && pool.forbidden.length) {
    p += '【禁止】不得出现·' + pool.forbidden.map(w => '"' + w + '"').join(' / ') + '\n';
  }

  // ── 候选开头/结句池 (示例·非强制) ──
  p += '朝堂语开头候选·' + opens + '\n';
  p += '朝堂语结句候选·' + closes + '\n';
  // ★引名务确·防张冠李戴(second/rebut/soften/confront 会点名对方)
  if (state && (mode === 'second' || mode === 'rebut' || mode === 'soften' || mode === 'confront') && lastName && lastName !== '前位') {
    p += '【引名务确】本议主奏为「' + (state.presenterName || '') + '」·你' + (mode === 'second' ? '附议(同调)' : '驳斥(异议)') + '的对象是「' + lastName + '」·凡引某人之言必系于其本人·切勿张冠李戴（勿把甲之奏折/原话安到乙头上）\n';
  }

  // ── few-shot example (1 句完整结构) ──
  if (example) {
    p += '【完整范例】(结构参照·勿照抄词汇)·\n  「' + example + '」\n';
  }

  // ── cite modifier ──
  if (modeResult.modifiers.cite) {
    p += '【援引】此议有先例可援·你理性高·可在论述中带入一段史事 (如汉光武渡江 / 唐玄宗幸蜀)·作类比·末加"古今同道·惟陛下察焉"\n';
  }
  // force reason debug
  if (modeResult.modifiers.force) {
    p += '【强约束·' + (modeResult.modifiers.reason || '强制') + '】\n';
  }

  // dims source debug (只在 fallback 时标·便于 sprint summary 对比)
  if (modeResult.modifiers.source === 'personality-text-fallback') {
    p += '【debug·persona dims 来自 personality 字符串 fallback·非 traitIds 聚合】\n';
  }

  // ── 自检 ──
  if (Array.isArray(pool.selfCheck) && pool.selfCheck.length) {
    p += '【生成后自检·任一为否则重写】\n';
    pool.selfCheck.forEach((q, i) => {
      p += '  ' + (i + 1) + '. ' + q.replace(/X/g, lastName) + '\n';
    });
  }

  p += '\n你必须严格遵循上述「' + mode + '」模式·上述【必含】【禁止】【自检】是硬约束·脱离 = 生成失败·须重写。\n';

  return p;
}

// ============================================================
// 常朝大改 Slice 6·anti-monotony guards + NPC-NPC AffinityMap linkage
// ============================================================

/**
 * 4 anti-monotony guards·防 mode 分布塌缩
 *
 * @param {string} mode  — modulated mode
 * @param {Object} item  — 议程·读 selfReact / debate 已有 mode 分布
 * @param {string} role  — 'self' | 'debate' | 'debate2'
 * @param {string} lastMode — 上一位 NPC 的 mode (若 prior 有 _mode 字段)
 * @returns {string} final mode·可能被 guards 改写
 */
function _cc3_applyModeGuards(mode, item, role, lastMode) {
  // 收集本议程 prior 已有 mode
  const modesSoFar = []
    .concat((item.selfReact || []).map(r => r && r._mode).filter(Boolean))
    .concat((item.debate || []).map(d => d && d._mode).filter(Boolean));
  const counts = {};
  modesSoFar.forEach(m => { counts[m] = (counts[m] || 0) + 1; });

  // 2026-05-23 fix·Guards 解吸盘·augment 不再吸所有 mode·分流到 pivot / soften
  // Guard 1·同 mode ≥ 3·改其他相容 mode (分流·非全转 augment)
  if (counts[mode] >= 3) {
    if (mode === 'rebut')   return 'soften';
    if (mode === 'second')  return 'soften';   // 改·原 augment
    if (mode === 'pivot')   return 'augment';  // 保留·pivot→augment 是合理 (都补充类)
    if (mode === 'augment') return 'pivot';    // 新加·augment 自身也 cap·避全场塌缩
    // lead 只可能首位·不会触发
  }

  // Guard 2·避免连续同 mode·40% 换非 augment 同价 mode (分流·避吸盘)
  if (mode === lastMode) {
    if (Math.random() < 0.4) {
      // 分流 map·augment 不再是统一兜底
      const altMap = {
        rebut:   'soften',
        second:  Math.random() < 0.5 ? 'pivot' : 'augment',  // 50/50 分流
        pivot:   'augment',
        augment: 'pivot',   // 改·augment 改换 pivot·非自循环
        soften:  Math.random() < 0.5 ? 'pivot' : 'rebut'     // 加 soften 分流
      };
      return altMap[mode] || mode;
    }
  }

  // Guard 3·debate2 第二轮·rebut → soften (50%)·lead → second (改·原 augment)
  if (role === 'debate2') {
    if (mode === 'rebut' && Math.random() < 0.5) return 'soften';
    if (mode === 'lead') return 'second';  // 改·原 augment·让第二轮 lead 真附议同党
  }

  return mode;
}

/**
 * Guard 4·cite cooldown·已 ≥ 2 个 cite·70% drop
 */
function _cc3_capCite(citeFlag, item) {
  if (!citeFlag) return false;
  const citesSoFar = []
    .concat((item.selfReact || []).filter(r => r && r._cite))
    .concat((item.debate || []).filter(d => d && d._cite))
    .length;
  if (citesSoFar >= 2) {
    return Math.random() < 0.3;  // 70% 丢
  }
  return true;
}

// ============================================================
// 常朝大改·Slice 9·Tier 2·层 5 累积参考 + 层 6 皇帝 cue·2026-05-22
// ============================================================

/**
 * 层 5·累积参考 hint·读 state·返 prompt 段
 * 3 个触发场景·alliesPiledOn ≥ 3 / oppStanceCount ≥ 3 / momentum=consensus-against-me
 * 返空字符串表示无 hint·不影响 prompt
 *
 * @param {Object} state — _cc3_analyzeDebate 返的 state
 * @param {Object} gmCh  — 当前 NPC 数据
 * @param {Object} item  — 议程项
 */
function _cc3_cumulativeHint(state, gmCh, item) {
  if (!state) return '';
  const hints = [];

  // 场景 A·阵营同声·≥ 3 人同党同立场·后续 NPC 应精炼
  if (state.alliesPiledOn >= 3) {
    hints.push('【累积参考·阵营同声】本议题已有 ' + state.alliesPiledOn + ' 位同党表态于"' + (state.myStance || '?') + '"。你不必从头陈词·精炼一句·补一小点新角度。朝堂语转向"一字千钧"·开头如"诸臣所论·臣不敢复赘·臣只一言"·正文短·避免重复同党论据。');
  }

  // 场景 B·势单·对面阵营 ≥ 3·宜 soften / pivot
  if (state.oppStanceCount >= 3 && state.alliesPiledOn < 2) {
    hints.push('【累积参考·势单】本议题已有 ' + state.oppStanceCount + ' 位反对你的立场·而你阵营仅 ' + (state.alliesPiledOn || 0) + ' 人附议。处势单·宜 soften 寻台阶 / pivot 转具体方案。强硬死撑会被群言压倒·除非 honor / vengefulness 极高方可凛然 lead。');
  }

  // 场景 C·共识相反·辩论压倒性 against me·宜 pivot 让步或死硬 lead
  if (state.momentum === 'consensus-against-me') {
    hints.push('【累积参考·共识相反】辩论已形成压倒共识·近 3 位发言中至少 2 位跟你立场相反。宜 pivot 到"暂行 + 徐图"类让步点·或若 honor / vengefulness 极高·则死硬 lead·凛然不让·朝堂语带"虽千万人吾往矣"之气。');
  }

  return hints.length ? '\n\n── 累积参考 (层 5·Tier 2) ──\n' + hints.join('\n') : '';
}

/**
 * 层 6·皇帝意图 cue·读 item._lastEmperorIntent (上一议题写入)·返 prompt 段
 * 影响后续 NPC 对"皇帝刚做了什么"的感知
 *
 * @param {Object} item — 议程项·_lastEmperorIntent 字段
 * @param {Object} state — debate state·含 myStance·用于判断同党 vs 政敌
 */
function _cc3_emperorCueHint(item, state) {
  const cue = item && item._lastEmperorIntent;
  if (!cue || !cue.intent || cue.intent === 'neutral') return '';
  const targetStr = cue.target ? ('·目标=' + cue.target) : '';
  const fromTitle = cue.fromItemTitle || '前议';
  const intentDesc = {
    'praise': '陛下嘉奖 / 准奏了上一议' + (cue.target ? '·重点褒奖 ' + cue.target : '') + '。若你为同党或附议方·可借势 second / augment·朝堂语带"圣明烛照"开篇。若你为政敌方·谨慎反驳·不可正面攻击·宜转 mediate / pivot 提"另有所虑"。',
    'punish': '陛下训斥 / 驳回了上一议' + (cue.target ? '·重点训斥 ' + cue.target : '') + '。若你为政敌方·借势 rebut last speaker·朝堂语用"圣明烛照·X 所言果如圣谕..." / "陛下英断" 开篇。若你为同党方·宜 soften 找台阶·勿步后尘·朝堂语用"X 所论容有未谛·非其本心..." 缓颊。',
    'doubt': '陛下留中 / 转议了上一议' + (cue.target ? '·涉 ' + cue.target : '') + '。表示陛下未决·你可补具体执行细节给陛下定夺·mode 偏 supplementary / pivot·勿再争是非·应陈方略。'
  }[cue.intent] || '';
  if (!intentDesc) return '';
  return '\n\n── 皇帝意图 cue (层 6·Tier 2) ──\n【上一议·' + fromTitle + '·' + (cue.action || '?') + targetStr + '·intent=' + cue.intent + '】\n' + intentDesc;
}

/**
 * action → intent 映射·写入 nextItem._lastEmperorIntent 时用
 * praise / punish / doubt / neutral
 */
function _cc3_actionToIntent(action) {
  if (action === 'approve' || action === 'praise' || action === 'decree') return 'praise';
  if (action === 'reject' || action === 'admonish') return 'punish';
  if (action === 'hold' || action === 'escalate' || action === 'refer' || action === 'modify') return 'doubt';
  // probe / summon → neutral·探询动作非情感
  return 'neutral';
}

/**
 * Slice 9 层 6 写入·把 emperor intent 传给 AGENDA[currentIdx + 1]
 * 在 _cc3_writeActionToGM 末尾调·只覆盖紧邻下一议题·避免污染 N+2 等更远议题
 *
 * @param {string} action — finalize 的动作名
 * @param {*} extra       — action 附带数据 (admonish/praise/summon 时 = NPC name)
 * @param {Object} curItem — 当前结束的议题
 */
function _cc3_writeNextItemEmperorIntent(action, extra, curItem) {
  const intent = _cc3_actionToIntent(action);
  if (intent === 'neutral') return;  // 探询/传召 不传 cue
  if (typeof state === 'undefined' || typeof AGENDA === 'undefined') return;
  const nextIdx = state.currentIdx + 1;
  if (nextIdx >= AGENDA.length) return;  // 末议题·无后继
  const nextItem = AGENDA[nextIdx];
  if (!nextItem) return;
  // 覆盖式写入·避免污染再下议题
  nextItem._lastEmperorIntent = {
    intent: intent,
    action: action,
    target: (typeof extra === 'string' && extra.length < 60) ? extra : null,
    fromItemIdx: state.currentIdx,
    fromItemTitle: (curItem && curItem.title || '').slice(0, 40),
    turn: (typeof GM !== 'undefined' && GM.turn) || 0,
    writtenAt: Date.now()
  };
}

/**
 * NPC-NPC consequence linkage·朝议塑造派系网而非消费完即烧
 * 在 _cc3_aiGenReact 末尾·LLM 返结果后追加
 *
 * AffinityMap 真 API·.add(a, b, delta, reason)·★对称无向图(key 按名排序)·单次调用即双向·勿调 2 次(会落同一条边叠加成双倍·2026-07-04 订正)
 * NpcMemorySystem.remember signature·positional·(name, text, '中文 emotion', weight, source)
 */
function _cc3_writeNpcInteraction(name, mode, lastSpeaker, item, controversial) {
  if (!lastSpeaker || lastSpeaker === name) return;
  if (typeof AffinityMap === 'undefined' || !AffinityMap.add) return;

  const intensity = (controversial >= 6) ? 3 : 2;
  const itemTitle = (item && item.title) || '议事';

  switch (mode) {
    case 'rebut':
      try {
        AffinityMap.add(name, lastSpeaker, -intensity, '常朝议事·' + name + '驳' + lastSpeaker);  // ★对称图·单次即双向(原调两次叠成 -2×intensity)
      } catch (_) {}
      break;
    case 'second':
      try {
        AffinityMap.add(name, lastSpeaker, +intensity, '常朝议事·' + name + '附议' + lastSpeaker);  // ★对称图·单次即双向(原另调 +1 落同边叠加)
      } catch (_) {}
      break;
    case 'soften':
      try {
        AffinityMap.add(name, lastSpeaker, +1, '常朝议事·' + name + '婉言劝' + lastSpeaker);
      } catch (_) {}
      break;
    // pivot / augment / lead / cite·不直接互动·不动 affinity
  }

  // memory·NPC 自己记得此事
  if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
    let verb, emotion, weight;
    if (mode === 'rebut') { verb = '驳'; emotion = '怒'; weight = 6; }
    else if (mode === 'second') { verb = '附议'; emotion = '喜'; weight = 4; }
    else if (mode === 'soften') { verb = '婉劝'; emotion = '平'; weight = 3; }
    else return;  // 其他 mode 不入 memory (避免噪音)
    try {
      NpcMemorySystem.remember(
        name,
        '常朝议事·' + verb + lastSpeaker + '于「' + itemTitle + '」',
        emotion,
        weight,
        lastSpeaker
      );
    } catch (_) {}
  }
}

// 入口·先试 AI 再回退 mock·支持流式 onChunk 回调
async function generateNpcReply(name, item, playerText, stance, intent, isMentioned, onChunk) {
  if (aiEnabled()) {
    try {
      const aiLine = await callAIPreview(buildNpcPrompt(name, item, playerText, stance, intent, isMentioned), onChunk);
      const cleaned = (aiLine || '').trim().replace(/^["「『]|["」』]$/g, '');
      if (cleaned.length >= 6) return cleaned;
    } catch (e) {
      setAiStatus('AI 失败 · 退 mock：' + (e.message || e), true);
    }
  }
  return generateNpcReplyMock(name, item, playerText, stance, intent, isMentioned);
}

function generateNpcReplyMock(name, item, playerText, stance, intent, isMentioned) {
  const ch = CHARS[name] || {};
  const isPresenter = (name === item.presenter);
  const isTarget = (name === item.target);
  const pBrief = (playerText || '').slice(0, 16).replace(/[。，！？·]/g, '');

  // ── intent 专属模板（覆盖通用模板）──
  if (isMentioned && isTarget) {
    return '臣 ' + name + ' 闻陛下点名 · 不敢隐避：陛下方才所言「' + pBrief + '」 · 实有未察 · 容臣再陈本末！';
  }
  if (isMentioned && !isTarget) {
    return '臣 ' + name + ' 蒙陛下点问 · 不敢不直陈：陛下方才之意「' + pBrief + '」 · 臣以为' + (stance === 'support' ? '正合时宜 · 陛下圣明。' : stance === 'oppose' ? '尚有可商榷之处 · 容臣具陈。' : '可参酌而行之。');
  }
  if (intent === 'inquire') {
    if (isPresenter) return '臣谨答陛下：' + (item.detail.split('，')[1] || item.detail).slice(0, 60) + '。陛下若再有疑 · 臣无所避。';
    return '陛下既问 · 臣 ' + name + ' 所知如此：' + (stance === 'support' ? '此事确有可行之处 · 臣愿副办。' : stance === 'oppose' ? '此事尚有未备 · 望陛下慎之。' : '此事进退两难 · 伏听圣裁。');
  }
  if (intent === 'punish') {
    if (isTarget) return '陛下！臣 ' + name + ' 不敢承此重责 · 臣自任职以来 · 实未尝有违 · 望陛下察臣本心 · 容臣分辩！';
    if (ch.class === 'kdao') return '臣 ' + name + ' 以言官身份附议陛下 · 此辈奸佞 · 当严办以正朝纲！';
    return stance === 'support' ? '陛下圣裁 · 臣等附议严办 · 以正朝纲。' : '陛下三思 · 严办之前 · 是否先令其自陈？';
  }
  if (intent === 'aggressive') {
    return stance === 'support' ? '陛下圣意刚断 · 臣 ' + name + ' 即办去 · 不敢有半日延误！' : '陛下三思！此举关乎大体 · 若骤然行之 · 恐有未周······';
  }
  if (intent === 'sympathetic') {
    return stance === 'support' ? '陛下念及百姓苦难 · 实为社稷之福。臣 ' + name + ' 愿为陛下分忧。' : '陛下圣怀仁厚 · 然此事处置不可全凭恻隐 · 须并察事理。';
  }
  if (intent === 'praise') {
    if (item.target) return '陛下嘉许之意 · 臣 ' + name + ' 代' + item.target + '谢恩。然亦望陛下慎察其行 · 方为公允。';
    return '陛下赞许 · 实为' + (isPresenter ? '臣' : (item.presenter || '某员')) + '之幸 · 当益自勉励 · 不负圣望。';
  }
  if (intent === 'doubt') {
    return '陛下既有疑 · 不可不察。臣 ' + name + ' 以为：' + (stance === 'support' ? '可先准之 · 后续再察。' : stance === 'oppose' ? '不如暂缓 · 待详查。' : '宜下廷议·三日回奏。');
  }

  // ── 通用立场化模板（与之前一致） ──
  const tplSupport = [
    '陛下圣明 · 臣' + (isPresenter ? '所奏' : '附议') + '。' + (pBrief ? '陛下既言「' + pBrief + '」 · 臣愈坚此见。' : ''),
    '臣谨遵圣意 · 此事可即办。',
    '陛下所言极是 · ' + item.title + ' 事可如是断。',
    '臣 ' + name + ' 愿为陛下督办此事。'
  ];
  const tplOppose = [
    '陛下三思 · 此事尚需斟酌。' + item.title + ' 牵涉甚多 · 恐有未及。',
    '臣不敢苟同 · ' + (pBrief ? '陛下言「' + pBrief + '」 · ' : '') + '然此事另有难处 · 容臣具陈。',
    '陛下所虑虽是 · 然事关大体 · 不宜轻断。',
    '臣以言官身份谨陈 · 此举或致他患。'
  ];
  const tplMediate = [
    '陛下与诸臣所论各有理据 · 臣愿陈一折中：' + item.title + ' 可分而行之。',
    '臣以为可两全其美 · ' + (pBrief ? '即遵陛下「' + pBrief + '」之意 · 兼顾他议。' : '请陛下听臣再陈。'),
    '兹事体大 · 不可独断 · 亦不可空议。臣请下廷议或部议 · 三日后回奏。'
  ];
  const tplNeutral = [
    '臣愚钝 · 不敢独断 · 伏听陛下圣裁。',
    '此事进退两难 · 臣随圣意。',
    '臣随班附议 · 不敢专擅。'
  ];
  const map = { support: tplSupport, oppose: tplOppose, mediate: tplMediate, neutral: tplNeutral };
  const arr = map[stance] || tplNeutral;
  return arr[Math.floor(Math.random() * arr.length)];
}

// 旧的通用模板部分被新版生成模板覆盖·下面这段已并入·保留空函数体作 stub
// (legacy 通用模板段已并入 generateNpcReplyMock 主体)

// ═══════════════════════════════════════════════
// AI 接入·OpenAI 兼容协议·复用主项目 localStorage.tm_api
// ═══════════════════════════════════════════════
function getAIConfig() {
  let cfg = {};
  try { cfg = JSON.parse(localStorage.getItem('tm_api') || '{}'); } catch(_){}
  return { key: cfg.key || '', url: cfg.url || '', model: cfg.model || '' };
}
function saveAIConfig(cfg) {
  try { localStorage.setItem('tm_api', JSON.stringify(cfg)); } catch(_){}
}
// v3 重写：aiEnabled 直接看 P.ai（v2 主项目已配 API）
function aiEnabled() {
  return _cc3_aiEnabled();
}
function setAiStatus(text, isErr) {
  // v3 在主项目内·无 ai-status 元素·改为 toast 或静默
  if (isErr && typeof toast === 'function') toast(text);
}

// v3 重写：callAIPreview 委托给 _cc3_callAI（走 v2 callAI tier 系统）·透传 onChunk
async function callAIPreview(prompt, onChunk) {
  return await _cc3_callAI(prompt, onChunk);
}

// 旧 fetch 实现保留为废弃函数·永不被调用
// (旧 _cc3_DEAD_callAIPreview·preview 自带 fetch 实现·已委托 _cc3_callAI·此处删除 ~50 行死代码)

// 构造朝堂 NPC 立场化回应 prompt
function buildNpcPrompt(name, item, playerText, stance, intent, isMentioned) {
  const ch = CHARS[name] || {};
  const stanceLabels = { support: '支持', oppose: '反对', mediate: '折中', neutral: '中立' };
  const intentLabels = {
    inquire: '询问情况·想了解细节',
    aggressive: '言辞激进·有强行推进/严办之意',
    mediate: '倾向折中调和·或要求分批办理',
    sympathetic: '表达对百姓/受害者的同情忧虑',
    punish: '意欲惩治某人或追究失职',
    praise: '嘉许某人某事',
    doubt: '心存疑虑·需臣劝导或申辩',
    neutral: '随意发问·态度中性'
  };

  // ─── B1 融合：从 GM 读真角色上下文（v2 character/personality/loyalty/记忆）───
  let gmCh = null;
  try { if (typeof findCharByName === 'function') gmCh = findCharByName(name); } catch (_) {}
  const personality = (gmCh && gmCh.personality) || '';
  const loyalty = (gmCh && typeof gmCh.loyalty === 'number') ? gmCh.loyalty : null;
  const integrity = (gmCh && typeof gmCh.integrity === 'number') ? gmCh.integrity : null;
  const ambition = (gmCh && typeof gmCh.ambition === 'number') ? gmCh.ambition : null;
  const family = (gmCh && gmCh.family) || '';
  const officialTitle = (gmCh && (gmCh.officialTitle || gmCh.title)) || ch.title || '';
  const stance2Player = (gmCh && gmCh.stanceToPlayer) || '';
  // ★2026-07-01 S2治「跨界面人格分裂」:改用统一 getMemoryContext(与问对/奏疏/廷议同源·含心绪/人生底色/要事/印象/伤疤)·
  //   而非 recall(3) 浅切片——同一人在常朝/问对读到同一份记忆与心性·人格一致。缓存·token 可控·无则回退旧切片。
  let memorySnippet = '';
  try {
    if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.getMemoryContext) {
      memorySnippet = NpcMemorySystem.getMemoryContext(name) || '';
    }
    if (!memorySnippet && typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.recall) {
      const memList = NpcMemorySystem.recall(name, 3);
      if (Array.isArray(memList) && memList.length) {
        memorySnippet = memList.map(m => '  - ' + (m.text || m.event || JSON.stringify(m).slice(0, 60))).join('\n');
      }
    }
  } catch (_) {}
  // 与陛下关系（OpinionSystem）
  let relationLine = '';
  try {
    if (typeof OpinionSystem !== 'undefined' && OpinionSystem.getEventOpinion) {
      const op = OpinionSystem.getEventOpinion(name, '玩家');
      if (op != null) relationLine = '与陛下关系值: ' + Math.round(op);
    }
  } catch (_) {}

  let p = '你是 ' + name + '·身份「' + officialTitle + '」·派系「' + (ch.faction || gmCh && gmCh.faction || '中立') + '」·品级 ' + (ch.rank || '?') + '。\n';
  if (personality) p += '性格：' + personality + '\n';
  const stats = [];
  if (loyalty != null) stats.push('忠诚 ' + loyalty);
  if (integrity != null) stats.push('清廉 ' + integrity);
  if (ambition != null) stats.push('野心 ' + ambition);
  if (stats.length) p += '能力数值：' + stats.join(' · ') + '\n';
  if (family) p += '家世：' + (typeof family === 'string' ? family : '世家出身') + '\n';
  if (stance2Player) p += '对陛下：' + stance2Player + '\n';
  if (relationLine) p += relationLine + '\n';
  if (memorySnippet) p += '【近期记忆】\n' + memorySnippet + '\n';
  // v2·PromptComposer·注入 phase 6 字段·让 cc3 NPC 真用 aiPersonaText / recognitionState
  if (typeof TM !== 'undefined' && TM.PromptComposer && gmCh) {
    try {
      const _aiP = TM.PromptComposer.buildAiPersonaText(gmCh);
      if (_aiP) p += _aiP;
      const _rec = TM.PromptComposer.buildRecognitionState(gmCh);
      if (_rec) p += _rec;
    } catch(_) {}
  }
  // v7.1·F4b·言官 attribution 注入·若 ch 是言官·补 mentor/cohort/strength prompt 块
  if (typeof _kjYanguanPromptHint === 'function' && gmCh) {
    try {
      const _yh = _kjYanguanPromptHint(gmCh);
      if (_yh) p += _yh + '\n';
    } catch(_) {}
  }
  p += '\n今日早朝·正议题「' + item.title + '」（' + (item.dept || '') + '上奏）。\n';
  p += '议题原文：' + (item.detail || item.content || item.title) + '\n\n';

  if (item.selfReact && item.selfReact.length) {
    p += '殿中已有臣表态：\n';
    item.selfReact.forEach(r => { p += '  ' + r.name + '：' + (r.line || '') + '\n'; });
  }
  if (item.debate && item.debate.length) {
    p += '议论中诸臣：\n';
    item.debate.slice(0, 4).forEach(d => { p += '  ' + d.name + '（' + (stanceLabels[d.stance] || '') + '）：' + (d.line || '') + '\n'; });
  }
  // 议论上下文·上一个发言者及其话（让 AI 理解"你说/其他人"指代）
  const lastSp = (typeof state !== 'undefined' && state._lastNpcSpeaker) || '';
  if (lastSp && lastSp !== name) {
    p += '【上一位发言者】' + lastSp + '（你之前·朝堂刚刚听其陈奏）\n';
  }

  p += '\n陛下方才说：「' + playerText + '」\n';
  if (intent && intent !== 'neutral') {
    p += '【陛下话语意图分析】' + (intentLabels[intent] || '') + '。请以此为基调回应。\n';
  }
  // 代词识别提示
  const refLast = /^(你说|请说|尔言|尔说|且言|且说|讲来|细言|说来|你来说|你具陈|你陈之|尔陈|尔续|尔再言)/.test((playerText || '').trim());
  const askOth = /其他人|余者|余下|其余|诸卿|众卿|他人|别人|余等|余卿/.test(playerText || '');
  if (refLast && lastSp === name) {
    p += '【重要】陛下用"你说/讲来"等词·实是指你（' + name + '·上一位刚发言）·须接续刚才所论·具体陈述细节·不可重复套话。\n';
  }
  if (askOth && lastSp && lastSp !== name) {
    p += '【重要】陛下问"其他人觉得呢"·暗示不复听' + lastSp + '·愿听他臣异见·你须给出与' + lastSp + '不同视角的看法·不可附和。\n';
  }
  if (isMentioned && !refLast) {
    if (item.target === name) {
      p += '【重要】陛下点名提及你（' + name + '·正是被指弹劾对象）·你须自辩。语气惶恐而坚定·不可空泛附和·须具体反驳。\n';
    } else {
      p += '【重要】陛下点名提及你（' + name + '）·你须直接领旨·或谨慎进言·不可不应。\n';
    }
  }
  // 朝威标识
  const strict = (typeof isStrictCourt === 'function') ? isStrictCourt() : false;
  p += '【朝威】' + (strict ? '肃朝（皇威皇权双高·百官谨慎·言辞克制）' : '众言（百官较活跃·可有自发表态）') + '。\n';

  // P4+·季节天气标识（让回应反映时令·如冬日寒朝言简意赅·夏日苦热则托病感叹）
  if (state && state._currentSeason) {
    p += '【时令】' + state._currentSeason + ' · ' + (state._currentWeather || '晴') + '·可酌情融入回应措辞。\n';
  }

  p += '\n请以 ' + name + ' 的口吻·立场为「' + (stanceLabels[stance] || '中立') + '」·针对陛下的话作回应。\n';

  // 字数走 v2 朝议字数设置
  const wordHint = (typeof _aiDialogueWordHint === 'function') ? _aiDialogueWordHint('cy') : '约 50-120 字';
  p += '要求：\n';
  p += '· 半文言·朝堂奏对体·「臣……」开头·体现你的性格（' + (personality || '一般文官') + '）\n';
  p += '· 字数' + wordHint + '·一句话足矣·不超过两句\n';
  p += '· 立场鲜明·体现派系倾向与品级口吻\n';
  p += '· 紧扣陛下话的具体内容（不要空泛附和"陛下圣明"）\n';
  p += '· 若有近期记忆且相关·可隐约带出（如"前番陕西事·臣已具陈"）\n';
  p += '· 不重复 selfReact / debate 中的话·要有新内容\n';
  p += '· 直接输出回应文·不要任何前后缀。';

  // 时空约束·防 AI 引用未来史实
  if (typeof _buildTemporalConstraint === 'function') {
    try { p += _buildTemporalConstraint(gmCh); } catch (_) {}
  }

  return p;
}

function showAIConfigModal() {
  const cfg = getAIConfig();
  const m = document.createElement('div');
  m.className = 'cy-input-modal';
  m.innerHTML = `
    <div class="cy-input-modal-card" style="width:min(520px,90vw);">
      <h3>AI 配置 · OpenAI 兼容协议（与主游戏共享）</h3>
      <div class="hint">配置存于 localStorage.tm_api · 主游戏配过此处自动读出 · 改动也会回写</div>
      <div style="font-size:12px;color:var(--ink-500);margin-bottom:4px;">API URL（如 https://api.openai.com/v1·或自定义代理）</div>
      <input id="ai-cfg-url" type="text" value="${escHtml(cfg.url)}" placeholder="https://api.openai.com/v1" />
      <div style="font-size:12px;color:var(--ink-500);margin-bottom:4px;">API Key</div>
      <input id="ai-cfg-key" type="password" value="${escHtml(cfg.key)}" placeholder="sk-..." />
      <div style="font-size:12px;color:var(--ink-500);margin-bottom:4px;">模型名（如 gpt-4o-mini / claude-sonnet-4-5 / deepseek-chat 等）</div>
      <input id="ai-cfg-model" type="text" value="${escHtml(cfg.model || 'gpt-4o-mini')}" placeholder="gpt-4o-mini" />
      <div style="font-size:12px;color:var(--ink-300);margin:8px 0;">注：CORS 限制下·部分官方端点（含 Anthropic）需经代理。已知可直连：兼容 OpenAI 协议的国产 API（DeepSeek/智谱/月之暗面等）和大多数代理端点。</div>
      <div class="row">
        <button class="cy-btn muted" id="ai-cfg-cancel">取消</button>
        <button class="cy-btn" id="ai-cfg-test">⚡ 测试调用</button>
        <button class="cy-btn primary" id="ai-cfg-save">保存</button>
      </div>
      <div id="ai-cfg-result" style="font-size:12px;color:var(--ink-500);margin-top:8px;min-height:18px;"></div>
    </div>
  `;
  $('cy-stage').appendChild(m);
  $('ai-cfg-cancel').onclick = () => m.remove();
  $('ai-cfg-save').onclick = () => {
    saveAIConfig({
      url: $('ai-cfg-url').value.trim(),
      key: $('ai-cfg-key').value.trim(),
      model: $('ai-cfg-model').value.trim() || 'gpt-4o-mini'
    });
    setAiStatus('已保存');
    m.remove();
  };
  $('ai-cfg-test').onclick = async () => {
    const tmpCfg = {
      url: $('ai-cfg-url').value.trim(),
      key: $('ai-cfg-key').value.trim(),
      model: $('ai-cfg-model').value.trim() || 'gpt-4o-mini'
    };
    saveAIConfig(tmpCfg);
    $('ai-cfg-result').textContent = '调用中…';
    $('ai-cfg-result').style.color = 'var(--ink-500)';
    try {
      const r = await callAIPreview('请用半文言一句话（不超过 30 字）回答：「君何以治国？」');
      $('ai-cfg-result').style.color = 'var(--celadon-400)';
      $('ai-cfg-result').textContent = '✓ 调用成功：' + (r || '').slice(0, 100);
    } catch (e) {
      $('ai-cfg-result').style.color = 'var(--vermillion-300)';
      $('ai-cfg-result').textContent = '✗ 失败：' + (e.message || e).slice(0, 200);
    }
  };
}

function pickResponder(item, exclude) {
  const debaters = (item.debate || []).map(d => d.name).filter(Boolean);
  // 候选=本议辩者 + 当前局在朝百官·不写死天启人名(旧版兜底 '韩爌' 会串到别的剧本·玩家报"死字段")
  const present = Object.keys(CHARS || {}).filter(n => CHARS[n] && !CHARS[n].absent);
  const candidates = [...debaters, ...present];
  return candidates.find(n => n !== exclude && CHARS[n] && !CHARS[n].absent)
      || debaters.find(n => n !== exclude) || present[0] || debaters[0] || '';
}

// 取当前局在朝、非缺席、非玩家的角色名(氛围气泡/调停者发言用·保证串本剧本的人·不写死天启)
function _cc3_ambientNames(n) {
  var names = Object.keys(CHARS || {}).filter(function(k){ return CHARS[k] && !CHARS[k].absent && !CHARS[k].isPlayer; });
  for (var i = names.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = names[i]; names[i] = names[j]; names[j] = t; }
  return names.slice(0, n || 1);
}
// 取一位资深在朝重臣(充"首辅/调停/谏阻"发言)·优先阁/尚书/都御史衔者·无则任取在朝者·再无返 ''
function _cc3_seniorOfficial(exclude) {
  var names = Object.keys(CHARS || {}).filter(function(n){ return n !== exclude && CHARS[n] && !CHARS[n].absent && !CHARS[n].isPlayer; });
  if (!names.length) return '';
  var senior = names.filter(function(n){ var t = (CHARS[n] && (CHARS[n].title || CHARS[n].officialTitle)) || ''; return /首辅|次辅|大学士|阁|太师|太傅|少师|少傅|尚书|侍郎|都御史|总宪|正卿/.test(t); });
  var pool = senior.length ? senior : names;
  return pool[Math.floor(Math.random() * pool.length)];
}
// 资深重臣发一言·无在朝重臣则退成无名系统气泡(避免写死天启人名串场)
function _cc3_officialBubble(stance, text, exclude) {
  var nm = _cc3_seniorOfficial(exclude || '');
  if (nm) addBubble({ name: nm, stance: stance, text: text });
  else addBubble({ kind: 'system', text: '（有大臣出班：「' + text + '」）' });
}

// 朝堂氛围气泡·不影响逻辑·仅渲染殿中活力
// ★不写死人名(旧版硬编码天启满桂/黄宗周/韩爌/温体仁/毕自严·别的剧本串场·玩家报"死字段非常多")·
//   带名句改用当前局在朝者(_cc3_ambientNames)填充·无在朝者则退无名通用句
const AMBIENT_LINES = [   // 无人名·任何朝代/剧本通用
  '（殿中有低声议论。）',
  '（殿中有人微微叹息。）',
  '（科道几员低声相商。）',
  '（远处似有内官传旨之声。）',
  '（殿角铜漏 · 滴答有声。）',
  '（班列之间 · 目光交触。）',
  '（有人扶笏 · 略有沉思。）'
];
const AMBIENT_TEMPLATES = [   // {n}/{n2} 由当前局在朝角色随机填充
  '（{n}凝视前方 · 面无表情。）',
  '（{n}捻须 · 略有沉思。）',
  '（{n}扶笏 · 目光低垂。）',
  '（{n}捏紧手中奏疏。）',
  '（{n}微微颔首。）',
  '（{n}与{n2}目光交触。）'
];
function maybeAmbient(prob) {
  if (Math.random() > (prob == null ? 0.2 : prob)) return;
  var names = _cc3_ambientNames(2);
  var line;
  if (names.length && Math.random() < 0.5) {
    var pool = names.length >= 2 ? AMBIENT_TEMPLATES : AMBIENT_TEMPLATES.filter(function(t){ return t.indexOf('{n2}') < 0; });
    line = pool[Math.floor(Math.random() * pool.length)].replace('{n2}', names[1] || names[0]).replace('{n}', names[0]);
  } else {
    line = AMBIENT_LINES[Math.floor(Math.random() * AMBIENT_LINES.length)];
  }
  addBubble({ kind: 'system', text: line });
}

// 面板存活校验·_cc3_close 后 DOM 已移除·任何 DOM 写入应早退
function _cc3_panelAlive() {
  return !!document.getElementById('cy-stage');
}

function setActions(html) {
  var el = $('cy-action-bar');
  if (!el) return;
  el.innerHTML = html;
}

function setPhase(label, hint) {
  var lbl = $('cy-phase-label'); if (lbl) lbl.textContent = label;
  var ht  = $('cy-phase-hint');  if (ht)  ht.textContent = hint || '';
}

function updateProgress() {
  try { _cc3_renderAgendaList(); } catch(_) {}
  var tg = $('cy-progress-tag'); if (!tg) return;
  tg.textContent = '已议 ' + state.decisions.length;
}

function refreshTitle() {
  if (!_cc3_panelAlive()) return;
  // 朝代配置·从 scenario.chaoyi 读
  const cfg = (typeof _cc3_getScenarioConfig === "function") ? _cc3_getScenarioConfig() : null;
  if (cfg) {
    const isShuo2 = state.mode === 'shuochao';
    const chaoName2 = isShuo2 ? cfg.shuoChaoName : cfg.chaoName;
    const ttl2 = '〔 ' + chaoName2 + ' 〕' + cfg.audienceHall + ' · ' + cfg.dateLabel;
    const tEl = $('cy-title'); if (tEl) tEl.textContent = ttl2;
    const cEl = $('cy-ceremony-title'); if (cEl) cEl.textContent = '〔 ' + chaoName2 + ' 〕';
    const sEl = $('cy-ceremony') && $('cy-ceremony').querySelector('.sub');
    if (sEl) sEl.textContent = cfg.audienceHall + (isShuo2 ? ' · 朔月初一' : ' · 五更三点') + ' · ' + cfg.dateLabel;
    return;
  }
  // 兜底（preview mode·或 GM 未初始化）
  const isShuo = state.mode === 'shuochao';
  const ttl = isShuo ? '〔 朔 朝 〕奉天门 · 戊辰年三月初一' : '〔 早 朝 〕奉天门 · 戊辰年三月十二';
  var tEl3 = $('cy-title'); if (tEl3) tEl3.textContent = ttl;
  var cEl3 = $('cy-ceremony-title'); if (cEl3) cEl3.textContent = isShuo ? '〔 朔 朝 〕' : '〔 早 朝 〕';
  var ceremEl = $('cy-ceremony');
  var subEl = ceremEl && ceremEl.querySelector('.sub');
  if (subEl) subEl.textContent = isShuo
    ? '奉天门 · 朔月初一 · 戊辰年三月初一'
    : '奉天门 · 五更三点 · 戊辰年三月十二';
}

// 时辰流动·议程推进时辰
const TIME_FLOW = ['五更三点', '寅时初刻', '寅时正', '寅时三刻', '卯时初', '卯时二刻', '卯时正', '卯时四刻', '辰时初'];
function getTimeStr() {
  // currentIdx 为 0 时（开场）= 五更三点·之后每议程推 1 个刻度
  const idx = Math.min(state.currentIdx, TIME_FLOW.length - 1);
  return TIME_FLOW[idx];
}
function updateTimeOfDay() {
  let el = $('time-of-day');
  if (!el) {
    const bar = document.querySelector('.cy-titlebar');
    if (!bar) return;
    el = document.createElement('div');
    el.id = 'time-of-day';
    el.className = 'time-of-day';
    bar.appendChild(el);
  }
  el.textContent = '🕒 ' + getTimeStr();
}

// ═══════════════════════════════════════════════
// 班次区渲染
// ═══════════════════════════════════════════════
function renderBench() {
  const east = [], west = [], kdao = [];
  Object.entries(CHARS).forEach(([name, ch]) => {
    const html = `<div class="bench-avatar${ch.absent ? ' absent' : ''}" title="${escHtml(name)}·${escHtml(ch.title)}${ch.absent ? ' ('+escHtml(ch.absent)+')' : ''}" data-name="${escHtml(name)}">
      <div class="bench-avatar-circle ${ch.class === 'wu' ? 'wu' : ch.class === 'kdao' ? 'koudao' : ''}${ch.absent ? ' absent' : ''}${ch.portrait ? ' has-img' : ''}">${ch.portrait ? '<img class="bench-avatar-img" src="'+escHtml(ch.portrait)+'" loading="lazy" decoding="async">' : escHtml(ch.initial)}</div>
      <div class="bench-avatar-name">${escHtml(name)}</div>
    </div>`;
    if (ch.class === 'kdao') kdao.push(html);
    else if (ch.class === 'wu') west.push(html);
    else east.push(html);
  });
  // sort by rank
  const byRank = (a, b) => {
    const m1 = a.match(/data-name="([^"]+)"/), m2 = b.match(/data-name="([^"]+)"/);
    return (CHARS[m1[1]].rank || 99) - (CHARS[m2[1]].rank || 99);
  };
  east.sort(byRank); west.sort(byRank); kdao.sort(byRank);
  $('bench-east').innerHTML = east.join('');
  $('bench-west').innerHTML = west.join('');
  $('bench-kdao').innerHTML = kdao.join('');

  // attendance count
  state.attendees = []; state.absents = [];
  Object.entries(CHARS).forEach(([name, ch]) => {
    if (ch.absent) state.absents.push({ name, reason: ch.absent });
    else state.attendees.push(name);
  });
  $('cy-attend-tag').textContent = '殿中 ' + state.attendees.length;
  $('cy-bench-status').textContent = '朝堂全景 · ' + state.attendees.length + ' 员到 · ' + state.absents.length + ' 缺';
}

// ═══════════════════════════════════════════════
// 朝会主流程
// ═══════════════════════════════════════════════
async function runOpening() {
  state.phase = 'opening';
  setPhase('【鸣 鞭】', '百官入班候旨');
  setActions('<span style="color:var(--ink-500);font-size:12px;">入殿仪礼中……</span>');
  await delay(1300);
  $('cy-ceremony').style.display = 'none';

  // ── 鸣鞭三响（视觉化·CSS 动画总时长 ~1.2s） ──
  const main = $('cy-stage-main');
  const bellRow = document.createElement('div');
  bellRow.className = 'bell-ring';
  bellRow.innerHTML = '<span>铮</span><span>铮</span><span>铮</span>';
  main.appendChild(bellRow);
  await delay(1100);

  addBubble({ kind: 'system', sysKind: 'ceremony', text: '〔 鸣 鞭 三 响 · 百 官 列 班 〕' });
  await delay(380);

  // ── 山呼万岁（震动动画） ──
  const cheerEl = document.createElement('div');
  cheerEl.className = 'cheer-line';
  cheerEl.textContent = '吾 皇 万 岁 万 岁 万 万 岁';
  main.appendChild(cheerEl);
  main.scrollTop = main.scrollHeight;
  await delay(550);

  // ── 缺朝名册（视觉化） ──
  if (state.absents.length > 0) {
    const roster = document.createElement('div');
    roster.className = 'absent-roster';
    let html = '<span class="lbl">〔 缺 朝 〕</span>';
    state.absents.forEach(a => {
      html += '<span class="name">' + escHtml(a.name) + '</span><span style="color:var(--ink-300);font-size:12px;">（' + escHtml(a.reason) + '）</span>';
    });
    roster.innerHTML = html;
    main.appendChild(roster);
    main.scrollTop = main.scrollHeight;
    await delay(500);
  }

  // P4·季节天气氛围气泡（在御殿前·渲染时令）
  if (typeof _cc3_getSeasonAndWeather === 'function') {
    try {
      const sw = _cc3_getSeasonAndWeather();
      const line = _cc3_getSeasonalAmbientLine(sw.season, sw.weather);
      if (line) {
        addBubble({ kind: 'system', text: line });
        await delay(420);
      }
      // 把季节天气存到 state·议程 prompt 可读
      state._currentSeason = sw.season;
      state._currentWeather = sw.weather;
    } catch (_) {}
  }

  addBubble({ kind: 'system', sysKind: 'ceremony', text: '〔 陛 下 御 殿 · 百 官 奏 事 〕' });
  await delay(450);
  console.log('[cc3] runOpening 完毕·进入 runNextItem·AGENDA.length=' + AGENDA.length);
  try {
    await runNextItem();
  } catch (e) {
    console.error('[cc3] runNextItem 顶层抛错', e);
    addBubble({ kind: 'system', sysKind: 'warn', text: '（朝议流程异常·' + (e && e.message || e) + '·已自动退朝。）' });
    setTimeout(() => { try { runClosing(); } catch (_) {} }, 500);
  }
}

async function runNextItem() {
  try { _cc3_renderAgendaList(); } catch(_) {}
  console.log('[cc3] runNextItem·idx=' + state.currentIdx + '·AGENDA.length=' + AGENDA.length);
  if (state.currentIdx >= AGENDA.length) {
    console.log('[cc3] 议程已尽·进入 runClosing');
    return runClosing();
  }
  // Half-way nudge
  if (state.currentIdx === Math.floor(AGENDA.length / 2)) {
    addBubble({ kind: 'system', text: '百官奏事已半。' });
    await delay(500);
  }
  // Near-end nudge
  if (state.currentIdx === AGENDA.length - 2) {
    addBubble({ kind: 'system', text: '百官奏事已多 · 陛下是否退朝？（仍可继续）' });
    await delay(600);
  }
  try {
    await runAnnounce();
  } catch (e) {
    console.error('[cc3] runAnnounce 抛错·item idx=' + state.currentIdx, e);
    addBubble({ kind: 'system', sysKind: 'warn', text: '（议程异常·跳过此条。' + (e && e.message || e) + '）' });
    state.currentIdx++;
    updateProgress();
    await delay(300);
    return runNextItem();
  }
}

async function runAnnounce() {
  const item = AGENDA[state.currentIdx];
  if (!item) {
    console.warn('[cc3] runAnnounce·item 为空 idx=' + state.currentIdx + '·AGENDA=', AGENDA);
    state.currentIdx++;
    return runNextItem();
  }
  console.log('[cc3] runAnnounce·idx=' + state.currentIdx, item);
  state.phase = 'announce';
  state._chaosFired = false;
  updateTimeOfDay();
  // 阶段标签按 urgency 着色
  const tag = $('cy-phase-tag');
  tag.classList.remove('strict', 'urgent');
  if (item.urgency === 'urgent') tag.classList.add('urgent');
  setPhase('【启 奏】' + (item.urgency === 'urgent' ? ' · 急 奏' : ''), '官员请奏 · 陛下定夺');
  await delay(400);

  // ── 急奏特殊处理：先弹"此为急奏 陛下是否先听？"卡片 ──
  if (item.urgency === 'urgent') {
    const main = $('cy-stage-main');
    const card = document.createElement('div');
    card.className = 'urgent-card';
    card.innerHTML = `<span class="urgent-mark">⚡ 急 奏</span><span class="urgent-text">${escHtml(item.presenter)} · ${escHtml(item.dept || '')} · 「${escHtml(item.title)}」 · 须陛下即决</span>`;
    main.appendChild(card);
    main.scrollTop = main.scrollHeight;
    await delay(700);
  }

  addBubble({
    name: item.presenter,
    text: item.announceLine,
    urgent: item.urgency === 'urgent',
    itemType: item.type
  });
  await delay(300);
  setActions(`
    <button class="cy-btn primary" onclick="onAnnounceChoice('proceed')">奏来</button>
    <button class="cy-btn muted" onclick="onAnnounceChoice('skip')">此事免议</button>
    <button class="cy-btn" onclick="onAnnounceChoice('hold')">改日再奏</button>
  `);
}

async function onAnnounceChoice(choice) {
  const item = AGENDA[state.currentIdx];
  if (choice === 'proceed') {
    addBubble({ kind: 'player', text: '奏来。' });
    await delay(300);
    return runDetail();
  }
  if (choice === 'skip') {
    addBubble({ kind: 'player', text: '此事免议。' });
    await delay(200);
    addBubble({ kind: 'system', text: '（' + item.presenter + ' 退入班列。此事压一回合。）' });
    state.decisions.push({ idx: state.currentIdx, action: 'skip', item, label: '免议' });
    state.currentIdx++;
    updateProgress();
    await delay(400);
    return runNextItem();
  }
  if (choice === 'hold') {
    addBubble({ kind: 'player', text: '此事改日再奏。' });
    await delay(200);
    addBubble({ kind: 'system', text: '（' + item.presenter + ' 退归班列。议程留中。）' });
    state.decisions.push({ idx: state.currentIdx, action: 'hold', item, label: '改日再奏（留中）' });
    state.currentIdx++;
    updateProgress();
    await delay(400);
    return runNextItem();
  }
}

// ═══ 肃朝判定·请奏队列 ═══
/** 详细诊断·返回 {prestige, power, thPrestige, thPower, isStrict, note}
 *  实时从 GM.vars 重读·使中途数值变动也能正确反映 */
function _cc3_getStrictCourtInfo() {
  // 优先 state.prestige/power（_cc3_overrideMockWithGM 已同步）·若无则即时读 GM
  let pres = (typeof state !== 'undefined' && typeof state.prestige === 'number') ? state.prestige : null;
  let pwr  = (typeof state !== 'undefined' && typeof state.power    === 'number') ? state.power    : null;
  if (pres == null) pres = (typeof _cc3_getPrestige === 'function') ? _cc3_getPrestige() : 50;
  if (pwr  == null) pwr  = (typeof _cc3_getPower    === 'function') ? _cc3_getPower()    : 50;
  const cfg = (typeof _cc3_getScenarioConfig === 'function') ? _cc3_getScenarioConfig() : { strictThreshold: { prestige: 75, power: 75 } };
  const th = cfg.strictThreshold || { prestige: 75, power: 75 };
  const presOk = pres >= th.prestige;
  const pwrOk  = pwr  >= th.power;
  const isStrict = presOk && pwrOk;
  // 临界标注（差 5 内称"勉强达标"·短缺 5 内称"将临"·差距大无标注）
  let note = '';
  if (isStrict) {
    if (pres - th.prestige <= 5 || pwr - th.power <= 5) note = '勉强达标';
  } else {
    const gp = th.prestige - pres, gw = th.power - pwr;
    if (gp <= 5 && gw <= 5) note = '将临肃朝';
    else if (!presOk && !pwrOk) note = '皇威皇权两不足';
    else if (!presOk) note = '皇威不足 (差 ' + gp + ')';
    else if (!pwrOk) note = '皇权不足 (差 ' + gw + ')';
  }
  return { prestige: pres, power: pwr, thPrestige: th.prestige, thPower: th.power, isStrict: isStrict, note: note };
}

function isStrictCourt() {
  return _cc3_getStrictCourtInfo().isStrict;
}

/** 朝代配置·rank 直接发言阈值（阁臣不待旨） */
function _cc3_getDirectSpeakRank() {
  if (typeof _cc3_getScenarioConfig === 'function') {
    return _cc3_getScenarioConfig().directSpeakRank;
  }
  return 2;
}
function classifyForStrict(reactor) {
  // 低朝威·全直接发言（现状）
  if (!isStrictCourt()) return 'speak';
  // 高朝威·rank ≤ 阁臣线 仍可不待旨而言·余等需举笏请奏
  const ch = CHARS[reactor.name] || {};
  const directRank = (typeof _cc3_getDirectSpeakRank === 'function') ? _cc3_getDirectSpeakRank() : 2;
  if (ch.rank && ch.rank <= directRank) return 'speak';
  return 'request';
}

async function runDetail() {
  const item = AGENDA[state.currentIdx];
  state.phase = 'detail';
  state._strictQueue = null;  // 每条议程开始重置
  const strict = isStrictCourt();
  // 阶段标签状态
  const tag = $('cy-phase-tag');
  tag.classList.remove('strict', 'urgent');
  if (strict) tag.classList.add('strict');
  if (item.urgency === 'urgent') tag.classList.add('urgent');
  setPhase('【详 述】' + (strict ? ' · 肃朝' : '') + (item.urgency === 'urgent' ? ' · 急' : ''), '正文奏报 · ' + (strict ? '诸臣肃然待旨' : '殿中自发表态') + ' · 陛下处分');
  await delay(300);
  addBubble({
    name: item.presenter,
    text: item.detail,
    detail: true,
    urgent: item.urgency === 'urgent',
    itemType: item.type
  });
  await delay(500);

  // ── 详述后·按朝威分流 ──
  if (item.selfReact && item.selfReact.length) {
    const directs = [];
    const requests = [];
    item.selfReact.forEach(r => {
      if (classifyForStrict(r) === 'speak') directs.push(r);
      else requests.push(r);
    });

    // 高朝威：先入请奏队列（举笏请言）
    if (strict && requests.length > 0) {
      state._strictQueue = requests.map(r => ({ name: r.name, stance: r.stance, line: r.line, used: false }));
      addBubble({ kind: 'system', text: '（殿中肃静 · 诸臣俯首待旨。）' });
      await delay(420);
      for (const q of state._strictQueue) {
        addBubble({ kind: 'system', text: '（' + q.name + ' 举笏请言。）' });
        await delay(280);
      }
    }

    // 直接发言者（低朝威全部·高朝威仅 rank 1-2）
    if (directs.length > 0) {
      addBubble({ kind: 'system', text: strict ? '（一二阁臣不待旨而言。）' : '（殿中有臣自发表态。）' });
      await delay(380);
      for (const r of directs) {
        // AI 流式·读其档案/记忆/派系决定立场和台词
        await _cc3_streamReactBubble(r, item, 'self');
        await delay(280);
        if (state.pendingPlayerInput) {
          const t = state.pendingPlayerInput; state.pendingPlayerInput = null;
          addBubble({ kind: 'player', text: t });
          await delay(360);
          // 玩家插言后·让一名 NPC 流式回应（走完整 npcRespondToPlayer 路径）
          try { await npcRespondToPlayer(t, 1); } catch (_) {}
        }
        maybeAmbient(0.18);
      }
      await delay(200);
    }
  }
  showDetailActions();
}

// 请奏队列：让 X 单独发言
async function letStrictSpeaker(idx) {
  document.querySelectorAll('.cy-popover.show').forEach(p => p.classList.remove('show'));
  const queue = state._strictQueue || [];
  const q = queue[idx];
  if (!q || q.used) return;
  q.used = true;
  addBubble({ kind: 'system', text: '（陛下示意 ' + q.name + ' 言之。）' });
  await delay(280);
  addBubble({ name: q.name, stance: q.stance, text: q.line });
  await delay(450);
  // 玩家在 NPC 发言后可能即说·若已说则消化
  if (state.pendingPlayerInput) {
    const t = state.pendingPlayerInput; state.pendingPlayerInput = null;
    addBubble({ kind: 'player', text: t });
    await delay(360);
  }
  maybeAmbient(0.2);
  showDetailActions();
}

// 请奏队列：一并准予全数
async function letAllStrictSpeakers() {
  document.querySelectorAll('.cy-popover.show').forEach(p => p.classList.remove('show'));
  const queue = state._strictQueue || [];
  if (queue.filter(q => !q.used).length === 0) return;
  addBubble({ kind: 'system', text: '（陛下挥袖：诸卿但言之。）' });
  await delay(320);
  for (const q of queue) {
    if (q.used) continue;
    q.used = true;
    addBubble({ name: q.name, stance: q.stance, text: q.line });
    await delay(480);
    maybeAmbient(0.18);
  }
  showDetailActions();
}

// 请奏队列：免诸卿之言（直接进入决断·剩余 NPC 不再说）
function dismissStrictQueue() {
  document.querySelectorAll('.cy-popover.show').forEach(p => p.classList.remove('show'));
  const queue = state._strictQueue || [];
  queue.forEach(q => q.used = true);
  addBubble({ kind: 'system', text: '（陛下挥袖：诸卿之言可免。）' });
  showDetailActions();
}

function toggleStrictQueuePopover() {
  document.querySelectorAll('.cy-popover.show').forEach(p => p.classList.remove('show'));
  const pop = $('strict-queue-popover');
  if (pop) pop.classList.add('show');
}

function showDetailActions() {
  // 请奏队列按钮（仅肃朝有内容时显示）
  const queue = state._strictQueue || [];
  const liveQueue = queue.filter(q => !q.used);
  let queueBtnHtml = '';
  if (liveQueue.length > 0) {
    queueBtnHtml = `
      <button class="cy-btn" style="border-color:var(--celadon-400);color:var(--celadon-400);" onclick="toggleStrictQueuePopover()">📋 请奏 ${liveQueue.length} 人 ▼</button>
      <div class="cy-popover" id="strict-queue-popover">
        ${liveQueue.map((q, idx) => `<button class="cy-popover-item" onclick="letStrictSpeaker(${queue.indexOf(q)})">${escHtml(q.name)} <span class="hint">${stanceLbl(q.stance)}</span></button>`).join('')}
        <div class="cy-popover-divider"></div>
        <button class="cy-popover-item" onclick="letAllStrictSpeakers()">一并准予 <span class="hint">${liveQueue.length} 人续奏</span></button>
        <button class="cy-popover-item" onclick="dismissStrictQueue()">免诸卿之言 <span class="hint">直入决断</span></button>
      </div>
    `;
  }
  setActions(`
    <button class="cy-btn primary" onclick="doAction('approve')">准 奏</button>
    <button class="cy-btn danger" onclick="doAction('reject')">驳 奏</button>
    <button class="cy-btn" onclick="doAction('hold')">留 中</button>
    <button class="cy-btn muted" onclick="toggleMorePopover()">⋯ 更多</button>
    ${queueBtnHtml}
    <div class="cy-popover" id="more-popover">
      <button class="cy-popover-item" onclick="doMore('refer')">发部议 → <span class="hint">转某衙门详议</span></button>
      <button class="cy-popover-item" onclick="doMore('escalate')">下廷议 <span class="hint">转正式廷议</span></button>
      <button class="cy-popover-item" onclick="doMore('modify')">改批 → <span class="hint">玩家口述新方案</span></button>
      <button class="cy-popover-item" onclick="doMore('probe')">追问 → <span class="hint">问奏报者细节</span></button>
      <div class="cy-popover-divider"></div>
      <button class="cy-popover-item" onclick="doMore('summon')">传召 → <span class="hint">召不在场者</span></button>
      <button class="cy-popover-item" onclick="doMore('admonish')">训诫 → <span class="hint">当庭训某官</span></button>
      <button class="cy-popover-item" onclick="doMore('praise')">嘉奖 → <span class="hint">当庭赏某官</span></button>
    </div>
  `);
}

function toggleMorePopover() {
  const pop = $('more-popover');
  pop.classList.toggle('show');
}

async function doAction(action, extra) {
  const item = AGENDA[state.currentIdx];
  // 如有议论高争议 + 玩家直接决断（非议论后），则进议论
  if ((action === 'approve' || action === 'reject') && item.controversial > 5 && state.phase !== 'debate' && item.debate && item.debate.length > 0) {
    return runDebate();
  }
  return finalizeAction(action, extra);
}

async function finalizeAction(action, extra) {
  const item = AGENDA[state.currentIdx];
  const labels = {
    approve: '准奏', reject: '驳奏', hold: '留中',
    refer: '发部议', escalate: '下廷议', modify: '改批',
    probe: '追问', summon: '传召', admonish: '训诫', praise: '嘉奖',
    'decree': '当庭口述诏令'
  };
  const label = labels[action] || action;
  // 玩家说话
  let pTxt = '';
  if (action === 'approve') pTxt = '准奏。' + (extra ? '（' + extra + '）' : '');
  else if (action === 'reject') pTxt = '驳。';
  else if (action === 'hold') pTxt = '此事留中。';
  else if (action === 'refer') pTxt = '此事发 ' + (extra || '某部') + ' 详议。';
  else if (action === 'escalate') pTxt = '此事兹事体大 · 下廷议。';
  else if (action === 'modify') pTxt = '朕意如此：' + (extra || '〔玩家口述方案〕');
  else if (action === 'probe') pTxt = (extra || '细言之。');
  else if (action === 'summon') pTxt = '传召 ' + (extra || '某员') + ' 入殿。';
  else if (action === 'admonish') pTxt = (extra ? extra + '，' : '') + '尔等所为 · 朕已知之 · 须自警。';
  else if (action === 'praise') pTxt = (extra ? extra + '，' : '') + '卿勤勉可嘉 · 着户部加赐。';
  else if (action === 'decree') pTxt = (extra && extra.text) ? ('（当庭宣旨）' + extra.text) : '（当庭宣旨）';
  addBubble({ kind: 'player', text: pTxt });
  await delay(300);

  // ─── NPC 连锁反应（按动作 + 立场层级触发） ───
  await runActionReactions(action, item, extra);
  await delay(400);

  // ─── P0 GM 状态写入·v3 决议真持久化 ───
  _cc3_writeActionToGM(action, item, extra, label);

  // ─── 史官实录·常朝议政进纪事(原本常朝不写 jishiRecords·此处补·带 outcome 决议) (2026-06-03) ───
  try { _cc3_writeJishiRecord(action, item, extra, label, pTxt); } catch (jishiErr) { console.warn('[cc3] 纪事写入失败·跳过·', jishiErr && jishiErr.message); }

  // ─── Slice 9 层 6·把 emperor intent 传给下一议题·写在 GM 状态之后·state.currentIdx++ 之前
  try { _cc3_writeNextItemEmperorIntent(action, extra, item); }
  catch (intentErr) { console.warn('[cc3·tier2] emperor intent 写入失败·跳过·', intentErr && intentErr.message); }

  // ─── 抗辩触发判定（高争议·准/驳 后 30%）───
  if ((action === 'approve' || action === 'reject') && item.controversial >= 7 && Math.random() < 0.45) {
    const handled = await runDissentFlow(action, item);
    if (handled === 'wait') return; // 抗辩流程接管·稍后由 resolveDissent 推进
  }

  state.decisions.push({ idx: state.currentIdx, action, item, label, extra });
  state.currentIdx++;
  updateProgress();
  await delay(300);
  return runNextItem();
}

// ─── 史官实录·常朝决议写入纪事(带 outcome 决议结论·原本常朝缺纪事机制) ───
function _cc3_writeJishiRecord(action, item, extra, label, pTxt) {
  if (typeof GM === 'undefined') return;
  if (!Array.isArray(GM.jishiRecords)) GM.jishiRecords = [];
  item = item || {};
  var topic = String(item.title || item.subject || '常朝议题').slice(0, 60);
  var presenter = item.presenter || '某员';
  var zou = String(item.detail || item.content || '').slice(0, 200);
  var outcomeText = (action === 'approve') ? ('常朝·准奏：' + topic.slice(0, 24))
    : (action === 'reject') ? '常朝·驳奏'
    : (action === 'hold') ? '常朝·留中待议'
    : (action === 'refer') ? ('常朝·发部议' + (extra ? '（' + extra + '）' : ''))
    : (action === 'escalate') ? '常朝·下廷议'
    : (action === 'modify') ? ('常朝·改批：' + String(extra || '').slice(0, 40))
    : (action === 'decree') ? '常朝·当庭口述诏令'
    : (action === 'praise') ? '常朝·嘉奖' : (action === 'admonish') ? '常朝·训诫'
    : ('常朝·' + (label || action));
  GM.jishiRecords.push({
    turn: GM.turn || 1,
    char: presenter,
    topic: topic,
    playerSaid: String(pTxt || ('（' + (label || '裁决') + '）')).slice(0, 200),
    npcSaid: zou ? (presenter + '（' + (item.dept || '') + '）奏：' + zou) : '',
    mode: 'changchao',
    final: (action === 'approve' || action === 'reject' || action === 'decree' || action === 'escalate'),
    outcome: outcomeText
  });
  if (GM.jishiRecords.length > 400) GM.jishiRecords = GM.jishiRecords.slice(-400);
}

function _cc3_courtPolicyText(action, item, extra) {
  item = item || {};
  if (action === 'modify') return String(extra || '改批方案').trim();
  if (action === 'decree') {
    if (extra && typeof extra === 'object') return String(extra.text || '').trim();
    return String(extra || '亲诏').trim();
  }
  return (String(item.title || '常朝裁决') + '：' + String(item.detail || item.content || '')).trim();
}

function _cc3_applyCourtPolicyBridge(tracker, action, item, extra, label) {
  if (typeof GM === 'undefined' || !GM || !tracker) return null;
  if (['approve', 'modify', 'decree'].indexOf(action) < 0) return null;
  if (tracker._policyApplyAttempted) return tracker._policyExecution || null;
  var text = _cc3_courtPolicyText(action, item, extra);
  if (!text) return null;
  tracker._policyApplyAttempted = true;
  var parser = (typeof EdictParser !== 'undefined') ? EdictParser : null;
  var result = null;
  if (parser && typeof parser.tryExecute === 'function') {
    try {
      result = parser.tryExecute(text, {}, {
        source: 'changchao',
        channel: 'court',
        action: action,
        label: label || '',
        trackerId: tracker.id || '',
        topic: item && (item.title || item.subject) || '',
        dept: item && item.dept || '',
        presenter: item && item.presenter || '',
        decreeMark: tracker.decreeMark || null
      });
    } catch(e) {
      result = { ok: false, reason: e && e.message || 'changchao_policy_error' };
    }
  } else {
    result = { ok: false, reason: 'edict_parser_unavailable' };
  }
  tracker._policyExecution = result;
  tracker._policyApplied = !!(result && result.ok);
  if (tracker._policyApplied) {
    tracker.status = 'executed';
    tracker.feedback = '常朝裁决已识别为政务并落账';
    tracker.progressPercent = 100;
  }
  if (!GM._chaoyiPolicyActions) GM._chaoyiPolicyActions = [];
  GM._chaoyiPolicyActions.push({
    turn: GM.turn || 0,
    trackerId: tracker.id || '',
    action: action,
    ok: tracker._policyApplied,
    pathway: result && result.pathway || '',
    typeKey: result && result.classification && result.classification.typeKey || ''
  });
  if (GM._chaoyiPolicyActions.length > 80) GM._chaoyiPolicyActions.splice(0, GM._chaoyiPolicyActions.length - 80);
  return result;
}

// ─── P0·将朝议动作写入 GM 状态（C3-C8）───
function _cc3_writeActionToGM(action, item, extra, label) {
  if (typeof GM === 'undefined') return;
  const turn = GM.turn || 0;
  const isPostTurn = (typeof state !== 'undefined' && state._isPostTurn != null)
                     ? !!state._isPostTurn
                     : !!GM._isPostTurnCourt;
  const targetTurn = isPostTurn ? (turn + 1) : turn;

  // C5 准奏 → 进诏令追踪表
  if (action === 'approve' || action === 'modify' || action === 'decree') {
    if (!GM._edictTracker) GM._edictTracker = [];
    const decreeText = _cc3_courtPolicyText(action, item, extra);
    const tracker = {
      id: 'cc3_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      content: decreeText,
      category: item.dept || '常朝',
      turn: turn, status: 'pending',
      assignee: item.presenter || '', feedback: '', progressPercent: 0,
      source: action === 'decree' ? 'changchao_decree' : 'changchao',
      decreeMark: action === 'decree' ? (extra && extra.tier) || 'B' : null
    };
    GM._edictTracker.push(tracker);
    _cc3_applyCourtPolicyBridge(tracker, action, item, extra, label);
    // minxin feedback: route changchao disposition of a pressure-spawned topic back so the matrix clears it (else it re-spawns)
    try {
      var _miLink = item && (item._sourceRef || item.linkedIssue || item.sourceId || item.ref || (item.sourceType === 'minxin_pressure' ? item.id : ''));
      if (_miLink && typeof TM !== 'undefined' && TM.MinxinPressureActions && typeof TM.MinxinPressureActions.recordPlayerResponse === 'function') {
        TM.MinxinPressureActions.recordPlayerResponse(GM, { channel: 'chaoyi', decision: action, linkedIssue: _miLink, actor: item.presenter || '', topic: item.title || '', text: [item.title, item.detail, item.content].filter(Boolean).join(' ') }, { turn: turn, source: 'changchao-minxin-pressure-response' });
      }
    } catch (_miE) {}
    if (typeof addEB === 'function') addEB('常朝', label + '：' + (item.title || ''));
  }

  // C8 下廷议 → 加廷议待议册
  if (action === 'escalate') {
    if (!GM._pendingTinyiTopics) GM._pendingTinyiTopics = [];
    GM._pendingTinyiTopics.push({
      topic: (item.title || '常朝转入议题') + '：' + (item.detail || item.content || '').slice(0, 80),
      from: item.presenter || '常朝',
      turn: turn,
      _fromChaoyi: true
    });
  }

  // 留中 → 加留中册
  if (action === 'hold') {
    if (!GM._ccHeldItems) GM._ccHeldItems = [];
    GM._ccHeldItems.push({
      dept: item.dept || '', title: item.title || '', content: item.detail || item.content || '',
      type: item.type || 'routine', controversial: item.controversial || 3,
      heldAtTurn: turn
    });
  }

  // 发部议 → 加部议任务
  if (action === 'refer') {
    if (!GM.deptTasks) GM.deptTasks = [];
    GM.deptTasks.push({
      dept: extra || item.dept || '某部',
      task: item.title || '', detail: item.detail || item.content || '',
      assignedAtTurn: turn, dueIn: 3, status: 'pending',
      source: 'changchao_refer'
    });
  }

  // C3·驳奏 → 主奏者记忆
  if (action === 'reject' && item.presenter && typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
    try { NpcMemorySystem.remember(item.presenter, '常朝所奏「' + (item.title || '一事') + '」被驳回', '忧', 4, '陛下'); } catch (_) {}
  }

  // C3+C4·训诫 → NPC 记忆 + 关系
  if (action === 'admonish') {
    const tgt = extra || item.target || item.presenter;
    if (tgt) {
      try { if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) NpcMemorySystem.remember(tgt, '陛下当庭训诫·缘事「' + (item.title || '') + '」', '愤', 7, '陛下'); } catch (_) {}
      try { if (typeof OpinionSystem !== 'undefined' && OpinionSystem.addEventOpinion) OpinionSystem.addEventOpinion(tgt, '玩家', -8, '常朝训诫'); } catch (_) {}
      try {
        const ch = (typeof findCharByName === 'function') ? findCharByName(tgt) : null;
        if (ch && typeof ch.loyalty === 'number') {
          if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(ch, -5, '\u5E38\u671D\u8BAD\u8BEB\uFF1A' + (item.title || ''), { source:'changchao-admonish' });
          else ch.loyalty = Math.max(0, ch.loyalty - 5);
        }
      } catch (_) {}
    }
  }

  // C3+C4·嘉奖 → NPC 记忆 + 关系
  if (action === 'praise') {
    const tgt = extra || item.presenter;
    if (tgt) {
      try { if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) NpcMemorySystem.remember(tgt, '陛下当庭嘉奖·缘事「' + (item.title || '') + '」', '喜', 7, '陛下'); } catch (_) {}
      try { if (typeof OpinionSystem !== 'undefined' && OpinionSystem.addEventOpinion) OpinionSystem.addEventOpinion(tgt, '玩家', 8, '常朝嘉奖'); } catch (_) {}
      try {
        const ch = (typeof findCharByName === 'function') ? findCharByName(tgt) : null;
        if (ch) {
          if (typeof ch.loyalty === 'number') {
            if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(ch, 4, '\u5E38\u671D\u5609\u5956\uFF1A' + (item.title || ''), { source:'changchao-praise' });
            else ch.loyalty = Math.min(100, ch.loyalty + 4);
          }
          if (typeof ch.fame === 'number') ch.fame = Math.min(100, ch.fame + 1);
        }
      } catch (_) {}
    }
  }

  // C3·普通议程 → 主奏者轻记一笔（采纳/未采纳）
  if (item.presenter && (action === 'approve' || action === 'reject') &&
      typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
    try {
      const emo = (action === 'approve') ? '喜' : '忧';
      NpcMemorySystem.remember(item.presenter, '常朝所奏「' + (item.title || '') + '」' + (action === 'approve' ? '被采纳' : '被驳'), emo, 3, '陛下');
    } catch (_) {}
  }

  // 频次计数
  if (!GM._chaoyiCount) GM._chaoyiCount = {};
  if (!GM._chaoyiCount[turn]) GM._chaoyiCount[turn] = 0;
  // 整场朝议算一次（在 _cc3_open 时已计·此处不重复）
}

// 议论阶段
async function runDebate() {
  const item = AGENDA[state.currentIdx];
  state.phase = 'debate';
  state.debateRound = 1;
  setPhase('【议 论】 第 1 轮', '百官辩难 · 陛下可即说');
  // 阶段标签状态
  const tag1 = $('cy-phase-tag'); tag1.classList.remove('strict', 'urgent');
  // 议论分隔（精致版）
  const main1 = $('cy-stage-main');
  const div1 = document.createElement('div');
  div1.className = 'round-divider';
  div1.textContent = '殿 中 议 论 · 第 一 轮';
  main1.appendChild(div1);
  main1.scrollTop = main1.scrollHeight;
  await delay(400);
  for (const npc of (item.debate || [])) {
    // AI 流式生成立场+台词·读其档案与他臣已表态
    await _cc3_streamReactBubble(npc, item, 'debate');
    await delay(280);
    // 玩家若已在间隙说过·让一名 NPC 立场化回应玩家（走完整 streaming 路径）
    if (state.pendingPlayerInput) {
      const t = state.pendingPlayerInput; state.pendingPlayerInput = null;
      addBubble({ kind: 'player', text: t });
      await delay(360);
      try { await npcRespondToPlayer(t, 1); } catch (_) {}
    }
    maybeAmbient(0.16);
  }
  showDebateActions();
}

function showDebateActions() {
  const calmBtn = state._chaosFired
    ? '<button class="cy-btn danger" onclick="calmChaos()">🔔 鸣磬肃静</button>'
    : '';
  setActions(`
    ${calmBtn}
    <button class="cy-btn primary" onclick="doAction('approve')">准 奏</button>
    <button class="cy-btn danger" onclick="doAction('reject')">驳 奏</button>
    <button class="cy-btn" onclick="doAction('hold')">留 中</button>
    <button class="cy-btn muted" onclick="toggleMorePopover()">⋯ 更多</button>
    <button class="cy-btn" onclick="anotherDebateRound()">▶ 续议一轮</button>
    <div class="cy-popover" id="more-popover">
      <button class="cy-popover-item" onclick="doMore('refer')">发部议 →</button>
      <button class="cy-popover-item" onclick="doMore('escalate')">下廷议</button>
      <button class="cy-popover-item" onclick="doMore('modify')">改批 →</button>
      <button class="cy-popover-item" onclick="doMore('probe')">追问 →</button>
      <div class="cy-popover-divider"></div>
      <button class="cy-popover-item" onclick="doMore('summon')">传召 →</button>
      <button class="cy-popover-item" onclick="doMore('admonish')">训诫 →</button>
      <button class="cy-popover-item" onclick="doMore('praise')">嘉奖 →</button>
    </div>
  `);
}


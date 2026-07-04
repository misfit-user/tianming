// @ts-check
/* ═══════════════════════════════════════════════════════════════════════
 *  tm-chaoyi-changchao-flows.js — 常朝 v3·抗辩/混乱/金口/连锁/入口（2026-07-04 立项拆分·自 tm-chaoyi-changchao.js 保序切出）
 *  内容：runDissentFlow/maybeFireChaos/doMore/金口四具/动作连锁/收场/入口 _cc3_open
 *  注：window.resolveDissent 等装载期赋值随本文件在原位置照跑（after-sibling 保序）
 *  加载序：index.html 中紧挨 tm-chaoyi-changchao.js 之后——执行顺序与拆分前逐字节等价·勿改
 * ═══════════════════════════════════════════════════════════════════════ */
// ═══ 抗辩面板 ═══
async function runDissentFlow(action, item) {
  // 选定抗辩者：决断的反方
  const targetStance = (action === 'approve') ? 'oppose' : 'support';
  const candidates = collectByStance(item, targetStance, 1, item.presenter);
  if (candidates.length === 0) return false;
  const dissenter = candidates[0];

  const main = $('cy-stage-main');
  const panel = document.createElement('div');
  panel.className = 'dissent-panel';
  panel.innerHTML = '<div class="dissent-panel-title">━━ ' + escHtml(dissenter) + ' 出 列 严 辞 抗 辩 ━━</div>';
  main.appendChild(panel);
  main.scrollTop = main.scrollHeight;
  await delay(420);

  const argLines = action === 'approve' ? [
    '陛下！臣 ' + dissenter + ' 不敢苟同 · 此事关乎大体 · 若如此行 · 后必致祸 · 望陛下三思！',
    '陛下圣意虽明 · 然臣以为此举有未周之处 · 容臣冒死再陈！',
    '陛下三思！此议若行 · 则祖制有伤 · 民生有困 · 臣愿以死谏！'
  ] : [
    '陛下何以驳之？此事确为臣等再三斟酌 · 望陛下听臣等申辩！',
    '陛下！此驳臣实不敢领旨 · 容臣再陈一二！',
    '陛下！臣等所奏 · 实非妄言 · 望陛下听臣抗辩！'
  ];
  addBubble({ name: dissenter, stance: targetStance, text: argLines[Math.floor(Math.random() * argLines.length)] });
  await delay(500);

  state._dissentItem = item;
  state._dissentAction = action;
  state._dissentTarget = dissenter;
  setActions(`
    <button class="cy-btn" onclick="resolveDissent('listen')">🎤 听其抗辩</button>
    <button class="cy-btn primary" onclick="resolveDissent('override')">🛡️ 朕意已决</button>
    <button class="cy-btn danger" onclick="resolveDissent('reprimand')">⚡ 严斥</button>
  `);
  return 'wait';
}

window.resolveDissent = async function(choice) {
  const dissenter = state._dissentTarget;
  const item = state._dissentItem;
  const action = state._dissentAction;

  if (choice === 'listen') {
    addBubble({ kind: 'player', text: '卿但言之 · 朕听。' });
    await delay(380);
    addBubble({ name: dissenter, stance: 'oppose', text: '臣以为：此举不合祖制 · 又伤民生。「' + (item.title) + '」一事 · 若不慎议 · 后必有祸。臣愿以言官身份冒死再请陛下察之。' });
    await delay(600);
    setActions(`
      <button class="cy-btn primary" onclick="resolveDissentFinal('accept')">📝 从其议</button>
      <button class="cy-btn" onclick="resolveDissentFinal('hold_orig')">🛡️ 朕意已决</button>
    `);
    return;
  }
  if (choice === 'override') {
    addBubble({ kind: 'player', text: '朕意已决 · 卿不必再言。' });
    await delay(380);
    addBubble({ name: dissenter, stance: 'oppose', text: '臣······谨遵旨。（眼神低垂 · 退入班列。）' });
    addBubble({ kind: 'system', sysKind: 'warn', text: '（' + dissenter + ' 暗中怀恨 · loyalty -5 · 派系反弹 +2）' });
    await finishDissent();
    return;
  }
  if (choice === 'reprimand') {
    // 走严斥 5 outcome 流程
    await runActionReactions('admonish', item, dissenter);
    await finishDissent();
    return;
  }
};

window.resolveDissentFinal = async function(choice) {
  const dissenter = state._dissentTarget;
  const item = state._dissentItem;
  const action = state._dissentAction;

  if (choice === 'accept') {
    addBubble({ kind: 'player', text: '卿言有理 · 朕从之。' });
    await delay(380);
    addBubble({ name: dissenter, stance: 'support', text: '陛下纳谏从善 · 实为社稷之福！臣等敬服！' });
    addBubble({ kind: 'system', sysKind: 'success', text: '（陛下从谏如流 · 民心 +1 · 百官信服 +2 · 原决议改为「' + (action === 'approve' ? '驳' : '准') + '」。）' });
  } else {
    addBubble({ kind: 'player', text: '卿之言朕已闻 · 然朕意已决。' });
    await delay(380);
    addBubble({ name: dissenter, stance: 'oppose', text: '陛下······臣无言。（伏首良久 · 泪下沾襟。）' });
    addBubble({ kind: 'system', sysKind: 'warn', text: '（' + dissenter + ' 心灰意冷 · loyalty -3 · 言路阻塞 -1）' });
  }
  await finishDissent();
};

async function finishDissent() {
  // 完成抗辩·继续主流程到下一议程
  state._dissentItem = null;
  state._dissentTarget = null;
  state._dissentAction = null;
  await delay(380);
  state.decisions.push({ idx: state.currentIdx, action: 'approve', item: AGENDA[state.currentIdx], label: '准奏（含抗辩）' });
  state.currentIdx++;
  updateProgress();
  await delay(300);
  return runNextItem();
}

// ═══ 喧哗 / 鸣磬肃静 ═══
async function maybeFireChaos(item) {
  if (state._chaosFired) return false;
  if (state.debateRound < 2) return false;
  if (item.controversial < 8) return false;
  state._chaosFired = true;
  $('cy-stage').classList.add('chaos');
  addBubble({ kind: 'system', sysKind: 'warn', text: '（殿中喧哗 · 几人同声相应！声浪未歇。）' });
  await delay(450);
  addBubble({ kind: 'system', sysKind: 'warn', text: '（' + (item.target ? item.target + ' 与' : '') + '数员争辩不休 · 班次为之微乱。）' });
  await delay(380);
  return true;
}

window.calmChaos = async function() {
  if (!state._chaosFired) return;
  $('cy-stage').classList.remove('chaos');
  state._chaosFired = false;
  addBubble({ kind: 'system', sysKind: 'success', text: '（鸣磬肃静 · 百官噤声 · 朝堂复仪。）' });
  await delay(360);
  showDebateActions();
};

async function anotherDebateRound() {
  state.debateRound++;
  setPhase('【议 论】 第 ' + state.debateRound + ' 轮', '百官辩难继续 · 陛下可即说');
  // 议论分隔
  const mainR = $('cy-stage-main');
  const divR = document.createElement('div');
  divR.className = 'round-divider';
  const cnLabels = ['壹', '贰', '叁', '肆', '伍'];
  divR.textContent = '殿 中 议 论 · 第 ' + (cnLabels[state.debateRound - 1] || state.debateRound) + ' 轮';
  mainR.appendChild(divR);
  mainR.scrollTop = mainR.scrollHeight;
  const item = AGENDA[state.currentIdx];
  // 优先用预写 debate2（真新内容）·没有就回退到原数组首尾互换
  const round = item.debate2 || (item.debate || []).slice().reverse().slice(0, 3).map(d => ({
    name: d.name, stance: d.stance,
    line: '臣之意已具于前 · 伏惟圣裁。' + (d.stance === 'oppose' ? '不可不察。' : '不必再争。')
  }));
  for (const npc of round) {
    // AI 流式·二轮要"承上启下/折中/进展"·读他臣已有立场
    await _cc3_streamReactBubble(npc, item, 'debate2');
    await delay(280);
    if (state.pendingPlayerInput) {
      const t = state.pendingPlayerInput; state.pendingPlayerInput = null;
      addBubble({ kind: 'player', text: t });
      await delay(360);
      try { await npcRespondToPlayer(t, 1); } catch (_) {}
    }
    maybeAmbient(0.18);
  }
  // 二轮议论后·高争议议程触发喧哗
  await maybeFireChaos(item);
  showDebateActions();
}

// 收尾
async function runClosing() {
  state.phase = 'closing';
  // 清阶段标签状态
  const tag = $('cy-phase-tag'); tag.classList.remove('strict', 'urgent');
  setPhase('【退 朝】', '卷帘退朝 · 鸣鞭');
  setActions('<span style="color:var(--ink-500);font-size:12px;">朝会即散……</span>');
  await delay(400);
  addBubble({ kind: 'system', sysKind: 'ceremony', text: '〔 百 官 奏 事 已 毕 〕' });
  await delay(600);
  addBubble({ kind: 'system', text: '（陛下整衣 · 起身。百官伏首恭送。）' });
  await delay(700);
  // 退朝鸣鞭（视觉化）
  const main = $('cy-stage-main');
  const bell = document.createElement('div');
  bell.className = 'bell-ring';
  bell.innerHTML = '<span style="font-size:22px;">铮</span><span style="font-size:22px;">铮</span>';
  main.appendChild(bell);
  main.scrollTop = main.scrollHeight;
  await delay(1400);
  addBubble({ kind: 'system', sysKind: 'ceremony', text: '〔 鸣 鞭 · 卷 帘 退 朝 〕' });
  await delay(700);
  state.done = true;
  // P0 C6·朝会决议持久化到 GM._courtRecords
  _cc3_persistCourtRecord();
  // P0 后朝结束钩子
  if (state._isPostTurn && typeof _onPostTurnCourtEnd === 'function') {
    try { _onPostTurnCourtEnd(); } catch (_) {}
  }
  showSummary();
}

/** C6·朝会快照写入 GM._courtRecords（AI 推演读"上回合圣意"靠它）
 *  现在包含：transcript 对话原文 / stances 真实立场聚合 / decisions 完整动作 / extras 玩家修改
 */
function _cc3_persistCourtRecord() {
  if (typeof GM === 'undefined') return;
  if (!GM._courtRecords) GM._courtRecords = [];
  const turn = GM.turn || 0;
  const isPostTurn = (typeof state !== 'undefined' && state._isPostTurn != null)
                     ? !!state._isPostTurn
                     : !!GM._isPostTurnCourt;

  // ── 聚合 NPC 真实立场（从 AGENDA.selfReact + debate + debate2 + transcript NPC 发言收集） ──
  const stances = {}; // { name: { stance, brief } }
  const collectStance = function(arr) {
    if (!Array.isArray(arr)) return;
    arr.forEach(function(r) {
      if (!r || !r.name || !r.line) return;
      // 后写覆盖前写·debate2 优先·体现立场演化最终态
      stances[r.name] = { stance: r.stance || 'neutral', brief: String(r.line).slice(0, 80) };
    });
  };
  AGENDA.forEach(function(it) {
    collectStance(it.selfReact);
    collectStance(it.debate);
    collectStance(it.debate2);
  });
  // 从 transcript 补足（玩家应答中 NPC 也表过态）
  (state._transcript || []).forEach(function(t) {
    if (t.role === 'npc' && t.speaker && !stances[t.speaker]) {
      stances[t.speaker] = { stance: t.stance || 'neutral', brief: String(t.text).slice(0, 80) };
    }
  });

  // ── adopted/decisions·包含玩家修改 / 追问 / 改批的具体内容 ──
  const adopted = state.decisions
    .filter(d => d.action === 'approve' || d.action === 'modify' || d.action === 'decree')
    .map(d => {
      let content = d.item.title + '：' + String(d.item.detail || d.item.content || '').slice(0, 100);
      if (d.action === 'modify' && d.extra) content += '【玩家改批】' + String(d.extra).slice(0, 150);
      if (d.action === 'decree' && d.extra) content += '【当庭口诏】' + (typeof d.extra === 'object' ? (d.extra.text || JSON.stringify(d.extra)) : String(d.extra)).slice(0, 150);
      return { author: d.item.presenter, content: content, stance: 'support' };
    });

  const decisionsFull = state.decisions.map(d => ({
    title: d.item.title,
    action: d.action,
    presenter: d.item.presenter,
    dept: d.item.dept || '',
    label: d.label,
    extra: d.extra ? (typeof d.extra === 'object' ? JSON.stringify(d.extra).slice(0, 200) : String(d.extra).slice(0, 200)) : ''
  }));

  // ── transcript 摘要·只保留 player + npc·过滤系统·上限 60 条防爆 endturn prompt ──
  const transcript = (state._transcript || [])
    .filter(t => t.role === 'player' || t.role === 'npc')
    .slice(-60)
    .map(t => ({ role: t.role, speaker: t.speaker, text: t.text, stance: t.stance || '', agendaIdx: t.agendaIdx }));

  const record = {
    turn: turn,
    targetTurn: isPostTurn ? (turn + 1) : turn,
    phase: isPostTurn ? 'post-turn' : 'in-turn',
    topic: state.decisions.length > 0 ? '常朝·' + state.decisions.length + ' 议（' + state.decisions.map(d => (d.label || d.action)).slice(0, 3).join('·') + '...）' : '空朝',
    mode: 'changchao',
    participants: state.attendees.slice(),
    stances: stances,
    adopted: adopted,
    decisions: decisionsFull,
    transcript: transcript,
    dismissed: state.decisions.length === 0,
    _secret: false,
    _v3: true
  };
  GM._courtRecords.push(record);
  if (GM._courtRecords.length > 8) GM._courtRecords.shift();
  // 计入 _lastChangchaoDecisions（含 extra·让 endturn 读到玩家改批/口诏）
  GM._lastChangchaoDecisions = state.decisions.map(d => ({
    action: d.action,
    title: d.item.title,
    dept: d.item.dept || '',
    extra: d.extra ? (typeof d.extra === 'object' ? (d.extra.text || JSON.stringify(d.extra)) : String(d.extra)).slice(0, 150) : ''
  }));
  GM._lastChangchaoDecisionMeta = {
    turn: record.turn,
    targetTurn: record.targetTurn,
    phase: record.phase,
    mode: record.mode
  };
  GM._lastChangchaoDecisionsTargetTurn = record.targetTurn;

  // ── 写起居注 (qijuHistory)·让 纪事 标签页能看到本次朝议 ──
  if (Array.isArray(GM.qijuHistory)) {
    const counts = { approve: 0, reject: 0, hold: 0, modify: 0, refer: 0, escalate: 0, decree: 0, summon: 0, admonish: 0, praise: 0, probe: 0 };
    state.decisions.forEach(d => { if (counts[d.action] != null) counts[d.action]++; });
    const cnArr = [];
    if (counts.approve) cnArr.push('准 ' + counts.approve);
    if (counts.reject)  cnArr.push('驳 ' + counts.reject);
    if (counts.modify)  cnArr.push('改批 ' + counts.modify);
    if (counts.hold)    cnArr.push('留中 ' + counts.hold);
    if (counts.escalate) cnArr.push('转廷议 ' + counts.escalate);
    if (counts.decree)   cnArr.push('当庭口诏 ' + counts.decree);
    const chaoLabel = isPostTurn ? '朔朝' : '常朝';
    const date = (typeof getTSText === 'function') ? getTSText(turn) : ('T' + turn);
    let qjContent = '【' + chaoLabel + '】共议 ' + state.decisions.length + ' 事·' + (cnArr.length ? cnArr.join('·') : '皆无定论');
    // 附 1-3 个具体议题标题
    if (state.decisions.length > 0) {
      const titles = state.decisions.slice(0, 3).map(d => d.item.title).join('、');
      qjContent += '。议：' + titles + (state.decisions.length > 3 ? '等' : '');
    }
    if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({ turn: turn, targetTurn: record.targetTurn, phase: record.phase, date: date, content: qjContent });
  }

  // ── 重大决议（modify / decree / 高重要性 confrontation）写入编年长期项 ──
  if (Array.isArray(GM.biannianItems)) {
    state.decisions.forEach(d => {
      const isMajor = d.action === 'modify' || d.action === 'decree' ||
                      (d.action === 'approve' && d.item.importance >= 7) ||
                      (d.action === 'reject' && d.item.importance >= 7);
      if (!isMajor) return;
      const date = (typeof getTSText === 'function') ? getTSText(turn) : ('T' + turn);
      const content = (d.label || d.action) + ': ' + d.item.title +
                      (d.extra ? '·' + (typeof d.extra === 'object' ? (d.extra.text || '') : String(d.extra)).slice(0, 100) : '');
      GM.biannianItems.push({
        startTurn: turn,
        turn: turn,
        title: '【' + (isPostTurn ? '朔朝' : '常朝') + '】' + d.item.title,
        date: date,
        content: content,
        category: d.item.type || 'routine',
        authorityLevel: 'official_record',
        confidence: 0.7,
        _source: 'chaoyi-v3',
        _resolved: false
      });
    });
  }

  // ── 长期落实型决议·挂入 ChronicleTracker·进"纪事"标签页 + AI 推演每回合可见 ──
  // 与廷议同一机制·但只针对 approve/modify/decree 三类被实际推行的决议
  // 关键词覆盖常朝可能涉及的长期工程：
  try {
    const _CC_LONG_KW = /清查|屯田|开海|变法|赈|修河|河漕|塞外|边备|科举|盐法|盐课|盐运|茶法|茶马|钱法|榷|督师|经略|募兵|裁汰|察吏|京察|大计|封贡|和亲|筑城|营造|开矿|铸钱|抚|平定|教化|兴学|兴修|疏浚|徭役|垦荒|镇抚|征讨|经营|工程|赈灾|修缮|减赋|蠲免/;
    if (typeof ChronicleTracker !== 'undefined' && ChronicleTracker.upsert) {
      const chaoLbl = isPostTurn ? '朔朝' : '常朝';
      state.decisions.forEach(d => {
        // 仅 approve/modify/decree 推行类·驳回/留中/转部议不挂
        if (!['approve', 'modify', 'decree'].includes(d.action)) return;
        const ttl = d.item && d.item.title || '';
        const ctn = d.item && (d.item.content || d.item.detail) || '';
        const extraText = d.extra ? (typeof d.extra === 'object' ? (d.extra.text || '') : String(d.extra)) : '';
        const combined = ttl + '·' + ctn + '·' + extraText;
        if (!_CC_LONG_KW.test(combined)) return;
        const trackTitle = ttl.length > 24 ? ttl.slice(0, 22) + '…' : ttl;
        const trackId = 'cc_' + chaoLbl + '_' + turn + '_' + ttl.slice(0, 6).replace(/\s/g, '');
        // 估完工回合·调用 ChronicleTracker.estimateExpectedTurns 按 daysPerTurn 自动换算
        let subkindCC = '默认';
        if (/变法/.test(combined)) subkindCC = '变法';
        else if (/边事|塞外|经略|督师/.test(combined)) subkindCC = '边事';
        else if (/工程|筑城|营造|河漕|修河/.test(combined)) subkindCC = '工程';
        else if (/赈|抚|蠲免|减赋/.test(combined)) subkindCC = '赈抚';
        let expectedTurns = (typeof ChronicleTracker !== 'undefined' && ChronicleTracker.estimateExpectedTurns)
          ? ChronicleTracker.estimateExpectedTurns({ kind: '常朝', subkind: subkindCC, difficulty: d.action === 'modify' ? 'high' : 'medium' })
          : 8;
        let _profileC = (typeof ChronicleTracker !== 'undefined' && ChronicleTracker.estimateEffectProfile)
          ? ChronicleTracker.estimateEffectProfile({ kind: '常朝', subkind: subkindCC })
          : null;
        const stakeholders = [];
        if (d.item && d.item.presenter) stakeholders.push(d.item.presenter);
        if (d.item && d.item.dept) stakeholders.push(d.item.dept);
        ChronicleTracker.upsert({
          id: trackId,
          type: 'changchao_pending',
          category: chaoLbl + '待落实',
          title: trackTitle,
          narrative: '〔' + chaoLbl + '·' + (d.label || d.action) + '〕' + (ctn || ttl).slice(0, 80) + (extraText ? '\n〔朱批〕' + extraText.slice(0, 80) : ''),
          actor: (d.item && d.item.presenter) || '',
          stakeholders: stakeholders,
          startTurn: turn,
          expectedEndTurn: turn + expectedTurns,
          currentStage: '颁诏起手',
          progress: 5,
          priority: d.action === 'modify' ? 'high' : (d.item && d.item.importance >= 7 ? 'high' : 'medium'),
          sourceType: 'changchao',
          sourceId: trackId,
          status: 'active',
          // 效果模型·短期 vs 长期张力 + 玩家可终结
          perTurnEffect: _profileC && _profileC.perTurnEffect,
          finalEffect: _profileC && _profileC.finalEffect,
          shortTermBalance: _profileC && _profileC.shortTermBalance,
          longTermBalance: _profileC && _profileC.longTermBalance,
          terminable: _profileC ? _profileC.terminable : true,
          terminationCost: _profileC && _profileC.terminationCost
        });
      });
    }
  } catch(_ccTrackE) { try{ window.TM&&TM.errors&&TM.errors.captureSilent(_ccTrackE,'cc3·ChronicleTrack'); }catch(_){} }

  // 后朝勤政度
  if (typeof recordCourtHeld === 'function') {
    try { recordCourtHeld({ isPostTurn: isPostTurn, source: 'v3' }); } catch (_) {}
  }
  // G 类·记录各衙门缺席
  try { _cc3_recordDeptAbsence(); } catch (_) {}

  // ── 写入 NPC 个人记忆（NpcMemorySystem.remember）·让 NPC 跨回合记得自己说过/听过什么 ──
  if (typeof NpcMemorySystem !== 'undefined' && typeof NpcMemorySystem.remember === 'function') {
    const chaoLabel = isPostTurn ? '朔朝' : '常朝';
    // 1) 每个有立场表态的 NPC·记其立场
    Object.keys(stances).forEach(function(name) {
      const s = stances[name];
      if (!s || !s.brief) return;
      const text = chaoLabel + '议·' + (s.stance === 'support' ? '我赞同' : s.stance === 'oppose' ? '我反对' : s.stance === 'mediate' ? '我折中' : '我陈见') +
                   '：' + s.brief.slice(0, 60);
      const emo = s.stance === 'support' ? '安' : s.stance === 'oppose' ? '不平' : '思';
      const wt  = s.stance === 'oppose' ? 6 : 4;
      try { NpcMemorySystem.remember(name, text, emo, wt, '朝议'); } catch (_) {}
    });
    // 2) 每个被玩家训诫/嘉奖的 NPC·记忆深刻
    state.decisions.forEach(function(d) {
      if (d.action === 'admonish' || d.action === 'praise' || d.action === 'summon') {
        const tgt = (d.extra && typeof d.extra === 'string') ? d.extra : (d.item && d.item.target) || '';
        if (!tgt) return;
        const text = chaoLabel + '·陛下' + (d.action === 'admonish' ? '当庭训诫' : d.action === 'praise' ? '当庭嘉奖' : '召我入殿') + '：' + (d.item.title || '');
        const emo = d.action === 'admonish' ? '惧/愤' : d.action === 'praise' ? '荣' : '惶';
        const wt  = d.action === 'admonish' ? 9 : d.action === 'praise' ? 7 : 5;
        try { NpcMemorySystem.remember(tgt, text, emo, wt, '朝议'); } catch (_) {}
      }
    });
    // 3) 主奏者·记其奏疏被如何处理（准/驳/改/留中等）
    state.decisions.forEach(function(d) {
      const presenter = d.item && d.item.presenter;
      if (!presenter) return;
      const fateMap = {
        approve: '我所奏获准·当推行', reject: '我所奏被驳·心有不平', hold: '我所奏被留中·悬置未决',
        modify: '我所奏被陛下改批·需按新方案行', refer: '我所奏转部议·待回奏', escalate: '我所奏下廷议',
        probe: '陛下追问我此奏·须详陈', decree: '此事陛下另发口诏', skip: '我所奏未及讨论'
      };
      const text = chaoLabel + '·' + (fateMap[d.action] || ('裁决:' + d.action)) + '：' + (d.item.title || '') +
                   (d.extra ? '·' + String(d.extra).slice(0, 50) : '');
      const emo = (d.action === 'approve' || d.action === 'praise') ? '喜' :
                  (d.action === 'reject' || d.action === 'admonish') ? '忧' : '思';
      const wt = (d.action === 'reject' || d.action === 'modify') ? 7 : 5;
      try { NpcMemorySystem.remember(presenter, text, emo, wt, '朝议'); } catch (_) {}
    });
  }

  console.log('[cc3·persist] 朝议已记入 _courtRecords (转录 ' + transcript.length + ' 条·立场 ' + Object.keys(stances).length + ' 人) + qijuHistory + biannianItems + NpcMemory');
}

function showSummary() {
  const skipPref = (function(){ try { return localStorage.getItem('tm.chaoyi.skipSummary') === '1'; } catch(_) { return false; } })();
  if (skipPref) {
    // 直接关闭朝会·不弹总结
    addBubble({ kind: 'system', text: '（朝会已散 · 总结已隐 · 可在设置中重新启用。）' });
    return;
  }
  // 按 action 分类·v2 借鉴的 tally 形式
  const counts = { approve: 0, reject: 0, hold: 0, skip: 0, refer: 0, escalate: 0, modify: 0, probe: 0, summon: 0, admonish: 0, praise: 0, decree: 0 };
  state.decisions.forEach(d => { if (counts[d.action] != null) counts[d.action]++; });
  // 议程内容简表
  let agendaList = '';
  state.decisions.forEach((d, i) => {
    const labelMap = { approve: '准', reject: '驳', hold: '留', skip: '免', refer: '部议', escalate: '廷议', modify: '改', probe: '问', summon: '召', admonish: '诫', praise: '奖', decree: '诏' };
    const colorMap = { approve: 'celadon-400', reject: 'vermillion-300', hold: 'gold-400', skip: 'ink-500', escalate: 'amber-400', refer: 'amber-400', modify: 'gold-300', probe: 'ink-500', summon: 'celadon-400', admonish: 'vermillion-300', praise: 'celadon-400', decree: 'gold-300' };
    const lbl = labelMap[d.action] || d.action;
    const col = colorMap[d.action] || 'ink-500';
    agendaList += `<div style="display:flex;justify-content:space-between;font-size:12px;line-height:1.9;padding:2px 0;border-bottom:1px dashed var(--border-subtle);">
      <span style="color:var(--ink-500);">${i + 1}. ${escHtml(d.item.title || '?')}</span>
      <span style="color:var(--${col});font-family:var(--font-serif);">${lbl}</span>
    </div>`;
  });

  // 主 tally line（v2 风格：准N 驳N 议N 留N）
  const tallyLine = `
    <div style="text-align:center;font-family:var(--font-serif);letter-spacing:0.18em;font-size:14px;margin-bottom:10px;">
      <span class="tally-pill tally-approve">准 ${counts.approve}</span>
      <span class="tally-pill tally-reject">驳 ${counts.reject}</span>
      <span class="tally-pill tally-hold">留 ${counts.hold}</span>
      ${counts.escalate ? `<span class="tally-pill tally-other">廷议 ${counts.escalate}</span>` : ''}
      ${counts.refer ? `<span class="tally-pill tally-other">部议 ${counts.refer}</span>` : ''}
      ${counts.skip ? `<span class="tally-pill tally-other">免 ${counts.skip}</span>` : ''}
    </div>
    ${(counts.admonish || counts.praise || counts.decree || counts.modify) ? `
    <div style="text-align:center;font-size:12px;color:var(--ink-500);margin:8px 0;letter-spacing:0.15em;">
      ${counts.modify ? `改批 ${counts.modify} · ` : ''}
      ${counts.admonish ? `训诫 ${counts.admonish} · ` : ''}
      ${counts.praise ? `嘉奖 ${counts.praise} · ` : ''}
      ${counts.decree ? `亲诏 ${counts.decree}` : ''}
    </div>` : ''}
  `;

  if (state.decisions.length === 0) {
    agendaList = '<div style="color:var(--ink-500);text-align:center;padding:14px;">本朝未议任何议程。</div>';
  }

  const card = document.createElement('div');
  card.className = 'cy-summary-mask';
  card.innerHTML = `
    <div class="cy-summary-card">
      <h2>〔 朝 会 已 散 〕</h2>
      <div class="cy-summary-tally">
        ${tallyLine}
        <div style="margin-top:6px;">${agendaList}</div>
      </div>
      <div class="skip-row"><label><input type="checkbox" id="skip-summary-cb"> 下次不再弹此总结（可在设置改回）</label></div>
      <div class="actions">
        <button class="cy-btn" onclick="closeSummary(false)">关闭</button>
        <button class="cy-btn primary" onclick="closeSummary(true)">详记入起居注</button>
      </div>
    </div>
  `;
  $('cy-stage').appendChild(card);
}

window.closeSummary = function(detailed) {
  const cb = $('skip-summary-cb');
  if (cb && cb.checked) {
    try { localStorage.setItem('tm.chaoyi.skipSummary', '1'); } catch(_){}
  }
  const m = document.querySelector('.cy-summary-mask');
  if (m) m.remove();
  if (detailed) addBubble({ kind: 'system', text: '（详记入起居注。）' });
};

// ═══════════════════════════════════════════════
// 更多菜单·二级输入
// ═══════════════════════════════════════════════
function doMore(action) {
  const pop = $('more-popover'); if (pop) pop.classList.remove('show');
  const item = AGENDA[state.currentIdx];
  if (action === 'refer') {
    showInputModal({
      title: '发部议',
      hint: '选定承议衙门 · N 回合后该部主官回奏',
      kind: 'select',
      options: (typeof _cc3_getScenarioConfig === 'function' ? _cc3_getScenarioConfig().deptOptions : ['户部', '吏部', '兵部', '礼部', '刑部', '工部', '都察院']),
      submit: (v) => finalizeAction('refer', v)
    });
  } else if (action === 'escalate') {
    finalizeAction('escalate');
  } else if (action === 'modify') {
    showInputModal({
      title: '改批 · 玩家口述方案',
      hint: '陛下口述新方案 · 替代原奏 · 进诏令追踪',
      kind: 'textarea',
      placeholder: '朕意如此：……',
      submit: (v) => finalizeAction('modify', v || '〔玩家口述方案〕')
    });
  } else if (action === 'probe') {
    showInputModal({
      title: '追问 · 问奏报者细节',
      hint: '陛下追问 · 奏报者将详陈一段',
      kind: 'textarea',
      placeholder: '细言之 / 此款几何 / ……',
      submit: (v) => finalizeAction('probe', v || '细言之。')
    });
  } else if (action === 'summon') {
    const pool = _cc3_buildSummonablePool();
    if (pool.length === 0) { alert('当前无可传召之人。'); return; }
    // 风险低者排前·让玩家先看到正常选项
    pool.sort((a, b) => a.risk - b.risk || a.name.localeCompare(b.name));
    showInputModal({
      title: '传召 · 召入殿',
      hint: '正常缺朝即至·破格召后宫/宗室/学子则言官必弹·或成新议',
      kind: 'select',
      options: pool.map(p => ({ value: p.name, label: p.displayLabel })),
      submit: (v) => finalizeAction('summon', v)
    });
  } else if (action === 'admonish' || action === 'praise') {
    showInputModal({
      title: action === 'admonish' ? '训诫 · 当庭训某官' : '嘉奖 · 当庭赏某官',
      hint: action === 'admonish' ? 'loyalty -2 · 派系记仇 +1' : 'loyalty +3 · 名望 +1',
      kind: 'select',
      options: state.attendees,
      submit: (v) => finalizeAction(action, v)
    });
  }
}

function showInputModal(opts) {
  const m = document.createElement('div');
  m.className = 'cy-input-modal';
  let inputHtml = '';
  if (opts.kind === 'textarea') {
    inputHtml = `<textarea id="modal-input" placeholder="${escHtml(opts.placeholder||'')}" rows="3"></textarea>`;
  } else if (opts.kind === 'select') {
    // 选项支持 string 或 {value, label} — 后者用于显示带分类标签的人名
    inputHtml = `<select id="modal-input">${(opts.options||[]).map(o => {
      if (o && typeof o === 'object') {
        return `<option value="${escHtml(o.value)}">${escHtml(o.label || o.value)}</option>`;
      }
      return `<option value="${escHtml(o)}">${escHtml(o)}</option>`;
    }).join('')}</select>`;
  } else {
    inputHtml = `<input id="modal-input" type="text" placeholder="${escHtml(opts.placeholder||'')}" />`;
  }
  m.innerHTML = `
    <div class="cy-input-modal-card">
      <h3>${escHtml(opts.title)}</h3>
      <div class="hint">${escHtml(opts.hint||'')}</div>
      ${inputHtml}
      <div class="row">
        <button class="cy-btn muted" id="modal-cancel">取消</button>
        <button class="cy-btn primary" id="modal-ok">确定</button>
      </div>
    </div>
  `;
  $('cy-stage').appendChild(m);
  setTimeout(() => $('modal-input').focus(), 50);
  $('modal-cancel').onclick = () => m.remove();
  $('modal-ok').onclick = () => {
    const v = $('modal-input').value;
    m.remove();
    if (opts.submit) opts.submit(v);
  };
}

// ═══════════════════════════════════════════════
// 金口·四项工具
// ═══════════════════════════════════════════════
function showJinkouPopover() {
  const existing = document.querySelector('.cy-popover.jinkou');
  if (existing) { existing.remove(); return; }
  const tier = computeDecreeTier();
  const pop = document.createElement('div');
  pop.className = 'cy-popover show jinkou';
  pop.style.bottom = '60px';
  pop.style.right = '12px';
  pop.style.left = 'auto';
  pop.innerHTML = `
    <button class="cy-popover-item" onclick="doJinkou('inquire')">🗣 训问 X 卿 <span class="hint">问任意在场官员立场</span></button>
    <button class="cy-popover-item" onclick="doJinkou('reassign')">👤 指 Y 主奏 <span class="hint">绕开本部尚书</span></button>
    <button class="cy-popover-item" onclick="doJinkou('private')">🤫 私下示意 Z <span class="hint">朝散后入御前问对队列</span></button>
    <div class="cy-popover-divider"></div>
    <button class="cy-popover-item" onclick="doJinkou('decree')">📜 当庭口述诏令 <span class="hint">按皇威皇权效果不同</span></button>
    <div class="tier-preview tier-${tier.code}">
      <div><strong>当前预测 · ${tier.name}</strong></div>
      <div>皇威 ${state.prestige} · 皇权 ${state.power}</div>
      <div style="margin-top:3px;">${tier.desc}</div>
    </div>
  `;
  $('cy-stage').appendChild(pop);
}

function computeDecreeTier() {
  const w = state.prestige, p = state.power;
  if (w >= 70 && p >= 70) return {
    code: 'S', name: '圣旨煌煌',
    desc: '百官山呼遵旨·诏令全效。皇威+1 名望+1。'
  };
  if (w < 30 || p < 30) return {
    code: 'D', name: '危诏激变',
    desc: '当庭抗议跪谏·诏令 blocked。皇威-3 权威-2 派系叛意+。'
  };
  if (w < 50 && p < 50) return {
    code: 'D', name: '诏不下殿',
    desc: '言官即奏封驳·诏令打 50% 折或转廷议。皇权-1。'
  };
  if (w < 50 && p >= 50) return {
    code: 'C', name: '众议汹汹',
    desc: '派系联合抗辩·诏令全效但民心-2·暴名+1。'
  };
  if (w >= 70 || p >= 70) return {
    code: 'A', name: '凛然奉旨',
    desc: '百官面色凝重·默奉旨。诏令全效。反对派 loyalty -1。'
  };
  return {
    code: 'B', name: '勉强尊行',
    desc: '诏令奉行·派系内部记仇·loyalty 略降。'
  };
}

function doJinkou(kind) {
  const pop = document.querySelector('.cy-popover.jinkou');
  if (pop) pop.remove();
  if (kind === 'inquire') {
    showInputModal({
      title: '训问 · X 卿以为如何',
      hint: '选定在场官员 · 该官将立场化回应',
      kind: 'select',
      options: state.attendees,
      submit: (v) => {
        const t = '卿 ' + v + ' · 以为如何？';
        addBubble({ kind: 'player', text: t });
        // 走流式 AI 应答（v 已在文本中·findMentionedChars 会识别为定向回应）
        setTimeout(() => { try { npcRespondToPlayer(t, 1); } catch (_) {} }, 400);
      }
    });
  } else if (kind === 'reassign') {
    showInputModal({
      title: '指定主奏 · 绕开本部尚书',
      hint: '选定本部其他官员重述',
      kind: 'select',
      options: state.attendees,
      submit: (v) => addBubble({ kind: 'system', text: '（' + v + ' 出班 · 替代主奏。）' })
    });
  } else if (kind === 'private') {
    showInputModal({
      title: '私下示意 Z · 朝散后入御前',
      hint: '不当庭奏对·朝散后 Z 单独入御前问对队列',
      kind: 'select',
      options: state.attendees,
      submit: (v) => addBubble({ kind: 'system', text: '（陛下以目示意 ' + v + ' · ' + v + ' 微微颔首。朝散后入御前问对队列。）' })
    });
  } else if (kind === 'decree') {
    const tier = computeDecreeTier();
    showInputModal({
      title: '当庭口述诏令 · ' + tier.name,
      hint: '档位预测：' + tier.desc + ' (后果由 AI 推演定 · 此为提示)',
      kind: 'textarea',
      placeholder: '制曰：……',
      submit: (v) => finalizeAction('decree', { text: v || '〔陛下口述诏令〕', tier: tier.code })
    });
  }
}

// ═══════════════════════════════════════════════
// 动作连锁反应·按 action + 立场层级触发多 NPC 反应
// ═══════════════════════════════════════════════
function collectByStance(item, targetStance, maxCount, exclude) {
  const result = []; const seen = new Set();
  if (exclude) seen.add(exclude);
  // 优先取 debate（有显式立场）
  (item.debate || []).forEach(d => {
    if (d.stance === targetStance && !seen.has(d.name) && CHARS[d.name] && !CHARS[d.name].absent) {
      result.push(d.name); seen.add(d.name);
    }
  });
  // 次选 selfReact
  (item.selfReact || []).forEach(d => {
    if (d.stance === targetStance && !seen.has(d.name) && CHARS[d.name] && !CHARS[d.name].absent) {
      result.push(d.name); seen.add(d.name);
    }
  });
  return result.slice(0, maxCount);
}
function pickLine(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const PRESENTER_AFTER_APPROVE = [
  '臣谢陛下圣裁！臣即办去 · 三日内回奏进展。',
  '陛下圣明 · 臣谨领旨。臣不敢有负圣望。',
  '臣叩首谢恩 · 必竭股肱之力。',
  '陛下既准 · 臣即下文督办 · 不日即见效。'
];
const SUPPORTER_AFTER_APPROVE = [
  '陛下圣明！臣等附议·此乃国之大幸。',
  '陛下睿断·此举固本固民·臣等敬服。',
  '陛下高瞻远瞩·臣愿副 {presenter} 督办。',
  '陛下既决·臣亦愿献绵薄之力。'
];
const OPPOSER_AFTER_APPROVE = [
  '陛下既决·臣谨遵旨·然望陛下后续监察。',
  '臣······虽有未尽之言·谨奉圣意。',
  '陛下圣明·臣不敢再争·然望陛下慎之又慎。',
  '臣以言官身份谨陈：望陛下察其行 · 不徒受其文。'
];

const PRESENTER_AFTER_REJECT = [
  '臣······谨遵圣意·然此事容臣再思一二。',
  '陛下既不准·臣······退而再议。',
  '臣愚见难合圣意·谨退·心中不安。',
  '臣······惶恐 · 谨遵陛下圣意。'
];
const OPPOSER_AFTER_REJECT = [  // 反对原议者·驳奏正合心意
  '陛下圣裁！臣谓此事正不可行·陛下明察。',
  '陛下明察秋毫·臣等敬服。',
  '此驳得当·实乃国之幸·臣 {who} 喜出望外。',
  '陛下既驳·诸臣可释虑矣。'
];
const SUPPORTER_AFTER_REJECT = [  // 支持原议者·驳奏失望
  '陛下三思！此事关乎黎庶·若不行·恐有后患。',
  '臣 {who} 以言官身份谨陈·此驳恐有未察。',
  '陛下既驳·然臣······终是不安。',
  '陛下圣意如此·臣等无言·然心中······',
  '陛下！臣愿伏阙再请·此事实不可缓！'
];
const NEUTRAL_AFTER_HOLD = [
  '陛下既留·臣等且候。',
  '臣随圣意·不敢催促。',
  '此事兹事体大·留议亦是稳重之策。'
];
const URGENT_AFTER_HOLD = [
  '陛下！此事不可久延·望陛下早决。',
  '陛下三思·此事压一日·则民苦一日。',
  '臣······惶恐·然此事确不可缓。'
];

async function runActionReactions(action, item, extra) {
  const presenter = item.presenter;
  // ─── 准奏 ───
  if (action === 'approve') {
    addBubble({ name: presenter, text: pickLine(PRESENTER_AFTER_APPROVE) });
    await delay(420);
    const supporters = collectByStance(item, 'support', 2, presenter);
    for (const s of supporters) {
      addBubble({ name: s, stance: 'support', text: pickLine(SUPPORTER_AFTER_APPROVE).replace('{presenter}', presenter) });
      await delay(380);
    }
    maybeAmbient(0.35);
    const opposers = collectByStance(item, 'oppose', 1, presenter);
    for (const o of opposers) {
      addBubble({ name: o, stance: 'oppose', text: pickLine(OPPOSER_AFTER_APPROVE) });
      await delay(380);
    }
    addBubble({ kind: 'system', text: '（议题进诏令追踪表 · ' + presenter + ' 限 ' + (item.urgency === 'urgent' ? '3' : '7') + ' 日内回报。' + (item.controversial > 6 ? ' 反对派记一笔。' : '') + '）' });
    return;
  }
  // ─── 驳奏 ───
  if (action === 'reject') {
    addBubble({ name: presenter, text: pickLine(PRESENTER_AFTER_REJECT) });
    await delay(420);
    // 反对原议者振奋（但若主奏者本身就是关键反对·此处可能为空）
    const opposers = collectByStance(item, 'oppose', 1, presenter);
    for (const o of opposers) {
      addBubble({ name: o, stance: 'oppose', text: pickLine(OPPOSER_AFTER_REJECT).replace('{who}', o) });
      await delay(380);
    }
    maybeAmbient(0.4);
    // 支持原议者失望/再谏
    const supporters = collectByStance(item, 'support', 2, presenter);
    for (const s of supporters) {
      addBubble({ name: s, stance: 'support', text: pickLine(SUPPORTER_AFTER_REJECT).replace('{who}', s) });
      await delay(420);
    }
    addBubble({ kind: 'system', text: '（' + presenter + ' loyalty -1 · 记入此次心意未达。' + (item.controversial > 6 ? ' 派系反弹未息。' : '') + '）' });
    return;
  }
  // ─── 留中 ───
  if (action === 'hold') {
    const isUrgent = item.urgency === 'urgent' || item.importance >= 8;
    addBubble({ name: presenter, text: isUrgent ? pickLine(URGENT_AFTER_HOLD) : pickLine(NEUTRAL_AFTER_HOLD) });
    await delay(380);
    // 殿中各派各表态（取 1 支持 + 1 反对·或 2 中立）
    const supporters = collectByStance(item, 'support', 1, presenter);
    const opposers = collectByStance(item, 'oppose', 1, presenter);
    for (const s of supporters) {
      addBubble({ name: s, stance: 'support', text: '陛下久不决·恐误时机。臣愿再陈······' });
      await delay(360);
    }
    for (const o of opposers) {
      addBubble({ name: o, stance: 'oppose', text: '陛下从容圣裁·臣谓此事正可缓议。' });
      await delay(360);
    }
    maybeAmbient(0.4);
    addBubble({ kind: 'system', text: '（此事入留中册·下次朝议或再现。' + (isUrgent ? '紧急事项不可久延·朝堂记一笔焦虑。' : '') + '）' });
    return;
  }
  // ─── 发部议 ───
  if (action === 'refer') {
    addBubble({ name: presenter, text: '臣谨遵旨·将本案移交 ' + (extra || '某部') + ' 详议·伏候回奏。' });
    await delay(380);
    // 该部主官发声（如是别部则附议·本部则受命）
    addBubble({ kind: 'system', text: '（' + (extra || '某部') + ' 主官出班受命：「臣即召集本部议覆 · 三日内回奏。」）' });
    await delay(380);
    addBubble({ kind: 'system', text: '（事下 ' + (extra || '某部') + ' · 限期回奏 · GM.deptTasks +1）' });
    return;
  }
  // ─── 下廷议 ───
  if (action === 'escalate') {
    addBubble({ name: presenter, text: '陛下圣裁·此事确兹事体大·宜下廷议。' });
    await delay(380);
    _cc3_officialBubble('mediate', '陛下圣明·下廷议方可服众。臣即拟召集名单。', presenter);
    await delay(380);
    maybeAmbient(0.3);
    addBubble({ kind: 'system', text: '（议题转入廷议待议册·下次廷议菜单可见。）' });
    return;
  }
  // ─── 改批 ───
  if (action === 'modify') {
    addBubble({ name: presenter, text: '陛下圣裁所改·臣即遵旨改办。' });
    await delay(380);
    // 立场支持者评价改批
    const supporters = collectByStance(item, 'support', 1, presenter);
    for (const s of supporters) {
      addBubble({ name: s, stance: 'support', text: '陛下亲为改批·圣裁高于原奏·臣等敬服。' });
      await delay(380);
    }
    addBubble({ kind: 'system', text: '（原奏被替换为陛下口述方案·进诏令追踪标"亲改"·皇威 +1）' });
    return;
  }
  // ─── 追问 ───
  if (action === 'probe') {
    const probeText = item.detail.split('。')[1] || '其情甚明 · 不敢隐瞒。';
    addBubble({ name: presenter, text: '臣详陈：' + probeText.slice(0, 80) + '。陛下若再有疑·臣无所避。' });
    await delay(380);
    return;
  }
  // ─── 传召 ───
  if (action === 'summon') {
    const tgt = extra || '某员';
    const pool = _cc3_buildSummonablePool();
    // entry 即使在闭合后再次召也要 pool 实时构建
    let entry = pool.find(p => p.name === tgt);
    if (!entry) {
      // 兼容兜底：人不在池里·按"正常缺朝"处理
      entry = { name: tgt, category: 'court_absent', risk: 0, reasonLabel: '远离京师' };
    }

    // 取 GM.chars 详情·建/补 CHARS 条目
    let gmCh = null;
    try { if (typeof findCharByName === 'function') gmCh = findCharByName(tgt); } catch (_) {}
    if (!CHARS[tgt]) {
      const tt = (gmCh && (gmCh.officialTitle || gmCh.title)) || entry.reasonLabel || '在野';
      let cls = 'east';
      if (/将军|总兵|都督|提督|参将|副将/.test(tt)) cls = 'wu';
      else if (/御史|给事中|都察|科道/.test(tt)) cls = 'kdao';
      CHARS[tgt] = {
        title: tt,
        rank: 9,
        faction: (gmCh && gmCh.faction) || '中立',
        party: (gmCh && gmCh.party) || '',
        loyalty:   (gmCh && typeof gmCh.loyalty   === 'number') ? gmCh.loyalty   : 50,
        integrity: (gmCh && typeof gmCh.integrity === 'number') ? gmCh.integrity : 50,
        ambition:  (gmCh && typeof gmCh.ambition  === 'number') ? gmCh.ambition  : 50,
        stanceText: (gmCh && gmCh.stance) || '',
        class: cls,
        initial: tgt.charAt(0),
        absent: null,
        _summoned: true,
        _summonCategory: entry.category
      };
    } else {
      CHARS[tgt].absent = null;
      CHARS[tgt]._summoned = true;
      CHARS[tgt]._summonCategory = entry.category;
    }

    // 移出 absents·加入 attendees
    state.absents = (state.absents || []).filter(a => a.name !== tgt);
    if (state.attendees.indexOf(tgt) < 0) state.attendees.push(tgt);

    // 入殿气泡（按类别不同·烘托违制氛围）
    const arrivalLines = {
      court_absent: '（中使奉旨疾驰·' + tgt + ' 闻召即至·趋入殿前。）',
      inner_palace: '（' + tgt + ' 奉旨入殿·步履徐行·宫娥扶持。殿中诸臣交目相视·颇有不安。）',
      student:      '（' + tgt + ' 草民袍服·奉召入殿·叩首阶下·惶恐战栗。）',
      clan:         '（' + tgt + ' 王驾入朝·百官按宗籍序而拜·然殿中沉肃异常。）',
      commoner:     '（' + tgt + ' 草野之身奉召·惊惶趋入·叩首良久不敢起。）'
    };
    addBubble({ kind: 'system', sysKind: entry.risk > 0 ? 'warn' : '', text: arrivalLines[entry.category] || '（' + tgt + ' 已至。）' });
    await delay(450);

    // 召见者本人开口·走 AI 流式（带其完整档案+议题语境）
    const summonedNpc = { name: tgt, stance: 'neutral', line: '' };
    try { await _cc3_streamReactBubble(summonedNpc, item || {}, 'self'); } catch (_) {}
    await delay(280);

    // 风险 > 0 → 言官当朝抗辩 + 插入新议程
    if (entry.risk > 0) {
      // 找一名在场言官（科道）出列
      let accuser = null;
      const speakers = Object.keys(CHARS).filter(n => CHARS[n] && !CHARS[n].absent && CHARS[n].class === 'kdao' && n !== tgt);
      if (speakers.length > 0) {
        accuser = speakers[Math.floor(Math.random() * speakers.length)];
      }
      // 退而求次·任何在场清流文官
      if (!accuser) {
        const fallback = Object.keys(CHARS).filter(n => {
          const c = CHARS[n];
          return c && !c.absent && n !== tgt && (c.faction === '明朝廷' || /东林|清流/.test(c.party || ''));
        });
        if (fallback.length > 0) accuser = fallback[0];
      }
      if (accuser) {
        const detailMap = {
          inner_palace: '陛下召 ' + tgt + ' 入朝·后宫干政·祖制所禁。妇人不预外朝·此典甚严。臣冒死请陛下察焉·命其速归内廷。',
          clan:         '陛下召 ' + tgt + ' 与议·宗室预政·古者所慎。汉七国之乱、唐玄武之变·皆此覆辙。臣请陛下慎之。',
          student:      '陛下召 ' + tgt + ' 入朝·学子未仕而预朝议·名分既乖·贻人口实。乞陛下令其退归学舍。',
          commoner:     '陛下召 ' + tgt + ' 草野之人入朝·名器轻许·礼度倒置。臣请陛下慎之。',
          court_absent: '陛下今召 ' + tgt + ' 入朝·此员本应回避·而骤召至·恐有偏听之嫌。'
        };
        const protestItem = {
          presenter: accuser,
          dept: '都察院',
          type: 'confrontation',
          urgency: 'normal',
          title: '陛下召 ' + tgt + ' 议',
          announceLine: '臣 ' + accuser + ' 不敢避罪·谨陈一议。',
          detail: detailMap[entry.category] || ('陛下召 ' + tgt + ' 入朝·恐有未当·伏乞圣察。'),
          target: null,
          relatedPeople: [tgt],
          controversial: 7 + entry.risk,
          importance: 6,
          _summonProtest: true
        };
        // 插在当前议程之后·下一拍 runNextItem 自然会处理
        AGENDA.splice(state.currentIdx + 1, 0, protestItem);
        addBubble({ kind: 'system', sysKind: 'warn', text: '（' + accuser + ' 出列举笏 · 当庭抗议陛下召 ' + tgt + '。此事将列下一议。）' });
        if (typeof updateProgress === 'function') updateProgress();
        await delay(420);
      }
    }
    return;
  }
  // ─── 训诫（5 种 outcome·v2 借鉴）───
  if (action === 'admonish') {
    const tgt = extra || item.target || presenter;
    const tgtCh = CHARS[tgt] || {};
    // 厉声开场
    addBubble({ kind: 'system', sysKind: 'warn', text: '（陛下厉声）' + tgt + '，你好大胆！' });
    await delay(450);
    // 5 种结局按权重随机·loyalty + 性格简化判定
    const dice = Math.random();
    const main = $('cy-stage-main');
    const outDiv = document.createElement('div');
    outDiv.className = 'reprimand-outcome';
    let line = '';
    let outClass = '';
    if (dice < 0.25) {
      outClass = 'public_submit';
      line = '【当庭叩首】「臣 ' + tgt + ' 万死罪 · 谨遵陛下训示 · 此后必竭忠诚 · 不敢再有违失。」';
      addBubble({ name: tgt, stance: 'support', text: '臣······万死！万死！臣即遵旨改过。' });
    } else if (dice < 0.50) {
      outClass = 'secret_resent';
      line = '【面服心怨】' + tgt + ' 唯唯而退·然眼神微沉·暗中怀恨。loyalty -8 · 记仇 +5。';
      addBubble({ name: tgt, stance: 'oppose', text: '臣······谨遵旨。（俯首良久·目光低垂。）' });
    } else if (dice < 0.70) {
      outClass = 'resign_request';
      line = '【伏阙请辞】' + tgt + ' 当庭请辞 · 乞骸骨。已记入待批告退册。';
      addBubble({ name: tgt, stance: 'oppose', text: '臣无能 · 致陛下震怒 · 臣愿乞骸骨归乡 · 不敢复居要津！（伏地不起）' });
      addBubble({ kind: 'system', text: '（' + tgt + ' 伏阙请辞 · 待陛下后批。）' });
    } else if (dice < 0.88) {
      outClass = 'secret_plot';
      line = '【表面请罪 · 暗结同党】' + tgt + ' 似服而不服 · 暗中已起密谋之意。loyalty -12 · 派系反弹 +3。';
      addBubble({ name: tgt, stance: 'oppose', text: '臣······有罪 · 谨听陛下训示。（退入班列时与某员目光相接。）' });
    } else {
      outClass = 'public_refute';
      line = '【当庭抗辩】' + tgt + ' 不服 · 当庭据理抗辩。皇威 -3 · 局面尴尬。';
      addBubble({ name: tgt, stance: 'oppose', text: '陛下！臣 ' + tgt + ' 不敢苟同！臣自任职以来 · 未尝有违职守 · 陛下今日训臣 · 实有未察！请陛下听臣分辩！' });
    }
    outDiv.className = 'reprimand-outcome ' + outClass;
    outDiv.innerHTML = line;
    main.appendChild(outDiv);
    main.scrollTop = main.scrollHeight;
    await delay(380);
    return;
  }
  // ─── 嘉奖 ───
  if (action === 'praise') {
    const tgt = extra || presenter;
    addBubble({ name: tgt, text: '臣 ' + tgt + ' 谢陛下隆恩！必竭忠诚·不负圣望。' });
    await delay(380);
    // 殿中羡慕
    addBubble({ kind: 'system', text: '（殿中有臣低语："陛下亲赏 ' + tgt + ' · 殊荣也。"）' });
    addBubble({ kind: 'system', text: '（' + tgt + ' loyalty +3 · 名望 +1）' });
    return;
  }
  // ─── 当庭口述诏令 ───
  if (action === 'decree') {
    await runDecreeFlow(extra);
    return;
  }
}

async function runDecreeFlow(extra) {
  const tier = (extra && extra.tier) || 'B';
  const t = computeDecreeTier();
  await delay(300);
  if (tier === 'S') {
    addBubble({ kind: 'system', text: '（殿中山呼）陛下圣明！' });
    addBubble({ kind: 'system', text: '（诏令全效·进诏令追踪·标"亲诏"。皇威 +1 名望 +1。）' });
  } else if (tier === 'A') {
    addBubble({ kind: 'system', text: '（百官面色凝重 · 默然奉旨。）' });
    addBubble({ kind: 'system', text: '（诏令全效。在场反对派 loyalty -1。）' });
  } else if (tier === 'B') {
    addBubble({ kind: 'system', text: '（百官有低声议论 · 终是奉旨。）' });
    addBubble({ kind: 'system', text: '（诏令奉行·派系记仇。loyalty 略降。）' });
  } else if (tier === 'C') {
    _cc3_officialBubble('oppose', '陛下！此事关乎民心 · 臣等以为可议而行 · 不宜独断！', '');
    addBubble({ kind: 'system', text: '（诏令全效但民心 -2 · 暴名 +1 · 该回合后续奏报激进度↑）' });
  } else if (tier === 'D') {
    if (t.code === 'D' && t.name === '危诏激变') {
      _cc3_officialBubble('oppose', '陛下不可！臣愿以死谏！（伏地不起）', '');
      addBubble({ kind: 'system', text: '（殿中数员跪谏 · 诏令 blocked · 皇威 -3 · 权威 -2 · 派系叛意 +。）' });
    } else {
      _cc3_officialBubble('oppose', '陛下 · 此诏诚有未当 · 臣谨封驳。', '');
      addBubble({ kind: 'system', text: '（诏令打 50% 折 · 进诏令追踪标"半行" · AI 推演时部门怠工。皇权 -1。）' });
    }
  }
}

// ═══════════════════════════════════════════════
// 注：preview 测试页遗留的顶部按钮绑定（cy-player-input / mode-changchao /
//     prestige-slider / power-slider / court-mode-tag / restart-btn）已物理删除·
//     这些元素在游戏内 modal 不存在·原绑定在脚本加载时就会因 null.onkeydown 抛错·
//     v3 modal 内的实际事件绑定全部移到 _cc3_createModal 里（L3300+）。
//     refreshCourtModeTag 函数也移除·肃朝/众言判定改由 isStrictCourt() 直读。
// ═══════════════════════════════════════════════

// ───────────────────────────────────────────
// §C · 入口注册（暂不路由·调试用 console 入口）
// ───────────────────────────────────────────

/** v3 朝议入口·暂供 console 测试·后续接 _cy_pickMode */
async function _cc3_open(opts) {
  opts = opts || {};
  var explicitPostTurn = null;
  if (Object.prototype.hasOwnProperty.call(opts, 'isPostTurn')) explicitPostTurn = !!opts.isPostTurn;
  else if (Object.prototype.hasOwnProperty.call(opts, 'postTurn')) explicitPostTurn = !!opts.postTurn;
  var isPostTurnOpen = explicitPostTurn !== null
    ? explicitPostTurn
    : (typeof GM !== 'undefined' && !!GM._isPostTurnCourt);
  // 频次计数（与 v2 兼容·in-turn court 受 2/turn 限·post-turn 不受）
  if (typeof GM !== 'undefined') {
    if (!GM._chaoyiCount) GM._chaoyiCount = {};
    if (!GM._chaoyiCount[GM.turn]) GM._chaoyiCount[GM.turn] = 0;
    if (!isPostTurnOpen && GM._chaoyiCount[GM.turn] >= 2) {
      if (typeof toast === 'function') toast('今日已朝议 ' + GM._chaoyiCount[GM.turn] + ' 次·改日再议');
      return;
    }
    GM._chaoyiCount[GM.turn]++;
  }

  // 关 v2 旧 modal（如有）
  const oldModal = document.getElementById('chaoyi-modal');
  if (oldModal) oldModal.remove();

  // ★ 立即捕获是否朔朝·避免 await 期间 GM._isPostTurnCourt 被外部 reset 导致标题/system prompt 错位
  state._isPostTurn = !!isPostTurnOpen;
  state._openSource = opts.source || (state._isPostTurn ? 'post-turn' : 'in-turn');
  state.mode = state._isPostTurn ? 'shuochao' : 'changchao';
  console.log('[cc3] _cc3_open·进入·朔朝=' + state._isPostTurn + '·mode=' + state.mode);

  // 创建 v3 modal
  _cc3_createModal();
  // 立即刷新一次标题·把硬编码"早朝"改为正确名（即使 await 期间也不会闪回）
  if (typeof refreshTitle === 'function') refreshTitle();

  // 用 GM 数据覆盖 mock CHARS / AGENDA / state.prestige/power
  _cc3_overrideMockWithGM();

  // 异步加载议程（AI 生成）
  try {
    console.log('[cc3] _cc3_open·开始 buildAgenda');
    const items = await _cc3_buildAgendaFromGM();
    AGENDA.length = 0;
    items.forEach(it => AGENDA.push(it));
    console.log('[cc3] _cc3_open·议程已载入·共 ' + AGENDA.length + ' 条', AGENDA);
  } catch (e) {
    console.error('[cc3] _cc3_open·buildAgenda 抛错', e);
    try { window.TM && TM.errors && TM.errors.captureSilent(e, 'tm-chaoyi-v3:open'); } catch (_) {}
    // 即使 buildAgenda 失败·也要给个最小议程让流程能跑
    AGENDA.length = 0;
    AGENDA.push({
      presenter: '内侍', dept: '内廷', type: 'routine', urgency: 'normal',
      title: '日常无事', announceLine: '今日并无紧要奏报。',
      detail: '百官今日并无紧要事务奏闻陛下。', controversial: 0, importance: 1, _fallback: true
    });
  }

  // 重置 state·跑 runOpening
  state.currentIdx = 0;
  state.decisions = [];
  state.phase = 'opening';
  state.done = false;
  state.attendees = [];
  state.absents = [];
  // 朝议类型·根据 GM._isPostTurnCourt 决定标题/时间是早朝还是朔朝（流程完全一致）
  state.mode = state._isPostTurn ? 'shuochao' : 'changchao';

  // 班次区从真实 CHARS 重建
  if (typeof renderBench === 'function') renderBench();
  if (typeof refreshTitle === 'function') refreshTitle();

  if (typeof runOpening === 'function') {
    runOpening();
  }
}

/** 用 GM 数据覆盖 preview mock 数据 */
function _cc3_overrideMockWithGM() {
  // 覆盖 CHARS（清空再填）
  const gmDict = _cc3_buildCharsFromGM();
  Object.keys(CHARS).forEach(k => delete CHARS[k]);
  Object.assign(CHARS, gmDict);

  // 覆盖皇威/皇权
  state.prestige = _cc3_getPrestige();
  state.power = _cc3_getPower();
  // 诊断：把当前肃朝判定打到 console·让用户能直接验证
  try {
    const info = _cc3_getStrictCourtInfo();
    console.log('[cc3·朝威] 皇威=' + info.prestige + ' 皇权=' + info.power +
                ' 阈值=' + info.thPrestige + '/' + info.thPower +
                ' → ' + (info.isStrict ? '【肃朝】' : '【众言】') +
                (info.note ? ' (' + info.note + ')' : ''));
  } catch (_) {}
}

/** 创建 v3 modal HTML（preview body 结构移植） */
function _cc3_createModal() {
  // 加载 CSS（一次性）
  if (!document.getElementById('cc3-css')) {
    const link = document.createElement('link');
    const cssHref = 'tm-chaoyi-changchao.css';
    link.id = 'cc3-css';
    link.rel = 'stylesheet';
    link.href = cssHref;
    link.setAttribute('data-css-base', cssHref);
    link.setAttribute('data-css-fallback', 'https://cdn.jsdelivr.net/gh/misfit-user/tianming@main/tm-chaoyi-changchao.css');
    link.onload = function() {
      if (typeof window !== 'undefined' && window.TM_CSS_LOADED) window.TM_CSS_LOADED(link);
    };
    link.onerror = function() {
      if (typeof window !== 'undefined' && window.TM_CSS_RETRY) window.TM_CSS_RETRY(link);
    };
    document.head.appendChild(link);
  }

  // 创建 modal·preview 的 cy-stage 结构
  const stage = document.createElement('div');
  stage.className = 'cy-stage';
  stage.id = 'cy-stage';
  stage.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:5000;';
  // #1 移动端(安卓 Capacitor)常朝整体偏小修复:fit.js 把桌面舞台等比缩到手机,而常朝又被 CSS
  //   max-width:1080px 卡在舞台 ~56% → 手机上一小块、四周大片空。移动端解除上限、铺满舞台(桌面不动)。
  //   ⚠️ 值待真机微调:仍小可再调大、溢出可调小;fit.js 的 anchorEl 会把这里的内联 vw/vh→px。
  try {
    if (window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()) {
      stage.style.maxWidth = 'none';
      stage.style.width = '96vw';
      stage.style.height = '95vh';
    }
  } catch (_cyFit) {}
  stage.innerHTML = `
    <div class="cy-ceremony" id="cy-ceremony">
      <h1 id="cy-ceremony-title">〔 早 朝 〕</h1>
      <div class="sub">奉天门 · 五更三点</div>
      <div class="bell">铮 ── 铮 ── 铮 ──</div>
    </div>
    <div class="cy-titlebar">
      <div class="ttl" id="cy-title">〔 早 朝 〕</div>
      <div class="meta">
        <span class="tag" id="cy-progress-tag">已议 0</span>
        <span class="tag" id="cy-attend-tag">殿中 ?</span>
        <button id="cy-interrupt-btn">⏸ 打断</button>
        <button id="cy-exit-btn">✕ 退朝</button>
      </div>
    </div>
    <div class="cy-bench" id="cy-bench">
      <div class="cy-bench-header" id="cy-bench-header">
        <span id="cy-bench-status">朝堂全景</span>
        <span class="arrow">▼</span>
      </div>
      <div class="cy-bench-body">
        <div class="cy-bench-col cy-bench-col-east">
          <div class="cy-bench-col-title">文 东 班</div>
          <div class="cy-bench-officials" id="bench-east"></div>
        </div>
        <div class="cy-bench-col-throne">御 座</div>
        <div class="cy-bench-col cy-bench-col-west">
          <div class="cy-bench-col-title">武 西 班</div>
          <div class="cy-bench-officials" id="bench-west"></div>
        </div>
        <div class="kdao-row">
          <div class="cy-bench-col-title">科 道 言 官</div>
          <div class="cy-bench-officials" id="bench-kdao"></div>
        </div>
      </div>
    </div>
    <div class="cy-phase-tag" id="cy-phase-tag">
      <span id="cy-phase-label">【鸣 鞭】</span>
      <span class="progress" id="cy-phase-hint">百官入班候旨</span>
    </div>
    <div class="cy-stage-main" id="cy-stage-main"></div>
    <div class="cy-action-bar" id="cy-action-bar"></div>
    <div class="cy-input-row">
      <input type="text" class="cy-input" id="cy-player-input" placeholder="陛下欲言…… 直接打字按 Enter 即可" />
      <button class="cy-btn muted" id="cy-jinkou-btn">▼ 金口</button>
      <button class="cy-btn danger" id="cy-interrupt-input">⏸ 噤声</button>
    </div>
  `;
  document.body.appendChild(stage);

  // 2026-06 faithful landing·常朝并排版式（左殿堂班次 + 右议程/流程/裁决·对齐预览·保留全部元素/id/handler）
  try {
    var _ccBench = document.getElementById('cy-bench');
    var _ccPhase = document.getElementById('cy-phase-tag');
    var _ccMain = document.getElementById('cy-stage-main');
    var _ccAct = document.getElementById('cy-action-bar');
    var _ccInput = stage.querySelector('.cy-input-row');
    var _ccTitle = stage.querySelector('.cy-titlebar');
    if (_ccBench && _ccMain && _ccTitle && !document.getElementById('cc-body-row')) {
      var _row = document.createElement('div'); _row.id = 'cc-body-row'; _row.className = 'cc-body-row';
      var _hall = document.createElement('div'); _hall.className = 'cc-hall';
      var _rail = document.createElement('div'); _rail.className = 'cc-rail';
      _hall.appendChild(_ccBench);
      // 出班者立绘焦点·移入中央御座（御道·对齐预览）
      var _pres = document.createElement('div'); _pres.id = 'cc-presenter'; _pres.className = 'cc-presenter';
      _pres.innerHTML = '<div class="cc-pres-wait">待奏</div>';
      var _throne = _ccBench.querySelector('.cy-bench-col-throne');
      if (_throne) { _throne.classList.add('has-pres'); _throne.appendChild(_pres); } else { _hall.appendChild(_pres); }
      [_ccPhase, _ccMain, _ccAct, _ccInput].forEach(function(el) { if (el) _rail.appendChild(el); });
      _row.appendChild(_hall); _row.appendChild(_rail);
      _ccTitle.parentNode.insertBefore(_row, _ccTitle.nextSibling);
      _ccBench.classList.add('expanded', 'cc-hall-bench');
      // 皇威/皇权 入顶栏（对齐预览）
      try {
        var _meta = _ccTitle.querySelector('.meta');
        if (_meta && !document.getElementById('cc-authority')) {
          var _prV = (typeof state !== 'undefined' && typeof state.prestige === 'number') ? Math.round(state.prestige) : 55;
          var _pwV = (typeof state !== 'undefined' && typeof state.power === 'number') ? Math.round(state.power) : 60;
          var _au = document.createElement('span'); _au.id = 'cc-authority'; _au.className = 'cc-authority';
          _au.innerHTML = '<span class="cca-item">皇威 <b>' + _prV + '</b><i class="cca-bar"><em style="width:' + _prV + '%"></em></i></span><span class="cca-item">皇权 <b>' + _pwV + '</b><i class="cca-bar"><em style="width:' + _pwV + '%"></em></i></span>';
          _meta.insertBefore(_au, _meta.firstChild);
        }
      } catch(_) {}
    }
  } catch(_ccLayoutErr) { try { window.TM && TM.errors && TM.errors.captureSilent(_ccLayoutErr, 'changchao-sidebyside'); } catch(_) {} }

  // 绑定输入和按钮
  const inp = document.getElementById('cy-player-input');
  if (inp) {
    inp.onkeydown = function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const v = (this.value || '').trim();
        if (!v) return;
        this.value = '';
        if (typeof onPlayerSpeak === 'function') onPlayerSpeak(v);
      }
    };
  }
  const exitBtn = document.getElementById('cy-exit-btn');
  if (exitBtn) exitBtn.onclick = _cc3_close;
  const intBtn = document.getElementById('cy-interrupt-btn');
  if (intBtn) intBtn.onclick = function() {
    if (typeof addBubble === 'function') addBubble({ kind: 'system', text: '（陛下拊案 · 群臣噤声。）' });
  };
  const intInp = document.getElementById('cy-interrupt-input');
  if (intInp) intInp.onclick = function() {
    if (typeof addBubble === 'function') addBubble({ kind: 'system', text: '（陛下拊案 · 群臣噤声。）' });
  };
  const jkBtn = document.getElementById('cy-jinkou-btn');
  if (jkBtn) jkBtn.onclick = function() {
    if (typeof showJinkouPopover === 'function') showJinkouPopover();
  };
  const benchHdr = document.getElementById('cy-bench-header');
  if (benchHdr) benchHdr.onclick = function() {
    state.benchExpanded = !state.benchExpanded;
    document.getElementById('cy-bench').classList.toggle('expanded', state.benchExpanded);
  };
  // 2026-06·常朝班次默认展开（百官真脸全景为主·非折叠薄条·可点表头收起）
  if (typeof state !== 'undefined' && !state._benchAutoExpanded) {
    state._benchAutoExpanded = true;
    state.benchExpanded = true;
    var _cbEl = document.getElementById('cy-bench');
    if (_cbEl) _cbEl.classList.add('expanded');
  }
}

/** 关闭 v3 modal */
function _cc3_close() {
  // 退朝按钮直接关闭时·若是朔朝(post-turn)且 runClosing 未跑过钩子·此处补触发
  // 保证后续 _onPostTurnCourtEnd 能展示推演 loading / 弹史记
  var _wasPostTurn = false;
  try {
    _wasPostTurn = !!(typeof state !== 'undefined' && state._isPostTurn);
  } catch(_) {}
  var _alreadyDone = (typeof state !== 'undefined' && state.done);

  const m = document.getElementById('cy-stage');
  if (m) m.remove();
  // 清理 popovers
  document.querySelectorAll('.cy-popover, .cy-summary-mask, .cy-input-modal').forEach(p => p.remove());
  if (typeof CY !== 'undefined') {
    CY.open = false;
    if (CY.abortCtrl) try { CY.abortCtrl.abort(); } catch(_){}
  }

  // 朔朝退朝兜底·若 runClosing 还没跑过(state.done!=true)·补触发后朝结束钩子
  if (_wasPostTurn && !_alreadyDone && typeof _onPostTurnCourtEnd === 'function') {
    try { _onPostTurnCourtEnd(); } catch(_e) {
      if (window.TM && TM.errors && TM.errors.capture) TM.errors.capture(_e, 'cc3_close] postTurnEnd:');
    }
  }
}

try { window._cc3_open = _cc3_open; } catch (_) {}
try { window._cc3_close = _cc3_close; } catch (_) {}

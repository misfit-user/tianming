// @ts-check
// ═══ 巨石拆分(20260706·第十八拆)：渲染族(transcript/diff/结果)迁出 editor-authoring-agent-ui.js ═══
// 装载序契约(见 lint-split-contracts)：render 在 origin【之后】装载(icons→origin→render)。
//   render 是纯消费+发布者：静态别名读 origin(ui/esc/_md/_mdLine/_streamThenLink/rememberConvention/_logScrollMaybe)
//   + icons(_icon/_TOOL_ICON)·发布 render* 供 origin 反向 shim。ui 对象经 __aaUiParts.ui 共享(origin 先建·此处读同一引用·突变全域一致)。
// 2026-10-15 国师重做：
//   · 思考与查阅：工具行写成中文（谁、哪一项、哪个字段），点开看整理过的输入与结果。
//   · 改动折子：按集合→实体归拢；新增给关键字段、修改给「字段：旧 → 新」；每个实体（及其每个字段）可单独不要。
//   · 校验只报这次带来的新问题；剧本原有的提示折成一行。
(function(global) {
  'use strict';
  if (typeof document === 'undefined') return;
  var TM = global.TM = global.TM || {};
  var __aaU = TM.__aaUiParts = TM.__aaUiParts || {};   // dep-graph 可识别的 provide 形(TM.X=)
  var ui = __aaU.ui;   // origin(先装载)已建·共享同一引用
  var esc = __aaU.esc, _md = __aaU._md, _mdLine = __aaU._mdLine, _streamThenLink = __aaU._streamThenLink,
      rememberConvention = __aaU.rememberConvention, _logScrollMaybe = __aaU._logScrollMaybe,
      _icon = __aaU._icon, _TOOL_ICON = __aaU._TOOL_ICON;
  function AA() { return global.TM && global.TM.AuthoringAgent; }

  // ── 名字：集合、字段、实体 ──
  var _COLL_CN = { characters: '人物', factions: '势力', parties: '党派', classes: '阶层', items: '物品', events: '事件', rigidHistoryEvents: '史实事件', timeline: '编年', families: '家族', cities: '城市', traitDefinitions: '特质', adminHierarchy: '行政区划', military: '军务', variables: '变量', relations: '关系', factionRelations: '势力关系', openingLetters: '开场信', government: '官制', officeTree: '官职树', officeConfig: '官制成本', goals: '目标', playerInfo: '玩家设定', gameSettings: '开局设置', worldSettings: '世界设定', map: '舆图', mapData: '舆图数据', palaceSystem: '宫殿', keju: '科举', fiscalConfig: '财政设定', eraNames: '年号表', name: '剧本名', overview: '概述', background: '背景', opening: '开场', dynasty: '朝代', emperor: '君主', startYear: '起始年', worldKind: '世界类型', tags: '标签', refFiles: '参考文件', histAnchors: '史实锚点', culturalWorks: '文化作品', renliPilot: '人力试点', offices: '官职', regions: '地块', provinces: '省份', armies: '军队', troops: '部队', laws: '律令', policies: '国策', techs: '科技', customs: '风俗', religions: '宗教', languages: '语言', titles: '爵位', buildings: '建筑', resources: '资源', trades: '商路', disasters: '灾异', omens: '祥瑞', edicts: '诏令', letters: '书信', quests: '任务', achievements: '成就', endings: '结局', era: '时代', eraNames: '年号表', calendar: '历法', playerFaction: '玩家势力', playerCharacter: '玩家角色' };
  var _FIELD_CN = { name: '名字', title: '头衔', officialTitle: '官职', role: '身份', faction: '所属势力', age: '年龄', gender: '性别', zi: '表字', birthYear: '生年', deathYear: '卒年', birthplace: '籍贯', location: '所在', alive: '在世', desc: '简介', description: '描述', bio: '小传', personality: '性格', aiPersona: 'AI 人格', aiPersonaText: 'AI 人格', loyalty: '忠诚', ambition: '野心', intelligence: '智谋', valor: '武勇', military: '军事', administration: '政务', management: '管理', charisma: '魅力', diplomacy: '外交', benevolence: '仁德', integrity: '廉节', family: '家族', party: '党派', leader: '领袖', capital: '治所', strength: '实力', militaryStrength: '军力', economy: '经济', ideology: '理念', traits: '特质', color: '色标', type: '类型', trigger: '触发', effect: '效果', year: '年', month: '月', day: '日', importance: '重要度', portrait: '立绘', goal: '目标', goals: '目标', members: '成员', from: '一方', to: '另一方', relation: '关系', value: '数值', min: '下限', max: '上限', holder: '在任', rank: '品级', duties: '职掌', children: '下属', population: '人口', owner: '归属', governor: '主官', office: '官职', officeId: '官职编号', post: '职位', rankName: '品阶', courtesy: '表字', hao: '号', birth: '生年', death: '卒年', status: '状态', tags: '标签', notes: '备注', note: '备注', summary: '概述', text: '正文', content: '内容', date: '日期', place: '地点', region: '地区', capitalCity: '都城', ruler: '君主', heir: '继承人', army: '军队', troops: '兵力', soldiers: '兵员', commander: '统帅' };
  function _fieldLabel(key) {
    var k = String(key == null ? '' : key);
    if (/^\d+$/.test(k)) return '第 ' + (+k + 1) + ' 项';
    try { var app = global.TM_SCENARIO_EDITOR_RESET_APP; if (app && typeof app.fieldLabel === 'function') { var l = app.fieldLabel(k); if (l && l !== k) return l; } } catch (e) {}
    return _FIELD_CN[k] || _COLL_CN[k] || k;
  }
  function _segs(path) { return String(path || '').split(/[.\[\]]+/).filter(function(s) { return s !== ''; }); }
  function _scen() { return ui.draft || (ui.adapter && ui.adapter.getScenario ? ui.adapter.getScenario() : null) || {}; }
  function _entName(o) {
    if (!o || typeof o !== 'object') return '';
    var n = o.name || o.title || o.label || o.displayName || o.id;
    return n == null ? '' : String(n);
  }
  function _shortVal(v, max) {
    max = max || 48;
    if (v == null || v === '') return '空';
    if (typeof v === 'boolean') return v ? '是' : '否';
    if (Array.isArray(v)) {
      if (!v.length) return '空';
      var simple = v.every(function(x) { return x == null || typeof x !== 'object'; });
      var s = simple ? v.join('、') : (v.map(_entName).filter(Boolean).join('、') || (v.length + ' 项'));
      return s.length > max ? s.slice(0, max) + '…（共 ' + v.length + ' 项）' : s;
    }
    if (typeof v === 'object') { var nm = _entName(v); return nm ? nm : ('{' + Object.keys(v).slice(0, 4).map(_fieldLabel).join('、') + (Object.keys(v).length > 4 ? '…' : '') + '}'); }
    var t = String(v).replace(/\s+/g, ' ');
    return t.length > max ? t.slice(0, max) + '…' : t;
  }
  // 路径 → 「人物「顾完成」› 头衔」
  function _friendlyPath(p) {
    var ss = _segs(p); if (!ss.length) return '剧本';
    var sc = _scen(), top = ss[0], out = _COLL_CN[top] || _fieldLabel(top);
    var coll = sc && sc[top];
    var i = 1;
    if (Array.isArray(coll) && /^\d+$/.test(ss[1] || '')) {
      var ent = coll[+ss[1]], nm = _entName(ent);
      out += nm ? '「' + nm + '」' : ' 第 ' + (+ss[1] + 1) + ' 项';
      i = 2;
    }
    var rest = ss.slice(i).map(_fieldLabel);
    return out + (rest.length ? ' › ' + rest.join(' › ') : '');
  }
  var _TOOL_CN = { getField: '查看', getFields: '查看', searchEntities: '搜索', globalSearch: '全文检索', findReferences: '查引用', listCollection: '浏览', describeSchema: '查字段形状', listGaps: '查缺口', fieldContract: '查运行契约', genReference: '查生成范式', readSource: '读源码', listSource: '列源码', grepSource: '搜源码', readAttachment: '读附件', searchAttachment: '搜附件', readAttachmentJson: '读附件字段', mapOverview: '看舆图概况', statsAggregate: '统计', readQuickTestReport: '读快测报告', validateDraft: '校验', preflight: '运行时体检', checkHistory: '核对史实', webFetch: '读网页', applyEdit: '修改', applyPush: '新增', removeEntity: '删除', renameEntity: '改名', multiEdit: '批量修改', bulkAdd: '批量新增', bulkUpdate: '按条件批改', applyAttachmentField: '从附件取字段', copyField: '复制字段', mapAssignOwner: '改归属', renameRegion: '改地名', generateImage: '生成图像', note: '记一笔', todoWrite: '任务清单', askClarification: '请教你', remonstrate: '进谏', flagUncertain: '标记待核', recordConvention: '记下约定', saveMemory: '记下记忆', useSkill: '展开技能', saveSkill: '存技能', requestTools: '申请工具', finish: '收尾', steer: '你插了一句', macroCompact: '压缩前情' };
  function _webSite(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return String(u || '').slice(0, 40); } }
  function _friendlyStep(step) {
    var n = step.name, i = step.input || {}, r = step.result || {};
    function coll(c) { return _COLL_CN[c] || _fieldLabel(c || ''); }
    switch (n) {
      case 'applyEdit': return '修改 ' + _friendlyPath(i.path) + ' ＝ ' + _shortVal(i.value, 36);
      case 'getFields': return '查看 ' + ((i.paths || []).slice(0, 3).map(_friendlyPath).join('、') || '多处') + ((i.paths || []).length > 3 ? ' 等 ' + i.paths.length + ' 处' : '');
      case 'getField': return '查看 ' + _friendlyPath(i.path);
      case 'applyPush': return '新增 ' + coll(i.path) + '「' + (_entName(i.value) || _shortVal(i.value, 24)) + '」';
      case 'removeEntity': return '删除 ' + _friendlyPath(i.path);
      case 'searchEntities': return '在' + coll(i.collection) + '里搜' + (i.query ? '「' + i.query + '」' : '') + (r.total != null ? '（' + r.total + ' 条）' : (r.count != null ? '（' + r.count + ' 条）' : ''));
      case 'globalSearch': return '全文检索「' + (i.query || '') + '」' + (r.total != null ? '（' + r.total + ' 处）' : '');
      case 'findReferences': return '查「' + (i.name || '') + '」被谁引用' + (r.exactCount != null ? '（' + r.exactCount + ' 处，提及 ' + (r.mentionCount || 0) + '）' : '');
      case 'renameEntity': return '改名「' + (i.oldName || '') + '」→「' + (i.newName || '') + '」' + (r.changed != null ? '（连带 ' + r.changed + ' 处）' : '');
      case 'listCollection': return '浏览' + coll(i.collection) + (r.count != null ? '（共 ' + r.count + '）' : '');
      case 'describeSchema': return '查字段形状 ' + (i.kind ? coll(i.kind) : '');
      case 'fieldContract': return '查「' + coll(i.field) + '」在游戏里怎么用';
      case 'listSource': return '列源码清单' + (i.filter ? '「' + i.filter + '」' : '') + (r.matched != null ? '（' + r.matched + '）' : '');
      case 'grepSource': return '搜源码「' + (i.query || '') + '」' + (r.hits ? '（' + r.hits.length + ' 处）' : '');
      case 'readSource': return '读源码 ' + (i.path || '');
      case 'genReference': return '查生成范式' + (i.part ? ' · ' + i.part : '');
      case 'listGaps': return '查缺口' + (r.requiredMissing ? '：必需字段缺 ' + r.requiredMissing.length + ' 处' : '');
      case 'validateDraft': return '校验' + (r.ok === false ? '：' + ((r.violations || []).length) + ' 处问题' : (r.ok === true ? '：通过' : ''));
      case 'preflight': return '运行时体检' + (r.bootable === false ? '：' + ((r.blockers || []).length) + ' 处会挡住开局' : (r.bootable === true ? '：可运行' : ''));
      case 'bulkAdd': return '批量新增 ' + (r.added != null ? r.added + ' 个' : '') + coll(i.collection);
      case 'bulkUpdate': return '按条件批改' + coll(i.collection) + (r.updated != null ? ' ' + r.updated + ' 条' : (r.matched != null ? ' ' + r.matched + ' 条' : ''));
      case 'multiEdit': return '一次改 ' + (r.applied != null ? r.applied : (i.edits || []).length) + ' 处';
      case 'copyField': return '复制 ' + _friendlyPath(i.from) + ' → ' + _friendlyPath(i.to);
      case 'statsAggregate': return '统计' + coll(i.collection) + (i.groupBy ? '（按' + _fieldLabel(i.groupBy) + '分组）' : '');
      case 'mapOverview': return '看舆图概况';
      case 'mapAssignOwner': return '把「' + (i.region || i.regionId || '') + '」划归「' + (i.owner || i.faction || '') + '」';
      case 'renameRegion': return '地名「' + (i.region || i.regionId || '') + '」改作「' + (i.name || i.newName || '') + '」';
      case 'webFetch': return '读网页 ' + _webSite(i.url) + (r.title ? '「' + _shortVal(r.title, 24) + '」' : '') + (i.find ? ' · 找「' + _shortVal(i.find, 12) + '」' : (i.start ? ' · 接着读' : '')) + (r.ok === false && r.reason ? '：' + _shortVal(r.reason, 40) : '');
      case 'checkHistory': return '核对史实 ' + ((i.facts || []).length || '') + ' 条' + (r.lowConfidence ? '，' + r.lowConfidence + ' 条存疑' : '');
      case 'note': return '记一笔：' + _shortVal(i.text, 60);
      case 'todoWrite': return '更新任务清单（' + ((i.todos || []).length) + ' 项' + ((i.todos || []).filter(function(t) { return t && t.status === 'completed'; }).length ? '，已完成 ' + (i.todos || []).filter(function(t) { return t && t.status === 'completed'; }).length : '') + '）';
      case 'flagUncertain': return '标记待核 ' + _friendlyPath(i.path) + (i.reason ? '：' + _shortVal(i.reason, 40) : '');
      case 'recordConvention': return '建议记下约定：' + _shortVal(i.convention, 50);
      case 'saveMemory': return '记下记忆「' + _shortVal(i.name || i.title || i.content, 30) + '」';
      case 'useSkill': return '展开技能「' + (i.name || '') + '」';
      case 'saveSkill': return '存技能「' + (i.name || '') + '」';
      case 'requestTools': return '申请工具 ' + (i.tools || i.names || []).join('、');
      case 'generateImage': return '生成图像 → ' + _friendlyPath(i.path) + (r.model ? '（' + r.model + '）' : '');
      case 'readAttachment': case 'searchAttachment': case 'readAttachmentJson': return (_TOOL_CN[n] || n) + '「' + (i.name || '') + '」';
      case 'askClarification': return '请教你 ' + ((i.questions || []).length || '') + ' 个问题';
      case 'remonstrate': return '进谏：' + _shortVal(i.concern, 40);
      case 'finish': return '收尾：' + _shortVal(String(i.summary || '').replace(/\*\*|__|`|^#+\s*|^\s*[-*]\s+/gm, '').replace(/\s+/g, ' ').trim(), 60);   // 一行里不露 Markdown 记号
      default: return (_TOOL_CN[n] || n) + (i && typeof i === 'object' && Object.keys(i).length ? ' ' + _shortVal(i[Object.keys(i)[0]], 40) : '');
    }
  }
  function _pretty(x, max) {
    var s = '';
    try { s = JSON.stringify(x, null, 2); } catch (e) { s = String(x == null ? '' : x); }
    if (s == null) s = '';
    return s.length > max ? s.slice(0, max) + '\n…（共 ' + s.length + ' 字，已截断）' : s;
  }

  // 改动说明：国师的结案陈词 + 思路 + 建议记住的约定
  function renderSummary(summary, notes, suggestions, stream) {
    if (!ui.els || !ui.els.summary) return;
    var s = (summary || '').trim();
    ui._lastSummary = s;   // 应用时记进改动账
    var sug = (suggestions || []).filter(Boolean);
    if (!s && (!notes || !notes.length) && !sug.length) { ui.els.summary.style.display = 'none'; return; }
    var html = '';
    if (s || (notes && notes.length)) {
      html += '<span class="tm-aa-stream">' + (s ? _md(s) : '（国师没有留下说明）') + '</span>';
      if (notes && notes.length) {
        html += '<div class="note">思路：' + notes.slice(0, 4).map(function(n) { return esc(String(n).slice(0, 160)); }).join('；') + '</div>';
      }
    }
    if (sug.length) {
      html += '<div class="tm-aa-sug"><b>建议记住的约定</b>' + sug.slice(0, 5).map(function(c, i) {
        return '<div class="sug-row"><span>' + esc(String(c).slice(0, 160)) + '</span><button type="button" class="sug-keep" data-i="' + i + '">记住</button></div>';
      }).join('') + '</div>';
    }
    ui.els.summary.innerHTML = html;
    ui.els.summary.style.display = '';
    Array.prototype.forEach.call(ui.els.summary.querySelectorAll('.sug-keep'), function(btn) {
      btn.addEventListener('click', function() {
        var idx = +btn.getAttribute('data-i'), conv = sug[idx];
        if (conv && rememberConvention(conv)) {   // S9 · 记到本剧本层(CC 默认记进项目 CLAUDE.md 同款)
          btn.textContent = '已记住（本剧本）'; btn.disabled = true;
        }
      });
    });
    _streamThenLink(ui.els.summary.querySelector('.tm-aa-stream') || ui.els.summary, stream);   // 吐字 + 实体链接
  }

  // ── 思考与查阅：每轮一个折叠块，运行中展开、收尾折起 ──
  function _ensureExecBlock() {
    var blk = ui._thinkEl;
    if (!blk || !blk.isConnected) {
      if (ui.els) { ui.els.logWrap.style.display = ''; }
      blk = document.createElement('details');
      blk.className = 'tm-aa-think' + (ui.running ? ' live' : '');
      blk.open = !!ui.running;
      blk.innerHTML = '<summary class="tm-aa-think-sum"><span class="tk-label">思考与查阅</span><span class="tk-meta"></span></summary><div class="tm-aa-think-body"></div>';
      if (ui.els) ui.els.log.appendChild(blk);
      ui._thinkEl = blk; ui._thinkCount = 0;
    }
    return blk;
  }
  // 活动行：转环 + 当前在做什么（贴在流尾·收尾移除）
  function _ensureLive() {
    if (!ui.running) return null;
    var lv = ui._liveEl;
    if (!lv || !lv.isConnected) {
      lv = document.createElement('div');
      lv.className = 'tm-aa-live';
      lv.innerHTML = '<span class="lv-spin"></span><span class="lv-tx">国师正在斟酌…</span>';
      if (ui.els) ui.els.log.appendChild(lv);
      ui._liveEl = lv;
    } else if (ui.els && ui.els.log.lastElementChild !== lv) {
      ui.els.log.appendChild(lv);
    }
    return lv;
  }
  function _setLive(text, isThink) {
    var lv = _ensureLive(); if (!lv) return;
    var tx = lv.querySelector('.lv-tx');
    if (tx) { tx.textContent = String(text || '').replace(/\s+/g, ' ').slice(0, 90); tx.classList.toggle('think', !!isThink); }
    _logScrollMaybe();
  }
  function _removeLive() {
    if (ui._liveEl) { try { ui._liveEl.remove(); } catch (e) {} ui._liveEl = null; }
    if (ui._streamEl) { try { ui._streamEl.remove(); } catch (e2) {} ui._streamEl = null; }
  }
  function _bumpExecLabel(blk) {
    ui._thinkCount = (ui._thinkCount || 0) + 1;
    var lbl = blk.querySelector('.tk-label'); if (lbl) lbl.textContent = '思考与查阅 · ' + ui._thinkCount + ' 步';
  }
  function appendText(text, iter) {
    if (!ui.els || !text) return;
    var blk = _ensureExecBlock();
    var line = document.createElement('div');
    line.className = 'tk-line';
    line.textContent = String(text).slice(0, 2000);
    blk.querySelector('.tm-aa-think-body').appendChild(line);
    _bumpExecLabel(blk);
    _setLive(String(text), true);
    _logScrollMaybe();
  }
  function appendLog(step) {
    if (!ui.els) return;
    if (step && step.tokensUsed != null) ui._lastTokens = step.tokensUsed;
    if (step && step.budget) ui._budget = step.budget;
    if (step && step.iteration != null) ui._lastIter = step.iteration;
    var execBlk = _ensureExecBlock();
    var r = step.result || {};
    // 国师自查（validateDraft）按开工时的剧本比：只把这次改出来的新问题算「没成」，剧本原有的不吓人
    var dl = null;
    if (step.name === 'validateDraft' && r.ok === false && Array.isArray(r.violations)) { try { dl = validationDelta(r); } catch (e) { dl = null; } }
    var bad = dl ? !dl.ok : r.ok === false;
    var cls = (step.name === 'finish' && r.ok) ? 'fin' : (bad ? 'bad' : 'ln');
    var why = bad ? (r.reason || r.error || '') : '';
    if (bad && dl) { var vmap = _idNameMap(); why += '（' + dl.fresh.slice(0, 2).map(function(x) { return _readableViolation(x, vmap); }).join('；') + '）'; }
    else if (bad && r.violations && r.violations.length) why += '（' + r.violations.slice(0, 2).join('；') + '）';
    var text = dl ? (dl.ok ? '校验：没有新问题' + (dl.old.length ? '（剧本原有 ' + dl.old.length + ' 处提示）' : '') : '校验：这次改动带来 ' + dl.fresh.length + ' 处新问题') : _friendlyStep(step);
    var card = document.createElement('details');
    card.className = 'tm-aa-step ' + cls;
    var inputStr = step.input && Object.keys(step.input).length ? _pretty(step.input, 1600) : '';
    var resultStr = step.result && Object.keys(step.result).length ? _pretty(step.result, 1600) : '';
    card.innerHTML = '<summary><span class="st-ic">' + _icon(_TOOL_ICON[step.name] || 'route') + '</span><span class="st-tx">' + esc(text) + (why ? ' — ' + esc(String(why).slice(0, 160)) : '') + '</span>' + (bad ? '<span class="st-tag">没成</span>' : '') + '</summary>'
      + '<div class="tm-aa-step-body">'
      + (inputStr ? '<div class="sb-row"><span class="sb-k">交给工具的</span><pre>' + esc(inputStr) + '</pre></div>' : '')
      + (resultStr ? '<div class="sb-row"><span class="sb-k">工具答复</span><pre>' + esc(resultStr) + '</pre></div>' : '')
      + '</div>';
    var body = execBlk.querySelector('.tm-aa-think-body'); if (body) body.appendChild(card); else ui.els.log.appendChild(card);
    _bumpExecLabel(execBlk);
    _setLive(text + ' · 接着想…');
    _logScrollMaybe();
  }

  // ── 改动折子 ──
  // 按「集合 → 实体」归拢改动；每处改动仍是 diffs 里的一条（idx 稳定），拒绝集 ui._diffRejected 不变。
  function _diffEntities(diffs) {
    var base = ui.baseScenario || {}, draft = ui.draft || {};
    var groups = {}, order = [];
    diffs.forEach(function(d) {
      var ss = _segs(d.path), top = ss[0] || '(根)';
      var arr = Array.isArray(draft[top]) || Array.isArray(base[top]);
      var key, rest, idx = null;
      if (arr && /^\d+$/.test(ss[1] || '')) { idx = +ss[1]; key = top + '.' + idx; rest = ss.slice(2); }
      else { key = top; rest = ss.slice(1); }
      if (!groups[top]) { groups[top] = { top: top, ents: {}, order: [] }; order.push(top); }
      var g = groups[top];
      if (!g.ents[key]) { g.ents[key] = { key: key, top: top, idx: idx, hunks: [] }; g.order.push(key); }
      g.ents[key].hunks.push({ d: d, rest: rest });
    });
    return order.map(function(top) {
      var g = groups[top];
      return { top: top, ents: g.order.map(function(k) {
        var e = g.ents[k];
        var after = e.idx != null && Array.isArray(draft[top]) ? draft[top][e.idx] : null;
        var before = e.idx != null && Array.isArray(base[top]) ? base[top][e.idx] : null;
        var whole = e.hunks.length === 1 && !e.hunks[0].rest.length ? e.hunks[0].d : null;
        if (whole && whole.type === 'added') after = whole.after;
        if (whole && whole.type === 'removed') before = whole.before;
        e.op = whole ? (whole.type === 'added' ? 'add' : (whole.type === 'removed' ? 'rm' : 'chg')) : 'chg';
        e.obj = (e.op === 'rm' ? before : after) || before || after;
        e.whole = whole;
        return e;
      }) };
    });
  }
  // 新增实体：挑几项最能说明它的字段
  var _FACT_KEYS = {
    characters: ['officialTitle', 'title', 'faction', 'age', 'zi', 'location', 'party', 'family'],
    factions: ['leader', 'capital', 'factionType', 'strength', 'ideology'],
    parties: ['leader', 'base', 'policyStance', 'influence'],
    events: ['year', 'month', 'type', 'trigger', 'importance'],
    rigidHistoryEvents: ['year', 'month', 'type', 'trigger'],
    families: ['founder', 'currentHead', 'tier', 'ancestralSeat'],
    items: ['category', 'owner', 'value'],
    relations: ['from', 'to', 'type', 'relation', 'value'],
    variables: ['value', 'min', 'max', 'category']
  };
  function _facts(top, obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj == null ? '' : _shortVal(obj, 80);
    var keys = (_FACT_KEYS[top] || []).filter(function(k) { return obj[k] != null && obj[k] !== '' && typeof obj[k] !== 'object'; });
    if (!keys.length) keys = Object.keys(obj).filter(function(k) { return !/^(id|name|title|sid|desc|description|bio)$/.test(k) && obj[k] != null && obj[k] !== '' && typeof obj[k] !== 'object'; }).slice(0, 4);
    var parts = keys.slice(0, 5).map(function(k) { return _fieldLabel(k) + ' ' + _shortVal(obj[k], 24); });
    var d = obj.desc || obj.description || obj.bio;
    if (typeof d === 'string' && d.trim()) parts.push('「' + _shortVal(d, 42) + '」');
    return parts.join(' · ');
  }
  function _detailRows(obj) {
    if (!obj || typeof obj !== 'object') return '';
    var ks = Object.keys(obj).filter(function(k) { return obj[k] != null && obj[k] !== ''; });
    return ks.slice(0, 40).map(function(k) { return '<span class="cd-k">' + esc(_fieldLabel(k)) + '</span><span class="cd-v">' + esc(_shortVal(obj[k], 220)) + '</span>'; }).join('')
      + (ks.length > 40 ? '<span class="cd-k">…</span><span class="cd-v">还有 ' + (ks.length - 40) + ' 项</span>' : '');
  }
  // 置信度标注：某 diff 路径是否被 agent 标为没把握（前缀双向匹配），返回理由或 ''
  function _uncReasonFor(path, uncList) {
    var dp = String(path || '');
    for (var i = 0; i < (uncList || []).length; i++) {
      var up = String(uncList[i].path || ''); if (!up) continue;
      if (dp === up || dp.indexOf(up) === 0 || up.indexOf(dp) === 0) return uncList[i].reason || '（未注明原因）';
    }
    return '';
  }
  function _togHtml(idxs) {
    var rej = ui._diffRejected || new Set();
    var nOn = idxs.filter(function(i) { return !rej.has(i); }).length;
    var on = nOn === idxs.length, part = nOn > 0 && !on;
    return '<button type="button" class="hunk-tog' + (on ? ' on' : '') + (part ? ' part' : '') + '" data-diff-idx="' + idxs.join(',') + '" title="' + (on ? '采纳·点一下不要它' : '不要·点一下采纳') + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + (on ? _icon('check') : (part ? _icon('more') : '')) + '</button>';
  }
  function _entityRowHtml(e, top, unc) {
    var idxs = e.hunks.map(function(h) { return h.d.__idx; });
    var rej = ui._diffRejected || new Set();
    var allRej = idxs.every(function(i) { return rej.has(i); });
    var prev = ui._prevDiffPaths;
    var fresh = prev && e.hunks.some(function(h) { return !prev[h.d.path]; });
    var uncR = '';
    e.hunks.forEach(function(h) { if (!uncR) uncR = _uncReasonFor(h.d.path, unc); });
    var opTx = e.op === 'add' ? '新增' : (e.op === 'rm' ? '删除' : '修改');
    var isEnt = e.idx != null;
    var nm = isEnt ? (_entName(e.obj) || ('第 ' + (e.idx + 1) + ' 项')) : (_COLL_CN[top] || _fieldLabel(top));
    var revealPath = isEnt ? (top + '.' + e.idx) : (e.hunks[0].d.path || top);
    var head = '<div class="ch-line"><span class="ch-op ' + e.op + '">' + opTx + '</span>'
      + '<span class="ch-name tm-aa-diff-jump" data-reveal-path="' + esc(revealPath) + '" title="在编辑器里定位">' + esc(nm) + '</span>'
      + (fresh ? '<span class="ch-new" title="这一轮新出的改动">新</span>' : '')
      + (uncR ? '<span class="ch-unc">待核：' + esc(uncR) + '</span>' : '') + '</div>';
    var body = '';
    if (e.whole && e.op === 'add') {
      var f = _facts(top, e.obj);
      if (f) body += '<div class="ch-facts">' + esc(f) + '</div>';
      if (e.obj && typeof e.obj === 'object') body += '<button type="button" class="ch-more" data-more="1">看全部字段</button><div class="ch-detail" hidden>' + _detailRows(e.obj) + '</div>';
    } else if (e.whole && e.op === 'rm') {
      var f2 = _facts(top, e.obj);
      if (f2) body += '<div class="ch-facts">' + esc(f2) + '</div>';
    } else {
      body += '<div class="ch-fields">' + e.hunks.map(function(h) {
        var d = h.d, k = h.rest.length ? h.rest.map(_fieldLabel).join(' › ') : (isEnt ? '整项' : _fieldLabel(top));
        var multi = e.hunks.length > 1;
        var row;
        if (d.type === 'added') row = '<span class="cf-k">' + esc(k) + '</span><span class="cf-new">＋ ' + esc(_shortVal(d.after, 80)) + '</span>';
        else if (d.type === 'removed') row = '<span class="cf-k">' + esc(k) + '</span><span class="cf-old">' + esc(_shortVal(d.before, 60)) + '</span><span class="cf-arrow">删去</span>';
        else row = '<span class="cf-k">' + esc(k) + '</span><span class="cf-old">' + esc(_shortVal(d.before, 50)) + '</span><span class="cf-arrow">→</span><span class="cf-new">' + esc(_shortVal(d.after, 80)) + '</span>';
        return '<div class="ch-field' + (rej.has(d.__idx) ? ' rejected' : '') + '">' + row + (multi ? '<span class="tm-aa-flex"></span>' + _togHtml([d.__idx]) : '') + '</div>';
      }).join('') + '</div>';
    }
    return '<div class="ch-ent' + (allRej ? ' rejected' : '') + '" data-ent="' + esc(e.key) + '">' + _togHtml(idxs) + '<div class="ch-main">' + head + body + '</div></div>';
  }
  // UI·X · 每条改动可单独采纳/不要；renderDiff 存 diffs+unc 并重置拒绝集，_paintDiff 负责画。
  function renderDiff(diffs, uncertainties) {
    if (!ui.els) return;
    ui.els.diffSec.style.display = ''; ui.els.diff.style.display = '';
    ui._lastDiffs = diffs || [];
    ui._lastUnc = uncertainties || [];
    if (!ui._diffRejected) ui._diffRejected = new Set();
    ui._diffRejected.clear();   // 新一批 diff 默认全采纳
    (ui._lastDiffs).forEach(function(d, i) { d.__idx = i; });   // 稳定下标
    _paintDiff();
    ui.els.diff.onclick = function(ev) {   // 委托（每次重渲覆盖·不叠加）
      var t = ev.target;
      var more = t.closest ? t.closest('.ch-more') : null;
      if (more) { var dt = more.nextElementSibling; if (dt) { dt.hidden = !dt.hidden; more.textContent = dt.hidden ? '看全部字段' : '收起'; } return; }
      var tog = t.closest ? t.closest('.hunk-tog') : null;
      if (tog) { _toggleGroup((tog.getAttribute('data-diff-idx') || '').split(',').filter(Boolean).map(Number)); return; }
      var grp = t.closest ? t.closest('.grp-tog') : null;
      if (grp) { _toggleGroup((grp.getAttribute('data-group-idxs') || '').split(',').filter(Boolean).map(Number)); return; }
      var all = t.closest ? t.closest('.ch-all') : null;
      if (all) { _toggleGroup((ui._lastDiffs || []).map(function(d) { return d.__idx; })); return; }
    };
  }
  function _diffCounts(ents) {
    var c = { add: 0, chg: 0, rm: 0 };
    ents.forEach(function(g) { g.ents.forEach(function(e) { c[e.op]++; }); });
    return c;
  }
  function _diffHeaderText() {
    var diffs = ui._lastDiffs || [], rej = ui._diffRejected || new Set();
    if (!diffs.length) return '改动';
    var totalUnc = diffs.filter(function(d) { return _uncReasonFor(d.path, ui._lastUnc); }).length;
    var acc = diffs.length - rej.size;
    return '待审改动 · 采纳 ' + acc + '/' + diffs.length + ' 处' + (totalUnc ? ' · ' + totalUnc + ' 处待核' : '');
  }
  function _paintDiff() {
    var diffs = ui._lastDiffs || [], unc = ui._lastUnc || [];
    ui.els.diffSec.textContent = _diffHeaderText();
    if (!diffs.length) { ui.els.diff.innerHTML = '<div class="ln">（这一轮没有改动剧本）</div>'; return; }
    ui.els.diffSec.style.display = 'none';   // 折子自带抬头，不再另起一行小标
    var groups = _diffEntities(diffs);
    var cnt = _diffCounts(groups), rej = ui._diffRejected || new Set();
    var totalUnc = diffs.filter(function(d) { return _uncReasonFor(d.path, unc); }).length;
    var head = '<div class="ch-head"><span class="ch-tt">改动折子</span><span class="ch-count">'
      + (cnt.add ? '<span class="ch-n add">新增 ' + cnt.add + '</span>' : '') + (cnt.chg ? '<span class="ch-n chg">修改 ' + cnt.chg + '</span>' : '') + (cnt.rm ? '<span class="ch-n rm">删除 ' + cnt.rm + '</span>' : '')
      + '</span><span class="ch-acc">' + (rej.size ? '采纳 ' + (diffs.length - rej.size) + '/' + diffs.length + ' 处' : '共 ' + diffs.length + ' 处') + (totalUnc ? ' · ' + totalUnc + ' 处待核' : '') + '</span>'
      + '<button type="button" class="ch-all">' + (rej.size >= diffs.length ? '全部采纳' : '全部不要') + '</button></div>';
    ui.els.diff.innerHTML = head + groups.map(function(g) {
      var es = g.ents;
      // 每一处都必须可见、可单独不要；禁止把后面的改动默认当采纳藏起来。
      var inner = es.map(function(d) { return _entityRowHtml(d, g.top, unc); }).join('');
      var idxs = []; es.forEach(function(e) { e.hunks.forEach(function(h) { idxs.push(h.d.__idx); }); });
      var allRej = idxs.every(function(i) { return rej.has(i); });
      var firstPath = (es[0] && es[0].hunks[0] && es[0].hunks[0].d.path) || g.top;
      var gUnc = 0; es.forEach(function(e) { e.hunks.forEach(function(h) { if (_uncReasonFor(h.d.path, unc)) gUnc++; }); });
      var title = _COLL_CN[g.top] || _fieldLabel(g.top);
      return '<div class="tm-aa-diff-group" data-group="' + esc(g.top) + '"><div class="tm-aa-diff-head"><b class="tm-aa-diff-jump" data-reveal-field="' + esc(g.top) + '" data-first-path="' + esc(firstPath) + '" title="在编辑器里定位">' + esc(title) + '</b><span>' + es.length + (es.length > 1 || es[0].idx != null ? ' 项' : '') + (gUnc ? ' · 待核 ' + gUnc : '') + '</span>'
        + (es.length > 1 ? '<button type="button" class="grp-tog" data-group-idxs="' + idxs.join(',') + '">' + (allRej ? '这组都要' : '这组不要') + '</button>' : '') + '</div>' + inner + '</div>';
    }).join('');
    if (typeof ui._onDiffPainted === 'function') { try { ui._onDiffPainted(); } catch (e) {} }
  }
  function _toggleGroup(idxs) {
    if (!idxs.length) return;
    if (!ui._diffRejected) ui._diffRejected = new Set();
    var anyRej = idxs.some(function(i) { return ui._diffRejected.has(i); });
    // 有不要的→这几处全部采纳；全采纳→全部不要
    idxs.forEach(function(i) { if (anyRej) ui._diffRejected.delete(i); else ui._diffRejected.add(i); });
    _paintDiff();
  }
  // 上一轮还没应用的改动并入下一轮：老卡收成一行
  function supersedeDiff(card) {
    if (!card) return;
    var df = card.querySelector('.tm-aa-diff'), sec = card.querySelector('[data-sec="diff"]');
    if (!df || !df.querySelector('.ch-ent')) return;
    var n = df.querySelectorAll('.ch-ent').length;
    card.classList.add('superseded');
    if (sec) sec.textContent = '改动';
    df.innerHTML = '<div class="ch-superseded">这 ' + n + ' 项还没应用，已并入下面的待审改动。</div>';
    df.onclick = null;
  }

  // ── 校验：只报这次带来的新问题 ──
  var _VGROUP_CN = { 'admin-population': '区划人口', 'faction-refs': '势力引用', 'region-coverage': '区划覆盖', 'timeline-compliance': '时间线', 'char-completeness': '人物完整', 'relation-consistency': '关系一致', 'runtime-chars': '人物运行', 'runtime-office': '官制运行', 'runtime-boot': '开局运行', 'history': '史实', 'numbers': '数值' };
  function _idNameMap() {
    var sc = ui.draft || (ui.adapter && ui.adapter.getScenario ? ui.adapter.getScenario() : null) || {}, map = {}, seen = 0;
    function take(o) { if (o && typeof o === 'object' && o.id != null && (o.name || o.title) && !map[o.id]) map[String(o.id)] = String(o.name || o.title); }
    Object.keys(sc).forEach(function(k) { var v = sc[k]; if (Array.isArray(v)) v.forEach(take); });
    (function walk(o, depth) {
      if (!o || typeof o !== 'object' || depth > 7 || seen > 6000) return;
      seen++; take(o);
      if (Array.isArray(o)) o.forEach(function(x) { walk(x, depth + 1); });
      else Object.keys(o).forEach(function(k) { if (k !== 'polygon' && k !== 'points') walk(o[k], depth + 1); });
    })(sc.adminHierarchy, 0);
    return map;
  }
  function _readableViolation(s, map) {
    var t = String(s || '');
    t = t.replace(/^\s*\[([a-z][a-z0-9-]*)\]\s*/i, function(_, g) { return (_VGROUP_CN[g] ? _VGROUP_CN[g] + '：' : ''); });
    t = t.replace(/\[([A-Za-z]+_[A-Za-z0-9_-]+)\]\s*/g, function(m, id) { return map[id] ? '' : m; });
    t = t.replace(/[「\[]?\b([A-Za-z]+_[A-Za-z0-9]{6,})\b[」\]]?/g, function(m, id) { return map[id] ? '「' + map[id] + '」' : m; });
    return t;
  }
  function _baseViolations() {
    var base = ui.baseScenario;
    if (!base || !AA() || typeof AA().validateDraft !== 'function') return null;
    if (ui._baseValCache && ui._baseValCache.base === base) return ui._baseValCache.set;
    var set = {};
    try { (AA().validateDraft(base).violations || []).forEach(function(v) { set[v] = 1; }); } catch (e) { return null; }
    ui._baseValCache = { base: base, set: set };
    return set;
  }
  // 返回 { ok, fresh, old, violations }：fresh=这次新带来的问题，old=剧本原有的
  function validationDelta(report) {
    report = report || { ok: true, violations: [] };
    var all = report.violations || [];
    if (report._delta) return { ok: !all.length, fresh: all, old: [], violations: all };
    var known = _baseViolations();
    if (!known) return { ok: !!report.ok, fresh: report.ok ? [] : all, old: [], violations: all };
    var fresh = [], old = [];
    all.forEach(function(v) { if (known[v]) old.push(v); else fresh.push(v); });
    return { ok: !fresh.length, fresh: fresh, old: old, violations: fresh };
  }
  function renderValidation(report) {
    if (!ui.els) return validationDelta(report);
    var v = ui.els.val;
    v.style.display = '';
    var dl = validationDelta(report), map = (dl.fresh.length || dl.old.length) ? _idNameMap() : {};
    var oldHtml = dl.old.length ? '<span class="v-old">剧本原有 ' + dl.old.length + ' 处提示，与这次改动无关 <button type="button" class="v-old-tog">看看</button></span><ul class="v-oldlist" hidden>' + dl.old.slice(0, 60).map(function(x) { return '<li>' + esc(_readableViolation(x, map)) + '</li>'; }).join('') + (dl.old.length > 60 ? '<li>…还有 ' + (dl.old.length - 60) + ' 处</li>' : '') + '</ul>' : '';
    if (!dl.fresh.length) {
      v.className = 'tm-aa-val ok';
      v.innerHTML = _icon('check', 14) + '<span>' + (dl.old.length ? '没有带来新问题' : '校验通过') + '</span>' + oldHtml;
    } else {
      v.className = 'tm-aa-val bad';
      v.innerHTML = '<div class="v-h">这次改动带来 ' + dl.fresh.length + ' 处新问题</div><ul class="v-list">' + dl.fresh.slice(0, 8).map(function(x) { return '<li>' + esc(_readableViolation(x, map)) + '</li>'; }).join('') + (dl.fresh.length > 8 ? '<li>…还有 ' + (dl.fresh.length - 8) + ' 处</li>' : '') + '</ul>' + (oldHtml ? '<div style="margin-top:6px">' + oldHtml + '</div>' : '');
    }
    var tg = v.querySelector('.v-old-tog');
    if (tg) tg.addEventListener('click', function() { var l = v.querySelector('.v-oldlist'); if (l) { l.hidden = !l.hidden; tg.textContent = l.hidden ? '看看' : '收起'; } });
    return dl;
  }

  // ── 审阅报告：总评 + 按轻重排的发现 ──
  var _SEV_RANK = { '高': 0, '中': 1, '低': 2 };
  function _findingHtml(f) {
    f = f || {};
    var sev = f.severity || '?';
    var sevCls = sev === '高' ? 'rm' : (sev === '中' ? 'ch' : 'add');
    return '<div class="tm-aa-finding"><span class="sev ' + sevCls + '">' + esc(sev === '?' ? '提示' : sev) + '</span><b>' + esc(f.dimension || '') + '</b>'
      + (f.location ? '<span class="loc">' + esc(String(f.location).slice(0, 60)) + '</span>' : '')
      + '<div class="iss">' + _mdLine(f.issue || '') + '</div>'
      + (f.suggestion ? '<div class="sug">→ ' + _mdLine(f.suggestion) + '</div>' : '') + '</div>';
  }
  function renderReview(review, stream) {
    if (!ui.els) return;
    if (ui.els.summary) {
      ui.els.summary.innerHTML = '<b>剧本审阅报告</b><span class="tm-aa-stream">' + _md((review && review.summary) || '（没有总评）') + '</span>';
      ui.els.summary.style.display = '';
      _streamThenLink(ui.els.summary.querySelector('.tm-aa-stream'), stream);
    }
    ui.els.diffSec.style.display = ''; ui.els.diff.style.display = '';
    var findings = ((review && review.findings) || []).slice();
    ui.els.diffSec.textContent = '发现 ' + findings.length + ' 条';
    findings.sort(function(a, b) { return (_SEV_RANK[a && a.severity] != null ? _SEV_RANK[a.severity] : 3) - (_SEV_RANK[b && b.severity] != null ? _SEV_RANK[b.severity] : 3); });
    if (!findings.length) { ui.els.diff.innerHTML = '<div class="ln ok">没发现明显问题</div>'; return; }
    ui.els.diff.innerHTML = findings.slice(0, 40).map(_findingHtml).join('') + (findings.length > 40 ? '<div class="ln">… 还有 ' + (findings.length - 40) + ' 条</div>' : '');
  }

  // ── 请教 / 进谏：对话气泡（在输入框作答续接），附几个快捷回答 ──
  function _appendGuoshiMsg(innerHtml, cls) {
    if (!ui.els || !ui.els.log) return null;
    if (ui.els.logWrap) ui.els.logWrap.style.display = '';
    var b = document.createElement('div');
    b.className = 'tm-aa-msg-ai' + (cls ? ' ' + cls : '');
    b.innerHTML = innerHtml;
    ui.els.log.appendChild(b);
    b.addEventListener('click', function(ev) {
      var c = ev.target && ev.target.closest ? ev.target.closest('.ai-chip') : null;
      if (!c || !ui.els || !ui.els.req) return;
      ui.els.req.value = c.getAttribute('data-fill') || c.textContent;
      try { ui.els.req.dispatchEvent(new Event('input', { bubbles: true })); ui.els.req.focus(); } catch (e) {}
    });
    _logScrollMaybe(true);
    return b;
  }
  function renderClarify(questions) {
    if (!ui.els) return;
    questions = questions || [];
    var qs = questions.map(function(q, i) {
      return '<div class="ai-q">' + (i + 1) + '. ' + esc(typeof q === 'string' ? q : (q && (q.question || q.text)) || JSON.stringify(q)) + '</div>';
    }).join('') || '<div class="ai-q">（没列出具体问题）</div>';
    _appendGuoshiMsg('<span class="ai-who">国师 · 请教</span>要改得准，先弄清几点：<div class="ai-qs">' + qs + '</div>'
      + '<div class="ai-chips"><button type="button" class="ai-chip" data-fill="按你的判断选最合理的做法，直接改。">按你的判断来</button><button type="button" class="ai-chip" data-fill="先别改，把几种做法各自的利弊列给我。">先列几种做法</button></div>'
      + '<div class="ai-hint">在下方输入框作答，发出去就接着干。</div>');
  }
  function renderRemonstrance(r) {
    if (!ui.els) return;
    r = r || {};
    var sevMap = { '史实': '史实存疑', '平衡': '数值失衡', '机制': '跨朝代机制' };
    var html = '<span class="ai-who">国师 · 进谏</span>'
      + '<span class="ai-sev">' + esc(sevMap[r.severity] || r.severity || '谏') + '</span>'
      + esc(r.concern || '此举恐有不妥。')
      + (r.suggestion ? '<div class="ai-sug">↳ 建议：' + esc(r.suggestion) + '</div>' : '')
      + '<div class="ai-chips"><button type="button" class="ai-chip" data-fill="采纳你的建议，照建议改。">采纳建议</button><button type="button" class="ai-chip" data-fill="我坚持原来的要求，因为：">我坚持</button></div>'
      + '<div class="ai-hint">回应后发出即可：采纳、坚持（说说理由），或者换个要求。</div>';
    _appendGuoshiMsg(html, 'remon');
  }

  // ── 计划：编号步骤，批准后执行 ──
  function renderPlan(plan) {
    if (!ui.els) return;
    ui.els.diffSec.style.display = ''; ui.els.diff.style.display = '';
    var steps = (plan && plan.steps) || [];
    ui.els.diffSec.textContent = '改动计划 · ' + steps.length + ' 步（批准后才动手）';
    var rows = [];
    if (plan && plan.summary) rows.push('<div class="ch">' + _mdLine(plan.summary) + '</div>');
    steps.forEach(function(s, i) { rows.push('<div class="plan-step"><span class="ps-n">' + (i + 1) + '</span><span>' + _mdLine(typeof s === 'string' ? s : (s.text || s.step || JSON.stringify(s))) + '</span></div>'); });
    if (!rows.length) rows.push('<div class="ln">（国师没给出明确步骤）</div>');
    ui.els.diff.innerHTML = rows.join('');
  }


  // ── 发布给 origin(反向 shim 调用)的渲染成员 ──
  __aaU.renderSummary = renderSummary; __aaU._removeLive = _removeLive; __aaU.appendText = appendText;
  __aaU.appendLog = appendLog; __aaU.renderDiff = renderDiff; __aaU.renderValidation = renderValidation;
  __aaU.renderReview = renderReview; __aaU.renderClarify = renderClarify;
  __aaU.renderRemonstrance = renderRemonstrance; __aaU.renderPlan = renderPlan;
  __aaU.validationDelta = validationDelta; __aaU.supersedeDiff = supersedeDiff; __aaU._findingHtml = _findingHtml;
  __aaU._friendlyStep = _friendlyStep; __aaU._friendlyPath = _friendlyPath; __aaU._fieldLabel = _fieldLabel; __aaU._shortVal = _shortVal;
  __aaU._readableViolation = _readableViolation; __aaU._idNameMap = _idNameMap; __aaU._COLL_CN = _COLL_CN; __aaU._setLive = _setLive; __aaU._ensureExecBlock = _ensureExecBlock;
})(typeof window !== 'undefined' ? window : this);

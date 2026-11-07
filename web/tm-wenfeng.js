// 文风设置：玩家可选各栏 AI 文字的文风。
// 同志 11-06 提、11-07 定：文言、半文半白、白话三档，加「照旧」（默认）；实录固定文言；各栏可单独设；
// 问对、朝议里人物说话默认不跟总设置（人物自己的口吻优先），另设开关。
//
// 「照旧」= 不加任何指示，各处提示词逐字不变，文风仍按游戏模式（严格史实偏文言、轻度史实半文半白、演义偏白话，
// 见 tm-utils.js 的 _getModeParams 与 tm-prompt-composer.js 的 buildNarrativeGuide）。
// 选了别的档，各处提示词末尾接一句本栏的文风指示，并声明它优先于上面的叙事风格。
//
// 存在 P.conf.wenfeng = { level, cols: { shizhengji, houren, documents, fengwen }, dialogueFollow }。
(function (root) {
  'use strict';
  var TM = root.TM = root.TM || {};
  if (TM.Wenfeng) return;

  var LEVELS = {
    keep: { name: '照旧', text: '' },
    wenyan: { name: '文言', text: '通篇文言，仿史书与公牍笔法；用词典雅，句式简洁；对话以「曰」「言」引述。' },
    banwen: { name: '半文半白', text: '叙事用浅近文言，对话可用浅白话；读来古雅而不艰涩。' },
    baihua: { name: '白话', text: '用通俗白话写，句子平实好懂；保留时代气息，人名、官名、地名、年号、称谓照旧。' }
  };
  var LEVEL_ORDER = ['keep', 'wenyan', 'banwen', 'baihua'];
  var COMMON = '引用诏令、奏章原文时保留原文；不用网络用语和现代词汇。';
  // 可单独设的栏（实录固定文言，不在此列；人物说话只有「跟不跟总设置」一个开关）
  var COLUMNS = [
    { k: 'shizhengji', n: '时政记' },
    { k: 'houren', n: '后人戏说' },
    { k: 'documents', n: '奏疏与书信' },
    { k: 'fengwen', n: '风闻与朝野动向' }
  ];
  var NAMES = { shizhengji: '时政记', houren: '后人戏说', documents: '奏疏与书信', fengwen: '风闻与朝野动向', dialogue: '人物说话', shilu: '实录' };

  // 只读：取存着的设置（写只在 set() 的两行里）
  function conf() {
    var saved = root.P && root.P.conf && root.P.conf.wenfeng;
    return saved && typeof saved === 'object' ? saved : {};
  }

  // 这一栏实际用哪一档
  function level(col) {
    if (col === 'shilu') return 'wenyan';   // 实录固定文言
    var c = conf();
    var total = LEVELS[c.level] ? c.level : 'keep';
    if (col === 'dialogue') return c.dialogueFollow === true ? total : 'keep';   // 人物说话默认不跟
    var own = c.cols && c.cols[col];
    if (own && own !== 'inherit' && LEVELS[own]) return own;
    return total;
  }

  // 接在某栏提示词末尾的一句指示；「照旧」和实录返回空串
  function directive(col) {
    if (col === 'shilu') return '';
    var lv = level(col);
    if (lv === 'keep') return '';
    return '【文风·' + (NAMES[col] || col) + '·' + LEVELS[lv].name + '（玩家所选，优先于上面的叙事风格）】' + LEVELS[lv].text + COMMON;
  }

  function active() {
    return COLUMNS.some(function (x) { return level(x.k) !== 'keep'; }) || level('dialogue') !== 'keep';
  }

  // 主推演系统提示词里的总说明：哪栏都是「照旧」时为空
  function mainBlock() {
    if (!COLUMNS.some(function (x) { return level(x.k) !== 'keep'; })) return '';
    var lines = COLUMNS.map(function (x) {
      var lv = level(x.k);
      return x.n + '：' + (lv === 'keep' ? '照上面的叙事风格' : LEVELS[lv].name);
    });
    return '\n【文风设置·玩家所选，优先于上面的叙事风格】' + lines.join('；') + '；实录一律文言（仿历代实录），不随此设置。' + COMMON;
  }

  function summary() {
    var c = conf();
    var total = LEVELS[c.level] ? c.level : 'keep';
    var bits = ['总设置' + LEVELS[total].name];
    COLUMNS.forEach(function (x) {
      var own = c.cols && c.cols[x.k];
      if (own && own !== 'inherit' && LEVELS[own]) bits.push(x.n + LEVELS[own].name);
    });
    bits.push(c.dialogueFollow === true ? '人物说话随文风' : '人物说话照旧');
    return bits.join('，');
  }

  // 设置面板的下拉框、勾选框直接调这里，改完立即存。
  // 新设置整份另造，再一次写回 P.conf.wenfeng：这是这项设置唯一的写口。
  function set(path, value) {
    if (!root.P) return null;
    var cur = conf();
    var nextLevel = LEVELS[cur.level] ? cur.level : 'keep';
    var nextFollow = cur.dialogueFollow === true;
    var nextCols = {};
    Object.keys(cur.cols || {}).forEach(function (key) { nextCols[key] = cur.cols[key]; });
    path = String(path);
    if (path === 'level') nextLevel = LEVELS[value] ? value : 'keep';
    else if (path === 'dialogueFollow') nextFollow = !!value;
    else if (path.indexOf('cols.') === 0) {
      var col = path.slice(5);
      if (!COLUMNS.some(function (x) { return x.k === col; })) return cur;   // 实录、人物说话不许单设
      if (value === 'inherit' || !LEVELS[value]) delete nextCols[col];
      else nextCols[col] = value;
    } else return cur;
    var next = { level: nextLevel, cols: nextCols, dialogueFollow: nextFollow };
    if (!root.P.conf) root.P.conf = {}; // arch-ok: 文风设置的唯一写口（玩家设置存 P.conf）
    root.P.conf.wenfeng = next; // arch-ok: 文风设置的唯一写口，整份替换
    try { if (typeof root.saveP === 'function') root.saveP(); } catch (_) {}
    try { if (typeof root.toast === 'function') root.toast('文风已存：' + summary()); } catch (_) {}
    return next;
  }

  // 设置面板的一节（tm-patches.js 的设置页拼进去）。字号不写死：正文随所在一节，说明文字用 --text-xs 令牌
  function settingsHtml() {
    var saved = conf();
    var total = LEVELS[saved.level] ? saved.level : 'keep';
    var opt = function (v, cur, label) { return '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + label + '</option>'; };
    var levelOpts = function (cur) { return LEVEL_ORDER.map(function (v) { return opt(v, cur, LEVELS[v].name + (v === 'keep' ? '（默认）' : '')); }).join(''); };
    var hint = 'font-size:var(--text-xs);color:var(--txt-d);line-height:1.55;';
    var h = '<div class="settings-section"><h4>文风</h4>' +
      '<div style="' + hint + 'margin:-0.3rem 0 0.6rem;">各栏 AI 文字用什么文风。「照旧」即现在的样子：随游戏模式（严格史实偏文言、轻度史实半文半白、演义偏白话）。实录固定文言，不随此设置。</div>' +
      '<label style="display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0;">总设置 ' +
        '<select id="s-wenfeng-level" onchange="TM.Wenfeng.set(\'level\',this.value)">' + levelOpts(total) + '</select></label>' +
      '<details style="margin:0.3rem 0;"><summary style="cursor:pointer;color:var(--txt-d);">各栏单独设置</summary>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0.4rem 1rem;margin-top:0.4rem;">';
    COLUMNS.forEach(function (x) {
      var own = saved.cols && saved.cols[x.k];
      var cur = own && LEVELS[own] ? own : 'inherit';
      h += '<label style="display:flex;align-items:center;gap:0.4rem;">' + x.n + ' ' +
        '<select id="s-wenfeng-' + x.k + '" onchange="TM.Wenfeng.set(\'cols.' + x.k + '\',this.value)">' +
        opt('inherit', cur, '随总设置') + LEVEL_ORDER.map(function (v) { return opt(v, cur, LEVELS[v].name); }).join('') +
        '</select></label>';
    });
    h += '</div></details>' +
      '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.4rem 0;cursor:pointer;">' +
        '<input type="checkbox" id="s-wenfeng-dialogue" ' + (saved.dialogueFollow === true ? 'checked ' : '') + 'onchange="TM.Wenfeng.set(\'dialogueFollow\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
        '<div style="flex:1;">问对、朝议里人物说话也随总设置<div style="' + hint + '">默认不跟：人物各有自己的口吻，跟着改容易出戏。</div></div>' +
      '</label></div>';
    return h;
  }

  TM.Wenfeng = {
    levels: LEVELS,
    columns: COLUMNS,
    level: level,
    directive: directive,
    active: active,
    mainBlock: mainBlock,
    summary: summary,
    set: set,
    settingsHtml: settingsHtml
  };
})(typeof window !== 'undefined' ? window : globalThis);

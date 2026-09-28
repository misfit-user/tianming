// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// 史记弹窗·御览分卷组装（2026-07-06 全面重做·从 tm-endturn-render.js 抽出并翻新）
//
// 范式：旧「单栏长滚动 + 展开详情一刀切折叠」→ 新「御览分卷」——
//   左侧卷目（卷签导航）+ 右侧单卷内容，默认落「总览」卷。
//   HTML 自包含（卷切换走全局 _sjcSwitchVol，退化时总览卷仍可读），
//   整体存入 GM.shijiHistory[].html，当回合弹出/历史翻阅/史册库回放同一条路径。
//
// 章节导航：
//   §1 [L~30]  格式化助手（_sjcFmtBig/_sjcValHtml/_sjcReasonChips/逐因取数）
//   §2 [L~120] 叙事板块（实录/时政记/后人戏说/角色状态/帝王私行/势力动态）
//   §3 [L~330] 战况板块（战斗卡/战役时间轴/诸军总览——smoke 契约：affectedArmies details 表）
//   §4 [L~640] 数值板块（帑廪/内帑/户口/政治核心/军事/势力/党派/阶层/人物 + 岁计流水）
//   §5 [L~1000] 问责板块（御批回听/廷议追责）+ 一致性校验附录
//   §6 [L~1250] 人事板块 + 总览卷（大势 chips/本回合要点/卷目提要）
//   §7 [L~1420] 卷装订 _composeShijiHtml + 卷切换 _sjcSwitchVol
//
// 纪律：
//   · 组装纯函数——只读 GM/P，零写入（副作用全留 _endTurn_render）。
//   · 文案守恒——板块题/字段名/原因语全承旧版，emoji 图标退役换单字印。
//   · 旧存档兼容——旧结构 html 回放走旧 CSS（.tr-* 类不删），新结构类前缀 .sjc-*。
// Requires: tm-utils.js (escHtml/showCharPopup)；须先于 tm-endturn-render.js 加载。
// ============================================================
(function(global) {
  'use strict';

  // ───────────────────────── §1 格式化助手 ─────────────────────────
  /** 大数格式化（万/亿） */
  function _sjcFmtBig(v) {
    v = Math.round(v || 0);
    if (Math.abs(v) >= 1e8) return (v / 1e8).toFixed(2) + '亿';
    if (Math.abs(v) >= 1e4) return (v / 1e4).toFixed(v % 1e4 === 0 ? 0 : 1) + '万';
    return v.toLocaleString();
  }
  /** old→new+delta HTML（沿旧 .delta/.old/.arr/.new 类，样式已存在） */
  function _sjcValHtml(oldV, newV, formatter, unit) {
    var fmt = formatter || _sjcFmtBig;
    var d = (newV || 0) - (oldV || 0);
    var delta;
    if (d === 0) delta = '<span class="delta flat">—</span>';
    else if (d > 0) delta = '<span class="delta up">+' + fmt(d) + '</span>';
    else delta = '<span class="delta dn">−' + fmt(-d) + '</span>';
    return '<span class="old">' + fmt(oldV || 0) + (unit ? '<span class="unit">' + unit + '</span>' : '') + '</span><span class="arr">→</span><span class="new">' + fmt(newV || 0) + (unit ? '<span class="unit">' + unit + '</span>' : '') + '</span>' + delta;
  }
  /** reasons 数组 → chip HTML（正负词性判色·承旧词表） */
  function _sjcReasonChips(reasons, fallback) {
    if (!Array.isArray(reasons) || reasons.length === 0) {
      return fallback ? '<span class="tr-reason-txt">' + escHtml(fallback) + '</span>' : '';
    }
    var html = '';
    reasons.slice(0, 6).forEach(function(r) {
      var desc = r.desc || r.type || r.reason || '';
      if (!desc) return;
      var v = r.delta || r.amount || '';
      var cls = 'neu';
      if (typeof r.delta === 'number') cls = r.delta > 0 ? 'pos' : (r.delta < 0 ? 'neg' : 'neu');
      else if (/损|降|衰|败|恶|死|蚀|消|灾|败北|减少|流失|贬|裁|烧|挫/.test(desc)) cls = 'neg';
      else if (/增|升|补|添|新|完|收|成|兴|旌|欣|破|正|愉|获/.test(desc)) cls = 'pos';
      html += '<span class="tr-reason-chip ' + cls + '">' + escHtml(desc) + (v ? '<span class="v">' + escHtml(String(v)) + '</span>' : '') + '</span>';
    });
    return html;
  }
  // 政治核心逐因（皇威/皇权走 turnChanges.variables 的 reasons·民心走 MinxinLedger 台账）。纯读·失败静默回空。
  function _sjcCoreMetricReasons(k, label) {
    var out = [];
    try {
      var vars = (GM.turnChanges && GM.turnChanges.variables) || [];
      for (var i = 0; i < vars.length; i++) {
        var v = vars[i]; if (!v || !Array.isArray(v.reasons)) continue;
        var p = String(v.path || ''), nm = String(v.name || v.label || '');
        if (p === k || p.indexOf(k + '.') === 0 || (label && nm === label)) {
          for (var j = 0; j < v.reasons.length; j++) out.push(v.reasons[j]);
        }
      }
    } catch (e) {}
    try {
      if ((k === 'minxin' || /民心/.test(label || '')) && global.TM && TM.MinxinLedger && TM.MinxinLedger.recentCauses) {
        var causes = TM.MinxinLedger.recentCauses(GM, { limit: 6 }) || [];
        for (var m = 0; m < causes.length; m++) {
          var c = causes[m];
          var d = (typeof c.deltaTrue === 'number') ? c.deltaTrue : (typeof c.delta === 'number' ? c.delta : (typeof c.amount === 'number' ? c.amount : null));
          var desc = c.reason || c.kind || c.sourceSystem || '';
          if (desc) out.push({ desc: desc, delta: d });
        }
      }
    } catch (e) {}
    return out;
  }
  // 人口逐因：有真实 population_changes（带地域+缘由）则显真因·无则回落诚实通用词。
  function _sjcPopReasonHtml(kinds, generic) {
    try {
      var pcs = (GM.turnChanges && GM.turnChanges.population_changes) || [];
      var chips = '', seen = {}, cnt = 0;
      for (var i = 0; i < pcs.length && cnt < 4; i++) {
        var p = pcs[i]; if (!p || kinds.indexOf(p.kind || 'death') < 0) continue;
        var rs = String(p.reason || ''); if (!rs) continue;
        var key = (p.region || '') + '|' + rs; if (seen[key]) continue; seen[key] = 1; cnt++;
        chips += '<span class="tr-reason-chip neg">' + escHtml((p.region ? p.region + '·' : '') + rs) + (p.amount ? '<span class="v">-' + escHtml(String(Math.abs(p.amount))) + '</span>' : '') + '</span>';
      }
      if (chips) return chips;
    } catch (e) {}
    return '<span class="tr-reason-txt">' + escHtml(generic) + '</span>';
  }
  /** 卷内空态雅句 */
  function _sjcEmpty(line, sub) {
    return '<div class="sjc-empty"><div class="sjc-empty-glyph">阙</div><div class="sjc-empty-line">' + escHtml(line) + '</div>' + (sub ? '<div class="sjc-empty-sub">' + escHtml(sub) + '</div>' : '') + '</div>';
  }
  /** 单字印（替代 emoji 的方寸印记） */
  function _sjcGlyph(ch, tone) {
    return '<span class="sjc-glyph' + (tone ? ' ' + tone : '') + '">' + escHtml(ch) + '</span>';
  }

  // ───────────────────────── §2 叙事板块 ─────────────────────────
  /** ① 实录（文言史官体·卷轴纸） */
  function _sjcShilu(shiluText) {
    if (!shiluText) return '';
    return '<div class="tr-section shilu">'
      + '<div class="tr-section-hdr"><span class="lab">实 录</span><span class="meta">起居注官实录 · 正史体</span></div>'
      + '<div class="tr-shilu"><div class="tr-shilu-seal">史官</div>' + escHtml(shiluText) + '</div>'
      + '</div>';
  }

  /** ② 时政记（朝政纪要体·段落主题印+信息源/地名/人名高亮——逻辑承旧版·正则构建提出段落循环外） */
  function _sjcSzjSection(shizhengji, szjTitle, szjSummary) {
    if (!shizhengji) return '';
    var paras = shizhengji.split(/\n{2,}/).filter(function(p) { return p.trim().length > 0; });
    if (paras.length <= 1) paras = shizhengji.split(/\n/).filter(function(p) { return p.trim().length > 0; });
    var topicMap = [
      { pattern: /军|战|兵|攻|守|伐|阵|围城|败|胜|征/, glyph: '军', label: '军事' },
      { pattern: /税|钱|粮|财|岁入|赋|商|市|盐铁/, glyph: '财', label: '财政' },
      { pattern: /民|百姓|流民|饥|荒|疫|灾|旱|涝/, glyph: '民', label: '民生' },
      { pattern: /臣|官|吏|朝|奏|谏|党|弹劾|铨选/, glyph: '朝', label: '朝政' },
      { pattern: /外|番|使|夷|和亲|朝贡|边|藩/, glyph: '交', label: '外交' },
      { pattern: /后|妃|太子|皇子|内宫|宗室/, glyph: '宫', label: '宫廷' }
    ];
    // 高亮资源提前构建（旧版每段重建·O(段落×实体) 白耗）
    var placeRe = null;
    if (P.adminHierarchy) {
      var placeNames = [];
      Object.keys(P.adminHierarchy).forEach(function(fk) {
        var fh = P.adminHierarchy[fk];
        if (fh && fh.divisions) (function _walk(divs) {
          divs.forEach(function(d) { if (d.name && d.name.length >= 2) placeNames.push(d.name); if (d.divisions) _walk(d.divisions); });
        })(fh.divisions);
      });
      if (placeNames.length > 0) {
        placeRe = new RegExp('(' + placeNames.sort(function(a, b) { return b.length - a.length; }).map(function(n) { return n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')', 'g');
      }
    }
    var facColorMap = {};
    (GM.facs || []).forEach(function(f) { if (f.name && f.color) facColorMap[f.name] = f.color; });
    var playerFac = (P.playerInfo && P.playerInfo.factionName) || '';
    var charNames = (GM.chars || []).filter(function(c) { return c.alive !== false && c.name && c.name.length >= 2; })
      .sort(function(a, b) { return b.name.length - a.name.length; });

    var rendered = paras.map(function(para) {
      var trimmed = para.trim();
      var topic = null;
      for (var ti = 0; ti < topicMap.length; ti++) {
        if (topicMap[ti].pattern.test(trimmed)) { topic = topicMap[ti]; break; }
      }
      var escaped = escHtml(trimmed);
      // 信息源高亮（官报/密探/坊间/核实——正则承旧版）
      escaped = escaped.replace(/(据[一-鿿]{1,8}奏报|有司呈报|[一-鿿]{1,6}奏称)/g, '<span class="sjc-src guan">$1</span>');
      escaped = escaped.replace(/(密探[一-鿿]{0,4}报|线报称|暗线[一-鿿]{0,4}|密查)/g, '<span class="sjc-src mi">$1</span>');
      escaped = escaped.replace(/(坊间传[一-鿿]{0,4}|民间[一-鿿]{0,4}传|流言称|有人云)/g, '<span class="sjc-src fang">$1</span>');
      escaped = escaped.replace(/(经查[一-鿿]{0,4}|核实|查明)/g, '<span class="sjc-src cha">$1</span>');
      // 地名高亮
      if (placeRe) {
        escaped = escaped.replace(placeRe, '<span class="sjc-place" title="地名">$1</span>');
      }
      // 角色名彩色高亮（按势力色·2 字短名做汉字边界检查防子串误抓）
      charNames.forEach(function(c) {
        var col = (c.faction === playerFac) ? 'var(--gold-400)' : (facColorMap[c.faction] || '#888');
        var safeN = c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        var safeName = c.name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        var replacement = '<span class="char-link" style="color:' + col + ';" onclick="event.stopPropagation();showCharPopup(\'' + safeName + '\',event)">' + c.name + '</span>';
        if (c.name.length === 2) {
          var segs = escaped.split(/(<[^>]*>)/);
          for (var si = 0; si < segs.length; si++) {
            if (segs[si].charAt(0) === '<') continue;
            segs[si] = segs[si].replace(new RegExp(safeN, 'g'), function(_m, _off, _whole) {
              var prev = _off > 0 ? _whole.charAt(_off - 1) : '';
              var next = (_off + _m.length < _whole.length) ? _whole.charAt(_off + _m.length) : '';
              if (/[一-龥]/.test(prev) && /[一-龥]/.test(next)) return _m;
              return replacement;
            });
          }
          escaped = segs.join('');
        } else {
          escaped = escaped.replace(new RegExp(safeN, 'g'), replacement);
        }
      });
      if (topic) {
        return '<div class="sjc-szj-para tagged"><span class="sjc-para-tag">' + _sjcGlyph(topic.glyph) + topic.label + '</span>' + escaped + '</div>';
      }
      return '<div class="sjc-szj-para">' + escaped + '</div>';
    }).join('');

    var html = '<div class="tr-section szj">'
      + '<div class="tr-section-hdr"><span class="lab">时 政 记</span><span class="meta">朝政纪要体</span></div>';
    if (szjTitle) html += '<div class="tr-szj-title">' + escHtml(szjTitle) + '</div>';
    html += '<div class="tr-szj-content">' + rendered + '</div>';
    if (szjSummary) html += '<div class="tr-szj-summary">' + escHtml(szjSummary) + '</div>';
    html += '</div>';
    return html;
  }

  /** ⑤ 后人戏说（稗官野史） */
  function _sjcHouren(hourenXishuo) {
    if (!hourenXishuo) return '';
    return '<div class="tr-section houren">'
      + '<div class="tr-section-hdr"><span class="lab">后 人 戏 说</span><span class="meta">稗官野史 · 参考不可尽信</span></div>'
      + '<div class="tr-houren-box">' + escHtml(hourenXishuo) + '</div>'
      + '</div>';
  }

  /** 角色状态（政局/内省·承旧版双条） */
  function _sjcStatus(playerStatus, playerInner) {
    if (!playerStatus && !playerInner) return '';
    var html = '<div class="tr-section sjc-status"><div class="tr-section-hdr"><span class="lab">角 色 状 态</span><span class="meta">政局处境 · 方寸之间</span></div>';
    if (playerStatus) html += '<div class="sjc-status-row zheng"><span class="sjc-status-lab">政局</span><div class="sjc-status-txt">' + escHtml(playerStatus) + '</div></div>';
    if (playerInner) html += '<div class="sjc-status-row nei"><span class="sjc-status-lab">内省</span><div class="sjc-status-txt inner">' + escHtml(playerInner) + '</div></div>';
    html += '</div>';
    return html;
  }

  /** 帝王私行（昏君活动风味·朝野反应·叙事里程碑——逻辑承旧版·emoji 退役） */
  function _sjcTyrant(tyrantResult) {
    if (!(tyrantResult && tyrantResult.flavorTexts && tyrantResult.flavorTexts.length > 0)) return '';
    var html = '<div class="tr-section sjc-tyrant"><div class="tr-section-hdr"><span class="lab">帝 王 私 行</span><span class="meta">起居秘录 · 内廷所见</span></div>';
    tyrantResult.flavorTexts.forEach(function(ft) {
      html += '<div class="tyrant-flavor"><div class="tyrant-flavor-title">' + _sjcGlyph('私') + ' ' + escHtml(ft.name) + '</div>' + escHtml(ft.text) + '</div>';
    });
    var efxParts = [];
    if (tyrantResult.totalStress !== 0) efxParts.push('<span style="color:var(--green);">压力' + tyrantResult.totalStress + '</span>');
    if (tyrantResult.costLog.length > 0) efxParts.push('<span style="color:var(--red);">' + tyrantResult.costLog.join(' ') + '</span>');
    if (tyrantResult.gainLog.length > 0) efxParts.push('<span style="color:var(--green);">' + tyrantResult.gainLog.join(' ') + '</span>');
    if (efxParts.length > 0) {
      html += '<div class="sjc-tyrant-efx">' + efxParts.join(' | ') + '</div>';
    }
    // 朝野反应——根据当前NPC状态生成动态反应文本（承旧版阈值）
    var dec = GM._tyrantDecadence || 0;
    if (dec > 15 && GM.chars) {
      var reactions = [];
      GM.chars.forEach(function(c) {
        if (c.alive === false || c.isPlayer) return;
        var loy = c.loyalty || 50;
        var amb = c.ambition || 50;
        if (loy > 80 && amb < 50 && dec > 30) {
          reactions.push({ name: c.name, type: 'loyal', text: '叹息不已，欲进谏又恐触怒天威' });
        } else if (amb > 75 && loy < 40) {
          reactions.push({ name: c.name, type: 'schemer', text: '暗中窃喜，觉得机会来了' });
        } else if (loy > 70 && amb > 60 && dec > 40) {
          reactions.push({ name: c.name, type: 'sycophant', text: '奉上珍宝，奉承圣意，请赏' });
        }
      });
      if (reactions.length > 0) {
        html += '<div class="sjc-tyrant-react"><div class="sjc-tyrant-react-hd">朝野反应</div>';
        reactions.forEach(function(r) {
          var col = r.type === 'loyal' ? 'var(--blue)' : r.type === 'schemer' ? 'var(--red)' : 'var(--gold-d)';
          var g = r.type === 'loyal' ? '忠' : r.type === 'schemer' ? '觊' : '谀';
          html += '<div style="color:' + col + ';">' + _sjcGlyph(g) + ' <b>' + escHtml(r.name) + '</b>：' + r.text + '</div>';
        });
        html += '</div>';
      }
    }
    // 叙事性里程碑——基于历史次数（文案承旧版原句）
    var histLen = GM._tyrantHistory ? GM._tyrantHistory.length : 0;
    var milestones = [
      { count: 2, text: '你觉得这样的日子也不错。毕竟，帝王也是人呀。' },
      { count: 5, text: '内侍悄悄地说，有几位老臣在殿外等了很久。你挥挥手：明天再说。' },
      { count: 10, text: '昨夜梦见父皇在龙椅上看着你，面无表情。醒来后，你喝了一杯酒，很快就忘了。' },
      { count: 15, text: '今天上朝时，大殿上非常安静。没有人进谏了。你觉得这种安静很舒服。' }
    ];
    milestones.forEach(function(ms) {
      if (histLen === ms.count) {
        html += '<div class="sjc-tyrant-milestone">' + ms.text + '</div>';
      }
    });
    html += '</div>';
    return html;
  }

  /** 天下势力动态（faction_events·本回合各方自主行动） */
  function _sjcFactionEvt() {
    if (!(GM.factionEvents && GM.factionEvents.length > 0)) return '';
    // render 在 turn++ 之后跑·本回合事件戳=GM.turn-1
    var recent = GM.factionEvents.filter(function(e) { return e.turn === GM.turn - 1; });
    if (recent.length === 0) return '';
    var html = '<div class="tr-section sjc-facevt"><div class="tr-section-hdr"><span class="lab">天 下 势 力 动 态</span><span class="meta">本回合各方势力的自主行动</span></div>';
    recent.forEach(function(fe) {
      html += '<div class="sjc-facevt-row">';
      html += '<span class="sjc-facevt-actor">' + escHtml(fe.actor) + '</span>';
      if (fe.target) html += ' <span class="arr">→</span> <span class="sjc-facevt-target">' + escHtml(fe.target) + '</span>';
      html += '：' + escHtml(fe.action);
      if (fe.result) html += ' <span class="sjc-facevt-result">(' + escHtml(fe.result) + ')</span>';
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  // ───────────────────────── §3 战况板块 ─────────────────────────
  // smoke 契约（smoke-endturn-battle-detail-fallback）：affectedArmies 渲染 <details>…<summary>…N 军卷入…</table></details>
  // 军名回退链/命运汉化/归因标签/无裸问号格——逻辑逐条承旧版。
  function _sjcBattleSection() {
    var battles = GM._turnBattleResults || [];
    if (battles.length === 0 && GM.battleHistory) {
      battles = GM.battleHistory.filter(function(b) { return b.turn === GM.turn - 1; });
    }
    var hasArmies = Array.isArray(GM.armies) && GM.armies.length > 0;
    if (battles.length === 0 && !hasArmies) return '';

    function _battleText(v) { return String(v == null ? '' : v).trim(); }
    function _battleSame(a, b) {
      a = _battleText(a).replace(/\s+/g, '').toLowerCase();
      b = _battleText(b).replace(/\s+/g, '').toLowerCase();
      return !!(a && b && a === b);
    }
    function _battleArmyCommander(a) {
      return _battleText(a && (a.commander || a.commanderName || a.general || a.generalName || a.leader || a.leaderName || a.chiefCommander || a.mainGeneral));
    }
    function _battleArmyName(a) {
      return _battleText(a && (a.name || a.army || a.armyName || a.label || a.id || a.armyId));
    }
    function _battleFindArmy(row) {
      if (!Array.isArray(GM.armies)) return null;
      row = row || {};
      var refs = [row.armyId, row.id, row.army, row.name, row.armyName, row.ref, row.target].map(_battleText).filter(Boolean);
      for (var i = 0; i < GM.armies.length; i += 1) {
        var a = GM.armies[i] || {};
        var keys = [a.id, a.armyId, a.name, a.army, a.armyName, a.label].map(_battleText).filter(Boolean);
        if (refs.some(function(r) { return keys.some(function(k) { return _battleSame(r, k); }); })) return a;
      }
      var commander = _battleText(row.commander || (row.commanderFate && row.commanderFate.name));
      if (commander) {
        for (var j = 0; j < GM.armies.length; j += 1) {
          if (_battleSame(_battleArmyCommander(GM.armies[j]), commander)) return GM.armies[j];
        }
      }
      return null;
    }
    function _battleOutcomeLabel(outcome) {
      outcome = _battleText(outcome).toLowerCase();
      if (!outcome) return '';
      if (outcome === 'killed' || outcome === 'dead') return '主将阵亡';
      if (outcome === 'captured') return '主将被俘';
      if (outcome === 'injured') return '主将负伤';
      if (outcome === 'fled') return '主将遁走';
      if (outcome === 'surrendered') return '主将降附';
      if (outcome === 'survived') return '主将无恙';
      return outcome;
    }
    function _battleStateLabel(state) {
      state = _battleText(state).toLowerCase();
      if (!state) return '';
      if (state === 'routed') return '溃退';
      if (state === 'disbanded') return '溃散';
      if (state === 'garrison') return '收兵驻守';
      if (state === 'marching') return '行军转进';
      if (state === 'sieging') return '围城未解';
      return state;
    }
    function _battleSideLabel(side) {
      side = _battleText(side).toLowerCase();
      if (side === 'attacker') return '攻方';
      if (side === 'defender') return '守方';
      return '';
    }
    function _battleInferFate(row, liveArmy, battle) {
      row = row || {};
      var explicit = _battleText(row.fate || row.destiny || row.result || row.outcome);
      if (explicit) return explicit;
      var cf = row.commanderFate || (liveArmy && liveArmy.commanderFate ? { outcome: liveArmy.commanderFate } : null);
      var cfLabel = cf && _battleOutcomeLabel(cf.outcome || cf.result || cf.fate);
      var stateLabel = _battleStateLabel(row.state || row.stateAfter || (liveArmy && liveArmy.state));
      var loss = Number(row.casualties != null ? row.casualties : (row.loss != null ? row.loss : row.soldiersLost));
      if (!isFinite(loss)) loss = 0;
      if (stateLabel && cfLabel) return stateLabel + ' · ' + cfLabel;
      if (stateLabel) return stateLabel;
      if (cfLabel) return cfLabel;
      if (row.routed || (liveArmy && liveArmy.routed)) return '溃退';
      if (row.disbanded || (liveArmy && liveArmy.disbanded)) return '溃散';
      if (loss > 0) return '受创';
      var side = _battleText(row.side).toLowerCase();
      var faction = _battleText(row.faction || row.owner || (liveArmy && (liveArmy.faction || liveArmy.owner)));
      var _bt = battle || {};
      if (faction && _battleSame(faction, _bt.winner || _bt.winnerFactionId || _bt.winnerFaction)) return '胜后保全';
      if (faction && _battleSame(faction, _bt.loser || _bt.loserFactionId || _bt.loserFaction)) return '败后整顿';
      if (side === 'attacker' || side === 'defender') return _battleSideLabel(side) + '保全';
      return '在阵';
    }
    function _battleAttribution(row, liveArmy) {
      row = row || {};
      var v = _battleText(row.attribution || row.cause || row.reason || row.source);
      if (v) return v;
      if (row.commanderFate || (liveArmy && liveArmy.commanderFate)) return 'commander';
      if (liveArmy && (liveArmy.owner || liveArmy.faction)) return 'state';
      return row.side ? row.side : 'state';
    }

    var html = '<div class="tr-section battle"><div class="tr-section-hdr"><span class="lab">' + (battles.length > 0 ? '战 况' : '兵 备') + '</span><span class="meta">' + (battles.length > 0 ? '本回合兵戈之事' : '诸军整备实况') + '</span></div>';
    battles.forEach(function(b) {
      var atkTotal = b.attackerSoldiers || 1;
      var defTotal = b.defenderSoldiers || 1;
      var maxSoldiers = Math.max(atkTotal, defTotal);
      var atkPct = Math.round(atkTotal / maxSoldiers * 100);
      var defPct = Math.round(defTotal / maxSoldiers * 100);
      var atkLossPct = Math.round((b.attackerLoss || 0) / Math.max(atkTotal, 1) * 100);
      var defLossPct = Math.round((b.defenderLoss || 0) / Math.max(defTotal, 1) * 100);
      var verdictColor = 'var(--gold-400)';
      var verdictGlyph = '战';
      if (b.verdict === '大胜') { verdictColor = 'var(--celadon-400)'; verdictGlyph = '捷'; }
      else if (b.verdict === '小胜') { verdictColor = 'var(--celadon-400)'; verdictGlyph = '胜'; }
      else if (b.verdict === '败北') { verdictColor = 'var(--vermillion-400)'; verdictGlyph = '败'; }
      else if (b.verdict === '僵持') { verdictColor = 'var(--amber-400,#f59e0b)'; verdictGlyph = '持'; }

      html += '<div class="battle-card">';
      html += '<div class="battle-header"><span class="battle-side atk">' + escHtml(b.attacker || '') + '</span>';
      html += '<span class="battle-verdict" style="color:' + verdictColor + ';">' + _sjcGlyph(verdictGlyph) + ' ' + escHtml(b.verdict || '') + '</span>';
      html += '<span class="battle-side def">' + escHtml(b.defender || '') + '</span></div>';
      html += '<div class="battle-bars">';
      html += '<div class="battle-bar-row"><span class="bar-label">攻</span>';
      html += '<div class="bar-track"><div class="bar-fill atk" style="width:' + atkPct + '%;"><div class="bar-loss" style="width:' + atkLossPct + '%;"></div></div></div>';
      html += '<span class="bar-num">' + (atkTotal >= 10000 ? Math.round(atkTotal / 10000) + '万' : atkTotal) + '</span></div>';
      html += '<div class="battle-bar-row"><span class="bar-label">守</span>';
      html += '<div class="bar-track"><div class="bar-fill def" style="width:' + defPct + '%;"><div class="bar-loss" style="width:' + defLossPct + '%;"></div></div></div>';
      html += '<span class="bar-num">' + (defTotal >= 10000 ? Math.round(defTotal / 10000) + '万' : defTotal) + '</span></div>';
      html += '</div>';
      html += '<div class="battle-casualties">';
      html += '<span>攻方损失 <b style="color:var(--vermillion-400);">' + (b.attackerLoss || 0).toLocaleString() + '</b></span>';
      html += '<span>守方损失 <b style="color:var(--vermillion-400);">' + (b.defenderLoss || 0).toLocaleString() + '</b></span>';
      html += '</div>';
      var extras = [];
      if (b.terrain) extras.push(escHtml(b.terrain));
      if (b.season) extras.push(escHtml(b.season));
      if (b.fortLevel > 0) extras.push('城防Lv' + b.fortLevel);
      if (extras.length > 0) {
        html += '<div class="battle-meta">' + extras.join(' · ') + '</div>';
      }
      // affectedArmies 详情表（smoke 契约结构：details>summary「N 军卷入」+table）
      if (Array.isArray(b.affectedArmies) && b.affectedArmies.length > 0) {
        html += '<details class="sjc-battle-detail">';
        html += '<summary>详情·' + b.affectedArmies.length + ' 军卷入·按命运/归因展开</summary>';
        html += '<table class="sjc-battle-table">';
        html += '<tr>';
        ['军', '命运', '损失', '归因', '主将'].forEach(function(h) {
          html += '<th>' + h + '</th>';
        });
        html += '</tr>';
        b.affectedArmies.forEach(function(army) {
          army = army || {};
          var liveArmy = _battleFindArmy(army);
          var armyName = _battleText(army.name || army.army || army.armyName || army.label) ||
                         _battleText(liveArmy && (liveArmy.name || liveArmy.army || liveArmy.armyName || liveArmy.label)) ||
                         _battleArmyName(army) || _battleArmyName(liveArmy) || '未识别军队';
          var commanderName = _battleText(army.commander || (army.commanderFate && army.commanderFate.name)) || _battleArmyCommander(liveArmy);
          var fate = _battleInferFate(army, liveArmy, b);
          var fateColor = fate.indexOf('溃灭') >= 0 ? 'var(--vermillion-500,#dc2626)' :
                          fate.indexOf('溃') >= 0 ? 'var(--vermillion-400,#ef4444)' :
                          fate.indexOf('伤') >= 0 ? 'var(--amber-400,#f59e0b)' :
                          fate.indexOf('保') >= 0 || fate.indexOf('胜') >= 0 ? 'var(--celadon-400,#84cc16)' :
                          'var(--color-foreground,#fff)';
          var attrMap = { commander: '主将', leader: '统帅', local: '地方', throne: '御营', banner: '旗下', state: '国家' };
          var attribution = _battleAttribution(army, liveArmy);
          var attrLabel = attrMap[attribution] || _battleSideLabel(attribution) || attribution || '战况';
          var attrCls = attribution === 'commander' ? 'cmd' :
                        attribution === 'leader' ? 'ldr' :
                        attribution === 'local' ? 'loc' :
                        attribution === 'throne' ? 'thr' :
                        attribution === 'banner' ? 'ban' :
                        attribution === 'state' ? 'sta' : 'etc';
          var casualty = army.casualties != null ? army.casualties : (army.loss != null ? army.loss : (army.soldiersLost || 0));
          html += '<tr>';
          html += '<td>' + escHtml(armyName) + '</td>';
          html += '<td style="color:' + fateColor + ';">' + escHtml(fate || '在阵') + '</td>';
          html += '<td>' + ((Number(casualty) || 0).toLocaleString()) + '</td>';
          html += '<td><span class="sjc-attr-tag ' + attrCls + '">' + escHtml(attrLabel) + '</span></td>';
          html += '<td class="dim">' + escHtml(commanderName || '') + '</td>';
          html += '</tr>';
        });
        html += '</table></details>';
      }
      html += '</div>';
    });

    // 多回合战争时间轴
    if (GM.activeWars && GM.activeWars.length > 0) {
      var recentBattles = (GM.battleHistory || []).slice(-20);
      GM.activeWars.forEach(function(war) {
        var warBattles = recentBattles.filter(function(b) {
          return (b.attackerFaction === war.attacker && b.defenderFaction === war.defender) ||
                 (b.attackerFaction === war.defender && b.defenderFaction === war.attacker);
        });
        if (warBattles.length > 1) {
          html += '<div class="battle-timeline"><div class="battle-timeline-title">' + escHtml(war.attacker || '') + ' vs ' + escHtml(war.defender || '') + ' 战役时间线</div>';
          html += '<div class="battle-timeline-track">';
          warBattles.forEach(function(wb) {
            var dot = wb.verdict === '大胜' || wb.verdict === '小胜' ? 'win' : wb.verdict === '败北' ? 'lose' : 'draw';
            html += '<div class="timeline-dot ' + dot + '" title="T' + wb.turn + ' ' + escHtml(wb.verdict || '') + '"></div>';
          });
          html += '</div></div>';
        }
      });
    }

    // 诸军总览（原「militarySystems 总览」·开发腔退役）·风险高的排前
    if (hasArmies) {
      html += '<details class="sjc-army-roster">';
      html += '<summary>诸军总览·' + GM.armies.length + ' 军·风险监控</summary>';
      html += '<table class="sjc-battle-table">';
      html += '<tr>';
      ['军', '势力', '统帅', '驻地', '士气', '补给', '欠饷', '兵变险', '状态'].forEach(function(h) {
        html += '<th>' + h + '</th>';
      });
      html += '</tr>';
      var sortedArmies = GM.armies.slice().sort(function(a, b) {
        var rA = (a.mutinyRisk || 0) + (a.payArrearsMonths || 0) * 10 + Math.max(0, 50 - (a.morale || 100)) + Math.max(0, 50 - (a.supply || 100));
        var rB = (b.mutinyRisk || 0) + (b.payArrearsMonths || 0) * 10 + Math.max(0, 50 - (b.morale || 100)) + Math.max(0, 50 - (b.supply || 100));
        return rB - rA;
      });
      sortedArmies.forEach(function(a) {
        var moraleColor = (a.morale || 100) < 30 ? 'var(--vermillion-400,#ef4444)' : (a.morale || 100) < 60 ? 'var(--amber-400,#f59e0b)' : 'var(--celadon-400,#84cc16)';
        var supplyColor = (a.supply || 100) < 30 ? 'var(--vermillion-400,#ef4444)' : (a.supply || 100) < 60 ? 'var(--amber-400,#f59e0b)' : 'var(--celadon-400,#84cc16)';
        var arrearColor = (a.payArrearsMonths || 0) >= 3 ? 'var(--vermillion-400,#ef4444)' : (a.payArrearsMonths || 0) >= 1 ? 'var(--amber-400,#f59e0b)' : 'var(--color-foreground,#fff)';
        var mutinyColor = (a.mutinyRisk || 0) >= 60 ? 'var(--vermillion-500,#dc2626)' : (a.mutinyRisk || 0) >= 30 ? 'var(--amber-400,#f59e0b)' : 'var(--color-foreground,#fff)';
        var stateText = a.state === 'marching' ? '行军中' : a.state === 'sieging' ? '围城中' : a.state === 'garrison' ? '驻守' : (a.state || '驻守');
        // 行军可视化：marching 军队附真进度（取 GM.marchOrders·与朝野内情抽屉一致）
        if (a.state === 'marching' && GM.marchOrders && GM.marchOrders.length) {
          var mo = GM.marchOrders.find(function(o) { return o && o.status === 'marching' && (o.armyId === a.id || o.armyName === (a.name || '')); });
          if (mo) { var mt = mo.totalTurns || 0, mp = mo.progress || 0; stateText = '行军中 ' + mp + '/' + mt + '回合·余' + Math.max(0, mt - mp); }
        }
        html += '<tr>';
        html += '<td>' + escHtml(a.name || '?') + '</td>';
        html += '<td class="dim">' + escHtml(a.faction || a.owner || '未挂旗') + '</td>';
        html += '<td>' + escHtml(a.commander || '') + '</td>';
        html += '<td class="dim">' + escHtml(a.location || '') + (a.state === 'marching' && a.destination ? '→' + escHtml(a.destination) : '') + '</td>';
        html += '<td style="color:' + moraleColor + ';">' + (a.morale || 0) + '</td>';
        html += '<td style="color:' + supplyColor + ';">' + (a.supply || 0) + '</td>';
        html += '<td style="color:' + arrearColor + ';">' + (a.payArrearsMonths || 0) + '月</td>';
        html += '<td style="color:' + mutinyColor + ';font-weight:' + ((a.mutinyRisk || 0) >= 60 ? 'bold' : 'normal') + ';">' + (a.mutinyRisk || 0) + '</td>';
        html += '<td class="dim">' + escHtml(stateText) + '</td>';
        html += '</tr>';
      });
      html += '</table>';
      var highRisk = sortedArmies.filter(function(a) { return (a.mutinyRisk || 0) >= 60 || (a.payArrearsMonths || 0) >= 3; });
      if (highRisk.length > 0) {
        html += '<div class="sjc-army-warn">' + _sjcGlyph('警') + ' 高危·' + highRisk.length + ' 军·兵变险≥6成或欠饷≥3月·需及时处置</div>';
      }
      html += '</details>';
    }

    html += '</div>';
    return html;
  }

  // ───────────────────────── §4 数值板块 ─────────────────────────
  // 原 _renderUnifiedChanges 搬运翻新：旧① 本回合要点挪总览卷·②-⑩ 保留·岁计流水（原「财务报表」）并入卷末。
  function _sjcAttr(v) {
    return escHtml(v).replace(/"/g, '&quot;');
  }
  function _sjcReasonTags(text) {
    var raw = String(text || '');
    var lower = raw.toLowerCase();
    var tags = [];
    var seen = {};
    var dict = {
      tax: '税压', taxes: '税压', levy: '征发', corvee: '徭役',
      military: '军务', army: '军务', keju: '科举',
      commerce: '商贸', trade: '商贸', land: '土地',
      office: '官制', offices: '官制', hukou: '户口', census: '清册核籍',
      peasant: '民负', burden: '民负', fiscal: '财政', finance: '财政',
      corruption: '腐败', corrupt: '腐败', local: '地方', morale: '军心',
      arrears: '欠饷', approved: '议准', rejected: '驳回', deferred: '缓议',
      changed: '改动', blocked: '阻滞', relief: '赈济', famine: '灾荒',
      disaster: '灾害', minxin: '民心', public: '民心', party: '党争', class: '阶层'
    };
    function add(label) {
      if (!label || seen[label]) return;
      seen[label] = true;
      tags.push(label);
    }
    if (/military\s+arrears/.test(lower)) add('军饷拖欠');
    raw.split(/[\/,\s;|:_-]+/).forEach(function(token) {
      var key = String(token || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (dict[key]) add(dict[key]);
    });
    return tags;
  }
  function _sjcReasonFromTags(prefix, tail) {
    var tags = _sjcReasonTags(tail);
    return prefix + (tags.length ? '：' + tags.join('、') : '');
  }
  function _sjcLocalizeReason(reason) {
    var raw = String(reason || '').trim();
    if (!raw) return '';
    var lower = raw.toLowerCase();
    if (/ecology\s+matched/.test(lower)) {
      return _sjcReasonFromTags('制度生态匹配', raw.replace(/.*ecology\s+matched\s*/i, ''));
    }
    if (/ai\s+turn\s+result/.test(lower)) {
      return _sjcReasonFromTags('AI推演结果', raw.replace(/.*ai\s+turn\s+result\s*/i, ''));
    }
    if (/huji[-_\s]*governance[-_\s]*backlash|governance[-_\s]*backlash/.test(lower)) {
      return '户口治理反噬';
    }
    if (/court\s+feedback/.test(lower)) {
      return _sjcReasonFromTags('廷议裁定', raw.replace(/.*court\s+feedback\s*/i, ''));
    }
    if (/social[-_\s]*political[-_\s]*signal/.test(lower)) {
      return _sjcReasonFromTags('社会政治信号', raw.replace(/.*social[-_\s]*political[-_\s]*signal\s*/i, ''));
    }
    if (/player[-_\s]*action/.test(lower)) {
      return _sjcReasonFromTags('玩家操作影响', raw.replace(/.*player[-_\s]*action\s*/i, ''));
    }
    var tags = /[a-z]/i.test(raw) ? _sjcReasonTags(raw) : [];
    if (tags.length) return tags.join('、');
    return raw;
  }
  function _sjcGroupChangeItems(items) {
    var groups = [];
    var byName = {};
    (items || []).forEach(function(it) {
      var name = it.name || '未命名';
      var g = byName[name];
      if (!g) {
        g = byName[name] = { name: name, items: [], reasons: [], reasonSeen: {} };
        groups.push(g);
      }
      g.items.push(it);
      if (it.reason && !g.reasonSeen[it.reason]) {
        g.reasonSeen[it.reason] = true;
        g.reasons.push(it.reason);
      }
    });
    return groups;
  }
  function _sjcRenderActorChangeGroup(opts) {
    var groups = _sjcGroupChangeItems(opts.items);
    var total = opts.items.length;
    var out = '';
    if (!groups.length) return out;
    out += '<div class="tr-cg-block ' + opts.cls + '">';
    out += '<div class="tr-cg-hdr"><div class="ic">' + opts.ic + '</div><div class="lab">' + opts.label + '</div>';
    if (opts.sub) out += '<div class="sub">' + opts.sub + '</div>';
    out += '<div class="count">' + groups.length + ' 组 / ' + total + ' 项</div></div>';
    out += '<div class="tr-cg-group-tools">';
    out += '<button type="button" class="tr-cg-group-btn" data-action="turn-change-expand-all" onclick="this.closest(\'.tr-cg-block\').querySelectorAll(\'.tr-cg-fold-group\').forEach(function(el){el.open=true;});">展开全部</button>';
    out += '<button type="button" class="tr-cg-group-btn" data-action="turn-change-collapse-all" onclick="this.closest(\'.tr-cg-block\').querySelectorAll(\'.tr-cg-fold-group\').forEach(function(el){el.open=false;});">收起全部</button>';
    out += '</div>';
    out += '<div class="tr-cg-items tr-cg-fold-items">';
    groups.forEach(function(g) {
      var key = opts.kind + ':' + g.name;
      var reasonSummary = g.reasons.slice(0, 2).join('；');
      if (g.reasons.length > 2) reasonSummary += '；等 ' + g.reasons.length + ' 条近因';
      var openAttr = g.items.length <= 2 ? ' open' : '';
      out += '<details class="tr-cg-fold-group" data-change-group="' + _sjcAttr(key) + '" data-change-group-name="' + _sjcAttr(g.name) + '"' + openAttr + '>';
      out += '<summary class="tr-cg-fold-summary"><span class="tr-cg-fold-name">' + escHtml(g.name) + '</span><span class="tr-cg-fold-count">' + g.items.length + ' 项变化</span>';
      if (reasonSummary) out += '<span class="tr-cg-fold-reason">' + escHtml(reasonSummary) + '</span>';
      out += '</summary>';
      out += '<div class="tr-cg-fold-body">';
      g.items.forEach(function(it) {
        var d = (it.nv || 0) - (it.ov || 0);
        var cls = d < -5 ? ' warn' : '';
        out += '<div class="tr-cg-item' + cls + '">';
        out += '<div class="tr-cg-name"><span class="mini-ic">' + opts.itemIc + '</span>' + escHtml(it.field) + '</div>';
        out += '<div class="tr-cg-vals">' + _sjcValHtml(it.ov, it.nv, function(v) { return Math.round(v || 0).toString(); }, '') + '</div>';
        out += '<div class="tr-cg-reasons">' + (it.reason ? '<span class="tr-reason-txt">' + escHtml(it.reason) + '</span>' : '') + '</div>';
        out += '</div>';
      });
      out += '</div></details>';
    });
    out += '</div></div>';
    return out;
  }
  // 从 _turnReport 过滤并生成 fiscal_adj reason chips（年例/停支/拒付/亏空四态承旧版）
  function _sjcCollectFiscalAdjChips(target, resource) {
    var out = [];
    var rep = GM._turnReport || [];
    rep.forEach(function(r) {
      if (!r || r.type !== 'fiscal_adj') return;
      if (r.target !== target) return;
      if ((r.resource || 'money') !== resource) return;
      var signCls = r.kind === 'income' ? 'pos' : 'neg';
      var signChar = r.kind === 'income' ? '+' : '−';
      var label = escHtml(r.name || r.reason || (r.kind === 'income' ? '入库' : '支用')).slice(0, 16);
      var tip = escHtml((r.reason || '') + (r.name ? '·' + r.name : '')).slice(0, 80);
      var short = r.shortfall || 0;
      var status = r.executionStatus || '';
      var annual = Number(r.annualAmount || 0);
      if ((status === 'scheduled' || status === 'updated' || r.recurring) && annual > 0) {
        // 新设年例当回合不拨余额(actualApplied=0)·标「下回合起」免玩家误以为本回合已入/出库
        var annualTip = escHtml((r.reason || '') + (r.name ? '·' + r.name : '') + '·年例 ' + annual).slice(0, 100);
        var annualWord = status === 'updated' ? '改年例' : (status === 'scheduled' ? '年例·下回合起' : '年例');
        out.push('<span class="tr-reason-chip ' + signCls + '" title="' + annualTip + '">' + annualWord + '·' + label + '<span class="v">' + signChar + _sjcFmtBig(annual) + '/年</span></span>');
      } else if (status === 'stopped' || status === 'removed') {
        var stopTip = escHtml((r.reason || '') + (r.name ? '·' + r.name : '') + (annual ? '·原年例 ' + annual : '')).slice(0, 100);
        out.push('<span class="tr-reason-chip stop" title="' + stopTip + '">停年例·' + label + (annual ? '<span class="v">' + _sjcFmtBig(annual) + '/年</span>' : '') + '</span>');
      } else if (status === 'blocked') {
        // 完全拒付：红底
        var tipBlk = '库空为零·诏不得行·请 ' + (r.requested || 0) + ' 一文未拨' + (r.reason ? '【' + r.reason + '】' : '');
        out.push('<span class="tr-reason-chip blocked" title="' + escHtml(tipBlk) + '">拒·' + label + '<span class="v">请' + _sjcFmtBig(r.requested || 0) + '·未拨</span></span>');
      } else if (short > 0) {
        // 部分执行：橙框+亏欠标记
        var reqTxt = r.requested ? ('/请' + _sjcFmtBig(r.requested)) : '';
        var tipShort = '请 ' + (r.requested || 0) + '·仅拨 ' + (r.amount || 0) + '·亏空 ' + short + (r.reason ? '【' + r.reason + '】' : '');
        out.push('<span class="tr-reason-chip shortfall" title="' + escHtml(tipShort) + '">' + label + reqTxt + '<span class="v">' + signChar + _sjcFmtBig(r.amount || 0) + '</span><span class="short">亏' + _sjcFmtBig(short) + '</span></span>');
      } else {
        out.push('<span class="tr-reason-chip ' + signCls + '" title="' + tip + '">' + label + '<span class="v">' + signChar + _sjcFmtBig(r.amount || 0) + '</span></span>');
      }
    });
    return out;
  }

  // 与国库面板共用只读报表，旧存档的概算标量不得覆盖已交割流水。
  function _sjcReadFiscal(account) {
    account = account || {};
    var opts = { game: GM, account: account, scope: 'central' };
    if (global.FiscalEngine && typeof global.FiscalEngine.readAccountStatement === 'function') return global.FiscalEngine.readAccountStatement(opts);
    if (global.FiscalStatement && typeof global.FiscalStatement.read === 'function') return global.FiscalStatement.read(opts);
    // 兼容未装载报表模块的旧入口：有账本时零值有效，缺项待核，只在无账本时保留旧概算。
    var view = Object.assign({}, account), ledgers = account.ledgers || {};
    var hasLedger = Object.keys(ledgers).length > 0;
    var days = Number((account.accounting || account.period || {}).days) || Number(account.turnDays) || 30;
    if (hasLedger) ['money', 'grain', 'cloth'].forEach(function(r) {
      var led = ledgers[r] || {}, suffix = r === 'money' ? '' : r.charAt(0).toUpperCase() + r.slice(1);
      if (typeof led.stock === 'number' && isFinite(led.stock)) { view[r] = led.stock; if (r === 'money') view.balance = led.stock; }
      [['thisTurnIn', 'Income'], ['thisTurnOut', 'Expense']].forEach(function(pair) {
        var value = led[pair[0]];
        value = typeof value === 'number' && isFinite(value) ? value : null;
        view['turn' + suffix + pair[1]] = value;
        view['monthly' + suffix + pair[1]] = value === null ? null : value * 30 / days;
      });
    });
    view.turnDays = days;
    return { account: view, forecast: !hasLedger, unit: account.unit };
  }

  /** 数值卷正文（帑廪/内帑/户口/政治核心/军事/势力/党派/阶层/人物 + 岁计流水） */
  function _sjcUnifiedChanges(oldVars) {
    oldVars = oldVars || {};
    var html = '';

    // ═══ 帑廪·中央国库 ═══
    var turnIn = 0, turnOut = 0;
    if (GM.guoku) {
      var og = _sjcReadFiscal(GM._prevGuoku).account;
      var fiscalView = _sjcReadFiscal(GM.guoku);
      var ng = fiscalView.account;
      var fiscalUnit = fiscalView.unit || ng.unit || {};
      var moneyUnit = fiscalUnit.money || '两';
      var flowLabel = fiscalView.forecast ? '预计' : '本期';
      var gItems = [];
      var fExp = GM._lastFixedExpense || {};
      var sal = fExp.salary && fExp.salary.money || 0;
      var arm = fExp.army && fExp.army.money || 0;
      var imp = fExp.imperial && fExp.imperial.money || 0;
      turnIn = ng.turnIncome;
      turnOut = ng.turnExpense;
      // 对齐顶栏权威取数（治「史记与顶部栏帑廪数值不一致」）：统一走 _barAccountStock·不可用时降级
      var gkS = function(a, r) { return (typeof _barAccountStock === 'function') ? _barAccountStock(a, r) : (a && typeof a[r] === 'number' ? a[r] : (r === 'money' && a && typeof a.balance === 'number' ? a.balance : 0)); };
      var gkHas = function(r) { return !!(ng && (typeof ng[r] === 'number' || (r === 'money' && typeof ng.balance === 'number') || (ng.ledgers && ng.ledgers[r]))); };
      if (gkHas('money')) {
        var moneyReasons = [];
        if (turnIn > 0) moneyReasons.push('<span class="tr-reason-chip pos">' + flowLabel + '收入<span class="v">+' + _sjcFmtBig(turnIn) + '</span></span>');
        if (sal > 0) moneyReasons.push('<span class="tr-reason-chip neg">俸禄<span class="v">−' + _sjcFmtBig(sal) + '</span></span>');
        if (arm > 0) moneyReasons.push('<span class="tr-reason-chip neg">军饷<span class="v">−' + _sjcFmtBig(arm) + '</span></span>');
        if (imp > 0) moneyReasons.push('<span class="tr-reason-chip neg">宫廷<span class="v">−' + _sjcFmtBig(imp) + '</span></span>');
        Array.prototype.push.apply(moneyReasons, _sjcCollectFiscalAdjChips('guoku', 'money'));
        gItems.push({ ic: '钱', name: moneyUnit === '两' ? '银两' : '钱', unit: moneyUnit, ov: gkS(og, 'money'), nv: gkS(ng, 'money'), reasonsHtml: moneyReasons.join('') });
      }
      if (gkHas('grain')) {
        var grainR = [];
        var turnGIn = ng.turnGrainIncome;
        var turnGOut = ng.turnGrainExpense;
        if (turnGIn > 0) grainR.push('<span class="tr-reason-chip pos">漕粮<span class="v">+' + _sjcFmtBig(turnGIn) + '</span></span>');
        if (turnGOut > 0) grainR.push('<span class="tr-reason-chip neg">支用<span class="v">−' + _sjcFmtBig(turnGOut) + '</span></span>');
        Array.prototype.push.apply(grainR, _sjcCollectFiscalAdjChips('guoku', 'grain'));
        gItems.push({ ic: '粮', name: '粮米', unit: fiscalUnit.grain || '石', ov: gkS(og, 'grain'), nv: gkS(ng, 'grain'), reasonsHtml: grainR.join('') });
      }
      if (gkHas('cloth')) {
        var clothR = _sjcCollectFiscalAdjChips('guoku', 'cloth');
        if (clothR.length === 0) clothR.push('<span class="tr-reason-txt">织染上解·赏赐扣减</span>');
        gItems.push({ ic: '布', name: '布匹', unit: fiscalUnit.cloth || '匹', ov: gkS(og, 'cloth'), nv: gkS(ng, 'cloth'), reasonsHtml: clothR.join('') });
      }
      if (typeof ng.monthlyIncome === 'number') {
        gItems.push({ ic: '月', name: '月入', sub: moneyUnit + '/月', ov: og.monthlyIncome, nv: ng.monthlyIncome, reasonsHtml: '<span class="tr-reason-txt">' + (fiscalView.forecast ? '预计收入' : '本期实收') + '折合月额</span>' });
      }
      if (gItems.length > 0) {
        html += '<div class="tr-cg-block tr-cg-guoku">';
        var netTxt = '';
        if (gkHas('money')) {
          var knownIn = typeof turnIn === 'number' && isFinite(turnIn), knownOut = typeof turnOut === 'number' && isFinite(turnOut);
          netTxt = flowLabel + '收入 ' + (knownIn ? _sjcFmtBig(turnIn) + moneyUnit : '待核') + ' / ' + flowLabel + '支出 ' + (knownOut ? _sjcFmtBig(turnOut) + moneyUnit : '待核');
          if (knownIn && knownOut) {
            var net = turnIn - turnOut;
            netTxt += (net >= 0 ? ' · 结余 ' : ' · 亏空 ') + _sjcFmtBig(Math.abs(net)) + moneyUnit;
          } else netTxt += ' · 结余待核';
          if (ng.turnDays > 0) netTxt += ' · ' + ng.turnDays + '日';
        }
        // 赤字警告条
        var gDefLines = [];
        ['money', 'grain', 'cloth'].forEach(function(r) {
          var v = Number(ng[r]);
          if (typeof v === 'number' && v < 0) {
            var rl = r === 'money' ? '银' : r === 'grain' ? '粮' : '布';
            gDefLines.push(rl + ' ' + _sjcFmtBig(v));
          }
        });
        if (gDefLines.length > 0) {
          var streak = GM._fiscalDeficitStreak || 1;
          html += '<div class="tr-cg-hdr sjc-deficit"><div class="ic">亏</div><div class="lab">帑空在库！持续 ' + streak + ' 回合</div><div class="sub">' + gDefLines.join(' · ') + '</div></div>';
        }
        html += '<div class="tr-cg-hdr"><div class="ic">帑</div><div class="lab">帑 廪 · 中 央 国 库</div>';
        if (netTxt) html += '<div class="sub">' + escHtml(netTxt) + '</div>';
        html += '<div class="count">' + gItems.length + ' 项</div></div>';
        html += '<div class="tr-cg-items">';
        gItems.forEach(function(it) {
          html += '<div class="tr-cg-item">';
          html += '<div class="tr-cg-name"><span class="mini-ic">' + it.ic + '</span>' + escHtml(it.name) + ' <span class="sub-lbl">' + escHtml(it.sub || it.unit || '') + '</span></div>';
          html += '<div class="tr-cg-vals">' + _sjcValHtml(it.ov, it.nv, _sjcFmtBig, '') + '</div>';
          html += '<div class="tr-cg-reasons">' + (it.reasonsHtml || '') + '</div>';
          html += '</div>';
        });
        html += '</div></div>';
      }
    }

    // ═══ 内帑·皇家私库 ═══
    if (GM.neitang) {
      var on = GM._prevNeitang || {};
      var nn = GM.neitang;
      var nItems = [];
      var ntS = function(a, r) { return (typeof _barAccountStock === 'function') ? _barAccountStock(a, r) : (a && typeof a[r] === 'number' ? a[r] : (r === 'money' && a && typeof a.balance === 'number' ? a.balance : 0)); };
      var ntHas = function(r) { return !!(nn && (typeof nn[r] === 'number' || (r === 'money' && typeof nn.balance === 'number') || (nn.ledgers && nn.ledgers[r]))); };
      if (ntHas('money')) {
        var nMoneyR = _sjcCollectFiscalAdjChips('neitang', 'money');
        if (nMoneyR.length === 0) nMoneyR.push('<span class="tr-reason-txt">内廷收支·徒御赏赐</span>');
        nItems.push({ ic: '钱', name: '银两', unit: '两', ov: ntS(on, 'money'), nv: ntS(nn, 'money'), reasonsHtml: nMoneyR.join('') });
      }
      if (ntHas('grain')) {
        var nGrainR = _sjcCollectFiscalAdjChips('neitang', 'grain');
        if (nGrainR.length === 0) nGrainR.push('<span class="tr-reason-txt">御膳·宫用消耗</span>');
        nItems.push({ ic: '粮', name: '粮米', unit: '石', ov: ntS(on, 'grain'), nv: ntS(nn, 'grain'), reasonsHtml: nGrainR.join('') });
      }
      if (ntHas('cloth')) {
        var nClothR = _sjcCollectFiscalAdjChips('neitang', 'cloth');
        if (nClothR.length === 0) nClothR.push('<span class="tr-reason-txt">宫中赐贡</span>');
        nItems.push({ ic: '布', name: '布匹', unit: '匹', ov: ntS(on, 'cloth'), nv: ntS(nn, 'cloth'), reasonsHtml: nClothR.join('') });
      }
      if (typeof nn.huangzhuangAcres === 'number') nItems.push({ ic: '庄', name: '皇庄', unit: '亩', ov: on.huangzhuangAcres, nv: nn.huangzhuangAcres, reasonsHtml: '<span class="tr-reason-txt">今岁新辟/失管</span>' });
      if (nItems.length > 0) {
        html += '<div class="tr-cg-block tr-cg-neitang">';
        var nDefLines = [];
        ['money', 'grain', 'cloth'].forEach(function(r) {
          var v = Number(nn[r]);
          if (typeof v === 'number' && v < 0) {
            var rl = r === 'money' ? '银' : r === 'grain' ? '粮' : '布';
            nDefLines.push(rl + ' ' + _sjcFmtBig(v));
          }
        });
        if (nDefLines.length > 0) {
          html += '<div class="tr-cg-hdr sjc-deficit"><div class="ic">亏</div><div class="lab">内帑亏空</div><div class="sub">' + nDefLines.join(' · ') + '</div></div>';
        }
        html += '<div class="tr-cg-hdr"><div class="ic">内</div><div class="lab">内 帑 · 皇 家 私 库</div>';
        html += '<div class="sub">天子私帑·与外帑分立</div>';
        html += '<div class="count">' + nItems.length + ' 项</div></div>';
        html += '<div class="tr-cg-items">';
        nItems.forEach(function(it) {
          html += '<div class="tr-cg-item">';
          html += '<div class="tr-cg-name"><span class="mini-ic">' + it.ic + '</span>' + escHtml(it.name) + ' <span class="sub-lbl">' + escHtml(it.unit || '') + '</span></div>';
          html += '<div class="tr-cg-vals">' + _sjcValHtml(it.ov, it.nv, _sjcFmtBig, '') + '</div>';
          html += '<div class="tr-cg-reasons">' + (it.reasonsHtml || '') + '</div>';
          html += '</div>';
        });
        html += '</div></div>';
      }
    }

    // ═══ 户口·丁籍 ═══
    if (GM.population && GM.population.national) {
      var op = (GM._prevPopulation && GM._prevPopulation.national) || {};
      var opAll = GM._prevPopulation || {};
      var np = GM.population.national;
      var npAll = GM.population;
      var pItems = [];
      if (typeof np.households === 'number') pItems.push({ ic: '户', name: '户 数', sub: '在籍', ov: op.households, nv: np.households, reasonsHtml: '<span class="tr-reason-txt">新册·逃户·新分户</span>' });
      if (typeof np.mouths === 'number') pItems.push({ ic: '口', name: '口 数', sub: '在籍', ov: op.mouths, nv: np.mouths, reasonsHtml: _sjcPopReasonHtml(['death'], '新生·死亡·逃散') });
      if (typeof np.ding === 'number') pItems.push({ ic: '丁', name: '丁 口', sub: '可征役', ov: op.ding, nv: np.ding, reasonsHtml: _sjcPopReasonHtml(['death'], '抽丁·耕迁·伤亡耗损') });
      if (typeof npAll.fugitives === 'number') {
        var fCls = (npAll.fugitives > (opAll.fugitives || 0)) ? 'danger' : '';
        pItems.push({ ic: '逃', name: '逃 户', sub: '失籍', ov: opAll.fugitives, nv: npAll.fugitives, cls: fCls, reasonsHtml: _sjcPopReasonHtml(['flee'], '赋役、灾荒、兼并所迫') });
      }
      if (typeof npAll.hiddenCount === 'number') pItems.push({ ic: '隐', name: '隐 户', sub: '豪绅荫庇', ov: opAll.hiddenCount, nv: npAll.hiddenCount, cls: 'warn', reasonsHtml: '<span class="tr-reason-txt">地方豪绅隐匿佃户躲丁差</span>' });
      if (pItems.length > 0) {
        html += '<div class="tr-cg-block tr-cg-hukou">';
        html += '<div class="tr-cg-hdr"><div class="ic">户</div><div class="lab">户 口 · 丁 籍</div>';
        html += '<div class="sub">户部黄册·地方遇报</div>';
        html += '<div class="count">' + pItems.length + ' 项</div></div>';
        html += '<div class="tr-cg-items">';
        pItems.forEach(function(it) {
          html += '<div class="tr-cg-item' + (it.cls ? ' ' + it.cls : '') + '">';
          html += '<div class="tr-cg-name"><span class="mini-ic">' + it.ic + '</span>' + escHtml(it.name) + ' <span class="sub-lbl">' + escHtml(it.sub || '') + '</span></div>';
          html += '<div class="tr-cg-vals">' + _sjcValHtml(it.ov, it.nv, _sjcFmtBig, '') + '</div>';
          html += '<div class="tr-cg-reasons">' + (it.reasonsHtml || '') + '</div>';
          html += '</div>';
        });
        html += '</div></div>';
      }
    }

    // ═══ 政治核心（七大变量/vars）═══
    var politicItems = [];
    if (GM.turnChanges && GM.turnChanges.variables) {
      GM.turnChanges.variables.forEach(function(vc) {
        var ov = Math.round(vc.oldValue || 0), nv = Math.round(vc.newValue || 0);
        if (ov === nv) return;
        var name = vc.name || '';
        if (/国库|内帜|财产/.test(name)) return;
        var iconMap = { '皇权': '权', '皇威': '威', '民心': '心', '君臣': '君', '党争': '党', '关外交': '外', '大军': '兵', '吏治': '吏', '腐败': '腐', '税收率': '税', '名望': '名', '贤能': '贤' };
        var ic = iconMap[name] || (name.charAt(0));
        politicItems.push({ ic: ic, name: name, ov: ov, nv: nv, reasons: vc.reasons || [] });
      });
    }
    if (typeof CORE_METRIC_LABELS === 'object') {
      Object.keys(CORE_METRIC_LABELS).forEach(function(k) {
        if (typeof GM[k] !== 'number') return;
        var nv = Math.round(GM[k]);
        var prevKey = '_prev_' + k;
        var ov = Math.round(GM[prevKey] !== undefined ? GM[prevKey] : nv);
        if (nv === ov) return;
        var label = CORE_METRIC_LABELS[k] || k;
        if (/国库|内帜/.test(label)) return;
        politicItems.push({ ic: label.charAt(0), name: label, ov: ov, nv: nv, reasons: _sjcCoreMetricReasons(k, label) });
      });
    }
    if (politicItems.length > 0) {
      html += '<div class="tr-cg-block tr-cg-politic">';
      html += '<div class="tr-cg-hdr"><div class="ic">政</div><div class="lab">政 治 核 心</div>';
      html += '<div class="sub">核心变量·君心所系</div>';
      html += '<div class="count">' + politicItems.length + ' 项</div></div>';
      html += '<div class="tr-cg-items">';
      politicItems.forEach(function(it) {
        var deltaD = it.nv - it.ov;
        var itCls = deltaD < -3 ? ' warn' : '';
        html += '<div class="tr-cg-item' + itCls + '">';
        html += '<div class="tr-cg-name"><span class="mini-ic">' + it.ic + '</span>' + escHtml(it.name) + '</div>';
        html += '<div class="tr-cg-vals">' + _sjcValHtml(it.ov, it.nv, function(v) { return Math.round(v || 0).toString(); }, '') + '</div>';
        html += '<div class="tr-cg-reasons">' + _sjcReasonChips(it.reasons) + '</div>';
        html += '</div>';
      });
      html += '</div></div>';
    }

    // ═══ 军事·军队动态 ═══
    if (GM.turnChanges && GM.turnChanges.military && GM.turnChanges.military.length > 0) {
      var mItems = [];
      GM.turnChanges.military.forEach(function(mc) {
        (mc.changes || []).forEach(function(ch) {
          var fMap = { 'soldiers': '兵力', 'morale': '士气', 'training': '训练', 'supply': '补给' };
          var fN = fMap[ch.field] || ch.field;
          var icMap = { 'soldiers': '兵', 'morale': '士', 'training': '训', 'supply': '补' };
          mItems.push({ name: mc.name, field: fN, ic: icMap[ch.field] || '军', ov: ch.oldValue || 0, nv: ch.newValue || 0, reason: ch.reason || '' });
        });
      });
      if (mItems.length > 0) {
        html += '<div class="tr-cg-block tr-cg-military">';
        html += '<div class="tr-cg-hdr"><div class="ic">军</div><div class="lab">军 事 · 军 队 动 态</div>';
        html += '<div class="sub">各军团 兵/士/训/补</div>';
        html += '<div class="count">' + mItems.length + ' 项</div></div>';
        html += '<div class="tr-cg-items">';
        mItems.forEach(function(it) {
          var d = (it.nv || 0) - (it.ov || 0);
          var cls = d < -5 ? ' warn' : (d < -10 ? ' danger' : '');
          html += '<div class="tr-cg-item' + cls + '">';
          html += '<div class="tr-cg-name"><span class="mini-ic">' + it.ic + '</span>' + escHtml(it.name) + ' <span class="sub-lbl">' + escHtml(it.field) + '</span></div>';
          html += '<div class="tr-cg-vals">' + _sjcValHtml(it.ov, it.nv, function(v) { return _sjcFmtBig(v); }, '') + '</div>';
          html += '<div class="tr-cg-reasons">' + (it.reason ? '<span class="tr-reason-txt">' + escHtml(it.reason) + '</span>' : '') + '</div>';
          html += '</div>';
        });
        html += '</div></div>';
      }
    }

    // ═══ 势力 ═══
    if (GM.turnChanges && GM.turnChanges.factions && GM.turnChanges.factions.length > 0) {
      var fItems = [];
      GM.turnChanges.factions.forEach(function(fc) {
        (fc.changes || []).forEach(function(ch) {
          var fMap = { 'strength': '实力', 'economy': '经济', 'playerRelation': '对己关系', 'attitude': '态度' };
          var fN = fMap[ch.field] || ch.field;
          fItems.push({ name: fc.name, field: fN, ov: ch.oldValue || 0, nv: ch.newValue || 0, reason: ch.reason || '' });
        });
      });
      if (fItems.length > 0) {
        html += '<div class="tr-cg-block tr-cg-faction">';
        html += '<div class="tr-cg-hdr"><div class="ic">势</div><div class="lab">天 下 势 力 动 态</div>';
        html += '<div class="count">' + fItems.length + ' 项</div></div>';
        html += '<div class="tr-cg-items">';
        fItems.forEach(function(it) {
          var d = (it.nv || 0) - (it.ov || 0);
          var cls = (it.name && /后金|反军|贼寇|叛军/.test(it.name) && d > 0) ? ' danger' : '';
          html += '<div class="tr-cg-item' + cls + '">';
          html += '<div class="tr-cg-name">' + escHtml(it.name) + ' <span class="sub-lbl">' + escHtml(it.field) + '</span></div>';
          html += '<div class="tr-cg-vals">' + _sjcValHtml(it.ov, it.nv, function(v) { return Math.round(v || 0).toString(); }, '') + '</div>';
          html += '<div class="tr-cg-reasons">' + (it.reason ? '<span class="tr-reason-txt">' + escHtml(it.reason) + '</span>' : '') + '</div>';
          html += '</div>';
        });
        html += '</div></div>';
      }
    }

    // ═══ 党派 ═══
    if (GM.turnChanges && GM.turnChanges.parties && GM.turnChanges.parties.length > 0) {
      var ptyItems = [];
      GM.turnChanges.parties.forEach(function(pc) {
        (pc.changes || []).forEach(function(ch) {
          var fMap = { 'influence': '影响力', 'satisfaction': '满意度', 'cohesion': '凝聚力' };
          // 跳过非数字字段（如 status/new_agenda）·避免 Math.round('活跃') 产生 NaN
          if (!fMap[ch.field] || typeof ch.oldValue !== 'number' || typeof ch.newValue !== 'number') return;
          ptyItems.push({ name: pc.name, field: fMap[ch.field], ov: ch.oldValue || 0, nv: ch.newValue || 0, reason: _sjcLocalizeReason(ch.reason || '') });
        });
      });
      if (ptyItems.length > 0) {
        html += _sjcRenderActorChangeGroup({
          cls: 'tr-cg-party', kind: 'party', ic: '党', itemIc: '党',
          label: '朝 中 党 派', sub: '同党派变化已合并为折叠组', items: ptyItems
        });
      }
    }

    // ═══ 阶层 ═══
    if (GM.turnChanges && GM.turnChanges.classes && GM.turnChanges.classes.length > 0) {
      var clsItems = [];
      GM.turnChanges.classes.forEach(function(cc) {
        (cc.changes || []).forEach(function(ch) {
          var fMap = { 'satisfaction': '满意度', 'influence': '影响力', 'population': '人口' };
          if (!fMap[ch.field] || typeof ch.oldValue !== 'number' || typeof ch.newValue !== 'number') return;
          clsItems.push({ name: cc.name, field: fMap[ch.field], ov: ch.oldValue || 0, nv: ch.newValue || 0, reason: _sjcLocalizeReason(ch.reason || '') });
        });
      });
      if (clsItems.length > 0) {
        html += _sjcRenderActorChangeGroup({
          cls: 'tr-cg-class', kind: 'class', ic: '阶', itemIc: '阶',
          label: '阶 层 动 态', sub: '同阶层变化已合并为折叠组', items: clsItems
        });
      }
    }

    // ═══ 人物 ═══
    if (GM.turnChanges && GM.turnChanges.characters && GM.turnChanges.characters.length > 0) {
      var chItems = [];
      GM.turnChanges.characters.forEach(function(cc) {
        (cc.changes || []).forEach(function(ch) {
          var fMap = { 'loyalty': '忠诚', 'ambition': '野心', 'stress': '压力', 'influence': '影响力', 'strength': '实力' };
          if (!fMap[ch.field]) return;
          chItems.push({ name: cc.name, field: fMap[ch.field], ov: ch.oldValue || 0, nv: ch.newValue || 0, reason: ch.reason || '' });
        });
      });
      if (chItems.length > 0) {
        html += '<div class="tr-cg-block tr-cg-char">';
        html += '<div class="tr-cg-hdr"><div class="ic">人</div><div class="lab">人 物 动 态</div>';
        html += '<div class="sub">核心人臣 · 忠/野/压/影</div>';
        html += '<div class="count">' + chItems.length + ' 项</div></div>';
        html += '<div class="tr-cg-items">';
        chItems.slice(0, 12).forEach(function(it) {
          var d = (it.nv || 0) - (it.ov || 0);
          var isDanger = (it.field === '忠诚' && d < -5) || (it.field === '压力' && d > 10);
          var isWarn = (it.field === '忠诚' && d < 0) || (it.field === '压力' && d > 5);
          var cls = isDanger ? ' danger' : (isWarn ? ' warn' : '');
          html += '<div class="tr-cg-item' + cls + '">';
          html += '<div class="tr-cg-name">' + escHtml(it.name) + ' <span class="sub-lbl">' + escHtml(it.field) + '</span></div>';
          html += '<div class="tr-cg-vals">' + _sjcValHtml(it.ov, it.nv, function(v) { return Math.round(v || 0).toString(); }, '') + '</div>';
          html += '<div class="tr-cg-reasons">' + (it.reason ? '<span class="tr-reason-txt">' + escHtml(it.reason) + '</span>' : '') + '</div>';
          html += '</div>';
        });
        html += '</div></div>';
      }
    }

    // ═══ 岁计流水（原「财务报表」·AccountingSystem 台账并入数值卷末） ═══
    var ledger = (typeof AccountingSystem !== 'undefined' && AccountingSystem.getLedger) ? AccountingSystem.getLedger() : { items: [] };
    if (ledger.items && ledger.items.length > 0) {
      html += '<div class="tr-cg-block tr-cg-ledger">';
      html += '<div class="tr-cg-hdr"><div class="ic">计</div><div class="lab">岁 计 流 水</div>';
      html += '<div class="sub">本回合逐笔收支台账</div>';
      html += '<div class="count">' + ledger.items.length + ' 笔</div></div>';
      var incomeItems = ledger.items.filter(function(item) { return item.type === 'income'; });
      var expenseItems = ledger.items.filter(function(item) { return item.type === 'expense'; });
      if (incomeItems.length > 0) {
        html += '<div class="sjc-ledger-grp"><div class="sjc-ledger-grp-hd pos">收入</div>';
        incomeItems.forEach(function(item) {
          html += '<div class="sjc-ledger-row"><span class="n">' + escHtml(item.name) + '</span><span class="v pos">+' + item.amount.toFixed(1) + '</span></div>';
        });
        html += '<div class="sjc-ledger-row total pos"><span class="n">总收入</span><span class="v">+' + ledger.totalIncome.toFixed(1) + '</span></div></div>';
      }
      if (expenseItems.length > 0) {
        html += '<div class="sjc-ledger-grp"><div class="sjc-ledger-grp-hd neg">支出</div>';
        expenseItems.forEach(function(item) {
          html += '<div class="sjc-ledger-row"><span class="n">' + escHtml(item.name) + '</span><span class="v neg">-' + item.amount.toFixed(1) + '</span></div>';
        });
        html += '<div class="sjc-ledger-row total neg"><span class="n">总支出</span><span class="v">-' + ledger.totalExpense.toFixed(1) + '</span></div></div>';
      }
      html += '<div class="sjc-ledger-net ' + (ledger.netChange >= 0 ? 'pos' : 'neg') + '"><span>净变化</span><span>' + (ledger.netChange >= 0 ? '+' : '') + ledger.netChange.toFixed(1) + '</span></div>';
      html += '</div>';
    }

    if (!html) return '';
    return '<div class="turn-section unified-changes"><h3>数 值 变 化 · 分 类 详 注</h3><div class="tr-changes-wrap">' + html + '</div></div>';
  }

  // ───────────────────────── §5 问责板块 + 一致性附录 ─────────────────────────
  /** 御批回听·对玩家本回合诏令的执行问责（aiEdictEfficacyAudit 生成）——inline style 巨块收进 .sjc-ef-* 结构类 */
  function _sjcEfficacy(report, turn) {
    var html = '';
    try {
      var ef = report || GM._edictEfficacyReport;
      if (ef && ef.turn !== (turn == null ? GM.turn-1 : turn)) return '';
      if (!(ef && !ef.skipped && Array.isArray(ef.reports) && ef.reports.length > 0)) return '';
      var efVal = ef.overallEfficacy || 0;
      var efTone = efVal >= 75 ? 'good' : efVal >= 50 ? 'mid' : 'bad';
      html = '<div class="tr-section sjc-ef"><div class="tr-section-hdr"><span class="lab">御 批 回 听</span><span class="meta">诏令执行问责 · 代理强度 <span class="sjc-ef-overall ' + efTone + '">' + efVal + '%</span>'
        + (ef.efficacyTrend ? ' (' + escHtml(ef.efficacyTrend) + ')' : '')
        + ' · 共 ' + ef.total + ' 条</span></div>';

      // 六维评分·雷达条
      if (ef.efficacyByDimension) {
        var dimLabels = { military: '军事', fiscal: '财政', personnel: '人事', diplomatic: '外交', popular: '民心', authority: '皇权' };
        var dimBars = '';
        Object.keys(dimLabels).forEach(function(k) {
          var v = ef.efficacyByDimension[k];
          if (typeof v !== 'number') return;
          var tone = v >= 70 ? 'good' : v >= 40 ? 'mid' : 'bad';
          dimBars += '<div class="sjc-ef-dim"><span class="n">' + dimLabels[k] + '</span>'
            + '<div class="bar"><div class="fill ' + tone + '" style="width:' + Math.min(100, Math.max(0, v)) + '%;"></div></div>'
            + '<span class="v ' + tone + '">' + v + '</span></div>';
        });
        if (dimBars) html += '<div class="sjc-ef-dims">' + dimBars + '</div>';
      }

      // 每条诏令（状态/执行度/依据/近效/远效/波及/代价/阻力/联动/未落实/缘由/下回合建议——11 字段承旧版）
      ef.reports.forEach(function(r) {
        var stCfg = {
          executed: { lbl: '执 行', cls: 'executed' },
          partial: { lbl: '部 分', cls: 'partial' },
          delayed: { lbl: '延 宕', cls: 'delayed' },
          ignored: { lbl: '忽 略', cls: 'ignored' }
        };
        var s = stCfg[r.status] || { lbl: r.status || '?', cls: 'unknown' };
        html += '<div class="sjc-ef-report ' + s.cls + '">'
          + '<div class="sjc-ef-report-hd"><span class="st">' + s.lbl + '</span><span class="lv">执行度 ' + (r.executionLevel || 0) + '%</span></div>'
          + '<div class="sjc-ef-content">' + escHtml(r.content || '') + '</div>';
        if (r.evidence) html += '<div class="sjc-ef-line dim">依据：' + escHtml(r.evidence) + '</div>';
        if (r.outcomeShortTerm) html += '<div class="sjc-ef-line">近效：' + escHtml(r.outcomeShortTerm) + '</div>';
        if (r.outcomeLongTerm) html += '<div class="sjc-ef-line far">远效：' + escHtml(r.outcomeLongTerm) + '</div>';
        if (Array.isArray(r.affectedEntities) && r.affectedEntities.length) {
          html += '<div class="sjc-ef-line dim">波及：' + r.affectedEntities.slice(0, 6).map(escHtml).join('·') + '</div>';
        }
        if (r.costPaid) html += '<div class="sjc-ef-line cost">代价：' + escHtml(r.costPaid) + '</div>';
        if (r.oppositionFaced) html += '<div class="sjc-ef-line opp">阻力：' + escHtml(r.oppositionFaced) + '</div>';
        if (Array.isArray(r.linkedEdicts) && r.linkedEdicts.length) {
          html += '<div class="sjc-ef-line dim">联动：' + r.linkedEdicts.slice(0, 3).map(escHtml).join(' + ') + '</div>';
        }
        if (r.missed) html += '<div class="sjc-ef-line missed">未落实：' + escHtml(r.missed) + '</div>';
        if (r.reason && r.status !== 'executed') html += '<div class="sjc-ef-line dim">缘由：' + escHtml(r.reason) + '</div>';
        if (r.nextAdvice) html += '<div class="sjc-ef-line advice">下回合建议：' + escHtml(r.nextAdvice) + '</div>';
        html += '</div>';
      });

      // AI 自发事件（severity/category/诱因/可避免——承旧版分栏）
      if (Array.isArray(ef.unexpectedEvents) && ef.unexpectedEvents.length > 0) {
        html += '<div class="sjc-ef-unexpected"><div class="sjc-ef-sub-hd">【自 发 事 件】</div>';
        ef.unexpectedEvents.forEach(function(u) {
          if (typeof u === 'string') {
            html += '<div class="sjc-ef-line">· ' + escHtml(u) + '</div>';
          } else if (u && typeof u === 'object') {
            var sevCls = u.severity === '危' ? 'sev-wei' : u.severity === '重' ? 'sev-zhong' : u.severity === '中' ? 'sev-mid' : 'sev-low';
            html += '<div class="sjc-ef-uevt ' + sevCls + '"><div class="hd">'
              + (u.severity ? '<span class="sev">[' + escHtml(u.severity) + ']</span>' : '')
              + (u.category ? '<span class="cat">' + escHtml(u.category) + '</span>' : '')
              + '<span class="t">' + escHtml(u.title || '') + '</span></div>';
            if (u.detail) html += '<div class="sjc-ef-line">' + escHtml(u.detail) + '</div>';
            if (u.triggeredBy) html += '<div class="sjc-ef-line dim">诱因：' + escHtml(u.triggeredBy) + '</div>';
            if (u.playerCouldHavePrevented) html += '<div class="sjc-ef-line advice">可避免：' + escHtml(u.playerCouldHavePrevented) + '</div>';
            html += '</div>';
          }
        });
        html += '</div>';
      }

      // 朝野反响（清流/当权/中立/民间——按派系着色承旧版）
      if (ef.courtReaction || ef.popularReaction) {
        html += '<div class="sjc-ef-react"><div class="sjc-ef-sub-hd">【朝 野 反 响】</div>';
        if (ef.courtReaction) {
          var cr = ef.courtReaction;
          if (cr.clearFaction) html += '<div class="sjc-ef-line">· <span class="fac-clear">清流</span>：' + escHtml(cr.clearFaction) + '</div>';
          if (cr.eunuchFaction) html += '<div class="sjc-ef-line">· <span class="fac-eunuch">当权/阉党</span>：' + escHtml(cr.eunuchFaction) + '</div>';
          if (cr.neutralFaction) html += '<div class="sjc-ef-line">· <span class="fac-neutral">中立</span>：' + escHtml(cr.neutralFaction) + '</div>';
        }
        if (ef.popularReaction) html += '<div class="sjc-ef-line pop">· 民间/市井：' + escHtml(ef.popularReaction) + '</div>';
        html += '</div>';
      }

      // 持续阻力汇总
      if (Array.isArray(ef.oppositionSummary) && ef.oppositionSummary.length > 0) {
        html += '<div class="sjc-ef-oppsum">本回合主要阻力：' + ef.oppositionSummary.slice(0, 5).map(escHtml).join('·') + '</div>';
      }
      // 战略洞见
      if (ef.strategicInsight) {
        html += '<div class="sjc-ef-insight">' + _sjcGlyph('略') + ' 御前战略：' + escHtml(ef.strategicInsight) + '</div>';
      }
      // 下回合首要
      if (ef.topPriority) {
        html += '<div class="sjc-ef-priority">' + _sjcGlyph('要') + ' 下回合首要：' + escHtml(ef.topPriority) + '</div>';
      }
      html += '</div>';
    } catch (_efHE) { console.warn('[shiji] 御批回听渲染失败', _efHE); html = ''; }
    return html;
  }

  /** 廷议追责回响·前议(3 回合前)到期议决之复盘 */
  function _sjcTinyiReview() {
    var html = '';
    try {
      var reviews = (GM._turnReport || []).filter(function(r) {
        return r && r.type === 'tinyi_review' && r.turn === (GM.turn - 1);
      });
      if (reviews.length === 0) return '';
      html = '<div class="tr-section sjc-ty"><div class="tr-section-hdr"><span class="lab">前 议 追 责</span><span class="meta">三回前诏命回响 · 廷议/常朝/御前 · ' + reviews.length + ' 案</span></div>';
      var glyphMap = { fulfilled: '成', partial: '半', unfulfilled: '未', backfire: '反' };
      var clsMap = { fulfilled: 'ok', partial: 'part', unfulfilled: 'un', backfire: 'back' };
      reviews.forEach(function(rv) {
        var g = glyphMap[rv.outcome] || '半';
        var c = clsMap[rv.outcome] || 'part';
        html += '<div class="sjc-ty-case ' + c + '">'
          + '<div class="sjc-ty-hd"><span class="oc">' + g + ' ' + escHtml(rv.histLabel || rv.label || '') + '</span>'
          + (rv.venueType ? '<span class="venue">' + escHtml(rv.venueType) + '</span>' : '')
          + (rv.delayTurns ? '<span class="delay">' + rv.delayTurns + ' 回合前议</span>' : '')
          + '</div>'
          + '<div class="sjc-ty-edict">「' + escHtml(rv.edictContent || '') + '」</div>';
        var actors = [];
        if (rv.proposerParty) actors.push('主奏方·<span class="party">' + escHtml(rv.proposerParty) + '</span>');
        if (rv.leaderName) actors.push('党首·' + escHtml(rv.leaderName));
        if (rv.assigneeName) actors.push('承办·' + escHtml(rv.assigneeName));
        if (actors.length) {
          html += '<div class="sjc-ty-actors">' + actors.join(' · ') + '</div>';
        }
        html += '</div>';
      });
      html += '</div>';
    } catch (_tyRvE) { (global.TM && TM.errors && TM.errors.captureSilent) ? TM.errors.captureSilent(_tyRvE, 'shiji·tinyi_review') : null; html = html || ''; }
    return html;
  }

  /** 一致性补录·邸报附录（validator 计数 + AI 二审 patch·空则隐藏·domains 图标 emoji→单字印） */
  function _sjcConsistency() {
    var html = '';
    try {
      var curT = (GM.turn - 1);  // shiji 是上一回合的纪要
      var recLog = (GM._reconcileLog || []).filter(function(x) { return x && (x.turn === curT || x.turn === GM.turn); });
      var patchLog = (GM._reconcilePatchLog || []).filter(function(x) { return x && (x.turn === curT || x.turn === GM.turn); });
      var hasWarn = recLog.some(function(x) { return (x.total || 0) > 0; });
      var hasPatch = patchLog.length > 0;
      if (!hasWarn && !hasPatch) return '';
      var r = recLog[recLog.length - 1] || {};
      var p = patchLog[patchLog.length - 1] || {};
      var domLabels = { fiscalW: '财政', personW: '人事', militaryW: '军事', sentW: '民意', popW: '人口', officeW: '官职', warW: '战事', revoltW: '民变', disasterW: '天灾', diplomacyW: '外交', kejuW: '科举', partyW: '党派', edictEffectW: '法令', courtCeremonyW: '朝仪', constructionW: '工程', omenW: '异象', marriageBirthW: '家事', conspiracyW: '谋反', currencyW: '币政', religionW: '宗教' };
      var warnPills = [];
      Object.keys(domLabels).forEach(function(k) {
        var n = r[k] || 0;
        if (n > 0) warnPills.push('<span class="sjc-cnst-pill">' + domLabels[k] + ' <b>' + n + '</b></span>');
      });
      var totalW = r.total || 0;
      var patchedCount = 0;
      var patchRows = '';
      if (p && p.patch) {
        var pp = p.patch;
        var domains = [
          { key: 'personnel_changes', label: '人事变动', g: '人' },
          { key: 'office_assignments', label: '官职任免', g: '官' },
          { key: 'fiscal_adjustments', label: '财政变化', g: '财' },
          { key: 'military_changes', label: '军事变化', g: '军' },
          { key: 'sentiment_changes', label: '民意补录', g: '意' },
          { key: 'population_changes', label: '户口补录', g: '户' },
          { key: 'war_events', label: '战事补录', g: '战' },
          { key: 'revolt_events', label: '民变补录', g: '变' },
          { key: 'disaster_events', label: '天灾补录', g: '灾' },
          { key: 'diplomacy_events', label: '外交补录', g: '交' },
          { key: 'keju_events', label: '科举补录', g: '科' },
          { key: 'party_events', label: '党派补录', g: '党' },
          { key: 'edict_events', label: '法令补录', g: '法' },
          { key: 'court_ceremony_events', label: '朝仪补录', g: '仪' },
          { key: 'construction_events', label: '工程补录', g: '工' },
          { key: 'omen_events', label: '异象补录', g: '异' },
          { key: 'marriage_birth_events', label: '家事补录', g: '家' },
          { key: 'conspiracy_events', label: '谋反补录', g: '谋' },
          { key: 'currency_events', label: '币政补录', g: '币' },
          { key: 'religion_events', label: '宗教补录', g: '教' }
        ];
        domains.forEach(function(d) {
          var arr = pp[d.key];
          if (!Array.isArray(arr) || arr.length === 0) return;
          patchedCount += arr.length;
          patchRows += '<div class="sjc-cnst-dom">';
          patchRows += '<div class="sjc-cnst-dom-hd">' + _sjcGlyph(d.g) + ' ' + d.label + ' · ' + arr.length + ' 条</div>';
          arr.slice(0, 5).forEach(function(item) {
            var line = '';
            if (d.key === 'personnel_changes') line = (item.name || '?') + '·' + (item.change || '?') + (item.reason ? '（' + item.reason + '）' : '');
            else if (d.key === 'office_assignments') line = (item.name || '?') + '·' + (item.action || '?') + ' ' + (item.post || '') + (item.reason ? '（' + item.reason + '）' : '');
            else if (d.key === 'fiscal_adjustments') line = (item.target || '?') + '·' + (item.kind || '?') + ' ' + (item.amount || 0) + ' ' + (item.resource || '') + '·' + (item.name || '') + (item.reason ? '（' + item.reason + '）' : '');
            else if (d.key === 'military_changes') line = (item.armyName || '?') + '·' + (item.delta > 0 ? '+' : '') + (item.delta || 0) + (item.reason ? '·' + item.reason : '');
            else if (d.key === 'sentiment_changes') line = (item.target || '?') + '·' + (item.delta > 0 ? '+' : '') + (item.delta || 0) + (item.reason ? '·' + item.reason : '');
            else if (d.key === 'population_changes') line = (item.region || '?') + '·' + (item.kind || '?') + ' ' + (item.amount || 0) + (item.reason ? '·' + item.reason : '');
            else if (d.key === 'war_events') line = (item.action || '?') + '·' + (item.enemy || '') + (item.region ? '@' + item.region : '') + (item.outcome ? '·' + item.outcome : '');
            else if (d.key === 'revolt_events') line = (item.action || '?') + '·' + (item.region || '') + (item.leader ? '·' + item.leader : '') + (item.scale ? '·' + item.scale + '人' : '');
            else if (d.key === 'disaster_events') line = (item.region || '?') + '·' + (item.category || '?') + '·' + (item.severity || '') + (item.reason ? '·' + item.reason : '');
            else if (d.key === 'diplomacy_events') line = (item.action || '?') + '·' + (item.faction || '') + (item.attitude ? '→' + item.attitude : '') + (item.reason ? '·' + item.reason : '');
            else if (d.key === 'keju_events') line = (item.stage || '?') + (item.year ? '·' + item.year : '') + ((item.topThree || []).length ? '·三甲: ' + item.topThree.join('/') : '') + (item.reason ? '·' + item.reason : '');
            else if (d.key === 'party_events') line = (item.action || '?') + '·' + (item.partyName || '') + (item.leader ? '·' + item.leader : '') + (item.reason ? '·' + item.reason : '');
            else if (d.key === 'edict_events') line = (item.action || '?') + '·' + (item.edictName || '') + (item.category ? '·' + item.category : '') + (item.reason ? '·' + item.reason : '');
            else if (d.key === 'court_ceremony_events') line = (item.action || '?') + '·' + (item.target || '') + (item.newTitle ? '→' + item.newTitle : '') + (item.newCapital ? '→' + item.newCapital : '') + (item.reason ? '·' + item.reason : '');
            else if (d.key === 'construction_events') line = (item.action || '?') + '·' + (item.kind || '') + '·' + (item.name || '') + (item.region ? '@' + item.region : '') + (item.cost ? '·' + item.cost + '两' : '') + (item.reason ? '·' + item.reason : '');
            else if (d.key === 'omen_events') line = (item.category || '?') + '·' + (item.tone || '') + (item.description ? '·' + item.description : '') + (item.region ? '@' + item.region : '');
            else if (d.key === 'marriage_birth_events') line = (item.action || '?') + '·' + (item.target || '') + (item.partner ? '·' + item.partner : '') + (item.heirName ? '·' + item.heirName : '') + (item.reason ? '·' + item.reason : '');
            else if (d.key === 'conspiracy_events') line = (item.action || '?') + '·' + (item.instigator || '') + (item.target ? '→' + item.target : '') + '·' + (item.outcome || '') + ((item.conspirators || []).length ? '·同谋:' + item.conspirators.slice(0, 3).join('/') : '') + (item.reason ? '·' + item.reason : '');
            else if (d.key === 'currency_events') line = (item.action || '?') + '·' + (item.severity || '') + (item.priceIndexDelta ? '·物价' + (item.priceIndexDelta > 0 ? '+' : '') + item.priceIndexDelta : '') + (item.region ? '@' + item.region : '') + (item.reason ? '·' + item.reason : '');
            else if (d.key === 'religion_events') line = (item.action || '?') + '·' + (item.religion || '') + (item.followers ? '·' + item.followers + '众' : '') + (item.region ? '@' + item.region : '') + (item.reason ? '·' + item.reason : '');
            patchRows += '<div class="sjc-cnst-row">· ' + escHtml(line) + '</div>';
          });
          if (arr.length > 5) patchRows += '<div class="sjc-cnst-more">…另 ' + (arr.length - 5) + ' 条·见 GM._reconcilePatchLog</div>';
          patchRows += '</div>';
        });
      }
      var modeBadge = p.mode === 'tool_use'
        ? '<span class="sjc-cnst-mode strict">tool_use 严格</span>'
        : (p.mode === 'fallback' ? '<span class="sjc-cnst-mode fb">fallback 兜底</span>' : '');

      html = '<div class="sjc-cnst"><details class="sjc-cnst-fold"><summary>'
        + '<span class="sjc-cnst-t">' + _sjcGlyph('校') + ' 一致性校验·邸报附录</span>'
        + '<span class="sjc-cnst-meta">'
        + (totalW > 0 ? '检测 ' + totalW + ' 处不一致' : '')
        + (patchedCount > 0 ? '·补录 ' + patchedCount + ' 条' : '')
        + (modeBadge ? '·' + modeBadge : '')
        + '</span></summary><div class="sjc-cnst-body">';
      if (warnPills.length > 0) {
        html += '<div class="sjc-cnst-warns"><div class="sjc-cnst-cap">本回合 9 域 validator 警告分布：</div>' + warnPills.join('') + '</div>';
      }
      if (patchRows) {
        html += '<div class="sjc-cnst-patches"><div class="sjc-cnst-cap">AI 二审补录明细：</div>' + patchRows + '</div>';
      } else if (totalW > 0) {
        html += '<div class="sjc-cnst-none">（本回合警告未达阈值 3·或 AI 自审认定无需补录）</div>';
      }
      html += '<div class="sjc-cnst-foot">本附录由 9 域校验器（财政/人事/军事/民意/人口/官职/战事/民变/天灾）扫描叙事·与结构化数据比对·'
        + '差异 ≥3 处时由 AI 走 tool_use 二审补录·全程留痕于 console·完整审计链见 <code>GM._reconcilePatchLog</code>。</div>';
      html += '</div></details></div>';
    } catch (_cnstE) { (global.TM && TM.errors && TM.errors.captureSilent) ? TM.errors.captureSilent(_cnstE, 'shiji·consistency') : null; html = html || ''; }
    return html;
  }

  // ───────────────────────── §6 人事板块 + 总览卷 ─────────────────────────
  /** 人事变动（AI personnel_changes 渲染·类型推断词表承旧版·乱码残字已勘正：薨/宾天/致仕/罢黜/裁撤） */
  function _sjcPersonnel(personnelChanges) {
    if (!personnelChanges || !personnelChanges.length) return '';
    function _pcType(change, reason) {
      var s = (change || '') + ' ' + (reason || '');
      if (/殁|崩|薨|宾天|病死|自刎|处决|赐死/.test(s)) return { cls: 'death', lbl: '殁 故' };
      if (/任命|拜|授|补缺|荐擢|就任|履任|上任/.test(s)) return { cls: 'appoint', lbl: '任 命' };
      if (/迁|擢|升|进|入阁|拜将/.test(s)) return { cls: 'promote', lbl: '迁 擢' };
      if (/贬|降|被贬|降级|退职/.test(s)) return { cls: 'demote', lbl: '降 谪' };
      if (/归田|致仕|退休|乞骸/.test(s)) return { cls: 'retire', lbl: '致 仕' };
      if (/丁忧|守制/.test(s)) return { cls: 'mourn', lbl: '丁 忧' };
      if (/罢|革|黜|裁撤/.test(s)) return { cls: 'fire', lbl: '罢 黜' };
      if (/添丁|添子|产|生|新生/.test(s)) return { cls: 'birth', lbl: '添 丁' };
      return { cls: 'appoint', lbl: '人 事' };
    }
    var html = '<div class="tr-section personnel">';
    html += '<div class="tr-section-hdr"><span class="lab">人 事 变 动</span><span class="meta">迁 · 谪 · 殁 · 生 · 任 本回合 ' + personnelChanges.length + ' 起</span></div>';
    html += '<div class="tr-personnel-list">';
    personnelChanges.forEach(function(pc) {
      if (!pc || !pc.name) return;
      var former = pc.former || pc.origin || '';
      var change = pc.change || pc.desc || '';
      var reason = pc.reason || '';
      var t = _pcType(change, reason);
      html += '<div class="tr-person-row ' + t.cls + (pc._applyFailed ? ' unapplied' : '') + '">';
      html += '<span class="type">' + t.lbl + '</span>';
      html += '<span class="who">' + escHtml(pc.name) + '</span>';
      html += '<span class="from-to">';
      if (former) html += escHtml(former) + ' <span class="arrow">→</span> ';
      html += escHtml(change);
      if (reason) html += ' （' + escHtml(reason) + '）';
      if (pc._applyFailed) html += ' <span class="unapplied-badge" title="未落地·详见控制台 GM._unappliedChanges">未落地</span>';  // applier 标记的未落地人事·打标而非假显
      html += '</span>';
      html += '</div>';
    });
    html += '</div></div>';
    return html;
  }

  /** 核心指标 inversed 判定（剧本隔离：优先当前局 GM.vars 定义·不查跨剧本不可靠的 P.variables） */
  function _sjcIsInversed(k) {
    var vDef = null;
    var varArr = (typeof _tmActiveVars === 'function') ? _tmActiveVars()
      : (P.variables ? (Array.isArray(P.variables) ? P.variables : (P.variables.base || []).concat(P.variables.other || [])) : []);
    vDef = varArr.find(function(v) { return v.name === k; });
    return (vDef && vDef.inversed) || (!vDef && /变|乱|争|压|腐|threat|strife|unrest|corruption/.test(k));
  }

  /** 近十二回合走势 sparkline（读 GM._metricHistory 真账·不足 3 点不画·inline SVG 零依赖） */
  function _sjcSparkline(key) {
    try {
      var hist = GM._metricHistory || [];
      if (hist.length < 3) return '';
      var pts = [];
      hist.slice(-12).forEach(function(s) { if (s && typeof s[key] === 'number') pts.push(s[key]); });
      if (pts.length < 3) return '';
      var min = Math.min.apply(null, pts), max = Math.max.apply(null, pts);
      var span = (max - min) || 1;
      var w = 74, h = 20;
      var step = w / (pts.length - 1);
      var d = pts.map(function(v, i) {
        return (i ? 'L' : 'M') + (i * step).toFixed(1) + ',' + (h - 2 - (v - min) / span * (h - 4)).toFixed(1);
      }).join('');
      var rising = pts[pts.length - 1] >= pts[0];
      var lastX = ((pts.length - 1) * step).toFixed(1);
      var lastY = (h - 2 - (pts[pts.length - 1] - min) / span * (h - 4)).toFixed(1);
      return '<svg class="sjc-spark" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" aria-hidden="true"><path d="' + d + '" fill="none" stroke="var(--gold-d,#8a6d2b)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/><circle cx="' + lastX + '" cy="' + lastY + '" r="3" fill="' + (rising ? 'var(--celadon-400)' : 'var(--vermillion-400)') + '" stroke="var(--color-surface,#2a2218)" stroke-width="2"/></svg>';
    } catch (e) { return ''; }
  }

  /** 总览卷·国势水位（核心指标：水位条+前值刻度+delta+近势 sparkline——头版制主视觉） */
  function _sjcCoreBars() {
    var coreKeys = (typeof CORE_METRIC_LABELS === 'object') ? Object.keys(CORE_METRIC_LABELS) : [];
    if (!coreKeys.length) return '';
    var rows = '';
    coreKeys.forEach(function(k) {
      if (typeof GM[k] !== 'number') return;
      var nv = Math.round(GM[k]);
      var ov = Math.round(GM['_prev_' + k] !== undefined ? GM['_prev_' + k] : nv);
      var d = nv - ov;
      var label = CORE_METRIC_LABELS[k] || k;
      var inversed = _sjcIsInversed(k);
      var good = inversed ? d < 0 : d > 0;
      var pct = Math.max(0, Math.min(100, nv));
      var toneVal = inversed ? 100 - pct : pct;   // inversed（党争等）水位高=坏·色带反转
      var tone = toneVal >= 65 ? 'high' : toneVal >= 35 ? 'mid' : 'low';
      rows += '<div class="sjc-core-row">'
        + '<span class="n">' + escHtml(label) + '</span>'
        + '<div class="track"><div class="fill ' + tone + '" style="width:' + pct + '%;"></div><span class="tick" style="left:' + Math.max(0, Math.min(100, ov)) + '%;"></span></div>'
        + '<span class="v">' + nv + '</span>'
        + (d !== 0 ? '<span class="d ' + (good ? 'good' : 'bad') + '">' + (d > 0 ? '+' + d : '−' + Math.abs(d)) + '</span>' : '<span class="d flat">—</span>')
        + _sjcSparkline(k)
        + '</div>';
    });
    if (!rows) return '';
    return '<div class="sjc-ov-sec"><div class="sjc-ov-sec-hd">国 势 水 位</div><div class="sjc-core-bars">' + rows + '</div></div>';
  }

  /** 总览卷·大势 delta chips（base 变量+忠诚 Top3——核心指标已升「国势水位」·此处只收其余账目） */
  function _sjcOverviewDelta(oldVars) {
    var cards = [];
    var coreKeys = (typeof CORE_METRIC_LABELS === 'object') ? Object.keys(CORE_METRIC_LABELS) : [];
    // 核心指标双源排重：turnChanges.variables 里的中文名（如「皇威」）与 CORE_METRIC_LABELS 的 label 同名时跳过
    // （核心源已出 chip·旧版此段为死代码没人看见·上总览卷后现形·2026-07-06 截图自审定罪）
    var coreLabelSeen = {};
    coreKeys.forEach(function(k) { coreLabelSeen[CORE_METRIC_LABELS[k] || k] = 1; });
    if (GM.turnChanges && GM.turnChanges.variables) {
      GM.turnChanges.variables.forEach(function(vc) {
        if (coreKeys.indexOf(vc.name) >= 0 || coreLabelSeen[vc.name]) return;
        var d = Math.round((vc.newValue || 0) - (vc.oldValue || 0));
        if (Math.abs(d) < 1) return;
        var v = GM.vars[vc.name];
        var unit = (v && v.unit) || '';
        var isBase = v && (v.max === undefined || v.max > 1000);
        var cls = d > 0 ? 'good' : 'bad';
        cards.push('<span class="sjc-ov-chip ' + cls + '">' + escHtml(vc.name) + (d > 0 ? '+' : '') + (isBase ? d.toLocaleString() : d) + escHtml(unit) + '</span>');
      });
    }
    if (GM.turnChanges && GM.turnChanges.characters) {
      var loyChanges = [];
      GM.turnChanges.characters.forEach(function(cc) {
        (cc.changes || []).forEach(function(ch) {
          if (ch.field === 'loyalty') loyChanges.push({ name: cc.name, d: Math.round(ch.newValue - ch.oldValue) });
        });
      });
      loyChanges.sort(function(a, b) { return Math.abs(b.d) - Math.abs(a.d); });
      loyChanges.slice(0, 3).forEach(function(lc) {
        if (Math.abs(lc.d) < 2) return;
        var cls = lc.d > 0 ? 'good' : 'bad';
        var dDisp = (typeof _fmtNum1 === 'function') ? _fmtNum1(lc.d) : lc.d;
        cards.push('<span class="sjc-ov-chip ' + cls + '">' + escHtml(lc.name) + '忠' + (lc.d > 0 ? '+' : '') + dDisp + '</span>');
      });
    }
    if (!cards.length) return '';
    return '<div class="sjc-ov-sec"><div class="sjc-ov-sec-hd">大 势</div><div class="sjc-ov-chips">' + cards.join('') + '</div></div>';
  }

  /** 总览卷·本回合要点（忠诚剧变/势力消长/新伤疤/新阴谋/NPC 头条——旧两处要点逻辑合一取超集） */
  function _sjcOverviewHighlights() {
    var highlights = [];
    if (GM.turnChanges && GM.turnChanges.characters) {
      var loyCand = [];
      GM.turnChanges.characters.forEach(function(cc) {
        (cc.changes || []).forEach(function(ch) {
          if (ch.field === 'loyalty' && Math.abs(ch.newValue - ch.oldValue) >= 5) {
            loyCand.push({ name: cc.name, d: ch.newValue - ch.oldValue, nv: ch.newValue, reason: ch.reason || '' });
          }
        });
      });
      loyCand.sort(function(a, b) { return Math.abs(b.d) - Math.abs(a.d); });
      loyCand.slice(0, 2).forEach(function(c) {
        highlights.push({
          name: c.name, sub: '忠诚 ' + (c.d > 0 ? '+' : '') + c.d + ' → ' + c.nv,
          reason: c.reason || '', cls: c.d >= 0 ? '' : 'warn'
        });
      });
    }
    if (GM.turnChanges && GM.turnChanges.factions) {
      var strCand = [];
      GM.turnChanges.factions.forEach(function(fc) {
        (fc.changes || []).forEach(function(ch) {
          if (ch.field === 'strength' && Math.abs(ch.newValue - ch.oldValue) >= 3) {
            strCand.push({ name: fc.name, d: ch.newValue - ch.oldValue, reason: ch.reason || '' });
          }
        });
      });
      strCand.sort(function(a, b) { return Math.abs(b.d) - Math.abs(a.d); });
      strCand.slice(0, 2).forEach(function(f) {
        highlights.push({
          name: f.name, sub: '实力 ' + (f.d > 0 ? '+' : '') + f.d,
          reason: f.reason || '', cls: f.d >= 0 ? '' : 'danger'
        });
      });
    }
    // 新伤疤事件
    if (GM.chars) {
      GM.chars.forEach(function(c) {
        if (c._scars && c._scars.length > 0) {
          var newest = c._scars[c._scars.length - 1];
          if (newest.turn === GM.turn - 1) highlights.push({ name: c.name, sub: '心结', reason: newest.event || '', cls: 'warn' });
        }
      });
    }
    // 新阴谋
    if (Array.isArray(GM.activeSchemes)) {
      GM.activeSchemes.filter(function(s) { return s.startTurn === GM.turn - 1; }).slice(0, 2).forEach(function(s) {
        highlights.push({ name: s.schemer || '?', sub: '密谋' + (s.target ? '针对' + s.target : ''), reason: s.description || s.goal || '', cls: 'danger' });
      });
    }
    // 最重要 NPC 行动头条
    if (GM.evtLog) {
      var topNpcEvt = GM.evtLog.filter(function(e) { return e.type === 'NPC自主' && e.turn === GM.turn - 1; })[0];
      if (topNpcEvt) highlights.push({ name: '朝野', sub: '头条', reason: topNpcEvt.text || '', cls: '' });
    }
    if (!highlights.length) return '';
    var html = '<div class="sjc-ov-sec"><div class="sjc-ov-sec-hd">本 回 合 要 点</div><div class="sjc-ov-hls">';
    highlights.slice(0, 8).forEach(function(h) {
      html += '<div class="sjc-ov-hl' + (h.cls ? ' ' + h.cls : '') + '">';
      html += '<span class="n">' + escHtml(h.name) + '</span><span class="s">' + escHtml(h.sub) + '</span>';
      if (h.reason) html += '<span class="r">' + escHtml(h.reason) + '</span>';
      html += '</div>';
    });
    html += '</div></div>';
    return html;
  }

  // ───────────────────────── §7 卷装订 ─────────────────────────
  /**
   * 史记弹窗主组装（纯函数·只读 GM/P·零副作用）。
   * @param {object} o - 已清洗（_unescNarr+死亡过滤）的渲染素材：
   *   shizhengji/playerStatus/playerInner/oldVars/tyrantResult/shiluText/szjTitle/szjSummary/personnelChanges/hourenXishuo
   * @returns {string} 自包含分卷 HTML（存 GM.shijiHistory[].html）
   */
  function _composeShijiHtml(o) {
    o = o || {};
    // ── 各卷内容先行生成 ──
    var annalsHtml = _sjcShilu(o.shiluText) + _sjcSzjSection(o.shizhengji, o.szjTitle, o.szjSummary);
    var militaryHtml = _sjcBattleSection();
    var ledgerHtml = _sjcUnifiedChanges(o.oldVars);
    var edictTurn = o.turn == null ? GM.turn-1 : o.turn;
    var edictReports = o.edictReports || (global.TM && TM.EdictOutcomes ? TM.EdictOutcomes.forTurn(GM,edictTurn) : []);
    var auditHtml = (global.TM && TM.EdictOutcomes ? TM.EdictOutcomes.feedbackHtml(edictReports,edictTurn) : '') + '<div data-edict-audit-turn="'+edictTurn+'"><!--edict-audit:'+edictTurn+':start-->' + _sjcEfficacy(o.edictAudit,edictTurn) + '<!--edict-audit:'+edictTurn+':end--></div>' + _sjcTinyiReview();
    var personnelHtml = _sjcPersonnel(o.personnelChanges);
    var miscHtml = _sjcHouren(o.hourenXishuo) + _sjcStatus(o.playerStatus, o.playerInner)
      + _sjcTyrant(o.tyrantResult) + _sjcFactionEvt() + _sjcConsistency();

    // ── 卷目 meta（徽章计数/警示/提要） ──
    var battles = GM._turnBattleResults || [];
    if (battles.length === 0 && GM.battleHistory) battles = GM.battleHistory.filter(function(b) { return b.turn === GM.turn - 1; });
    var changeCount = 0;
    if (GM.turnChanges) {
      ['characters', 'factions', 'parties', 'classes', 'military'].forEach(function(k) {
        (GM.turnChanges[k] || []).forEach(function(x) { changeCount += (x.changes || []).length; });
      });
      changeCount += (GM.turnChanges.variables || []).length;
    }
    var ef = o.edictAudit || GM._edictEfficacyReport;
    if (ef && ef.turn !== edictTurn) ef = null;
    var efN = edictReports.length || ((ef && !ef.skipped && Array.isArray(ef.reports)) ? ef.reports.length : 0);
    var tyN = ((GM._turnReport || []).filter(function(r) { return r && r.type === 'tinyi_review' && r.turn === (GM.turn - 1); })).length;
    var deathN = 0;
    (o.personnelChanges || []).forEach(function(pc) {
      if (pc && /殁|崩|薨|宾天|病死|自刎|处决|赐死/.test((pc.change || '') + ' ' + (pc.reason || ''))) deathN++;
    });
    var fiscalDeficit = !!(GM.guoku && (Number(GM.guoku.money) < 0 || Number(GM.guoku.grain) < 0 || Number(GM.guoku.cloth) < 0));
    var auditBad = !!(ef && !ef.skipped && Array.isArray(ef.reports) && ef.reports.some(function(r) { return r.status === 'ignored'; }));

    function _note(parts) { return parts.filter(Boolean).join(' · '); }
    var vols = [
      { id: 'overview', glyph: '览', name: '总览', html: '', count: 0, alert: false, note: '' },
      { id: 'annals', glyph: '录', name: '实录', html: annalsHtml, count: (o.shiluText ? 1 : 0) + (o.shizhengji ? 1 : 0), alert: false,
        note: _note([o.shiluText ? '实录' : '', o.shizhengji ? '时政记' : '']) || '史官阙载',
        empty: '史官阙载 · 本回合无实录', emptySub: '正史两体皆未成篇' },
      { id: 'military', glyph: '军', name: '军务', html: militaryHtml, count: battles.length || ((GM.armies || []).length), alert: battles.length > 0,
        note: battles.length > 0 ? (battles.length + ' 战 · ' + (battles[0] && battles[0].verdict || '战况见内')) : ((GM.armies || []).length > 0 ? (GM.armies.length + ' 军整备') : '四海晏然'),
        empty: '四海晏然 · 未有兵事', emptySub: '诸军各安汛地' },
      { id: 'ledger', glyph: '数', name: '数值', html: ledgerHtml, count: changeCount, alert: fiscalDeficit,
        note: _note([changeCount ? changeCount + ' 项变化' : '', fiscalDeficit ? '帑空在库' : '']) || '诸账未动',
        empty: '诸账未动 · 数值无变化', emptySub: '帑廪户口皆如旧额' },
      { id: 'audit', glyph: '责', name: '问责', html: auditHtml, count: efN + tyN, alert: auditBad,
        note: efN ? (efN + ' 诏问责' + (ef && typeof ef.overallEfficacy === 'number' ? ' · 代理强度 ' + ef.overallEfficacy + '%' : '') + (tyN ? ' · 前议 ' + tyN + ' 案' : '')) : (tyN ? '前议追责 ' + tyN + ' 案' : '未降诏令'),
        empty: '本回合未降诏令 · 无可回听', emptySub: '御批问责与前议追责皆阙' },
      { id: 'personnel', glyph: '人', name: '人事', html: personnelHtml, count: (o.personnelChanges || []).length, alert: deathN > 0,
        note: (o.personnelChanges || []).length ? ((o.personnelChanges || []).length + ' 起' + (deathN ? ' · ' + deathN + ' 人殁' : '')) : '铨曹无事',
        empty: '铨曹无事 · 本回合无人事变动', emptySub: '迁谪殁生任皆无' },
      { id: 'misc', glyph: '杂', name: '杂录', html: miscHtml, count: 0, alert: false,
        note: _note([o.hourenXishuo ? '后人戏说' : '', (o.playerStatus || o.playerInner) ? '角色状态' : '', (o.tyrantResult && o.tyrantResult.flavorTexts && o.tyrantResult.flavorTexts.length) ? '帝王私行' : '']) || '别无杂录',
        empty: '别无杂录', emptySub: '稗官野史今日无篇' }
    ];

    // ── 总览卷（头版制：大题 + 国势水位 + 大势 + 要点 + 卷目提要） ──
    var ovHead = '';
    if (o.szjTitle) {
      ovHead = '<div class="sjc-ov-head"><div class="sjc-ov-title">' + escHtml(o.szjTitle) + '</div>'
        + (o.szjSummary ? '<div class="sjc-ov-subtitle">' + escHtml(o.szjSummary) + '</div>' : '')
        + '</div>';
    }
    var ovHtml = ovHead + _sjcCoreBars() + _sjcOverviewDelta(o.oldVars) + _sjcOverviewHighlights();
    var navCards = '';
    vols.forEach(function(v) {
      if (v.id === 'overview') return;
      // 提要卡=真按钮（键盘可达·Enter/Space 原生触发）·装饰件 aria-hidden
      navCards += '<button type="button" class="sjc-ov-nav' + (v.html ? '' : ' hollow') + (v.alert ? ' alert' : '') + '" data-vol-go="' + v.id + '" onclick="_sjcSwitchVol(this)" aria-label="' + escHtml('往' + v.name + '卷·' + (v.note || '')) + '">'
        + '<span class="g" aria-hidden="true">' + escHtml(v.glyph) + '</span>'
        + '<span class="t">' + escHtml(v.name) + '</span>'
        + '<span class="d">' + escHtml(v.note || '') + '</span>'
        + (v.count ? '<span class="c">' + v.count + '</span>' : '')
        + '<span class="go" aria-hidden="true">›</span>'
        + '</button>';
    });
    ovHtml += '<div class="sjc-ov-sec"><div class="sjc-ov-sec-hd">卷 目 提 要</div><div class="sjc-ov-navs">' + navCards + '</div></div>';
    // 卷尾·当前日期（承旧弹窗尾巴「时移事去后的新日期」信息）
    try { if (typeof getTSText === 'function') ovHtml += '<div class="sjc-ov-now">今 ' + escHtml(getTSText(GM.turn)) + ' · 天下事已更新</div>'; } catch (_) {}
    if (!ovHtml) ovHtml = _sjcEmpty('天下无事', '本回合波澜不惊');
    vols[0].html = ovHtml;

    // ── 装订：卷目（spine）+ 卷体（pages·非总览卷带「卷之N」卷首行） ──
    var spine = '';
    var pages = '';
    var volNoCn = ['', '之一', '之二', '之三', '之四', '之五', '之六'];
    vols.forEach(function(v, i) {
      var on = i === 0 ? ' on' : '';
      // aria：卷签=tab（读屏播卷名+计数+警情）·卷体=tabpanel·aria-selected 由 _sjcSwitchVol 同步
      var ariaLabel = v.name + (v.count ? '·' + v.count + ' 项' : '') + (v.alert ? '·有要情' : '');
      spine += '<button type="button" role="tab" aria-selected="' + (i === 0 ? 'true' : 'false') + '" aria-controls="sjc-vol-' + v.id + '" class="sjc-tab' + on + (v.html ? '' : ' hollow') + (v.alert ? ' alert' : '') + '" data-vol="' + v.id + '" onclick="_sjcSwitchVol(this)" aria-label="' + escHtml(ariaLabel) + '">'
        + '<span class="sjc-tab-g" aria-hidden="true">' + escHtml(v.glyph) + '</span>'
        + '<span class="sjc-tab-t">' + escHtml(v.name) + '</span>'
        + (v.count ? '<span class="sjc-tab-n" aria-hidden="true">' + (v.count > 99 ? '99+' : v.count) + '</span>' : '')
        + '</button>';
      var volHead = i > 0
        ? '<header class="sjc-vol-head"><span class="vh-no">卷' + volNoCn[i] + '</span><span class="vh-name">' + escHtml(v.name) + '</span><span class="vh-rule"></span><span class="vh-note">' + escHtml(v.note || '') + '</span></header>'
        : '';
      pages += '<section class="sjc-vol' + on + '" role="tabpanel" id="sjc-vol-' + v.id + '" data-vol="' + v.id + '" data-glyph="' + escHtml(v.glyph) + '">'
        + volHead
        + (v.html || _sjcEmpty(v.empty || '本卷无事', v.emptySub || ''))
        + '</section>';
    });
    // 骑缝章：卷目与卷体接缝处的跨缝朱印（档案装订防伪之制·印面右起竖读「天命史宝」）·纯装饰 aria-hidden
    var seamSeal = '<div class="sjc-seam-seal" aria-hidden="true"><span>史</span><span>天</span><span>宝</span><span>命</span></div>';
    return '<div class="sjc-frame"><nav class="sjc-spine" role="tablist">' + spine + '</nav>' + seamSeal + '<div class="sjc-pages">' + pages + '</div></div>';
  }

  /** 卷切换（tab/提要卡共用·自定位所属 frame·健壮：找不到目标卷则不动）·同步 aria-selected·记住选卷供翻历史恢复 */
  function _sjcSwitchVol(el) {
    try {
      var frame = el && el.closest ? el.closest('.sjc-frame') : null;
      if (!frame) return;
      var vid = el.getAttribute('data-vol') || el.getAttribute('data-vol-go');
      if (!vid) return;
      var found = false;
      frame.querySelectorAll('.sjc-vol').forEach(function(s) {
        var hit = s.getAttribute('data-vol') === vid;
        if (hit) found = true;
        s.classList.toggle('on', hit);
      });
      if (!found) return;
      frame.querySelectorAll('.sjc-tab').forEach(function(t) {
        var hit = t.getAttribute('data-vol') === vid;
        t.classList.toggle('on', hit);
        t.setAttribute('aria-selected', hit ? 'true' : 'false');
      });
      var pg = frame.querySelector('.sjc-pages');
      if (pg) pg.scrollTop = 0;
      global._sjcLastVol = vid;  // 会话级记忆·不入 GM 不入存档
    } catch (_e) {}
  }

  /** 翻历史回合后恢复上次所在卷（_trNavTurn 调·连续对比同一卷不被重置回总览） */
  function _sjcRestoreVol() {
    try {
      var vid = global._sjcLastVol;
      if (!vid || vid === 'overview') return;
      var body = document.getElementById('turn-body');
      if (!body) return;
      var tab = body.querySelector('.sjc-tab[data-vol="' + vid + '"]');
      if (tab) _sjcSwitchVol(tab);
    } catch (_e) {}
  }

  // ── 键盘：Esc 关闭 · ←→ 翻回合（弹窗开启时·输入焦点不劫持）——vm smoke 无 document·守卫跳过 ──
  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('keydown', function(ev) {
    try {
      var modal = document.getElementById('turn-modal');
      if (!modal || !modal.classList.contains('show')) return;
      var ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
      if (ev.key === 'Escape') {
        ev.preventDefault();
        if (global.TM && TM.UI && TM.UI.turnResult && TM.UI.turnResult.closeTurnResult) TM.UI.turnResult.closeTurnResult();
        else if (typeof closeTurnResult === 'function') closeTurnResult();
      } else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
        var dir = ev.key === 'ArrowLeft' ? -1 : 1;
        ev.preventDefault();
        if (global.TM && TM.UI && TM.UI.turnResult && TM.UI.turnResult.navTurn) TM.UI.turnResult.navTurn(dir);
        else if (typeof _trNavTurn === 'function') _trNavTurn(dir);
      }
    } catch (_e) {}
  });

  // ───────────────────────── 导出 ─────────────────────────
  global._composeShijiHtml = _composeShijiHtml;
  global._renderEdictAudit = _sjcEfficacy;
  global._sjcSwitchVol = _sjcSwitchVol;
  global._sjcRestoreVol = _sjcRestoreVol;
  // 兼容 alias：原 tm-endturn-render.js 全局名——pipeline-steps:544 以 typeof _renderUnifiedChanges 判是否跳过
  // legacy generateChangeReport·smoke-endturn-party-class-change-groups 直调·名字保留语义不变
  global._renderUnifiedChanges = _sjcUnifiedChanges;
  global._renderPersonnelChanges = _sjcPersonnel;
  global.TM = global.TM || {};
  global.TM.Endturn = global.TM.Endturn || {};
  global.TM.Endturn.ShijiCompose = {
    version: 1,
    compose: _composeShijiHtml,
    switchVol: _sjcSwitchVol,
    // 可测内核（smoke-endturn-cause-legibility 直调·「机械后果被玩家感知」B-batch 契约）
    coreMetricReasons: _sjcCoreMetricReasons,
    popReasonHtml: _sjcPopReasonHtml,
    reasonChips: _sjcReasonChips
  };
})(typeof window !== 'undefined' ? window : this);

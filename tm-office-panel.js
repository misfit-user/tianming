// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-office-panel.js — 官制选任+编年 (R124 从 tm-world.js L6550-end 拆出)
// 姊妹: tm-world.js (AI 上下文) + tm-memorials.js (奏疏)
// 包含: _offPickerFilter/_offPickerConfirm/_offImpeach/_npcAutoAppointVacancies/
//       _offTingTui/_offShowCareer/renderBiannian/processBiannian/confirmEndTurn
// ============================================================

function _offPickerFilter() {
  if (!_OFF_PICKER) return;
  var inp = document.getElementById('off-picker-search');
  _OFF_PICKER.kw = inp ? (inp.value || '').trim().toLowerCase() : '';
  _offRenderPickerList();
}

function _offRenderPickerList() {
  var root = document.getElementById('off-picker-list');
  if (!root || !_OFF_PICKER) return;
  var kw = _OFF_PICKER.kw || '';
  var filter = _OFF_PICKER.filter || 'all';
  var list = _OFF_PICKER.cands.filter(function(c) {
    if (kw) {
      var hay = (c.name + (c.officialTitle||'') + (c.title||'') + (c.hometown||'') + (c.faction||'')).toLowerCase();
      if (hay.indexOf(kw) < 0) return false;
    }
    if (filter === 'all') return true;
    if (filter === 'vacant') return !c.officialTitle;
    return (c._pickerTags || []).indexOf(filter) >= 0;
  });

  var cnt = document.getElementById('off-picker-count');
  if (cnt) cnt.textContent = '\u7B5B\u9009\u51FA ' + list.length + ' / ' + _OFF_PICKER.cands.length + ' \u4EBA';

  if (list.length === 0) {
    var _totalCands = (_OFF_PICKER && _OFF_PICKER.cands) ? _OFF_PICKER.cands.length : 0;
    if (_totalCands === 0) {
      // 候选池全空——完全无可任用之人·提供征召入口
      root.innerHTML = ''
        + '<div style="text-align:center;padding:2.4rem 1rem;">'
        +   '<div style="font-size:1.6rem;color:var(--ink-400);margin-bottom:0.3rem;">\u5C3D</div>'
        +   '<div style="font-size:0.86rem;color:var(--ink-300);letter-spacing:0.15em;margin-bottom:0.2rem;">\u65E0\u53EF\u4EFB\u7528\u4E4B\u4EBA</div>'
        +   '<div style="font-size:0.72rem;color:var(--ink-400);line-height:1.7;margin-bottom:1rem;max-width:360px;margin-left:auto;margin-right:auto;">'
        +     '\u5E9C\u5E93\u4EBA\u624D\u65B9\u4E1A\u4E4F\u7ED9\uFF0C\u7329\u529B\u5FE0\u8BDA\u4E4B\u58EB\u96BE\u8FC5\u5C31\u9644\u3002<br>\u53EF\u4E0B\u8BCF\u5FB4\u53EC\u65B0\u4EBA\uFF0C\u53D7\u547D\u4E4B\u540E\u518D\u884C\u6388\u804C\u3002'
        +   '</div>'
        +   '<button onclick="_offRecruitNewForPost()" class="bt" style="padding:8px 20px;background:linear-gradient(180deg,rgba(184,154,83,0.25),rgba(184,154,83,0.1));border:1px solid var(--gold-400);color:var(--gold-300);font-size:0.82rem;letter-spacing:0.15em;border-radius:var(--radius-sm);cursor:pointer;">\u2767 \u4E0B\u8BCF\u5FB4\u53EC \u2767</button>'
        +   '<div style="font-size:0.66rem;color:var(--ink-400);margin-top:0.6rem;">AI \u5C06\u6839\u636E\u6B64\u804C\u9700\u6C42\u751F\u6210\u5019\u9009\u4EBA\u7269</div>'
        + '</div>';
    } else {
      // 筛选后空·但池非空——提示调整过滤
      root.innerHTML = ''
        + '<div style="text-align:center;color:var(--ink-300);padding:3rem 1rem;font-size:0.82rem;">'
        +   '\u65E0\u5339\u914D\u7ED3\u679C<br>'
        +   '<span style="font-size:0.72rem;color:var(--ink-400);">\u5171 ' + _totalCands + ' \u4EBA\u53EF\u9009\u00B7\u8BF7\u8C03\u6574\u641C\u7D22\u6216\u8FC7\u6EE4</span>'
        + '</div>';
    }
    return;
  }

  var h = '';
  var top = list.slice(0, 50); // 最多50条·防止性能问题
  top.forEach(function(c) {
    h += _offPickerRowHtml(c);
  });
  if (list.length > 50) {
    h += '<div style="text-align:center;color:var(--ink-300);padding:0.5rem;font-size:0.72rem;">\u2026\u8FD8\u6709 ' + (list.length - 50) + ' \u4EBA\u00B7\u8BF7\u7F29\u5C0F\u641C\u7D22\u8303\u56F4</div>';
  }
  root.innerHTML = h;
}

function _offPickerRowHtml(c) {
  var f1 = (typeof _fmtNum1 === 'function') ? _fmtNum1 : function(v){ return v; };
  var loyClr = (c.loyalty||50) >= 70 ? 'var(--celadon-400)' : (c.loyalty||50) < 40 ? 'var(--vermillion-400)' : 'var(--gold-400)';
  var match = c._pickerMatch || 0;
  var matchClr = match >= 80 ? 'var(--celadon-400)' : match >= 60 ? 'var(--gold-400)' : match >= 40 ? 'var(--amber-400,#c9a045)' : 'var(--vermillion-400)';
  var matchLbl = match >= 80 ? '\u5353\u7EDD' : match >= 60 ? '\u80DC\u4EFB' : match >= 40 ? '\u52C9\u5F3A' : '\u4E0D\u80DC';
  var nameSafe = escHtml(c.name).replace(/'/g,"\\'");
  var deptSafe = escHtml(_OFF_PICKER.deptName||'').replace(/'/g,"\\'");
  var posSafe = escHtml(_OFF_PICKER.posName||'').replace(/'/g,"\\'");
  var oldSafe = escHtml(_OFF_PICKER.currentHolder||'').replace(/'/g,"\\'");

  // 冠亚季徽标
  var medal = '';
  var medalBg = '';
  var recommendRibbon = '';
  if (c._pickerRank === 1) {
    medal = '<span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;background:linear-gradient(135deg,#c9a045,#d4b45a);color:#1a1510;font-size:11px;font-weight:700;border-radius:50%;box-shadow:0 0 8px rgba(201,168,95,0.5);margin-right:6px;">\u51A0</span>';
    medalBg = 'linear-gradient(to right,rgba(201,168,95,0.08),transparent 60%)';
    recommendRibbon = '<span class="off-pk-recommend-ribbon">\u9996 \u8350</span>';
  }
  else if (c._pickerRank === 2) { medal = '<span style="display:inline-block;width:20px;height:20px;line-height:20px;text-align:center;background:linear-gradient(135deg,#8c8c8c,#b0b0b0);color:#1a1510;font-size:10px;font-weight:700;border-radius:50%;margin-right:6px;">\u4E9A</span>'; medalBg = 'linear-gradient(to right,rgba(160,160,160,0.06),transparent 60%)'; }
  else if (c._pickerRank === 3) { medal = '<span style="display:inline-block;width:20px;height:20px;line-height:20px;text-align:center;background:linear-gradient(135deg,#8b5a2b,#a67440);color:#1a1510;font-size:10px;font-weight:700;border-radius:50%;margin-right:6px;">\u5B63</span>'; medalBg = 'linear-gradient(to right,rgba(139,90,43,0.05),transparent 60%)'; }

  // 四象雷达·智政军忠 → 上右下左·范围 0-100 映射到 radius 0-28（中心 40,40）
  var _rInt = Math.max(0, Math.min(100, c.intelligence||50));
  var _rAdm = Math.max(0, Math.min(100, c.administration||50));
  var _rMil = Math.max(0, Math.min(100, c.military||50));
  var _rLoy = Math.max(0, Math.min(100, c.loyalty||50));
  var _rR = 28; // max radius
  var _radarShape = (match >= 80) ? '' : (match >= 40) ? 'mid' : 'bad';
  // 点：上(智) 右(军) 下(政) 左(忠)
  var _px1 = 40, _py1 = 40 - _rR * (_rInt/100);
  var _px2 = 40 + _rR * (_rMil/100), _py2 = 40;
  var _px3 = 40, _py3 = 40 + _rR * (_rAdm/100);
  var _px4 = 40 - _rR * (_rLoy/100), _py4 = 40;
  var _radarSvg = '<svg class="off-pk-radar" viewBox="0 0 80 80" aria-hidden="true">'
    + '<polygon class="grid" points="40,12 68,40 40,68 12,40"/>'
    + '<polygon class="grid" points="40,22 58,40 40,58 22,40"/>'
    + '<line class="axis" x1="40" y1="12" x2="40" y2="68"/>'
    + '<line class="axis" x1="12" y1="40" x2="68" y2="40"/>'
    + '<polygon class="shape ' + _radarShape + '" points="' + _px1 + ',' + _py1 + ' ' + _px2 + ',' + _py2 + ' ' + _px3 + ',' + _py3 + ' ' + _px4 + ',' + _py4 + '"/>'
    + '<text class="axis-lbl" x="40" y="9" text-anchor="middle">\u667A</text>'
    + '<text class="axis-lbl" x="74" y="44" text-anchor="middle">\u519B</text>'
    + '<text class="axis-lbl" x="40" y="77" text-anchor="middle">\u653F</text>'
    + '<text class="axis-lbl" x="6" y="44" text-anchor="middle">\u5FE0</text>'
    + '</svg>';

  var tags = [];
  if (c.officialTitle) tags.push('<span style="font-size:0.68rem;padding:1px 6px;border-radius:3px;background:rgba(184,154,83,0.12);color:var(--gold-400);">\u73B0\u4EFB ' + escHtml(c.officialTitle) + '</span>');
  else tags.push('<span style="font-size:0.68rem;padding:1px 6px;border-radius:3px;background:rgba(121,175,135,0.12);color:var(--celadon-400);">\u5E03\u8863</span>');
  if (c.location && c.location !== (GM._capital||'京城')) {
    var _td = c._pickerTravelDays > 0 ? ('\u00B7\u8D74\u4EFB ' + c._pickerTravelDays + ' \u65E5') : '';
    tags.push('<span style="font-size:0.68rem;padding:1px 6px;border-radius:3px;background:rgba(192,64,48,0.1);color:var(--vermillion-400);">\u5728 ' + escHtml(c.location) + _td + '</span>');
  }
  if (c.party && c.party !== '\u65E0\u515A') tags.push('<span style="font-size:0.68rem;padding:1px 6px;border-radius:3px;background:rgba(107,93,79,0.2);color:var(--ink-300);">' + escHtml(c.party) + '</span>');
  if (c.hometown) tags.push('<span style="font-size:0.68rem;color:var(--ink-300);">\u7C4D\uFF1A' + escHtml(c.hometown) + '</span>');
  // 警示标签
  (c._pickerWarnings||[]).forEach(function(w){
    tags.push('<span style="font-size:0.68rem;padding:1px 6px;border-radius:3px;background:rgba(192,64,48,0.18);color:var(--vermillion-400);border:1px solid rgba(192,64,48,0.35);">\u26A0 ' + escHtml(w) + '</span>');
  });

  return ''
    + '<div style="position:relative;padding:10px 12px;margin-bottom:6px;background:' + (medalBg || 'var(--color-elevated)') + ',var(--color-elevated);border:1px solid var(--color-border-subtle);border-radius:6px;cursor:pointer;transition:all 0.12s ease;" '
    +   'onmouseover="this.style.borderColor=\'var(--gold-400)\';this.style.transform=\'translateX(2px)\';" '
    +   'onmouseout="this.style.borderColor=\'var(--color-border-subtle)\';this.style.transform=\'translateX(0)\';" '
    +   'onclick="_offPickerConfirmPre(\'' + nameSafe + '\',\'' + deptSafe + '\',\'' + posSafe + '\',\'' + oldSafe + '\')">'
    +   recommendRibbon
    +   '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.8rem;">'
    +     '<div style="flex:1;min-width:0;">'
    +       '<div style="display:flex;align-items:baseline;gap:0.4rem;margin-bottom:4px;">'
    +         medal
    +         '<span style="font-size:1rem;font-weight:700;color:var(--color-foreground);">' + escHtml(c.name) + '</span>'
    +         (c.title ? '<span style="font-size:0.74rem;color:var(--ink-300);">' + escHtml(c.title) + '</span>' : '')
    +         (c.age ? '<span style="font-size:0.7rem;color:var(--ink-300);">\u00B7' + c.age + '\u5C81</span>' : '')
    +       '</div>'
    +       '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:5px;">' + tags.join('') + '</div>'
    +       _offStatsMiniHtml(c, f1)
    +     '</div>'
    +     _radarSvg
    +     '<div style="flex-shrink:0;text-align:center;min-width:72px;">'
    +       '<div style="font-size:1.5rem;font-weight:700;color:' + matchClr + ';line-height:1;">' + match + '<span style="font-size:0.7rem;opacity:0.7;">%</span></div>'
    +       '<div style="margin-top:3px;height:4px;background:rgba(107,93,79,0.15);border-radius:2px;overflow:hidden;">'
    +         '<div style="height:100%;width:' + match + '%;background:' + matchClr + ';transition:width 0.3s;"></div>'
    +       '</div>'
    +       '<div style="font-size:0.64rem;color:' + matchClr + ';letter-spacing:0.1em;margin-top:3px;">' + matchLbl + '</div>'
    +     '</div>'
    +   '</div>'
    + '</div>';
}

// 幂等锁·防止重复点击导致双重任命
var _OFF_APPOINT_LOCKS = {};

// 预检：检测候选人是否已有主官职·若有则弹"辞旧/兼任/取消"三选一
function _offPickerConfirmPre(charName, deptName, posName, oldHolder) {
  // 幂等锁
  var lockKey = charName + '@' + deptName + '|' + posName + '@t' + (GM.turn||0);
  var now = Date.now();
  if (_OFF_APPOINT_LOCKS[lockKey] && (now - _OFF_APPOINT_LOCKS[lockKey]) < 1500) {
    if (typeof toast === 'function') toast('\u521A\u64CD\u4F5C\u8FC7\u00B7\u8BF7\u52FF\u8FDE\u70B9');
    return;
  }
  _OFF_APPOINT_LOCKS[lockKey] = now;

  var newChar = (GM.chars || []).find(function(c){ return c.name === charName; });
  if (!newChar) { _offPickerConfirm(charName, deptName, posName, oldHolder, 'resign'); return; }
  var existingPost = newChar.officialTitle || '';
  // 若现任即目标职位·视为冗余·直接走老路径
  if (!existingPost || existingPost === posName) {
    _offPickerConfirm(charName, deptName, posName, oldHolder, 'resign');
    return;
  }

  // 弹二次确认 modal
  var bg = document.createElement('div');
  bg.id = 'off-concurrent-modal';
  bg.style.cssText = 'position:fixed;inset:0;z-index:1300;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;';
  bg.onclick = function(e){ if (e.target === bg) bg.remove(); };
  var _nameS = escHtml(charName).replace(/'/g,"\\'");
  var _deptS = escHtml(deptName).replace(/'/g,"\\'");
  var _posS = escHtml(posName).replace(/'/g,"\\'");
  var _oldS = escHtml(oldHolder||'').replace(/'/g,"\\'");
  bg.innerHTML = ''
    + '<div style="background:var(--color-surface);border:1px solid var(--amber-400);border-radius:var(--radius-lg);padding:1.2rem 1.4rem;width:min(440px,92vw);">'
    +   '<div style="font-size:0.74rem;color:var(--ink-300);letter-spacing:0.2em;margin-bottom:0.3rem;">\u3014 \u4E00 \u8EAB \u4E24 \u804C \u3015</div>'
    +   '<div style="font-size:0.96rem;font-weight:700;color:var(--color-foreground);margin-bottom:0.3rem;">' + escHtml(charName) + ' \u73B0\u4EFB <span style="color:var(--gold-400);">' + escHtml(existingPost) + '</span></div>'
    +   '<div style="font-size:0.78rem;color:var(--ink-300);line-height:1.7;margin-bottom:0.8rem;">'
    +     '\u65B0\u6388\uFF1A<b style="color:var(--celadon-400);">' + escHtml(deptName) + '\u00B7' + escHtml(posName) + '</b><br>'
    +     '\u8BF7\u6BBF\u4E0B\u660E\u65A8\uFF1A'
    +   '</div>'
    +   '<div style="display:flex;flex-direction:column;gap:0.4rem;">'
    +     '<button class="bt" style="padding:8px 12px;text-align:left;background:var(--color-elevated);border:1px solid var(--color-border);color:var(--color-foreground);" '
    +         'onclick="this.closest(\'div[style*=fixed]\').remove();_offPickerConfirm(\'' + _nameS + '\',\'' + _deptS + '\',\'' + _posS + '\',\'' + _oldS + '\',\'resign\')">'
    +       '<div style="font-size:0.84rem;font-weight:700;color:var(--gold-400);">\u8F9E\u65E7\u5C31\u65B0</div>'
    +       '<div style="font-size:0.7rem;color:var(--ink-300);margin-top:2px;">\u5151\u53BB\u539F\u804C <b>' + escHtml(existingPost) + '</b>\u00B7\u5168\u529B\u8D74\u4EFB\u65B0\u804C</div>'
    +     '</button>'
    +     '<button class="bt" style="padding:8px 12px;text-align:left;background:var(--color-elevated);border:1px solid var(--color-border);color:var(--color-foreground);" '
    +         'onclick="this.closest(\'div[style*=fixed]\').remove();_offPickerConfirm(\'' + _nameS + '\',\'' + _deptS + '\',\'' + _posS + '\',\'' + _oldS + '\',\'concurrent\')">'
    +       '<div style="font-size:0.84rem;font-weight:700;color:var(--celadon-400);">\u517C\u4EFB\u4E24\u804C</div>'
    +       '<div style="font-size:0.7rem;color:var(--ink-300);margin-top:2px;">\u539F\u804C\u4F9D\u65E7\u00B7\u65B0\u804C\u517C\u7BA1\u00B7\u4EE3\u4EF7\uFF1A\u7CBE\u529B\u5206\u6563\u00B7\u6548\u7387\u6253\u6298</div>'
    +     '</button>'
    +     '<button class="bt" style="padding:6px 12px;text-align:center;background:transparent;border:1px solid var(--color-border-subtle);color:var(--ink-300);" '
    +         'onclick="this.closest(\'div[style*=fixed]\').remove();">'
    +       '\u64A4\u56DE\u6210\u547D'
    +     '</button>'
    +   '</div>'
    + '</div>';
  document.body.appendChild(bg);
}

function _offPickerConfirm(charName, deptName, posName, oldHolder, mode) {
  // mode: 'resign'(默认·辞旧就新) | 'concurrent'(兼任)
  mode = mode || 'resign';
  // ═══ 三位一体·即时生效·回合内可撤销 ═══
  // 1. 直接改 officeTree holder（UI 立即刷新）
  // 2. 同步更新 char.officialTitle + careerHistory + 官职公库 currentHead
  // 3. 自动 append 到 edict-pol textarea（交 AI 本回合推演·会引发叙事+后续影响）
  // 4. 同时记入 edictSuggestions 供参考
  // 5. 往位置对象写 _pendingEdict 快照·供回合内撤销使用
  var newChar = (GM.chars || []).find(function(c){ return c.name === charName; });
  var oldChar = oldHolder ? (GM.chars || []).find(function(c){ return c.name === oldHolder; }) : null;

  // 兼任模式·先记录 newChar 原有主职·供 _pendingEdict 快照
  var _snapPrevMainTitle = '';
  if (newChar) _snapPrevMainTitle = newChar.officialTitle || '';
  // 辞旧模式·若 newChar 已有主职且不是此职·级联清其原 holder 登记
  // 并存快照·供撤销时把原职还给他
  var _snapResignVacated = [];
  if (mode === 'resign' && newChar && newChar.officialTitle && newChar.officialTitle !== posName) {
    // 先扫一遍·找 newChar 在其他位置的 holder·存快照
    (function _scanResign(nodes) {
      (nodes||[]).forEach(function(n) {
        if (!n) return;
        (n.positions||[]).forEach(function(p) {
          if (!p) return;
          if (p.holder === charName && !(p.name === posName && n.name === deptName)) {
            _snapResignVacated.push({
              dept: n.name, pos: p.name, holder: charName,
              holderSinceTurn: p.holderSinceTurn || 0,
              pubHead: (p.publicTreasury && p.publicTreasury.currentHead) || null
            });
          }
        });
        if (n.subs) _scanResign(n.subs);
      });
    })(GM.officeTree||[]);
    if (typeof _offVacateByCharName === 'function') {
      try { _offVacateByCharName(charName, 'resign-for-new'); } catch(_){}
    }
  }
  var _seatDone = false;
  var _posRef = null; // 保存被修改的 position 引用·供末尾挂 _pendingEdict
  var _snapPrevPubHead = undefined;

  // Step 1: officeTree 直接查找并改 holder·用 _offAppointPerson 助手确保 actualHolders 同步
  // 避免 _offMigratePosition 下次调用时把 holder 从 actualHolders 重建回原值
  function _applyHolder(nodes) {
    if (_seatDone) return;
    (nodes || []).forEach(function(n) {
      if (_seatDone || !n) return;
      if (n.name === deptName) {
        (n.positions || []).forEach(function(p) {
          if (_seatDone || !p) return;
          if (p.name === posName) {
            _snapPrevPubHead = (p.publicTreasury && p.publicTreasury.currentHead) || undefined;
            // 先把旧任从 actualHolders 剥除（若有）
            if (oldHolder && typeof _offDismissPerson === 'function') {
              try { _offDismissPerson(p, oldHolder); } catch(_){}
            }
            // 再把新任推入 actualHolders 并同步 holder 字段
            if (typeof _offAppointPerson === 'function') {
              try { _offAppointPerson(p, charName); } catch(_){}
            } else {
              p.holder = charName;
            }
            if (p.publicTreasury) p.publicTreasury.currentHead = charName;
            if (!p._history) p._history = [];
            p._history.push({ holder: oldHolder || '(空)', endTurn: GM.turn, reason: '玩家诏令改任' });
            _posRef = p;
            _seatDone = true;
          }
        });
      }
      if (!_seatDone && n.subs) _applyHolder(n.subs);
    });
  }
  _applyHolder(GM.officeTree || []);

  // Step 2: 更新 char 字段
  if (newChar) {
    if (mode === 'concurrent' && _snapPrevMainTitle && _snapPrevMainTitle !== posName) {
      // 兼任·原主职保留·新职入 concurrentTitles
      if (!Array.isArray(newChar.concurrentTitles)) newChar.concurrentTitles = [];
      if (newChar.concurrentTitles.indexOf(posName) < 0) newChar.concurrentTitles.push(posName);
    } else {
      // 辞旧就新·正常改主职
      newChar.officialTitle = posName;
      newChar.position = posName;
      // 若原是兼任名单中的一员·从 concurrentTitles 移除
      if (Array.isArray(newChar.concurrentTitles)) {
        var _ci = newChar.concurrentTitles.indexOf(posName);
        if (_ci >= 0) newChar.concurrentTitles.splice(_ci, 1);
      }
    }
    if (!newChar.careerHistory) newChar.careerHistory = [];
    newChar.careerHistory.push({ turn: GM.turn, event: (mode==='concurrent' ? '奉诏加兼 ' : '奉诏就任 ') + deptName + posName });
    if (!newChar._memorySeeds) newChar._memorySeeds = [];
    newChar._memorySeeds.push({ turn: GM.turn, event: '蒙陛下简拔·授' + deptName + posName + (mode==='concurrent'?'（兼）':''), emotion: '敬感' });
    // 好感 +5·被委以重任
    if (typeof AffinityMap !== 'undefined' && AffinityMap.add) {
      AffinityMap.add(charName, (P.playerInfo && P.playerInfo.characterName) || '\u9661\u4E0B', 5, '被委以重任');
    }
    if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
      NpcMemorySystem.remember(charName, '蒙简擢为 ' + deptName + posName, '\u559C', 7, (P.playerInfo && P.playerInfo.characterName) || '\u9661\u4E0B');
    }
  }
  if (oldChar) {
    if (oldChar.officialTitle === posName) oldChar.officialTitle = '';
    if (oldChar.position === posName) oldChar.position = '';
    oldChar._displaced = { from: posName, by: charName, turn: GM.turn };
    if (!oldChar.careerHistory) oldChar.careerHistory = [];
    oldChar.careerHistory.push({ turn: GM.turn, event: '奉诏免 ' + deptName + posName + '·由 ' + charName + ' 代' });
    if (typeof AffinityMap !== 'undefined' && AffinityMap.add) {
      AffinityMap.add(oldHolder, (P.playerInfo && P.playerInfo.characterName) || '\u9661\u4E0B', -10, '被免职');
    }
  }

  // Step 3: append 到 edict-pol textarea·AI 会在本回合推演看到
  var _actionVerb = (mode === 'concurrent') ? '加兼' : '为';
  var edictLine = oldHolder
    ? ('命 ' + charName + ' ' + _actionVerb + ' ' + deptName + posName + '·原任 ' + oldHolder + ' 着免。')
    : (mode === 'concurrent' && _snapPrevMainTitle
        ? ('命 ' + charName + ' 以 ' + _snapPrevMainTitle + ' 加兼 ' + deptName + posName + '。')
        : ('命 ' + charName + ' 为 ' + deptName + posName + '。'));
  var polEl = document.getElementById('edict-pol');
  if (polEl) {
    var cur = (polEl.value || '').trim();
    polEl.value = cur ? (cur + '\n' + edictLine) : edictLine;
  }

  // Step 4: 建议库记录（供参考）
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  GM._edictSuggestions.push({
    source: '\u5B98\u5236·\u4EFB\u547D\u6309\u94AE', from: '\u94E8\u66F9',
    content: edictLine, turn: GM.turn, used: true
  });

  // Step 4b·【旅程启动】若新任所在地非京师·发起赴任行程+编年+起居注
  // 不改 char.location（保持原处·由 advanceCharTravelByDays 抵达时更新）
  // holder 立即设上（UI 即时反映任命意图）·但显示为 "赴任在途"
  if (newChar && mode !== 'concurrent') {
    var _capitalTravel = GM._capital || '京师';
    // 推断目的地：地方职位如 XX巡抚·XX总兵·XX总督·使用职名中的地名；中央职位用首都
    var _travelDestination = _capitalTravel;
    var _regionalMatch = (deptName + posName).match(/([\u4e00-\u9fa5]{2,4})(?:巡抚|总兵|总督|布政使|按察使|经略|节度)/);
    if (_regionalMatch && _regionalMatch[1]) {
      _travelDestination = _regionalMatch[1];
    }
    if (newChar.location && newChar.location !== _travelDestination) {
      var _trvDays = 20;
      try {
        if (typeof calcLetterDays === 'function') {
          _trvDays = calcLetterDays(newChar.location, _travelDestination, 'normal') || 20;
        }
      } catch(_){}
      var _dpvT = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 15;
      var _arrivalTurn = GM.turn + Math.max(1, Math.ceil(_trvDays / _dpvT));
      newChar._travelFrom = newChar.location;
      newChar._travelTo = _travelDestination;
      newChar._travelStartTurn = GM.turn;
      newChar._travelRemainingDays = _trvDays;
      newChar._travelArrival = _arrivalTurn;
      newChar._travelReason = '奉诏赴任 ' + deptName + posName;
      newChar._travelAssignPost = deptName + '/' + posName;

      // 编年·启程条
      if (!Array.isArray(GM._chronicle)) GM._chronicle = [];
      GM._chronicle.unshift({
        turn: GM.turn,
        date: GM._gameDate || (typeof getTSText === 'function' ? getTSText(GM.turn) : ''),
        type: '赴任启程',
        title: charName + ' 赴 ' + _travelDestination,
        content: charName + ' 自' + newChar.location + ' 启程赴' + _travelDestination + '·奉诏就任 ' + deptName + posName + '·预计 ' + _trvDays + ' 日（约 ' + Math.max(1, Math.ceil(_trvDays / _dpvT)) + ' 回合）抵任。',
        category: '人事',
        tags: ['人事', '赴任', '启程', charName]
      });

      // 起居注·启程条
      if (!Array.isArray(GM.qijuHistory)) GM.qijuHistory = [];
      GM.qijuHistory.unshift({
        turn: GM.turn,
        date: GM._gameDate || (typeof getTSText === 'function' ? getTSText(GM.turn) : ''),
        content: '【启程】' + charName + ' 自' + newChar.location + ' 赴 ' + _travelDestination + '·就任 ' + deptName + posName + '·预计 ' + _trvDays + ' 日'
      });

      // 报话筒
      if (typeof addEB === 'function') {
        try { addEB('人事', charName + ' 奉诏赴' + _travelDestination + '·预计 ' + _trvDays + ' 日抵任'); } catch(_){}
      }
    }
  }

  // Step 5: edictTracker 记入本回合诏令（确保 AI prompt 能看到）·跨回合去重·防止重复任命累积
  if (!GM._edictTracker) GM._edictTracker = [];
  var _trackerId = null;
  var _dupT = (GM._edictTracker||[]).some(function(t) {
    if (!t || t.content !== edictLine) return false;
    return t.status === 'pending' || t.status === 'executing' || t.status === 'partial' || t.status === 'obstructed' || t.status === 'pending_delivery';
  });
  if (!_dupT) {
    _trackerId = 'appoint_' + Date.now() + '_' + charName;
    GM._edictTracker.push({
      id: _trackerId,
      content: edictLine, category: '政令',
      turn: GM.turn, status: 'pending',
      assignee: charName, feedback: '',
      progressPercent: 0,
      _appointmentAction: { character: charName, position: posName, dept: deptName, oldHolder: oldHolder },
      _chainEffects: []  // 后续回合连带效应记录
    });
  }

  // Step 6: 位置挂 _pendingEdict·供「待下诏书」条展示 + 回合内撤销
  if (_posRef) {
    _posRef._pendingEdict = {
      turn: GM.turn,
      prevHolder: oldHolder || '',
      newHolder: charName,
      deptName: deptName,
      posName: posName,
      edictLine: edictLine,
      trackerId: _trackerId,
      mode: mode,
      _snapPrevMainTitle: _snapPrevMainTitle,
      _snapPrevPubHead: _snapPrevPubHead,
      _snapResignVacated: _snapResignVacated, // 辞旧模式·被清空的原职快照·供撤销复原
      _snapNewCharCareerPushed: !!newChar,
      _snapNewCharSeedPushed: !!newChar,
      _snapOldCharCareerPushed: !!oldChar,
      _snapOldCharDisplacedSet: !!oldChar,
      _snapAppliedAffinity: true,
      ts: Date.now()
    };
  }

  var _modeLabel = (mode === 'concurrent') ? '兼任' : (oldHolder ? '改换' : '任命');
  toast(_modeLabel + '\u00B7' + (oldHolder ? (oldHolder + '→' + charName) : charName) + (_dupT ? ' 已即时生效（同内容诏令已在跟踪）' : ' 已即时生效并写入本回合诏令'));
  _offClosePicker();
  if (typeof renderOfficeTree === 'function') { try { renderOfficeTree(); } catch(_){} }
  if (typeof renderRenwu === 'function') { try { renderRenwu(); } catch(_){} }
  if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
}

function _offClosePicker() {
  _OFF_PICKER = null;
  var m = document.getElementById('off-picker-modal');
  if (m) m.remove();
}

// 空候选池·下诏征召新人（调 aiGenerateCompleteCharacter）
function _offRecruitNewForPost() {
  if (!_OFF_PICKER) return;
  var deptName = _OFF_PICKER.deptName || '';
  var posName = _OFF_PICKER.posName || '';
  var pos = _OFF_PICKER.pos || {};
  // 简单的姓名输入 modal
  var bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;z-index:1250;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;';
  bg.onclick = function(e){ if (e.target === bg) bg.remove(); };
  bg.innerHTML = ''
    + '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1.2rem 1.5rem;width:min(420px,92vw);">'
    +   '<div style="font-size:0.76rem;color:var(--ink-300);letter-spacing:0.2em;margin-bottom:0.3rem;">\u3014 \u5FB4 \u53EC \u3015</div>'
    +   '<div style="font-size:0.96rem;font-weight:700;color:var(--gold-400);margin-bottom:0.2rem;">' + escHtml(deptName) + '\u00B7' + escHtml(posName) + '</div>'
    +   (pos.rank ? '<div style="font-size:0.72rem;color:var(--ink-300);margin-bottom:0.6rem;">\u54C1\u7EA7\uFF1A' + escHtml(pos.rank) + '</div>' : '<div style="margin-bottom:0.6rem;"></div>')
    +   '<label style="display:block;font-size:0.72rem;color:var(--ink-300);margin-bottom:0.2rem;">\u53EC\u964D\u4E4B\u4EBA\u59D3\u540D</label>'
    +   '<input id="recruit-name-input" type="text" placeholder="\u4F8B\uFF1A\u8881\u5D07\u7115\u00B7\u6216\u7559\u7A7A\u8BA9 AI \u81EA\u751F" maxlength="20" '
    +     'style="width:100%;padding:6px 10px;font-size:0.88rem;background:var(--color-elevated);border:1px solid var(--color-border);border-radius:var(--radius-sm);color:var(--color-foreground);margin-bottom:0.3rem;"/>'
    +   '<div style="font-size:0.66rem;color:var(--ink-400);line-height:1.5;margin-bottom:0.8rem;">\u00B7 \u8F93\u5165\u5386\u53F2\u540D\u81E3\u5C06 AI \u751F\u6210\u5B9E\u5386\u5B66\u5BD8\u00B7 \u7559\u7A7A\u5219 AI \u81EA\u62DF\u540D</div>'
    +   '<div style="display:flex;gap:0.6rem;justify-content:flex-end;">'
    +     '<button class="bt bsm" onclick="this.closest(\'div[style*=fixed]\').remove();">\u53D6\u6D88</button>'
    +     '<button class="bt bsm" style="background:var(--gold-500);color:#1a1510;border-color:var(--gold-500);" onclick="_offRecruitSubmit()">\u4E0B \u8BCF</button>'
    +   '</div>'
    + '</div>';
  document.body.appendChild(bg);
  setTimeout(function(){ var _i = document.getElementById('recruit-name-input'); if (_i) _i.focus(); }, 60);
}

function _offRecruitSubmit() {
  if (!_OFF_PICKER) return;
  var inp = document.getElementById('recruit-name-input');
  var name = (inp && inp.value || '').trim();
  var deptName = _OFF_PICKER.deptName || '';
  var posName = _OFF_PICKER.posName || '';
  var _rmBg = inp && inp.closest('div[style*=fixed]');
  if (_rmBg) _rmBg.remove();

  if (!name) {
    // 让 AI 自拟一个合适人选名·基于职位推
    if (typeof toast === 'function') toast('\u8BF7\u8F93\u5165\u59D3\u540D\u6216\u5148\u5173\u95ED\u518D\u8BD5\u00B7\u672A\u6765\u652F\u6301 AI \u81EA\u62DF');
    return;
  }
  if (typeof edictRecruitCharacter !== 'function') {
    if (typeof toast === 'function') toast('\u5FB4\u53EC\u6A21\u5757\u672A\u52A0\u8F7D');
    return;
  }

  if (typeof toast === 'function') toast('\u6B63\u5728\u5FB4\u53EC ' + name + '\u2026AI \u751F\u6210\u4E2D');
  var _capName = name;
  Promise.resolve().then(function(){
    return edictRecruitCharacter(_capName, deptName + posName, '\u56E0 ' + deptName + posName + ' \u7F3A\u5458\u8D2B\u8352\u00B7\u7279\u4E0B\u8BCF\u5FB4\u53EC');
  }).then(function(ch){
    if (!ch) {
      if (typeof toast === 'function') toast('\u5FB4\u53EC\u5931\u8D25\u00B7\u8BF7\u91CD\u8BD5');
      return;
    }
    // 生成成功·重开 picker（新人已在候选池中）
    if (typeof toast === 'function') toast(_capName + ' \u5E94\u8BCF\u800C\u81F3\u00B7\u8BF7\u9009\u4EFB');
    var _path = _OFF_PICKER.pathArr;
    var _dept = _OFF_PICKER.deptName;
    var _pos = _OFF_PICKER.posName;
    var _cur = _OFF_PICKER.currentHolder;
    _offClosePicker();
    setTimeout(function(){ _offOpenPicker(_path, _dept, _pos, _cur); }, 50);
  }).catch(function(err){
    (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(err, '_offRecruitSubmit') : console.error('[_offRecruitSubmit] err:', err);
    if (typeof toast === 'function') toast('\u5FB4\u53EC\u51FA\u9519\u00B7' + (err && err.message || ''));
  });
}

// 弹劾·生成"请弹劾 X"诏令交 AI 推演判定
function _offImpeach(charName, deptName, posName) {
  if (!charName) return;
  var ch = findCharByName(charName);
  if (!ch) { toast('\u672A\u627E\u5230\u6B64\u4EBA'); return; }
  var loy = ch.loyalty != null ? ch.loyalty : 50;
  var adm = ch.administration || 50;

  // 确认 modal
  var bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;z-index:1280;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;';
  bg.onclick = function(e){ if (e.target === bg) bg.remove(); };
  var _sN = escHtml(charName).replace(/'/g,"\\'");
  var _sD = escHtml(deptName).replace(/'/g,"\\'");
  var _sP = escHtml(posName).replace(/'/g,"\\'");
  // 预估成功率·简化公式：低忠诚+低政事=易倒；高敌意(faction mismatch)额外加成
  var _playerFac2 = (GM.facs||[]).find(function(f){ return f.isPlayer; });
  var _playerFacN2 = _playerFac2 ? _playerFac2.name : ((P.playerInfo && P.playerInfo.factionName) || '');
  var _isForeign2 = _playerFacN2 && ch.faction && ch.faction !== _playerFacN2;
  var _baseSucc = Math.max(10, Math.min(85, 100 - loy - Math.floor(adm/3)));
  if (_isForeign2) _baseSucc += 15;
  _baseSucc = Math.max(10, Math.min(90, _baseSucc));
  var _succClr = _baseSucc >= 60 ? 'var(--celadon-400)' : _baseSucc >= 35 ? 'var(--gold-400)' : 'var(--vermillion-400)';
  var _succLbl = _baseSucc >= 60 ? '\u6613\u4E0B' : _baseSucc >= 35 ? '\u53EF\u8BD5' : '\u5197\u56FE';

  bg.innerHTML = ''
    + '<div style="background:var(--color-surface);border:1px solid var(--vermillion-400);border-radius:var(--radius-lg);padding:1.2rem 1.4rem;width:min(460px,92vw);">'
    +   '<div style="font-size:0.76rem;color:var(--vermillion-300);letter-spacing:0.2em;margin-bottom:0.3rem;">\u3014 \u5F39 \u52BE \u3015</div>'
    +   '<div style="font-size:1rem;font-weight:700;color:var(--color-foreground);margin-bottom:0.2rem;">\u6B32\u5F39\u52BE <span style="color:var(--vermillion-400);">' + escHtml(charName) + '</span></div>'
    +   '<div style="font-size:0.74rem;color:var(--ink-300);margin-bottom:0.7rem;">' + escHtml(deptName) + '\u00B7' + escHtml(posName) + '</div>'
    +   '<div style="padding:0.6rem 0.8rem;background:rgba(192,64,48,0.06);border-left:3px solid var(--vermillion-400);border-radius:2px;margin-bottom:0.6rem;">'
    +     '<div style="font-size:0.72rem;color:var(--ink-300);line-height:1.7;">'
    +       '\u5FE0\uFF1A<b style="color:' + (loy<40?'var(--vermillion-400)':loy<60?'var(--gold-400)':'var(--celadon-400)') + ';">' + loy + '</b>\u00B7'
    +       '\u653F\uFF1A<b>' + adm + '</b>\u00B7'
    +       (_isForeign2 ? '\u5F02\u5DF1\u6D3E' : '\u540C\u52BF') + '<br>'
    +       '\u9884\u8BA1\u5F39\u52BE\u6210\u7B97\uFF1A<b style="color:' + _succClr + ';font-size:1rem;">' + _baseSucc + '%</b> <span style="color:' + _succClr + ';">(' + _succLbl + ')</span>'
    +     '</div>'
    +   '</div>'
    +   '<div style="font-size:0.7rem;color:var(--ink-300);line-height:1.6;margin-bottom:0.8rem;">'
    +     '\u2022 AI \u5C06\u5728\u672C\u56DE\u5408\u63A8\u6F14\u4E2D\u5224\u5B9A\u5F39\u52BE\u6210\u8D25<br>'
    +     '\u2022 \u5F39\u52BE\u5931\u8D25\u00B7\u7687\u5A01\u964D\u00B7\u88AB\u5F39\u8005\u5BF9\u966A\u4E1A\u7A7A<br>'
    +     '\u2022 \u5F39\u52BE\u6210\u529F\u00B7\u7A7A\u51FA\u804C\u4F4D\u5F85\u8865\u4EFB'
    +   '</div>'
    +   '<div style="display:flex;gap:0.6rem;justify-content:flex-end;">'
    +     '<button class="bt bsm" onclick="this.closest(\'div[style*=fixed]\').remove();">\u53D6\u6D88</button>'
    +     '<button class="bt bsm" style="background:var(--vermillion-400);color:#fff;border-color:var(--vermillion-400);" onclick="this.closest(\'div[style*=fixed]\').remove();_offImpeachSubmit(\'' + _sN + '\',\'' + _sD + '\',\'' + _sP + '\',' + _baseSucc + ')">\u4E0A\u5F39\u6587</button>'
    +   '</div>'
    + '</div>';
  document.body.appendChild(bg);
}

function _offImpeachSubmit(charName, deptName, posName, estSucc) {
  var edictLine = '\u5F39\u52BE ' + charName + '\u00B7\u8BF7\u514D ' + deptName + posName + '\u3002';
  var polEl = document.getElementById('edict-pol');
  if (polEl) {
    var cur = (polEl.value || '').trim();
    polEl.value = cur ? (cur + '\n' + edictLine) : edictLine;
  }
  if (!GM._edictTracker) GM._edictTracker = [];
  GM._edictTracker.push({
    id: 'impeach_' + Date.now() + '_' + charName,
    content: edictLine, category: '弹劾',
    turn: GM.turn || 0, status: 'pending',
    assignee: '',
    feedback: '',
    progressPercent: 0,
    _impeach: { target: charName, dept: deptName, pos: posName, estSucc: estSucc }
  });
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  GM._edictSuggestions.push({ source: '\u5F39\u52BE\u6309\u94AE', from: '\u94E8\u66F9', content: edictLine, turn: GM.turn, used: true });
  toast('\u5F39\u52BE\u6587\u5DF2\u7EB3\u8BCF\u00B7\u672C\u56DE\u5408 AI \u5BA1\u5B9A');
  if (typeof renderOfficeTree === 'function') { try { renderOfficeTree(); } catch(_){} }
  if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
}

// NPC 势力自动补任·endturn Phase 0-0c 调用
// 扫 officeTree 找 NPC 势力控制的空缺职位·按 (同派系+能力+历史名望) 择候选·自动写 holder
function _npcAutoAppointVacancies() {
  if (!GM.officeTree) return { appointed: [] };
  var playerFac = (GM.facs||[]).find(function(f){ return f.isPlayer; });
  var playerFacName = playerFac ? playerFac.name : ((P.playerInfo && P.playerInfo.factionName) || '');
  var appointed = [];

  // 识别职位归属派系：通过 currentHolder→faction，或 deptName 中的势力特征
  function _inferPosFaction(pos, deptName, parentChain) {
    // 若有 oldHolder 且 faction 明确·取之
    if (Array.isArray(pos.holderHistory) && pos.holderHistory.length > 0) {
      for (var i = pos.holderHistory.length-1; i >= 0; i--) {
        var h = pos.holderHistory[i];
        if (h && h.name) {
          var ch = findCharByName(h.name);
          if (ch && ch.faction) return ch.faction;
        }
      }
    }
    // 依据 deptName/parentChain 从势力领土关键词推
    var haystack = (deptName||'') + '|' + (parentChain||'');
    var facs = GM.facs || [];
    for (var j = 0; j < facs.length; j++) {
      var f = facs[j];
      if (!f || f.isPlayer) continue;
      if (f.name && haystack.indexOf(f.name) >= 0) return f.name;
      // 领土匹配
      if (Array.isArray(f.territory)) {
        for (var k = 0; k < f.territory.length; k++) {
          if (haystack.indexOf(f.territory[k]) >= 0) return f.name;
        }
      }
    }
    return ''; // 无法推·视为中央朝廷（玩家管辖）
  }

  // 候选打分·相似于 _offPickerConfirm 的打分·但简化
  function _scoreCandidate(c, pos, deptName, facName) {
    var s = 0;
    var dutyText = (pos.duties||'') + (pos.desc||'') + deptName + (pos.name||'');
    var isMil = /\u5175|\u519B|\u536B|\u6B66|\u90FD\u7763|\u5C06|\u603B\u5175/.test(dutyText);
    var isAdm = /\u540F|\u94E8|\u8003|\u793C|\u6237|\u5EA6\u652F|\u5DE5|\u5211|\u5FA1\u53F2/.test(dutyText);
    if (isMil) s += (c.military||50) * 1.6 + (c.valor||50) * 0.6;
    else if (isAdm) s += (c.administration||50) * 1.6 + (c.intelligence||50) * 0.6;
    else s += (c.intelligence||50) + (c.administration||50);
    s += (c.loyalty||50) * 0.4;
    // 同派系加成
    if (facName && c.faction === facName) s += 50;
    // 历史人物加成
    if (c.isHistorical) s += 30;
    // 重要性加成
    if (c.importance) s += Math.min(20, c.importance * 0.25);
    // 已有高官减分·避免反复调任同一人
    if (c.officialTitle) s -= 15;
    // 年龄超 70 减分
    if (c.age && c.age >= 70) s -= 8;
    return s;
  }

  (function _scan(nodes, parentChain) {
    (nodes||[]).forEach(function(n) {
      if (!n) return;
      var chain = parentChain ? (parentChain + '·' + n.name) : n.name;
      (n.positions||[]).forEach(function(p) {
        if (!p || p.holder) return; // 已有 holder 跳过
        if (p._pendingEdict) return; // 玩家本回合诏令跳过
        var facName = _inferPosFaction(p, n.name, chain);
        // 仅补 NPC 派系职位·玩家势力不自动补
        if (!facName || facName === playerFacName) return;
        // 候选池：同派系活人·非玩家
        var cands = (GM.chars||[]).filter(function(c){
          if (!c || c.alive === false || c.isPlayer) return false;
          if (c.faction !== facName) return false;
          return true;
        });
        if (cands.length === 0) return; // 无候选跳过
        cands.forEach(function(c){ c._npcScore = _scoreCandidate(c, p, n.name, facName); });
        cands.sort(function(a,b){ return b._npcScore - a._npcScore; });
        var best = cands[0];
        if (!best || best._npcScore <= 0) return;
        // 就任
        p.holder = best.name;
        p.holderSinceTurn = GM.turn || 0;
        if (!Array.isArray(p._history)) p._history = [];
        p._history.push({ holder: '(空)', endTurn: GM.turn||0, reason: 'NPC内定补任' });
        if (p.publicTreasury) p.publicTreasury.currentHead = best.name;
        best.officialTitle = p.name;
        best.position = p.name;
        if (!best.careerHistory) best.careerHistory = [];
        best.careerHistory.push({ turn: GM.turn||0, event: facName + '\u5185\u5B9A\u5C31\u4EFB ' + n.name + p.name });
        appointed.push({ faction: facName, charName: best.name, dept: n.name, pos: p.name, rank: p.rank||'', score: best._npcScore });
      });
      if (n.subs) _scan(n.subs, chain);
    });
  })(GM.officeTree, '');

  return { appointed: appointed };
}

// 撤销本回合任命·反向操作 _offPickerConfirm 的所有副作用
function _offUndoAppointment(deptName, posName) {
  var target = null;
  (function _find(nodes) {
    if (target) return;
    (nodes||[]).forEach(function(n) {
      if (target || !n) return;
      if (n.name === deptName) {
        (n.positions||[]).forEach(function(p) {
          if (target || !p) return;
          if (p.name === posName) target = p;
        });
      }
      if (!target && n.subs) _find(n.subs);
    });
  })(GM.officeTree || []);
  if (!target || !target._pendingEdict || target._pendingEdict.turn !== GM.turn) {
    toast('\u8BE5\u804C\u65E0\u53EF\u64A4\u9500\u7684\u8BCF\u4E66'); return;
  }
  var pe = target._pendingEdict;
  var newChar = (GM.chars||[]).find(function(c){ return c.name === pe.newHolder; });
  var oldChar = pe.prevHolder ? (GM.chars||[]).find(function(c){ return c.name === pe.prevHolder; }) : null;

  // 1. 回滚 holder + publicTreasury·用助手确保 actualHolders 同步
  // 先把新任从 actualHolders 剥除
  if (pe.newHolder && typeof _offDismissPerson === 'function') {
    try { _offDismissPerson(target, pe.newHolder); } catch(_){}
  }
  // 若原有旧任·把其推回 actualHolders
  if (pe.prevHolder && typeof _offAppointPerson === 'function') {
    try { _offAppointPerson(target, pe.prevHolder); } catch(_){}
  } else {
    target.holder = pe.prevHolder || undefined;
    if (!pe.prevHolder) { try { delete target.holder; } catch(_){} }
  }
  if (target.publicTreasury) target.publicTreasury.currentHead = pe._snapPrevPubHead;
  // 回滚 _history 最末一条（就是刚才写的那条）
  if (Array.isArray(target._history) && target._history.length > 0) target._history.pop();

  // 1b. 回滚 resign 模式清空的原职·把 newChar 推回他原本的其他位置
  if (pe._snapResignVacated && pe._snapResignVacated.length > 0) {
    pe._snapResignVacated.forEach(function(rv) {
      (function _findRestore(nodes) {
        (nodes||[]).forEach(function(n) {
          if (!n) return;
          if (n.name === rv.dept) {
            (n.positions||[]).forEach(function(p) {
              if (p && p.name === rv.pos) {
                if (typeof _offAppointPerson === 'function') {
                  try { _offAppointPerson(p, rv.holder); } catch(_){}
                } else {
                  p.holder = rv.holder;
                }
                if (rv.holderSinceTurn) p.holderSinceTurn = rv.holderSinceTurn;
                if (p.publicTreasury && rv.pubHead) p.publicTreasury.currentHead = rv.pubHead;
              }
            });
          }
          if (n.subs) _findRestore(n.subs);
        });
      })(GM.officeTree||[]);
    });
  }

  // 2. 回滚 newChar 字段
  if (newChar) {
    if (pe.mode === 'concurrent') {
      // 兼任撤销·从 concurrentTitles 移除
      if (Array.isArray(newChar.concurrentTitles)) {
        var _ci2 = newChar.concurrentTitles.indexOf(pe.posName);
        if (_ci2 >= 0) newChar.concurrentTitles.splice(_ci2, 1);
      }
    } else {
      // 辞旧就新撤销·恢复原主职
      if (newChar.officialTitle === pe.posName) newChar.officialTitle = pe._snapPrevMainTitle || '';
      if (newChar.position === pe.posName) newChar.position = pe._snapPrevMainTitle || '';
    }
    if (pe._snapNewCharCareerPushed && Array.isArray(newChar.careerHistory) && newChar.careerHistory.length > 0) {
      newChar.careerHistory.pop();
    }
    if (pe._snapNewCharSeedPushed && Array.isArray(newChar._memorySeeds) && newChar._memorySeeds.length > 0) {
      newChar._memorySeeds.pop();
    }
    // 反向 Affinity +5·回正 -5
    if (pe._snapAppliedAffinity && typeof AffinityMap !== 'undefined' && AffinityMap.add) {
      try { AffinityMap.add(pe.newHolder, (P.playerInfo && P.playerInfo.characterName) || '\u9661\u4E0B', -5, '\u8BCF\u4E66\u64A4\u56DE'); } catch(_){}
    }
  }

  // 3. 回滚 oldChar 字段（若有改换）
  if (oldChar) {
    // 之前清了 officialTitle/position·若仍为空则恢复回原职
    if (!oldChar.officialTitle) oldChar.officialTitle = pe.posName;
    if (!oldChar.position) oldChar.position = pe.posName;
    if (pe._snapOldCharDisplacedSet) { try { delete oldChar._displaced; } catch(_){} }
    if (pe._snapOldCharCareerPushed && Array.isArray(oldChar.careerHistory) && oldChar.careerHistory.length > 0) {
      oldChar.careerHistory.pop();
    }
    if (pe._snapAppliedAffinity && typeof AffinityMap !== 'undefined' && AffinityMap.add) {
      try { AffinityMap.add(pe.prevHolder, (P.playerInfo && P.playerInfo.characterName) || '\u9661\u4E0B', 10, '\u8BCF\u4E66\u64A4\u56DE'); } catch(_){}
    }
  }

  // 4. 从 edict-pol textarea 移除这一行
  var polEl = document.getElementById('edict-pol');
  if (polEl && polEl.value && pe.edictLine) {
    var lines = polEl.value.split('\n');
    var idx = lines.lastIndexOf(pe.edictLine);
    if (idx >= 0) {
      lines.splice(idx, 1);
      polEl.value = lines.join('\n');
    }
  }

  // 5. 从 edictSuggestions 移除
  if (Array.isArray(GM._edictSuggestions)) {
    GM._edictSuggestions = GM._edictSuggestions.filter(function(s){ return !(s && s.content === pe.edictLine && s.turn === pe.turn); });
  }

  // 6. 从 edictTracker 移除
  if (pe.trackerId && Array.isArray(GM._edictTracker)) {
    GM._edictTracker = GM._edictTracker.filter(function(t){ return t && t.id !== pe.trackerId; });
  }

  // 7. 清 _pendingEdict
  try { delete target._pendingEdict; } catch(_){}

  toast('\u5DF2\u64A4\u9500\uFF1A' + (pe.prevHolder ? ('\u6062\u590D ' + pe.prevHolder) : ('\u7A7A\u7F3A ' + pe.posName)));
  if (typeof renderOfficeTree === 'function') { try { renderOfficeTree(); } catch(_){} }
  if (typeof renderRenwu === 'function') { try { renderRenwu(); } catch(_){} }
  if (typeof _renderEdictSuggestions === 'function') { try { _renderEdictSuggestions(); } catch(_){} }
}

/** 廷推——高品级职位由多位大臣联名推荐 */
function _offTingTui(pathArr, deptName, posName, pos) {
  // 收集在京有品级的高级官员（从三品以上有资格参与廷推）
  var capital = GM._capital || '京城';
  var _recommenders = [];
  (function _findSenior(nodes) {
    nodes.forEach(function(n) {
      (n.positions||[]).forEach(function(p) {
        if (p.holder) {
          var _rl2 = typeof getRankLevel === 'function' ? getRankLevel(p.rank) : 99;
          if (_rl2 <= 8) { // 从四品以上有资格参与廷推
            var _ch2 = findCharByName(p.holder);
            if (_ch2 && _ch2.alive !== false && (_ch2.location === capital || !_ch2.location)) {
              _recommenders.push({ name: p.holder, dept: n.name, pos: p.name, rank: p.rank, ch: _ch2 });
            }
          }
        }
      });
      if (n.subs) _findSenior(n.subs);
    });
  })(GM.officeTree||[]);

  // 每位推荐者根据自己的派系/关系推荐一人
  var _candidates = (GM.chars||[]).filter(function(c) { return c.alive !== false && !c.isPlayer && c.name !== (pos.holder||''); });
  var _recommendations = [];
  _recommenders.forEach(function(r) {
    // 推荐偏好：同派系 > 高能力 > 亲近之人
    var _best = null, _bestScore = -999;
    _candidates.forEach(function(c) {
      var score = (c.intelligence||50) + (c.administration||50);
      if (r.ch.faction && c.faction === r.ch.faction) score += 40; // 同派系加分
      if (r.ch.party && c.party === r.ch.party) score += 25;
      if (typeof AffinityMap !== 'undefined') {
        var _aff = AffinityMap.get(r.name, c.name);
        if (_aff > 0) score += _aff;
      }
      if (score > _bestScore) { _bestScore = score; _best = c; }
    });
    if (_best) _recommendations.push({ recommender: r.name, recommenderDept: r.dept, candidate: _best.name, score: _bestScore });
  });

  // 统计得票
  var _voteMap = {};
  _recommendations.forEach(function(r) {
    if (!_voteMap[r.candidate]) _voteMap[r.candidate] = { votes: 0, from: [] };
    _voteMap[r.candidate].votes++;
    _voteMap[r.candidate].from.push(r.recommender);
  });
  var _sorted = Object.keys(_voteMap).sort(function(a,b) { return _voteMap[b].votes - _voteMap[a].votes; });

  // 弹窗显示廷推结果
  var bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;z-index:1100;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;';
  var html = '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1.2rem 1.5rem;max-width:500px;max-height:80vh;overflow-y:auto;">';
  html += '<div style="font-size:var(--text-md);color:var(--color-primary);margin-bottom:var(--space-2);letter-spacing:0.15em;text-align:center;">\u3014 \u5EF7 \u63A8 \u3015</div>';
  html += '<div style="font-size:var(--text-xs);color:var(--color-foreground-muted);text-align:center;margin-bottom:var(--space-3);">' + escHtml(deptName) + escHtml(posName) + '（' + escHtml(pos.rank||'') + '）——' + _recommenders.length + '\u4F4D\u5927\u81E3\u53C2\u4E0E\u5EF7\u63A8</div>';

  if (_sorted.length === 0) {
    html += '<div style="color:var(--ink-300);text-align:center;padding:1rem;">无合适人选</div>';
  } else {
    _sorted.slice(0, 5).forEach(function(name, idx) {
      var v = _voteMap[name];
      var ch = findCharByName(name);
      var isTop = idx === 0;
      html += '<div style="padding:var(--space-2);margin-bottom:var(--space-1);background:var(--color-elevated);border:1px solid ' + (isTop ? 'var(--gold-500)' : 'var(--color-border-subtle)') + ';border-radius:var(--radius-sm);cursor:pointer;" onclick="_offSelectCandidate(\'' + escHtml(name).replace(/'/g,"\\'") + '\',\'' + escHtml(deptName).replace(/'/g,"\\'") + '\',\'' + escHtml(posName).replace(/'/g,"\\'") + '\');this.closest(\'div[style*=fixed]\').remove();">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
      html += '<div>';
      html += '<span style="font-size:var(--text-sm);font-weight:var(--weight-bold);' + (isTop ? 'color:var(--gold-400);' : '') + '">' + escHtml(name) + '</span>';
      if (ch && ch.title) html += '<span style="font-size:0.65rem;color:var(--ink-300);margin-left:4px;">' + escHtml(ch.title) + '</span>';
      html += '<div style="font-size:0.65rem;color:var(--color-foreground-muted);">';
      if (ch) { var _f1=(typeof _fmtNum1==='function')?_fmtNum1:function(v){return v;}; html += '\u667A' + _f1(ch.intelligence||50) + ' \u653F' + _f1(ch.administration||50) + ' \u519B' + _f1(ch.military||50) + ' \u5FE0' + _f1(ch.loyalty||50); }
      html += '</div>';
      html += '</div>';
      html += '<div style="text-align:right;">';
      html += '<div style="font-size:var(--text-sm);color:var(--gold-400);font-weight:var(--weight-bold);">' + v.votes + '\u7968</div>';
      html += '<div style="font-size:0.6rem;color:var(--ink-300);">' + v.from.join('、') + '</div>';
      html += '</div></div></div>';
    });
  }
  html += '<div style="font-size:0.65rem;color:var(--color-foreground-muted);text-align:center;margin-top:var(--space-2);">\u70B9\u51FB\u5019\u9009\u4EBA\u7EB3\u5165\u8BCF\u4E66\u5EFA\u8BAE\u5E93\uFF0C\u6216\u81EA\u884C\u4E0B\u65E8\u4EFB\u547D\u4ED6\u4EBA</div>';
  html += '<div style="text-align:center;margin-top:var(--space-2);"><button class="bt" onclick="this.closest(\'div[style*=fixed]\').remove();">\u5173\u95ED</button></div>';
  html += '</div>';
  bg.innerHTML = html;
  document.body.appendChild(bg);
}

/** 提取某人的完整官制信息（当前职位+仕途+考评+满意度+丁忧） */
function _offGetCharInfo(charName) {
  var ch = findCharByName(charName);
  if (!ch) return null;
  var info = { current: null, career: [], lastEval: null, satisfaction: null, mourning: ch._mourning || null };
  (function _scan(nodes, dName) {
    nodes.forEach(function(n) {
      (n.positions||[]).forEach(function(p) {
        if (p.holder === charName) {
          var tk = (dName||n.name) + p.name;
          var tenure = (ch._tenure && ch._tenure[tk]) || 0;
          var lastEval = (p._evaluations && p._evaluations.length > 0) ? p._evaluations[p._evaluations.length-1] : null;
          info.current = { dept: n.name, pos: p.name, rank: p.rank||'', tenure: tenure, eval: lastEval };
          if (lastEval) info.lastEval = lastEval;
          info.career.push({ dept: n.name, pos: p.name, rank: p.rank||'', from: GM.turn - tenure, to: null, current: true });
          if (typeof calcOfficialSatisfaction === 'function') {
            info.satisfaction = calcOfficialSatisfaction(charName, p.rank, n.name);
          }
        }
        if (p._history) {
          p._history.forEach(function(h) {
            if (h.holder === charName) {
              info.career.push({ dept: n.name, pos: p.name, rank: p.rank||'', from: h.from||0, to: h.to||0, reason: h.reason||'' });
            }
          });
        }
      });
      if (n.subs) _scan(n.subs, n.name);
    });
  })(GM.officeTree||[]);
  info.career.sort(function(a,b) { return (a.from||0) - (b.from||0); });
  return info;
}

/** 渲染仕途时间线HTML（供char-popup/viewRenwu/offShowCareer共用） */
function _offRenderCareerHTML(charName) {
  var info = _offGetCharInfo(charName);
  if (!info) return '';
  var ch = findCharByName(charName);
  var html = '';
  // 当前官职
  if (info.current) {
    var _rkInfo = typeof getRankInfo === 'function' ? getRankInfo(info.current.rank) : null;
    html += '<div style="padding:var(--space-2);background:var(--color-elevated);border:1px solid var(--gold-500);border-radius:var(--radius-sm);margin-bottom:var(--space-2);">';
    html += '<div style="font-size:var(--text-xs);color:var(--gold-400);font-weight:var(--weight-bold);margin-bottom:2px;">\u5F53\u524D\u5B98\u804C</div>';
    html += '<div style="font-size:var(--text-sm);color:var(--color-foreground);">' + escHtml(info.current.dept) + ' · ' + escHtml(info.current.pos);
    if (info.current.rank) html += ' <span style="color:' + (_rkInfo ? _rkInfo.color : 'var(--ink-300)') + ';">（' + escHtml(info.current.rank) + '）</span>';
    html += '</div>';
    html += '<div style="font-size:0.65rem;color:var(--color-foreground-muted);margin-top:2px;">';
    html += '\u4EFB\u671F ' + info.current.tenure + ' \u56DE\u5408';
    if (info.current.tenure > 12) html += ' <span style="color:var(--amber-400);">\u26A0\u8D85\u671F</span>';
    html += '</div>';
    if (info.lastEval) {
      var _ec = {'\u5353\u8D8A':'var(--gold-400)','\u79F0\u804C':'var(--celadon-400)','\u5E73\u5EB8':'var(--ink-300)','\u5931\u804C':'var(--vermillion-400)'};
      html += '<div style="font-size:0.65rem;margin-top:2px;">\u8003\u8BC4\uFF08' + escHtml(info.lastEval.evaluator||'') + '\uFF09\uFF1A<span style="color:' + (_ec[info.lastEval.grade]||'var(--ink-300)') + ';">' + escHtml(info.lastEval.grade||'') + '</span> ' + escHtml(info.lastEval.comment||'') + '</div>';
    }
    if (info.satisfaction) {
      var _sc2 = info.satisfaction.score;
      html += '<div style="font-size:0.65rem;color:' + (_sc2 < 35 ? 'var(--vermillion-400)' : _sc2 < 55 ? 'var(--amber-400)' : 'var(--celadon-400)') + ';margin-top:2px;">\u5FC3\u6001\uFF1A' + escHtml(info.satisfaction.label) + '</div>';
    }
    html += '</div>';
  } else if (info.mourning) {
    html += '<div style="padding:var(--space-2);background:rgba(107,93,79,0.1);border:1px solid var(--ink-300);border-radius:var(--radius-sm);margin-bottom:var(--space-2);">';
    html += '<div style="font-size:var(--text-xs);color:var(--ink-300);">\u4E01\u5FE7\u5B88\u4E27\u4E2D\uFF08\u56E0' + escHtml(info.mourning.parent||'') + '\u53BB\u4E16\uFF09\uFF0C\u9884\u8BA1T' + info.mourning.until + '\u671F\u6EE1</div>';
    html += '</div>';
  } else {
    html += '<div style="font-size:0.7rem;color:var(--ink-300);margin-bottom:var(--space-2);">\u5E03\u8863 / \u65E0\u5B98\u804C</div>';
  }
  // 仕途时间线
  if (info.career.length > 0) {
    html += '<div style="margin-top:var(--space-2);">';
    html += '<div style="font-size:var(--text-xs);color:var(--gold-400);font-weight:var(--weight-bold);margin-bottom:var(--space-1);">\u4ED5\u9014</div>';
    info.career.forEach(function(c) {
      var fromDate = c.from ? ((typeof getTSText === 'function') ? getTSText(c.from) : 'T' + c.from) : '?';
      var toDate = c.current ? '\u5728\u4EFB' : (c.to ? ((typeof getTSText === 'function') ? getTSText(c.to) : 'T' + c.to) : '?');
      html += '<div style="padding:2px var(--space-2);border-left:2px solid ' + (c.current ? 'var(--gold-400)' : 'var(--color-border-subtle)') + ';margin-bottom:2px;">';
      html += '<div style="font-size:0.7rem;font-weight:' + (c.current ? 'var(--weight-bold)' : 'normal') + ';color:' + (c.current ? 'var(--gold-400)' : 'var(--color-foreground)') + ';">' + escHtml(c.dept) + ' · ' + escHtml(c.pos) + (c.rank ? ' (' + escHtml(c.rank) + ')' : '') + '</div>';
      html += '<div style="font-size:0.6rem;color:var(--color-foreground-muted);">' + fromDate + ' → ' + toDate + (c.reason ? ' · ' + escHtml(c.reason) : '') + '</div>';
      html += '</div>';
    });
    html += '</div>';
  }
  return html;
}

/** 查看官员完整仕途（弹窗版——复用通用渲染函数） */
function _offShowCareer(charName) {
  var ch = findCharByName(charName);
  if (!ch) { toast('找不到此人'); return; }
  var bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;z-index:1100;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;';
  var html = '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1.2rem 1.5rem;max-width:450px;max-height:80vh;overflow-y:auto;">';
  html += '<div style="font-size:var(--text-md);color:var(--color-primary);margin-bottom:var(--space-2);letter-spacing:0.1em;">' + escHtml(charName) + ' \u4ED5\u9014</div>';
  html += '<div style="font-size:0.7rem;color:var(--color-foreground-muted);margin-bottom:var(--space-2);">\5FE0' + (typeof _fmtNum1==='function'?_fmtNum1(ch.loyalty||50):(ch.loyalty||50)) + ' \u667A' + (ch.intelligence||50) + ' \u653F' + (ch.administration||50) + ' \u519B' + (ch.military||50) + ' \u91CE\u5FC3' + (ch.ambition||50) + '</div>';
  html += _offRenderCareerHTML(charName);
  html += '<div style="text-align:center;margin-top:var(--space-2);"><button class="bt" onclick="this.closest(\'div[style*=fixed]\').remove();">\u5173\u95ED</button></div>';
  html += '</div>';
  bg.innerHTML = html;
  document.body.appendChild(bg);
}

/** 官制改革→写入诏令建议库 */
function _offReformToEdict(action, deptName) {
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  if (action === 'add_pos') {
    showPrompt('增设官职名称：', '', function(posName) {
      if (!posName) return;
      GM._edictSuggestions.push({ source: '官制', from: '铨曹', content: '于' + deptName + '增设' + posName + '一职', turn: GM.turn, used: false });
      toast('已录入诏书建议库——请在诏令中正式下旨');
      if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
    });
  } else if (action === 'add_sub') {
    showPrompt('增设下属部门名称：', '', function(subName) {
      if (!subName) return;
      GM._edictSuggestions.push({ source: '官制', from: '铨曹', content: '于' + deptName + '下增设' + subName, turn: GM.turn, used: false });
      toast('已录入诏书建议库——请在诏令中正式下旨');
      if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
    });
  } else if (action === 'abolish') {
    GM._edictSuggestions.push({ source: '官制', from: '铨曹', content: '裁撤' + deptName, turn: GM.turn, used: false });
    toast('已录入诏书建议库——请在诏令中正式下旨');
    if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
  } else if (action === 'rename') {
    showPrompt(deptName + '更名为：', '', function(newName) {
      if (!newName) return;
      GM._edictSuggestions.push({ source: '官制', from: '铨曹', content: '将' + deptName + '更名为' + newName, turn: GM.turn, used: false });
      toast('已录入诏书建议库——请在诏令中正式下旨');
      if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
    });
  } else if (action === 'add_dept') {
    showPrompt('增设顶层部门名称：', '', function(name) {
      if (!name) return;
      GM._edictSuggestions.push({ source: '官制', from: '铨曹', content: '增设' + name, turn: GM.turn, used: false });
      toast('已录入诏书建议库——请在诏令中正式下旨');
      if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
    });
  }
}

/** 免职→写入诏令建议库 */
function _offDismissToEdict(holderName, deptName, posName) {
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  GM._edictSuggestions.push({
    source: '官制', from: '铨曹',
    content: '免去' + holderName + '的' + deptName + posName + '之职',
    turn: GM.turn, used: false
  });
  toast('已录入诏书建议库——请在诏令中正式下旨');
  if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
}

function getOffNode(path,tree){var node=null;var list=tree||GM.officeTree;for(var i=0;i<path.length;i++){if(path[i]==="s"){i++;if(!node||!node.subs)return null;list=node.subs;node=list[path[i]];}else if(path[i]==="p"){i++;if(!node||!node.positions)return null;return node.positions[path[i]];}else{node=list[path[i]];}}return node;}
function updOffNode(path,field,value){var node=null;var list=GM.officeTree;var parentDept=null;for(var i=0;i<path.length;i++){if(path[i]==="s"){i++;if(!node||!node.subs)return;parentDept=node;list=node.subs;node=list[path[i]];}else if(path[i]==="p"){i++;if(!node||!node.positions)return;parentDept=node;node=node.positions[path[i]];}else{node=list[path[i]];}}if(!node)return;
  // 如果修改了部门名或职位名，迁移NPC的任职记录
  if(field==='name'&&node[field]&&node[field]!==value&&GM.chars){
    var oldName=node[field];
    GM.chars.forEach(function(c){
      if(!c._tenure)return;
      // 迁移包含旧名的tenure key
      var keysToMigrate=Object.keys(c._tenure).filter(function(k){return k.indexOf(oldName)>=0;});
      keysToMigrate.forEach(function(k){
        var newKey=k.replace(oldName,value);
        c._tenure[newKey]=(c._tenure[newKey]||0)+c._tenure[k];
        delete c._tenure[k];
      });
    });
    _dbg('[OfficeRename] '+oldName+'→'+value+'，已迁移'+GM.chars.filter(function(c){return c._tenure;}).length+'人的任职记录');
  }
  var _oldVal=node[field];node[field]=value;if(GM.officeChanges)GM.officeChanges.push({action:"update",field:field,value:value,oldValue:_oldVal});}
function addGameDept(){showPrompt("\u90E8\u95E8:","",function(n){if(!n)return;GM.officeTree.push({name:n,positions:[],subs:[]});renderOfficeTree();});}
function addOffPos(path){showPrompt("\u5B98\u804C:","",function(n){if(!n)return;var nd=getOffNode(path);if(nd){if(!nd.positions)nd.positions=[];nd.positions.push({name:n,holder:"",desc:"",rank:""});renderOfficeTree();}});}
function addOffSub(path){showPrompt("\u4E0B\u5C5E:","",function(n){if(!n)return;var nd=getOffNode(path);if(nd){if(!nd.subs)nd.subs=[];nd.subs.push({name:n,positions:[],subs:[]});renderOfficeTree();}});}
async function submitOfficeCh(){if(!GM.officeChanges)GM.officeChanges=[];if(GM.officeChanges.length===0){toast("\u65E0\u53D8\u66F4");return;}toast("\u5DF2\u63D0\u4EA4\uFF0C\u4E0B\u56DE\u5408\u751F\u6548");GM.officeChanges=[];P.officeTree=deepClone(GM.officeTree);}

// ============================================================
//  编年
// ============================================================
function renderBiannian(){
  // 类型→(label,cat,icon) 映射
  var _BN_TYPE = {
    keju:             {label:'\u79D1\u4E3E\u884C\u671D',     cat:'keju',     icon:'\u6587'},
    edict:            {label:'\u957F\u671F\u8BCF\u4EE4',     cat:'edict',    icon:'\u8BCF'},
    project:          {label:'\u5DE5\u7A0B\u5546\u961F',     cat:'project',  icon:'\u5DE5'},
    pending_memorial: {label:'\u79EF\u538B\u594F\u758F',     cat:'memorial', icon:'\u79EF'},
    faction_treaty:   {label:'\u52BF\u529B\u7EA6\u671F',     cat:'faction',  icon:'\u76DF'},
    npc_action:       {label:'NPC \u6301\u7EED\u884C\u52A8', cat:'npc',      icon:'\u52A8'},
    tingyi_pending:   {label:'\u5EF7\u8BAE\u5F85\u843D\u5B9E',cat:'tingyi',  icon:'\u8BAE'},
    chaoyi_pending:   {label:'\u671D\u8BAE\u5F85\u6267\u884C',cat:'tingyi',  icon:'\u8BAE'},
    dynasty_event:    {label:'\u671D\u4EE3\u4E8B\u4EF6',     cat:'dynasty',  icon:'\u671D'},
    other:            {label:'\u5176\u4ED6',                 cat:'dynasty',  icon:'\u4E8B'}
  };

  // 史册类别→cat-* 映射
  function _bnEntryCat(c) {
    var s = (c.category||'') + (c.title||'');
    if (/\u519B|\u5175|\u6218|\u88D7|\u5E05|\u5BC6/.test(s)) return 'cat-mil';
    if (/\u707E|\u5F02|\u65F1|\u6D3A|\u5730\u9707|\u661F|\u6A90\u66C4|\u96EA|\u5929\u8C61|\u65E5\u98DF|\u6708\u98DF|\u864E|\u72FC/.test(s)) return 'cat-nat';
    if (/\u7ECF|\u8D4B|\u7A0E|\u8D22|\u7C73|\u94F6|\u79DF|\u5E01|\u8D4B\u5F79|\u8D44/.test(s)) return 'cat-eco';
    if (/\u5916\u4EA4|\u85E9|\u8D21|\u8D1F\u76DF|\u4F7F\u81E3|\u548C\u4EB2|\u518C\u5C01/.test(s)) return 'cat-dip';
    if (/\u6587|\u79D1\u4E3E|\u8D24|\u5B66|\u793C|\u7965|\u7948|\u796D|\u4E66/.test(s)) return 'cat-cult';
    if (/\u653F|\u5B98|\u8BCF|\u5415|\u7F62|\u514D|\u664B|\u7F62\u804C|\u5BA3|\u514D\u804C|\u5149\u5E1D|\u5373\u4F4D/.test(s)) return 'cat-pol';
    return 'cat-misc';
  }

  // 从日期推断季节
  function _bnSeason(date) {
    if (!date) return null;
    if (/\u6625|\u6B63\u6708|\u4E8C\u6708|\u4E09\u6708/.test(date)) return '\u6625';
    if (/\u590F|\u56DB\u6708|\u4E94\u6708|\u516D\u6708/.test(date)) return '\u590F';
    if (/\u79CB|\u4E03\u6708|\u516B\u6708|\u4E5D\u6708/.test(date)) return '\u79CB';
    if (/\u51AC|\u5341\u6708|\u5341\u4E00\u6708|\u5341\u4E8C\u6708|\u814A\u6708/.test(date)) return '\u51AC';
    return null;
  }

  // ═══ Section 1：长期事势·进行中 ═══
  var activeEl = _$('bn-active');
  if (activeEl) {
    var aHtml = '';
    var _tracks = [];
    if (typeof ChronicleTracker !== 'undefined') {
      _tracks = ChronicleTracker.getVisible() || [];
    }

    // 旧 biannianItems 合并（保留兼容，转成类兼容结构）
    var _legacyActive = (GM.biannianItems||[]).filter(function(item){
      var elapsed = (GM.turn||0) - (item.startTurn||item.turn||GM.turn||0);
      return elapsed < (item.duration||1);
    });

    var totalActive = _tracks.length + _legacyActive.length;

    // 标题（进行中 N 件）
    aHtml += '<div class="bn-section-hdr">';
    aHtml += '<span class="tag">\u957F \u671F \u4E8B \u52BF</span>';
    aHtml += '<span class="desc">\u2014\u2014 \u8DE8\u8D8A\u591A\u56DE\u5408\u7684\u671D\u91CE\u5927\u4E8B\u00B7AI \u63A8\u6F14\u65F6\u89C6\u4E3A\u6301\u7EED\u4E2D</span>';
    aHtml += '<span class="stat">\u8FDB\u884C\u4E2D ' + totalActive + ' \u4EF6</span>';
    aHtml += '</div>';

    if (totalActive === 0) {
      aHtml += '<div class="bn-empty">\u6682\u65E0\u8FDB\u884C\u4E2D\u7684\u957F\u671F\u4E8B\u52BF</div>';
    } else {
      aHtml += '<div class="bn-tracks-wrap">';

      // 按 type 分组
      var _trackGroups = {};
      _tracks.forEach(function(t){
        var k = t.type || 'other';
        if (!_trackGroups[k]) _trackGroups[k] = [];
        _trackGroups[k].push(t);
      });

      // 按 _BN_TYPE 键固定顺序渲染（非映射内的 type 放最后）
      var _typeOrder = ['keju','edict','project','pending_memorial','faction_treaty','npc_action','tingyi_pending','chaoyi_pending','dynasty_event','other'];
      var _allTypes = Object.keys(_trackGroups);
      var _orderedTypes = _typeOrder.filter(function(k){return _trackGroups[k];}).concat(_allTypes.filter(function(k){return _typeOrder.indexOf(k)<0;}));

      _orderedTypes.forEach(function(typeK){
        var meta = _BN_TYPE[typeK] || _BN_TYPE.other;
        var items = _trackGroups[typeK];
        aHtml += '<div class="bn-track-group bn-cat-' + meta.cat + '">';
        aHtml += '<div class="bn-track-group-hdr">';
        aHtml += '<div class="icon">' + meta.icon + '</div>';
        aHtml += '<div class="name">' + escHtml(meta.label) + '</div>';
        aHtml += '<div class="count">' + items.length + ' \u4EF6</div>';
        aHtml += '</div>';

        items.forEach(function(t){
          var elapsed = (GM.turn||0) - (t.startTurn||0);
          var pct = Math.min(100, Math.max(0, t.progress||0));
          var _prioCls = (t.priority === 'high') ? ' priority-high' : '';
          aHtml += '<div class="bn-track' + _prioCls + '">';
          // hdr
          aHtml += '<div class="bn-track-hdr">';
          aHtml += '<span class="bn-track-title">' + escHtml(t.title||'\u65E0\u9898') + '</span>';
          if (t.priority === 'high') {
            var prioLbl = (t.nextDeadline && t.nextDeadline <= (GM.turn||0)) ? '\u26A0 \u903E\u671F' : '\u26A0 \u9AD8\u4F18\u5148';
            aHtml += '<span class="bn-track-prio">' + prioLbl + '</span>';
          }
          if (t.hidden) aHtml += '<span class="bn-track-hidden">\u25C7 \u9690</span>';
          aHtml += '</div>';
          // meta
          aHtml += '<div class="bn-track-meta">';
          if (t.actor) {
            aHtml += '\u4E3B\uFF1A<strong style="color:var(--color-foreground);">' + escHtml(t.actor) + '</strong>';
            aHtml += '<span class="sep">\u00B7</span>';
          }
          aHtml += '\u9636\u6BB5\uFF1A<span class="stage">' + escHtml(t.currentStage||'-') + '</span>';
          aHtml += '<span class="sep">\u00B7</span>';
          aHtml += '<span class="elapsed">\u5DF2\u5386 ' + elapsed + ' \u56DE\u5408</span>';
          if (t.expectedEndTurn && t.expectedEndTurn > (GM.turn||0)) {
            aHtml += '<span class="sep">\u00B7</span>';
            aHtml += '<span class="remaining">\u9884\u4F59 ' + (t.expectedEndTurn - GM.turn) + ' \u56DE</span>';
          }
          aHtml += '</div>';
          if (t.narrative) aHtml += '<div class="bn-track-narr">' + escHtml(t.narrative) + '</div>';
          if (Array.isArray(t.stakeholders) && t.stakeholders.length) {
            aHtml += '<div class="bn-track-stake"><span class="lbl">\u76F8\u5173\uFF1A</span>';
            t.stakeholders.slice(0,6).forEach(function(s){
              aHtml += '<span class="chip">' + escHtml(s) + '</span>';
            });
            aHtml += '</div>';
          }
          if (pct > 0 || t.expectedEndTurn) {
            aHtml += '<div class="bn-track-bar"><div class="bn-track-bar-fill" style="width:' + pct + '%;"></div></div>';
            aHtml += '<div class="bn-track-pct">' + pct + '%</div>';
          }
          aHtml += '</div>'; // .bn-track
        });
        aHtml += '</div>'; // .bn-track-group
      });

      // 旧 biannianItems（若有）放入"其他"组
      if (_legacyActive.length > 0) {
        aHtml += '<div class="bn-track-group bn-cat-dynasty">';
        aHtml += '<div class="bn-track-group-hdr">';
        aHtml += '<div class="icon">\u4E8B</div>';
        aHtml += '<div class="name">\u5176 \u4ED6 \u8FDB \u884C \u4E2D</div>';
        aHtml += '<div class="count">' + _legacyActive.length + ' \u4EF6</div>';
        aHtml += '</div>';
        _legacyActive.forEach(function(item){
          var elapsed = (GM.turn||0) - (item.startTurn||item.turn||GM.turn||0);
          var total = item.duration||1;
          var pct = Math.min(100, Math.round(elapsed/total*100));
          var rem = Math.max(0, total - elapsed);
          var _date = item.date || (typeof getTSText === 'function' ? getTSText(item.startTurn||item.turn||1) : '');
          aHtml += '<div class="bn-track">';
          aHtml += '<div class="bn-track-hdr"><span class="bn-track-title">' + escHtml(item.title||item.name||'\u65E0\u9898') + '</span></div>';
          aHtml += '<div class="bn-track-meta">';
          if (_date) { aHtml += escHtml(_date) + '<span class="sep">\u00B7</span>'; }
          aHtml += '<span class="elapsed">\u8FD8\u5269 ' + rem + ' \u56DE\u5408</span>';
          aHtml += '</div>';
          if (item.content||item.desc) aHtml += '<div class="bn-track-narr">' + escHtml((item.content||item.desc||'').slice(0,120)) + '</div>';
          aHtml += '<div class="bn-track-bar"><div class="bn-track-bar-fill" style="width:' + pct + '%;"></div></div>';
          aHtml += '<div class="bn-track-pct">' + pct + '%</div>';
          aHtml += '</div>';
        });
        aHtml += '</div>';
      }

      aHtml += '</div>'; // .bn-tracks-wrap
    }

    activeEl.innerHTML = aHtml;
  }

  // ═══ Section 3：永久编年·史册 ═══
  var el = _$('biannian-list'); if (!el) return;
  if (!Array.isArray(GM._chronicle)) GM._chronicle = [];
  var chronicle = GM._chronicle;

  // 搜索筛选
  var _kw = (_$('bn-search')||{}).value || '';
  var _filter = (_$('bn-filter')||{}).value || 'all';
  var filtered = chronicle;
  if (_kw) {
    var kw = _kw.toLowerCase();
    filtered = filtered.filter(function(c) { return (c.title||'').toLowerCase().indexOf(kw) >= 0 || (c.content||'').toLowerCase().indexOf(kw) >= 0; });
  }
  if (_filter !== 'all') {
    filtered = filtered.filter(function(c) { return (c.category||'').indexOf(_filter) >= 0 || (c.title||'').indexOf(_filter) >= 0 || (c.content||'').indexOf(_filter) >= 0; });
  }

  // 更新统计
  var statEl = _$('bn-tools-stat');
  if (statEl) {
    statEl.innerHTML = '\u5377\u5E19 <span class="n">' + chronicle.length + '</span> \u6761 \u00B7 \u663E <span class="n">' + filtered.length + '</span> \u6761';
  }

  if (chronicle.length === 0) {
    el.innerHTML = '<div class="bn-empty">\u5C1A\u65E0\u7F16\u5E74\u8BB0\u5F55</div>';
    return;
  }
  if (filtered.length === 0) {
    el.innerHTML = '<div class="bn-empty">\u672A\u5BFB\u5F97\u7B26\u5408\u6761\u4EF6\u7684\u5377\u5E19</div>';
    return;
  }

  // 按年分组
  var _byYear = {};
  filtered.forEach(function(c) {
    var yr = c.year || c.date || 'T' + (c.turn||0);
    if (c.date) {
      var _yrMatch = c.date.match(/(.{2,8}\u5E74)/);
      if (_yrMatch) yr = _yrMatch[1];
    }
    if (!_byYear[yr]) _byYear[yr] = [];
    _byYear[yr].push(c);
  });

  var html = '';
  var _years = Object.keys(_byYear).reverse();
  _years.forEach(function(yr, yrIdx) {
    var items = _byYear[yr];
    var openAttr = (yrIdx === 0) ? ' open' : '';
    html += '<details class="bn-year-block"' + openAttr + '>';
    html += '<summary class="bn-year-summary">' + escHtml(yr) + '<span class="count">' + items.length + ' \u6761</span></summary>';

    // 按季节分组（可选，若能推断）
    var _lastSeason = null;
    items.forEach(function(c){
      var sea = _bnSeason(c.date||'');
      if (sea && sea !== _lastSeason) {
        html += '<div class="bn-season">' + sea + '</div>';
        _lastSeason = sea;
      }
      var catCls = _bnEntryCat(c);
      html += '<div class="bn-entry ' + catCls + '">';
      html += '<div class="bn-entry-hdr">';
      html += '<span class="bn-entry-title">' + escHtml(c.title||'') + '</span>';
      if (c.category) html += '<span class="bn-entry-cat">' + escHtml(c.category) + '</span>';
      html += '</div>';
      html += '<div class="bn-entry-date">' + escHtml(c.date||('T'+(c.turn||''))) + '</div>';
      if (c.content) html += '<div class="bn-entry-body">' + escHtml(c.content) + '</div>';
      html += '</div>';
    });

    html += '</details>';
  });
  el.innerHTML = html;
}

function processBiannian(){
  if (!Array.isArray(GM._chronicle)) GM._chronicle = [];
  // 长期事势追踪器·每回合采集（科举/诏令/阴谋/工程/积压奏疏）
  if (typeof ChronicleTracker !== 'undefined' && ChronicleTracker.tick) {
    try { ChronicleTracker.tick(); } catch(_e){ (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_e, 'Chronicle.tick') : console.warn('[Chronicle.tick]', _e); }
  }
  var completed = [];
  GM.biannianItems = (GM.biannianItems||[]).filter(function(item) {
    var elapsed = GM.turn - (item.startTurn||item.turn||GM.turn);
    if (elapsed >= (item.duration||1)) {
      completed.push(item);
      return false;
    }
    return true;
  });
  // 完成的事务→触发effect→归入永久编年
  completed.forEach(function(item) {
    if (typeof addEB === 'function') addEB('\u5B8C\u6210', item.name||item.title);
    if (item.effect) Object.entries(item.effect).forEach(function(e) { if (GM.vars[e[0]]) GM.vars[e[0]].value = clamp(GM.vars[e[0]].value + e[1], GM.vars[e[0]].min, GM.vars[e[0]].max); });
    // 归入编年
    GM._chronicle.push({
      title: (item.title||item.name||'') + '（已毕）',
      content: item.content||item.desc||'',
      date: item.date || (typeof getTSText === 'function' ? getTSText(item.startTurn||item.turn||GM.turn) : ''),
      turn: item.startTurn||item.turn||GM.turn,
      category: item.type||'',
      year: item.year||''
    });
  });
  // 从本回合时政记自动提取编年条目
  _bnExtractFromShiji();
  renderBiannian();
}

/** 从时政记(shijiHistory)中自动提取本回合要点入编年 */
function _bnExtractFromShiji() {
  if (!GM.shijiHistory || GM.shijiHistory.length === 0) return;
  if (!Array.isArray(GM._chronicle)) GM._chronicle = [];
  var latest = GM.shijiHistory[GM.shijiHistory.length - 1];
  if (!latest || latest.turn !== GM.turn - 1) return; // 时政记是上回合的
  // 检查是否已提取过
  var _alreadyExtracted = GM._chronicle.some(function(c) { return c._fromShiji && c.turn === latest.turn; });
  if (_alreadyExtracted) return;
  // 提取turn_summary作为一行编年条目
  if (latest.turnSummary) {
    GM._chronicle.push({
      title: latest.turnSummary,
      content: '',
      date: latest.time || (typeof getTSText === 'function' ? getTSText(latest.turn) : ''),
      turn: latest.turn,
      category: '',
      year: '',
      _fromShiji: true
    });
  }
  // 编年记录不设上限——永久保留全部历史
}

/** 编年导出 */
function _bnExport() {
  var items = (GM._chronicle||[]).concat(
    (GM.biannianItems||[]).map(function(item) {
      return { title: (item.title||item.name||'') + '（进行中）', content: item.content||item.desc||'', date: item.date||'', turn: item.startTurn||item.turn||0, category: item.type||'' };
    })
  );
  var txt = items.map(function(c) {
    return '[T' + (c.turn||'') + '] ' + (c.date||'') + (c.category ? ' [' + c.category + ']' : '') + '\n' + (c.title||'') + (c.content ? '\n' + c.content : '');
  }).join('\n\n---\n\n');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(function(){toast('\u5DF2\u590D\u5236');}).catch(function(){_bnDownload(txt);});
  } else { _bnDownload(txt); }
}
function _bnDownload(txt) {
  var a = document.createElement('a');
  a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(txt);
  a.download = 'biannian_' + (GM.saveName||'export') + '.txt'; a.click();
  toast('\u5DF2\u5BFC\u51FA');
}

// ============================================================
//  结束回合确认弹窗
// ============================================================
function confirmEndTurn(){
  if(GM.busy)return;
  var edict=(_$('edict-pol')||{}).value||'';
  var mil=(_$('edict-mil')||{}).value||'';
  var dip=(_$('edict-dip')||{}).value||'';
  var eco=(_$('edict-eco')||{}).value||'';
  var oth=(_$('edict-oth')||{}).value||'';
  var xinglu=(_$('xinglu')||{}).value||'';
  var xlPub=(_$('xinglu-pub')||{}).value||'';
  var xlPrv=(_$('xinglu-prv')||{}).value||'';
  var empty=!edict.trim()&&!mil.trim()&&!dip.trim()&&!eco.trim()&&!oth.trim()&&!xinglu.trim()&&!xlPub.trim()&&!xlPrv.trim();
  // 统计待处理奏疏
  var pendingMem=(GM.memorials||[]).filter(function(m){return m.status==='pending';}).length;
  var warningHtml='';
  if(pendingMem>0) warningHtml='<div style="font-size:0.78rem;color:#e67e22;margin-bottom:0.5rem;">尚有 '+pendingMem+' 份奏疏未批复</div>';
  // 检查是否有昏君活动选中
  var _hasTyActs = typeof TyrantActivitySystem !== 'undefined' && TyrantActivitySystem.selectedActivities && TyrantActivitySystem.selectedActivities.length > 0;
  var msg;
  if (empty && !_hasTyActs) {
    msg = '\u4ECA\u65E5\u65E0\u4E8B\uFF0C\u4E0D\u5982\u4F11\u606F\u4E00\u756A\uFF1F\u5929\u4E0B\u592A\u5E73\uFF0C\u4F55\u5FC5\u4E8B\u4E8B\u64CD\u5FC3\u3002';
  } else if (_hasTyActs && empty) {
    msg = '\u4E0D\u7406\u671D\u653F\uFF0C\u53EA\u987E\u4EAB\u4E50\u2014\u2014\u5982\u6B64\u751A\u597D\uFF01';
  } else {
    msg = '\u8BCF\u4EE4\u5DF2\u62DF\uFF0C\u662F\u5426\u9881\u884C\u5929\u4E0B\uFF1F';
  }
  var bg=document.createElement('div');
  bg.style.cssText='position:fixed;inset:0;z-index:1100;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
  bg.innerHTML='<div style="background:var(--bg-1);border:1px solid var(--gold-d);border-radius:14px;padding:2rem 2.2rem;max-width:400px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.5);animation:modal-in 0.3s ease;">'+
    '<div style="font-size:1.3rem;color:var(--gold);margin-bottom:0.4rem;letter-spacing:0.15em;">⏳</div>'+
    '<div style="font-size:1rem;color:var(--txt);margin-bottom:0.8rem;line-height:1.6;">'+msg+'</div>'+
    warningHtml+
    '<div style="font-size:0.75rem;color:var(--txt-d);margin-bottom:1.2rem;">'+getTSText(GM.turn)+' → 第'+(GM.turn+1)+'回合</div>'+
    '<div style="display:flex;gap:0.8rem;justify-content:center;">'+
    '<button class="bt bp" id="cet-ok" style="padding:0.5rem 1.5rem;">颁行天下</button>'+
    '<button class="bt bs" id="cet-cancel" style="padding:0.5rem 1.5rem;">再斟酌</button>'+
    '</div></div>';
  document.body.appendChild(bg);
  bg.querySelector('#cet-cancel').onclick=function(){document.body.removeChild(bg);};
  bg.querySelector('#cet-ok').onclick=function(){document.body.removeChild(bg);endTurn();};
}


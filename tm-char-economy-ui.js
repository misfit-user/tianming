// ═══════════════════════════════════════════════════════════════
// 角色经济 · UI 组件
// 嵌入到 openCharDetail 中的"资源"区块
// 包含 6 资源的视觉化（铜钱/田亩/珍宝/奴婢/商铺 + 名望印章 + 六阶贤能 + 健康压力）
// ═══════════════════════════════════════════════════════════════

(function(global) {
  'use strict';

  function _escHtml(s) {
    if (typeof escHtml === 'function') return escHtml(s);
    return String(s || '').replace(/[&<>"']/g, function(c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function fmtMoney(v) {
    v = Math.round(v || 0);
    if (Math.abs(v) >= 1e8) return (v/1e8).toFixed(2) + '亿';
    if (Math.abs(v) >= 10000) return Math.round(v/10000) + '万';
    return v.toLocaleString();
  }

  // ─── 名望 印章 ───
  function renderFameSeal(fame) {
    fame = fame || 0;
    var absF = Math.abs(fame);
    var label, color, bg;
    if (fame >= 70) {
      label = '名重天下'; color = '#c77b40'; bg = 'rgba(199,123,64,0.15)';
    } else if (fame >= 40) {
      label = '有名望'; color = 'var(--gold-400)'; bg = 'rgba(184,154,83,0.15)';
    } else if (fame >= 10) {
      label = '略有声望'; color = 'var(--gold-300)'; bg = 'rgba(218,195,121,0.12)';
    } else if (fame >= -10) {
      label = '寂寂无名'; color = 'var(--txt-d)'; bg = 'rgba(107,93,79,0.1)';
    } else if (fame >= -40) {
      label = '薄有恶声'; color = 'var(--amber-600)'; bg = 'rgba(138,109,43,0.15)';
    } else if (fame >= -70) {
      label = '声名狼藉'; color = 'var(--vermillion-400)'; bg = 'rgba(192,64,48,0.15)';
    } else {
      label = '万世骂名'; color = 'var(--vermillion-500)'; bg = 'rgba(139,46,37,0.2)';
    }
    // 圆形印章
    return '<div style="display:flex;align-items:center;gap:8px;">'+
      '<div style="width:52px;height:52px;border-radius:50%;'+
        'background:' + bg + ';border:2px solid ' + color + ';'+
        'display:flex;align-items:center;justify-content:center;'+
        'font-size:0.72rem;color:' + color + ';text-align:center;line-height:1.2;'+
        'transform:rotate(-6deg);font-family:\'Songti SC\',\'SimSun\',serif;">'+
        '名<br>望'+
      '</div>'+
      '<div>'+
        '<div style="font-size:0.85rem;color:' + color + ';font-weight:600;">' + label + '</div>'+
        '<div style="font-size:0.74rem;color:var(--txt-d);">' + (fame > 0 ? '+' : '') + Math.round(fame) + ' / ±100</div>'+
      '</div></div>';
  }

  // ─── 六阶贤能 ───
  function renderVirtueBadge(merit, stage) {
    merit = merit || 0;
    stage = stage || 1;
    var names = ['未识','有闻','清誉','儒望','朝宗','师表'];
    var thresholds = [0, 50, 150, 300, 500, 800];
    var name = names[stage - 1] || '未识';
    var nextMin = thresholds[stage] || null;
    var progress = nextMin ? Math.round((merit - (thresholds[stage-1]||0)) / (nextMin - (thresholds[stage-1]||0)) * 100) : 100;
    var colors = ['var(--ink-300)','#9d917d','var(--gold-300)','var(--gold-400)','var(--gold-500)','#c77b40'];
    var color = colors[stage - 1] || colors[0];

    var html = '<div style="padding:0.5rem 0.7rem;background:rgba(184,154,83,0.06);border:1px solid ' + color + ';border-radius:4px;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';
    html += '<div><span style="font-size:0.85rem;color:' + color + ';font-weight:600;letter-spacing:0.05em;">' + name + '</span>'+
            '<span style="font-size:0.7rem;color:var(--txt-d);margin-left:6px;">第 ' + stage + ' 阶</span></div>';
    html += '<span style="font-size:0.74rem;color:var(--txt);">' + Math.round(merit) + ' 点</span>';
    html += '</div>';
    // 六个圆点
    html += '<div style="display:flex;gap:3px;">';
    for (var i = 1; i <= 6; i++) {
      var c = i <= stage ? color : 'var(--bg-3)';
      html += '<div style="flex:1;height:4px;background:' + c + ';border-radius:2px;"></div>';
    }
    html += '</div>';
    if (nextMin) {
      html += '<div style="font-size:0.66rem;color:var(--txt-d);margin-top:3px;">升第 ' + (stage+1) + ' 阶需 ' + nextMin + ' 点（' + progress + '%）</div>';
    }
    html += '</div>';
    return html;
  }

  // ─── 健康/压力 进度条 ───
  function renderBar(label, value, max, colorFn) {
    value = Math.round(value || 0);
    max = max || 100;
    var pct = Math.max(0, Math.min(100, value / max * 100));
    var color = colorFn ? colorFn(value) : 'var(--gold-400)';
    return '<div style="margin-bottom:6px;">'+
      '<div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--txt-d);margin-bottom:2px;">'+
        '<span>' + label + '</span><span style="color:var(--txt);">' + value + '/' + max + '</span></div>'+
      '<div style="height:6px;background:var(--bg-3);border-radius:3px;overflow:hidden;">'+
        '<div style="height:100%;width:' + pct + '%;background:' + color + ';transition:width 0.3s;"></div>'+
      '</div></div>';
  }

  // ─── 私产展示（皇帝=内帑三列 · 其他=五大类）───
  function renderPrivateWealth(pw, hiddenWealth, canSeeHidden) {
    if (!pw) return '';
    var html = '';
    if (pw.isNeitang) {
      // 皇帝：私库 = 内帑（money/grain/cloth 三列）
      html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;">';
      html += renderWealthItem('💰', '内帑·银', fmtMoney(pw.money || 0) + ' 两', 'var(--gold-400)');
      html += renderWealthItem('🌾', '内帑·粮', fmtMoney(pw.grain || 0) + ' 石', '#6aa88a');
      html += renderWealthItem('🧵', '内帑·布', fmtMoney(pw.cloth || 0) + ' 匹', '#a88a6a');
      html += '</div>';
    } else {
      html += '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px;">';
      // 铜钱（现金）
      html += renderWealthItem('💰', '现金', fmtMoney(pw.cash || 0) + ' 两', 'var(--gold-400)',
        pw.cash < 0 ? 'var(--vermillion-400)' : null);
      // 禾穗（田亩）
      html += renderWealthItem('🌾', '田亩', (pw.land||0).toLocaleString() + ' 亩', '#6aa88a');
      // 珍宝
      html += renderWealthItem('💎', '珍宝', fmtMoney(pw.treasure || 0) + ' 估值', '#a88a6a');
      // 奴婢
      html += renderWealthItem('👥', '僮仆', (pw.slaves || 0) + ' 人', '#8a7060');
      // 商铺
      html += renderWealthItem('🏪', '商铺', fmtMoney(pw.commerce || 0) + ' 估值', 'var(--gold-300)');
      html += '</div>';
    }

    // 隐匿藏款（仅当玩家监察力度足够或为玩家自己的角色）
    if (canSeeHidden && hiddenWealth > 0) {
      html += '<div style="margin-top:6px;padding:6px 10px;background:rgba(139,46,37,0.1);border-left:3px solid var(--vermillion-400);border-radius:3px;font-size:0.74rem;">'+
        '<span style="color:var(--vermillion-400);">⚠ 隐匿藏款</span> '+
        '<span style="color:var(--txt);">约 ' + fmtMoney(hiddenWealth) + ' 两</span>'+
        '<span style="color:var(--txt-d);font-size:0.64rem;margin-left:4px;">（监察已察觉）</span>'+
        '</div>';
    }
    return html;
  }

  function renderWealthItem(icon, label, value, color, overrideColor) {
    var textColor = overrideColor || color;
    return '<div style="padding:5px 4px;background:var(--bg-2);border-radius:3px;text-align:center;border-top:2px solid ' + color + ';">'+
      '<div style="font-size:1.1rem;margin-bottom:2px;">' + icon + '</div>'+
      '<div style="font-size:0.64rem;color:var(--txt-d);">' + label + '</div>'+
      '<div style="font-size:0.74rem;color:' + textColor + ';font-weight:500;margin-top:2px;">' + value + '</div>'+
      '</div>';
  }

  // ─── 公库（只读镜像）───
  function renderPublicTreasury(pt) {
    if (!pt) return '';
    // 皇帝：公库 = 帑廪（money/grain/cloth 三列）
    if (pt.isGuoku) {
      return '<div style="padding:8px 10px;background:rgba(184,154,83,0.08);border-left:3px solid var(--gold-d);border-radius:3px;margin-bottom:8px;">'+
        '<div style="font-size:0.76rem;color:var(--gold);margin-bottom:6px;">公库（帑廪 · 国帑）</div>'+
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;">'+
          renderWealthItem('💰', '帑廪·银', fmtMoney(pt.balance || 0) + ' 两', 'var(--gold-400)') +
          renderWealthItem('🌾', '帑廪·粮', fmtMoney(pt.grain || 0) + ' 石', '#6aa88a') +
          renderWealthItem('🧵', '帑廪·布', fmtMoney(pt.cloth || 0) + ' 匹', '#a88a6a') +
        '</div>'+
        '<div style="font-size:0.66rem;color:var(--txt-d);margin-top:4px;">只读镜像 · 国库三账（GM.guoku）</div>'+
        '</div>';
    }
    // 岗位公库
    if (pt.linkedPost && !pt.linkedRegion) {
      return '<div style="padding:6px 10px;background:rgba(184,154,83,0.08);border-left:3px solid var(--gold-d);border-radius:3px;margin-bottom:8px;">'+
        '<div style="display:flex;justify-content:space-between;align-items:center;">'+
          '<span style="font-size:0.76rem;color:var(--gold);">官职公库（' + _escHtml(pt.linkedPost) + '）</span>'+
          '<span style="font-size:0.8rem;color:var(--txt);font-weight:500;">' + fmtMoney(pt.balance || 0) + ' 两</span>'+
        '</div>'+
        '<div style="font-size:0.66rem;color:var(--txt-d);margin-top:2px;">只读镜像 · 岗位 publicTreasury</div>'+
        '</div>';
    }
    // 区域公库
    if (!pt.linkedRegion) return '';
    var deficitNote = pt.lastHandoverDeficit > 0 ?
      '<div style="font-size:0.66rem;color:var(--vermillion-400);margin-top:2px;">⚠ 前任留空 ' + fmtMoney(pt.lastHandoverDeficit) + ' 两</div>' : '';
    return '<div style="padding:6px 10px;background:rgba(184,154,83,0.08);border-left:3px solid var(--gold-d);border-radius:3px;margin-bottom:8px;">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;">'+
        '<span style="font-size:0.76rem;color:var(--gold);">公库（绑定：' + _escHtml(pt.linkedRegion) + '）</span>'+
        '<span style="font-size:0.8rem;color:var(--txt);font-weight:500;">' + fmtMoney(pt.balance || 0) + ' 两</span>'+
      '</div>'+
      '<div style="font-size:0.66rem;color:var(--txt-d);margin-top:2px;">只读镜像 · 实际在地方 fiscal 中</div>'+
      deficitNote +
      '</div>';
  }

  // ─── 本月流水 ───
  function renderTickSummary(ch) {
    var inc = ch._lastTickIncome || {};
    var exp = ch._lastTickExpense || {};
    var incLabels = {
      salary:'俸禄', salaryGrain:'俸米', imperialReward:'赏赐',
      commerce:'经营', rent:'田租', bribes:'贿赂', embezzle:'挪用',
      extortion:'勒索', inheritance:'继承', tributeShare:'贡分',
      examReward:'科举赏', templeDonation:'香火', militaryReward:'军功',
      personalTribute:'投献'
    };
    var expLabels = {
      livingCost:'生活', servants:'家仆', socialFee:'迎送', feasts:'宴饮',
      estate:'宅第', patronage:'驭下', clanSupport:'扶亲',
      religiousOffering:'香火', education:'教子', medicine:'医药',
      fines:'罚款', lifeEvents:'婚丧', debtInterest:'息钱', gambling:'赌博'
    };
    var incTotal = 0, expTotal = 0;
    for (var ik in inc) incTotal += inc[ik];
    for (var ek in exp) expTotal += exp[ek];
    var net = incTotal - expTotal;
    var netColor = net >= 0 ? '#6aa88a' : 'var(--vermillion-400)';

    var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.74rem;">';

    // 收入
    html += '<div style="background:var(--bg-2);padding:6px 8px;border-radius:3px;border-top:2px solid #6aa88a;">';
    html += '<div style="color:#6aa88a;font-weight:600;margin-bottom:3px;">本月收入 ' + fmtMoney(incTotal) + '</div>';
    var incKeys = Object.keys(inc).filter(function(k) { return inc[k] > 0; });
    if (incKeys.length > 0) {
      incKeys.slice(0, 5).forEach(function(k) {
        var isCorr = (k === 'bribes' || k === 'embezzle' || k === 'extortion');
        html += '<div style="display:flex;justify-content:space-between;font-size:0.7rem;color:' + (isCorr ? 'var(--vermillion-400)' : 'var(--txt-d)') + ';">'+
          '<span>' + (incLabels[k]||k) + '</span>'+
          '<span>' + fmtMoney(inc[k]) + '</span></div>';
      });
    } else {
      html += '<div style="color:var(--txt-d);">—</div>';
    }
    html += '</div>';

    // 支出
    html += '<div style="background:var(--bg-2);padding:6px 8px;border-radius:3px;border-top:2px solid var(--vermillion-400);">';
    html += '<div style="color:var(--vermillion-400);font-weight:600;margin-bottom:3px;">本月支出 ' + fmtMoney(expTotal) + '</div>';
    var expKeys = Object.keys(exp).filter(function(k) { return exp[k] > 0; });
    if (expKeys.length > 0) {
      expKeys.slice(0, 5).forEach(function(k) {
        html += '<div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--txt-d);">'+
          '<span>' + (expLabels[k]||k) + '</span>'+
          '<span>' + fmtMoney(exp[k]) + '</span></div>';
      });
    } else {
      html += '<div style="color:var(--txt-d);">—</div>';
    }
    html += '</div>';

    html += '</div>';

    // 净值
    html += '<div style="margin-top:4px;padding:3px 8px;background:var(--bg-2);border-radius:3px;font-size:0.74rem;display:flex;justify-content:space-between;">'+
      '<span style="color:var(--txt-d);">本月净余</span>'+
      '<span style="color:' + netColor + ';font-weight:600;">' + (net > 0 ? '+' : '') + fmtMoney(net) + ' 两</span>'+
      '</div>';
    return html;
  }

  // ─── 字（courtesy name）展示 ───
  function renderCourtesyName(ch) {
    if (!ch.zi) return '';
    return '<span style="color:var(--gold-l);font-style:italic;font-size:0.78rem;margin-left:8px;">字「' + _escHtml(ch.zi) + '」</span>';
  }

  // ═════════════════════════════════════════════════════════════
  // 主渲染：整段"资源"区块
  // ═════════════════════════════════════════════════════════════

  function renderCharResourcesSection(ch) {
    if (!ch) return '';
    if (typeof CharEconEngine !== 'undefined') {
      try { CharEconEngine.ensureCharResources(ch); } catch(_){}
      try { CharEconEngine.updatePublicTreasuryMirror(ch); } catch(_){}
    }
    if (!ch.resources) return '';

    var r = ch.resources;
    var canSeeHidden = (GM.corruption && GM.corruption.supervision &&
                        GM.corruption.supervision.level >= 60) || ch.isPlayer;

    var html = '<div class="char-detail-section">'+
      '<div class="char-detail-section-title">资源 · 六柄 ' + renderCourtesyName(ch) + '</div>';

    // 公库（皇帝=帑廪3列 / 官员=岗位公库 / 地方官=区域公库）
    if (r.publicTreasury && (r.publicTreasury.isGuoku || r.publicTreasury.linkedPost || r.publicTreasury.linkedRegion)) {
      html += renderPublicTreasury(r.publicTreasury);
    }

    // 私产（皇帝=内帑3列 / 其他=五大类）
    var pwLabel = (r.privateWealth && r.privateWealth.isNeitang) ? '私库（内帑）' : '私产';
    html += '<div style="font-size:0.74rem;color:var(--txt-d);margin-bottom:4px;">' + pwLabel + '</div>';
    html += renderPrivateWealth(r.privateWealth, r.hiddenWealth, canSeeHidden);

    // 名望 + 贤能（两栏）
    html += '<div style="display:grid;grid-template-columns:1fr 1.2fr;gap:8px;margin-top:10px;">';
    html += '<div>';
    html += '<div style="font-size:0.74rem;color:var(--txt-d);margin-bottom:4px;">名望</div>';
    html += renderFameSeal(r.fame);
    html += '</div>';
    html += '<div>';
    html += '<div style="font-size:0.74rem;color:var(--txt-d);margin-bottom:4px;">贤能</div>';
    html += renderVirtueBadge(r.virtueMerit, r.virtueStage);
    html += '</div>';
    html += '</div>';

    // 健康 + 压力（两栏）
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;">';
    html += renderBar('健康', ch.health || 70, 100, function(v) {
      return v > 70 ? '#6aa88a' : v > 40 ? 'var(--gold-400)' : 'var(--vermillion-400)';
    });
    html += renderBar('压力', ch.stress || 20, 100, function(v) {
      return v < 30 ? '#6aa88a' : v < 60 ? 'var(--amber-400)' : 'var(--vermillion-400)';
    });
    html += '</div>';

    // integrity（仅演义模式或监察强时）
    var mode = (typeof P !== 'undefined' && P.conf && P.conf.gameMode) || 'light-history';
    if (mode === 'romance' || (GM.corruption && GM.corruption.supervision && GM.corruption.supervision.level > 50)) {
      var intg = ch.integrity || 50;
      var intgColor = intg > 75 ? '#6aa88a' : intg > 50 ? 'var(--gold)' : intg > 30 ? 'var(--amber-400)' : 'var(--vermillion-400)';
      html += '<div style="margin-top:8px;padding:4px 8px;background:var(--bg-2);border-radius:3px;display:flex;justify-content:space-between;font-size:0.74rem;">'+
        '<span style="color:var(--txt-d);">廉洁度</span>'+
        '<span style="color:' + intgColor + ';">' + Math.round(intg) + ' / 100</span>'+
        '</div>';
    }

    // 阶层标签
    if (ch.socialClass) {
      var classLabels = {
        imperial:'皇族', noble:'勋贵', civilOfficial:'文官', militaryOfficial:'武官',
        merchant:'商人', landlord:'地主', clergy:'僧道', commoner:'平民'
      };
      html += '<div style="margin-top:6px;padding:2px 8px;background:var(--bg-2);border-radius:3px;display:inline-block;font-size:0.7rem;color:var(--gold-l);">'+
        '阶层：' + (classLabels[ch.socialClass] || ch.socialClass) + '</div>';
    }

    // 本月流水
    if (ch._lastTickIncome || ch._lastTickExpense) {
      html += '<div style="margin-top:10px;">'+
        '<div style="font-size:0.74rem;color:var(--txt-d);margin-bottom:4px;">本月流水</div>';
      html += renderTickSummary(ch);
      html += '</div>';
    }

    // 动作按钮（若是官员且有人可以被抄家）
    if (ch.officialTitle && !ch.retired && !ch.dead) {
      html += '<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">';
      if (canSeeHidden || ch.integrity < 40) {
        html += '<button class="bt bs bsm" style="border-color:var(--vermillion-400);color:var(--vermillion-400);" '+
          'onclick="_charConfiscate(\'' + _escHtml(ch.name) + '\')">⚔ 抄家</button>';
      }
      html += '<button class="bt bs bsm" onclick="_charInspect(\'' + _escHtml(ch.name) + '\')">🔍 派员查案</button>';
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  // ─── 抄家动作 ───
  function _charConfiscate(charName) {
    if (typeof CharEconEngine === 'undefined') return;
    var ch = (GM.chars || []).find(function(c) { return c.name === charName; });
    if (!ch) return;
    var visible = (ch.resources.privateWealth.cash || 0) +
                  (ch.resources.privateWealth.land || 0) * 5 +
                  (ch.resources.privateWealth.treasure || 0) +
                  (ch.resources.privateWealth.commerce || 0);
    var html = '<div style="padding:1rem;">'+
      '<h4 style="color:var(--vermillion-400);margin-bottom:0.6rem;">抄没' + _escHtml(charName) + '</h4>'+
      '<p style="font-size:0.82rem;line-height:1.6;color:var(--txt);margin-bottom:0.8rem;">'+
        '明显家产：' + fmtMoney(visible) + ' 两。'+
        '隐匿藏款需深挖（intensity 越高越多）。'+
      '</p>'+
      '<div style="margin-bottom:0.6rem;">'+
        '<label style="font-size:0.78rem;display:block;margin-bottom:4px;">intensity（挖掘强度 0.3-1.0）</label>'+
        '<input id="confIntensity" type="number" min="0.3" max="1.0" step="0.1" value="0.6" style="width:100%;padding:5px 8px;">'+
      '</div>'+
      '<div style="margin-bottom:0.6rem;">'+
        '<label style="display:flex;align-items:center;gap:6px;font-size:0.78rem;">'+
          '<input id="confClan" type="checkbox"> 株连亲族'+
        '</label>'+
      '</div>'+
      '<div style="margin-bottom:0.6rem;">'+
        '<label style="font-size:0.78rem;display:block;margin-bottom:4px;">归入</label>'+
        '<select id="confDest" style="width:100%;padding:5px 8px;">'+
          '<option value="neitang">内帑（典例）</option>'+
          '<option value="guoku">帑廪</option>'+
        '</select>'+
      '</div></div>';
    if (typeof openGenericModal === 'function') {
      openGenericModal('抄家 · ' + charName, html, function() {
        var intensity = Number((document.getElementById('confIntensity')||{}).value) || 0.6;
        var includeClan = !!(document.getElementById('confClan')||{}).checked;
        var dest = (document.getElementById('confDest')||{}).value || 'neitang';
        var r = CharEconEngine.confiscate(ch, { intensity: intensity, includeClan: includeClan, destination: dest });
        if (r.success) {
          if (typeof toast === 'function') toast('抄没 ' + Math.round(r.total/10000) + ' 万两');
        } else {
          if (typeof toast === 'function') toast('未成：' + r.reason);
        }
        if (typeof closeGenericModal === 'function') closeGenericModal();
        // 刷新面板
        var ov = document.getElementById('_charDetailOv');
        if (ov && ov.classList.contains('open') && typeof openCharDetail === 'function') {
          openCharDetail(charName);
        }
        if (typeof renderTopBarVars === 'function') renderTopBarVars();
      });
    }
  }

  function _charInspect(charName) {
    if (typeof toast === 'function') toast('派员查案：' + charName + ' 数回合后返回');
    // Hook: 创建一个 investigation event
    if (!GM._charInvestigations) GM._charInvestigations = [];
    GM._charInvestigations.push({
      target: charName, startTurn: GM.turn, returnTurn: GM.turn + 3
    });
  }

  // ═════════════════════════════════════════════════════════════
  // 导出
  // ═════════════════════════════════════════════════════════════

  global.renderCharResourcesSection = renderCharResourcesSection;
  global._charConfiscate = _charConfiscate;
  global._charInspect = _charInspect;

  console.log('[charEcon-ui] 角色资源 UI 已加载：6 资源展示 + 抄家 + 派员');

})(typeof window !== 'undefined' ? window : this);

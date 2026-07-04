// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-keju-reform-rollback.js — Stage 2·Phase L·Slice L11·改革反复 rollback + 跨剧本承袭 UI
 *
 * 职责·
 *   1·rollback 机制·废止已 ramping/active/matured 改革·复用 keyi 'reform' + intent='rollback'
 *   2·跨剧本承袭 UI announce modal (L8 archive + scenario hook 已 wired·此处只补 UI)
 *
 * 暴露·
 *   _kjpL11OpenRollbackModal(targetEntry)         — 开 sub-modal
 *   _kjpL11RenderRollbackContent(targetEntry)     — DOM build
 *   _kjpL11BuildReverseDiff(entry, mode, keep)    — 算反向 diff·_reverseSnapshot 优先
 *   _kjpL11SubmitRollback(entry, mode, keep)      — 提交·openKeyiSession
 *   _kjpL11FlipTargetReform(entry, newId)         — 标 'rolled_back' + 清 ip
 *   _kjpL11ApplyRollbackCharsImpact(t, o, n)      — mirror chars·weight half
 *   _kjpL11ApplyL10RollbackPreset(preset, modal)  — L10 rollback tag 路径·有 target 走 rollback·无 target fallback restoration
 *   _kjpL11RenderInheritanceModal(verdict, arc)   — L8 callback·announce modal
 *   _kjpL11RenderTimelineRollbackButton(entry)    — panel chronicle 渲 [废止] button
 *
 * red line·
 *   - flag gate·P.conf.useNewKejuL11=false 全 noop (需 L7+L8+L9 同 enable)
 *   - 失败禁玄幻·rollback 失败·政治后果 (chars 反喷 + 名望 -·非天命)
 *   - 工具 vs 系统·rollback 是系统型 (走 keyi + chars + memorial)
 *   - 保 keyi 800 行·走现 KEYI_TOPIC_TYPES.reform + 新 intent
 *   - audit-first·doc v2·18 项 fix 已入卷·实施严格对齐
 */
(function(global) {
  'use strict';

  // ════════════════════════════════════════════════════════════════
  // §0·gate·_isL11Enabled
  // ════════════════════════════════════════════════════════════════

  function _isL11Enabled() {
    if (typeof P === 'undefined' || !P || !P.conf) return false;
    return P.conf.useNewKejuL11 !== false;
  }

  function _isL7Enabled() {
    if (typeof P === 'undefined' || !P || !P.conf) return false;
    return P.conf.useNewKejuL7 !== false;
  }

  function _escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c];
    });
  }

  // ════════════════════════════════════════════════════════════════
  // §1·timeline [废止] button render·panel chronicle 用
  //    gate·status ∈ {ramping/active/matured} && !rolled_back && !rollback-tag && L11 enabled
  // ════════════════════════════════════════════════════════════════

  function _kjpL11RenderTimelineRollbackButton(entry) {
    if (!_isL11Enabled()) return '';
    if (!entry || !entry.id) return '';
    var s = entry.status || '';
    if (s !== 'ramping' && s !== 'active' && s !== 'matured') return '';
    if (s === 'rolled_back') return '';
    // C1·rollback 自己不可再 rollback·防 chain 无终
    var tags = entry.tags || [];
    if (tags.indexOf && tags.indexOf('rollback') >= 0) return '';
    return '<button class="bt bsm kjp-l11-rollback-btn" data-rid="' +
           _escHtml(entry.id) + '">⟲ 废止</button>';
  }

  // ════════════════════════════════════════════════════════════════
  // §2·rollback sub-modal·open + render
  // ════════════════════════════════════════════════════════════════

  function _kjpL11OpenRollbackModal(targetEntry) {
    if (!_isL11Enabled() || !_isL7Enabled()) {
      try { if (typeof toast === 'function') toast('L11/L7 未启用'); } catch(_){}
      return;
    }
    if (!targetEntry || !targetEntry.id) return;
    // dedup·若已开同 target modal·先 remove
    try {
      var existing = document.getElementById('kjp-l11-rollback-modal');
      if (existing) existing.remove();
    } catch(_){}
    var modal = document.createElement('div');
    modal.id = 'kjp-l11-rollback-modal';
    modal.className = 'kjp-modal kjp-l11-rollback-modal';
    modal.innerHTML =
      '<div class="kjp-modal-content kjp-l11-rollback-content">' +
        '<div class="kjp-modal-header">' +
          '<div class="kjp-modal-title">⟲ 废止改革·' +
            _escHtml(targetEntry.canonicalName || targetEntry.magnitudeDescriptor || '改革') +
          '</div>' +
          '<button class="bt bs bsm kjp-l11-close-btn">✕</button>' +
        '</div>' +
        '<div class="kjp-modal-body">' +
          _kjpL11RenderRollbackContent(targetEntry) +
        '</div>' +
        '<div class="kjp-modal-footer">' +
          '<button class="bt bsm kjp-l11-cancel-btn">取消</button>' +
          '<button class="bt bsm bs-primary kjp-l11-submit-btn">▶ 发起议政</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    // store target on modal
    modal._kjpL11Target = targetEntry;
    modal._kjpL11Mode = 'full';
    modal._kjpL11Keep = [];

    modal.addEventListener('click', function(e) {
      var t = e.target;
      if (!t || !t.classList) return;
      if (t.classList.contains('kjp-l11-close-btn') ||
          t.classList.contains('kjp-l11-cancel-btn')) {
        try { modal.remove(); } catch(_){}
        return;
      }
      if (t.classList.contains('kjp-l11-mode-radio')) {
        modal._kjpL11Mode = t.value || t.dataset.mode || 'full';
        return;
      }
      if (t.classList.contains('kjp-l11-keep-cb')) {
        var sid = t.dataset.sid;
        if (!sid) return;
        var keep = modal._kjpL11Keep || (modal._kjpL11Keep = []);
        if (t.checked) { if (keep.indexOf(sid) < 0) keep.push(sid); }
        else { var idx = keep.indexOf(sid); if (idx >= 0) keep.splice(idx, 1); }
        return;
      }
      if (t.classList.contains('kjp-l11-submit-btn')) {
        try {
          _kjpL11SubmitRollback(targetEntry, modal._kjpL11Mode, modal._kjpL11Keep);
          modal.remove();
        } catch (err) { try { console.warn('[L11·submit]', err); } catch(_){} }
        return;
      }
    });
    modal.addEventListener('change', function(e) {
      var t = e.target;
      if (!t || !t.classList) return;
      if (t.classList.contains('kjp-l11-mode-radio')) {
        modal._kjpL11Mode = t.value || 'full';
      }
    });
  }

  function _kjpL11RenderRollbackContent(targetEntry) {
    var radical = (targetEntry.magnitudeParsed && targetEntry.magnitudeParsed.radical) || 0;
    var supList = _kjpL11RenderNpcList(targetEntry.supportNpcs || [], '将转反对');
    var oppList = _kjpL11RenderNpcList(targetEntry.opposeNpcs || [], '将转支持');

    // subjects keep (partial mode 用)·从 _reverseSnapshot 或 diff
    var addedSubjects = _kjpL11ReadAddedSubjects(targetEntry);
    var keepHtml = '';
    // RAA·A7·partial mode·若无 addedSubjects·提示 user 选 partial 无意义·radio 仍显但 disabled
    var partialDisabled = !addedSubjects.length;
    if (addedSubjects.length) {
      keepHtml = '<div class="kjp-l11-keep-section">' +
        '<div class="kjp-l11-section-title">partial mode·勾选保留的科目 (不勾→去除)·</div>' +
        addedSubjects.map(function(s) {
          return '<label class="kjp-l11-keep-label">' +
            '<input type="checkbox" class="kjp-l11-keep-cb" data-sid="' +
              _escHtml(s.id || s.name) + '">' +
            ' ' + _escHtml(s.name) + '</label>';
        }).join('') +
      '</div>';
    }
    // RAA·B4·degraded warn·若无 diff + 无 _reverseSnapshot·rollback 退化为 reset·UI 提前告知
    var degradedWarn = '';
    if (!targetEntry.diff && !targetEntry._reverseSnapshot) {
      degradedWarn =
        '<div class="kjp-l11-degraded-warn">' +
        '⚠️ 改革无 diff snapshot·rollback 退化为 reset to preset·实际效果同"复古"' +
        '</div>';
    }
    // RBB·E1·preview reverseDiff·若含 _warnStubRestores·UI 告知 user
    // (preview 用 full mode·user 真 submit 时 mode 可能改·但 stub warn 仅在 restore 时出·full/pivot 才有)
    var stubWarn = '';
    try {
      var previewRev = _kjpL11BuildReverseDiff(targetEntry, 'full', []);
      if (previewRev && Array.isArray(previewRev._warnStubRestores) &&
          previewRev._warnStubRestores.length) {
        stubWarn =
          '<div class="kjp-l11-stub-warn">' +
          '⚠️ 复原科目无完整 snapshot·将 default ideology=traditional·建议 user apply 后手动校 ' +
          '(' + previewRev._warnStubRestores.map(_escHtml).join('、') + ')' +
          '</div>';
      }
    } catch(_){}

    return '<div class="kjp-l11-rollback-body">' +
      degradedWarn +
      stubWarn +
      '<div class="kjp-l11-target-info">' +
        '<b>目标·</b>' + _escHtml(targetEntry.magnitudeDescriptor || '') +
        ' (' + _escHtml(targetEntry.by || '') + '·' + (targetEntry.year || 0) + '年·' +
        _escHtml(targetEntry.status || '') + ')' +
      '</div>' +
      '<div class="kjp-l11-mode-section">' +
        '<div class="kjp-l11-section-title">反复 mode·</div>' +
        '<label class="kjp-l11-mode-label' + (partialDisabled ? ' kjp-l11-mode-disabled' : '') + '">' +
          '<input type="radio" name="kjp-l11-mode" class="kjp-l11-mode-radio" value="partial"' +
            (partialDisabled ? ' disabled' : '') + '>' +
          ' partial·部分回滚 (保留勾选科目)' +
          (partialDisabled ? ' <span class="kjp-l11-disabled-hint">·无新加科·不适用</span>' : '') +
        '</label>' +
        '<label class="kjp-l11-mode-label"><input type="radio" name="kjp-l11-mode" ' +
          'class="kjp-l11-mode-radio" value="full" checked> full·全面更化 (还原至 pre-reform)</label>' +
        '<label class="kjp-l11-mode-label"><input type="radio" name="kjp-l11-mode" ' +
          'class="kjp-l11-mode-radio" value="pivot"> pivot·改革再造 ' +
          '<span class="kjp-l11-disabled-hint">(暂同 full·"加新" 待 L12·user 后续手动 propose 新 reform)</span>' +
          '</label>' +
      '</div>' +
      keepHtml +
      '<div class="kjp-l11-impact-section">' +
        '<div class="kjp-l11-section-title">将受影响·</div>' +
        supList + oppList +
      '</div>' +
      '<div class="kjp-l11-hint">' +
        '<b>史评 hint·</b>radical=' + radical + '·' +
        (radical >= 70 ? '朝野震动·根基或动' :
         radical >= 40 ? '反对沸然·需主上 / 重臣坐镇' :
         '小幅调整·阻力可控') +
      '</div>' +
    '</div>';
  }

  // A3·alive filter·dead/retired 灰色
  // RAA·A3·count 用全 names·非 slice 12 内·"显 12·共 N (alive K)"
  function _kjpL11RenderNpcList(names, label) {
    if (!names || !names.length) return '';
    // 全 list count·真 alive/dead 总数
    var totalAlive = 0, totalDead = 0;
    names.forEach(function(n) {
      var ch = (typeof findCharByName === 'function') ? findCharByName(n) : null;
      if (ch && ch.alive !== false && !ch._retired) totalAlive++; else totalDead++;
    });
    var html = '<div class="kjp-l11-npc-list"><b>' + _escHtml(label) + '·</b>';
    var displayed = names.slice(0, 12);
    html += displayed.map(function(n) {
      var ch = (typeof findCharByName === 'function') ? findCharByName(n) : null;
      var isAlive = ch && ch.alive !== false && !ch._retired;
      var cls = isAlive ? '' : ' kjp-l11-npc-dead';
      var suffix = !ch ? ''
                 : ch.alive === false ? '·已亡'
                 : ch._retired ? '·已退'
                 : '';
      return '<span class="kjp-l11-npc' + cls + '">' + _escHtml(n) + suffix + '</span>';
    }).join('·');
    var displayHint = (names.length > 12) ? ('·显 12/共 ' + names.length) : '';
    html += '<span class="kjp-l11-npc-count"> (alive ' + totalAlive + '/已亡退 ' +
            totalDead + displayHint + ')</span>';
    html += '</div>';
    return html;
  }

  function _kjpL11ReadAddedSubjects(entry) {
    if (!entry) return [];
    // 优先 diff (未 prune)
    if (entry.diff && entry.diff.subjects && Array.isArray(entry.diff.subjects.added)) {
      return entry.diff.subjects.added.slice();
    }
    // _reverseSnapshot (matured 后)
    if (entry._reverseSnapshot && Array.isArray(entry._reverseSnapshot.addedSubjectIds)) {
      var ids = entry._reverseSnapshot.addedSubjectIds;
      var names = entry._reverseSnapshot.addedSubjectNames || [];
      return ids.map(function(id, i) {
        return { id: id, name: names[i] || id };
      });
    }
    return [];
  }

  // ════════════════════════════════════════════════════════════════
  // §3·reverseDiff 算·B3·_reverseSnapshot 优先 (matured 后唯一可靠源)
  // ════════════════════════════════════════════════════════════════

  function _kjpL11BuildReverseDiff(targetEntry, rollbackMode, partialKeep) {
    if (!targetEntry) return null;
    partialKeep = partialKeep || [];
    rollbackMode = rollbackMode || 'full';

    // 1·优先 diff (未 prune)
    if (targetEntry.diff && !targetEntry._diffPruned) {
      return _buildFromDiff(targetEntry.diff, rollbackMode, partialKeep);
    }
    // 2·matured 后·diff = null·走 _reverseSnapshot
    if (targetEntry._reverseSnapshot) {
      return _buildFromSnapshot(targetEntry._reverseSnapshot, rollbackMode, partialKeep);
    }
    // 3·都无·degraded·走 _kjpResetToPreset 全 reset (类 'restoration')
    return {
      _degradedReset: true,
      _era: (typeof GM !== 'undefined' && GM && GM._kejuParadigm && GM._kejuParadigm.initEra) || 'tang',
      subjects: { added: [], removed: [], weightChanged: [] }
    };
  }

  function _buildFromDiff(diff, mode, keep) {
    var rev = { subjects: { added: [], removed: [], weightChanged: [] } };
    var addedList = (diff.subjects && diff.subjects.added) || [];
    var removedList = (diff.subjects && diff.subjects.removed) || [];
    var weightList = (diff.subjects && diff.subjects.weightChanged) || [];

    if (mode === 'partial') {
      // 保留 keep 列出的·其余 reverse (added → removed)
      addedList.forEach(function(s) {
        if (!s || !s.id) return;
        if (keep.indexOf(s.id) >= 0 || keep.indexOf(s.name) >= 0) return;   // 保留
        rev.subjects.removed.push({ id: s.id, name: s.name });
      });
      // RAA·B1·partial mode 也 reverse weightChanged·old↔new (除 keep 中)
      weightList.forEach(function(w) {
        if (!w || !w.id) return;
        if (keep.indexOf(w.id) >= 0) return;
        if (typeof w.oldW === 'number') {
          rev.subjects.weightChanged.push({ id: w.id, oldW: w.newW, newW: w.oldW });
        }
      });
      // partial 不 restore 原 removed (避免 cascade)
    } else {
      // full / pivot·全 reverse
      addedList.forEach(function(s) {
        if (!s || !s.id) return;
        rev.subjects.removed.push({ id: s.id, name: s.name });
      });
      // RAA·B2·原 removed restore·尝试从 paradigm.subjects 历史 (已不在·走 stub)
      // 若 stubFromName 找不到真值·入 _restoreUnknown 列表·UI 警告 user
      var unknownRestores = [];
      removedList.forEach(function(s) {
        if (!s || !s.id) return;
        // B2·尝试从其他 history entry 找 introducedBy 信息·或走 stub 但标记 _stubDefaults
        var stubSubject = Object.assign({
          weight: 20, ideology: 'traditional', format: '', historicalAnalog: '',
          _restoreFromRollback: true,
          _stubDefaults: !(s.weight != null && s.ideology)   // 标记·UI 警 user 字段不全
        }, s);
        if (stubSubject._stubDefaults) unknownRestores.push(s.name || s.id);
        rev.subjects.added.push(stubSubject);
      });
      if (unknownRestores.length) {
        rev._warnStubRestores = unknownRestores;   // UI 渲时可显·"复原科目无详·默 traditional"
      }
      // RAA·B1·full / pivot 也 reverse weightChanged
      weightList.forEach(function(w) {
        if (!w || !w.id) return;
        if (typeof w.oldW === 'number') {
          rev.subjects.weightChanged.push({ id: w.id, oldW: w.newW, newW: w.oldW });
        }
      });
      // ideology·Q2·partial 不动·full / pivot 才 reverse
      if (diff.ideology) {
        rev.ideology = { new: diff.ideology.old, old: diff.ideology.new };
      }
      // examInterval / retakePolicy·flat
      if (diff.examInterval && diff.examInterval.old != null) {
        rev.examInterval = { new: diff.examInterval.old, old: diff.examInterval.new };
      }
      if (diff.retakePolicy && diff.retakePolicy.old) {
        rev.retakePolicy = { new: diff.retakePolicy.old, old: diff.retakePolicy.new };
      }
    }
    return rev;
  }

  function _buildFromSnapshot(snap, mode, keep) {
    var rev = { subjects: { added: [], removed: [], weightChanged: [] } };
    var addedIds = snap.addedSubjectIds || [];
    var addedNames = snap.addedSubjectNames || [];

    if (mode === 'partial') {
      addedIds.forEach(function(id, i) {
        if (keep.indexOf(id) >= 0 || keep.indexOf(addedNames[i]) >= 0) return;
        rev.subjects.removed.push({ id: id, name: addedNames[i] || id });
      });
      // RAA·B1·snapshot weightChanged 反 (snap 含 weightChangedOld)
      (snap.weightChangedOld || []).forEach(function(w) {
        if (!w || !w.id) return;
        if (keep.indexOf(w.id) >= 0) return;
        rev.subjects.weightChanged.push({ id: w.id, oldW: w.newW, newW: w.oldW });
      });
    } else {
      // full / pivot
      addedIds.forEach(function(id, i) {
        rev.subjects.removed.push({ id: id, name: addedNames[i] || id });
      });
      (snap.removedSubjectSnapshots || []).forEach(function(s) {
        if (!s || !s.id) return;
        // RAA·B2·snapshot 已含完整 subject 字段·直 restore·无 stub
        rev.subjects.added.push(Object.assign({ _restoreFromRollback: true }, s));
      });
      (snap.weightChangedOld || []).forEach(function(w) {
        if (!w || !w.id) return;
        rev.subjects.weightChanged.push({ id: w.id, oldW: w.newW, newW: w.oldW });
      });
      if (snap.ideologyOld != null) {
        rev.ideology = { new: snap.ideologyOld, old: null };
      }
      if (snap.examIntervalOld != null) {
        rev.examInterval = { new: snap.examIntervalOld, old: null };
      }
      if (snap.retakePolicyOld != null) {
        rev.retakePolicy = { new: snap.retakePolicyOld, old: null };
      }
    }
    return rev;
  }

  // ════════════════════════════════════════════════════════════════
  // §4·提交 rollback·走现 keyi reform path
  // ════════════════════════════════════════════════════════════════

  function _kjpL11SubmitRollback(targetEntry, rollbackMode, partialKeep) {
    if (!_isL11Enabled() || !_isL7Enabled()) return;
    if (!targetEntry || !targetEntry.id) return;
    // RBB·E2·gate·targetEntry 自身已 'rollback' tag·禁 chain 无终
    // (UI button 已 gate·但 programmatic submit / 测试代码 / L10 fallback 可能绕过·此处兜底)
    var tags = targetEntry.tags || [];
    if (tags.indexOf && tags.indexOf('rollback') >= 0) {
      try {
        if (typeof toast === 'function') toast('⚠️ rollback 自己不可再 rollback·禁链无终');
        else console.warn('[L11·submit] rollback chain blocked');
      } catch(_){}
      return;
    }
    // RBB·E2·gate·targetEntry 已 rolled_back·禁 double-rollback
    if (targetEntry.status === 'rolled_back') {
      try {
        if (typeof toast === 'function') toast('⚠️ 改革已废·不可再废');
      } catch(_){}
      return;
    }
    var reverseDiff = _kjpL11BuildReverseDiff(targetEntry, rollbackMode, partialKeep);
    if (!reverseDiff) return;

    var radical = (targetEntry.magnitudeParsed && targetEntry.magnitudeParsed.radical) || 50;
    var magnitudeDescriptor = '罢 ' + (targetEntry.canonicalName || targetEntry.magnitudeDescriptor || '改革') +
                              '·' + (rollbackMode === 'partial' ? '部分回滚'
                                   : rollbackMode === 'pivot'   ? '改革再造'
                                   : '全面更化');

    var topicData = {
      topicType: 'reform',
      topic: magnitudeDescriptor,
      intent: 'rollback',
      paradigmDiff: reverseDiff,
      magnitudeDescriptor: magnitudeDescriptor,
      magnitudeParsed: {
        scale: radical >= 70 ? 'major' : 'moderate',
        radical: radical,
        years: 0, reversible: true,
        tags: ['rollback', rollbackMode === 'pivot' ? 're_reform' : 'restoration'],
        paraphrase: magnitudeDescriptor
      },
      pilotScope: { kind: 'national' },
      rollbackTargetId: targetEntry.id,
      rollbackMode: rollbackMode,
      rollbackKeep: (partialKeep || []).slice()
    };

    try {
      if (typeof openKeyiSession === 'function') {
        openKeyiSession({ topicType: 'reform', topicData: topicData });
      } else if (typeof window !== 'undefined' && typeof window.openKeyiSession === 'function') {
        window.openKeyiSession({ topicType: 'reform', topicData: topicData });
      } else {
        try { console.warn('[L11·submit] openKeyiSession 未定义'); } catch(_){}
      }
    } catch (e) { try { console.warn('[L11·submit]', e); } catch(_){} }
  }

  // ════════════════════════════════════════════════════════════════
  // §5·flip target reform·标 'rolled_back' + clear ip
  // ════════════════════════════════════════════════════════════════

  function _kjpL11FlipTargetReform(targetEntry, newEntryId) {
    if (!targetEntry || !targetEntry.id) return;
    targetEntry.status = 'rolled_back';
    targetEntry.rolledBackBy = newEntryId;                    // C3·双向 link
    targetEntry.rolledBackYear = (typeof GM !== 'undefined' && GM && GM.year) || 0;
    // RBB·F3·清 ramp-up/mature 时间戳·标 _rampUpAborted·防 L18 timeline UI 渲假数据 "将熟于 X 年"
    targetEntry._rampUpAborted = true;
    if (targetEntry.status === 'rolled_back' && targetEntry.matureYear) {
      targetEntry._matureYearOriginal = targetEntry.matureYear;   // 留 audit·非 wipe
      targetEntry.matureYear = null;
    }
    // clear _reformInProgress·若指 target
    if (typeof GM !== 'undefined' && GM && GM._kejuParadigm) {
      var ip = GM._kejuParadigm._reformInProgress;
      if (ip && ip.histId === targetEntry.id) {
        GM._kejuParadigm._reformInProgress = null;
        GM._kejuParadigm._applyDelay = 0;
      }
    }
    // B4·L8 evolve cooldown reset·防 L8 tick 持续 hit rolled_back entry
    targetEntry._l8FailCount = 0;
    targetEntry._lastEvolveYear = 0;
    // B4·chronicle text 保留·L8 evolve tick filter (status ∈ ramping/active) 自动 skip
  }

  // ════════════════════════════════════════════════════════════════
  // §6·chars impact·mirror·B5·weight half·防 NPC memory 叠加爆
  // ════════════════════════════════════════════════════════════════

  function _kjpL11ApplyRollbackCharsImpact(targetEntry, outcome, newEntry) {
    if (!targetEntry || !outcome || !newEntry) return;
    var turn = (typeof GM !== 'undefined' && GM && GM.turn) || 0;

    // mirror·原 support·rollback 反对者·reformLean 倒一半 + remember "心有不甘"
    (targetEntry.supportNpcs || []).forEach(function(name) {
      var ch = (typeof findCharByName === 'function') ? findCharByName(name) : null;
      if (!ch || ch.alive === false || ch._retired) return;
      // reformLean 倒一半 (原 support·rollback 视为反对)
      var leanDelta = -8;   // mirror half of typical +15
      if (typeof _kjpAccumReformLean === 'function') {
        try { _kjpAccumReformLean(ch, leanDelta, turn); } catch(_){}
      }
      _kjpL11RememberHalf(name, '朝议罢 ' +
        (targetEntry.canonicalName || targetEntry.magnitudeDescriptor || '前改') +
        '·心有不甘', '怨', 4);
      // 30% 概率挂冠 (高 radical + alive + low loyalty)
      var radical = (outcome.magnitudeParsed && outcome.magnitudeParsed.radical) ||
                    (newEntry.magnitudeParsed && newEntry.magnitudeParsed.radical) || 0;
      if (radical >= 70 && !ch._retired && parseInt(ch.loyalty, 10) < 30) {
        if (Math.random() < 0.3) {
          ch._retired = true;
          ch._retireReason = '不忍前改罢·挂冠归田';
          ch._retiredTurn = turn;
          try {
            if (Array.isArray(GM._chronicle)) {
              if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
                turn: turn, type: 'reform-rollback-retirement',
                text: ch.name + '·致仕·疏曰"前改罢·老臣心已死"',
                tags: ['科举', 'rollback', 'retirement'],
                reformId: newEntry.id
              });
            }
          } catch(_){}
        }
      }
    });

    // mirror·原 oppose·rollback 支持者·reformLean 倒一半 + remember "如释重负"
    (targetEntry.opposeNpcs || []).forEach(function(name) {
      var ch = (typeof findCharByName === 'function') ? findCharByName(name) : null;
      if (!ch || ch.alive === false || ch._retired) return;
      var leanDelta = +8;
      if (typeof _kjpAccumReformLean === 'function') {
        try { _kjpAccumReformLean(ch, leanDelta, turn); } catch(_){}
      }
      _kjpL11RememberHalf(name, '朝议罢 ' +
        (targetEntry.canonicalName || targetEntry.magnitudeDescriptor || '前改') +
        '·如释重负', '喜', 4);
    });

    // 新意愿·本次 rollback 议政真站队·走现 _kjpL7ApplyCharsImpact·overlap 时新 priority
    if (typeof _kjpL7ApplyCharsImpact === 'function') {
      try {
        _kjpL7ApplyCharsImpact({ topicData: { intent: 'rollback' } }, outcome, newEntry);
      } catch(_){}
    }
  }

  function _kjpL11RememberHalf(name, text, emo, weight) {
    if (typeof NpcMemorySystem === 'undefined' || !NpcMemorySystem.remember) return;
    try {
      // B5·weight half cap·防叠加爆
      NpcMemorySystem.remember(
        name, text, emo, Math.max(1, Math.min(weight | 0, 5)),
        (typeof P !== 'undefined' && P && P.playerInfo && P.playerInfo.characterName) || '陛下'
      );
    } catch(_){}
  }

  // ════════════════════════════════════════════════════════════════
  // §7·L10 preset rollback tag 路径·A2·有 target 走 rollback·无 target fallback restoration
  // ════════════════════════════════════════════════════════════════

  function _kjpL11ApplyL10RollbackPreset(preset, modal) {
    if (!preset || !modal) return false;
    var tags = (preset.magnitudeParsed && preset.magnitudeParsed.tags) || [];
    var isRollbackPreset = tags.indexOf && tags.indexOf('rollback') >= 0;
    if (!isRollbackPreset) return false;   // 非 rollback preset·call site 走现 _kjpL10ApplyPreset

    if (!_isL11Enabled()) return false;
    // find latest ramping/active reform·走 rollback
    var hist = (typeof GM !== 'undefined' && GM && GM._kejuParadigm && GM._kejuParadigm.history) || [];
    var target = null;
    for (var i = hist.length - 1; i >= 0; i--) {
      var h = hist[i];
      if (!h) continue;
      if (h.status === 'ramping' || h.status === 'active' || h.status === 'matured') {
        // 跳过 rollback tags
        var htags = h.tags || [];
        if (htags.indexOf && htags.indexOf('rollback') >= 0) continue;
        target = h; break;
      }
    }
    if (target) {
      // confirm + 走 rollback modal
      var ok = true;
      try {
        if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
          ok = window.confirm('此为 rollback preset·将废止现行改革·' +
            (target.canonicalName || target.magnitudeDescriptor || '') + '·确认?');
        }
      } catch(_) { ok = true; }
      if (!ok) return true;   // user 取消·仍 short-circuit·非走普通 apply
      _kjpL11OpenRollbackModal(target);
      try { if (typeof toast === 'function') toast('📜 rollback preset·走废止流程'); } catch(_){}
      return true;
    }
    // 无 target·fallback restoration·toast 提示·走现 _kjpL10ApplyPreset path (intent 改 restoration)
    try {
      if (typeof toast === 'function') {
        toast('⚠️ 无现行改革可废·已退化为复古立法 (intent=restoration)');
      }
    } catch(_){}
    // mark draft·走现 apply path·intent 改 restoration·panel.js 渲时见 _l10RollbackFallback
    var draft = modal._kjpDraft;
    if (draft) draft._l10RollbackFallback = true;
    return false;   // call site 走现 _kjpL10ApplyPreset
  }

  // ════════════════════════════════════════════════════════════════
  // §8·跨剧本承袭 UI announce modal·D3·L8.then callback 调
  // ════════════════════════════════════════════════════════════════

  function _kjpL11RenderInheritanceModal(verdict, archive) {
    if (!_isL11Enabled()) return;
    if (!verdict || !archive) return;
    if (typeof document === 'undefined') return;
    // dedup·已 announce 过 skip
    try {
      if (GM && GM._kejuParadigm && GM._kejuParadigm._inheritance &&
          GM._kejuParadigm._inheritance.__inheritanceAnnounced) return;
    } catch(_){}
    try {
      var existing = document.getElementById('kjp-l11-inh-modal');
      if (existing) existing.remove();
    } catch(_){}

    // D5·canonicalName fallback chain·旧 archive 兼容
    var prevName = archive.canonicalName ||
                   ((archive.emperor || '前主') + '改革') ||
                   '前朝改革';
    var prevEval = archive.historicalEvaluation ||
                   (archive.magnitudeDescriptor || '前朝改革') + '·后世评待补';
    var modeLbl = ({ inherit:'承袭', reject:'反对', compromise:'折中' })[verdict.mode] || verdict.mode;

    // count subjects·实算 (post-inherit·paradigm.subjects 已更)
    var paradigm = (GM && GM._kejuParadigm) || {};
    var inheritedCount = (paradigm.subjects || []).filter(function(s) {
      return s && s._inheritedFrom === archive.archiveKey;
    }).length;

    var modal = document.createElement('div');
    modal.id = 'kjp-l11-inh-modal';
    modal.className = 'kjp-modal kjp-l11-inheritance-modal';
    modal.innerHTML =
      '<div class="kjp-modal-content kjp-l11-inh-content">' +
        '<div class="kjp-modal-header">' +
          '<div class="kjp-modal-title">📜 新朝承前·' + _escHtml(archive.era || '') + '</div>' +
          '<button class="bt bs bsm kjp-l11-inh-close-btn">✕</button>' +
        '</div>' +
        '<div class="kjp-modal-body">' +
          '<div class="kjp-l11-inh-prev">' +
            '<b>前朝改革·</b>' + _escHtml(prevName) +
            ' (' + _escHtml(archive.emperor || '') + '·' + (archive.year || 0) + '年)' +
            '<div class="kjp-l11-inh-eval">' + _escHtml(prevEval) + '</div>' +
          '</div>' +
          '<div class="kjp-l11-inh-mode">' +
            '<b>本朝决议·</b><span class="kjp-l11-inh-mode-' +
              _escHtml(verdict.mode) + '">' + _escHtml(modeLbl) + '</span>' +
          '</div>' +
          '<div class="kjp-l11-inh-edict">' + _escHtml(verdict.edict || '') + '</div>' +
          (verdict.rationale ? '<div class="kjp-l11-inh-rationale">' +
            _escHtml(verdict.rationale) + '</div>' : '') +
          '<div class="kjp-l11-inh-subjects">' +
            '实际承袭·<b>' + inheritedCount + '</b> 科' +
            (verdict.mode === 'compromise' && verdict.keepSubjects ?
              '·留·' + _escHtml((verdict.keepSubjects || []).join('、')) : '') +
          '</div>' +
        '</div>' +
        '<div class="kjp-modal-footer">' +
          '<button class="bt bsm bs-primary kjp-l11-inh-ack-btn">知道了</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) {
      var t = e.target;
      if (!t || !t.classList) return;
      if (t.classList.contains('kjp-l11-inh-close-btn') ||
          t.classList.contains('kjp-l11-inh-ack-btn')) {
        try {
          if (GM && GM._kejuParadigm && GM._kejuParadigm._inheritance) {
            GM._kejuParadigm._inheritance.__inheritanceAnnounced = true;
          }
        } catch(_){}
        try { modal.remove(); } catch(_){}
      }
    });
  }

  // ════════════════════════════════════════════════════════════════
  // §9·暴露
  // ════════════════════════════════════════════════════════════════

  if (typeof window !== 'undefined') {
    window._kjpL11OpenRollbackModal       = _kjpL11OpenRollbackModal;
    window._kjpL11RenderRollbackContent   = _kjpL11RenderRollbackContent;
    window._kjpL11BuildReverseDiff        = _kjpL11BuildReverseDiff;
    window._kjpL11SubmitRollback          = _kjpL11SubmitRollback;
    window._kjpL11FlipTargetReform        = _kjpL11FlipTargetReform;
    window._kjpL11ApplyRollbackCharsImpact= _kjpL11ApplyRollbackCharsImpact;
    window._kjpL11ApplyL10RollbackPreset  = _kjpL11ApplyL10RollbackPreset;
    window._kjpL11RenderInheritanceModal  = _kjpL11RenderInheritanceModal;
    window._kjpL11RenderTimelineRollbackButton = _kjpL11RenderTimelineRollbackButton;
    window._isL11Enabled                  = _isL11Enabled;
  }

  global.TM = global.TM || {};
  global.TM.Keju = global.TM.Keju || {};
  global.TM.Keju.Rollback = {
    openModal:       _kjpL11OpenRollbackModal,
    buildReverseDiff:_kjpL11BuildReverseDiff,
    submit:          _kjpL11SubmitRollback,
    flipTarget:      _kjpL11FlipTargetReform,
    applyCharsImpact:_kjpL11ApplyRollbackCharsImpact,
    applyL10Rollback:_kjpL11ApplyL10RollbackPreset,
    renderInheritanceModal:_kjpL11RenderInheritanceModal,
    isEnabled:       _isL11Enabled
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      _kjpL11OpenRollbackModal: _kjpL11OpenRollbackModal,
      _kjpL11RenderRollbackContent: _kjpL11RenderRollbackContent,
      _kjpL11BuildReverseDiff: _kjpL11BuildReverseDiff,
      _kjpL11SubmitRollback: _kjpL11SubmitRollback,
      _kjpL11FlipTargetReform: _kjpL11FlipTargetReform,
      _kjpL11ApplyRollbackCharsImpact: _kjpL11ApplyRollbackCharsImpact,
      _kjpL11ApplyL10RollbackPreset: _kjpL11ApplyL10RollbackPreset,
      _kjpL11RenderInheritanceModal: _kjpL11RenderInheritanceModal,
      _kjpL11RenderTimelineRollbackButton: _kjpL11RenderTimelineRollbackButton,
      _isL11Enabled: _isL11Enabled
    };
  }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));

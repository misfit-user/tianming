// Structured ordinary interactions inside the existing Hongyan page. Rendering never dispatches AI.
(function (root) {
  'use strict';
  var TM = root.TM = root.TM || {}, NPC = TM.NPC = TM.NPC || {};
  var collapsed = true;
  var reasons = { deferral_limit_reached: '本事项已达到延期次数上限，请明确选择答复或取消。', world_busy: '世界尚在办理其他事项，请稍后再试。', stale_activity_button: '此按钮已过期，请重新查看当前事项。', activity_or_terms_changed: '事项或条件已有变化，请重新核对后选择。',
    known_specific_recipient_required: '请选择本人已知的具体联系对象。', known_distinct_third_person_required: '引见需要三位不同且本人已知的人物。',
    actual_permitted_materials_required: '所选材料无法使用，请重新选择有来源的材料。', materials_missing: '当前缺少材料，请先补充。',
    daily_activity_budget: '当日活动安排已满，请等待正式日期推进。', recent_contact_cooldown: '近期已有同类往来，请先处理原事项。',
    existing_activity_continues: '已有同类事项正在办理，请在原事项中继续。', specific_supplement_materials_required: '请求补办须选择具体的补充材料。',
    work_date_not_reached: '工作所需日期尚未经过，当前不能交付。', player_choice_required: '这项选择须由本人作出。' };
  reasons.meeting_target_location_unknown = '尚不能确认对方可知的当前位置，未替其安排赴约。';
  reasons.meeting_location_unresolved = '约见地点没有可核验的地块，未创建行程。';
  reasons.meeting_invite_route_unavailable = '当前支持的路线无法递送这次邀约。';
  reasons.meeting_response_route_unavailable = '回应暂时无法按已知路线传回。';
  reasons.route_service_unavailable = '路线服务尚未就绪，事项保持等待。';
  var stages = { sent: '文书已递出', awaiting_response: '待本人答复', awaiting_third: '待本人决定是否接受引见',
    awaiting_agreement: '待确认当前条件', ready_forward: '待转达引见', ready_report: '待传回对方答复', ready_confirm: '待确认联系条件',
    working: '待整理已同意的材料', awaiting_feedback: '已收文书，待反馈', done: '本次往来已结束', rejected: '本次请求未获接受',
    deferred: '已明确延期，待正式日期推进', waiting_contact: '尚未取得回应，本地递送未能安排', cancel_sent: '已提出取消，通知正在传递',
    cancelled: '此项请求已取消', cancel_not_delivered: '本人已取消；通知尚未送达对方', expired: '已到本次事项的截止日期', consent_given: '已表达联系意愿',
    traveling: '双方正在按路线赴约', response_in_transit: '接受回信正在传回', waiting_departure: '已收到接受，等待本人决定启程', arrived_waiting: '已抵达，等待约定开始', in_meeting: '正在会面，占用约定时长', schedule_conflict: '日程冲突，尚未入场', cancel_pending: '取消通知正在传递', scheduled: '约期已定，等待出发或抵达', participated: '双方已实际会面', returning: '会面结束，正在按安排返程', returned: '已返抵原处', waiting_route: '路线或当前位置暂不能确认', missed: '未在约定窗口内同时到场' };
  var choices = { respond: [['accept', '接受'], ['reject', '婉拒'], ['conditions', '提出条件'], ['defer', '延期答复']], depart: [['depart', '按当前安排启程']], reschedule: [['reschedule', '确认改期条款']],
    agree: [['accept', '同意当前条件'], ['reject', '不接受条件']], forward: [['send', '代为转达']], report: [['send', '传回实际答复']],
    confirm: [['send', '确认通书条件']], perform: [['deliver', '整理并交付清单']], feedback: [['ack', '确认收到'], ['satisfied', '清单有帮助'], ['supplement', '请求补充材料']] };
  function D() { return NPC.DailyActivities; }
  function escape(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function player() { var found = (root.GM && root.GM.chars || []).filter(function (c) { return D().controlled(c); }); return found.length === 1 ? found[0] : null; }
  function who(key) { var c = NPC.ActionLedger.findChar({ id: key }, root.GM); return c ? c.name : '对象未详'; }
  function formMaterials(material, key) {
    return '<details><summary>选择可使用的材料（最多' + D().config.maxMaterials + '份）</summary>' + material.map(function (m, n) {
      return '<label style="display:block;margin:var(--space-1,4px) 0"><input type="checkbox" data-daily-material="' + escape(key) + '" value="' + n + '"> ' + escape(m.label + '：' + m.content) + '</label>';
    }).join('') + (!material.length ? '<p>目前没有可提供的材料。</p>' : '') + '</details>';
  }
  function selectedMaterials(container, materials, key) {
    var refs = [], fingerprints = [];
    container.querySelectorAll('input[data-daily-material]').forEach(function (el) { if (el.dataset.dailyMaterial === key && el.checked && materials[Number(el.value)]) { refs.push(materials[Number(el.value)].ref); fingerprints.push(materials[Number(el.value)].fingerprint); } });
    return { kind: 'material_summary', title: '整理已提供材料的简短清单', materialRefs: refs, expectedFingerprints: fingerprints };
  }
  function activityCard(p, ch, materials) {
    var v = D().view(p, ch); if (!v) return '';
    var label = v.kind === 'greeting' ? '通问' : v.kind === 'introduction' ? '引见' : v.kind === 'meeting' ? '约见' : '协助';
    var html = '<article data-daily-plan="' + escape(v.id) + '" style="border-top:1px solid var(--color-border-subtle);padding:var(--space-2,8px) 0">';
    html += '<strong>' + escape(label + ' · ' + who(v.actorId) + ' → ' + who(v.targetId) + (v.thirdPartyId ? ' · 引见 ' + who(v.thirdPartyId) : '')) + '</strong>';
    html += '<p data-daily-stage>' + escape(stages[v.stage] || '等待实际回应') + '</p><p>事项期限：第' + escape(v.expiresDay) + '日。已承接的工作与已收到的文书继续保留，可办理或取消。</p>';
    if (v.meeting) html += '<p data-daily-meeting>地点：' + escape(v.meeting.locationName || v.meeting.locationId || '未定') + '；目的：' + escape(v.meeting.purpose || '') + '；路线状态：' + escape(stages[v.meeting.status] || v.meeting.status || '待定') + '</p>';
    html += v.messages.slice(-8).map(function (m) { return '<details><summary>' + escape((m.fromId ? who(m.fromId) : '传递记录') + ' · ' + (m.fromId === ch.id && m.status !== 'delivered' ? '已发出' : '已收到')) + '</summary><p style="white-space:pre-wrap">' + escape(m.content) + '</p></details>'; }).join('');
    html += v.documents.map(function (document) {
      return '<details open data-daily-document="' + escape(document.id) + '"><summary>已交付文书：材料清单</summary><pre style="white-space:pre-wrap;font:inherit">' + escape(document.content) + '</pre><details><summary>查看材料来源</summary>' + document.sources.map(function (s) {
        return '<p data-source-ref="' + escape(JSON.stringify(s.ref)) + '">' + escape(s.providerName + '提供 · ' + s.label + ' · 第' + s.sharedDay + '日') + '<br>' + escape(s.content) + '</p>';
      }).join('') + '</details></details>';
    }).join('');
    if (v.contact) html += '<p data-daily-contact>双方已同意先行通书；此次未安排面谈，也未形成其它承诺。</p>';
    if (v.nextPhase) {
      var options = choices[v.nextPhase] || [];
      if (v.kind === 'greeting' && v.nextPhase === 'respond') options = [['warm', '关切答复'], ['brief', '简短答复'], ['reject', '婉拒继续往来'], ['defer', '延期答复']];
      if (v.kind === 'meeting' && v.nextPhase === 'respond') options = [['accept', '接受约见'], ['reject', '婉拒约见'], ['defer', '建议改期']];
      if (v.kind === 'assistance' && v.nextPhase === 'respond') options = options.concat([['partial', '仅承接首份材料']]);
      var token = D().ticket(ch, { planId: v.id, phase: v.nextPhase });
      html += '<div data-daily-response="' + escape(token) + '">' + options.map(function (o) { return '<button type="button" class="hy-filter-btn" data-daily-answer="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div>';
      if (v.kind === 'assistance' && /^(agree|feedback)$/.test(v.nextPhase)) html += formMaterials(materials, v.id);
    }
    if (v.canCancel) html += '<button type="button" class="hy-filter-btn" data-daily-cancel="' + escape(D().ticket(ch, { planId: v.id, phase: 'cancel' })) + '">取消此项请求</button>';
    return html + '</article>';
  }
  function render(targetPanel) {
    if (!root.document || !D() || !root.GM) return;
    var panel = targetPanel || document.querySelector('#tm-action-letter-overlay [data-npc-daily-panel]') || document.getElementById('npc-daily-panel'), ch = player(); if (!panel || !ch) return;
    D().revokeTickets();
    D().withIndex(function () {
      var known = D().knownIds(ch), people = (root.GM.chars || []).filter(function (c) { return c.id !== ch.id && (known.has(String(c.id)) || !c.hidden && !c._hidden && !/^(private|secret|hidden)$/.test(c.visibility || '') && (c.publicIdentity || c.visibility === 'public')); });
      people.sort(function (a, b) { return String(a.id).localeCompare(String(b.id)); });
      var options = '<option value="">请选择已知人物</option>' + people.map(function (c) { return '<option value="' + escape(c.id) + '">' + escape(c.name) + '</option>'; }).join('');
      var budget = D().budget(ch), views = D().plans().filter(function (p) { return D().view(p, ch); }), materials = D().materialOptions(ch).slice(0, 18);
      var waiting = views.filter(function (p) { return !!D().view(p, ch).nextPhase; }).length;
      var html = '<details style="font-size:calc(13 * var(--tm-px,1px));line-height:1.7"' + (collapsed ? '' : ' open') + '><summary><strong>日常往来 · 本地办理' + (waiting ? ' · 待回应 ' + waiting : '') + '</strong></summary><p>通问、引见和材料协助沿同一事项办理；约见须按已知地点和路线真实赴约。多日工作须等待正式时间推进，自由信函仍使用原推演。</p>';
      html += '<p>当日已新发起 ' + budget.starts + ' / ' + D().config.dailyStarts + ' 项，可回应已送达事项。</p><div data-daily-compose>';
      html += '<label>联系对象 <select id="daily-target" aria-label="日常往来对象">' + options + '</select></label> ';
      html += '<label>希望引见的人 <select id="daily-third" aria-label="希望引见的人">' + options + '</select></label>';
      html += formMaterials(materials, 'new') + '<div><button type="button" class="hy-filter-btn" data-daily-new="greeting">通问</button> <button type="button" class="hy-filter-btn" data-daily-new="introduction">请求引见</button> <button type="button" class="hy-filter-btn" data-daily-new="assistance">请求协助整理材料</button> <button type="button" class="hy-filter-btn" data-daily-new="meeting">提出约见</button></div></div>';
      html += '<p id="daily-feedback" role="status"></p><h4>实际往来与待回应事项</h4>';
      views.sort(function (a, b) { return Number(!!D().view(b, ch).nextPhase) - Number(!!D().view(a, ch).nextPhase) || b.updatedTurn - a.updatedTurn; });
      html += views.map(function (p) { return activityCard(p, ch, materials); }).join('') || '<p>尚无本地往来。</p>';
      panel.innerHTML = html + '</details>';
      var activityDetails = panel.querySelector('details');
      if (!activityDetails) return; // A detached/non-HTML host has nothing to bind.
      panel.querySelectorAll('button.hy-filter-btn').forEach(function (button) { button.classList.add('lc-btn'); });
      var composeLease = NPC.ActionLedger.capture();
      panel.onclick = function (event) {
        var button = event.target.closest('button'); if (!button || !panel.contains(button) || !panel.querySelector('details').open) return;
        var receipt, planRow = button.closest('[data-daily-plan]');
        if (button.dataset.dailyNew) {
          if (!composeLease || !NPC.ActionLedger.current(composeLease)) { render(); return; }
          var kind = button.dataset.dailyNew, target = panel.querySelector('#daily-target').value, third = panel.querySelector('#daily-third').value;
          var request = { activityKind: kind, targetId: target, thirdPartyId: kind === 'introduction' ? third : '', task: kind === 'assistance' ? selectedMaterials(panel, materials, 'new') : undefined,
            meeting: kind === 'meeting' ? { purpose: '探望与叙谈', returnMode: 'return' } : undefined };
          receipt = D().submitHuman(D().ticket(ch, request));
        } else if (button.dataset.dailyCancel) receipt = D().submitHuman(button.dataset.dailyCancel);
        else if (button.dataset.dailyAnswer) {
          var responseRoot = button.closest('[data-daily-response]'), selection = { response: button.dataset.dailyAnswer };
          if (planRow) { var task = selectedMaterials(panel, materials, planRow.dataset.dailyPlan); if (task.materialRefs.length) selection.task = task; }
          receipt = D().submitHuman(responseRoot.dataset.dailyResponse, selection);
        }
        if (!receipt) return;
        if (/^(submitted|completed)$/.test(receipt.outcome) && NPC.LocalAI) NPC.LocalAI.wake('response', receipt);
        render(panel);
        var status = panel.querySelector('#daily-feedback'); if (status) status.textContent = reasons[receipt.reason] || (/[^\x00-\x7f]/.test(receipt.reason || '') ? receipt.reason : '当前事项暂不能这样办理，请重新核对。');
      };
      activityDetails.addEventListener('toggle', function (event) {
        if (!event.target.open) { collapsed = true; D().revokeTickets(); composeLease = null; }
        else if (collapsed) { collapsed = false; render(panel); }
      });
    });
  }
  function letterCard(letter) {
    return '<div class="hy-letter-card"><strong>' + escape(letter.subjectLine || '日常往来') + '</strong><p style="white-space:pre-wrap">' + escape(letter.content) + '</p><p>此信属于上方「日常往来」的同一事项，请在当前事项内回应。</p></div>';
  }
  function open(planId) {
    collapsed = false; render();
    var panel = document.querySelector('#tm-action-letter-overlay [data-npc-daily-panel]') || document.getElementById('npc-daily-panel');
    var item = panel && Array.from(panel.querySelectorAll('[data-daily-plan]')).find(function (el) { return el.dataset.dailyPlan === planId; });
    if (item) item.scrollIntoView({ block: 'center' });
  }
  NPC.DailyUI = { render: render, open: open, letterCard: letterCard, close: function () { if (D()) D().revokeTickets(); } };
})(typeof window !== 'undefined' ? window : globalThis);

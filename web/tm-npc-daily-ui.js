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
    work_date_not_reached: '工作所需日期尚未经过，当前不能交付。', consultation_time_not_reached: '约定的请益时段尚未经过，请按正式日期推进。',
    consultation_source_required: '这次请益缺少已经发生且本人知道的来源。', consultation_contact_unavailable: '已有值得考虑的来源，但当前支持的接触渠道尚不可用。', consultation_choice_required: '请先选择一种具体交流方式。', consultation_feedback_required: '请先选择对本次交流的反馈。',
    consultation_exchange_missing: '尚未收到实际交流内容。', consultation_question_missing: '当前没有可回答的具体问题。', consultation_followup_missing: '当前没有可处理的追问。', consultation_followup_already_used: '本次请益已经使用过一次追问。', consultation_followup_defer_limit: '这一次追问已不能继续延期，请明确回答或结束。', player_choice_required: '这项选择须由本人作出。' };
  reasons.meeting_target_location_unknown = '尚不能确认对方可知的当前位置，未替其安排赴约。';
  reasons.meeting_location_unresolved = '约见地点没有可核验的地块，未创建行程。';
  reasons.meeting_invite_route_unavailable = '当前支持的路线无法递送这次邀约。';
  reasons.meeting_response_route_unavailable = '回应暂时无法按已知路线传回。';
  reasons.meeting_discussion_source_required = '当面请益需要已经发生且双方可知的材料或问题来源。';
  reasons.meeting_discussion_time_unavailable = '当前不在实际会面时段内，不能结算现场讨论。';
  reasons.meeting_discussion_location_mismatch = '本人尚未在约定地点，不能进行现场讨论。';
  reasons.meeting_discussion_participant_unavailable = '双方未在同一约定地点实际在场，不能把这段话算作现场交流。';
  reasons.meeting_discussion_choice_required = '请先选择一种现场交流方式。';
  reasons.meeting_discussion_response_required = '请对现场问题作出明确回应。';
  reasons.meeting_office_leave_required = '当前职任要求先取得有效离任安排，才能按此路线赴约。';
  reasons.meeting_office_presence_required = '当前职任的在场条件与现场安排冲突。';
  reasons.meeting_office_field_arrangement_required = '当前巡历/奉差安排未说明可以离开正在履行的职责。';
  reasons.route_service_unavailable = '路线服务尚未就绪，事项保持等待。';
  var stages = { sent: '文书已递出', awaiting_response: '待本人答复', awaiting_third: '待本人决定是否接受引见',
    awaiting_agreement: '待确认当前条件', ready_forward: '待转达引见', ready_report: '待传回对方答复', ready_confirm: '待确认联系条件',
    working: '待整理已同意的材料', awaiting_feedback: '已收到实际内容，待反馈', awaiting_question_answer: '待本人回答对方的具体问题', awaiting_followup_response: '待对方回答具体追问', done: '本次往来已结束', rejected: '本次请求未获接受',
    deferred: '已明确延期，待正式日期推进', waiting_contact: '尚未取得回应，本地递送未能安排', cancel_sent: '已提出取消，通知正在传递',
    cancelled: '此项请求已取消', cancel_not_delivered: '本人已取消；通知尚未送达对方', expired: '已到本次事项的截止日期', consent_given: '已表达联系意愿',
    traveling: '双方正在按路线赴约', response_in_transit: '接受回信正在传回', waiting_departure: '已收到接受，等待本人决定启程', arrived_waiting: '已抵达，等待约定开始', in_meeting: '正在会面，占用约定时长', schedule_conflict: '日程冲突，尚未入场', cancel_pending: '取消通知正在传递', scheduled: '约期已定，等待出发或抵达', participated: '双方已实际会面', returning: '会面结束，正在按安排返程', returned: '已返抵原处', ended: '会面已结束，现场内容未完整进行', waiting_route: '路线或当前位置暂不能确认', missed: '未在约定窗口内同时到场' };
  var choices = { respond: [['accept', '接受'], ['reject', '婉拒'], ['conditions', '提出条件'], ['defer', '延期答复']], depart: [['depart', '按当前安排启程']], reschedule: [['reschedule', '确认改期条款']],
    agree: [['accept', '同意当前条件'], ['reject', '不接受条件']], forward: [['send', '代为转达']], report: [['send', '传回实际答复']],
    confirm: [['send', '确认通书条件']], perform: [['deliver', '整理并交付清单']], question_answer: [['answer', '说明自己的理解'], ['uncertain', '说明尚未确认']], followup_response: [['answer', '回答这一次追问'], ['decline', '说明暂不再答'], ['defer', '稍后再答']], feedback: [['ack', '确认收到'], ['satisfied', '清单有帮助'], ['supplement', '请求补充材料']] };
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
  function meetingLocationOptions(ch) {
    var map = root.GM && (root.GM.mapData || root.GM.map), target = ch && root.GM && root.GM.chars && root.GM.chars.find(function (v) { return v && v.id === (document.querySelector('#daily-target') && document.querySelector('#daily-target').value); });
    var ids = [];
    [D().exactLocation(ch, root.GM), target && D().exactLocation(target, root.GM)].forEach(function (v) { if (v && ids.indexOf(String(v)) < 0) ids.push(String(v)); });
    var regions = Array.isArray(map && map.regions) ? map.regions.filter(function (r) { return r && (ids.indexOf(String(r.id)) >= 0 || r.public === true || r.visibility === 'public'); }) : [];
    return regions.length ? regions : ids.map(function (id) { return { id: id, name: id }; });
  }
  function activityCard(p, ch, materials) {
    var v = D().view(p, ch); if (!v) return '';
    var label = v.kind === 'greeting' ? '通问' : v.kind === 'introduction' ? '引见' : v.kind === 'meeting' ? '约见' : v.kind === 'consultation' ? '请益/切磋' : '协助';
    var stageLabel = stages[v.stage] || '等待实际回应';
    if (v.kind === 'consultation' && v.stage === 'working') stageLabel = '待按当前条件进行交流';
    var html = '<article data-daily-plan="' + escape(v.id) + '" style="border-top:1px solid var(--color-border-subtle);padding:var(--space-2,8px) 0">';
    html += '<strong>' + escape(label + ' · ' + who(v.actorId) + ' → ' + who(v.targetId) + (v.thirdPartyId ? ' · 引见 ' + who(v.thirdPartyId) : '')) + '</strong>';
    html += '<p data-daily-stage>' + escape(stageLabel) + '</p><p>事项期限：第' + escape(v.expiresDay) + '日。已承接的工作与已收到的文书继续保留，可办理或取消。</p>';
    if (v.meeting) html += '<p data-daily-meeting>地点：' + escape(v.meeting.locationName || v.meeting.locationId || '未定') + '；目的：' + escape(v.meeting.purpose || '') + '；路线状态：' + escape(stages[v.meeting.status] || v.meeting.status || '待定') + '</p>';
    if (v.kind === 'meeting' && v.meeting && v.meeting.discussion) {
      var md = v.meeting.discussion;
      html += '<p data-daily-meeting-discussion>现场话题：' + escape(md.topicId || '未定') + '；问题：' + escape(md.question || '') + '；讨论状态：' + escape(md.status || '待定') + '</p>';
        if (md.heardContent) html += '<details open><summary>已听到对方现场发言</summary><p style="white-space:pre-wrap">' + escape(md.heardContent) + '</p></details>';
      if (md.ownContent) html += '<details open><summary>本人现场发言</summary><p style="white-space:pre-wrap">' + escape(md.ownContent) + '</p></details>';
      if (md.result) html += '<details open><summary>现场讨论结果</summary><p style="white-space:pre-wrap">' + escape(md.result.targetContent || md.result.actorContent || '') + '</p></details>';
    }
    if (v.kind === 'consultation') {
      var topic = D().topicInfo && D().topicInfo(v.topicId);
      html += '<p data-daily-consultation>话题：' + escape(topic && topic.title || v.topicId || '未定') + '；问题：' + escape(v.question || topic && topic.question || '') + '；预计占用一个短时段。</p>';
      if (v.exchange) html += '<details open><summary>本次交流内容</summary><p style="white-space:pre-wrap">' + escape(v.exchange.content || '') + '</p></details>';
      if (v.questionAnswer) html += '<details open><summary>对方对问题的回答</summary><p style="white-space:pre-wrap">' + escape(v.questionAnswer.content || '') + '</p></details>';
      if (v.followUp && v.followUp.question) html += '<details open><summary>具体追问</summary><p style="white-space:pre-wrap">' + escape(v.followUp.question) + '</p>' + (v.followUp.response ? '<p style="white-space:pre-wrap">答复：' + escape(v.followUp.response.content || '') + '</p>' : '<p>等待对方决定是否继续回答。</p>') + '</details>';
      if (v.result) html += '<p data-daily-consultation-result>结果：' + escape(v.result.summary || '') + '</p>';
    }
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
      if (v.kind === 'meeting' && v.nextPhase === 'discuss') options = [['explain', '解释要点'], ['question', '先问对方理解'], ['counter', '提出不同看法']];
      if (v.kind === 'meeting' && v.nextPhase === 'discuss_response') options = [['answer', '说明自己的理解'], ['uncertain', '说明尚未确认'], ['counter', '提出不同看法']];
      if (v.kind === 'consultation' && v.nextPhase === 'respond') options = [['accept', '接受请益'], ['brief', '只作简短切磋'], ['reject', '暂不方便'], ['defer', '改日再议']];
      if (v.kind === 'consultation' && v.nextPhase === 'perform') options = [['explain', '解释要点'], ['question', '先问对方理解'], ['counter', '提出不同看法']];
      if (v.kind === 'consultation' && v.nextPhase === 'question_answer') options = choices.question_answer;
      if (v.kind === 'consultation' && v.nextPhase === 'followup_response') options = choices.followup_response;
      if (v.kind === 'consultation' && v.nextPhase === 'feedback') options = [['reflect', '整理自己的理解'], ['ask', '留下追问'], ['ack', '确认收到']];
      if (v.kind === 'assistance' && v.nextPhase === 'respond') options = options.concat([['partial', '仅承接首份材料']]);
      var token = D().ticket(ch, { planId: v.id, phase: v.nextPhase });
      html += '<div data-daily-response="' + escape(token) + '">' + options.map(function (o) {
        var attr = v.kind === 'consultation' && v.nextPhase === 'perform' || v.kind === 'meeting' && v.nextPhase === 'discuss' ? 'data-daily-exchange' : 'data-daily-answer';
        return '<button type="button" class="hy-filter-btn" ' + attr + '="' + o[0] + '">' + o[1] + '</button>';
      }).join('') + '</div>';
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
      html += '<label>请益话题 <select id="daily-consultation-topic" aria-label="请益话题"><option value="letter_style">文书表达</option><option value="reading_understanding">阅读理解</option></select></label>';
      var meetingLocations = meetingLocationOptions(ch);
      html += '<label>会面地点 <select id="daily-meeting-location" aria-label="会面地点">' + meetingLocations.map(function (r) { return '<option value="' + escape(r.id) + '">' + escape(r.name || r.id) + '</option>'; }).join('') + '</select></label>';
      html += formMaterials(materials, 'new') + '<div><button type="button" class="hy-filter-btn" data-daily-new="greeting">通问</button> <button type="button" class="hy-filter-btn" data-daily-new="introduction">请求引见</button> <button type="button" class="hy-filter-btn" data-daily-new="assistance">请求协助整理材料</button> <button type="button" class="hy-filter-btn" data-daily-new="consultation">提出请益/切磋</button> <button type="button" class="hy-filter-btn" data-daily-new="meeting">提出约见</button></div></div>';
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
          var consultationTopic = panel.querySelector('#daily-consultation-topic');
          var consultationOpportunity = /^(consultation|meeting)$/.test(kind) && D().consultationOpportunities ? D().consultationOpportunities(ch).find(function (o) { return o.action.targetId === target && o.action.consultation.topicId === (consultationTopic && consultationTopic.value); }) : null;
          var request = { activityKind: kind, targetId: target, thirdPartyId: kind === 'introduction' ? third : '', task: kind === 'assistance' ? selectedMaterials(panel, materials, 'new') : undefined,
            consultation: kind === 'consultation' ? { topicId: consultationTopic && consultationTopic.value, sourceOpportunity: consultationOpportunity && consultationOpportunity.action.consultation.sourceOpportunity } : undefined,
            meeting: kind === 'meeting' ? { purpose: '相约读札／当面请益', locationId: (panel.querySelector('#daily-meeting-location') || {}).value || undefined, returnMode: 'return', discussion: consultationOpportunity && consultationOpportunity.action && consultationOpportunity.action.consultation ? { topicId: consultationOpportunity.action.consultation.topicId, question: consultationOpportunity.action.consultation.question, sourceOpportunity: consultationOpportunity.action.consultation.sourceOpportunity } : undefined } : undefined };
          receipt = D().submitHuman(D().ticket(ch, request));
        } else if (button.dataset.dailyCancel) receipt = D().submitHuman(button.dataset.dailyCancel);
        else if (button.dataset.dailyAnswer || button.dataset.dailyExchange) {
          var responseRoot = button.closest('[data-daily-response]'), selection = { response: button.dataset.dailyAnswer };
          if (button.dataset.dailyExchange) selection.response = undefined;
          if (planRow) { var task = selectedMaterials(panel, materials, planRow.dataset.dailyPlan); if (task.materialRefs.length) selection.task = task; }
          if (button.dataset.dailyExchange) selection.exchangeChoice = button.dataset.dailyExchange;
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

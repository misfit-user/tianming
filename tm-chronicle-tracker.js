/**
 * tm-chronicle-tracker.js —— 长期事势追踪器
 *
 * 职责：统一追踪所有跨回合持续的活动，供：
 *   1. 玩家 UI 展示（编年标签页进行中事务区，hidden=false 条目）
 *   2. AI 推演 prompt 注入（全部条目，hidden=true 亦含）
 *
 * 数据存于 GM._chronicleTracks[]，与存档一起持久化。
 *
 * 源头（自动采集）：
 *   · keju          —— P.keju.currentExam
 *   · edict         —— GM._edictTracker 中长期诏令
 *   · scheme        —— GM.activeSchemes（默认 hidden=true）
 *   · project       —— GM.projects（工程/商队/学堂）
 *   · pending_memorial —— GM.memorials 积压 2+ 回合
 *   · faction_treaty  —— faction_interactions_advanced durationTurns>1（需外部调 upsert）
 *   · npc_action    —— NPC 长期行动（需外部调 upsert）
 *   · tingyi_pending / chaoyi_pending —— 待落实的朝议/廷议（需外部调 upsert）
 *
 * API:
 *   ChronicleTracker.add(track)              —— 新增（自动生成 id）
 *   ChronicleTracker.update(id, updates)     —— 更新现有
 *   ChronicleTracker.upsert(track)           —— 按 sourceType+sourceId 幂等
 *   ChronicleTracker.complete(id, result)    —— 标记完成
 *   ChronicleTracker.abort(id, reason)       —— 中止
 *   ChronicleTracker.getVisible()            —— UI 消费（过滤 hidden）
 *   ChronicleTracker.getAll(opts)            —— AI 消费
 *   ChronicleTracker.getAIContextString(opts)—— 直接可用 prompt 段
 *   ChronicleTracker.tick()                  —— 每回合调用·自动采集
 */
(function(global) {
  'use strict';

  var ChronicleTracker = {

    add: function(track) {
      var G = global.GM;
      if (!G) return null;
      if (!G._chronicleTracks) G._chronicleTracks = [];
      var t = {
        id: track.id || 'track_T' + (G.turn||0) + '_' + Math.random().toString(36).slice(2,7),
        type: track.type || 'other',
        category: track.category || '',
        title: track.title || '',
        narrative: track.narrative || '',
        actor: track.actor || '',
        stakeholders: Array.isArray(track.stakeholders) ? track.stakeholders.slice(0,8) : [],
        startTurn: track.startTurn || G.turn || 1,
        expectedEndTurn: track.expectedEndTurn || null,
        currentStage: track.currentStage || '\u7B79\u5907',
        progress: track.progress != null ? track.progress : 0,
        stages: Array.isArray(track.stages) ? track.stages.slice() : [{turn:G.turn||1, stage:track.currentStage||'\u521B\u7ACB', note:''}],
        hidden: !!track.hidden,
        priority: track.priority || 'medium',
        nextDeadline: track.nextDeadline || null,
        sourceType: track.sourceType || null,
        sourceId: track.sourceId || null,
        status: track.status || 'active',
        result: null,
        lastUpdateTurn: G.turn || 1
      };
      G._chronicleTracks.push(t);
      // 限额防止失控（最多 200 条）
      if (G._chronicleTracks.length > 200) {
        // 优先移除已完成/中止的最老条目
        G._chronicleTracks.sort(function(a,b){
          if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
          return (b.lastUpdateTurn||0) - (a.lastUpdateTurn||0);
        });
        G._chronicleTracks.length = 200;
      }
      return t.id;
    },

    update: function(id, updates) {
      var G = global.GM;
      if (!G || !Array.isArray(G._chronicleTracks)) return false;
      var t = G._chronicleTracks.find(function(x){return x.id === id;});
      if (!t) return false;
      var _prevStage = t.currentStage;
      Object.keys(updates||{}).forEach(function(k){
        if (k === 'id' || k === 'startTurn' || k === 'stages') return;
        t[k] = updates[k];
      });
      t.lastUpdateTurn = G.turn || 1;
      if (updates && updates.currentStage && updates.currentStage !== _prevStage) {
        if (!Array.isArray(t.stages)) t.stages = [];
        t.stages.push({ turn: G.turn, stage: updates.currentStage, note: updates.stageNote || '' });
      }
      return true;
    },

    findBySource: function(sourceType, sourceId) {
      var G = global.GM;
      if (!G || !Array.isArray(G._chronicleTracks)) return null;
      return G._chronicleTracks.find(function(x){
        return x.sourceType === sourceType && String(x.sourceId) === String(sourceId);
      });
    },

    upsert: function(track) {
      if (track.sourceType && track.sourceId != null) {
        var existing = ChronicleTracker.findBySource(track.sourceType, track.sourceId);
        if (existing) {
          ChronicleTracker.update(existing.id, track);
          return existing.id;
        }
      }
      return ChronicleTracker.add(track);
    },

    complete: function(id, result) {
      ChronicleTracker.update(id, { status: 'completed', progress: 100, result: result || '\u5DF2\u6210' });
    },

    abort: function(id, reason) {
      ChronicleTracker.update(id, { status: 'aborted', result: reason || '\u4E2D\u6B62' });
    },

    getVisible: function() {
      var G = global.GM;
      if (!G || !Array.isArray(G._chronicleTracks)) return [];
      return G._chronicleTracks.filter(function(t){return !t.hidden && t.status === 'active';});
    },

    getAll: function(opts) {
      var G = global.GM;
      if (!G || !Array.isArray(G._chronicleTracks)) return [];
      var arr = G._chronicleTracks.slice();
      if (opts && opts.activeOnly) arr = arr.filter(function(t){return t.status === 'active';});
      return arr;
    },

    getAIContextString: function(opts) {
      var G = global.GM;
      if (!G || !Array.isArray(G._chronicleTracks)) return '';
      var tracks = G._chronicleTracks.filter(function(t){return t.status === 'active';});
      if (tracks.length === 0) return '';
      // 按类型分组
      var groups = {};
      tracks.forEach(function(t){
        var key = t.type || 'other';
        if (!groups[key]) groups[key] = [];
        groups[key].push(t);
      });
      var typeLabels = {
        keju: '\u79D1\u4E3E\u884C\u671D', edict: '\u957F\u671F\u8BCF\u4EE4', scheme: '\u9634\u8C0B\u5E03\u5C40(\u9690)',
        project: '\u5DE5\u7A0B\u00B7\u5546\u961F', pending_memorial: '\u79EF\u538B\u594F\u758F',
        faction_treaty: '\u52BF\u529B\u7EA6\u671F', npc_action: 'NPC \u957F\u671F\u884C\u52A8',
        tingyi_pending: '\u5EF7\u8BAE\u5F85\u843D\u5B9E', chaoyi_pending: '\u671D\u8BAE\u5F85\u6267\u884C',
        dynasty_event: '\u7AF9\u4EE3\u4E8B\u4EF6', other: '\u5176\u4ED6'
      };
      var lines = [];
      Object.keys(groups).forEach(function(k){
        var label = typeLabels[k] || k;
        lines.push('\u30CA ' + label + '\uFF08' + groups[k].length + '\uFF09');
        groups[k].forEach(function(t){
          var parts = [];
          if (t.hidden) parts.push('\u3010\u9690\u3011');
          if (t.title) parts.push(t.title);
          if (t.actor) parts.push('\u4E3B:'+t.actor);
          if (t.currentStage) parts.push('\u9636\u6BB5:'+t.currentStage);
          if (t.progress != null) parts.push(t.progress+'%');
          var elapsed = (G.turn||0) - (t.startTurn||0);
          parts.push('\u5C04\u7EC4' + elapsed + '\u56DE\u5408');
          if (t.expectedEndTurn && t.expectedEndTurn > G.turn) parts.push('\u9884\u671F\u8FD8\u4F59 ' + (t.expectedEndTurn - G.turn) + ' \u56DE\u5408');
          if (t.nextDeadline && t.nextDeadline <= (G.turn||0)) parts.push('\u26A0\u903E\u671F');
          if (t.priority === 'high') parts.push('\u9AD8\u4F18\u5148');
          if (t.narrative) parts.push('\u2014 ' + String(t.narrative).slice(0,60));
          lines.push('  \u00B7 ' + parts.join(' \u00B7 '));
        });
      });
      return '\u3010\u957F\u671F\u4E8B\u52BF\u00B7\u7F16\u5E74\u8FDB\u884C\u4E2D\u3011\n'
           + '\u6CA1\u6709\u5B8C\u6210\u7684\u6D3B\u52A8\u5FC5\u987B\u5728\u672C\u56DE\u5408\u8BE6\u5F00\u5C31\u884C\u6216\u66F4\u65B0\u3002\u4E0D\u53EF\u5FDC\u610F\u7EC8\u65AD\u3002\u9690\u3011\u6807\u8BB0\u6761\u76EE\u5BF9\u73A9\u5BB6\u4E0D\u5C55\u793A\uFF0C\u4F46\u4F60\uFF08\u63A8\u6F14\uFF09\u77E5\u6653\u3002\n'
           + lines.join('\n');
    },

    /** 每回合调用·从各子系统自动采集 */
    tick: function() {
      try { _collectFromKeju(); } catch(e){ console.warn('[Chronicle] keju:', e.message); }
      try { _collectFromEdicts(); } catch(e){ console.warn('[Chronicle] edict:', e.message); }
      try { _collectFromSchemes(); } catch(e){ console.warn('[Chronicle] scheme:', e.message); }
      try { _collectFromProjects(); } catch(e){ console.warn('[Chronicle] project:', e.message); }
      try { _collectFromPendingMemorials(); } catch(e){ console.warn('[Chronicle] memorial:', e.message); }
      try { _cleanupStale(); } catch(e){}
    }
  };

  // ───────── 采集器 ─────────

  function _collectFromKeju() {
    var G = global.GM, P = global.P;
    if (!P || !P.keju || !P.keju.currentExam) return;
    var exam = P.keju.currentExam;
    if (!exam.stage) return;
    var existing = ChronicleTracker.findBySource('keju', 'current');
    if (exam.stage === 'idle' || exam.stage === 'completed') {
      if (existing && existing.status === 'active') {
        ChronicleTracker.complete(existing.id, exam.stage === 'completed' ? '\u6BBF\u8BD5\u7ED3\u675F' : '');
      }
      return;
    }
    var stageMap = {
      preparation: '\u7B79\u5907',
      zhou: '\u5DDE\u8BD5',
      prefectural: '\u5E9C\u8BD5',
      provincial: '\u4E61\u8BD5',
      metropolitan: '\u4F1A\u8BD5',
      palace: '\u6BBF\u8BD5'
    };
    var order = ['preparation','zhou','prefectural','provincial','metropolitan','palace'];
    var idx = order.indexOf(exam.stage);
    var prog = idx < 0 ? 0 : Math.round((idx+0.5) / order.length * 100);
    ChronicleTracker.upsert({
      type: 'keju',
      category: '\u6587\u6559',
      sourceType: 'keju',
      sourceId: 'current',
      title: '\u672C\u79D1\u79D1\u4E3E',
      actor: exam.chiefExaminer || '\u4E3B\u8003\u672A\u5B9A',
      stakeholders: exam.candidates ? exam.candidates.slice(0,5).map(function(c){return c.name||c;}) : [],
      currentStage: stageMap[exam.stage] || exam.stage,
      progress: prog,
      narrative: (exam.startDate ? '\u5F00\u8003: '+exam.startDate+' \u00B7 ' : '') + (exam.candidatePoolSize ? '\u5907\u9009 '+exam.candidatePoolSize+' \u4EBA' : ''),
      priority: (exam.stage === 'metropolitan' || exam.stage === 'palace') ? 'high' : 'medium'
    });
  }

  function _collectFromEdicts() {
    var G = global.GM;
    if (!G || !Array.isArray(G._edictTracker)) return;
    G._edictTracker.forEach(function(e){
      if (!e || !e.id) return;
      var elapsed = (G.turn||0) - (e.turn||0);
      if (e.status === 'completed' || e.status === 'aborted' || elapsed > 30) {
        var existing = ChronicleTracker.findBySource('edict', e.id);
        if (existing && existing.status === 'active') ChronicleTracker.complete(existing.id, e.status||'');
        return;
      }
      if (elapsed < 1) return;
      ChronicleTracker.upsert({
        type: 'edict',
        category: e.category || '\u8BCF\u4EE4',
        sourceType: 'edict',
        sourceId: e.id,
        title: String(e.content || e.title || '').slice(0,40),
        actor: e.assignee || '\u672A\u6307\u4EFB',
        currentStage: e.stage || 'execution',
        progress: typeof e.progressPercent === 'number' ? e.progressPercent : _guessEdictProgress(e, elapsed),
        narrative: e.feedback ? String(e.feedback).slice(0,80) : '',
        startTurn: e.turn || G.turn,
        priority: elapsed > 8 ? 'high' : 'medium'
      });
    });
  }
  function _guessEdictProgress(e, elapsed) {
    var stageMap = { completed: 100, feedback: 80, execution: 50, interpretation: 35, transmission: 25, promulgation: 20, review: 10, drafting: 5 };
    if (e.stage && stageMap[e.stage] != null) return stageMap[e.stage];
    return Math.min(80, elapsed * 8);
  }

  function _collectFromSchemes() {
    var G = global.GM;
    if (!G || !Array.isArray(G.activeSchemes)) return;
    G.activeSchemes.forEach(function(s){
      if (!s || !s.id) return;
      var elapsed = (G.turn||0) - (s.startTurn||0);
      if (elapsed > 20) {
        var ex = ChronicleTracker.findBySource('scheme', s.id);
        if (ex && ex.status === 'active') ChronicleTracker.abort(ex.id, '\u8FC7\u671F\u81EA\u6D88');
        return;
      }
      var progMap = { '\u957F\u671F\u5E03\u5C40': 15, '\u915D\u917F\u4E2D': 35, '\u5373\u5C06\u53D1\u52A8': 70, '\u5DF2\u53D1': 90 };
      ChronicleTracker.upsert({
        type: 'scheme',
        category: '\u9634\u8C0B',
        sourceType: 'scheme',
        sourceId: s.id,
        title: (s.schemer||'?') + ' \u8C0B ' + (s.target||'?'),
        actor: s.schemer || '',
        stakeholders: s.allies ? String(s.allies).split(/[\u9017\uFF0C,]/).map(function(x){return x.trim();}).filter(Boolean) : [],
        currentStage: s.progress || '\u915D\u917F\u4E2D',
        progress: progMap[s.progress] != null ? progMap[s.progress] : 30,
        narrative: String(s.plan||'').slice(0,80),
        startTurn: s.startTurn || G.turn,
        hidden: true  // 阴谋默认对玩家隐藏
      });
    });
  }

  function _collectFromProjects() {
    var G = global.GM;
    if (!G || !Array.isArray(G.projects)) return;
    G.projects.forEach(function(p){
      if (!p || !p.name) return;
      if (p.status === 'completed' || p.status === 'abandoned') {
        var ex = ChronicleTracker.findBySource('project', p.name);
        if (ex && ex.status === 'active') ChronicleTracker.complete(ex.id, p.status);
        return;
      }
      ChronicleTracker.upsert({
        type: 'project',
        category: p.type || '\u5DE5\u7A0B',
        sourceType: 'project',
        sourceId: p.name,
        title: p.name,
        actor: p.leader || '',
        currentStage: p.status || '\u8FDB\u884C',
        progress: p.progress || 0,
        narrative: String(p.description||'').slice(0,80),
        startTurn: p.startTurn || G.turn,
        expectedEndTurn: p.endTurn || null
      });
    });
  }

  function _collectFromPendingMemorials() {
    var G = global.GM;
    if (!G || !Array.isArray(G.memorials)) return;
    G.memorials.forEach(function(m){
      if (!m || !m.id) return;
      var age = (G.turn||0) - (m.turn||0);
      if (m.status === 'approved' || m.status === 'rejected' || m.status === 'filed' || age >= 15) {
        var ex = ChronicleTracker.findBySource('memorial', m.id);
        if (ex && ex.status === 'active') ChronicleTracker.complete(ex.id, m.status||'');
        return;
      }
      if (m.status !== 'pending_review' && m.status !== 'pending') return;
      if (age < 2) return;
      ChronicleTracker.upsert({
        type: 'pending_memorial',
        category: '\u594F\u758F\u7559\u4E2D',
        sourceType: 'memorial',
        sourceId: m.id,
        title: m.title || ((m.from||'?')+'\u7684\u594F\u758F'),
        actor: m.from || '',
        currentStage: '\u7559\u4E2D ' + age + ' \u56DE\u5408',
        progress: 0,
        narrative: String(m.content||'').slice(0,80),
        startTurn: m.turn || G.turn,
        priority: age > 5 ? 'high' : 'medium'
      });
    });
  }

  function _cleanupStale() {
    var G = global.GM;
    if (!G || !Array.isArray(G._chronicleTracks)) return;
    var cur = G.turn || 0;
    G._chronicleTracks.forEach(function(t){
      if (t.status !== 'active') return;
      var stale = cur - (t.lastUpdateTurn||t.startTurn||0);
      if (stale > 12) {
        t.status = 'stalled';
        t.result = '\u4E45\u65E0\u66F4\u65B0\u00B7\u81EA\u52A8\u6263\u7F6E';
      }
    });
  }

  global.ChronicleTracker = ChronicleTracker;

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));

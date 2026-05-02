// @ts-check
// ============================================================
// tm-migration.js
// 6 系统翻新 phase 0: 引擎层迁移框架。
//
// 只迁移玩家存档/运行态对象，不自动改写剧本文件。
// 每个 migration 通过版本号和 applied 列表保持幂等。
// ============================================================
(function(global) {
  'use strict';

  var TM = global.TM = global.TM || {};
  var CURRENT_VERSION = 2;
  var migrations = [];

  function nowIso() {
    try { return (new Date()).toISOString(); }
    catch (_) { return ''; }
  }

  function resolveTarget(target) {
    if (!target) return global.GM || global.P || {};
    if (target.GM && typeof target.GM === 'object') return target.GM;
    if (target.gameState && typeof target.gameState === 'object') return target.gameState;
    return target;
  }

  function metaOf(target) {
    var t = resolveTarget(target);
    if (!t._engineMigration || typeof t._engineMigration !== 'object') {
      t._engineMigration = { version: 0, applied: [], updatedAt: '' };
    }
    if (!Array.isArray(t._engineMigration.applied)) t._engineMigration.applied = [];
    return t._engineMigration;
  }

  function register(version, id, fn) {
    if (typeof id === 'function') {
      fn = id;
      id = 'v' + version;
    }
    if (typeof version !== 'number' || version < 1) throw new Error('migration version 必须是正整数');
    if (typeof fn !== 'function') throw new Error('migration fn 必须是函数');
    migrations.push({ version: version, id: String(id || ('v' + version)), fn: fn });
    migrations.sort(function(a, b) { return a.version - b.version; });
  }

  function run(target, options) {
    options = options || {};
    var t = resolveTarget(target);
    var meta = metaOf(t);
    var appliedNow = [];
    migrations.forEach(function(m) {
      if (m.version <= meta.version && meta.applied.indexOf(m.id) !== -1) return;
      if (options.toVersion && m.version > options.toVersion) return;
      m.fn(t, { meta: meta, target: target });
      if (meta.applied.indexOf(m.id) === -1) meta.applied.push(m.id);
      meta.version = Math.max(meta.version || 0, m.version);
      appliedNow.push(m.id);
    });
    if (!options.toVersion) meta.version = Math.max(meta.version || 0, CURRENT_VERSION);
    meta.updatedAt = nowIso();
    return { target: t, version: meta.version, applied: appliedNow, meta: meta };
  }

  function stamp(target) {
    var meta = metaOf(target);
    meta.version = Math.max(meta.version || 0, CURRENT_VERSION);
    meta.updatedAt = nowIso();
    return meta;
  }

  function list() {
    return migrations.map(function(m) {
      return { version: m.version, id: m.id };
    });
  }

  function report(target) {
    var meta = metaOf(target);
    return {
      currentVersion: CURRENT_VERSION,
      targetVersion: meta.version || 0,
      registered: list(),
      applied: (meta.applied || []).slice(),
      pending: list().filter(function(m) { return (meta.applied || []).indexOf(m.id) === -1; })
    };
  }

  function _trimText(v, len) {
    if (v === undefined || v === null) return '';
    return String(v).slice(0, len || 80);
  }

  function _levelLabel(familiarity) {
    familiarity = Math.max(0, Math.min(100, Math.round(Number(familiarity) || 0)));
    if (familiarity >= 85) return '知己';
    if (familiarity >= 65) return '熟识';
    if (familiarity >= 35) return '眼熟';
    if (familiarity >= 10) return '略识';
    return '陌生';
  }

  function _latestMemory(ch) {
    if (!ch) return null;
    if (Array.isArray(ch._memory) && ch._memory.length > 0) return ch._memory[ch._memory.length - 1];
    return null;
  }

  function _strongestImpressionTarget(ch) {
    if (!ch || !ch._impressions) return '';
    var best = '';
    var bestScore = 0;
    Object.keys(ch._impressions).forEach(function(name) {
      var imp = ch._impressions[name];
      if (!imp) return;
      var score = Math.abs(Number(imp.favor) || 0);
      if (score > bestScore) {
        bestScore = score;
        best = name;
      }
    });
    return best;
  }

  function _buildInteractionSnapshot(ch) {
    var latest = _latestMemory(ch);
    if (!latest) return null;
    var subject = _trimText(latest.who || latest.subject || latest.target || '', 60);
    return {
      turn: latest.turn || 0,
      event: _trimText(latest.event || '', 120),
      emotion: _trimText(latest.emotion || '平', 12) || '平',
      importance: Math.max(0.1, Math.min(10, Number(latest.importance || 5))),
      who: _trimText(latest.who || subject, 60),
      type: _trimText(latest.type || 'general', 24) || 'general',
      source: _trimText(latest.source || 'witnessed', 24) || 'witnessed',
      credibility: latest.credibility != null ? Math.max(0, Math.min(100, Number(latest.credibility))) : 95,
      arcId: _trimText(latest.arcId || '', 60),
      participants: Array.isArray(latest.participants) ? latest.participants.slice(0, 8) : [],
      location: _trimText(latest.location || '', 60),
      subject: subject,
      summary: _trimText(latest.summary || latest.event || '', 80)
    };
  }

  function _buildRecognitionState(ch, snapshot) {
    snapshot = snapshot || _buildInteractionSnapshot(ch);
    var subject = snapshot ? snapshot.subject : '';
    if (!subject) subject = _strongestImpressionTarget(ch);
    var familiarity = 0;
    if (snapshot && snapshot.importance) familiarity = Math.min(100, Math.round(snapshot.importance * 2));
    if (!familiarity && subject && ch && ch._impressions && ch._impressions[subject]) {
      familiarity = Math.min(100, Math.round(Math.abs(Number(ch._impressions[subject].favor) || 0) * 1.2));
    }
    if (!familiarity && Array.isArray(ch && ch._memory) && ch._memory.length) {
      familiarity = Math.min(100, Math.max(10, ch._memory.length * 2));
    }
    return {
      subject: subject || '',
      familiarity: familiarity,
      level: _levelLabel(familiarity),
      lastTurn: snapshot ? snapshot.turn || 0 : 0,
      lastEvent: snapshot ? snapshot.event || '' : '',
      lastEmotion: snapshot ? snapshot.emotion || '平' : '平',
      lastType: snapshot ? snapshot.type || 'general' : 'general',
      lastSource: snapshot ? snapshot.source || '' : '',
      lastWho: snapshot ? snapshot.who || subject || '' : subject || '',
      summary: snapshot ? snapshot.summary || '' : '',
      history: []
    };
  }

  function _normalizeRecognitionState(ch) {
    var snapshot = _buildInteractionSnapshot(ch);
    var existing = ch.recognitionState && typeof ch.recognitionState === 'object' ? ch.recognitionState : null;
    var seeded = existing && (existing.subject || existing.lastEvent || (Number(existing.familiarity) || 0) > 0)
      ? existing
      : _buildRecognitionState(ch, snapshot);
    var next = seeded;
    if (!next.subject && snapshot && snapshot.subject) next.subject = snapshot.subject;
    if (!next.subject && !snapshot) next.subject = _strongestImpressionTarget(ch) || '';
    if (next.familiarity === undefined || next.familiarity === null || (!existing || (!existing.subject && !(Number(existing.familiarity) || 0)))) {
      if (snapshot && snapshot.subject) {
        next.familiarity = Math.max(10, Math.min(100, Math.round((snapshot.importance || 5) * 2)));
      } else if (next.subject && ch && ch._impressions && ch._impressions[next.subject]) {
        next.familiarity = Math.max(10, Math.min(100, Math.round(Math.abs(Number(ch._impressions[next.subject].favor) || 0) * 1.2)));
      } else {
        next.familiarity = Math.max(0, Math.round(Number(next.familiarity) || 0));
      }
    }
    next.familiarity = Math.max(0, Math.min(100, Math.round(Number(next.familiarity) || 0)));
    if (!next.level) next.level = _levelLabel(next.familiarity);
    if (next.lastTurn === undefined || next.lastTurn === null) next.lastTurn = snapshot ? snapshot.turn || 0 : 0;
    if (next.lastEvent === undefined || next.lastEvent === null) next.lastEvent = snapshot ? snapshot.event || '' : '';
    if (next.lastEmotion === undefined || next.lastEmotion === null) next.lastEmotion = snapshot ? snapshot.emotion || '平' : '平';
    if (next.lastType === undefined || next.lastType === null) next.lastType = snapshot ? snapshot.type || 'general' : 'general';
    if (next.lastSource === undefined || next.lastSource === null) next.lastSource = snapshot ? snapshot.source || '' : '';
    if (next.lastWho === undefined || next.lastWho === null) next.lastWho = snapshot ? snapshot.who || '' : '';
    if (next.summary === undefined || next.summary === null) next.summary = snapshot ? snapshot.summary || '' : '';
    if (!Array.isArray(next.history)) next.history = [];
    return next;
  }

  function _normalizeInteractionMemory(ch) {
    var snapshot = _buildInteractionSnapshot(ch);
    if (snapshot) return snapshot;
    return null;
  }

  register(2, 'phase6-char-refs-memory', function(target) {
    var t = resolveTarget(target);
    if (!t || !Array.isArray(t.chars)) return;
    t.chars.forEach(function(ch) {
      if (!ch || typeof ch !== 'object') return;
      if (typeof global.CharFullSchema !== 'undefined' && typeof global.CharFullSchema.ensureFullFields === 'function') {
        try { global.CharFullSchema.ensureFullFields(ch); } catch(_) {}
      }
      var snapshot = _normalizeInteractionMemory(ch);
      if (!ch.lastInteractionMemory && snapshot) ch.lastInteractionMemory = snapshot;
      if (!ch.recognitionState || typeof ch.recognitionState !== 'object' || !ch.recognitionState.subject) {
        ch.recognitionState = _normalizeRecognitionState(ch);
      } else {
        ch.recognitionState = _normalizeRecognitionState(ch);
      }
      if (global.RelGraph && typeof global.RelGraph.syncCharRefs === 'function') {
        try { global.RelGraph.syncCharRefs(ch, t); } catch(_) {}
      }
    });
  });

  var api = {
    currentVersion: CURRENT_VERSION,
    register: register,
    run: run,
    stamp: stamp,
    metaOf: metaOf,
    report: report,
    list: list
  };

  TM.EngineMigration = api;
  global.EngineMigration = api;
})(typeof window !== 'undefined' ? window : globalThis);

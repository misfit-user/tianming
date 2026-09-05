'use strict';

// Desktop turn bundles use a two-phase protocol:
//   renderer finalizes records -> stage files -> canonical saves commit -> publish directory.
// The canonical save transaction commits a lightweight receipt alongside the world payload, so an
// interrupted publish is idempotently recoverable on the next load without rewriting either save.
function createTurnDataCommitter(deps) {
  const fs = deps.fs;
  const path = deps.path;
  const crypto = deps.crypto;
  const turnDataDir = deps.turnDataDir;
  const turnDataRoot = deps.turnDataRoot;
  const turnSeg = deps.turnSeg;
  const ensureWritableDir = deps.ensureWritableDir;
  const writeJsonAtomic = deps.writeJsonAtomic;
  const writeFileAtomic = deps.writeFileAtomic;
  const stagingRoot = path.join(turnDataDir, '.staging');

  function assertInside(root, target) {
    const rootResolved = path.resolve(root);
    const targetResolved = path.resolve(target);
    const prefix = rootResolved.endsWith(path.sep) ? rootResolved : rootResolved + path.sep;
    if (targetResolved !== rootResolved && !targetResolved.startsWith(prefix)) {
      throw new Error('回合分卷路径越界');
    }
    for (let cursor = targetResolved; cursor.length >= rootResolved.length; cursor = path.dirname(cursor)) {
      if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) throw new Error('回合分卷路径不允许符号链接');
      if (cursor === rootResolved) break;
    }
    return targetResolved;
  }

  function transactionId(value) {
    const id = String(value == null ? '' : value).trim();
    if (!/^[A-Za-z0-9._-]{8,160}$/.test(id)) throw new Error('非法回合事务 ID');
    return id;
  }

  function descriptor(input) {
    input = input || {};
    const saveName = String(input.saveName == null ? '' : input.saveName);
    if (!saveName) throw new Error('缺少存档名称');
    const saveRoot = rootFor(input);
    const saveKey = crypto.createHash('sha256').update(JSON.stringify([input.campaignId, input.timelineId])).digest('hex');
    const txId = transactionId(input.transactionId);
    const turn = turnSeg(input.turn);
    const stageDir = assertInside(stagingRoot, path.join(stagingRoot, saveKey, txId));
    return { saveName, saveRoot, saveKey, campaignId: input.campaignId, timelineId: input.timelineId, transactionId: txId, turn, stageDir };
  }

  function rootFor(input) {
    if (!input || !['campaignId', 'timelineId'].every(key => typeof input[key] === 'string' && /^[A-Za-z0-9._-]{1,160}$/.test(input[key]))) {
      throw new Error('turn-data-identity-required: 需要稳定 campaignId/timelineId，旧桥接须升级');
    }
    const hash = value => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
    return assertInside(turnDataDir, path.join(turnDataDir, 'v2', hash(input.campaignId), hash(input.timelineId)));
  }

  function matches(candidate, input) {
    return !!candidate && String(candidate.turn) === String(input.turn)
      && candidate.campaignId === input.campaignId && candidate.timelineId === input.timelineId
      && (!input.transactionId || candidate.transactionId === input.transactionId)
      && (input.stateChecksum == null || candidate.stateChecksum === input.stateChecksum);
  }

  // Copy-only migration: the old manifest must prove ownership. Unknown originals stay untouched.
  // Staging + rename is retryable after interruption, and never replaces an existing v2 transaction.
  function migrateLegacy(input) {
    const ref = descriptor(input);
    const legacyRoot = assertInside(turnDataDir, turnDataRoot(ref.saveName, false));
    const legacyStage = assertInside(stagingRoot, path.join(stagingRoot, path.basename(turnDataRoot(ref.saveName, true)), ref.transactionId));
    const candidates = [path.join(legacyStage, 'turn'), path.join(legacyRoot, ref.turn)];
    for (const source of candidates) {
      assertInside(turnDataDir, source);
      const oldManifest = readJsonIfPresent(path.join(source, 'transaction.json'));
      if (!matches(oldManifest, input)) continue;
      if (fs.existsSync(ref.stageDir)) {
        const prior = readJsonIfPresent(path.join(ref.stageDir, 'manifest.json'));
        if (matches(prior, input)) return true;
        removeStage(ref.stageDir); // incomplete owned copy from an interrupted migration
      }
      ensureWritableDir(ref.stageDir);
      fs.cpSync(source, path.join(ref.stageDir, 'turn'), { recursive: true, filter(src) { assertInside(turnDataDir, src); return true; } });
      // Only staged auxiliary files have per-transaction provenance. Shared legacy files are retained.
      if (source === candidates[0]) {
        for (const file of ['scenario.json', 'reference.txt']) {
          const from = assertInside(turnDataDir, path.join(legacyStage, file));
          if (fs.existsSync(from)) fs.copyFileSync(from, path.join(ref.stageDir, file));
        }
      }
      writeJsonAtomic(path.join(ref.stageDir, 'manifest.json'), Object.assign({}, oldManifest, { version: 2, saveKey: ref.saveKey }));
      return true;
    }
    return false;
  }

  function read(input) {
    const root = rootFor(input);
    const turn = turnSeg(input.turn);
    let dir = assertInside(root, path.join(root, turn));
    if (!fs.existsSync(dir)) {
      const legacy = assertInside(turnDataDir, path.join(turnDataRoot(input.saveName, false), turn));
      const manifest = readJsonIfPresent(path.join(legacy, 'transaction.json'));
      if (!matches(manifest, input)) throw new Error('turn-data-unproven-legacy-identity');
      publish(Object.assign({}, input, { transactionId: manifest.transactionId, stateChecksum: manifest.stateChecksum }));
    }
    if (!matches(readJsonIfPresent(path.join(dir, 'transaction.json')), input)) throw new Error('turn-data-identity-conflict');
    const data = {};
    for (const file of fs.readdirSync(dir).filter(file => file.endsWith('.json'))) {
      data[file.slice(0, -5)] = readJsonIfPresent(assertInside(root, path.join(dir, file)));
    }
    return { success: true, data };
  }

  function list(input) {
    const root = rootFor(input);
    const turns = new Set();
    const warnings = [];
    for (const base of [root, assertInside(turnDataDir, turnDataRoot(input.saveName, false))]) {
      if (!fs.existsSync(base)) continue;
      for (const turn of fs.readdirSync(base).filter(value => /^(0|[1-9][0-9]*)$/.test(value))) {
        const manifest = readJsonIfPresent(assertInside(turnDataDir, path.join(base, turn, 'transaction.json')));
        if (matches(manifest, Object.assign({}, input, { turn }))) turns.add(Number(turn));
        else if (base !== root) warnings.push({ code: 'legacy-identity-unproven', turn: Number(turn) });
      }
    }
    return { success: true, turns: Array.from(turns).sort((a, b) => a - b), warnings };
  }

  function remove(input) {
    const root = rootFor(input);
    const stageKey = crypto.createHash('sha256').update(JSON.stringify([input.campaignId, input.timelineId])).digest('hex');
    const pending = assertInside(stagingRoot, path.join(stagingRoot, stageKey));
    if (fs.existsSync(pending) && fs.readdirSync(pending).length) throw new Error('turn-data-cleanup-pending-transaction');
    if (fs.existsSync(root)) fs.rmSync(root, { recursive: true });
    return { success: true, legacyRetained: true };
  }

  function readJsonIfPresent(file) {
    assertInside(turnDataDir, file);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  }

  function removeStage(stageDir) {
    const checked = assertInside(stagingRoot, stageDir);
    if (fs.existsSync(checked)) fs.rmSync(checked, { recursive: true, force: true });
    const parent = path.dirname(checked);
    try { if (fs.existsSync(parent) && fs.readdirSync(parent).length === 0) fs.rmdirSync(parent); } catch (_) {}
  }

  function writeTurnFiles(turnDir, data, manifest) {
    ensureWritableDir(turnDir);
    writeJsonAtomic(path.join(turnDir, 'context.json'), data.context || data);
    if (data.playerInput) writeJsonAtomic(path.join(turnDir, 'player-input.json'), data.playerInput);
    if (data.aiResults) writeJsonAtomic(path.join(turnDir, 'ai-results.json'), data.aiResults);
    if (data.varChanges) writeJsonAtomic(path.join(turnDir, 'var-changes.json'), data.varChanges);
    writeJsonAtomic(path.join(turnDir, 'transaction.json'), manifest);
  }

  function stage(input) {
    const ref = descriptor(input);
    const data = input && input.data;
    if (!data || typeof data !== 'object') throw new Error('回合分卷数据为空');
    const prior = readJsonIfPresent(path.join(ref.stageDir, 'manifest.json'));
    const contentHash = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
    const published = readJsonIfPresent(path.join(ref.saveRoot, ref.turn, 'transaction.json'));
    if (published) {
      if (!matches(published, input) || published.contentHash !== contentHash) throw new Error('turn-data-stage-conflict');
      return Object.assign({ success: true }, published);
    }
    if (prior) {
      if (!matches(prior, input) || prior.contentHash !== contentHash) throw new Error('turn-data-stage-conflict');
      return Object.assign({ success: true }, prior);
    }
    if (fs.existsSync(ref.stageDir)) removeStage(ref.stageDir);
    ensureWritableDir(ref.stageDir);
    const manifest = {
      version: 2,
      contentHash,
      status: 'prepared',
      saveKey: ref.saveKey,
      campaignId: String(input.campaignId || ''),
      timelineId: String(input.timelineId || ''),
      turn: Number(ref.turn),
      transactionId: ref.transactionId,
      stateChecksum: String(input.stateChecksum || ''),
      createdAt: new Date().toISOString()
    };
    try {
      writeTurnFiles(path.join(ref.stageDir, 'turn'), data, manifest);
      if (data.scenario) writeJsonAtomic(path.join(ref.stageDir, 'scenario.json'), data.scenario);
      if (data.refText) writeFileAtomic(path.join(ref.stageDir, 'reference.txt'), String(data.refText), 'utf-8');
      writeJsonAtomic(path.join(ref.stageDir, 'manifest.json'), manifest);
      return Object.assign({ success: true }, manifest);
    } catch (error) {
      try { removeStage(ref.stageDir); } catch (_) {}
      throw error;
    }
  }

  function replaceTurnDirectory(stagedTurn, finalTurn) {
    ensureWritableDir(path.dirname(finalTurn));
    if (fs.existsSync(finalTurn)) throw new Error('turn-data-transaction-conflict');
    fs.renameSync(stagedTurn, finalTurn);
  }

  function publish(input) {
    const ref = descriptor(input);
    const manifestFile = path.join(ref.stageDir, 'manifest.json');
    let manifest = readJsonIfPresent(manifestFile);
    const finalTurn = assertInside(ref.saveRoot, path.join(ref.saveRoot, ref.turn));
    const finalManifestFile = path.join(finalTurn, 'transaction.json');
    const existing = readJsonIfPresent(finalManifestFile);
    function matchesDescriptor(candidate) {
      if (!candidate || candidate.transactionId !== ref.transactionId || String(candidate.turn) !== ref.turn) return false;
      if (input.campaignId != null && String(candidate.campaignId || '') !== String(input.campaignId || '')) return false;
      if (input.timelineId != null && String(candidate.timelineId || '') !== String(input.timelineId || '')) return false;
      if (input.stateChecksum != null && String(candidate.stateChecksum || '') !== String(input.stateChecksum || '')) return false;
      return true;
    }
    if (!manifest && matchesDescriptor(existing)) {
      return { success: true, recovered: true, path: finalTurn, transactionId: ref.transactionId };
    }
    if (existing && !matchesDescriptor(existing)) throw new Error('turn-data-transaction-conflict');
    if (existing && manifest && existing.contentHash !== manifest.contentHash) throw new Error('turn-data-content-conflict');
    if (!manifest && migrateLegacy(input)) manifest = readJsonIfPresent(manifestFile);
    if (!matchesDescriptor(manifest)) {
      throw new Error('回合分卷暂存记录不存在或不匹配');
    }
    const stagedTurn = path.join(ref.stageDir, 'turn');
    if (!matchesDescriptor(existing)) {
      if (!fs.existsSync(stagedTurn)) throw new Error('回合分卷暂存内容缺失');
      replaceTurnDirectory(stagedTurn, finalTurn);
    }
    const stagedScenario = path.join(ref.stageDir, 'scenario.json');
    const stagedReference = path.join(ref.stageDir, 'reference.txt');
    const scenarioFile = path.join(ref.saveRoot, 'scenario.json');
    const referenceFile = path.join(ref.saveRoot, 'reference.txt');
    if (fs.existsSync(stagedScenario) && !fs.existsSync(scenarioFile)) writeJsonAtomic(scenarioFile, readJsonIfPresent(stagedScenario));
    if (fs.existsSync(stagedReference) && !fs.existsSync(referenceFile)) writeFileAtomic(referenceFile, fs.readFileSync(stagedReference, 'utf-8'), 'utf-8');
    writeJsonAtomic(finalManifestFile, Object.assign({}, manifest, { status: 'committed', publishedAt: new Date().toISOString() }));
    removeStage(ref.stageDir);
    return { success: true, path: finalTurn, transactionId: ref.transactionId };
  }

  function discard(input) {
    const ref = descriptor(input);
    const manifest = readJsonIfPresent(path.join(ref.stageDir, 'manifest.json'));
    if (manifest && !matches(manifest, input)) throw new Error('turn-data-discard-conflict');
    removeStage(ref.stageDir);
    return { success: true, transactionId: ref.transactionId };
  }

  function writeLegacy(input) {
    throw new Error('turn-data-protocol-upgrade-required: 请使用 canonical receipt 两阶段协议');
  }

  return { stage, publish, recover: publish, discard, writeLegacy, rootFor, descriptor, read, list, remove };
}

module.exports = { createTurnDataCommitter };

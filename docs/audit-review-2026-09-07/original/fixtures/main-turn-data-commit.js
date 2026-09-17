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
  const writeJson = deps.writeJson;
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
    const saveRoot = assertInside(turnDataDir, turnDataRoot(saveName, true));
    const saveKey = path.basename(saveRoot);
    const txId = transactionId(input.transactionId);
    const turn = turnSeg(input.turn);
    const stageDir = assertInside(stagingRoot, path.join(stagingRoot, saveKey, txId));
    return { saveName, saveRoot, saveKey, transactionId: txId, turn, stageDir };
  }

  function readJsonIfPresent(file) {
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
    writeJson(path.join(turnDir, 'context.json'), data.context || data);
    if (data.playerInput) writeJson(path.join(turnDir, 'player-input.json'), data.playerInput);
    if (data.aiResults) writeJson(path.join(turnDir, 'ai-results.json'), data.aiResults);
    if (data.varChanges) writeJson(path.join(turnDir, 'var-changes.json'), data.varChanges);
    writeJsonAtomic(path.join(turnDir, 'transaction.json'), manifest);
  }

  function stage(input) {
    const ref = descriptor(input);
    const data = input && input.data;
    if (!data || typeof data !== 'object') throw new Error('回合分卷数据为空');
    removeStage(ref.stageDir);
    ensureWritableDir(ref.stageDir);
    const manifest = {
      version: 1,
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
    const backup = finalTurn + '.bak-' + process.pid + '-' + crypto.randomUUID();
    let movedOld = false;
    try {
      ensureWritableDir(path.dirname(finalTurn));
      if (fs.existsSync(finalTurn)) { fs.renameSync(finalTurn, backup); movedOld = true; }
      fs.renameSync(stagedTurn, finalTurn);
      if (movedOld) fs.rmSync(backup, { recursive: true, force: true });
    } catch (error) {
      try { if (movedOld && !fs.existsSync(finalTurn) && fs.existsSync(backup)) fs.renameSync(backup, finalTurn); } catch (_) {}
      throw error;
    }
  }

  function publish(input) {
    const ref = descriptor(input);
    const manifestFile = path.join(ref.stageDir, 'manifest.json');
    const manifest = readJsonIfPresent(manifestFile);
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
    removeStage(ref.stageDir);
    return { success: true, transactionId: ref.transactionId };
  }

  function writeLegacy(input) {
    input = input || {};
    const txId = 'legacy-' + Date.now() + '-' + crypto.randomUUID();
    const staged = stage(Object.assign({}, input, { transactionId: txId }));
    return publish({ saveName: input.saveName, turn: input.turn, transactionId: staged.transactionId });
  }

  return { stage, publish, recover: publish, discard, writeLegacy };
}

module.exports = { createTurnDataCommitter };

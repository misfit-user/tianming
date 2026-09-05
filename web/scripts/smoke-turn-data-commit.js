#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { createTurnDataCommitter } = require('../../main-turn-data-commit.js');
const REPO_ROOT = path.resolve(__dirname, '..', '..');

let assertions = 0;
function check(value, message) {
  if (!value) throw new Error('[smoke-turn-data-commit] ' + message);
  assertions++;
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-turn-data-'));
function ensureWritableDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function writeFileAtomic(file, data, encoding) {
  ensureWritableDir(path.dirname(file));
  const tmp = file + '.tmp-' + crypto.randomUUID();
  fs.writeFileSync(tmp, data, encoding);
  fs.renameSync(tmp, file);
}
function writeJson(file, data) { ensureWritableDir(path.dirname(file)); fs.writeFileSync(file, JSON.stringify(data), 'utf8'); }
function writeJsonAtomic(file, data) { writeFileAtomic(file, JSON.stringify(data), 'utf8'); }
function turnDataRoot(saveName) { return path.join(root, 'save-' + Buffer.from(String(saveName)).toString('hex')); }
function turnSeg(turn) {
  const value = String(turn);
  if (!/^(0|[1-9][0-9]*)$/.test(value)) throw new Error('bad turn');
  return value;
}

const committer = createTurnDataCommitter({
  fs, path, crypto, turnDataDir: root, turnDataRoot, turnSeg,
  ensureWritableDir, writeJson, writeJsonAtomic, writeFileAtomic
});

try {
  const descriptor = {
    saveName: '测试档', turn: 50, campaignId: 'campaign-a', timelineId: 'tml_campaign_a_12345678',
    transactionId: 'turn-11111111-2222-4333-8444-555555555555',
    stateChecksum: 'sha256-probe',
    data: { context: { turn: 50 }, playerInput: { edicts: ['甲'] }, aiResults: { sc1: 'ok' }, varChanges: { money: -1 } }
  };
  const staged = committer.stage(descriptor);
  const finalDir = path.join(committer.rootFor(descriptor), '50');
  check(staged.success === true && !fs.existsSync(finalDir), 'stage must not expose an uncommitted turn directory');
  check(fs.existsSync(path.join(committer.descriptor(descriptor).stageDir, 'turn', 'context.json')),
    'stage persists the complete turn payload for recovery');

  const published = committer.publish(descriptor);
  check(published.success === true && fs.existsSync(path.join(finalDir, 'context.json')), 'publish atomically exposes the committed turn');
  const manifest = JSON.parse(fs.readFileSync(path.join(finalDir, 'transaction.json'), 'utf8'));
  check(manifest.transactionId === descriptor.transactionId && manifest.timelineId === descriptor.timelineId
    && manifest.stateChecksum === 'sha256-probe' && manifest.status === 'committed',
    'published manifest binds transaction/world checksum and records the committed phase');

  const recovered = committer.recover(descriptor);
  check(recovered.success === true && recovered.recovered === true, 'recovery is idempotent after publish already completed');

  const second = Object.assign({}, descriptor, {
    turn: 51,
    transactionId: 'turn-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    data: { context: { turn: 51 } }
  });
  committer.stage(second);
  committer.discard(second);
  check(!fs.existsSync(path.join(committer.rootFor(second), '51')),
    'discard removes only staged data and never creates a formal turn directory');

  const interrupted = Object.assign({}, descriptor, {
    turn: 52,
    transactionId: 'turn-99999999-8888-4777-8666-555555555555',
    data: { context: { turn: 52 }, playerInput: { edicts: ['recover-me'] } }
  });
  committer.stage(interrupted);
  const recoveredFromStage = committer.recover(interrupted);
  check(recoveredFromStage.success === true && fs.existsSync(path.join(committer.rootFor(interrupted), '52', 'player-input.json')),
    'next-start recovery publishes a committed save descriptor left in staging');

  const mainSource = fs.readFileSync(path.join(REPO_ROOT, 'main-impl.js'), 'utf8');
  const preloadSource = fs.readFileSync(path.join(REPO_ROOT, 'preload-impl.js'), 'utf8');
  check(['stage', 'publish', 'recover', 'discard'].every(action => mainSource.includes("ipcMain.handle('" + action + "-turn-data'")),
    'main process exposes every two-phase turn-data channel');
  check(['stageTurnData', 'publishTurnData', 'recoverTurnData', 'discardTurnData'].every(name => preloadSource.includes(name + ':')),
    'preload exposes the bounded two-phase turn-data API');

  const bound = Object.assign({}, descriptor, {
    turn: 53,
    transactionId: 'turn-12121212-3434-4567-8787-909090909090',
    data: { context: { turn: 53 } }
  });
  committer.stage(bound);
  let mismatchRejected = false;
  try { committer.publish(Object.assign({}, bound, { stateChecksum: 'wrong-world' })); }
  catch (_) { mismatchRejected = true; }
  check(mismatchRejected && !fs.existsSync(path.join(committer.rootFor(bound), '53')),
    'publish rejects a descriptor whose world checksum does not match staging');
  check(committer.publish(bound).success === true, 'matching campaign/turn/checksum descriptor can publish after a rejected mismatch');

  console.log('[smoke-turn-data-commit] PASS assertions=' + assertions);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

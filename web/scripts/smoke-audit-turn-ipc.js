'use strict';
const assert = require('assert'), h = require('./lib-audit-main')();
(async () => {
  const a = { saveName: '同名', turn: 10, campaignId: 'campaign-A', timelineId: 'timeline-A', transactionId: 'transaction-A', stateChecksum: 'checksum-A', data: { context: { shizhengji: 'A' }, scenario: { name: 'A' }, refText: 'A' } };
  const b = { ...a, timelineId: 'timeline-B', transactionId: 'transaction-B', data: { context: { shizhengji: 'B' } } };
  for (const input of [a, b]) {
    assert.equal((await h.invoke('stage-turn-data', input)).success, true);
    assert.equal((await h.invoke('publish-turn-data', input)).success, true);
  }
  assert.equal((await h.invoke('read-turn-data', a)).data.context.shizhengji, 'A');
  assert.equal((await h.invoke('read-turn-data', b)).data.context.shizhengji, 'B');
  assert.equal((await h.invoke('read-turns-summary', { ...a, fromTurn: 10, toTurn: 10 })).turns[0].shizhengji, 'A');
  for (const value of ['../', -1, 1.1, '1e3', '01', 1e21]) assert.equal((await h.invoke('read-turns-summary', { ...a, fromTurn: value, toTurn: value })).turns.length, 0);
  assert.equal((await h.invoke('delete-turn-data', a)).success, true);
  assert.equal((await h.invoke('list-turn-data', b)).turns.length, 1);
  assert.equal((await h.invoke('write-turn-data', a)).success, false);
  assert.equal((await h.invoke('stage-turn-data', { ...a, timelineId: '' })).success, false);
  console.log('PASS actual turn namespace IPC read/list/summary/delete and strict turn segments');
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => h.cleanup());

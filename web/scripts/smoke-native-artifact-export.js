'use strict';
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path'),
  crypto = require('node:crypto');
const { createArtifactExporter } = require('../../main-artifact-export.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-artifact-export-'));
const bytes = Buffer.from('真实制品'),
  meta = { filename: 'report.md', sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
let count = 0;
async function test(name, fn) {
  await fn();
  count++;
  console.log('PASS ' + name);
}
(async () => {
  let selected = path.join(dir, 'artifact.md'),
    cancelled = false;
  const options = {
    dialog: { showSaveDialog: async () => ({ filePath: selected, canceled: cancelled }) },
    window: () => null,
    writeFileAtomic: (p, b) => fs.writeFileSync(p, b, { flag: 'wx' }),
  };
  await test('native export writes exact bytes, reads back, and refuses an existing filename', async () => {
    const run = createArtifactExporter(options);
    assert((await run(bytes, meta)).success);
    assert.deepEqual(fs.readFileSync(selected), bytes);
    const before = fs.readFileSync(selected);
    assert(!(await run(bytes, meta)).success);
    assert.deepEqual(fs.readFileSync(selected), before);
  });
  await test('filename created after selection is not silently overwritten', async () => {
    selected = path.join(dir, 'race.md');
    const prior = Buffer.from('another author');
    const run = createArtifactExporter({
      ...options,
      writeFileAtomic(p, b) {
        fs.writeFileSync(p, b, { flag: 'wx' });
        fs.writeFileSync(selected, prior, { flag: 'wx' });
      },
    });
    const out = await run(bytes, meta);
    assert(!out.success);
    assert.equal(out.code, 'EEXIST');
    assert.deepEqual(fs.readFileSync(selected), prior);
    assert(!fs.readdirSync(dir).some((n) => n.endsWith('.tmp')));
  });
  await test('disk quota fault produces no destination or false success, cancellation writes nothing', async () => {
    selected = path.join(dir, 'quota.md');
    const run = createArtifactExporter({
      ...options,
      writeFileAtomic() {
        const e = Error('controlled disk full');
        e.code = 'ENOSPC';
        throw e;
      },
    });
    const out = await run(bytes, meta);
    assert(!out.success);
    assert.equal(out.code, 'ENOSPC');
    assert(!fs.existsSync(selected));
    cancelled = true;
    assert((await createArtifactExporter(options)(bytes, meta)).canceled);
    assert(!fs.existsSync(selected));
  });
  await test('renderer cannot choose arbitrary paths, device names or claim a different byte hash', async () => {
    const run = createArtifactExporter(options);
    for (const filename of ['../report.md', 'C:/report.md', 'NUL.md'])
      await assert.rejects(run(bytes, { ...meta, filename }));
    await assert.rejects(run(bytes, { ...meta, sha256: '0'.repeat(64) }));
  });
  console.log(count + ' PASS / 0 FAIL');
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => fs.rmSync(dir, { recursive: true, force: true }));

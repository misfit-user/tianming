'use strict';
// Deterministic inventory, not a second runtime bundle. Source files stay canonical.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const EXTRA = ['tm-start-contracts.js', 'tm-start-compiler.js', 'tm-start-preparation-runtime.js'];
function build(root) {
  const web = path.resolve(root, 'web'), original = fs.readFileSync(path.join(web, 'index.html'));
  const scripts = [], styles = [], inputs = new Map();
  function resource(ref) {
    if (!/^[a-zA-Z0-9_./-]+(?:\?[a-zA-Z0-9_=.-]+)?$/.test(ref) || ref.split(/[/?]/).includes('..') || ref.startsWith('/')) throw Error('Nonlocal native resource: ' + ref);
    const file = ref.split('?')[0], absolute = path.resolve(web, file), real = fs.realpathSync(absolute);
    if (!real.startsWith(fs.realpathSync(web) + path.sep)) throw Error('Native resource escaped root: ' + file);
    const bytes = fs.readFileSync(absolute), row = { file, byteLength: bytes.length, sha256: sha(bytes) };
    if (inputs.has(file) && inputs.get(file).sha256 !== row.sha256) throw Error('Resource changed during inventory');
    inputs.set(file, row); return { ...row, request: ref };
  }
  let template = original.toString('utf8').replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi, (_all, attrs, body) => {
    const src = /\bsrc\s*=\s*['"]([^'"]+)['"]/i.exec(attrs), type = /\btype\s*=\s*['"]([^'"]+)['"]/i.exec(attrs);
    if (type && !['text/javascript', 'application/javascript'].includes(type[1])) throw Error('Unsupported native script type');
    scripts.push(src ? resource(src[1]) : { text: body, byteLength: Buffer.byteLength(body), sha256: sha(body) }); return '';
  });
  template = template.replace(/<link\b[^>]*>/gi, all => {
    if (!/\brel\s*=\s*['"]stylesheet['"]/i.test(all)) return all;
    const href = /\bhref\s*=\s*['"]([^'"]+)['"]/i.exec(all);
    if (!href) throw Error('Native stylesheet has no href');
    styles.push(resource(href[1])); return '';
  });
  EXTRA.forEach(file => { if (!scripts.some(row => row.file === file)) scripts.push(resource(file)); });
  const result = { schemaVersion: 'tm-native-runtime-manifest/1', indexHash: sha(original), template,
    scripts, styles, totalResourceBytes: [...inputs.values()].reduce((sum, row) => sum + row.byteLength, 0) };
  // Report provenance for the host-side workbench, not additional sandbox scripts.
  result.workbenchSources = ['tm-map-workbench.js','tm-map-binding-workbench.js','tm-map-workbench-worker.js','tm-map-workbench-client.js','libs/polygon-clipping-0.15.7.min.js','tm-project-assets.js','tm-workbench-service.js','tm-workbench-artifacts.js','tm-map-asset-formats.js','tm-data-zip.js','tm-agent-kernel.js','editor-authoring-agent.js','editor-authoring-agent-provider.js'].map(file => {
    const bytes=fs.readFileSync(path.join(web,file));return{file,byteLength:bytes.length,sha256:sha(bytes)};
  });
  result.runtimeHash = sha(JSON.stringify(result));
  return result;
}
if (require.main === module) {
  const root = path.resolve(__dirname, '..'), file = path.join(root, 'web/tm-start-runtime-manifest.json');
  const text = JSON.stringify(build(root)) + '\n';
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) throw Error('Native preparation manifest is stale; run this generator with --write');
    console.log('PASS native preparation manifest matches actual runtime bytes');
  } else if (process.argv.includes('--write')) {
    fs.writeFileSync(file, text); if (fs.readFileSync(file, 'utf8') !== text) throw Error('Manifest readback mismatch');
    console.log('WROTE web/tm-start-runtime-manifest.json ' + Buffer.byteLength(text) + ' bytes');
  } else throw Error('Use --check or --write (no version or hot baseline changes)');
}
module.exports = { build };

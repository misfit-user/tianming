#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { build, createTargets, Platform } = require('electron-builder');
const { platformBuildConfig, verifyWindowsArtifacts } = require('./lib/windows-signing.js');

const ROOT = path.resolve(__dirname, '..');

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}

async function main() {
  const platformName = String(arg('platform', '')).trim().toLowerCase();
  const platform = { win: Platform.WINDOWS, mac: Platform.MAC, linux: Platform.LINUX }[platformName];
  if (!platform) throw new Error('--platform 仅允许 win/mac/linux');
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const policy = platformBuildConfig(pkg, platformName, process.env);
  const targets = createTargets([platform], null, platformName === 'win' ? 'x64' : null);
  const artifacts = await build({
    projectDir: ROOT,
    targets,
    config: policy.config,
    publish: 'never'
  });
  if (platformName === 'win') {
    const verified = verifyWindowsArtifacts(artifacts, policy.publisher);
    verified.forEach(row => console.log('[windows-signature] PASS·' + row.file + '·' + row.signature.subject));
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('BUILD FAILED·' + (error && error.stack || error));
    process.exit(1);
  });
}

module.exports = { main };

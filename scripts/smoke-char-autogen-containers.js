#!/usr/bin/env node
// scripts/smoke-char-autogen-containers.js
// Guards aiGenerateCompleteCharacter against object-shaped GM.factions/GM.parties.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

const sandbox = {
  console,
  window: {},
  global: {},
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  _dbg: function(){},
  GM: {
    year: 1628,
    turn: 1,
    chars: [],
    _indices: { charByName: new Map() },
    facs: [
      { id: 'ming', name: '大明', leader: '朱由检', territory: '京师、北直隶、江南' },
      { id: 'houjin', name: '后金', leader: '皇太极', territory: '辽东、沈阳' }
    ],
    factions: {
      ming: { id: 'ming', name: '大明', leader: '朱由检', territory: '京师' },
      rebel: { id: 'rebel', name: '流寇', leader: '高迎祥', territory: '陕西' }
    },
    parties: {
      donglin: { id: 'donglin', name: '东林', leader: '钱谦益' }
    }
  },
  P: {
    ai: { key: 'test-key' },
    conf: { maxOutputTokens: 4000 },
    playerInfo: { characterName: '朱由检' },
    time: { year: 1628 }
  },
  findCharByName: function(name) {
    return sandbox.GM.chars.find(function(c){ return c && c.name === name; }) || null;
  },
  buildIndices: function(){},
  renderRenwu: function(){},
  renderGameState: function(){},
  callAISmart: async function() {
    return JSON.stringify({
      isHistorical: false,
      name: '赵测试',
      age: 34,
      gender: '男',
      origin: '京师',
      title: '给事中',
      bio: '京师士人，熟悉奏章与言路，因策名入朝。',
      personalGoal: '整饬言路',
      ambition: 55,
      intelligence: 78,
      administration: 58,
      valor: 32,
      benevolence: 61,
      loyalty: 72,
      integrity: 74,
      wuchang: { ren: 61, yi: 70, li: 76, zhi: 78, xin: 74 },
      historicalFaction: '大明',
      faction: '大明'
    });
  },
  extractJSON: function(raw) {
    return JSON.parse(raw);
  }
};
sandbox.window = sandbox;
sandbox.global = sandbox;

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-char-autogen.js'), 'utf8'), sandbox, { filename: 'tm-char-autogen.js' });

let pass = 0;
let fail = 0;

function expect(label, condition) {
  if (condition) {
    console.log('  PASS ' + label);
    pass++;
  } else {
    console.log('  FAIL ' + label);
    fail++;
  }
}

async function main() {
  const ch = await sandbox.aiGenerateCompleteCharacter('赵测试', {
    reason: '策名测试',
    sourceContext: '自寻贤臣',
    tier: 'secondary'
  });

  expect('generated character returned', !!ch);
  expect('object-shaped GM.factions did not block generation', sandbox.GM.chars.length === 1);
  expect('faction resolved from mixed containers', ch && ch.faction === '大明');
  expect('char index updated', ch && sandbox.GM._indices.charByName.get('赵测试') === ch);
  expect('missing military field is generated from archetype', ch && typeof ch.military === 'number' && ch.military !== 50);
  expect('missing management field is generated from archetype', ch && typeof ch.management === 'number' && ch.management !== 50);
  expect('missing diplomacy field is generated from archetype', ch && typeof ch.diplomacy === 'number');
  expect('abilities mirror exists', ch && ch.abilities && ch.abilities.military === ch.military && ch.abilities.governance === ch.administration);
  expect('wuchang zhi follows normalized intelligence', ch && ch.wuchang && typeof ch.wuchang.zhi === 'number');

  console.log('\n[smoke-char-autogen-containers] ' + pass + ' passed / ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}

main().catch(function(err) {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});

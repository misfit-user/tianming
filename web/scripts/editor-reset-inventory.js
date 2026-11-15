#!/usr/bin/env node
// editor-reset-inventory.js - Static inventory for the scenario editor reset.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SID = 'sc-tianqi7-1627';

const TOP_LEVEL_COVERAGE = {
  _version: 'scriptInfo',
  id: 'scriptInfo',
  name: 'scriptInfo',
  title: 'scriptInfo',
  dynasty: 'scriptInfo',
  era: 'scriptInfo',
  emperor: 'scriptInfo',
  role: 'scriptInfo',
  overview: 'scriptInfo',
  desc: 'scriptInfo',
  background: 'scriptInfo',
  opening: 'scriptInfo',
  openingText: 'scriptInfo',
  openingHook: 'scriptInfo',
  openingLetters: 'scriptInfo',
  startYear: 'scriptInfo',
  startMonth: 'scriptInfo',
  startLocation: 'scriptInfo',
  historicalFallYear: 'scriptInfo',
  historicalFallMonth: 'scriptInfo',
  historicalFallNote: 'scriptInfo',
  tags: 'scriptInfo',
  scnStyle: 'scriptInfo',
  scnStyleRule: 'scriptInfo',
  refFiles: 'scriptInfo',
  refFilesContent: 'scriptInfo',
  refText: 'scriptInfo',
  _adaptation: 'scriptInfo',
  _buildStatus: 'scriptInfo',
  playerInfo: 'playerOverview',
  gameSettings: 'scriptInfo',
  time: 'scriptInfo',
  characters: 'characters',
  factions: 'factions',
  parties: 'parties',
  classes: 'classes',
  items: 'items',
  relations: 'characters',
  factionRelations: 'factions',
  presetRelations: 'characters',
  initialEnYuan: 'characters',
  initialPatronNetwork: 'characters',
  variables: 'variables',
  rules: 'rules',
  events: 'events',
  rigidHistoryEvents: 'events',
  rigidTriggers: 'events',
  timeline: 'timeline',
  goals: 'goals',
  winCond: 'goals',
  loseCond: 'goals',
  worldSettings: 'worldSettings',
  worldview: 'worldSettings',
  eraState: 'eraState',
  economyConfig: 'economy',
  populationConfig: 'eraState',
  renliPilot: 'economy',
  fiscalConfig: 'economy',
  guoku: 'economy',
  guoku_advanced: 'economy',
  map: 'mapSystem',
  mapData: 'mapSystem',
  mapRuntimeContract: 'mapSystem',
  adminHierarchy: 'administration',
  adminConfig: 'administration',
  government: 'government',
  officeTree: 'government',
  officeConfig: 'government',
  keju: 'kejuSystem',
  haremConfig: 'haremConfig',
  palaceSystem: 'palaceSystem',
  buildingSystem: 'buildingSystem',
  postSystem: 'postSystem',
  vassalSystem: 'vassalSystem',
  titleSystem: 'titleSystem',
  officialVassalMapping: 'vassalSystem',
  military: 'military',
  militaryConfig: 'military',
  battleConfig: 'military',
  techTree: 'techTree',
  civicTree: 'civicTree',
  influenceGroups: 'influenceGroups',
  offendGroups: 'offendGroups',
  imperialEdicts: 'imperialEdicts',
  authorityConfig: 'government',
  authorityConfigDeep: 'government',
  corruption: 'government',
  engineConstants: 'rules',
  edictConfig: 'rules',
  customPresets: 'rules',
  customPrompt: 'rules',
  modelRequirements: 'rules',
  mechanics: 'rules',
  warConfig: 'military',
  diplomacyConfig: 'factions',
  schemeConfig: 'characters',
  decisionConfig: 'rules',
  eventConstraints: 'events',
  chronicleConfig: 'events',
  culturalConfig: 'worldSettings',
  aiAutoEnrich: 'rules',
  masterScript: 'scriptInfo',
  isFullyDetailed: 'scriptInfo',
  externalForces: 'factions',
  neitang: 'government',
  neitang_advanced: 'government',
  chaoyi: 'government',
  tinyi: 'government'
};

const RESET_BLUEPRINT_MODULES = [
  {
    id: 'scenarioOpening',
    title: '剧本总览与玩家开局',
    currentPanels: ['scriptInfo', 'playerOverview'],
    topLevelKeys: [
      '_version', 'id', 'name', 'desc', 'dynasty', 'dynastyPhaseHint', 'era',
      'emperor', 'role', 'background', 'overview', 'openingText', 'opening',
      'openingLetters', 'playerInfo', 'gameSettings', 'startYear', 'active',
      'startMonth', 'startLocation', 'openingHook', 'tags', 'scnStyle',
      'historicalFallYear', 'historicalFallMonth', 'historicalFallNote',
      'scnStyleRule', 'refFiles', 'refFilesContent', 'refText',
      'masterScript', 'isFullyDetailed', '_adaptation', '_buildStatus'
    ]
  },
  {
    id: 'peopleLineages',
    title: '人物、立绘、家族与特质',
    currentPanels: ['characters', 'items'],
    topLevelKeys: [
      'characters', 'families', 'relations', 'presetRelations',
      'traitDefinitions', 'items', 'schemeConfig', 'initialEnYuan',
      'initialPatronNetwork'
    ]
  },
  {
    id: 'factionsSociety',
    title: '势力、党派、阶层与外交',
    currentPanels: ['factions', 'parties', 'classes'],
    topLevelKeys: [
      'factions', 'factionRelations', 'parties', 'classes',
      'externalForces', 'diplomacyConfig'
    ]
  },
  {
    id: 'courtInstitutions',
    title: '朝廷制度与宫殿系统',
    currentPanels: [
      'government', 'haremConfig', 'kejuSystem', 'palaceSystem',
      'postSystem', 'titleSystem', 'vassalSystem', 'variables'
    ],
    topLevelKeys: [
      'government', 'officeTree', 'officeConfig', 'authorityConfig',
      'authorityConfigDeep', 'corruption', 'neitang', 'neitang_advanced',
      'chaoyi', 'tinyi', 'haremConfig', 'palaceSystem',
      'keju', 'postSystem', 'titleSystem', 'vassalSystem',
      'officialVassalMapping', 'variables'
    ]
  },
  {
    id: 'adminMap',
    title: '行政区划、地图、城市与建筑',
    currentPanels: ['administration', 'mapSystem', 'buildingSystem', 'civicTree', 'techTree'],
    topLevelKeys: [
      'adminHierarchy', 'map', 'mapData', 'mapRuntimeContract', 'cities',
      'adminConfig', 'buildingSystem', 'civicTree', 'techTree'
    ]
  },
  {
    id: 'economyPopulation',
    title: '经济、人口、环境与文化',
    currentPanels: ['economy', 'eraState', 'worldSettings'],
    topLevelKeys: [
      'economyConfig', 'populationConfig', 'fiscalConfig', 'guoku',
      'guoku_advanced', 'environmentConfig', 'culturalConfig', 'culturalWorks', 'renliPilot',
      'worldSettings', 'worldview', 'eraState'
    ]
  },
  {
    id: 'militaryFrontier',
    title: '军务、战事与边防',
    currentPanels: ['military'],
    topLevelKeys: ['military', 'militaryConfig', 'battleConfig', 'warConfig']
  },
  {
    id: 'eventsChronicle',
    title: '事件、硬历史锁、时间线与胜负条件',
    currentPanels: ['events', 'timeline', 'goals'],
    topLevelKeys: [
      'events', 'rigidHistoryEvents', 'rigidTriggers', 'timeline', 'goals',
      'winCond', 'loseCond', 'chronicleConfig', 'eventConstraints', 'histAnchors'
    ]
  },
  {
    id: 'rulesAi',
    title: '规则、机制、预设与 AI 要求',
    currentPanels: ['rules'],
    topLevelKeys: [
      'rules', 'globalRules', 'mechanics', 'mechanicsConfig',
      'customPresets', 'customPrompt', 'modelRequirements',
      'engineConstants', 'edictConfig', 'imperialEdicts',
      'influenceGroups', 'offendGroups', 'aiAutoEnrich', 'decisionConfig'
    ]
  }
];

const CHARACTER_FIELD_GROUPS = [
  {
    id: 'identity',
    title: '身份与生平',
    fields: [
      'id', 'sid', 'name', 'zi', 'haoName', 'gender', 'age', 'birthYear',
      'birthTime', 'birthplace', 'ethnicity', 'culture', 'faith', 'bio',
      'appearance', 'portrait', 'isHistorical'
    ]
  },
  {
    id: 'familyKinship',
    title: '家族与血亲',
    fields: [
      'family', 'familyRole', 'familyStatus', 'familyTier', 'familyMembers',
      'father', 'mother', 'spouse', 'relations', 'rels', 'royalRelation',
      'isRoyal', 'clanPrestige'
    ]
  },
  {
    id: 'officeCareer',
    title: '官职、阶层与履历',
    fields: [
      'officialTitle', 'occupation', 'rankLevel', 'career', 'class', 'faction',
      'party', 'partyRank', 'location', 'administration', 'vassalType',
      'title', 'role', 'type'
    ]
  },
  {
    id: 'abilitiesTraits',
    title: '能力、特质与价值观',
    fields: [
      'intelligence', 'learning', 'management', 'military', 'valor',
      'charisma', 'diplomacy', 'integrity', 'benevolence', 'loyalty',
      'skills', 'traits', 'traitIds', 'valueSystem', 'wuchangOverride'
    ]
  },
  {
    id: 'aiPersona',
    title: 'AI 人格与行为',
    fields: [
      'aiPersonaText', 'persona', 'personality', 'behaviorMode',
      'innerThought', 'ambition', 'personalGoal', 'personalGoals', 'stance',
      'speechStyle', 'diction', 'dialogues', 'secret', 'stressSources'
    ]
  },
  {
    id: 'resourcesMemory',
    title: '资源、记忆与出处',
    fields: [
      'resources', '_memory', 'historicalSources', 'hobbies', 'mentor',
      'playerRelation', 'alive'
    ]
  }
];

const FACTION_FIELD_GROUPS = [
  {
    id: 'identity',
    title: '身份与领土根基',
    fields: [
      'id', 'sid', 'name', 'type', 'desc', 'description', 'color', 'capital',
      'territory', 'culture', 'ideology', 'mainstream', 'history',
      'historicalEvents'
    ]
  },
  {
    id: 'leadership',
    title: '首领与成员',
    fields: [
      'leader', 'leaderInfo', 'leaderTitle', 'leadership', 'heirInfo',
      'members', 'internalParties', 'partyRelations'
    ]
  },
  {
    id: 'npcStrategy',
    title: 'NPC 策略与决策提示',
    fields: [
      'aiProfile', 'personality', 'goal', 'strategy', 'longTermStrategy',
      'strategicPriorities', 'decisionHints', 'npcDecisionHints',
      'openingProblems', 'tabooMoves', 'strengths', 'weaknesses'
    ]
  },
  {
    id: 'diplomacy',
    title: '外交与玩家关系',
    fields: [
      'attitude', 'attitudeDetail', 'relations', 'playerRelation',
      'knownSpies', 'publicOpinion', 'popularInfluence', 'courtInfluence'
    ]
  },
  {
    id: 'economyMilitary',
    title: '经济、军事与资源',
    fields: [
      'economy', 'economicPolicy', 'economicStructure', 'treasury',
      'resources', 'mainResources', 'population', 'militaryStrength',
      'militaryBreakdown', 'warState', 'techLevel', 'cultureLevel',
      'strength', 'cohesion'
    ]
  },
  {
    id: 'succession',
    title: '继承与终局条件',
    fields: [
      'succession', 'victoryConditions', 'defeatConditions',
      'offendThresholds', 'traits'
    ]
  }
];

const ADMIN_FIELD_GROUPS = [
  {
    id: 'divisionIdentity',
    title: '区划身份与层级',
    fields: ['id', 'name', 'level', 'type', 'children', 'divisions', 'parent', 'capital']
  },
  {
    id: 'divisionStats',
    title: '人口、财政与地方状况',
    fields: [
      'population', 'economy', 'tax', 'grain', 'military', 'publicOrder',
      'minxin', 'corruption', 'resources'
    ]
  }
];

function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

function stripQuery(src) {
  return String(src || '').replace(/[?#].*$/, '');
}

function uniqSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function listJsonScenarioFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith('.json'))
    .map((name) => path.join(dir, name));
}

function loadBuiltinScenario(root) {
  const builtin = path.join(root, 'scenarios', 'tianqi7-1627.js');
  if (!fs.existsSync(builtin)) return null;

  const ctx = {
    console: { log: function() {}, warn: function() {}, error: function() {} },
    document: { readyState: 'complete' },
    P: {
      scenarios: [],
      scripts: [],
      characters: [],
      factions: [],
      parties: [],
      classes: [],
      variables: [],
      events: [],
      relations: [],
      factionRelations: [],
      rules: [],
      worldview: [],
      items: [],
      rigidHistoryEvents: []
    }
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(readText(builtin), ctx, { filename: builtin });
  const sc = (ctx.P.scenarios || []).find((item) => item && item.id === SID);
  if (!sc) return null;

  [
    'characters', 'factions', 'parties', 'classes', 'variables', 'events',
    'relations', 'factionRelations', 'rules', 'worldview', 'items',
    'rigidHistoryEvents'
  ].forEach((key) => {
    if (!Array.isArray(sc[key]) || sc[key].length === 0) {
      sc[key] = (ctx.P[key] || []).filter((item) => item && item.sid === SID);
    }
  });
  return { scenario: sc, source: builtin };
}

function loadOfficialScenario(root) {
  const desktopDir = path.resolve(root, '..', 'scenarios');
  // The repository also contains personal/draft scenarios that deliberately
  // reuse the Tianqi id. Never let directory ordering select one as the reset
  // baseline: the exact official filename is the truth source.
  const official = path.join(desktopDir, '天启七年·九月（官方）.json');
  if (fs.existsSync(official)) {
    // 真源只存 map；编辑器基线要的是 map、mapData 俱全的运行时形态。
    const data = require('./official-scenario-source.js').withMapData(JSON.parse(readText(official)));
    if (!data || data.id !== SID) throw new Error('official Tianqi id mismatch: ' + official);
    return { scenario: data, source: official };
  }
  const candidates = listJsonScenarioFiles(desktopDir);
  for (const file of candidates) {
    try {
      const data = JSON.parse(readText(file));
      if (data && data.id === SID) return { scenario: data, source: file };
    } catch (_) {}
  }

  const fallback = loadBuiltinScenario(root);
  if (fallback) return fallback;
  throw new Error('official scenario not found: ' + SID);
}

function countMapOceans(map) {
  if (!map || typeof map !== 'object') return 0;
  const oceans = map.oceans || map.oceanRegions || map.seaRegions;
  if (Array.isArray(oceans)) return oceans.length;
  if (oceans && typeof oceans === 'object') return Object.keys(oceans).length;
  return (map.regions || []).filter((region) => {
    const type = String(region && (region.type || region.kind || region.terrain || '')).toLowerCase();
    return type.indexOf('ocean') >= 0 || type.indexOf('sea') >= 0 || type.indexOf('海') >= 0;
  }).length;
}

function summarizeOfficialScenario(scenario, source) {
  const map = scenario.map || scenario.mapData || {};
  return {
    id: scenario.id,
    name: scenario.name || scenario.title || '',
    source,
    topLevelKeys: Object.keys(scenario).length,
    keys: Object.keys(scenario).sort(),
    counts: {
      characters: Array.isArray(scenario.characters) ? scenario.characters.length : 0,
      factions: Array.isArray(scenario.factions) ? scenario.factions.length : 0,
      parties: Array.isArray(scenario.parties) ? scenario.parties.length : 0,
      classes: Array.isArray(scenario.classes) ? scenario.classes.length : 0,
      variables: Array.isArray(scenario.variables) ? scenario.variables.length :
        Object.keys(scenario.variables || {}).length,
      events: Array.isArray(scenario.events) ? scenario.events.length :
        Object.keys(scenario.events || {}).length,
      adminHierarchyGroups: Object.keys(scenario.adminHierarchy || {}).length,
      mapRegions: Array.isArray(map.regions) ? map.regions.length : 0,
      mapOceans: countMapOceans(map)
    },
    sampleFields: {
      character: summarizeKeys((scenario.characters || [])[0]),
      faction: summarizeKeys((scenario.factions || [])[0]),
      adminDivision: summarizeKeys(firstAdminDivision(scenario.adminHierarchy))
    }
  };
}

function summarizeKeys(obj) {
  return obj && typeof obj === 'object' ? Object.keys(obj).sort() : [];
}

function collectArrayKeys(items) {
  const out = new Set();
  (Array.isArray(items) ? items : []).forEach((item) => {
    if (!item || typeof item !== 'object') return;
    Object.keys(item).forEach((key) => out.add(key));
  });
  return Array.from(out).sort();
}

function summarizeFieldGroups(allFields, groups) {
  const fieldSet = new Set(allFields);
  return groups.map((group) => {
    const presentFields = group.fields.filter((field) => fieldSet.has(field));
    return {
      id: group.id,
      title: group.title,
      presentFields,
      missingFields: group.fields.filter((field) => !fieldSet.has(field)),
      coverage: group.fields.length ? presentFields.length / group.fields.length : 0
    };
  });
}

function collectAdminDivisionKeys(adminHierarchy) {
  const out = new Set();
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    Object.keys(node).forEach((key) => out.add(key));
    const children = Array.isArray(node.children) ? node.children :
      (Array.isArray(node.divisions) ? node.divisions : []);
    children.forEach(visit);
  };
  Object.values(adminHierarchy || {}).forEach(visit);
  return Array.from(out).sort();
}

function buildNestedFieldGroups(scenario) {
  const characterFields = collectArrayKeys(scenario.characters);
  const factionFields = collectArrayKeys(scenario.factions);
  const familyFields = collectArrayKeys(scenario.families);
  const adminDivisionFields = collectAdminDivisionKeys(scenario.adminHierarchy);
  const map = scenario.map || scenario.mapData || {};
  const mapRegionFields = collectArrayKeys(map.regions);

  return {
    character: {
      totalFields: characterFields.length,
      fields: characterFields,
      groups: summarizeFieldGroups(characterFields, CHARACTER_FIELD_GROUPS)
    },
    faction: {
      totalFields: factionFields.length,
      fields: factionFields,
      groups: summarizeFieldGroups(factionFields, FACTION_FIELD_GROUPS)
    },
    family: {
      totalFields: familyFields.length,
      fields: familyFields
    },
    adminDivision: {
      totalFields: adminDivisionFields.length,
      fields: adminDivisionFields,
      groups: summarizeFieldGroups(adminDivisionFields, ADMIN_FIELD_GROUPS)
    },
    mapRegion: {
      totalFields: mapRegionFields.length,
      fields: mapRegionFields
    }
  };
}

function firstAdminDivision(adminHierarchy) {
  const roots = Object.values(adminHierarchy || {});
  for (const root of roots) {
    if (!root || typeof root !== 'object') continue;
    if (Array.isArray(root.children) && root.children[0]) return root.children[0];
    if (Array.isArray(root.divisions) && root.divisions[0]) return root.divisions[0];
  }
  return null;
}

function parseEditorHtml(root) {
  const file = path.join(root, 'editor.html');
  const html = readText(file);
  const panelIds = [];
  const panelRe = /class=["'][^"']*\bpanel-section\b[^"']*["'][^>]*\bid=["']panel-([^"']+)["']/g;
  let match;
  while ((match = panelRe.exec(html))) panelIds.push(match[1]);

  const sidebarPanels = [];
  const hiddenPanels = [];
  const sidebarRe = /<div\b[^>]*class=["'][^"']*\bsidebar-item\b[^"']*["'][^>]*data-panel=["']([^"']+)["'][^>]*>/g;
  while ((match = sidebarRe.exec(html))) {
    const tag = match[0];
    const panel = match[1];
    sidebarPanels.push(panel);
    if (/display\s*:\s*none/i.test(tag)) hiddenPanels.push(panel);
  }

  const scriptOrder = [];
  const scriptRe = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g;
  while ((match = scriptRe.exec(html))) {
    scriptOrder.push(path.basename(stripQuery(match[1])));
  }

  const reachable = new Set(sidebarPanels);
  const unreachablePanels = uniqSorted(panelIds.filter((panel) => !reachable.has(panel)));
  return {
    file,
    panelIds: uniqSorted(panelIds),
    sidebarPanels: uniqSorted(sidebarPanels),
    hiddenPanels: uniqSorted(hiddenPanels),
    unreachablePanels,
    scriptOrder,
    hasMapEditorLink: html.indexOf('id="map-editor-link"') >= 0,
    mapEditorLinkOpensWindow: /id=["']map-editor-link["'][\s\S]{0,220}window\.open\(['"]map-editor\.html/.test(html)
  };
}

function buildCoverage(scenarioSummary, editorSummary) {
  const panels = new Set(editorSummary.panelIds);
  const mappedTopLevelKeys = [];
  const missingPanelMappings = [];
  const unmappedTopLevelKeys = [];

  scenarioSummary.keys.forEach((key) => {
    const panel = TOP_LEVEL_COVERAGE[key];
    if (!panel) {
      unmappedTopLevelKeys.push(key);
      return;
    }
    mappedTopLevelKeys.push(key);
    if (!panels.has(panel)) {
      missingPanelMappings.push({ key, panel });
    }
  });

  return {
    knownCoverageCount: mappedTopLevelKeys.length,
    mappedTopLevelKeys: mappedTopLevelKeys.sort(),
    unmappedTopLevelKeys: unmappedTopLevelKeys.sort(),
    missingPanelMappings: missingPanelMappings.sort((a, b) => a.key.localeCompare(b.key))
  };
}

function buildResetBlueprint(scenario, scenarioSummary, editorSummary) {
  const officialKeys = new Set(scenarioSummary.keys);
  const panelSet = new Set(editorSummary.panelIds);
  const assigned = new Map();
  const modules = RESET_BLUEPRINT_MODULES.map((mod) => {
    const topLevelKeys = mod.topLevelKeys.filter((key) => officialKeys.has(key));
    topLevelKeys.forEach((key) => {
      if (!assigned.has(key)) assigned.set(key, []);
      assigned.get(key).push(mod.id);
    });
    return {
      id: mod.id,
      title: mod.title,
      currentPanels: mod.currentPanels.filter((panel) => panelSet.has(panel)),
      missingCurrentPanels: mod.currentPanels.filter((panel) => !panelSet.has(panel)),
      topLevelKeys,
      topLevelCount: topLevelKeys.length
    };
  });

  const duplicateTopLevelKeys = Array.from(assigned.entries())
    .filter((entry) => entry[1].length > 1)
    .map((entry) => ({ key: entry[0], modules: entry[1] }))
    .sort((a, b) => a.key.localeCompare(b.key));

  return {
    modules,
    assignedTopLevelKeys: Array.from(assigned.keys()).sort(),
    unassignedTopLevelKeys: scenarioSummary.keys.filter((key) => !assigned.has(key)).sort(),
    duplicateTopLevelKeys,
    nestedFieldGroups: buildNestedFieldGroups(scenario)
  };
}

function detectRisks(root, editorSummary) {
  const risks = [];
  const fullgen = readText(path.join(root, 'editor-fullgen.js'));
  const core = readText(path.join(root, 'editor-core.js'));
  const html = readText(path.join(root, 'editor.html'));

  if (/function\s+autoSave\b[\s\S]*?saveScenario\(\s*fname\s*,\s*scriptData\s*\)/.test(fullgen)) {
    risks.push({
      id: 'desktop-autosave-raw-scriptData',
      severity: 'high',
      detail: 'autoSave can write raw scriptData to desktop while manual save/export uses SchemaAdapter.exportScenario.'
    });
  }

  if (editorSummary.hasMapEditorLink &&
      editorSummary.mapEditorLinkOpensWindow &&
      /getElementById\(['"]map-editor-link['"]\)/.test(core) &&
      /getElementById\(['"]panel-map['"]\)/.test(core) &&
      /toggleMapEditor/.test(core)) {
    risks.push({
      id: 'map-editor-link-split-brain',
      severity: 'medium',
      detail: 'map-editor-link opens standalone map editor, while editor-core still tries an old embedded panel-map/toggleMapEditor path.'
    });
  }

  if (editorSummary.unreachablePanels.length) {
    risks.push({
      id: 'unreachable-editor-panels',
      severity: 'medium',
      detail: 'Some panel-section ids have no visible sidebar route: ' +
        editorSummary.unreachablePanels.slice(0, 12).join(', ')
    });
  }

  if (/id=["']adminTreeInner["']/.test(html) ||
      /class=["']gov-tree-node\b/.test(html) ||
      /openMapDivisionModal\(['"]admin_/.test(html) ||
      /id=["']admin-stats-details["']>\s*<div\b/.test(html)) {
    risks.push({
      id: 'stale-rendered-admin-dom',
      severity: 'medium',
      detail: 'editor.html contains pre-rendered administration output instead of empty renderer-owned mounts.'
    });
  }

  return risks;
}

function buildScenarioEditorResetInventory(options) {
  const root = path.resolve((options && options.root) || path.resolve(__dirname, '..'));
  const official = loadOfficialScenario(root);
  // 可移植 source：相对 repo root + 正斜杠（绝对路径会随构建机漂移·CI 重生成派生物 git diff 报 stale·对齐 build-scenario-editor-reset-data.js 的 payload.source）
  const officialSummary = summarizeOfficialScenario(official.scenario, path.relative(path.resolve(root, '..'), official.source).replace(/\\/g, '/'));
  const editorSummary = parseEditorHtml(root);
  return {
    generatedAt: new Date().toISOString(),
    officialScenario: officialSummary,
    editor: editorSummary,
    coverage: buildCoverage(officialSummary, editorSummary),
    blueprint: buildResetBlueprint(official.scenario, officialSummary, editorSummary),
    risks: detectRisks(root, editorSummary)
  };
}

function printCliReport(report) {
  console.log('Scenario editor reset inventory');
  console.log('official:', report.officialScenario.name, '(' + report.officialScenario.source + ')');
  console.log('top-level keys:', report.officialScenario.topLevelKeys);
  console.log('counts:', JSON.stringify(report.officialScenario.counts));
  console.log('editor panels:', report.editor.panelIds.length);
  console.log('hidden panels:', report.editor.hiddenPanels.join(', ') || '(none)');
  console.log('unreachable panels:', report.editor.unreachablePanels.join(', ') || '(none)');
  console.log('unmapped top-level keys:', report.coverage.unmappedTopLevelKeys.join(', ') || '(none)');
  console.log('blueprint modules:', report.blueprint.modules.length);
  console.log('blueprint unassigned keys:', report.blueprint.unassignedTopLevelKeys.join(', ') || '(none)');
  console.log('risks:', report.risks.map((risk) => risk.id).join(', ') || '(none)');
}

if (require.main === module) {
  const report = buildScenarioEditorResetInventory({ root: path.resolve(__dirname, '..') });
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printCliReport(report);
  }
}

module.exports = {
  buildScenarioEditorResetInventory,
  buildCoverage,
  buildResetBlueprint,
  loadOfficialScenario,
  parseEditorHtml,
  summarizeOfficialScenario,
  RESET_BLUEPRINT_MODULES
};

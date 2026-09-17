'use strict';
// 合成世界，不取用仍在编辑中的晚唐资料，也不复制任何玩家存档或 API 设置。
const crypto = require('node:crypto');
function fixture() {
  const square = (x) => ({
    type: 'Polygon',
    coordinates: [
      [
        [x, 0],
        [x + 10, 0],
        [x + 10, 10],
        [x, 10],
        [x, 0],
      ],
    ],
  });
  const map = {
    schemaVersion: 'tm-map-asset/1',
    id: 'test-map',
    version: '1',
    coordinateSystemId: 'game-pixel',
    cells: ['ra', 'rb', 'rc'].map((id, i) => ({ id, geometry: square(i * 10) })),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(map));
  const characters = [
    {
      id: 'ca',
      name: '同名君主',
      title: '王',
      factionId: 'fa',
      isPlayer: true,
      alive: true,
      age: 20,
      familyId: 'family-a',
      desc: '甲国人物真源',
      relationships: [{ targetId: 'cb', trust: 17 }],
    },
    {
      id: 'cb',
      name: '同名君主',
      title: '公',
      factionId: 'fb',
      alive: true,
      age: 30,
      familyId: 'family-b',
      desc: '乙国人物真源',
      health: { vigor: 71 },
      secrets: ['合成秘密'],
    },
    { id: 'cr', name: '受托使者', title: '议事代表', factionId: 'fb', alive: true, bio: '角色履历' },
    { id: 'cg', name: '执政', title: '摄政', factionId: 'fb', alive: true },
    { id: 'cc', name: '邻国元首', factionId: 'fc', alive: true },
  ];
  const factions = [
    { id: 'fa', name: '甲国', leaderCharacterId: 'ca', type: 'monarchy', isPlayer: true },
    {
      id: 'fb',
      name: '乙国',
      aliases: ['乙公国'],
      leaderCharacterId: 'cb',
      regentCharacterIds: ['cg'],
      type: 'council',
      desc: '乙国真源',
    },
    { id: 'fc', name: '丙国', leaderCharacterId: 'cc', type: 'monarchy' },
  ];
  const profiles = [
    ['pa', 'fa', 'ca', 'ra', 'headOfState'],
    ['pb', 'fb', 'cb', 'rb', 'headOfState'],
    ['pr', 'fb', 'cr', 'rb', 'delegatedRepresentative'],
    ['pg', 'fb', 'cg', 'rb', 'regent'],
  ].map(([id, factionId, playerCharacterId, startRegionId, roleKind]) => ({
    id,
    factionId,
    playerCharacterId,
    startRegionId,
    roleKind,
    authorityRef: 'authority-' + id,
    rulesetRef: 'rules-' + factionId,
    contentScopeRef: 'scope-' + factionId,
    evidenceStatus: 'fictional',
    enabled: true,
    disabledReasons: [],
  }));
  const authorities = profiles.map((p) => ({
    id: p.authorityRef,
    factionId: p.factionId,
    characterId: p.playerCharacterId,
    roleKind: p.roleKind,
    status: 'active',
    basis:
      p.roleKind === 'delegatedRepresentative'
        ? { kind: 'delegation', issuerCharacterId: 'cb', sourceRef: 'test-author-delegation' }
        : { kind: 'current-office' },
    grants: p.roleKind === 'delegatedRepresentative' ? ['diplomacy'] : ['govern', 'treasury'],
    jurisdiction: { factionIds: [p.factionId], regionIds: [p.startRegionId] },
  }));
  const scenario = {
    id: 'synthetic-world',
    name: '独立通用开局回归样本',
    version: '1',
    opening: '旧主角开场',
    playerInfo: {
      characterName: '旧文案人物',
      factionName: '旧国',
      characterBio: '不应复制的旧人物简介',
      characterTitle: '旧帝王头衔',
    },
    characters,
    factions,
    families: [
      { id: 'family-a', members: ['ca'] },
      { id: 'family-b', members: ['cb'] },
    ],
    classes: [
      { id: 'class-a', name: '商人', factionId: 'fa', satisfaction: 30 },
      { id: 'class-b', name: '商人', factionId: 'fb', satisfaction: 70 },
    ],
    parties: [
      { id: 'party-a', name: '文党', factionId: 'fa', members: ['ca'] },
      { id: 'party-b', name: '文党', factionId: 'fb', members: ['cb'] },
    ],
    events: [
      { id: 'event-a', factionId: 'fa', title: '甲国事件' },
      { id: 'event-b', factionId: 'fb', title: '乙国事件' },
      { id: 'event-world', scope: 'world', title: '全局事件' },
    ],
    military: {
      initialTroops: [
        {
          id: 'army-a',
          name: '甲军',
          soldiers: 50,
          ownerFactionId: 'fa',
          commanderId: 'ca',
          garrisonRegionId: 'ra',
          payerShares: [{ accountId: 'account-a', share: 1 }],
        },
        {
          id: 'army-b',
          name: '乙军',
          soldiers: 80,
          ownerFactionId: 'fb',
          commanderId: 'cb',
          garrisonRegionId: 'rb',
          payerShares: [{ accountId: 'account-b', share: 1 }],
        },
      ],
    },
    officeTree: [{ id: 'office-a', authorityFactionId: 'fa', positions: [] }],
    officeRegistryByFaction: {
      fb: [{ id: 'office-b', authorityFactionId: 'fb', positions: [{ id: 'pos-b', holderId: 'cb' }] }],
    },
    map: {
      id: map.id,
      regions: map.cells.map((r, i) => ({
        id: r.id,
        name: ['甲城', '乙城', '丙岛'][i],
        sovereignFactionId: ['fa', 'fb', 'fc'][i],
        population: [100, 200, 30][i],
      })),
    },
    nativeStart: {
      schemaVersion: 'tm-native-start/1',
      profiles,
      authorities,
      rulesets: ['fa', 'fb'].map((id) => ({
        id: 'rules-' + id,
        version: '1',
        requiredCapabilities: ['test-native-v1'],
        config: { calendar: id === 'fa' ? 'reign' : 'common', privateTreasuryEnabled: false },
      })),
      contentScopes: ['fa', 'fb'].map((id, i) => ({
        id: 'scope-' + id,
        factionId: id,
        classIds: ['class-' + (i ? 'b' : 'a')],
        partyIds: ['party-' + (i ? 'b' : 'a')],
        officeFactionIds: [id],
        openingEventIds: ['event-' + (i ? 'b' : 'a')],
        accountIds: ['account-' + (i ? 'b' : 'a')],
      })),
      accounts: [
        { id: 'account-a', ownerFactionId: 'fa', kind: 'public', unit: 'unit-a', balance: 0 },
        { id: 'account-b', ownerFactionId: 'fb', kind: 'public', unit: 'unit-b', balance: 7 },
      ],
      mapRef: {
        assetId: 'asset-test-map',
        schemaVersion: map.schemaVersion,
        mapId: map.id,
        mapVersion: map.version,
        coordinateSystemId: map.coordinateSystemId,
        contentHash: crypto.createHash('sha256').update(bytes).digest('hex'),
        byteLength: bytes.byteLength,
      },
    },
  };
  return { scenario, map, bytes, capabilities: ['test-native-v1'], resolveMapAsset: async () => bytes };
}
module.exports = { fixture };

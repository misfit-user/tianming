# 晚唐·字段清理与格式归一报告

真源由 60.7MB 减为 51.5MB；删去 map.adminHierarchy（运行时不读的整份行政树拷贝）与 139 个死字段名共 37835 处（按删一次计；map 删后整份复制为 mapData）。原账信息另存 `sources/tang-original-leaves.json`。

## 格式

- population：575 个府州由对象改为口数（明细原已在 populationDetail）。
- 地形：plains→平原 189，hills→丘陵 251，mountains→山地 83，grassland→草原 20，desert→荒漠 11，forest→林地 20，swamp→水乡 1。地块自身的 terrain 仍是地图图例键，不动。
- 省道登记：111 组 memberSeeds 改为 memberRegionIds。

## 道长官

| 道 | 原账官称 | 改写 officialPosition | governor |
| --- | --- | --- | --- |
| 京畿 | 京兆府畿内 | 京兆尹 |  |
| 河中 | 河中节度 | 河中节度使 |  |
| 金商 | 金商二州都防御 | 金商都防御使 |  |
| 东都 | 东都留守辖区 | 东都留守 |  |
| 陕虢 | 陕虢都防御观察 | 陕虢观察使 |  |
| 河东 | 河东节度 | 河东节度使 |  |
| 振武 | 振武 | 振武节度使 | 刘沔 |
| 天德 | 天德军都团练防御 | 天德军防御使 |  |
| 灵盐 | 灵盐 | 朔方节度使 |  |
| 夏绥银 | 夏绥银 | 夏绥银节度使 |  |
| 鄜坊 | 鄜坊丹延管内（丹州另防御） | 鄜坊节度使 |  |
| 丹州防御 | 丹州防御 | 丹州防御使 |  |
| 邠宁 | 邠宁 | 邠宁节度使 |  |
| 泾原 | 泾原 | 泾原节度使 |  |
| 凤翔 | 凤翔 | 凤翔节度使 |  |
| 义武 | 义武 | 义武军节度使 |  |
| 义昌 | 义昌军节度（横海） | 义昌军节度使 |  |
| 平卢 | 淄青平卢节度 | 平卢节度使 |  |
| 天平 | 天平军节度 | 天平军节度使 |  |
| 兖海 | 兖海观察 | 兖海观察使 |  |
| 宣武 | 宣武军节度 | 宣武节度使 | 李绅 |
| 义成 | 义成军节度 | 义成军节度使 |  |
| 忠武 | 忠武军节度 | 忠武军节度使 |  |
| 武宁 | 武宁军节度 | 武宁军节度使 |  |
| 淮南 | 淮南节度 | 淮南节度使 | 李德裕 |
| 鄂岳 | 鄂岳团练观察 | 鄂岳观察使 |  |
| 浙西 | 浙西观察 | 浙西观察使 |  |
| 浙东 | 浙东 | 浙东观察使 |  |
| 宣歙 | 宣歙池管内 | 宣歙观察使 |  |
| 福建 | 福建都团练观察 | 福建观察使 |  |
| 江西 | 江南西道都团练观察 | 江西观察使 |  |
| 湖南 | 湖南 | 湖南观察使 |  |
| 荆南 | 荆南节度 | 荆南节度使 | 李石 |
| 山南东道 | 山南东道节度 | 山南东道节度使 | 牛僧孺 |
| 山南西道 | 山南西道节度 | 山南西道节度使 |  |
| 剑南西川 | 剑南西川节度 | 剑南西川节度使 | 李固言 |
| 剑南东川 | 剑南东川节度 | 剑南东川节度使 |  |
| 黔中 | 黔中 | 黔中观察使 |  |
| 岭南 | 岭南 | 岭南节度使 | 卢钧 |
| 桂管 | 桂管 | 桂管观察使 |  |
| 容管 | 容管 | 容管经略使 |  |
| 邕管 | 邕管 | 邕管经略使 |  |
| 安南 | 安南都护经略 | 安南都护 | 马植 |
| 魏博 | 魏博节度 | 魏博节度使 | 何进滔 |
| 成德 | 成德军节度 | 成德节度使 | 王元逵 |
| 卢龙 | 幽州卢龙节度 | 卢龙节度使 | 史元忠 |
| 昭义 | 昭义军节度 | 昭义节度使 | 刘从谏 |

## 删去的死字段

| 字段 | 处数 |
| --- | --- |
| unregisteredMouths | 1974 |
| deJureOwner | 1770 |
| circuitTitle | 1725 |
| circuitGovernor | 1725 |
| mapGeometryComponents | 1725 |
| mapSourceIds | 1725 |
| registeredLandUnit | 1725 |
| modelStatus | 1725 |
| coverageNote | 1725 |
| sharedBorderPixels | 1478 |
| initialFaction | 1152 |
| maxPopulation | 1150 |
| historicalCounties | 1150 |
| historicalCommandType | 1150 |
| localRepresentatives | 1150 |
| fiscalNarrative | 1150 |
| appointmentAuthorityFactionId | 1092 |
| playRole | 978 |
| compensationNote | 734 |
| payrollGroupId | 734 |
| politicalDomainId | 627 |
| historicalLevel | 575 |
| geometryComponentCount | 575 |
| isInitialMirror | 575 |
| taxBaseUnits | 498 |
| landComponent | 483 |
| classRepresentativeFor | 434 |
| livelihoodType | 434 |
| livelihoodName | 434 |
| assetOwnerId | 434 |
| salaryMode | 434 |
| boundaryConfidence | 301 |
| circuitGovernorId | 285 |
| salaryPeriod | 266 |
| salaryScope | 266 |
| serviceRegime | 266 |
| historicalFacts | 246 |
| administrativeGrouping | 222 |
| historicalRank | 210 |
| reconstructionProvenance | 209 |
| abilityAssessment | 188 |
| relationshipHooks | 188 |
| portraitBinding | 188 |
| knowledgeBoundary | 188 |
| numberBasis | 168 |
| commandType | 160 |
| namedOfficeSlots | 113 |
| geometryMethod | 106 |
| sourceLocalityIds | 80 |
| geometryRepairNotes | 80 |
| fundingNote | 74 |
| historicalTitle | 49 |
| budgetScope | 48 |
| isIndependent | 47 |
| diplomaticStyle | 47 |
| politicalBoundaries | 47 |
| reserveMonths | 47 |
| playableMode | 47 |
| playableRepresentativeId | 35 |
| playableRepresentative | 35 |
| beneficiaryCharacterIds | 28 |
| sharedAmountIncludedInPersonalWealth | 28 |
| quantityKnown | 28 |
| ageEvidence | 26 |
| representativeIds | 24 |
| geographicNameStatus | 24 |
| transportContext | 20 |
| capitalId | 19 |
| assessmentBasis | 18 |
| modelBasis | 17 |
| originalAddressee | 13 |
| receivedDate | 13 |
| salaryBasisValue | 12 |
| governorEvidence | 12 |
| deliveryNote | 9 |
| ageEstimated | 8 |
| internalDisagreements | 8 |
| relationshipAgency | 8 |
| issueRelations | 8 |
| officeRankText | 4 |
| tenureNote | 2 |
| wineScope | 2 |
| tradeScope | 2 |
| treasuryIsInitialMirror | 1 |
| mapPresence | 1 |
| populationBenchmark | 1 |
| recommendedGameMode | 1 |
| dimensionMode | 1 |
| minxinBasis | 1 |
| associates | 1 |
| dimensionRationale | 1 |
| mapPackage | 1 |
| imperialBusinessRevenueAnnual | 1 |
| debtToGuoku | 1 |
| pricePolicy | 1 |
| numbersAreHistoricalCensus | 1 |
| notableExaminers | 1 |
| examIssues | 1 |
| geographicScope | 1 |
| historicalMode | 1 |
| successionRule | 1 |
| allowTeleport | 1 |
| executionPipelineDescription | 1 |
| taboos | 1 |
| vanillaImport | 1 |
| nativeBaseline | 1 |
| requiresNewCampaign | 1 |
| npcFiscalPatchRequiredForAuthoredBudgets | 1 |
| officePolicy | 1 |
| mapPolicy | 1 |
| separateMapSources | 1 |
| mustStartNewGame | 1 |
| enginePatchOptionalButRequiredForPopulationBasedNPCFiscal | 1 |
| noClaimOfSaveMigration | 1 |
| nativeDirectScenarioImportPreservesMultipart | 1 |
| multiFaction | 1 |
| vanillaGameplay | 1 |
| mapExpansionVersion | 1 |
| referenceWindow | 1 |
| releaseStage | 1 |
| playableFactions | 1 |
| historyStatus | 1 |
| baseGameCommit | 1 |
| previousScenarioId | 1 |
| revisionDate | 1 |
| contentRevision | 1 |
| dataRevision | 1 |
| numericAccounting | 1 |
| treasuryCalibration | 1 |
| fiscalCalibration | 1 |
| politicalCalibration | 1 |
| portraitLibrary | 1 |
| geographicOverview | 1 |
| newGeographyDoesNotGrantSovereignty | 1 |
| templateState | 1 |
| reusableBase | 1 |
| activeProfile | 1 |
| associatedAssets | 1 |
| v13 | 1 |

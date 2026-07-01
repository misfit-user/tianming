// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-ai-apply-deaths.js — AI 角色死亡应用器（§D 首个真重构抽出）
//
// R100 从 tm-endturn.js _endTurn_aiInfer 内部抽出·原 L7446-7665 (220 行)
// 处理 AI 返回的 character_deaths 字段·涉及：
//   ch.alive/dead/deathTurn/deathReason 标记
//   官制同步 (_offDismissPerson)
//   相关角色记忆 (NpcMemorySystem)
//   家族影响 (updateFamilyRenown + 族人记忆)
//   军队统帅级联 (commander 清空+士气降)
//   丁忧制度 (子女守丧+currentIssues 夺情选项)
//   势力首领级联 (leader 清空+封臣忠诚下降+世袭继承)
//   头衔继承
//   玩家角色死亡特判 (_playerDead 标记)
//
// 关键：是**首次从 tm-endturn.js 内部异步函数抽 helper**·不同于 R88-R99 搬顶级函数
//      调用方从内联 if-block 改为 applyCharacterDeaths(p1) 单句调用
//
// 所有依赖均 window 全局：findCharByName/_fuzzyFindChar/recordCharacterArc/
//   PostTransfer/_offDismissPerson/NpcMemorySystem/addEB/GameEventBus/
//   updateFamilyRenown/getTSText·闭包访问 GM/P
//
// 加载顺序：必须在 tm-endturn.js 之前
// ============================================================

function applyCharacterDeaths(p1) {
        // AI 可以让角色死亡（疾病、战死、暗杀等）
        if (p1.character_deaths && Array.isArray(p1.character_deaths)) {
          p1.character_deaths.forEach(function(cd) {
            if (!cd.name || !cd.reason) return;
            var ch = (typeof _fuzzyFindChar === 'function' ? _fuzzyFindChar(cd.name) : null) || findCharByName(cd.name);
            if (!ch) return;
            ch.alive = false;
            ch.dead = true;
            ch.deathTurn = GM.turn;
            ch.deathReason = cd.reason;
            if (typeof recordCharacterArc === 'function') recordCharacterArc(cd.name, 'death', cd.reason);
            if (typeof PostTransfer !== 'undefined') PostTransfer.cascadeVacate(cd.name);
            // 官制同步：将死者从所有 actualHolders 中移除（留占位）
            if (GM.officeTree && typeof _offDismissPerson === 'function') {
              (function _clearDead(ns) {
                ns.forEach(function(n) {
                  if (n.positions) n.positions.forEach(function(p) {
                    if (p.holder === cd.name || (Array.isArray(p.actualHolders) && p.actualHolders.some(function(h){return h && h.name===cd.name;}))) {
                      _offDismissPerson(p, cd.name);
                    }
                  });
                  if (n.subs) _clearDead(n.subs);
                });
              })(GM.officeTree);
            }
            // 相关角色记忆此人之死
            if (typeof NpcMemorySystem !== 'undefined') {
              (GM.chars||[]).forEach(function(c2) {
                if (c2.alive === false || c2.name === cd.name) return;
                var _rel = (c2.faction === ch.faction) || (c2.party === ch.party) || (c2.family && c2.family === ch.family);
                if (_rel) NpcMemorySystem.remember(c2.name, cd.name + '离世：' + cd.reason, '忧', 7, cd.name);
              });
            }
            addEB('\u6B7B\u4EA1', cd.name + '\uFF1A' + cd.reason);
            // 2.6: 事件总线广播角色死亡
            if (typeof GameEventBus !== 'undefined') GameEventBus.emit('character:death', { name: cd.name, reason: cd.reason });
            // 家族影响——仅记录记忆和声望，具体情感反应由AI根据每人性格决定
            if (ch.family) {
              if (GM.families && GM.families[ch.family] && typeof updateFamilyRenown === 'function') {
                updateFamilyRenown(ch.family, -2, cd.name + '\u53BB\u4E16');
              }
              // 族人记住此事（AI根据性格决定悲痛/冷漠/窃喜）
              if (GM.chars && typeof NpcMemorySystem !== 'undefined') {
                GM.chars.forEach(function(fm) {
                  if (fm.alive !== false && fm.family === ch.family && fm.name !== cd.name) {
                    NpcMemorySystem.remember(fm.name, '\u65CF\u4EBA' + cd.name + '\u53BB\u4E16\uFF1A' + cd.reason, '\u5E73', 6, cd.name);
                  }
                });
              }
            }
            // 级联清理：军队统帅引用
            if (GM.armies) {
              GM.armies.forEach(function(army) {
                if (army.commander === cd.name) {
                  army.commander = '';
                  army.commanderTitle = '';
                  army.morale = Math.max(0, (army.morale || 50) - 15); // 主帅阵亡士气骤降
                  addEB('\u519B\u4E8B', army.name + '\u4E3B\u5E05' + cd.name + '\u9635\u4EA1\uFF0C\u58EB\u6C14\u9AA4\u964D');
                }
              });
            }
            // 丁忧/服丧——死者的子女如果在任官员，应离职守丧
            var _deadName = cd.name;
            (GM.chars||[]).forEach(function(c3) {
              if (c3.alive === false || c3.isPlayer) return;
              // 检查是否是死者子女（通过family/father/mother字段）
              var _isChild = (c3.father === _deadName || c3.mother === _deadName);
              if (!_isChild && ch.children && Array.isArray(ch.children)) _isChild = ch.children.indexOf(c3.name) >= 0;
              if (!_isChild) return;
              // 此NPC是死者子女→标记丁忧
              if (c3.officialTitle) {
                c3._mourning = { since: GM.turn, until: GM.turn + 9, parent: _deadName }; // 9回合守丧
                addEB('丁忧', c3.name + '因' + _deadName + '去世而丁忧离职');
                if (typeof NpcMemorySystem !== 'undefined') {
                  NpcMemorySystem.remember(c3.name, '父/母' + _deadName + '去世，丁忧守丧', '悲', 10, _deadName);
                }
                // 生成时局要务——提醒玩家可夺情
                if (GM.currentIssues) {
                  GM.currentIssues.push({
                    id: 'issue_mourning_' + c3.name,
                    title: c3.name + '丁忧——是否夺情？',
                    category: '人事',
                    description: c3.name + '（' + (c3.officialTitle||'') + '）因' + _deadName + '去世须离职守丧约9回合。可通过诏令"夺情"强令其留任，但恐引起朝臣非议。',
                    status: 'pending', raisedTurn: GM.turn,
                    raisedDate: typeof getTSText === 'function' ? getTSText(GM.turn) : ''
                  });
                }
              }
            });
            // 级联清理：若死者是势力首领，标记势力动荡
            if (GM.facs) {
              GM.facs.forEach(function(fac) {
                if (fac.leader !== cd.name) return;
                fac.leader = '';
                addEB('\u52BF\u529B\u52A8\u6001', fac.name + '\u9996\u9886' + cd.name + '\u6B7B\u4EA1\uFF0C\u52BF\u529B\u52A8\u8361');
                fac.strength = Math.max(0, (fac.strength || 50) - 10);

                // 封臣级联：宗主首领死亡→所有封臣忠诚度下降
                if (fac.vassals && fac.vassals.length > 0) {
                  fac.vassals.forEach(function(vn) {
                    var vRuler = GM.chars ? GM.chars.find(function(c) { return c.faction === vn && c.alive !== false && (c.position === '\u541B\u4E3B' || c.position === '\u9996\u9886'); }) : null;
                    if (vRuler) {
                      if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(vRuler, -10, '\u5B97\u4E3B\u4E4B\u6B7B', { source:'liege-death-vassal-loyalty' });
                      else vRuler.loyalty = Math.max(0, ((typeof vRuler.loyalty === 'number' && isFinite(vRuler.loyalty)) ? vRuler.loyalty : 50) - 10);
                      addEB('\u5C01\u81E3\u52A8\u6001', vn + '\u5C01\u81E3' + vRuler.name + '\u56E0\u5B97\u4E3B\u4E4B\u6B7B\u5FE0\u8BDA\u5EA6\u4E0B\u964D');
                    }
                  });
                }

                // 封臣首领死亡→检查是否世袭
                if (fac.liege) {
                  // 查找继承人（子嗣或同族）
                  var heir = GM.chars ? GM.chars.find(function(c) {
                    return c.alive !== false && c.faction === fac.name && c.name !== cd.name && (c.parentOf === cd.name || c.father === cd.name);
                  }) : null;
                  if (heir) {
                    fac.leader = heir.name;
                    heir.position = '\u9996\u9886';
                    addEB('\u5C01\u81E3\u7EE7\u627F', fac.name + '\u5C01\u81E3\u7531' + heir.name + '\u7EE7\u627F');
                  } else {
                    addEB('\u5C01\u81E3\u5371\u673A', fac.name + '\u5C01\u81E3\u9996\u9886' + cd.name + '\u6B7B\u4EA1\u4E14\u65E0\u7EE7\u627F\u4EBA\uFF0C\u5C01\u81E3\u5173\u7CFB\u52A8\u6447');
                  }
                }
              });
            }
            // 级联清理：头衔继承
            if (ch.titles && ch.titles.length > 0) {
              ch.titles.forEach(function(t) {
                if (t.hereditary) {
                  // 查找继承人
                  var _titleHeir = GM.chars ? GM.chars.find(function(c) {
                    return c.alive !== false && c.name !== cd.name && (c.father === cd.name || (c.family && c.family === ch.family));
                  }) : null;
                  if (_titleHeir) {
                    if (!_titleHeir.titles) _titleHeir.titles = [];
                    _titleHeir.titles.push({
                      name: t.name, level: t.level,
                      hereditary: t.hereditary, privileges: t.privileges || [],
                      _suppressed: t._suppressed || [],
                      grantedTurn: GM.turn, grantedBy: cd.name + '(\u7EE7\u627F)'
                    });
                    addEB('\u7EE7\u627F', _titleHeir.name + '\u7EE7\u627F\u4E86' + cd.name + '\u7684' + t.name + '\u7235\u4F4D');
                  } else {
                    addEB('\u7235\u4F4D', cd.name + '\u7684' + t.name + '\u7235\u4F4D\u56E0\u65E0\u7EE7\u627F\u4EBA\u800C\u5E9F\u9664');
                  }
                } else {
                  // 非世袭头衔→朝廷收回
                  addEB('\u7235\u4F4D', cd.name + '\u7684' + t.name + '\u5934\u8854(\u6D41\u5B98)\u7531\u671D\u5EF7\u6536\u56DE');
                }
              });
            }
            // 级联清理：行政区划 governor 免职
            if (P.adminHierarchy) {
              var _akDeath = Object.keys(P.adminHierarchy);
              _akDeath.forEach(function(k) {
                var _ahd = P.adminHierarchy[k];
                if (!_ahd || !_ahd.divisions) return;
                function _removeGov(divs) {
                  divs.forEach(function(d) {
                    if (d.governor === cd.name) {
                      d.governor = '';
                      addEB('\u884C\u653F', d.name + '\u4E3B\u5B98' + cd.name + '\u53BB\u4E16\uFF0C\u804C\u4F4D\u7A7A\u7F3A');
                      // 同步省份
                      if (GM.provinceStats && GM.provinceStats[d.name]) {
                        GM.provinceStats[d.name].governor = '';
                        GM.provinceStats[d.name].corruption = Math.min(100, (GM.provinceStats[d.name].corruption || 20) + 10);
                      }
                    }
                    if (d.children) _removeGov(d.children);
                  });
                }
                _removeGov(_ahd.divisions);
              });
            }
            // 级联清理：配偶死亡→后宫更新
            if ((typeof _tmIsPlayerConsort === 'function' ? _tmIsPlayerConsort(ch) : ch.spouse === true) && GM.harem) {
              // 从继承人列表移除该配偶的子嗣（如果子嗣也死了的话由子嗣的死亡事件处理）
              // 从孕期列表移除
              if (GM.harem.pregnancies) {
                GM.harem.pregnancies = GM.harem.pregnancies.filter(function(p) { return p.mother !== cd.name; });
              }
              addEB('\u540E\u5BAB', cd.name + '\u85A8\u901D');
              // 重算继承人（如果有recalculateHeirs函数）
              if (typeof HaremSettlement !== 'undefined' && HaremSettlement.recalculateHeirs) {
                HaremSettlement.recalculateHeirs();
              }
            }
            // 级联清理：继承人死亡→从继承人列表中移除
            if (GM.harem && GM.harem.heirs && GM.harem.heirs.indexOf(cd.name) !== -1) {
              GM.harem.heirs = GM.harem.heirs.filter(function(h) { return h !== cd.name; });
              addEB('\u7EE7\u627F', cd.name + '\u53BB\u4E16\uFF0C\u5DF2\u4ECE\u7EE7\u627F\u4EBA\u5E8F\u5217\u4E2D\u79FB\u9664');
            }
            _dbg('[AI Death] ' + cd.name + ': ' + cd.reason);
            // 1.4→2.6: 叙事事实已由 GameEventBus character:death 监听器自动添加
            // E10: 玩家角色死亡 → 尝试世代传承，否则游戏结束
            if (ch.isPlayer || (P.playerInfo && P.playerInfo.characterName === cd.name)) {
              var _heir = (typeof resolveHeir === 'function') ? resolveHeir(ch) : null;
              if (_heir && _heir.alive !== false) {
                // 世代传承——继承人自动继位
                ch.isPlayer = false;
                _heir.isPlayer = true;
                P.playerInfo.characterName = _heir.name;
                addEB('\u7EE7\u627F', cd.name + '\u9A7E\u5D29\uFF0C' + _heir.name + '\u7EE7\u4F4D');
                if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.addMemory) {
                  NpcMemorySystem.addMemory(_heir.name, '\u5148\u5E1D\u9A7E\u5D29\uFF0C\u7EE7\u627F\u5927\u7EDF', 10, 'career');
                }
                // 全部NPC记忆先帝驾崩
                (GM.chars || []).forEach(function(c2) {
                  if (c2.alive !== false && !c2.isPlayer && typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.addMemory) {
                    NpcMemorySystem.addMemory(c2.name, '\u5148\u5E1D' + cd.name + '\u9A7E\u5D29\uFF0C\u65B0\u541B' + _heir.name + '\u7EE7\u4F4D', 8, 'political');
                  }
                });
                GM._successionEvent = { from: cd.name, to: _heir.name, reason: cd.reason };
                if (typeof GameEventBus !== 'undefined') GameEventBus.emit('succession', { from: cd.name, to: _heir.name, reason: cd.reason });
              } else {
                GM._playerDead = true;
                GM._playerDeathReason = cd.reason;
              }
            }
          });
        }

}

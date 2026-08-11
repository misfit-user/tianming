#!/usr/bin/env node
'use strict';

// 百工谱阁正式版 UI 防腐线：结构、真源语义、强制横屏同构与原有写操作必须同时在场。
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const manager = read('tm-content-manager.js');
const community = read('tm-content-manager-community.js');
const client = read('tm-online-client.js');
const css = read('tm-online-mall.css');
const index = read('index.html');

let passed = 0;
let failed = 0;
function check(condition, message) {
  if (condition) {
    passed += 1;
    console.log('  PASS ' + message);
  } else {
    failed += 1;
    console.error('  FAIL ' + message);
  }
}
function between(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  return a >= 0 && b > a ? source.slice(a, b) : '';
}

console.log('smoke-workshop-runtime-truth-ui');

// 正式壳层与真实动作仍绑定原 TMContentManager。
check(manager.includes('tm-mall tm-mall-page atelier-shell'), '正式工坊使用百工谱阁全屏壳');
check(manager.includes('renderWorkshopSidebar(pane)'), '桌面左侧分组导航已接入');
check(manager.includes('renderWorkshopSourceStrip()'), '正式页面展示逐源状态条');
check(!manager.includes('renderWorkshopMobileDock') && !manager.includes('atelier-mobile-dock'), '正式工坊不再维护安卓版专属导航分支');
check(/class="atelier-hot" onclick="TMContentManager\.switchPane\(\\'updates\\'\)"/.test(manager), '热更入口仍指向正式更新中心');
check(manager.includes('TMContentManager.openDmInbox()'), '正式私信动作仍在');
check(manager.includes('installCatalogPack: installCatalogPack'), '正式安装动作仍导出');
check(manager.includes('submitWorkshopPublication: submitWorkshopPublication'), '正式投稿审核动作仍导出');

// 目录/精选逐源读取，失败时只回退仓库官方真值。
check(manager.includes("catalogStatus: 'idle'") && manager.includes("featuredStatus: 'idle'"), '目录与精选有独立状态机');
check(manager.includes('function refreshWorkshopSources(force)'), '统一真源刷新器存在');
check((manager.match(/refreshWorkshopSources\(false\)/g) || []).length >= 2, '网页与桌面打开工坊都会自动读真源');
check(manager.includes("fetch('bundled-scenarios/manifest.json?ts='") && manager.includes("_truthOrigin: 'bundled-manifest'"), '在线目录失败只回退仓库官方清单');
check(manager.includes("refreshWorkshopSources: function(){ return refreshWorkshopSources(true); }"), '真源刷新动作已公开给 UI');
check(client.includes("if (!resp.ok) throw new Error('在线目录 HTTP ' + resp.status)"), '目录直链检查 HTTP 状态');
check((client.match(/cat && cat\.success === false/g) || []).length >= 2, '目录两条请求路径都拒绝 success=false');

const discover = between(community, 'function renderDiscover()', 'function mallFopt');
const ranks = between(community, 'function renderRanksPane()', 'function renderArenaSection');
const topics = between(community, 'function renderTopicsPane()', 'function renderCollectionSection');
check(discover.includes('state.featuredPacks') && discover.includes('正式精选接口返回'), '首页精选只取正式 featured 接口');
check(!discover.includes('hot[0]') && !discover.includes('编辑推荐') && !discover.includes('本周精选'), '首页不拿热门目录伪装编辑精选');
check(discover.includes('不会用样例或零值补齐'), '首页明确声明缺字段策略');
check(discover.includes("filter(function(p){ return hasMetric(p, 'downloads'); })"), '热门下载只纳入真实下载字段');
check(community.includes('— 暂无评分') && community.includes('下载量未提供'), '缺评分与下载量显示未提供而非假零');
check(community.includes('件数未提供') && community.includes('人数未提供'), '合集与圈子缺失计数不会伪装成零');
check(community.includes("hasMetric(post, 'likes')") && community.includes("hasMetric(post, 'commentCount')"), '动态互动缺失计数显示未提供');
check(!community.includes('(c.count || 0)') && !community.includes('(post.likes || 0)') && !community.includes('(post.commentCount || 0)'), '社区可见计数不再用假零兜底');
check(community.includes('题材底图 · 非投稿封面') && community.includes('投稿封面'), '生成底图与投稿封面有来源标识');
check(community.includes('function runtimeFallbackCover(p)') && /assets\/ui\/workshop\/cover-/.test(community), '正式卡片接入可降级题材底图');
check(ranks.includes("hasMetric(p, 'downloads')") && ranks.includes("hasMetric(p, 'ratingCount')") && ranks.includes("hasMetric(p, 'endorsements')"), '三类榜单只按存在的指标排序');
check(!ranks.includes('b.downloads || 0') && !ranks.includes('b.rating || 0') && !ranks.includes('b.endorsements || 0'), '榜单不把缺字段当零分');
check(!/明末风云|南宋中兴|盛唐气象/.test(topics), '专题页已移除硬编码假策展');
check(topics.includes('导航入口，不冒充策展专题') && topics.includes('renderCollectionSection()'), '专题页只保留真实合集与明示导航');
check(manager.includes('tm-pack-detail-sheet') && manager.includes('下载量未提供') && manager.includes('版本未提供'), '详情卷宗同样诚实处理缺字段');
check(manager.includes("detailCommentsStatus: 'idle'") && community.includes("revisionStatus === 'error'"), '评论与共编修订区分加载、真空与接口失败');
check(community.includes("arenaDetailStatus === 'error'") && community.includes("collectionDetailStatus === 'error'") && community.includes("circleFeedStatus === 'error'"), '社区详情层不会把请求失败冒充空数据');
check(community.includes("notifStatus === 'error'") && community.includes("dmLoadStatus === 'error'"), '通知与私信失败有明确不可用状态');
check(manager.includes("chronStatus === 'error'") && manager.includes('正式接口返回 0 篇'), '史册接龙区分接口失败与真实零记录');
check(community.includes('本地估算声望') && community.includes('数据未全') && !community.includes('题跋 · 他人评说'), '个人页标明推导指标并移除未接真源的题跋占位');

// 正式视觉、全屏占用与强制横屏同构。
check(css.includes('百工谱阁 · 正式游戏迁移'), '正式视觉覆盖层已落地');
check(css.includes('width:100vw;height:100vh') && css.includes('height:100dvh'), '正式工坊完整占满动态视口');
check(css.includes('grid-template-columns:var(--atelier-rail) minmax(0,1fr)'), '桌面采用左栏与主舞台布局');
check(css.includes('#tm-content-bg.tm-online-shell-bg>.tm-mall.tm-mall-page.atelier-shell{--atelier-rail:78px;}'), '电脑版中窗图标侧栏覆盖具备足够优先级');
check(css.includes('url("assets/ui/workshop/hero-jianyan.webp")'), '正式首页使用百工谱阁主视觉');
check(css.includes('.atelier-shell .truth-strip') && css.includes('.is-fallback') && css.includes('.is-error'), '真源条覆盖成功、回退与失败状态');
check(!css.includes('.atelier-mobile-dock') && !css.includes('@media(max-width:480px) and (orientation:portrait)'), '已删除安卓版底栏与竖屏专属版式');
check(css.includes('@media(max-height:620px) and (orientation:landscape)') && css.includes('padding-bottom:28px'), '低高度横屏只压缩电脑版纵向密度');
check(css.includes('overflow-x:hidden') && manager.includes('renderWorkshopSidebar(pane)'), '横屏端继续使用电脑版侧栏且不产生横向溢出');
check(css.includes('.tm-pack-detail-sheet') && css.includes('place-items:stretch end'), '桌面详情采用右侧卷宗');
check(css.includes('@media(prefers-reduced-motion:reduce)'), '尊重减少动态效果偏好');

check(index.includes('tm-online-client.js?v=20260811-auditfix1'), '在线客户端缓存戳已刷新');
check(index.includes('tm-online-mall.css?v=20260722-baigong-landscape'), '百工谱阁横屏同构样式缓存戳已刷新');
const managerScript = 'tm-content-manager.js?v=20260811-auditfix1';
const communityScript = 'tm-content-manager-community.js?v=20260811-auditfix1';
check(index.includes(managerScript) && index.includes(communityScript)
  && index.indexOf(managerScript) < index.indexOf(communityScript), '拆分脚本成对刷新且保持相邻');

console.log('smoke-workshop-runtime-truth-ui ' + (failed ? 'FAIL' : 'PASS') + ' ' + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
//  tm-patches.js — 跨领域补丁合集（2,186 行·"大杂烩"）
// Requires: tm-data-model.js, tm-utils.js, tm-mechanics.js,
//           tm-change-queue.js, tm-index-world.js, tm-npc-engine.js,
//           tm-game-engine.js, tm-endturn.js, tm-dynamic-systems.js (all prior modules)
// ============================================================
//
// ══════════════════════════════════════════════════════════════
//  📍 段落总导航（2026-04-24 R58）
// ══════════════════════════════════════════════════════════════
//
//  原始 2,186 行跨 6 大功能领域，已按 MODULE_REGISTRY §1.8 切分清单
//  本文件当前状态：**双保险策略**·原代码保留·新文件在 index.html
//  加载顺序之后覆盖同名函数（若新文件稳定后可删此段）。
//
//  ┌─ ⏳ §1 Settings UI（L1-512，~560 行·高风险·未迁） ──┐
//  │  openSettings 完整重写(含 API 配置 400+ innerHTML)
//  │  sSaveAPI / sTestConn / sDetectModels / sSaveSecondaryAPI /
//  │  sClearSecondaryAPI / sToggleSecondaryEnabled /
//  │  _sVerbUpdatePreview / _sMaxoutToggle / _sUpdateMaxoutInfo /
//  │  _sShowCtxInfo / _sTestImgConn / _sDetectImgCap / _sSaveImgAPI
//  │  → R22 已新建 tm-settings-ui.js 作**迁移靶文件**(含详细步骤)
//  └─────────────────────────────────────────────────────────┘
//
//  ┌─ 🔶 §2 剧本管理 tab（L514-532，~20 行） ───────────┐
//  │  renderScnTab(em, sc) - 系统开关 + 剧本信息编辑
//  │  （未分类·可单独拆为 tm-scenario-tab.js）
//  └─────────────────────────────────────────────────────────┘
//
//  ┌─ ⏳ §3 开局逻辑审查（L535-1040，~290 行·高风险） ──┐
//  │  _logicAuditOnStart(sc) - AI 生成缺失字段
//  │  doActualStart + 开场白动画
//  │  startGame 覆盖
//  │  → 未迁。风险：涉及 startGame，需要完整回归测试
//  └─────────────────────────────────────────────────────────┘
//
//  ┌─ ⏳ §4 散碎补丁（L1040-1680，~640 行） ────────────┐
//  │  杂项 UI 修正 / 事件钩子 / NPC 互动补丁
//  │  → 未分类·需进一步切分
//  └─────────────────────────────────────────────────────────┘
//
//  ┌─ ✓ §5 Editor Details（L1682-1860，~180 行） ───────┐
//  │  editChr + saveChrEdit + renderItmTab/RulTab/EvtTab/
//  │  FacTab/ClassTab/WldTab/TechTab + editClass2 + editTech2
//  │  + aiGenItems/Rules/Events/Classes/World/Tech
//  │  → 已迁至 tm-editor-details.js (R21 ✓)
//  └─────────────────────────────────────────────────────────┘
//
//  ┌─ ✓ §6 Modal System（L1861-1892，~30 行） ──────────┐
//  │  gv + openGenericModal + closeGenericModal +
//  │  showModal + closeModal
//  │  → 已迁至 tm-modal-system.js (R17 ✓)
//  └─────────────────────────────────────────────────────────┘
//
//  ┌─ ✓ §7 World View（L1894-2090，~200 行） ───────────┐
//  │  openWorldSituation / closeWorldSituation +
//  │  openHistoricalEvents / openEraTrends（兼容别名）+
//  │  drawEraTrendsChart（canvas 7 维趋势折线）
//  │  → 已迁至 tm-world-view.js (R20 ✓)
//  └─────────────────────────────────────────────────────────┘
//
//  ┌─ ✓ §8 Military UI（L2092-2174，~85 行） ───────────┐
//  │  migrateMilUnits + addArmy + editArmy + renderMilTab +
//  │  aiGenMil
//  │  → 已迁至 tm-military-ui.js (R18 ✓)
//  └─────────────────────────────────────────────────────────┘
//
//  ┌─ 🔶 §9 官制 tab（L2175-2186，~11 行） ──────────────┐
//  │  renderOfficeTab 覆盖版
//  │  （混在 Military 之后·未来迁到 tm-office-editor.js）
//  └─────────────────────────────────────────────────────────┘
//
// ══════════════════════════════════════════════════════════════
//  📊 迁移进度
// ══════════════════════════════════════════════════════════════
//
//  已迁段：§5, §6, §7, §8         = ~495 行（23%）
//  未迁段：§1, §2, §3, §4, §9     = ~1,691 行（77%）
//  物理文件：仍 2,186 行（双保险不删）
//
//  详细路线图：PATCH_CLASSIFICATION.md · tm-patches.js 段
//  工时估算：剩余未迁约 40-70h（Settings UI 最重）
//
// ══════════════════════════════════════════════════════════════

// 覆盖openSettings为完整版
openSettings=function(){
  var bg=_$("settings-bg");
  bg.innerHTML="<div class=\"settings-box\"><div style=\"padding:0.8rem 1.2rem;border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between;\"><div style=\"font-size:1.1rem;font-weight:700;color:var(--gold);\">"+((typeof tmIcon==='function')?tmIcon('settings',18):'')+"\u8BBE\u7F6E</div><button class=\"bt bs bsm\" onclick=\"closeSettings()\">\u2715</button></div><div class=\"settings-body\" id=\"sb2\"></div></div>";

  var b=_$("sb2");
  b.innerHTML=
    // API
    "<div class=\"settings-section\"><h4>API\u8FDE\u63A5</h4>"+
    "<div class=\"rw\"><div class=\"fd\"><label>\u670D\u52A1\u5546</label><select id=\"s-prov\"><option value=\"openai\">OpenAI</option><option value=\"deepseek\">DeepSeek</option><option value=\"anthropic\">Claude</option><option value=\"custom\">\u81EA\u5B9A\u4E49</option></select></div><div class=\"fd\"><label>Key</label><input type=\"password\" id=\"s-key\" value=\""+(P.ai.key||"")+"\"></div></div>"+
    "<div class=\"rw\"><div class=\"fd\"><label>\u5730\u5740</label><input id=\"s-url\" value=\""+(P.ai.url||"")+"\" placeholder=\"https://api.openai.com/v1 \u6216\u4E2D\u8F6C\u7AD9URL\"></div><div class=\"fd\"><label>\u6A21\u578B</label><input id=\"s-model\" value=\""+(P.ai.model||"")+"\"></div></div>"+
    "<div style=\"font-size:0.75rem;color:var(--txt-d);margin:-0.3rem 0 0.4rem;\">\u652F\u6301 OpenAI \u517C\u5BB9\u4E2D\u8F6C\u7AD9\uFF0C\u586B base URL \u5373\u53EF\u3002</div>"+
    "<div class=\"rw\"><div class=\"fd q\"><label>Temp</label><input type=\"number\" id=\"s-temp\" value=\""+(P.ai.temp||0.8)+"\" step=\"0.1\"></div><div class=\"fd q\"><label>\u8BB0\u5FC6</label><input type=\"number\" id=\"s-mem\" value=\""+(P.ai.mem||20)+"\"></div><div class=\"fd q\"><label>\u4E0A\u4E0B\u6587(K)</label><input type=\"number\" id=\"s-ctx\" value=\""+(P.conf.contextSizeK||0)+"\" placeholder=\"0=\u81EA\u52A8\" min=\"0\" title=\"\u6A21\u578B\u4E0A\u4E0B\u6587\u7A97\u53E3\u5927\u5C0F(K tokens)\u3002\u7559\u7A7A\u62160=\u81EA\u52A8\u68C0\u6D4B\"></div></div>"+
    "<div style=\"font-size:0.7rem;color:var(--txt-d);margin:-0.2rem 0 0.3rem;\">\u4E0A\u4E0B\u6587\u7A97\u53E3\u5F71\u54CD\u8BB0\u5FC6\u538B\u7F29\u7B56\u7565\uFF1A128K+\u5BBD\u677E\u4FDD\u7559\u3001<32K\u6FC0\u8FDB\u538B\u7F29\u3001\u7559\u7A7A\u81EA\u52A8\u8BC6\u522B\u6A21\u578B</div>"+
    "<div style=\"display:flex;gap:0.3rem;margin-top:0.4rem;\"><button class=\"bai\" onclick=\"sDetectModels()\">\u68C0\u6D4B\u6A21\u578B</button><button class=\"bt bs bsm\" onclick=\"sTestConn()\">\u6D4B\u8BD5\u8FDE\u63A5</button><button class=\"bt bs bsm\" onclick=\"sReDetectCtx()\">\u91CD\u65B0\u63A2\u6D4B\u7A97\u53E3</button><button class=\"bt bp bsm\" onclick=\"sSaveAPI()\">\u4FDD\u5B58</button></div>"+
    "<div id=\"s-status\" style=\"font-size:0.78rem;color:var(--txt-d);margin-top:0.3rem;\"></div>"+
    "<div id=\"s-ctx-info\" style=\"font-size:0.72rem;color:var(--txt-d);margin-top:0.2rem;\"></div>"+
    "<div id=\"s-models\" class=\"model-list\" style=\"display:none;margin-top:0.4rem;\"></div>"+
    "<div style=\"margin-top:0.6rem;padding-top:0.5rem;border-top:1px solid var(--bdr);\"><div style=\"font-size:0.75rem;color:var(--gold-d);margin-bottom:0.3rem;\">\u667A\u80FD\u751F\u56FE API\uFF08\u72EC\u7ACB\u914D\u7F6E\uFF0C\u7528\u4E8E\u7ACB\u7ED8\u7B49\u56FE\u7247\u751F\u6210\uFF09</div>"+
    "<div class=\"rw\"><div class=\"fd\"><label style=\"font-size:0.72rem;\">Key</label><input type=\"password\" id=\"s-img-key\" value=\""+(function(){try{return JSON.parse(localStorage.getItem('tm_api_image')||'{}').key||'';}catch(e){return '';}})()+"\" placeholder=\"\u7559\u7A7A\u5219\u590D\u7528\u4E3BAPI\" style=\"font-size:0.8rem;\"></div></div>"+
    "<div class=\"rw\"><div class=\"fd\"><label style=\"font-size:0.72rem;\">URL</label><input id=\"s-img-url\" value=\""+(function(){try{return JSON.parse(localStorage.getItem('tm_api_image')||'{}').url||'';}catch(e){return '';}})()+"\" placeholder=\"https://api.openai.com/v1/images/generations\" style=\"font-size:0.8rem;\"></div><div class=\"fd\"><label style=\"font-size:0.72rem;\">\u6A21\u578B</label><input id=\"s-img-model\" value=\""+(function(){try{return JSON.parse(localStorage.getItem('tm_api_image')||'{}').model||'dall-e-3';}catch(e){return 'dall-e-3';}})()+"\" style=\"font-size:0.8rem;width:80px;\"></div></div>"+
    "<div style=\"display:flex;gap:0.3rem;margin-top:0.3rem;\"><button class=\"bt bs bsm\" onclick=\"_sTestImgConn()\">\u6D4B\u8BD5\u8FDE\u63A5</button><button class=\"bt bs bsm\" onclick=\"_sDetectImgCap()\">\u68C0\u6D4B\u751F\u56FE\u529F\u80FD</button><button class=\"bt bp bsm\" onclick=\"_sSaveImgAPI()\">\u4FDD\u5B58</button></div>"+
    "<div id=\"s-img-status\" style=\"font-size:0.72rem;color:var(--txt-d);margin-top:0.3rem;\"></div></div></div>"+

    // 次要 API（M3·快模型路由）——与主 API UI 一致·仅数据对象区别
    (function(){
      var sec = (P.ai && P.ai.secondary) || {};
      var hasKey = !!(sec.key && sec.url);
      var enabled = !(P.conf && P.conf.secondaryEnabled === false);
      var active = hasKey && enabled;
      var badge;
      if (active) badge = ' <span style="display:inline-block;padding:0.1rem 0.5rem;border-radius:10px;background:rgba(107,176,124,0.18);color:var(--celadon-400,#6bb07c);font-size:0.64rem;font-weight:700;">\u25CF \u5DF2\u6FC0\u6D3B</span>';
      else if (hasKey) badge = ' <span style="display:inline-block;padding:0.1rem 0.5rem;border-radius:10px;background:rgba(184,154,83,0.18);color:var(--gold);font-size:0.64rem;font-weight:700;">\u25CB \u5DF2\u914D\u00B7\u672A\u542F\u7528</span>';
      else badge = ' <span style="display:inline-block;padding:0.1rem 0.5rem;border-radius:10px;background:rgba(120,120,120,0.2);color:var(--txt-d);font-size:0.64rem;">\u25CB \u672A\u914D\u7F6E</span>';
      return "<div class=\"settings-section\" style=\"border-left:3px solid #8a5cf5;\"><h4 style=\"color:#a585ff;\">\u6B21\u8981 API\u00B7\u5FEB\u6A21\u578B\u8DEF\u7531" + badge + "</h4>"+
        "<div style=\"font-size:0.72rem;color:var(--txt-d);margin:-0.3rem 0 0.5rem;line-height:1.55;\">\u7528\u4E8E\u95EE\u5BF9\u00B7\u4E09\u79CD\u671D\u8BAE\u00B7\u6587\u4E8B\u52BF\u529B\u5B50\u8C03\u7528\u7B49\u6B21\u8981\u573A\u666F\u3002\u4E3B\u63A8\u6F14\u59CB\u7EC8\u8D70\u4E3B API\u3002</div>"+
        "<div class=\"rw\"><div class=\"fd\"><label>\u670D\u52A1\u5546</label><select id=\"s-sec-prov\"><option value=\"openai\">OpenAI</option><option value=\"deepseek\">DeepSeek</option><option value=\"anthropic\">Claude</option><option value=\"custom\">\u81EA\u5B9A\u4E49</option></select></div><div class=\"fd\"><label>Key</label><input type=\"password\" id=\"s-sec-key\" value=\""+(sec.key||"")+"\" placeholder=\"\u7559\u7A7A\u5219\u56DE\u9000\u4E3B API\"></div></div>"+
        "<div class=\"rw\"><div class=\"fd\"><label>\u5730\u5740</label><input id=\"s-sec-url\" value=\""+(sec.url||"")+"\" placeholder=\"https://api.openai.com/v1\"></div><div class=\"fd\"><label>\u6A21\u578B</label><input id=\"s-sec-model\" value=\""+(sec.model||"")+"\" placeholder=\"gpt-4o-mini / haiku\"></div></div>"+
        "<div style=\"font-size:0.7rem;color:var(--txt-d);margin:-0.2rem 0 0.3rem;\">\u63A8\u8350\uFF1Agpt-4o-mini \u00B7 claude-haiku-4-5 \u00B7 deepseek-chat \u00B7 gemini-2.5-flash</div>"+
        "<div style=\"display:flex;gap:0.3rem;margin-top:0.4rem;flex-wrap:wrap;\"><button class=\"bai\" onclick=\"sDetectSecondaryModels()\">\u68C0\u6D4B\u6A21\u578B</button><button class=\"bt bs bsm\" onclick=\"sTestSecondaryConn()\">\u6D4B\u8BD5\u8FDE\u63A5</button><button class=\"bt bp bsm\" onclick=\"sSaveSecondaryAPI()\">\u4FDD\u5B58</button>"+
        (hasKey ? "<button class=\"bt bd bsm\" onclick=\"sClearSecondaryAPI()\">\u6E05\u9664</button>" : "") +
        "<label style=\"display:inline-flex;align-items:center;gap:0.3rem;font-size:0.78rem;color:var(--txt-d);margin-left:auto;"+(hasKey?"":"opacity:0.5;cursor:not-allowed;")+"\"><input type=\"checkbox\" id=\"s-sec-enabled\" "+(enabled?"checked ":"")+(hasKey?"":"disabled ")+"onchange=\"sToggleSecondaryEnabled(this.checked)\"> \u542F\u7528\u6B21 API</label>"+
        "</div>"+
        "<div id=\"s-sec-status\" style=\"font-size:0.78rem;color:var(--txt-d);margin-top:0.3rem;\"></div>"+
        "<div id=\"s-sec-models\" class=\"model-list\" style=\"display:none;margin-top:0.4rem;\"></div>"+
        (hasKey ? "<div style=\"margin-top:0.5rem;padding:0.4rem 0.5rem;background:rgba(138,92,245,0.06);border-left:2px solid #8a5cf5;border-radius:2px;font-size:0.7rem;color:var(--txt-d);line-height:1.55;\"><div><b style=\"color:#a585ff;\">\u6FC0\u6D3B\u65F6\u8DEF\u7531\uFF1A</b>\u95EE\u5BF9 \u00B7 \u5EF7\u8BAE \u00B7 \u5FA1\u524D \u00B7 \u5E38\u671D \u00B7 \u6587\u4E8B\u52BF\u529B\uFF08\u4E94\u7C7B\u9AD8\u9891\u5B50\u8C03\u7528\uFF09</div><div style=\"margin-top:0.2rem;\"><b>\u4E3B API \u59CB\u7EC8\u8D1F\u8D23\uFF1A</b>\u56DE\u5408\u63A8\u6F14(SC1/SC1b/SC1c) \u00B7 \u8BE2\u5929 \u00B7 \u8BE1\u5199\u6DF1\u5EA6\u6587\u672C</div></div>" : "") +
        "</div>";
    })()+

    // 回合读取
    "<div class=\"settings-section\"><h4>\u56DE\u5408\u8BFB\u53D6</h4>"+
    "<div class=\"rw\"><div class=\"fd\"><label>\u8D77\u5C45\u6CE8\u8BFB\u53D6</label><input type=\"number\" id=\"s-qlb\" value=\""+(P.conf.qijuLookback||5)+"\"></div><div class=\"fd\"><label>\u53F2\u8BB0\u8BFB\u53D6</label><input type=\"number\" id=\"s-slb\" value=\""+(P.conf.shijiLookback||5)+"\"></div><div class=\"fd\"><label>\u6BCF N \u56DE\u5408\u5B58\u6863</label><input type=\"number\" id=\"s-as-turns\" value=\""+(P.conf.autoSaveTurns||5)+"\" min=\"0\" style=\"width:60px\"></div></div>"+
    "<div class=\"fd full\"><label>\u603B\u7ED3\u89C4\u5219(\u7559\u7A7A=AI\u81EA\u52A8)</label><textarea id=\"s-sumrule\" rows=\"2\">"+(P.conf.summaryRule||"")+"</textarea></div></div>"+

    // AI 记忆容量
    "<div class=\"settings-section\"><h4>AI\u8BB0\u5FC6\u5BB9\u91CF</h4>"+
    "<div style=\"font-size:0.75rem;color:var(--txt-d);margin-bottom:0.4rem;\">\u8D85\u8FC7\u8BBE\u5B9A\u56DE\u5408\u6570\u7684\u8BB0\u5FC6\u5C06\u81EA\u52A8\u538B\u7F29\u4E3A\u5E74\u4EE3\u6458\u8981</div>"+
    "<div class=\"rw\"><div class=\"fd q\"><label>\u8BB0\u5FC6\u951A\u70B9</label><input type=\"number\" id=\"s-mem-anchor\" value=\""+(P.conf.memoryAnchorKeep||40)+"\" min=\"10\" max=\"200\"></div>"+
    "<div class=\"fd q\"><label>\u5E74\u4EE3\u5F52\u6863</label><input type=\"number\" id=\"s-mem-archive\" value=\""+(P.conf.memoryArchiveKeep||20)+"\" min=\"5\" max=\"100\"></div>"+
    "<div class=\"fd q\"><label>\u89D2\u8272\u5F27\u7EBF</label><input type=\"number\" id=\"s-mem-arc\" value=\""+(P.conf.characterArcKeep||10)+"\" min=\"3\" max=\"50\"></div></div>"+
    "<div class=\"rw\"><div class=\"fd q\"><label>\u51B3\u7B56\u8BB0\u5F55</label><input type=\"number\" id=\"s-mem-dec\" value=\""+(P.conf.playerDecisionKeep||30)+"\" min=\"5\" max=\"100\"></div>"+
    "<div class=\"fd q\"><label>\u53D9\u4E8B\u8BB0\u5FC6</label><input type=\"number\" id=\"s-mem-chr\" value=\""+(P.conf.chronicleKeep||10)+"\" min=\"3\" max=\"50\"></div>"+
    "<div class=\"fd q\"><label>\u5BF9\u8BDD\u5386\u53F2</label><input type=\"number\" id=\"s-mem-conv\" value=\""+(P.conf.convKeep||40)+"\" min=\"10\" max=\"200\"></div></div></div>"+

    // AI生成字数
    "<div class=\"settings-section\"><h4>AI\u751F\u6210\u5B57\u6570</h4>"+
    "<div style=\"font-size:0.75rem;color:var(--txt-d);margin-bottom:0.5rem;\">\u63A7\u5236\u5404\u7C7B\u5185\u5BB9\u7684\u751F\u6210\u5B57\u6570\uFF0C\u4F1A\u4E0E\u6A21\u578B\u4E0A\u4E0B\u6587\u7A97\u53E3\u8054\u52A8\u7F29\u653E</div>"+
    "<div style=\"display:flex;gap:0.5rem;margin-bottom:0.6rem;flex-wrap:wrap;\">"+
    "<label class=\"wd-preset-label\"><input type=\"radio\" name=\"s-verbosity\" value=\"concise\" "+(P.conf.verbosity==='concise'?'checked':'')+"> \u7CBE\u7B80<span style=\"font-size:0.65rem;color:var(--txt-d);display:block;\">\u00D70.6 \u7701token</span></label>"+
    "<label class=\"wd-preset-label\"><input type=\"radio\" name=\"s-verbosity\" value=\"standard\" "+((P.conf.verbosity||'standard')==='standard'?'checked':'')+"> \u6807\u51C6<span style=\"font-size:0.65rem;color:var(--txt-d);display:block;\">\u00D71.0 \u63A8\u8350</span></label>"+
    "<label class=\"wd-preset-label\"><input type=\"radio\" name=\"s-verbosity\" value=\"detailed\" "+(P.conf.verbosity==='detailed'?'checked':'')+"> \u8BE6\u5C3D<span style=\"font-size:0.65rem;color:var(--txt-d);display:block;\">\u00D71.5 \u6C89\u6D78</span></label>"+
    "<label class=\"wd-preset-label\"><input type=\"radio\" name=\"s-verbosity\" value=\"custom\" "+(P.conf.verbosity==='custom'?'checked':'')+"> \u81EA\u5B9A\u4E49<span style=\"font-size:0.65rem;color:var(--txt-d);display:block;\">\u624B\u52A8\u8C03</span></label>"+
    "</div>"+
    "<div id=\"s-verb-preview\" style=\"background:var(--bg-3);border-radius:6px;padding:0.5rem 0.7rem;font-size:0.78rem;\"></div>"+
    // AI输出上限控件——默认使用检测值，玩家可手动调低
    "<div style=\"margin-top:0.8rem;padding:0.5rem 0.7rem;background:var(--bg-3);border-radius:6px;\">"+
    "<div style=\"display:flex;align-items:center;justify-content:space-between;gap:0.5rem;\">"+
    "<label style=\"font-size:0.8rem;color:var(--gold);\">AI\u8F93\u51FA\u4E0A\u9650(max_tokens)</label>"+
    "<div id=\"s-maxout-info\" style=\"font-size:0.7rem;color:var(--txt-d);\"></div>"+
    "</div>"+
    "<div style=\"display:flex;gap:10px;align-items:center;margin-top:0.4rem;font-size:0.76rem;\">"+
    "<label><input type=\"radio\" name=\"s-maxout-mode\" value=\"auto\" "+(!P.conf.maxOutputTokens?'checked':'')+" onchange=\"_sMaxoutToggle()\"> \u81EA\u52A8(\u6A21\u578B\u6700\u5927)</label>"+
    "<label><input type=\"radio\" name=\"s-maxout-mode\" value=\"manual\" "+(P.conf.maxOutputTokens?'checked':'')+" onchange=\"_sMaxoutToggle()\"> \u624B\u52A8</label>"+
    "<input type=\"number\" id=\"s-maxout-val\" value=\""+(P.conf.maxOutputTokens||'')+"\" placeholder=\"tokens\" style=\"width:90px;\" "+(!P.conf.maxOutputTokens?'disabled':'')+">"+
    "</div>"+
    "<div style=\"font-size:0.68rem;color:var(--txt-d);margin-top:0.3rem;line-height:1.4;\">\u81EA\u52A8=\u4F7F\u7528\u68C0\u6D4B\u5230\u7684\u6A21\u578B\u6700\u5927\u8F93\u51FA\u80FD\u529B\u3002\u624B\u52A8\u53EF\u8C03\u4F4E\u8282\u7701\u6210\u672C\u6216\u907F\u514D\u8D85\u65F6\u3002\u82E5AI\u8F93\u51FA\u88AB\u622A\u65AD\uFF0C\u53EF\u5728\u6B64\u8C03\u5927\u3002</div>"+
    "</div>"+
    "<div id=\"s-verb-custom\" style=\"display:none;margin-top:0.5rem;\">"+
    "<div style=\"font-size:0.72rem;color:var(--gold);margin-bottom:0.3rem;\">\u5206\u7C7B\u5FAE\u8C03\uFF08\u4EC5\u201C\u81EA\u5B9A\u4E49\u201D\u6A21\u5F0F\u751F\u6548\uFF09</div>"+
    "<div class=\"rw\"><div class=\"fd q\"><label>\u5B9E\u5F55</label><div style=\"display:flex;gap:2px;\"><input type=\"number\" id=\"s-shilu1\" value=\""+(P.conf.shiluMin||200)+"\" style=\"width:50px;\">~<input type=\"number\" id=\"s-shilu2\" value=\""+(P.conf.shiluMax||400)+"\" style=\"width:50px;\"></div></div>"+
    "<div class=\"fd q\"><label>\u65F6\u653F\u8BB0</label><div style=\"display:flex;gap:2px;\"><input type=\"number\" id=\"s-szj1\" value=\""+(P.conf.szjMin||600)+"\" style=\"width:50px;\">~<input type=\"number\" id=\"s-szj2\" value=\""+(P.conf.szjMax||1200)+"\" style=\"width:50px;\"></div></div></div>"+
    "<div class=\"rw\"><div class=\"fd q\"><label>\u540E\u4EBA\u620F\u8BF4</label><div style=\"display:flex;gap:2px;\"><input type=\"number\" id=\"s-houren1\" value=\""+(P.conf.hourenMin||2500)+"\" style=\"width:60px;\">~<input type=\"number\" id=\"s-houren2\" value=\""+(P.conf.hourenMax||6000)+"\" style=\"width:60px;\"></div></div>"+
    "<div class=\"fd q\"><label>\u594F\u758F(\u8C0F\u7AE0)</label><div style=\"display:flex;gap:2px;\"><input type=\"number\" id=\"s-ml1\" value=\""+(P.conf.memLoyalMin||400)+"\" style=\"width:50px;\">~<input type=\"number\" id=\"s-ml2\" value=\""+(P.conf.memLoyalMax||600)+"\" style=\"width:50px;\"></div></div></div>"+
    "<div class=\"fd q\"><label>\u594F\u758F(\u666E\u901A)</label><div style=\"display:flex;gap:2px;\"><input type=\"number\" id=\"s-mn1\" value=\""+(P.conf.memNormalMin||200)+"\" style=\"width:50px;\">~<input type=\"number\" id=\"s-mn2\" value=\""+(P.conf.memNormalMax||350)+"\" style=\"width:50px;\"></div></div></div>"+
    "<div class=\"rw\"><div class=\"fd q\"><label>\u594F\u758F(\u5BC6\u6298)</label><div style=\"display:flex;gap:2px;\"><input type=\"number\" id=\"s-ms1\" value=\""+(P.conf.memSecretMin||150)+"\" style=\"width:50px;\">~<input type=\"number\" id=\"s-ms2\" value=\""+(P.conf.memSecretMax||250)+"\" style=\"width:50px;\"></div></div>"+
    "<div class=\"fd q\"><label>\u95EE\u5BF9\u56DE\u590D</label><div style=\"display:flex;gap:2px;\"><input type=\"number\" id=\"s-wd1\" value=\""+(P.conf.wdMin||120)+"\" style=\"width:50px;\">~<input type=\"number\" id=\"s-wd2\" value=\""+(P.conf.wdMax||250)+"\" style=\"width:50px;\"></div></div></div>"+
    "<div class=\"rw\"><div class=\"fd q\"><label>\u671D\u8BAE\u53D1\u8A00</label><div style=\"display:flex;gap:2px;\"><input type=\"number\" id=\"s-cy1\" value=\""+(P.conf.cyMin||120)+"\" style=\"width:50px;\">~<input type=\"number\" id=\"s-cy2\" value=\""+(P.conf.cyMax||250)+"\" style=\"width:50px;\"></div></div>"+
    "<div class=\"fd q\"><label>\u7F16\u5E74\u53F2\u8BB0</label><div style=\"display:flex;gap:2px;\"><input type=\"number\" id=\"s-chr1\" value=\""+(P.conf.chronicleMin||800)+"\" style=\"width:50px;\">~<input type=\"number\" id=\"s-chr2\" value=\""+(P.conf.chronicleMax||1500)+"\" style=\"width:50px;\"></div></div></div>"+
    "<div class=\"rw\"><div class=\"fd q\"><label>\u592A\u53F2\u516C\u66F0</label><div style=\"display:flex;gap:2px;\"><input type=\"number\" id=\"s-cmt1\" value=\""+(P.conf.commentMin||80)+"\" style=\"width:50px;\">~<input type=\"number\" id=\"s-cmt2\" value=\""+(P.conf.commentMax||200)+"\" style=\"width:50px;\"></div></div></div>"+
    "</div></div>"+

    // 文风
    "<div class=\"settings-section\"><h4>\u6587\u98CE</h4>"+
    "<div class=\"rw\"><div class=\"fd\"><label>\u5168\u5C40</label><select id=\"s-style\"><option value=\"\u6587\u5B66\u5316\" "+((P.conf.style||"")=="\u6587\u5B66\u5316"?"selected":"")+">\u6587\u5B66\u5316</option><option value=\"\u53F2\u4E66\u4F53\" "+((P.conf.style||"")=="\u53F2\u4E66\u4F53"?"selected":"")+">\u53F2\u4E66\u4F53</option><option value=\"\u622F\u5267\u5316\" "+((P.conf.style||"")=="\u622F\u5267\u5316"?"selected":"")+">\u622F\u5267\u5316</option><option value=\"\u7AE0\u56DE\u4F53\" "+((P.conf.style||"")=="\u7AE0\u56DE\u4F53"?"selected":"")+">\u7AE0\u56DE\u4F53</option><option value=\"\u7EAA\u4F20\u4F53\" "+((P.conf.style||"")=="\u7EAA\u4F20\u4F53"?"selected":"")+">\u7EAA\u4F20\u4F53</option><option value=\"\u767D\u8BDD\u6587\" "+((P.conf.style||"")=="\u767D\u8BDD\u6587"?"selected":"")+">\u767D\u8BDD\u6587</option></select></div><div class=\"fd\"><label>\u96BE\u5EA6</label><select id=\"s-diff\"><option "+((P.conf.difficulty||"")=="\u7B80\u5355"?"selected":"")+">\u7B80\u5355</option><option "+((P.conf.difficulty||"")=="\u666E\u901A"?"selected":"")+">\u666E\u901A</option><option "+((P.conf.difficulty||"")=="\u56F0\u96BE"?"selected":"")+">\u56F0\u96BE</option></select></div></div>"+
    "<div class=\"fd full\"><label>\u81EA\u5B9A\u4E49\u6587\u98CE</label><textarea id=\"s-cstyle\" rows=\"2\">"+(P.conf.customStyle||"")+"</textarea></div></div>"+

    // 模式+AI深度
    "<div class=\"settings-section\"><h4>\u6E38\u620F\u6A21\u5F0F</h4>"+
    "<div class=\"rw\"><div class=\"fd\"><label>\u6A21\u5F0F</label><select id=\"s-mode\"><option value=\"yanyi\" "+(P.conf.gameMode==="yanyi"?"selected":"")+">\u6F14\u4E49</option><option value=\"light_hist\" "+(P.conf.gameMode==="light_hist"?"selected":"")+">\u8F7B\u5EA6\u53F2\u5B9E</option><option value=\"strict_hist\" "+(P.conf.gameMode==="strict_hist"?"selected":"")+">\u4E25\u683C\u53F2\u5B9E</option></select></div>"+
    "<div class=\"fd\"><label>AI\u63A8\u6F14\u6DF1\u5EA6</label><select id=\"s-aidepth\"><option value=\"full\" "+((P.conf.aiCallDepth||'full')==='full'?'selected':'')+">\u5B8C\u6574(11\u8C03\u7528)</option><option value=\"standard\" "+((P.conf.aiCallDepth||'full')==='standard'?'selected':'')+">\u6807\u51C6(6\u8C03\u7528)</option><option value=\"lite\" "+((P.conf.aiCallDepth||'full')==='lite'?'selected':'')+">\u7CBE\u7B80(3\u8C03\u7528)</option></select></div></div></div>"+

    // 人物志
    "<div class=\"settings-section\"><h4>\u4EBA\u7269\u5FD7</h4>"+
    "<div class=\"toggle-wrap\"><label class=\"toggle\"><input type=\"checkbox\" id=\"s-showrel\" "+(P.conf.showRelation!==false?"checked":"")+" onchange=\"P.conf.showRelation=this.checked\"><span class=\"toggle-slider\"></span></label><div>\u663E\u793A\u5173\u7CFB</div></div></div>"+

    // 提示词
    "<div class=\"settings-section\"><h4>AI\u63D0\u793A\u8BCD</h4>"+
    "<div style=\"display:flex;gap:0.3rem;margin-bottom:0.3rem;\"><button class=\"bt bs bsm\" onclick=\"_$('s-prompt').value=DEFAULT_PROMPT;\">\u6062\u590D\u9ED8\u8BA4</button></div>"+
    "<textarea id=\"s-prompt\" rows=\"10\" style=\"font-family:monospace;font-size:0.8rem;width:100%;\">"+(P.ai.prompt||DEFAULT_PROMPT)+"</textarea>"+
    "<div class=\"fd full\" style=\"margin-top:0.5rem;\"><label>\u89C4\u5219</label><textarea id=\"s-rules\" rows=\"4\">"+(P.ai.rules||DEFAULT_RULES)+"</textarea></div></div>"+

    "<button class=\"bt bp\" onclick=\"sSaveAll()\" style=\"width:100%;padding:0.7rem;font-size:1rem;\">\u4FDD\u5B58\u6240\u6709\u8BBE\u7F6E</button>";

  setTimeout(function(){
    var p=_$("s-prov");if(p&&P.ai.provider)p.value=P.ai.provider;
    // 次 API 服务商下拉·按已保存值回显
    var sp=_$("s-sec-prov"); var _secCfg=(P.ai&&P.ai.secondary)||{};
    if(sp&&_secCfg.provider)sp.value=_secCfg.provider;
    // 字数档位交互初始化
    _sVerbUpdatePreview();
    document.querySelectorAll('input[name="s-verbosity"]').forEach(function(r){
      r.addEventListener('change', _sVerbUpdatePreview);
    });
    // 显示当前上下文检测信息
    _sShowCtxInfo();
  },100);
  bg.classList.add("show");
};

/** 显示当前上下文窗口检测信息 */
function _sShowCtxInfo() {
  var el = _$('s-ctx-info'); if (!el) return;
  var model = P.ai.model || '(未设置)';
  var k = getModelContextSizeK();
  var layer = P.conf._ctxDetectLayer || '未探测';
  var manual = (P.conf.contextSizeK && P.conf.contextSizeK > 0);
  var wl = _matchModelCtx(P.ai.model || '');
  var html = '<span style="color:var(--gold);">当前上下文窗口: <b>' + k + 'K</b></span>';
  html += ' · 模型: ' + model;
  html += ' · 来源: ' + (manual ? '手动设置' : layer);
  if (wl > 0 && !manual) html += ' · 白名单参考: ' + wl + 'K';
  // 最近探测日志
  if (typeof _ctxDetectLog !== 'undefined' && _ctxDetectLog.length > 0) {
    html += '<details style="margin-top:4px;"><summary style="cursor:pointer;color:var(--txt-d);">探测日志 (' + _ctxDetectLog.length + '条)</summary>';
    html += '<div style="max-height:120px;overflow-y:auto;font-size:0.68rem;padding:4px;background:var(--bg-3);border-radius:4px;margin-top:2px;">';
    _ctxDetectLog.forEach(function(e) { html += '<div>' + e.time + ' ' + e.msg + '</div>'; });
    html += '</div></details>';
  }
  el.innerHTML = html;
}

/** 重新探测上下文窗口 */
async function sReDetectCtx() {
  var st = _$('s-status');
  var key = _$('s-key') ? _$('s-key').value : P.ai.key;
  var url = _$('s-url') ? _$('s-url').value : P.ai.url;
  var model = _$('s-model') ? _$('s-model').value : P.ai.model;
  if (!key || !url || !model) { toast('请先填写API信息'); return; }

  // 临时应用设置
  var _orig = { key: P.ai.key, url: P.ai.url, model: P.ai.model };
  P.ai.key = key; P.ai.url = url; P.ai.model = model;

  if (st) st.innerHTML = '<span style="color:var(--gold);">正在探测上下文窗口...</span>';
  // 清缓存强制重新探测
  delete P.conf._detectedContextK; delete P.conf._ctxCacheKey; delete P.conf._ctxDetectLayer;

  try {
    var detK = await detectModelContextSize({
      force: true,
      onProgress: function(msg) { if (st) st.innerHTML = '<span style="color:var(--gold);">' + msg + '</span>'; }
    });
    if (st) st.innerHTML = '<span style="color:var(--green);">\u2705 探测完成: <b>' + detK + 'K</b> tokens (' + (P.conf._ctxDetectLayer || '') + ')</span>';
  } catch(e) {
    if (st) st.innerHTML = '<span style="color:var(--red);">\u274C 探测失败: ' + (e.message || e) + '</span>';
  }

  // 恢复
  P.ai.key = _orig.key; P.ai.url = _orig.url; P.ai.model = _orig.model;
  _sShowCtxInfo();
  _sVerbUpdatePreview(); // 字数预览也会随上下文窗口变化
}

/**
 * 字数档位预览更新
 */
function _sVerbUpdatePreview() {
  var mode = 'standard';
  document.querySelectorAll('input[name="s-verbosity"]').forEach(function(r) { if (r.checked) mode = r.value; });
  var customPanel = _$('s-verb-custom');
  if (customPanel) customPanel.style.display = mode === 'custom' ? '' : 'none';

  var preview = _$('s-verb-preview'); if (!preview) return;
  // 临时切换verbosity计算预览
  var origV = P.conf.verbosity;
  P.conf.verbosity = mode;

  var cats = [
    ['shilu', '实录'], ['szj', '时政记'], ['houren', '后人戏说'],
    ['memLoyal', '奏疏(谏章)'], ['memNormal', '奏疏(普通)'], ['memSecret', '奏疏(密折)'],
    ['wd', '问对回复'], ['cy', '朝议发言'],
    ['chronicle', '编年史记'], ['comment', '太史公曰']
  ];
  var cp = (typeof getCompressionParams === 'function') ? getCompressionParams() : { scale: 1.0, contextK: 32 };
  var html = '<div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="color:var(--gold);">当前模型窗口: ' + cp.contextK + 'K</span>'
    + '<span>模型倍率: \u00D7' + Math.max(0.8, Math.min(cp.scale, 1.8)).toFixed(2) + '</span></div>';
  html += '<table style="width:100%;border-collapse:collapse;">';
  cats.forEach(function(c) {
    var r = _getCharRange(c[0]);
    html += '<tr><td style="padding:1px 4px;color:var(--txt-s);">' + c[1] + '</td>'
      + '<td style="padding:1px 4px;text-align:right;color:var(--txt);">' + r[0] + ' ~ ' + r[1] + ' 字</td></tr>';
  });
  html += '</table>';
  preview.innerHTML = html;
  P.conf.verbosity = origV; // 恢复
  // 同步更新输出上限信息
  _sUpdateMaxoutInfo();
}

/** 手动/自动切换输出上限输入框 */
function _sMaxoutToggle() {
  var mode = 'auto';
  document.querySelectorAll('input[name="s-maxout-mode"]').forEach(function(r) { if (r.checked) mode = r.value; });
  var inp = _$('s-maxout-val');
  if (inp) inp.disabled = (mode !== 'manual');
  _sUpdateMaxoutInfo();
}

/** 显示当前输出上限信息 */
function _sUpdateMaxoutInfo() {
  var info = _$('s-maxout-info'); if (!info) return;
  var detected = P.conf._detectedMaxOutput || 0;
  var manual = P.conf.maxOutputTokens || 0;
  var effective = manual > 0 ? manual : detected;
  if (effective > 0) {
    var k = (effective / 1024).toFixed(effective >= 10240 ? 0 : 1);
    info.innerHTML = '检测:<b>' + (detected?(detected/1024).toFixed(detected>=10240?0:1)+'K':'未知') + '</b> 生效:<b style="color:var(--gold);">' + k + 'K</b>';
  } else {
    info.innerHTML = '<span style="color:var(--txt-d);">未检测</span>';
  }
}

var DEFAULT_PROMPT="\u4F60\u662F\u5386\u53F2\u6A21\u62DF\u63A8\u6F14AI\u3002\u5267\u672C:{scenario_name} \u65F6\u4EE3:{era} \u89D2\u8272:{role}\n\u65F6\u95F4:{time_display} \u7B2C{turn}\u56DE\u5408\n\u96BE\u5EA6:{difficulty} \u6587\u98CE:{narrative_style}\n\u8D44\u6E90:{resources_json}\n\u5173\u7CFB:{relations_json}\n\u4EBA\u7269:{characters_json}\n\u89C4\u5219:{custom_rules}";
var DEFAULT_RULES="1.\u6570\u503C\u5408\u7406 2.\u89D2\u8272\u72EC\u7ACB 3.\u6218\u4E89\u6D88\u8017 4.\u5B63\u8282\u5F71\u54CD 5.\u5386\u53F2\u540D\u81E3\u7B26\u5408\u53F2\u5B9E";

function sSaveAPI(){
  P.ai.key=_$("s-key")?_$("s-key").value:"";P.ai.url=_$("s-url")?_$("s-url").value:"";P.ai.model=_$("s-model")?_$("s-model").value:"";P.ai.temp=parseFloat(_$("s-temp")?_$("s-temp").value:"0.8");P.ai.mem=parseInt(_$("s-mem")?_$("s-mem").value:"20");P.ai.provider=_$("s-prov")?_$("s-prov").value:"openai";
  if(window.tianming&&window.tianming.isDesktop){window.tianming.autoSave(P).catch(function(e){ (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'catch] async:') : console.warn('[catch] async:', e); });}else{try{localStorage.setItem("tm_api",JSON.stringify(P.ai));}catch(e){ console.warn("[catch] 静默异常:", e.message || e); }}
  toast("\u2705 API\u5DF2\u4FDD\u5B58");
}
function sSaveAll(){
  sSaveAPI();
  // M3·次 API 字段同步保存（若面板上有填）
  if(_$("s-sec-key")||_$("s-sec-url")||_$("s-sec-model")){
    var _sk=_$("s-sec-key")?_$("s-sec-key").value.trim():"";
    var _su=_$("s-sec-url")?_$("s-sec-url").value.trim():"";
    var _sm=_$("s-sec-model")?_$("s-sec-model").value.trim():"";
    var _sp=_$("s-sec-prov")?_$("s-sec-prov").value:"openai";
    if(!P.ai)P.ai={};
    if(_sk||_su||_sm) P.ai.secondary={key:_sk,url:_su,model:_sm,provider:_sp};
    else if(P.ai) delete P.ai.secondary;
  }
  P.conf.qijuLookback=parseInt(_$("s-qlb")?_$("s-qlb").value:"5");P.conf.shijiLookback=parseInt(_$("s-slb")?_$("s-slb").value:"5");P.conf.summaryRule=_$("s-sumrule")?_$("s-sumrule").value:"";P.conf.autoSaveTurns=parseInt(_$("s-as-turns")?_$("s-as-turns").value:"5")||5;
  // AI 记忆容量设置
  P.conf.memoryAnchorKeep=parseInt(_$("s-mem-anchor")?_$("s-mem-anchor").value:"40")||40;
  P.conf.memoryArchiveKeep=parseInt(_$("s-mem-archive")?_$("s-mem-archive").value:"20")||20;
  P.conf.characterArcKeep=parseInt(_$("s-mem-arc")?_$("s-mem-arc").value:"10")||10;
  P.conf.playerDecisionKeep=parseInt(_$("s-mem-dec")?_$("s-mem-dec").value:"30")||30;
  P.conf.chronicleKeep=parseInt(_$("s-mem-chr")?_$("s-mem-chr").value:"10")||10;
  P.conf.convKeep=parseInt(_$("s-mem-conv")?_$("s-mem-conv").value:"40")||40;
  P.conf.contextSizeK=parseInt(_$("s-ctx")?_$("s-ctx").value:"0")||0;
  // AI生成字数档位
  var _vRadios = document.querySelectorAll('input[name="s-verbosity"]');
  _vRadios.forEach(function(r) { if (r.checked) P.conf.verbosity = r.value; });
  // AI输出上限
  var _moMode = 'auto';
  document.querySelectorAll('input[name="s-maxout-mode"]').forEach(function(r) { if (r.checked) _moMode = r.value; });
  if (_moMode === 'manual') {
    var _moVal = parseInt(_$("s-maxout-val")?_$("s-maxout-val").value:"0")||0;
    P.conf.maxOutputTokens = _moVal > 0 ? _moVal : 0;
  } else {
    P.conf.maxOutputTokens = 0; // 0=自动
  }
  // 自定义字数（仅custom模式读取，但始终保存以便切换回来）
  P.conf.shiluMin=parseInt(_$("s-shilu1")?_$("s-shilu1").value:"200")||200;P.conf.shiluMax=parseInt(_$("s-shilu2")?_$("s-shilu2").value:"400")||400;
  P.conf.szjMin=parseInt(_$("s-szj1")?_$("s-szj1").value:"600")||600;P.conf.szjMax=parseInt(_$("s-szj2")?_$("s-szj2").value:"1200")||1200;
  P.conf.hourenMin=parseInt(_$("s-houren1")?_$("s-houren1").value:"2500")||2500;P.conf.hourenMax=parseInt(_$("s-houren2")?_$("s-houren2").value:"6000")||6000;
  P.conf.memLoyalMin=parseInt(_$("s-ml1")?_$("s-ml1").value:"400")||400;P.conf.memLoyalMax=parseInt(_$("s-ml2")?_$("s-ml2").value:"600")||600;
  P.conf.memNormalMin=parseInt(_$("s-mn1")?_$("s-mn1").value:"200")||200;P.conf.memNormalMax=parseInt(_$("s-mn2")?_$("s-mn2").value:"350")||350;
  P.conf.memSecretMin=parseInt(_$("s-ms1")?_$("s-ms1").value:"150")||150;P.conf.memSecretMax=parseInt(_$("s-ms2")?_$("s-ms2").value:"250")||250;
  P.conf.wdMin=parseInt(_$("s-wd1")?_$("s-wd1").value:"120")||120;P.conf.wdMax=parseInt(_$("s-wd2")?_$("s-wd2").value:"250")||250;
  P.conf.cyMin=parseInt(_$("s-cy1")?_$("s-cy1").value:"120")||120;P.conf.cyMax=parseInt(_$("s-cy2")?_$("s-cy2").value:"250")||250;
  P.conf.chronicleMin=parseInt(_$("s-chr1")?_$("s-chr1").value:"800")||800;P.conf.chronicleMax=parseInt(_$("s-chr2")?_$("s-chr2").value:"1500")||1500;
  P.conf.commentMin=parseInt(_$("s-cmt1")?_$("s-cmt1").value:"80")||80;P.conf.commentMax=parseInt(_$("s-cmt2")?_$("s-cmt2").value:"200")||200;
  P.conf.style=_$("s-style")?_$("s-style").value:"";P.conf.difficulty=_$("s-diff")?_$("s-diff").value:"";
  P.conf.customStyle=_$("s-cstyle")?_$("s-cstyle").value:"";P.conf.gameMode=_$("s-mode")?_$("s-mode").value:"yanyi";P.conf.aiCallDepth=_$("s-aidepth")?_$("s-aidepth").value:"full";
  P.ai.prompt=_$("s-prompt")?_$("s-prompt").value:"";P.ai.rules=_$("s-rules")?_$("s-rules").value:"";
  saveP(); // 持久化所有设置（含记忆容量配置）
  toast("\u2705 \u5168\u90E8\u5DF2\u4FDD\u5B58");
}

async function sDetectModels(){
  var key=_$("s-key")?_$("s-key").value:"";var baseUrl=_$("s-url")?_$("s-url").value:"";
  if(!key||!baseUrl){toast("\u586B\u5199Key\u548C\u5730\u5740");return;}
  var st=_$("s-status");if(st)st.textContent="\u68C0\u6D4B\u4E2D...";
  var modelsUrl=baseUrl.replace(/\/+$/,"");
  if(modelsUrl.indexOf("/chat/completions")>=0)modelsUrl=modelsUrl.replace("/chat/completions","/models");
  else{var vm=modelsUrl.match(/(.*\/v\d+)/);modelsUrl=vm?vm[1]+"/models":modelsUrl+"/models";}
  try{
    var resp=await fetch(modelsUrl,{method:"GET",headers:{"Authorization":"Bearer "+key}});
    if(!resp.ok){_$("s-models").style.display="flex";_$("s-models").innerHTML="<span class=\"model-chip\" onclick=\"sPickModel('gpt-4o',this)\">gpt-4o</span><span class=\"model-chip\" onclick=\"sPickModel('deepseek-chat',this)\">deepseek-chat</span><span class=\"model-chip\" onclick=\"sPickModel('claude-3-5-sonnet-20241022',this)\">claude-3-5-sonnet</span>";if(st)st.textContent="\u63A5\u53E3\u4E0D\u53EF\u7528\uFF0C\u5DF2\u663E\u793A\u5E38\u7528";return;}
    var data=await resp.json();var models=[];
    if(data.data&&Array.isArray(data.data))models=data.data.map(function(m){return m.id||"";}).filter(Boolean).sort();
    if(models.length>0){_$("s-models").style.display="flex";var cur=_$("s-model")?_$("s-model").value:"";_$("s-models").innerHTML=models.map(function(m){return "<span class=\"model-chip"+(m===cur?" active":"")+"\" onclick=\"sPickModel('"+m+"',this)\">"+m+"</span>";}).join("");if(st)st.innerHTML="<span style=\"color:var(--green);\">\u2705 "+models.length+"\u6A21\u578B</span>";}
  }catch(err){if(st)st.textContent="\u5931\u8D25: "+err.message;_$("s-models").style.display="flex";_$("s-models").innerHTML="<span class=\"model-chip\" onclick=\"sPickModel('gpt-4o',this)\">gpt-4o</span><span class=\"model-chip\" onclick=\"sPickModel('deepseek-chat',this)\">deepseek-chat</span>";}
}
function sPickModel(m,el){var inp=_$("s-model");if(inp)inp.value=m;document.querySelectorAll("#s-models .model-chip").forEach(function(c){c.classList.remove("active");});if(el)el.classList.add("active");}

// ══ 次要 API·M3 快模型路由 ══════════════════════════════════════
function sSaveSecondaryAPI(){
  var sk=_$("s-sec-key")?_$("s-sec-key").value.trim():"";
  var su=_$("s-sec-url")?_$("s-sec-url").value.trim():"";
  var sm=_$("s-sec-model")?_$("s-sec-model").value.trim():"";
  var sp=_$("s-sec-prov")?_$("s-sec-prov").value:"openai";
  if(!P.ai)P.ai={};
  if(sk||su||sm){
    P.ai.secondary={key:sk,url:su,model:sm,provider:sp};
    toast("\u2705 \u6B21 API \u5DF2\u4FDD\u5B58\u00B7\u95EE\u5BF9/\u671D\u8BAE\u5C06\u8D70\u6B64\u914D\u7F6E");
  } else {
    delete P.ai.secondary;
    toast("\u2705 \u5DF2\u6E05\u7A7A\u6B21 API\u00B7\u56DE\u9000\u4E3B API");
  }
  try{localStorage.setItem("tm_api",JSON.stringify(P.ai));}catch(e){}
  if(window.tianming&&window.tianming.isDesktop){try{window.tianming.autoSave(P).catch(function(){});}catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-patches');}catch(_){}}}
  saveP();
  // 刷新面板以更新徽标和清除按钮可见性
  try{closeSettings();openSettings();}catch(_){}
}

function sClearSecondaryAPI(){
  if(!confirm("\u786E\u5B9A\u6E05\u9664\u6B21 API \u914D\u7F6E\uFF1F"))return;
  if(P.ai)delete P.ai.secondary;
  try{localStorage.setItem("tm_api",JSON.stringify(P.ai));}catch(e){}
  saveP();
  toast("\u5DF2\u6E05\u9664\u6B21 API");
  try{closeSettings();openSettings();}catch(_){}
}

function sToggleSecondaryEnabled(on){
  if(!P.conf)P.conf={};
  P.conf.secondaryEnabled=!!on;
  saveP();
  toast(on?"\u2705 \u5DF2\u542F\u7528\u6B21 API":"\u5DF2\u5173\u95ED\u6B21 API\u00B7\u56DE\u9000\u4E3B API");
  try{closeSettings();openSettings();}catch(_){}
}

async function sDetectSecondaryModels(){
  var key=_$("s-sec-key")?_$("s-sec-key").value.trim():"";
  var baseUrl=_$("s-sec-url")?_$("s-sec-url").value.trim():"";
  if(!key||!baseUrl){toast("\u586B\u5199\u6B21 API Key \u548C\u5730\u5740");return;}
  var st=_$("s-sec-status");if(st)st.textContent="\u68C0\u6D4B\u4E2D\u2026";
  var modelsUrl=baseUrl.replace(/\/+$/,"");
  if(modelsUrl.indexOf("/chat/completions")>=0)modelsUrl=modelsUrl.replace("/chat/completions","/models");
  else{var vm=modelsUrl.match(/(.*\/v\d+)/);modelsUrl=vm?vm[1]+"/models":modelsUrl+"/models";}
  try{
    var resp=await fetch(modelsUrl,{method:"GET",headers:{"Authorization":"Bearer "+key}});
    if(!resp.ok){
      var ml=_$("s-sec-models");
      if(ml){ml.style.display="flex";ml.innerHTML="<span class=\"model-chip\" onclick=\"sPickSecModel('gpt-4o-mini',this)\">gpt-4o-mini</span><span class=\"model-chip\" onclick=\"sPickSecModel('claude-haiku-4-5',this)\">claude-haiku-4-5</span><span class=\"model-chip\" onclick=\"sPickSecModel('deepseek-chat',this)\">deepseek-chat</span>";}
      if(st)st.textContent="\u63A5\u53E3\u4E0D\u53EF\u7528\u00B7\u5DF2\u663E\u793A\u5E38\u7528\u5FEB\u6A21\u578B";
      return;
    }
    var data=await resp.json();var models=[];
    if(data.data&&Array.isArray(data.data))models=data.data.map(function(m){return m.id||"";}).filter(Boolean).sort();
    if(models.length>0){
      var ml2=_$("s-sec-models");
      if(ml2){ml2.style.display="flex";var cur=_$("s-sec-model")?_$("s-sec-model").value:"";ml2.innerHTML=models.map(function(m){return "<span class=\"model-chip"+(m===cur?" active":"")+"\" onclick=\"sPickSecModel('"+m+"',this)\">"+m+"</span>";}).join("");}
      if(st)st.innerHTML="<span style=\"color:var(--green);\">\u2705 "+models.length+" \u4E2A\u6A21\u578B</span>";
    }
  }catch(err){
    if(st)st.textContent="\u5931\u8D25\uFF1A"+err.message;
    var ml3=_$("s-sec-models");
    if(ml3){ml3.style.display="flex";ml3.innerHTML="<span class=\"model-chip\" onclick=\"sPickSecModel('gpt-4o-mini',this)\">gpt-4o-mini</span><span class=\"model-chip\" onclick=\"sPickSecModel('claude-haiku-4-5',this)\">claude-haiku-4-5</span>";}
  }
}

function sPickSecModel(m,el){
  var inp=_$("s-sec-model");if(inp)inp.value=m;
  document.querySelectorAll("#s-sec-models .model-chip").forEach(function(c){c.classList.remove("active");});
  if(el)el.classList.add("active");
}

async function sTestSecondaryConn(){
  var key=_$("s-sec-key")?_$("s-sec-key").value.trim():"";
  var url=_$("s-sec-url")?_$("s-sec-url").value.trim():"";
  var model=_$("s-sec-model")?_$("s-sec-model").value.trim():"gpt-4o-mini";
  if(!key||!url){toast("\u586B\u5199\u6B21 API Key \u548C\u5730\u5740");return;}
  var st=_$("s-sec-status");if(st)st.textContent="\u8FDE\u63A5\u4E2D\u2026";
  try{
    var testUrl=url;
    if(testUrl.indexOf("/chat/completions")<0)testUrl=testUrl.replace(/\/+$/,"")+"/chat/completions";
    var t0=Date.now();
    var resp=await fetch(testUrl,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},body:JSON.stringify({model:model,messages:[{role:"user",content:"Hi"}],max_tokens:5})});
    var dt=Date.now()-t0;
    if(resp.ok){
      if(st)st.innerHTML="<span style=\"color:var(--green);\">\u2705 \u8FDE\u63A5\u6210\u529F\u00B7"+dt+"ms</span>";
    }else{
      if(st)st.innerHTML="<span style=\"color:var(--red);\">\u274C HTTP "+resp.status+"</span>";
    }
  }catch(err){
    if(st)st.innerHTML="<span style=\"color:var(--red);\">\u274C "+err.message+"</span>";
  }
}
async function sTestConn(){
  var key=_$("s-key")?_$("s-key").value:"";var url=_$("s-url")?_$("s-url").value:"";
  if(!key||!url){toast("\u586B\u5199");return;}var st=_$("s-status");if(st)st.textContent="\u8FDE\u63A5\u4E2D...";
  // 临时更新P.ai以便detectModelContextSize能使用
  var _origKey=P.ai.key, _origUrl=P.ai.url, _origModel=P.ai.model;
  P.ai.key=key; P.ai.url=url; P.ai.model=_$("s-model")?_$("s-model").value:"gpt-4o";
  try{var testUrl=url;if(testUrl.indexOf("/chat/completions")<0)testUrl=testUrl.replace(/\/+$/,"")+"/chat/completions";
    var resp=await fetch(testUrl,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},body:JSON.stringify({model:P.ai.model,messages:[{role:"user",content:"Hi"}],max_tokens:5})});
    if(resp.ok){
      if(st)st.innerHTML="<span style=\"color:var(--green);\">\u2705 \u8FDE\u63A5\u6210\u529F\uFF0C\u6B63\u5728\u63A2\u6D4B\u4E0A\u4E0B\u6587\u7A97\u53E3...</span>";
      // 连接成功后自动探测上下文窗口
      try{
        delete P.conf._detectedContextK; delete P.conf._ctxCacheKey; delete P.conf._ctxDetectLayer;
        var detK = await detectModelContextSize({
          force: true,
          onProgress: function(msg) { if(st) st.innerHTML='<span style="color:var(--gold);">\u2705 \u8FDE\u63A5\u6210\u529F \u00B7 '+msg+'</span>'; }
        });
        if(st)st.innerHTML='<span style="color:var(--green);">\u2705 \u8FDE\u63A5\u6210\u529F \u00B7 \u4E0A\u4E0B\u6587: <b>'+detK+'K</b> ('+(P.conf._ctxDetectLayer||'')+')</span>';
        _sShowCtxInfo(); _sVerbUpdatePreview();
      }catch(ce){if(st)st.innerHTML='<span style="color:var(--green);">\u2705 \u8FDE\u63A5\u6210\u529F</span><span style="color:var(--txt-d);"> (\u63A2\u6D4B\u5931\u8D25)</span>';}
    }else{if(st)st.innerHTML="<span style=\"color:var(--red);\">\u274C HTTP "+resp.status+"</span>";}
  }catch(err){if(st)st.innerHTML="<span style=\"color:var(--red);\">\u274C "+err.message+"</span>";}
  // 恢复原始值（避免未保存时污染）
  P.ai.key=_origKey; P.ai.url=_origUrl; P.ai.model=_origModel;
}

// 生图API——保存
function _sSaveImgAPI() {
  var ik = (_$('s-img-key')||{}).value || '';
  var iu = (_$('s-img-url')||{}).value || '';
  var im = (_$('s-img-model')||{}).value || 'dall-e-3';
  if (ik || iu) {
    try { localStorage.setItem('tm_api_image', JSON.stringify({key:ik.trim(), url:iu.trim(), model:im.trim()})); } catch(_){}
  } else {
    try { localStorage.removeItem('tm_api_image'); } catch(_){}
  }
  toast('\u751F\u56FEAPI\u5DF2\u4FDD\u5B58');
}

// 生图API——测试连接
async function _sTestImgConn() {
  var st = _$('s-img-status');
  if (st) st.innerHTML = '<span style="color:var(--gold);">\u6D4B\u8BD5\u4E2D\u2026</span>';
  var cfg = typeof ImageAPI !== 'undefined' ? ImageAPI.getConfig() : null;
  if (!cfg || !cfg.supported) {
    if (st) st.innerHTML = '<span style="color:var(--red);">\u274C \u672A\u914D\u7F6E\u751F\u56FEAPI\uFF08Key\u6216URL\u4E3A\u7A7A\uFF09</span>';
    return;
  }
  try {
    // 用一个极简prompt测试连接（不实际生成图片，只验证认证）
    var resp = await fetch(cfg.url, {
      method: 'POST',
      headers: {'Content-Type':'application/json','Authorization':'Bearer '+cfg.key},
      body: JSON.stringify({model:cfg.model||'dall-e-3',prompt:'test',n:1,size:'256x256',response_format:'url'})
    });
    if (resp.ok) {
      if (st) st.innerHTML = '<span style="color:var(--green);">\u2705 \u8FDE\u63A5\u6210\u529F\uFF0C\u751F\u56FEAPI\u53EF\u7528</span>';
    } else {
      var errMsg = '';
      try { var ej = await resp.json(); errMsg = (ej.error && ej.error.message) || ''; } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-patches');}catch(_){}}
      if (st) st.innerHTML = '<span style="color:var(--red);">\u274C HTTP ' + resp.status + (errMsg ? ': ' + errMsg.slice(0,60) : '') + '</span>';
    }
  } catch(e) {
    if (st) st.innerHTML = '<span style="color:var(--red);">\u274C \u7F51\u7EDC\u9519\u8BEF: ' + e.message + '</span>';
  }
}

// 生图API——检测是否支持生图功能
async function _sDetectImgCap() {
  var st = _$('s-img-status');
  if (st) st.innerHTML = '<span style="color:var(--gold);">\u68C0\u6D4B\u4E2D\u2026\u6B63\u5728\u5C1D\u8BD5\u751F\u6210\u6D4B\u8BD5\u56FE\u7247</span>';
  try {
    // 实际生成一张极小的测试图来验证生图能力
    var testUrl = await ImageAPI.generate('A simple red circle on white background, minimal, test image', {size:'256x256', quality:'standard'});
    if (testUrl) {
      if (st) st.innerHTML = '<span style="color:var(--green);">\u2705 \u751F\u56FE\u529F\u80FD\u6B63\u5E38\uFF01\u5DF2\u6210\u529F\u751F\u6210\u6D4B\u8BD5\u56FE\u7247\u3002</span>' +
        '<br><img src="' + (typeof escHtml==='function'?escHtml(testUrl):testUrl) + '" style="width:64px;height:64px;border-radius:4px;margin-top:4px;border:1px solid var(--bdr);">';
    }
  } catch(e) {
    if (st) st.innerHTML = '<span style="color:var(--red);">\u274C \u751F\u56FE\u529F\u80FD\u4E0D\u53EF\u7528: ' + (typeof escHtml==='function'?escHtml(e.message):e.message).slice(0,80) + '</span>';
  }
}

// 系统开关面板
function renderScnTab(em,sc){
  var idx=P.scenarios.indexOf(sc);
  em.innerHTML=
    // 系统开关
    "<div class=\"cd\"><h4>\u7CFB\u7EDF\u5F00\u5173</h4>"+
    ["characters:\u89D2\u8272","factions:\u515A\u6D3E","items:\u7269\u54C1","military:\u519B\u4E8B","events:\u4E8B\u4EF6","map:\u5730\u56FE","techTree:\u79D1\u6280\u6811","civicTree:\u5E02\u653F\u6811"].map(function(s){var parts=s.split(":");return "<div class=\"toggle-wrap\"><label class=\"toggle\"><input type=\"checkbox\" "+(P.systems[parts[0]]!==false?"checked":"")+" onchange=\"P.systems['"+parts[0]+"']=this.checked\"><span class=\"toggle-slider\"></span></label><div>"+parts[1]+"</div></div>";}).join("")+"</div>"+
    // 剧本信息
    "<div class=\"cd\"><h4>\u5267\u672C\u4FE1\u606F</h4>"+
    "<div class=\"rw\"><div class=\"fd\"><label>\u540D\u79F0</label><input value=\""+(sc.name||"")+"\" onchange=\"P.scenarios["+idx+"].name=this.value\"></div><div class=\"fd\"><label>\u65F6\u4EE3</label><input value=\""+(sc.era||"")+"\" onchange=\"P.scenarios["+idx+"].era=this.value\"></div></div>"+
    "<div class=\"rw\"><div class=\"fd\"><label>\u89D2\u8272</label><input value=\""+(sc.role||"")+"\" onchange=\"P.scenarios["+idx+"].role=this.value\"></div></div>"+
    "<div class=\"fd full\"><label>\u80CC\u666F</label><textarea rows=\"3\" onchange=\"P.scenarios["+idx+"].background=this.value\">"+(sc.background||"")+"</textarea></div>"+
    "<div class=\"fd full\" style=\"margin-top:0.5rem;\"><label>\u5F00\u573A\u767D</label><textarea rows=\"6\" onchange=\"P.scenarios["+idx+"].opening=this.value\">"+(sc.opening||"")+"</textarea></div>"+
    "<div class=\"fd full\" style=\"margin-top:0.5rem;\"><label>\u5EFA\u8BAE(\u6BCF\u884C)</label><textarea rows=\"3\" onchange=\"P.scenarios["+idx+"].suggestions=this.value.split('\\n').filter(Boolean)\">"+(sc.suggestions||[]).join("\n")+"</textarea></div>"+
    "<div class=\"rw\" style=\"margin-top:0.5rem;\"><div class=\"fd\"><label>\u80DC\u5229</label><textarea rows=\"2\" onchange=\"P.scenarios["+idx+"].winCond=this.value\">"+(sc.winCond||"")+"</textarea></div><div class=\"fd\"><label>\u5931\u8D25</label><textarea rows=\"2\" onchange=\"P.scenarios["+idx+"].loseCond=this.value\">"+(sc.loseCond||"")+"</textarea></div></div>"+
    "<hr class=\"dv\"><div class=\"rw\"><div class=\"fd\"><label>\u6587\u98CE</label><select onchange=\"P.scenarios["+idx+"].scnStyle=this.value\"><option value=\"\">\u8DDF\u968F\u5168\u5C40</option><option "+(sc.scnStyle==="\u6587\u5B66\u5316"?"selected":"")+">\u6587\u5B66\u5316</option><option "+(sc.scnStyle==="\u53F2\u4E66\u4F53"?"selected":"")+">\u53F2\u4E66\u4F53</option></select></div></div>"+
    "<div class=\"fd full\" style=\"margin-top:0.3rem;\"><label>\u53C2\u8003\u6587\u672C</label><textarea rows=\"3\" onchange=\"P.scenarios["+idx+"].refText=this.value\">"+(sc.refText||"")+"</textarea></div>"+
    "<div class=\"fd full\" style=\"margin-top:0.3rem;\"><label>\u5267\u672CAPI\u6307\u4EE4</label><textarea rows=\"2\" onchange=\"P.scenarios["+idx+"].customPrompt=this.value\">"+(sc.customPrompt||"")+"</textarea></div></div>";
}

// ============================================================
//  开局逻辑审查：AI生成缺失所在地 + 检查剧本数据矛盾
// ============================================================
async function _logicAuditOnStart(sc) {
  if (!P.ai.key || !GM.chars || GM.chars.length === 0) return;
  // 剧本已人工深化·跳过 AI 逻辑审查（角色 location/矛盾已手工填妥）
  if (sc && (sc.aiAutoEnrich === false || sc.isFullyDetailed === true)) {
    console.log('[LogicAudit] 剧本已深化·跳过 AI 审查');
    return;
  }
  var capital = GM._capital || '京城';
  var era = (sc && sc.era) || P.era || '';
  var bg = (sc && sc.background) || '';
  var dynasty = (sc && sc.dynasty) || '';
  var startYear = (P.time && P.time.year) || '';

  // ── 收集数据 ──
  var needLocation = []; // 缺所在地需AI生成的角色
  var haveLocation = []; // 已有所在地需审查的角色
  GM.chars.forEach(function(c) {
    if (c.alive === false) return;
    if (c._locationNeedAI) {
      needLocation.push(c);
    } else {
      haveLocation.push(c);
    }
  });

  // 行政区划
  var adminInfo = '';
  var adminPlaces = []; // 收集所有已知地名供AI参考
  if (P.adminHierarchy) {
    Object.keys(P.adminHierarchy).forEach(function(k) {
      var ah = P.adminHierarchy[k];
      if (ah && ah.divisions) {
        adminInfo += k + '辖下：';
        adminInfo += ah.divisions.map(function(d) {
          var gov = d.governor || '';
          var name = d.name || '';
          var cap = d.capital || '';
          if (name) adminPlaces.push(name);
          if (cap) adminPlaces.push(cap);
          return name + (cap ? '(治' + cap + ')' : '') + (gov ? '[' + gov + ']' : '');
        }).join('、');
        adminInfo += '\n';
      }
    });
  }

  // 官制
  var officeHolders = [];
  (function _walk(nodes, pre) {
    if (!nodes) return;
    nodes.forEach(function(n) {
      if (n.positions) n.positions.forEach(function(p) {
        if (p.holder) officeHolders.push({ dept: pre + n.name, pos: p.name, holder: p.holder });
      });
      if (n.subs) _walk(n.subs, pre + n.name + '/');
    });
  })(GM.officeTree, '');

  // ── 构建prompt ──
  var prompt = '你是' + (era || '中国古代') + '历史专家。请完成以下两项任务：\n\n';
  prompt += '【时代背景】' + (dynasty ? dynasty + ' ' : '') + era + (startYear ? '（' + startYear + '年）' : '') + '\n';
  if (bg) prompt += bg + '\n';
  prompt += '\u3010\u4EAC\u57CE/\u9996\u90FD\u3011' + capital + '\n';
  if (adminPlaces.length > 0) prompt += '\u3010\u5DF2\u77E5\u5730\u540D\u3011' + adminPlaces.join('\u3001') + '\n';

  // ═══ 任务一：为缺失所在地的角色生成位置 ═══
  if (needLocation.length > 0) {
    prompt += '\n═══ 任务一：生成角色所在地 ═══\n';
    prompt += '以下角色没有设置所在地，请根据其官职、身份和历史背景推断其应在何处。\n\n';
    needLocation.forEach(function(c) {
      var tags = [];
      if (c.isPlayer) tags.push('玩家');
      if (c.spouse) tags.push('后妃');
      if (c.faction) tags.push('势力:' + c.faction);
      prompt += '  ' + c.name + '（' + (c.title || '无官职') + '）' + (tags.length ? ' [' + tags.join(',') + ']' : '');
      if (c.bio) prompt += ' \u7B80\u4ECB:' + c.bio;
      if (c.desc) prompt += ' ' + c.desc;
      prompt += '\n';
    });
    prompt += '\n推断规则：\n';
    prompt += '• 地方官（刺史/太守/知府/节度使/巡抚等）→ 其辖区治所\n';
    prompt += '• 中央朝臣（宰相/尚书/侍郎/御史等）→ 京城(' + capital + ')\n';
    prompt += '• 后妃/皇族 → 京城\n';
    prompt += '• 武将 → 根据其军职判断，守边将领在边镇，禁军将领在京城\n';
    prompt += '• 隐士/在野/被贬 → 根据史实或合理推断（如被贬岭南、归隐庐山等）\n';
    prompt += '• 真实历史人物 → 务必参照' + (startYear ? startYear + '年' : '该时期') + '的史实确定其所在地\n';
    prompt += '• 所在地用具体地名（如"杭州""范阳""洛阳"），不要用泛称（如"地方""边疆"）\n';
    prompt += '• 如果行政区划中有该地名，优先使用区划中的写法\n';
  }

  // ═══ 任务二：审查已有角色数据的逻辑矛盾 ═══
  prompt += '\n═══ 任务二：逻辑矛盾审查 ═══\n';
  prompt += '检查以下已有所在地的角色，是否存在矛盾：\n\n';
  haveLocation.forEach(function(c) {
    prompt += '  ' + c.name + '（' + (c.title || '') + '）在: ' + c.location;
    if (c.isPlayer) prompt += ' [玩家]';
    if (c.spouse) prompt += ' [后妃]';
    if (c._locationExplicit) prompt += ' [手动设置]';
    prompt += '\n';
  });

  if (adminInfo) prompt += '\n【行政区划】\n' + adminInfo;
  if (officeHolders.length > 0) {
    prompt += '\n【中央官制】\n';
    officeHolders.forEach(function(o) { prompt += '  ' + o.dept + ' ' + o.pos + ': ' + o.holder + '\n'; });
  }

  prompt += '\n审查规则：\n';
  prompt += '• 地方官所在地应为辖区治所（"杭州刺史"应在杭州）\n';
  prompt += '• 中央官员应在京城\n';
  prompt += '• 行政区划的governor与角色title/location应一致\n';
  prompt += '• 标记[手动设置]的角色如果有矛盾仍然报告，但在reason中注明"编辑器设置，建议检查"\n';

  // ═══ 输出格式 ═══
  prompt += '\n═══ 输出格式（严格JSON）═══\n';
  prompt += '{\n';
  prompt += '  "locations": [{"name":"角色名","location":"推断的所在地","reason":"依据(15字内)"}],\n';
  prompt += '  "fixes": [{"name":"角色名","field":"location","oldValue":"原值","newValue":"正确值","reason":"原因(20字内)"}],\n';
  prompt += '  "notes": ["其他无法自动修正的问题"]\n';
  prompt += '}\n';
  prompt += 'locations: 任务一的结果（每个缺位角色一条）\n';
  prompt += 'fixes: 任务二的结果（仅有矛盾的角色）\n';
  prompt += '只输出JSON，不要解释。';

  try {
    var result = await callAISmart(prompt, 6000, { maxRetries: 2 });
    var data = (typeof extractJSON === 'function') ? extractJSON(result) : null;
    if (!data) return;

    var genCount = 0, fixCount = 0;

    // ── 应用任务一：生成的所在地 ──
    (data.locations || []).forEach(function(loc) {
      if (!loc.name || !loc.location) return;
      var ch = GM.chars.find(function(c) { return c.name === loc.name; });
      if (!ch) return;
      var old = ch.location;
      ch.location = loc.location;
      delete ch._locationNeedAI; // 清除标记
      genCount++;
      _dbg('[LogicAudit] 生成所在地: ' + loc.name + ' → ' + loc.location + ' (' + (loc.reason || '') + ')');
    });

    // 未被AI处理的角色，保持京城默认（清除标记）
    GM.chars.forEach(function(c) { delete c._locationNeedAI; });

    // ── 应用任务二：矛盾修正 ──
    (data.fixes || []).forEach(function(fix) {
      if (!fix.name || !fix.field || !fix.newValue) return;
      var ch = GM.chars.find(function(c) { return c.name === fix.name; });
      if (!ch) return;
      if (fix.field !== 'location') return; // 安全白名单

      var oldVal = ch[fix.field];
      // 编辑器显式设置的仅记录不覆盖
      if (ch._locationExplicit) {
        _dbg('[LogicAudit] 建议(未覆盖): ' + fix.name + ' "' + oldVal + '" → "' + fix.newValue + '" (' + (fix.reason || '') + ')');
        return;
      }
      ch[fix.field] = fix.newValue;
      fixCount++;
      _dbg('[LogicAudit] 修正: ' + fix.name + ' "' + (oldVal || '') + '" → "' + fix.newValue + '" (' + (fix.reason || '') + ')');
    });

    (data.notes || []).forEach(function(n) { _dbg('[LogicAudit] 备注: ' + n); });

    // ── 汇总 ──
    var totalChanges = genCount + fixCount;
    if (totalChanges > 0) {
      showLoading('\u903B\u8F91\u5BA1\u67E5: \u751F\u6210' + genCount + '\u5904\u6240\u5728\u5730\uFF0C\u4FEE\u6B63' + fixCount + '\u5904\u77DB\u76FE', 92);
      console.log('[LogicAudit] 生成所在地 ' + genCount + ' 处，修正矛盾 ' + fixCount + ' 处');
      if (GM.qijuHistory) {
        var logParts = [];
        if (genCount > 0) logParts.push('为' + genCount + '位人物生成所在地');
        if (fixCount > 0) logParts.push('修正' + fixCount + '处矛盾');
        GM.qijuHistory.unshift({
          turn: 0, date: '开局审查',
          content: '【逻辑审查】' + logParts.join('，') + '。'
        });
      }
    } else {
      showLoading('\u903B\u8F91\u5BA1\u67E5: \u6570\u636E\u65E0\u77DB\u76FE', 92);
    }
  } catch(e) {
    console.warn('[LogicAudit] 审查失败:', e.message || e);
  }
}

// 开场白动画（完全替换 startGame，doActualStart 内部调用 GameHooks）
startGame=async function(sid){
  var sc=findScenarioById(sid);
  if(!sc){toast("\u672A\u627E\u5230");return;}
  _$("scn-page").classList.remove("show");
  _$("launch").style.display="none";

  // 加载流程
  showLoading("\u751F\u6210\u4E16\u754C\u4E2D",0);

  // 第一阶段：读取剧本数据
  var steps=[
    {text:"\u8BFB\u53D6\u5267\u672C\u57FA\u672C\u4FE1\u606F",progress:5},
    {text:"\u8BFB\u53D6\u4E16\u754C\u8BBE\u5B9A",progress:10},
    {text:"\u8BFB\u53D6\u89D2\u8272\u6570\u636E",progress:20},
    {text:"\u8BFB\u53D6\u52BF\u529B\u6570\u636E",progress:30},
    {text:"\u8BFB\u53D6\u7269\u54C1\u7CFB\u7EDF",progress:40},
    {text:"\u8BFB\u53D6\u4E8B\u4EF6\u7CFB\u7EDF",progress:50},
    {text:"\u8BFB\u53D6\u5B98\u5236\u7CFB\u7EDF",progress:55},
    {text:"\u8BFB\u53D6\u519B\u4E8B\u7CFB\u7EDF",progress:60},
    {text:"\u8BFB\u53D6\u79D1\u6280\u6811",progress:65},
    {text:"\u8BFB\u53D6\u5E02\u653F\u6811",progress:70}
  ];

  for(var i=0;i<steps.length;i++){
    showLoading(steps[i].text+"...",steps[i].progress);
    await new Promise(function(r){setTimeout(r,200);});
  }

  // 第二阶段：AI 配置世界（如果配置了 AI）
  if(P.ai.key){
    showLoading("\u63A2\u6D4B\u6A21\u578B\u4E0A\u4E0B\u6587\u7A97\u53E3...",71);
    try {
      var _detK = await detectModelContextSize();
      showLoading("\u6A21\u578B\u4E0A\u4E0B\u6587: " + _detK + "K tokens",72);
      await new Promise(function(r){setTimeout(r,500);});
    } catch(_detErr) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_detErr, 'CtxDetect] 探测失败，使用默认值:') : console.warn('[CtxDetect] 探测失败，使用默认值:', _detErr); }
    showLoading("\u8FDE\u63A5AI\u7CFB\u7EDF...",72);
    await new Promise(function(r){setTimeout(r,300);});

    // 1. AI 读取并理解剧本基本信息
    showLoading("AI\u8BFB\u53D6\u5267\u672C\u57FA\u672C\u4FE1\u606F...",74);
    await new Promise(function(r){setTimeout(r,300);});

    // 2. AI 读取世界设定
    showLoading("AI\u8BFB\u53D6\u4E16\u754C\u8BBE\u5B9A...",76);
    await new Promise(function(r){setTimeout(r,300);});

    // 3. AI 读取角色信息
    var chars = P.characters.filter(function(c){return c.sid===sid;});
    if(chars.length > 0){
      showLoading("AI\u8BFB\u53D6\u89D2\u8272\u4FE1\u606F\uFF08" + chars.length + "\u4EBA\uFF09...",78);
      await new Promise(function(r){setTimeout(r,300);});
    }

    // 4. AI 读取势力信息
    var facs = P.factions.filter(function(f){return f.sid===sid;});
    if(facs.length > 0){
      showLoading("AI\u8BFB\u53D6\u52BF\u529B\u4FE1\u606F\uFF08" + facs.length + "\u4E2A\uFF09...",80);
      await new Promise(function(r){setTimeout(r,300);});
    }

    // 5. AI 统筹整合
    showLoading("AI\u7EDF\u7B79\u6574\u5408\u4E16\u754C\u6570\u636E...",82);
    await new Promise(function(r){setTimeout(r,500);});

    // 6. 生成开场白（如果需要）
    if(!sc.opening||sc.opening.length<50){
      showLoading("AI\u751F\u6210\u5F00\u573A\u767D...",85);
      try{
        // 构建完整的剧本上下文
        var contextPrompt = "\u4F60\u662FAI\u4E16\u754C\u914D\u7F6E\u7CFB\u7EDF\uFF0C\u8BF7\u6839\u636E\u4EE5\u4E0B\u5B8C\u6574\u7684\u5267\u672C\u6570\u636E\u751F\u6210\u5F00\u573A\u767D\u3002\n\n";

        contextPrompt += "\u3010\u5267\u672C\u57FA\u672C\u4FE1\u606F\u3011\n";
        contextPrompt += "\u540D\u79F0\uFF1A" + sc.name + "\n";
        contextPrompt += "\u65F6\u4EE3\uFF1A" + sc.era + "\n";
        contextPrompt += "\u89D2\u8272\uFF1A" + sc.role + "\n";
        if(sc.background) contextPrompt += "\u80CC\u666F\uFF1A" + sc.background + "\n";
        if(sc.overview) contextPrompt += "\u6982\u8FF0\uFF1A" + sc.overview + "\n";

        // 添加世界设定
        if(P.world && (P.world.history || P.world.politics || P.world.culture)){
          contextPrompt += "\n\u3010\u4E16\u754C\u8BBE\u5B9A\u3011\n";
          if(P.world.history) contextPrompt += "\u5386\u53F2\u80CC\u666F\uFF1A" + P.world.history.substring(0, 300) + (P.world.history.length > 300 ? "..." : "") + "\n";
          if(P.world.politics) contextPrompt += "\u653F\u6CBB\u683C\u5C40\uFF1A" + P.world.politics.substring(0, 300) + (P.world.politics.length > 300 ? "..." : "") + "\n";
          if(P.world.culture) contextPrompt += "\u6587\u5316\u7279\u8272\uFF1A" + P.world.culture.substring(0, 300) + (P.world.culture.length > 300 ? "..." : "") + "\n";
        }

        // 添加角色信息
        if(chars.length > 0){
          contextPrompt += "\n\u3010\u89D2\u8272\u5217\u8868\u3011\uFF08\u5171" + chars.length + "\u4EBA\uFF09\n";
          chars.slice(0, 15).forEach(function(c){
            contextPrompt += "- " + c.name;
            if(c.title) contextPrompt += "\uFF08" + c.title + "\uFF09";
            if(c.faction) contextPrompt += " \u6240\u5C5E\uFF1A" + c.faction;
            if(c.bio) contextPrompt += " \u7B80\u4ECB\uFF1A" + c.bio.substring(0, 80);
            contextPrompt += "\n";
          });
          if(chars.length > 15) contextPrompt += "...\u7B49\u5171" + chars.length + "\u4EBA\n";
        }

        // 添加势力信息
        if(facs.length > 0){
          contextPrompt += "\n\u3010\u52BF\u529B\u5217\u8868\u3011\uFF08\u5171" + facs.length + "\u4E2A\uFF09\n";
          facs.forEach(function(f){
            contextPrompt += "- " + f.name;
            if(f.leader) contextPrompt += " \u9996\u9886\uFF1A" + f.leader;
            if(f.desc) contextPrompt += " \u7B80\u4ECB\uFF1A" + f.desc.substring(0, 80);
            contextPrompt += "\n";
          });
          if(facs.length > 10) contextPrompt += "...\u7B49\u5171" + facs.length + "\u4E2A\u52BF\u529B\n";
        }

        // 添加物品系统
        var items = P.items.filter(function(t){return t.sid===sid;});
        if(items.length > 0){
          contextPrompt += "\n\u3010\u7269\u54C1\u7CFB\u7EDF\u3011\uFF08\u5171" + items.length + "\u4EF6\uFF09\n";
          items.slice(0, 5).forEach(function(t){
            contextPrompt += "- " + t.name;
            if(t.desc) contextPrompt += "\uFF1A" + t.desc.substring(0, 50);
            contextPrompt += "\n";
          });
          if(items.length > 5) contextPrompt += "...\u7B49\u5171" + items.length + "\u4EF6\u7269\u54C1\n";
        }

        // 添加游戏模式信息
        var gameMode = P.conf.gameMode || 'yanyi';
        contextPrompt += "\n\u3010\u6E38\u620F\u6A21\u5F0F\u3011";
        if(gameMode === 'strict_hist'){
          contextPrompt += "\u4E25\u683C\u53F2\u5B9E\u6A21\u5F0F\uFF0C\u5FC5\u987B\u4E25\u683C\u9075\u5FAA\u5386\u53F2\u4E8B\u5B9E\u3002\n";
          if(P.conf.refText) contextPrompt += "\n\u3010\u53C2\u8003\u53F2\u6599\u3011\n" + P.conf.refText.substring(0, 800) + (P.conf.refText.length > 800 ? "..." : "") + "\n";
        }else if(gameMode === 'light_hist'){
          contextPrompt += "\u8F7B\u5EA6\u53F2\u5B9E\u6A21\u5F0F\uFF0C\u5927\u4F53\u7B26\u5408\u5386\u53F2\u5373\u53EF\u3002\n";
        }else{
          contextPrompt += "\u6F14\u4E49\u6A21\u5F0F\uFF0C\u53EF\u81EA\u7531\u53D1\u6325\u3002\n";
        }

        contextPrompt += "\n\u3010\u4EFB\u52A1\u3011\u8BF7\u57FA\u4E8E\u4EE5\u4E0A\u5B8C\u6574\u7684\u5267\u672C\u6570\u636E\uFF0C\u7EFC\u5408\u8003\u8651\u6240\u6709\u89D2\u8272\u3001\u52BF\u529B\u3001\u4E16\u754C\u8BBE\u5B9A\uFF0C\u751F\u6210\u4E00\u6BB5400\u5B57\u7684\u5F00\u573A\u767D\u3002\u76F4\u63A5\u8F93\u51FA\u6587\u672C\uFF0C\u4E0D\u8981\u5305\u542B\u4EFB\u4F55\u5176\u4ED6\u5185\u5BB9\u3002";

        sc.opening=await callAISmart(contextPrompt, 2000, {minLength: 300, maxRetries: 3});

      // 历史检查环节（轻度和严格模式）
      if((P.conf.gameMode === 'light_hist' || P.conf.gameMode === 'strict_hist') && sc.opening && sc.opening.length > 50){
        showLoading("\u5386\u53F2\u68C0\u67E5\u4E2D...",92);
        try{
          var yearRange = P.conf.gameMode === 'strict_hist' ? 100 : 200;
          var histCheckPrompt = "\u4F60\u662F\u5386\u53F2\u987E\u95EEAI\u3002\u8BF7\u68C0\u67E5\u4EE5\u4E0B\u5F00\u573A\u767D\u662F\u5426\u5B58\u5728\u660E\u663E\u7684\u53F2\u5B9E\u9519\u8BEF\uFF08\u5982\u4EBA\u7269\u5E74\u4EE3\u9519\u8BEF\u3001\u4E8B\u4EF6\u987A\u5E8F\u9519\u8BEF\u3001\u5730\u7406\u9519\u8BEF\u7B49\uFF09\u3002\n\n"+
            "\u3010\u5267\u672C\u8BBE\u5B9A\u3011\n\u540D\u79F0\uFF1A"+sc.name+"\n\u65F6\u4EE3\uFF1A"+sc.era+"\n\u89D2\u8272\uFF1A"+sc.role+"\n\n"+
            "\u3010\u5F00\u573A\u767D\u3011\n"+sc.opening+"\n\n"+
            "\u8BF7\u8FD4\u56DEJSON\u683C\u5F0F\uFF1A{\"hasErrors\":true/false,\"errorCount\":0,\"errors\":[\"\u9519\u8BEF\u63CF\u8FF0\"],\"correctedText\":\"\u4FEE\u6B63\u540E\u7684\u5F00\u573A\u767D\"}\u3002\u5982\u679C\u6CA1\u6709\u9519\u8BEF\uFF0ChasErrors\u4E3Afalse\uFF0CcorrectedText\u4E3A\u7A7A\u3002";

          var histCheckResult = await callAISmart(histCheckPrompt, 2000, {maxRetries: 2});
          var histCheck = JSON.parse(histCheckResult.replace(/```json|```/g,"").trim());

          if(histCheck.hasErrors && histCheck.correctedText){
            sc.opening = histCheck.correctedText;
            _dbg('[\u5386\u53F2\u68C0\u67E5] \u5F00\u573A\u767D\u53D1\u73B0\u5E76\u4FEE\u6B63\u4E86 ' + (histCheck.errorCount || histCheck.errors.length) + ' \u5904\u53F2\u5B9E\u9519\u8BEF');
            if(histCheck.errors && histCheck.errors.length > 0){
              _dbg('[\u5386\u53F2\u68C0\u67E5] \u9519\u8BEF\u8BE6\u60C5\uFF1A', histCheck.errors);
            }
          }
        }catch(e){
          console.error('[\u5386\u53F2\u68C0\u67E5] \u5F00\u573A\u767D\u68C0\u67E5\u5931\u8D25\uFF1A', e);
        }
      }
    }catch(e){
      console.error('[AI生成开场白] 失败：', e);
    }
  }
  }

    // 7. AI 最终统筹总结（可选，不影响游戏启动）
    if(P.ai.key){
      showLoading("AI\u6700\u7EC8\u7EDF\u7B79\u603B\u7ED3...",88);
      try{
        // 构建统筹提示，让 AI 确认所有数据已正确加载
        var summaryPrompt = "\u4F60\u662FAI\u4E16\u754C\u914D\u7F6E\u7CFB\u7EDF\u3002\u8BF7\u7528\u4E00\u53E5\u8BDD\uFF0815\u5B57\u4EE5\u5185\uFF09\u786E\u8BA4\u4E16\u754C\u914D\u7F6E\u5B8C\u6210\u3002\u76F4\u63A5\u8F93\u51FA\u786E\u8BA4\u4FE1\u606F\uFF0C\u4E0D\u8981JSON\u683C\u5F0F\u3002";

        var summaryResult = await callAISmart(summaryPrompt, 50, {maxRetries: 1});
        _dbg('[AI统筹总结] ' + summaryResult);
      }catch(e){
        _dbg('[AI统筹总结] 跳过：', e);
      }
    }

  // 第三阶段：历史检查（轻度和严格模式）
  if((P.conf.gameMode === 'light_hist' || P.conf.gameMode === 'strict_hist') && sc.opening && sc.opening.length > 50){
    showLoading("\u5386\u53F2\u68C0\u67E5\u4E2D...",92);
    try{
      var yearRange = P.conf.gameMode === 'strict_hist' ? 100 : 200;
      var histCheckPrompt = "\u4F60\u662F\u5386\u53F2\u987E\u95EEAI\u3002\u8BF7\u68C0\u67E5\u4EE5\u4E0B\u5F00\u573A\u767D\u662F\u5426\u5B58\u5728\u660E\u663E\u7684\u53F2\u5B9E\u9519\u8BEF\uFF08\u5982\u4EBA\u7269\u5E74\u4EE3\u9519\u8BEF\u3001\u4E8B\u4EF6\u987A\u5E8F\u9519\u8BEF\u3001\u5730\u7406\u9519\u8BEF\u7B49\uFF09\u3002\n\n"+
        "\u3010\u5267\u672C\u8BBE\u5B9A\u3011\n\u540D\u79F0\uFF1A"+sc.name+"\n\u65F6\u4EE3\uFF1A"+sc.era+"\n\u89D2\u8272\uFF1A"+sc.role+"\n\n"+
        "\u3010\u5F00\u573A\u767D\u3011\n"+sc.opening+"\n\n"+
        "\u8BF7\u8FD4\u56DEJSON\u683C\u5F0F\uFF1A{\"hasErrors\":true/false,\"errorCount\":0,\"errors\":[\"\u9519\u8BEF\u63CF\u8FF0\"],\"correctedText\":\"\u4FEE\u6B63\u540E\u7684\u5F00\u573A\u767D\"}\u3002\u5982\u679C\u6CA1\u6709\u9519\u8BEF\uFF0ChasErrors\u4E3Afalse\uFF0CcorrectedText\u4E3A\u7A7A\u3002";

      var histCheckResult = await callAISmart(histCheckPrompt, 2000, {maxRetries: 2});
      var histCheck = JSON.parse(histCheckResult.replace(/```json|```/g,"").trim());

      if(histCheck.hasErrors && histCheck.correctedText){
        sc.opening = histCheck.correctedText;
        _dbg('[\u5386\u53F2\u68C0\u67E5] \u5F00\u573A\u767D\u53D1\u73B0\u5E76\u4FEE\u6B63\u4E86 ' + (histCheck.errorCount || histCheck.errors.length) + ' \u5904\u53F2\u5B9E\u9519\u8BEF');
        if(histCheck.errors && histCheck.errors.length > 0){
          _dbg('[\u5386\u53F2\u68C0\u67E5] \u9519\u8BEF\u8BE6\u60C5\uFF1A', histCheck.errors);
        }
      }
    }catch(e){
      console.error('[\u5386\u53F2\u68C0\u67E5] \u5F00\u573A\u767D\u68C0\u67E5\u5931\u8D25\uFF1A', e);
    }
  }

  // 第四阶段：完成初始化
  showLoading("\u521D\u59CB\u5316\u5B8C\u6210",95);
  await new Promise(function(r){setTimeout(r,300);});
  showLoading("\u51C6\u5907\u5C31\u7EEA",100);
  await new Promise(function(r){setTimeout(r,200);});

  hideLoading();

  // 开场白动画
  // 开场文本兜底：如果没有opening，用overview前200字
  if (!sc.opening || sc.opening.length <= 20) {
    if (sc.overview && sc.overview.length > 30) {
      sc.opening = sc.overview.substring(0, 200) + (sc.overview.length > 200 ? '...' : '');
    }
  }
  if(sc.opening&&sc.opening.length>20){
    var overlay=document.createElement("div");
    overlay.style.cssText="position:fixed;inset:0;z-index:995;background:radial-gradient(ellipse at 50% 30%,rgba(138,109,27,0.06),transparent 60%),var(--bg-0);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem;";
    overlay.innerHTML="<div style=\"font-size:2.2rem;font-weight:900;letter-spacing:0.2em;background:linear-gradient(135deg,var(--gold-d),var(--gold),var(--gold-l));-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:0.8rem;opacity:0;animation:fi 1.5s ease forwards;\">"+sc.name+"</div>"
      +"<div style=\"font-size:0.88rem;color:var(--txt-d);margin-bottom:0.5rem;letter-spacing:0.4em;opacity:0;animation:fi 1.5s 0.3s ease forwards;\">"+sc.era+"</div>"
      +"<div style=\"width:200px;height:1px;background:linear-gradient(90deg,transparent,var(--gold-d),var(--gold),var(--gold-d),transparent);margin-bottom:1.5rem;opacity:0;animation:fi 1s 0.8s ease forwards;\"></div>"
      +"<div style=\"max-width:650px;max-height:65vh;overflow-y:auto;padding:1.5rem 2rem;border:1px solid var(--gold-d);border-radius:2px;background:linear-gradient(160deg,var(--bg-1),var(--bg-0));box-shadow:0 0 40px rgba(138,109,27,0.08),inset 0 0 30px rgba(0,0,0,0.3);position:relative;\">"
      +"<div style=\"position:absolute;top:-1px;left:-1px;width:14px;height:14px;border-top:2px solid var(--gold);border-left:2px solid var(--gold);\"></div>"
      +"<div style=\"position:absolute;top:-1px;right:-1px;width:14px;height:14px;border-top:2px solid var(--gold);border-right:2px solid var(--gold);\"></div>"
      +"<div style=\"position:absolute;bottom:-1px;left:-1px;width:14px;height:14px;border-bottom:2px solid var(--gold);border-left:2px solid var(--gold);\"></div>"
      +"<div style=\"position:absolute;bottom:-1px;right:-1px;width:14px;height:14px;border-bottom:2px solid var(--gold);border-right:2px solid var(--gold);\"></div>"
      +"<div id=\"opening-text\" style=\"font-size:1.05rem;line-height:2.2;color:var(--txt);white-space:pre-wrap;text-indent:2em;\"></div>"
      +"</div>"
      +"<button onclick=\"this.parentElement.remove();doActualStart('"+sid+"');\" style=\"position:fixed;bottom:2rem;right:2rem;padding:0.6rem 1.5rem;border:1px solid var(--gold-d);background:rgba(0,0,0,0.6);color:var(--gold);border-radius:8px;cursor:pointer;font-family:inherit;font-size:0.9rem;z-index:996;backdrop-filter:blur(4px);\">\u25B6 \u8DF3\u8FC7</button>";
    document.body.appendChild(overlay);

    // 逐字显示——先将所有字符作为不可见span预渲染（锁定layout），再逐个切换为可见
    // 这样避免逐字添加导致的行重排抖动
    var textEl=overlay.querySelector("#opening-text");
    var fullText=sc.opening;
    // 预渲染：每个字符一个span，初始不可见（保留空间）
    var _html = '';
    for (var _ci = 0; _ci < fullText.length; _ci++) {
      var _ch = fullText.charAt(_ci);
      if (_ch === '\n') { _html += '<br>'; continue; }
      // 用 visibility:hidden 保留布局空间但不显示
      _html += '<span class="_ot-ch" style="visibility:hidden;">' + (_ch === ' ' ? '&nbsp;' : (_ch === '<' ? '&lt;' : _ch === '>' ? '&gt;' : _ch === '&' ? '&amp;' : _ch)) + '</span>';
    }
    textEl.innerHTML = _html;
    var _spans = textEl.querySelectorAll('._ot-ch');
    var charIdx=0;
    var timer=setInterval(function(){
      if(charIdx>=_spans.length||!overlay.parentElement){clearInterval(timer);
        if(overlay.parentElement){setTimeout(function(){if(overlay.parentElement){overlay.remove();doActualStart(sid);}},2000);}return;}
      // 批量显示（每次显示1个字符即可，layout已锁定不再抖动）
      if (_spans[charIdx]) _spans[charIdx].style.visibility = 'visible';
      charIdx++;
    },50);

    // Enter跳过——先显示全部，再等再按一次跳过
    var _allShown = false;
    var skipHandler=function(e){
      if(e.key==="Enter"||e.key===" "){
        e.preventDefault();
        if (!_allShown) {
          // 第一次按：显示全部字符
          clearInterval(timer);
          for (var _si = 0; _si < _spans.length; _si++) _spans[_si].style.visibility = 'visible';
          _allShown = true;
        } else {
          // 第二次按：跳过整个开场
          if(overlay.parentElement){overlay.remove();doActualStart(sid);}
          document.removeEventListener("keydown",skipHandler);
        }
      }
    };
    document.addEventListener("keydown",skipHandler);
  }else{
    doActualStart(sid);
  }
};

function doActualStart(sid){
  showLoading('\u52A0\u8F7D\u5267\u672C\u914D\u7F6E...', 5);
  // 应用难度设置
  if (window._pendingDifficulty) {
    if (!P.conf) P.conf = {};
    P.conf.difficulty = window._pendingDifficulty;
    delete window._pendingDifficulty;
  }
  // 初始化GM（完整版，包含所有必要属性）
  var sc=findScenarioById(sid);
  var _prevSaveName=GM.saveName||'';GM={running:true,sid:sid,turn:1,vars:{},rels:{},chars:[],facs:[],items:[],armies:[],evtLog:[],conv:[],busy:false,memorials:[],qijuHistory:[],jishiRecords:[],biannianItems:[],officeTree:P.officeTree?deepClone(P.officeTree):[],wenduiTarget:null,wenduiHistory:{},officeChanges:[],shijiHistory:[],allCharacters:[],classes:[],parties:[],techTree:[],civicTree:[],autoSummary:"",summarizedTurns:[],currentDay:0,eraName:"",eraNames:[],eraState:sc.eraState?deepClone(sc.eraState):(P.eraState?deepClone(P.eraState):{politicalUnity:0.7,centralControl:0.6,legitimacySource:'hereditary',socialStability:0.6,economicProsperity:0.6,culturalVibrancy:0.7,bureaucracyStrength:0.6,militaryProfessionalism:0.5,landSystemType:'mixed',dynastyPhase:'peak',contextDescription:''}),taxPressure:52,playerAbilities:{management:0,military:0,scholarship:0,politics:0},currentIssues:[],pendingConsequences:[],memoryAnchors:[],provinceStats:{},playerPendingTasks:[],playerCharacterId:null,npcContext:null,turnChanges:{variables:[],characters:[],factions:[],parties:[],classes:[],military:[],map:[]},_listeners:{},_changeQueue:[],triggeredHistoryEvents:{},rigidTriggers:{},offendGroupScores:{},activeRebounds:[],triggeredOffendEvents:{},_indices:null,postSystem:null,mapData:null,eraStateHistory:[],factionRelations:[],factionEvents:[],_tyrantDecadence:0,_tyrantHistory:[],_varMapping:null,stateTreasury:0,privateTreasury:0,_bankruptcyTurns:0,enYuanRecords:[],patronNetwork:[],activeSchemes:[],schemeCooldowns:{},eventCooldowns:{},yearlyChronicles:[],activeBattles:[],battleHistory:[],_turnBattleResults:[],activeWars:[],treaties:[],marchOrders:[],activeSieges:[],_rngCheckpoints:[]};if(_prevSaveName)GM.saveName=_prevSaveName;

  // 根据era智能推断eraState缺失字段（当剧本未定义eraState时使用合理默认值）
  if (!sc.eraState && sc.era && GM.eraState) {
    var _era = sc.era || '';
    // 根据剧本名称/背景推断是否为衰落期
    var _bg = (sc.background || '') + (sc.name || '') + (sc.desc || '');
    if (_bg.indexOf('末') >= 0 || _bg.indexOf('衰') >= 0 || _bg.indexOf('亡') >= 0 || _bg.indexOf('挽') >= 0 || _bg.indexOf('困') >= 0) {
      GM.eraState.dynastyPhase = 'decline';
      GM.eraState.socialStability = 0.35;
      GM.eraState.economicProsperity = 0.3;
      GM.eraState.centralControl = 0.3;
    }
    // 秦/隋等短命统一王朝：高集权
    if (_era.indexOf('秦') >= 0 || _era.indexOf('隋') >= 0) {
      GM.eraState.centralControl = 0.9;
      GM.eraState.landSystemType = 'junxian';
    }
    // 南渡/偏安：低统一度
    if (_bg.indexOf('南渡') >= 0 || _bg.indexOf('偏安') >= 0 || _era.indexOf('南宋') >= 0 || _era.indexOf('东晋') >= 0) {
      GM.eraState.politicalUnity = 0.3;
    }
  }

  // 从剧本加载目标/得罪群体/科举配置
  if (sc.goals && sc.goals.length > 0) P.goals = deepClone(sc.goals);
  if (sc.offendGroups) P.offendGroups = deepClone(sc.offendGroups);
  if (sc.keju) P.keju = deepClone(sc.keju);
  if (sc.playerInfo) P.playerInfo = deepClone(sc.playerInfo);

  // 初始皇命（钉子条目 + 隐藏天机）写入 12 表系统的 imperialEdict（玩家锁·AI 永读不写）
  if (sc.imperialEdicts && sc.imperialEdicts.length > 0 && window.MemTables) {
    try {
      MemTables.ensureInit();
      sc.imperialEdicts.forEach(function(e) {
        MemTables.editorWrite('imperialEdict', 'insert', {
          values: {
            0: String(e.priority || 5),
            1: String(e.content || ''),
            2: String(e.condition || '永久生效'),
            3: String(e.startTurn || 1),
            4: e.secret ? 'true' : ''
          }
        });
      });
    } catch(_ieE) { console.warn('[ImperialEdict] 初始皇命同步失败:', _ieE); }
  }

  // 加载时字段自动补全（防止旧剧本缺少新字段导致崩溃）
  if (!GM.characterArcs) GM.characterArcs = {};
  if (!GM.playerDecisions) GM.playerDecisions = [];
  if (!GM.memoryArchive) GM.memoryArchive = [];
  if (!GM.chronicleAfterwords) GM.chronicleAfterwords = [];
  if (!GM.customPolicies) GM.customPolicies = [];
  if (!GM.affinityMap) GM.affinityMap = {};
  if (!GM._rngState) initRng(sid + '_' + Date.now());

  // 重置全局系统状态（防止上一局数据残留）
  if (typeof ChronicleSystem !== 'undefined') ChronicleSystem.reset();
  if (typeof WarWeightSystem !== 'undefined') WarWeightSystem._truces = {};

  // 加载经济配置
  if (sc.economyConfig) {
    P.economyConfig = deepClone(sc.economyConfig);
  } else if (!P.economyConfig) {
    P.economyConfig = {
      redistributionRate: 0.3,
      baseIncome: 100
    };
  }

  // 加载岗位系统配置
  if (sc.postSystem) {
    GM.postSystem = deepClone(sc.postSystem);
  } else {
    GM.postSystem = {
      enabled: false,
      posts: []
    };
  }
  // A1: 从postRules自动生成实际posts（如果posts为空但有rules）
  if (GM.postSystem && GM.postSystem.postRules && GM.postSystem.postRules.length > 0 && (!GM.postSystem.posts || GM.postSystem.posts.length === 0)) {
    GM.postSystem.posts = [];
    GM.postSystem.postRules.forEach(function(rule) {
      var post = {
        id: 'post_' + (rule.positionName || '').replace(/\s/g, '_') + '_' + Date.now() + '_' + randInt(0, 999),
        name: rule.positionName || rule.name || '',
        territoryId: '',
        territoryName: '',
        holder: '',
        rank: rule.rank || 5,
        salary: rule.salary || 0,
        authority: [],
        requirements: {},
        appointedTurn: 0,
        term: 0,
        performance: 0,
        status: 'vacant',
        // 保留postRule的元数据供AI参考
        succession: rule.succession || 'appointment',
        hasAppointmentRight: rule.hasAppointmentRight || false,
        ruleDescription: rule.description || ''
      };
      // 从rule推断authority
      if (rule.succession === 'military') post.authority = ['military'];
      if (rule.hasAppointmentRight) post.authority.push('personnel');
      GM.postSystem.posts.push(post);
    });
    _dbg('[PostSystem] 从 ' + GM.postSystem.postRules.length + ' 条规则生成 ' + GM.postSystem.posts.length + ' 个岗位');
  }

  var _gs=(typeof sc!=="undefined"&&sc.gameSettings)||{};
  P.gameSettings = _gs; // 保存到P供运行时系统查询enabledSystems
  if(_gs.eraName)GM.eraName=_gs.eraName;
  if(_gs.eraNames&&_gs.eraNames.length)GM.eraNames=_gs.eraNames.slice();

  // 加载完整的时间配置
  if(sc.time){
    P.time = deepClone(sc.time);
  } else {
    // 从 gameSettings 加载部分时间配置（兼容旧版本）
    if(_gs.startMonth)P.time.startMonth=_gs.startMonth;
    if(_gs.startDay)P.time.startDay=_gs.startDay;
    if(_gs.startYear!==undefined)P.time.year=_gs.startYear;
  }
  // 优先使用剧本元数据的startYear（如果time配置中没有设置）
  if(sc.startYear && !P.time.year) P.time.year = sc.startYear;
  // 从gameSettings映射turnDuration/turnUnit到P.time.perTurn
  if (_gs.turnUnit && !P.time.perTurn) {
    var _unitMap = {'\u65E5':'1d','\u5468':'1w','\u6708':'1m','\u5B63':'1s','\u5E74':'1y'};
    P.time.perTurn = _unitMap[_gs.turnUnit] || '1m';
    if (_gs.turnDuration && _gs.turnDuration > 1) {
      P.time.customDays = _gs.turnDuration * ({'\u65E5':1,'\u5468':7,'\u6708':30,'\u5B63':90,'\u5E74':360}[_gs.turnUnit] || 30);
    }
  }
  // 从gameSettings映射干支和年号设置
  if (_gs.enableGanzhi !== undefined) P.time.enableGanzhi = _gs.enableGanzhi;
  if (_gs.enableGanzhiDay !== undefined) P.time.enableGanzhiDay = _gs.enableGanzhiDay;
  if (_gs.enableEraName !== undefined) P.time.enableEraName = _gs.enableEraName;
  if (_gs.eraNames && _gs.eraNames.length > 0 && (!P.time.eraNames || P.time.eraNames.length === 0)) {
    P.time.eraNames = deepClone(_gs.eraNames);
  }
  // dynastyPhaseHint → GM.eraState.dynastyPhase（如果eraState未显式设置phase）
  if(sc.dynastyPhaseHint && GM.eraState && (!GM.eraState.dynastyPhase || GM.eraState.dynastyPhase === 'peak')) {
    GM.eraState.dynastyPhase = sc.dynastyPhaseHint;
  }

  // 加载剧本的其他配置到 P 对象
  if(sc.military) P.military = deepClone(sc.military);
  if(sc.rules) P.rules = deepClone(sc.rules);
  if(sc.timeline) P.timeline = deepClone(sc.timeline);
  if(sc.map) P.map = deepClone(sc.map);
  if(sc.worldSettings) P.worldSettings = deepClone(sc.worldSettings);
  if(sc.government) P.government = deepClone(sc.government);
  if(sc.adminHierarchy) P.adminHierarchy = deepClone(sc.adminHierarchy);
  if(sc.officeTree) P.officeTree = deepClone(sc.officeTree);
  if(sc.officeConfig) P.officeConfig = deepClone(sc.officeConfig);
  // 官制数据源优先级：government.nodes（编辑器主数据，含holder）> officeTree（旧兜底）
  if (P.government && P.government.nodes && P.government.nodes.length > 0) {
    var _govHasHolders = false;
    (function _chk(ns) { ns.forEach(function(n) { if (n.positions) n.positions.forEach(function(p) { if (p.holder) _govHasHolders = true; }); if (n.subs) _chk(n.subs); }); })(P.government.nodes);
    if (_govHasHolders || !P.officeTree || P.officeTree.length === 0) {
      P.officeTree = deepClone(P.government.nodes);
      _dbg('[Office] 使用 government.nodes 作为官制数据源' + (_govHasHolders ? '（含任职者）' : ''));
    }
  }
  // 同步到 GM
  if(P.officeTree && P.officeTree.length>0) GM.officeTree = deepClone(P.officeTree);
  if(sc.techTree) P.techTree = deepClone(sc.techTree);
  if(sc.civicTree) P.civicTree = deepClone(sc.civicTree);
  if(sc.variables) P.variables = deepClone(sc.variables);
  // 规范化变量：保留元数据（unit, calcMethod, components, category），分离公式
  if(P.variables && !Array.isArray(P.variables)){
    var _fv=[];
    if(P.variables.base) P.variables.base.forEach(function(v){ v._category='base'; _fv.push(v); });
    if(P.variables.other) P.variables.other.forEach(function(v){ v._category='other'; _fv.push(v); });
    // 公式单独存储到 P._varFormulas（不混入变量数组）
    P._varFormulas = P.variables.formulas || [];
    P.variables=_fv;
  }
  if(!P._varFormulas) P._varFormulas = [];
  if(P.techTree && !Array.isArray(P.techTree)){var _ft=[];if(P.techTree.military)_ft=_ft.concat(P.techTree.military);if(P.techTree.civil)_ft=_ft.concat(P.techTree.civil);P.techTree=_ft;}
  if(P.civicTree && !Array.isArray(P.civicTree)){var _fc=[];if(P.civicTree.city)_fc=_fc.concat(P.civicTree.city);if(P.civicTree.policy)_fc=_fc.concat(P.civicTree.policy);if(P.civicTree.resource)_fc=_fc.concat(P.civicTree.resource);if(P.civicTree.corruption)_fc=_fc.concat(P.civicTree.corruption);P.civicTree=_fc;}
  // rules保持对象格式{base,combat,economy,diplomacy}——这是文本规则描述，供AI推演参考
  // 不转为数组（旧版兼容：如果rules已经是数组则保持）
  if(sc.openingText) P.openingText = sc.openingText;
  if(sc.globalRules) P.globalRules = sc.globalRules;
  if(sc.mapData) P.mapData = deepClone(sc.mapData);
  if(sc.buildingSystem) P.buildingSystem = deepClone(sc.buildingSystem);
  if(sc.battleConfig) P.battleConfig = deepClone(sc.battleConfig);
  if(sc.mechanicsConfig) { if(!P.mechanicsConfig) P.mechanicsConfig={}; Object.assign(P.mechanicsConfig, deepClone(sc.mechanicsConfig)); }
  if(sc.militaryConfig) P.militaryConfig = deepClone(sc.militaryConfig);
  // 加载初始恩怨/门生到GM
  if (sc.initialEnYuan && sc.initialEnYuan.length > 0 && typeof EnYuanSystem !== 'undefined') {
    sc.initialEnYuan.forEach(function(ey) {
      EnYuanSystem.add(ey.type, ey.from, ey.to, ey.强度||1, ey.事由||'', ey.不共戴天||false);
    });
  }
  if (sc.initialPatronNetwork && sc.initialPatronNetwork.length > 0 && typeof PatronNetwork !== 'undefined') {
    sc.initialPatronNetwork.forEach(function(pn) {
      PatronNetwork.establish(pn.座主, pn.门生, pn.关系类型||'座主门生', pn.亲密度||60);
    });
  }
  if(sc.adminConfig) P.adminConfig = deepClone(sc.adminConfig);
  if(sc.chronicleConfig) P.chronicleConfig = deepClone(sc.chronicleConfig);
  if(sc.eventConstraints) P.eventConstraints = deepClone(sc.eventConstraints);
  if(sc.warConfig) P.warConfig = deepClone(sc.warConfig);
  if(sc.diplomacyConfig) P.diplomacyConfig = deepClone(sc.diplomacyConfig);
  if(sc.schemeConfig) P.schemeConfig = deepClone(sc.schemeConfig);
  if(sc.decisionConfig) P.decisionConfig = deepClone(sc.decisionConfig);
  if(sc.vassalSystem) P.vassalSystem = deepClone(sc.vassalSystem);
  if(sc.titleSystem) P.titleSystem = deepClone(sc.titleSystem);
  if(sc.officialVassalMapping) P.officialVassalMapping = deepClone(sc.officialVassalMapping);

  // 加载剧本的角色、势力、党派、阶层等数据到 P 对象
  if(sc.characters) {
    // 移除旧的该剧本的角色，添加新的
    P.characters = (P.characters||[]).filter(function(c){return c.sid!==sid;});
    P.characters = P.characters.concat(sc.characters.map(function(c){c.sid=sid;return c;}));
  }
  if(sc.factions) {
    P.factions = (P.factions||[]).filter(function(f){return f.sid!==sid;});
    P.factions = P.factions.concat(sc.factions.map(function(f){f.sid=sid;return f;}));
  }
  if(sc.parties) {
    P.parties = (P.parties||[]).filter(function(p){return p.sid!==sid;});
    P.parties = P.parties.concat(sc.parties.map(function(p){p.sid=sid;return p;}));
  }
  if(sc.classes) {
    P.classes = (P.classes||[]).filter(function(c){return c.sid!==sid;});
    P.classes = P.classes.concat(sc.classes.map(function(c){c.sid=sid;return c;}));
  }
  if(sc.items) {
    P.items = (P.items||[]).filter(function(i){return i.sid!==sid;});
    P.items = P.items.concat(sc.items.map(function(i){i.sid=sid;return i;}));
  }
  if(sc.relations) {
    P.relations = (P.relations||[]).filter(function(r){return r.sid!==sid;});
    P.relations = P.relations.concat(sc.relations.map(function(r){r.sid=sid;return r;}));
  }

  if(sc.events) {
    var allEvents = [];
    if(sc.events.historical) allEvents = allEvents.concat(sc.events.historical.map(function(e){e.sid=sid;e.type='historical';return e;}));
    if(sc.events.random) allEvents = allEvents.concat(sc.events.random.map(function(e){e.sid=sid;e.type='random';return e;}));
    if(sc.events.conditional) allEvents = allEvents.concat(sc.events.conditional.map(function(e){e.sid=sid;e.type='conditional';return e;}));
    if(sc.events.story) allEvents = allEvents.concat(sc.events.story.map(function(e){e.sid=sid;e.type='story';return e;}));
    if(sc.events.chain) allEvents = allEvents.concat(sc.events.chain.map(function(e){e.sid=sid;e.type='chain';return e;}));
    // 移除旧的该剧本的事件，添加新的
    P.events = (P.events||[]).filter(function(e){return e.sid!==sid;});
    P.events = P.events.concat(allEvents);
  }

  // 加载变量到GM.vars——保留编辑者写的所有字段，不假设任何固定格式
  (P.variables||[]).forEach(function(v){
    if(v.sid && v.sid!==sid) return;
    if(!v.name) return; // 至少要有名字
    var gv = deepClone(v);
    // 推断数值：尝试多种可能的字段名
    if(gv.value === undefined) {
      gv.value = parseFloat(gv.defaultValue) || parseFloat(gv.initial) || parseFloat(gv.default) || 0;
    }
    gv.value = parseFloat(gv.value) || 0;
    // min/max：有就用，没有就智能推断
    if(gv.min === undefined && gv.minimum !== undefined) gv.min = gv.minimum;
    if(gv.max === undefined && gv.maximum !== undefined) gv.max = gv.maximum;
    if(gv.min === undefined) gv.min = 0;
    if(gv.max === undefined) gv.max = Math.max(100, Math.abs(gv.value) * 10);
    gv.min = parseFloat(gv.min) || 0;
    gv.max = parseFloat(gv.max) || 100;
    if(gv.max <= gv.min) gv.max = gv.min + 100;
    GM.vars[gv.name] = gv;
  });
  // 存储公式/关联规则供AI参考（不做程序层面的计算）
  GM._varFormulas = P._varFormulas || [];
  (P.relations||[]).filter(function(r){return r.sid===sid;}).forEach(function(r){GM.rels[r.name]=deepClone(r);});
  // 加载势力间关系矩阵
  GM.factionRelations = deepClone(sc.factionRelations || P.factionRelations || []);
  GM.chars=(P.characters||[]).filter(function(c){return c.sid===sid;}).map(function(c){return deepClone(c);});
  GM.facs=(P.factions||[]).filter(function(f){return f.sid===sid;}).map(function(f){
    var faction = deepClone(f);
    // 初始化封臣系统字段
    if (!faction.vassals) faction.vassals = [];
    if (!faction.liege) faction.liege = null;
    if (!faction.tributeRate) faction.tributeRate = 0.3;
    if (!faction.territories) faction.territories = [];
    return faction;
  });
  GM.items=(P.items||[]).filter(function(t){return t.sid===sid;}).map(function(t){var c=deepClone(t);c.acquired=false;return c;});
  // 军队加载：优先 initialTroops（编辑器新 schema 完整部队表），armies 仅作兜底（旧字段通常只有少量代表部队）
  var _initTroops = (P.military && P.military.initialTroops) || [];
  var _legacyArmies = (P.military && P.military.armies) || [];
  var _rawArmies = (_initTroops.length > 0) ? _initTroops : _legacyArmies;
  GM.armies = _rawArmies.filter(function(a) { return !a.sid || a.sid === sid; }).map(function(a) {
    var army = deepClone(a);
    // 字段兼容映射
    if (army.size && !army.soldiers) army.soldiers = parseInt(army.size) || 1000;
    if (army.strength && !army.soldiers) army.soldiers = parseInt(army.strength) || 1000;
    if (!army.soldiers) army.soldiers = 1000;
    if (army.location && !army.garrison) army.garrison = army.location;
    // 兼容旧文本格式 composition → 结构化
    if (typeof army.composition === 'string' && army.composition) {
      army.composition = [{type: army.composition, count: army.soldiers}];
    }
    // 兼容旧文本格式 salary → 结构化
    if (typeof army.salary === 'string' && army.salary) {
      army.salary = [{resource: army.salary, amount: 0, unit: ''}];
    }
    // 兼容旧装备格式 quota/actual → count/condition
    if (army.equipment && Array.isArray(army.equipment)) {
      army.equipment.forEach(function(eq) {
        if (eq.actual !== undefined && eq.count === undefined) eq.count = eq.actual;
        if (eq.note && !eq.condition) eq.condition = eq.note;
      });
    }
    return army;
  });
  // 应用编辑器预设的封臣关系
  if (P.vassalSystem && P.vassalSystem.vassalRelations && P.vassalSystem.vassalRelations.length > 0) {
    P.vassalSystem.vassalRelations.forEach(function(rel) {
      var vassalFac = GM.facs.find(function(f) { return f.name === rel.vassal; });
      var liegeFac = GM.facs.find(function(f) { return f.name === rel.liege; });
      if (vassalFac && liegeFac) {
        vassalFac.liege = rel.liege;
        vassalFac.tributeRate = rel.tributeRate || 0.3;
        if (rel.vassalType) vassalFac.vassalType = rel.vassalType;
        if (!liegeFac.vassals) liegeFac.vassals = [];
        if (liegeFac.vassals.indexOf(rel.vassal) === -1) liegeFac.vassals.push(rel.vassal);
        if (rel.loyalty !== undefined) {
          var vRuler = GM.chars.find(function(c) { return c.faction === rel.vassal && (c.position === '\u541B\u4E3B' || c.position === '\u9996\u9886'); });
          if (vRuler) vRuler.loyalty = rel.loyalty;
        }
      }
    });
  }
  // 应用编辑器预设的角色头衔
  if (P.titleSystem && P.titleSystem.characterTitles && P.titleSystem.characterTitles.length > 0) {
    P.titleSystem.characterTitles.forEach(function(ct) {
      var ch = GM.chars.find(function(c) { return c.name === ct.character; });
      if (ch) {
        if (!ch.titles) ch.titles = [];
        ch.titles.push({
          name: ct.titleName || '', level: ct.titleLevel || 5,
          hereditary: ct.hereditary || false, privileges: ct.privileges || [],
          _suppressed: [], grantedTurn: 0, grantedBy: '\u5F00\u5C40\u9884\u8BBE'
        });
      }
    });
  }

  GM.classes=(P.classes||[]).filter(function(c){return c.sid===sid;}).map(function(c){return deepClone(c);});
  GM.parties=(P.parties||[]).filter(function(p){return p.sid===sid;}).map(function(p){return deepClone(p);});
  GM.techTree=(P.techTree||[]).filter(function(t){return t.sid===sid;}).map(function(t){var c=deepClone(t);c.unlocked=false;return c;});
  GM.civicTree=(P.civicTree||[]).filter(function(c){return c.sid===sid;}).map(function(c){var cp=deepClone(c);cp.adopted=false;return cp;});
  GM.events=(P.events||[]).filter(function(e){return e.sid===sid;}).map(function(e){var ev=deepClone(e);if(ev.triggered===undefined)ev.triggered=false;return ev;});
  GM.allCharacters=GM.chars.map(function(c){return{name:c.name,title:c.title,age:c.age||"?",gender:c.gender||"\u7537",personality:c.personality,appearance:c.appearance,desc:c.desc,loyalty:c.loyalty,relationValue:c.loyalty,faction:c.faction,recruited:true,recruitTurn:0,source:"\u521D\u59CB",avatarUrl:""};});

  // 自动为旧角色匹配 traitIds + 初始化stress/goals
  if (GM.chars) {
    GM.chars.forEach(function(c) {
      if (typeof autoAssignTraitIds === 'function') autoAssignTraitIds(c);
      if (typeof validateTraits === 'function') validateTraits(c);
      if (typeof inferPersonalGoal === 'function') inferPersonalGoal(c);
      // 初始化压力值（若缺失）
      if (c.stress === undefined) c.stress = 0;
      // 初始化军事能力（若缺失，根据武勇和智力推算）
      if (c.military === undefined) {
        // 武将类角色军事偏高，文臣偏低，但都受智力修正
        var _valBase = c.valor || 50;
        var _intMod = ((c.intelligence || 50) - 50) * 0.3;
        c.military = Math.round(_valBase * 0.6 + _intMod + 20 + (random() - 0.5) * 20);
        c.military = clamp(c.military, 10, 95);
      }
      // 初始化政务能力（若缺失）
      if (c.administration === undefined) {
        c.administration = Math.round(((c.intelligence || 50) * 0.5 + 25) * (0.8 + random() * 0.4));
        c.administration = clamp(c.administration, 10, 95);
      }
      // 初始化魅力值（若缺失，根据已有属性推算）
      if (c.charisma === undefined) {
        c.charisma = Math.round(((c.intelligence || 50) + (c.loyalty || 50)) / 2 * (0.8 + random() * 0.4));
        c.charisma = clamp(c.charisma, 10, 95);
      }
      // 初始化外交值（若缺失，根据已有属性推算）
      if (c.diplomacy === undefined) {
        c.diplomacy = Math.round(((c.charisma || 50) + (c.intelligence || 50)) / 2 * (0.8 + random() * 0.4));
        c.diplomacy = clamp(c.diplomacy, 10, 95);
      }
      // 初始化家族（若缺失，从姓氏提取——开局后由AI丰富为郡望格式）
      if (!c.family) {
        var _nameStr = c.name || '';
        var _compSurnames = ['\u53F8\u9A6C','\u8BF8\u845B','\u4E0A\u5B98','\u6B27\u9633','\u7687\u752B','\u4EE4\u72D0','\u592A\u53F2','\u5B87\u6587','\u957F\u5B59','\u6148\u79A7','\u53F8\u5F92','\u7AEF\u6728','\u4E07\u4FDF','\u767E\u91CC','\u5C09\u8FDF','\u547C\u5EF6','\u5B8C\u989C','\u8D6B\u8FDE','\u72EC\u5B64','\u6155\u5BB9','\u62D3\u8DCB','\u5148\u8F9C','\u5CB3\u98DE','\u52A0\u5F00','\u4E2D\u5C71'];
        var _surname = '';
        for (var _si = 0; _si < _compSurnames.length; _si++) {
          if (_nameStr.indexOf(_compSurnames[_si]) === 0) { _surname = _compSurnames[_si]; break; }
        }
        if (!_surname && _nameStr.length >= 2) _surname = _nameStr.charAt(0);
        if (_surname) c.family = _surname + '\u6C0F';
      }
      // 初始化门第等级（若缺失）
      // familyTier: 'imperial'=皇族宗室 | 'noble'=世家大族 | 'gentry'=地方士族 | 'common'=寒门
      if (!c.familyTier) {
        if (c.isPlayer) c.familyTier = 'imperial';
        else if (c.title && /王|公|侯|伯/.test(c.title)) c.familyTier = 'noble';
        else c.familyTier = 'common'; // 默认寒门，开局后由AI丰富
      }
      // 初始化事件观感数组（若缺失）
      if (!c._eventOpinions) c._eventOpinions = [];
      // 初始化后宫/配偶字段（若缺失）
      // spouse: 是否为玩家配偶  spouseRank: 位份  children: 子女名  motherClan: 母族
      if (c.spouse === undefined) c.spouse = false;
      if (c.spouse && !c.spouseRank) c.spouseRank = 'consort';
      if (!c.children) c.children = [];
      if (!c.parentOf) c.parentOf = null; // 该角色是谁的子女
    });
  }

  // ── 标记玩家角色 & 玩家势力 ──
  (function _markPlayer() {
    var pi = P.playerInfo;
    if (!pi) return;
    var pName = (pi.characterName || '').trim();
    var fName = (pi.factionName || '').trim();

    // 1) 在 GM.chars 中找到玩家角色并标记 isPlayer
    if (pName && GM.chars) {
      var found = false;
      GM.chars.forEach(function(c) { c.isPlayer = false; }); // 先清除旧标记
      for (var _pi = 0; _pi < GM.chars.length; _pi++) {
        if (GM.chars[_pi].name === pName) {
          GM.chars[_pi].isPlayer = true;
          // 同步 playerInfo 的详细字段到角色对象（角色对象优先，playerInfo补缺）
          if (!GM.chars[_pi].age && pi.characterAge) GM.chars[_pi].age = pi.characterAge;
          if (!GM.chars[_pi].gender && pi.characterGender) GM.chars[_pi].gender = pi.characterGender;
          if (!GM.chars[_pi].personality && pi.characterPersonality) GM.chars[_pi].personality = pi.characterPersonality;
          if (!GM.chars[_pi].title && pi.characterTitle) GM.chars[_pi].title = pi.characterTitle;
          if (!GM.chars[_pi].faction && pi.characterFaction) GM.chars[_pi].faction = pi.characterFaction;
          if (!GM.chars[_pi].faction && fName) GM.chars[_pi].faction = fName;
          if (!GM.chars[_pi].bio && pi.characterBio) GM.chars[_pi].bio = pi.characterBio;
          if (!GM.chars[_pi].desc && pi.characterDesc) GM.chars[_pi].desc = pi.characterDesc;
          if (!GM.chars[_pi].faith && pi.characterFaith) GM.chars[_pi].faith = pi.characterFaith;
          if (!GM.chars[_pi].culture && pi.characterCulture) GM.chars[_pi].culture = pi.characterCulture;
          if (!GM.chars[_pi].appearance && pi.characterAppearance) GM.chars[_pi].appearance = pi.characterAppearance;
          if (!GM.chars[_pi].charisma && pi.characterCharisma) GM.chars[_pi].charisma = parseInt(pi.characterCharisma) || 60;
          found = true;
          break;
        }
      }
      // 角色列表中没有玩家角色 → 自动创建
      if (!found) {
        var newChar = {
          name: pName, title: pi.characterTitle || '', faction: pi.characterFaction || fName || '',
          age: pi.characterAge || '', gender: pi.characterGender || '男',
          personality: pi.characterPersonality || '', bio: pi.characterBio || '',
          desc: pi.characterDesc || '', faith: pi.characterFaith || '', culture: pi.characterCulture || '',
          appearance: pi.characterAppearance || '', charisma: parseInt(pi.characterCharisma) || 60,
          diplomacy: parseInt(pi.characterDiplomacy) || 50,
          loyalty: 100, morale: 80, ambition: 50, benevolence: 50, intelligence: 60, valor: 50,
          isPlayer: true, isHistorical: true, alive: true, stress: 0
        };
        GM.chars.push(newChar);
        GM.allCharacters.push({
          name: newChar.name, title: newChar.title, age: newChar.age || '?', gender: newChar.gender,
          personality: newChar.personality, desc: newChar.desc, loyalty: 100, faction: newChar.faction,
          recruited: true, recruitTurn: 0, source: '初始'
        });
      }
    }

    // 2) 在 GM.facs 中标记玩家势力
    if (fName && GM.facs) {
      for (var _fi = 0; _fi < GM.facs.length; _fi++) {
        if (GM.facs[_fi].name === fName) {
          GM.facs[_fi].isPlayer = true;
          // 补全势力字段
          if (!GM.facs[_fi].leader && pi.factionLeader) GM.facs[_fi].leader = pi.factionLeader;
          if (!GM.facs[_fi].desc && pi.factionDesc) GM.facs[_fi].desc = pi.factionDesc;
          break;
        }
      }
    }

    // 3) 设置 GM.playerCharacterId
    if (pName && GM.chars) {
      var pc = GM.chars.find(function(c) { return c.name === pName; });
      if (pc) GM.playerCharacterId = pc.id || pName;
    }
  })();

  // 初始化家族注册表
  if (!GM.families) GM.families = {};

  // 初始化后宫/继承系统数据
  if (!GM.harem) GM.harem = { heirs: [], succession: 'eldest_legitimate', pregnancies: [] };
  if (!GM.harem.pregnancies) GM.harem.pregnancies = [];
  // 从剧本加载后宫配置
  if (sc && sc.haremConfig) GM.harem = Object.assign(GM.harem, deepClone(sc.haremConfig));

  // ── 官制任职者自动匹配 ──
  // 角色的 title/officialTitle 与 officeTree.positions.holder 双向同步
  if (GM.officeTree && GM.officeTree.length > 0 && GM.chars && GM.chars.length > 0) {
    var _syncCount = 0;
    // 1) position有holder但角色没officialTitle → 设角色officialTitle
    // 2) position无holder但角色title匹配某职位名 → 填充holder
    (function _syncOffice(nodes) {
      nodes.forEach(function(dept) {
        (dept.positions || []).forEach(function(pos) {
          if (pos.holder) {
            // 职位已有人 → 确保该角色知道自己的官职
            var ch = GM.chars.find(function(c) { return c.name === pos.holder && c.alive !== false; });
            if (ch && !ch.officialTitle) {
              ch.officialTitle = pos.name;
              _syncCount++;
            }
          } else {
            // 职位空缺 → 从角色的title/officialTitle中寻找匹配
            var posName = pos.name || '';
            if (!posName) return;
            var matched = GM.chars.find(function(c) {
              if (c.alive === false) return false;
              // officialTitle精确匹配
              if (c.officialTitle && c.officialTitle === posName) return true;
              // title中包含职位名（如title="尚书令·xx"包含pos.name="尚书令"）
              if (c.title && c.title.indexOf(posName) >= 0) return true;
              // title直接就是职位名
              if (c.title && c.title === posName) return true;
              return false;
            });
            if (matched) {
              pos.holder = matched.name;
              if (!matched.officialTitle) matched.officialTitle = posName;
              _syncCount++;
            }
          }
        });
        if (dept.subs) _syncOffice(dept.subs);
      });
    })(GM.officeTree);
    if (_syncCount > 0) _dbg('[Office] 自动匹配官制任职者 ' + _syncCount + ' 处');
  }

  // 构建索引系统（性能优化）
  showLoading('\u6784\u5EFA\u7D22\u5F15...', 50);
  if(typeof buildIndices === 'function') buildIndices();

  // 初始化 AI 缓存系统
  if(typeof initAICache === 'function') initAICache();

  // 初始化 Unit 系统
  if (P.unitSystem && P.unitSystem.enabled && typeof initUnitSystem === 'function') {
    initUnitSystem();
  }

  // 初始化补给系统（可从battleConfig.supplyConfig或P.supplySystem触发）
  if (P.battleConfig && P.battleConfig.supplyConfig && P.battleConfig.supplyConfig.enabled) {
    if (!P.supplySystem) P.supplySystem = {};
    P.supplySystem.enabled = true;
  }
  if (P.supplySystem && P.supplySystem.enabled && typeof initSupplySystem === 'function') {
    initSupplySystem();
  }

  // 初始化建筑系统
  if (P.buildingSystem && P.buildingSystem.enabled && typeof initBuildingSystem === 'function') {
    showLoading('\u521D\u59CB\u5316\u5EFA\u7B51\u4E0E\u7ECF\u6D4E...', 70);
    initBuildingSystem();
  }

  // 初始化地图系统
  if(typeof initGameMap === 'function') initGameMap();
  // 构建邻接图（供行军/补给寻路使用）
  if(P.map && P.map.enabled && typeof buildAdjacencyGraph === 'function') buildAdjacencyGraph();

  // 初始化省级经济系统
  showLoading('\u521D\u59CB\u5316\u5730\u65B9\u533A\u5212...', 85);
  if(typeof initProvinceEconomy === 'function') initProvinceEconomy();

  // 初始化得罪群体系统
  if(typeof OffendGroupsSystem !== 'undefined' && OffendGroupsSystem.initialize) OffendGroupsSystem.initialize();

  // 初始化状态耦合系统
  if(typeof StateCouplingSystem !== 'undefined' && StateCouplingSystem.initialize) StateCouplingSystem.initialize();

  // 初始化集权回拨系统
  if(typeof CentralizationSystem !== 'undefined' && CentralizationSystem.initialize) CentralizationSystem.initialize();

  // 初始化领地产出系统
  if(typeof TerritoryProductionSystem !== 'undefined' && TerritoryProductionSystem.initialize) TerritoryProductionSystem.initialize();

  // 初始化职位系统
  if(typeof PositionSystem !== 'undefined' && PositionSystem.initialize) PositionSystem.initialize();

  // 初始化交互系统
  if(typeof InteractionSystem !== 'undefined' && InteractionSystem.initialize) InteractionSystem.initialize();

  // 初始化 NPC Engine
  if(typeof NpcEngine !== 'undefined' && NpcEngine.initialize) NpcEngine.initialize();

  _$("launch").style.display="none";_$("bar").style.display="flex";_$("bar-btns").innerHTML="";_$("G").style.display="grid";_$("E").style.display="none";
  _$("shiji-btn").classList.add("show");_$("save-btn").classList.add("show");

  GameHooks.run('startGame:after', sid);

  // 5.1: 剧本完整度预检（非阻断式警告）
  var _checkWarnings = [];
  if (!GM.chars || GM.chars.length < 3) _checkWarnings.push('\u89D2\u8272\u4E0D\u8DB3\uFF08\u5F53\u524D' + (GM.chars ? GM.chars.length : 0) + '\u4EBA\uFF0C\u5EFA\u8BAE\u22655\uFF09');
  if (!GM.chars || !GM.chars.some(function(c){return c.isPlayer;})) _checkWarnings.push('\u672A\u8BBE\u7F6E\u73A9\u5BB6\u89D2\u8272');
  if (!GM.facs || GM.facs.length === 0) _checkWarnings.push('\u672A\u8BBE\u7F6E\u52BF\u529B');
  if (!GM.vars || Object.keys(GM.vars).length === 0) _checkWarnings.push('\u672A\u5B9A\u4E49\u53D8\u91CF\uFF08\u56FD\u5E93/\u5A01\u671B/\u6C11\u5FC3\u7B49\uFF09');
  if (!P.time || !P.time.year) _checkWarnings.push('\u672A\u8BBE\u7F6E\u5F00\u59CB\u5E74\u4EFD');
  if (!GM.officeTree || GM.officeTree.length === 0) _checkWarnings.push('\u672A\u8BBE\u7F6E\u5B98\u5236');
  if (_checkWarnings.length > 0) {
    console.warn('[ScenarioCheck]', _checkWarnings.join('; '));
    // 在起居注中记录警告
    if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: 0, date: '\u5F00\u5C40\u68C0\u67E5', content: '\u3010\u5267\u672C\u4E0D\u5B8C\u6574\u8B66\u544A\u3011' + _checkWarnings.join('\uFF1B') });
  }

  // 确保所有字段有默认值
  if (typeof _ensureGMDefaults === 'function') _ensureGMDefaults();
  if (typeof _ensurePDefaults === 'function') _ensurePDefaults();
  // 清理新游戏时的旧会话数据
  if (typeof ChangeLog !== 'undefined') ChangeLog.clear();
  if (typeof GameEventBus !== 'undefined') GameEventBus.clear();
  if (typeof DecisionRegistry !== 'undefined') DecisionRegistry.loadFromConfig();
  if (typeof PromptLayerCache !== 'undefined') PromptLayerCache.clear();
  if (typeof TokenUsageTracker !== 'undefined') TokenUsageTracker.reset();

  // ── 逻辑审查：AI检查剧本数据中的矛盾冲突并自动修正 ──
  if (P.ai && P.ai.key && GM.chars && GM.chars.length > 0) {
    (async function() {
      try {
        showLoading('\u903B\u8F91\u5BA1\u67E5\uFF1A\u68C0\u67E5\u5267\u672C\u6570\u636E\u77DB\u76FE...', 90);
        await _logicAuditOnStart(sc);
      } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'LogicAudit] error:') : console.warn('[LogicAudit] error:', e); }

      // AI深度预热（剧本标 isFullyDetailed 时内部跳过·用剧本文本兜底）
      if (typeof aiDeepReadScenario === 'function') {
        try {
          await aiDeepReadScenario();
        } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'DeepRead in doActualStart] error:') : console.warn('[DeepRead in doActualStart] error:', e); }
      }
      // 三项推演规划·并行发射（节省等待）·各 1 次 AI：
      //   · aiPlanScenarioForInference: NPC 议程/危机分岔/行文指纹
      //   · aiPlanFactionMatrix: 势力关系矩阵/轨迹/黑天鹅
      //   · aiPlanFirstTurnEvents: 首 3 回合候选事件池
      showLoading('\u89C4\u5212\u63A8\u6F14\u9519\u70B9\u00B7\u5E76\u884C 3 \u9879\u2026', 92);
      try {
        await Promise.all([
          (typeof aiPlanScenarioForInference === 'function') ? aiPlanScenarioForInference().catch(function(e){ (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'aiPlan') : console.warn('[aiPlan]', e); }) : Promise.resolve(),
          (typeof aiPlanFactionMatrix === 'function') ? aiPlanFactionMatrix().catch(function(e){ (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'aiFacMatrix') : console.warn('[aiFacMatrix]', e); }) : Promise.resolve(),
          (typeof aiPlanFirstTurnEvents === 'function') ? aiPlanFirstTurnEvents().catch(function(e){ (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'aiFTE') : console.warn('[aiFTE]', e); }) : Promise.resolve()
        ]);
      } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, '3 plans parallel') : console.warn('[3 plans parallel]', e); }
      showLoading('\u751F\u6210\u521D\u59CB\u594F\u758F...', 98);
      generateMemorials();
      hideLoading();
      enterGame();
    })();
  } else {
    showLoading('\u8FDB\u5165\u6E38\u620F\u4E16\u754C...', 95);
    generateMemorials();
    setTimeout(function(){hideLoading();enterGame();},100);
  }
  var hd=_$("qiju-history");if(hd&&sc)hd.innerHTML="<div class=\"qiju-record\"><div class=\"qiju-turn\">"+getTS(1)+" \u5F00\u7BC7</div><div class=\"nt\">"+sc.opening+"</div></div>";

  // 初始化科举制度（由AI判断是否启用）
  initKejuSystem(sc);

  if(!GM.officeTree||GM.officeTree.length===0){
    _showOfficeStartModal();
    return;
  }
  toast("第1回合");
}

// 奏议批复写入纪事本末
// 注意：此包装层已废弃，功能已迁移到 EndTurnHooks 系统（钩子2）

// 官制资源消耗设置
renderOfficeTab=function(em){
  var sid=editingScenarioId;var vars=P.variables.filter(function(v){return v.sid===sid;});
  if(!P.officeConfig)P.officeConfig={costVariables:[],shortfallEffects:""};
  em.innerHTML="<h4 style=\"color:var(--gold);\">\u5B98\u5236</h4>"+
    "<div style=\"display:flex;gap:0.3rem;margin-bottom:0.8rem;\"><button class=\"bt bp\" onclick=\"if(!P.officeTree)P.officeTree=[];P.officeTree.push({name:prompt('\u90E8\u95E8:')||'\u65B0',positions:[],subs:[]});renderEdTab('t-office');\">\uFF0B \u90E8\u95E8</button><button class=\"bai\" onclick=\"aiGenOfficeEd()\">\uD83E\uDD16 AI</button></div>"+
    (P.officeTree||[]).map(function(d,i){return "<div class=\"cd\"><strong>"+d.name+"</strong> ("+(d.positions||[]).length+"\u5B98) <button class=\"bd bsm\" onclick=\"P.officeTree.splice("+i+",1);renderEdTab('t-office');\">\u2715</button></div>";}).join("")+
    "<hr class=\"dv\"><div style=\"font-size:0.95rem;font-weight:700;color:var(--gold);margin-bottom:0.5rem;\">\u5B98\u5236\u8D44\u6E90\u6D88\u8017</div>"+
    "<div style=\"font-size:0.8rem;color:var(--txt-d);margin-bottom:0.5rem;\">\u6BCF\u56DE\u5408\u6D88\u8017\u8D44\u6E90\uFF0C\u7C7B\u4F3C\u53D1\u4FF8\u7984\u3002</div>"+
    (P.officeConfig.costVariables||[]).map(function(cv,ci){var opts=vars.map(function(v){return "<option "+(v.name===cv.variable?"selected":"")+">"+v.name+"</option>";}).join("");return "<div style=\"display:flex;gap:0.3rem;margin-bottom:0.3rem;\"><select onchange=\"P.officeConfig.costVariables["+ci+"].variable=this.value\">"+opts+"</select><div class=\"fd q\"><label>\u6BCF\u90E8\u95E8</label><input type=\"number\" value=\""+(cv.perDept||5)+"\" style=\"width:50px;\" onchange=\"P.officeConfig.costVariables["+ci+"].perDept=+this.value\"></div><div class=\"fd q\"><label>\u6BCF\u5B98\u5458</label><input type=\"number\" value=\""+(cv.perOfficial||2)+"\" style=\"width:50px;\" onchange=\"P.officeConfig.costVariables["+ci+"].perOfficial=+this.value\"></div><button class=\"bd bsm\" onclick=\"P.officeConfig.costVariables.splice("+ci+",1);renderEdTab('t-office');\">\u2715</button></div>";}).join("")+
    "<button class=\"bt bs bsm\" onclick=\"P.officeConfig.costVariables.push({variable:'"+(vars[0]?vars[0].name:"")+"',perDept:5,perOfficial:2});renderEdTab('t-office');\">\uFF0B \u6DFB\u52A0\u6D88\u8017</button>"+
    "<div class=\"fd full\" style=\"margin-top:0.8rem;\"><label>\u8D44\u6E90\u4E0D\u8DB3\u65F6\u7684\u8D1F\u9762\u6548\u679C</label><textarea rows=\"3\" onchange=\"P.officeConfig.shortfallEffects=this.value\" placeholder=\"AI\u6BCF\u56DE\u5408\u8BFB\u53D6\">"+(P.officeConfig.shortfallEffects||"")+"</textarea></div>";
};
// ============================================================

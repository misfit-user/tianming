// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-help-social.js — 教程/帮助+关系/面子/迁移 (R134 从 tm-dynamic-systems.js L1789-end 拆出)
// 姊妹: tm-dynamic-systems.js + tm-save-manager.js
// 包含: 教程帮助系统+亲疏关系网 (横向人际)+双轨好感 (dual-track opinion)+
//       存档版本迁移 (SaveMigrations)+面子系统 (Face/Honor)+SettlementPipeline 注册
// ============================================================

// ============================================================
// 教程和帮助系统
// ============================================================

var HelpSystem = {
  currentTopic: 'overview',

  topics: {
    overview: {
      title: '📖 游戏概览',
      content: `
        <h4>欢迎来到天命游戏</h4>
        <p>这是一款基于AI的历史模拟游戏，你将扮演历史人物，通过发布政令、处理奏疏、管理官制等方式影响历史进程。</p>

        <h4>核心特色</h4>
        <ul>
          <li><strong>AI驱动</strong>：使用大语言模型推演历史事件和角色行为</li>
          <li><strong>高度自由</strong>：不受固定剧本束缚，AI会根据你的决策动态推演</li>
          <li><strong>跨朝代</strong>：支持秦汉、唐宋、明清等多个历史时期</li>
          <li><strong>深度系统</strong>：包含官制、军制、经济、外交、继承等完整系统</li>
        </ul>

        <h4>游戏模式</h4>
        <ul>
          <li><strong>严格史实</strong>：严格遵守历史，不得改变历史走向</li>
          <li><strong>轻度史实</strong>：大事件遵循历史，细节可演绎</li>
          <li><strong>演义模式</strong>：AI自由发挥，情节更富戏剧性</li>
        </ul>
      `
    },

    apikey: {
      title: '🔑 如何配置 AI 密钥',
      content: `
        <h4>为什么需要密钥</h4>
        <p>天命以 AI 为引擎推演整个世界——臣子的回应、派系的博弈、史局的走向都由大语言模型当场演绎。<b>没有 API 密钥，过回合就只是空转：回合数变了，世界却毫无反应。这不是故障，而是缺了引擎的燃料。</b></p>

        <h4>需要什么样的密钥</h4>
        <p>任意一个 <b>OpenAI 兼容</b>的对话（Chat Completions）接口即可。你需要四样东西：</p>
        <ul>
          <li><strong>服务商</strong>：OpenAI / DeepSeek / Claude / 自定义（用中转站则选「自定义」）</li>
          <li><strong>Key</strong>：服务商给你的 API 密钥（形如 <code>sk-…</code>）</li>
          <li><strong>地址</strong>：接口 base URL，如 <code>https://api.openai.com/v1</code>；用中转站则填它给的地址</li>
          <li><strong>模型</strong>：要调用的模型名（如 gpt-4o-mini、deepseek-chat 等）</li>
        </ul>

        <h4>在哪里填</h4>
        <p>主页「典章·游戏设置」，或游戏内右栏「设置」→「API 连接」。填好后先点<b>「测试连接」</b>确认能通，再点「保存」。还可另配一个「次要 API」走快模型分流，留空则统一用主 API。</p>

        <h4>常见问题</h4>
        <ul>
          <li><b>过回合没反应？</b>多半是没填或填错密钥——回到「API 连接」点「测试连接」核对。</li>
          <li><b>连不上 / 证书报错？</b>检查「地址」是否完整；自架或中转站证书异常时，可在 API 连接处勾选「允许不安全证书」（仅对你填的地址生效）。</li>
          <li>密钥只保存在本地设备，AI 请求仅发往你自己填的接口，不会上传到游戏服务器。</li>
        </ul>
      `
    },

    gameplay: {
      title: '🎮 游戏玩法',
      content: `
        <h4>回合流程</h4>
        <ol>
          <li><strong>查看奏疏</strong>：处理NPC提交的各类奏疏（任命、请求、建议等）</li>
          <li><strong>发布政令</strong>：在政治、军事、外交、经济等领域发布指令</li>
          <li><strong>记录行录</strong>：记录本回合的重要活动和决策</li>
          <li><strong>结束回合</strong>：AI推演事件，更新游戏状态</li>
        </ol>

        <h4>政令系统</h4>
        <p>你可以在五个领域发布政令：</p>
        <ul>
          <li><strong>政治</strong>：改革制度、任命官员、颁布法令</li>
          <li><strong>军事</strong>：调动军队、发动战争、防御边境</li>
          <li><strong>外交</strong>：结盟、和亲、朝贡、宣战</li>
          <li><strong>经济</strong>：调整税收、发展产业、赈济灾民</li>
          <li><strong>其他</strong>：文化、宗教、科技等</li>
        </ul>

        <h4>奏疏处理</h4>
        <p>NPC会提交各类奏疏，你需要批复：</p>
        <ul>
          <li><strong>任命请求</strong>：批准或拒绝官职任命</li>
          <li><strong>资源请求</strong>：决定是否拨付资源</li>
          <li><strong>政策建议</strong>：采纳或驳回政策建议</li>
          <li><strong>军事行动</strong>：批准或否决军事计划</li>
        </ul>
      `
    },

    systems: {
      title: '⚙️ 游戏系统',
      content: `
        <h4>官制系统</h4>
        <p>管理朝廷官职结构，包括：</p>
        <ul>
          <li>官职树：层级化的官职结构</li>
          <li>任命权：不同官职的任命权限</li>
          <li>俸禄：官员的薪资和待遇</li>
          <li>考课：定期评估官员表现</li>
        </ul>

        <h4>经济系统</h4>
        <ul>
          <li><strong>集权度</strong>：影响地方向中央的贡奉比例</li>
          <li><strong>贡奉</strong>：地方定期向中央上缴财政</li>
          <li><strong>回拨</strong>：中央按比例回拨给地方</li>
          <li><strong>地方区划</strong>：查看各省经济详情</li>
        </ul>

        <h4>继承系统</h4>
        <ul>
          <li><strong>宗法继承</strong>：嫡长子继承制</li>
          <li><strong>流官制</strong>：官职不可继承</li>
          <li><strong>AI推演</strong>：根据时代背景推荐继承人</li>
        </ul>

        <h4>时代状态</h4>
        <p>11个维度动态追踪历史时期：</p>
        <ul>
          <li>政治统一度、中央集权度</li>
          <li>社会稳定度、经济繁荣度</li>
          <li>文化活力、官僚体系强度</li>
          <li>军队职业化程度等</li>
        </ul>

        <h4>NPC行为</h4>
        <p>AI驱动的NPC会根据性格、忠诚度、野心等属性做出决策：</p>
        <ul>
          <li>政治行为：结盟、背叛、弹劾</li>
          <li>军事行为：叛乱、扩张、招募</li>
          <li>经济行为：贪污、请求资源</li>
          <li>社会行为：赈济、镇压</li>
        </ul>
      `
    },

    interface: {
      title: '🖥️ 界面说明',
      content: `
        <h4>主界面布局</h4>
        <ul>
          <li><strong>左侧面板</strong>：显示回合信息、资源状态、关系值</li>
          <li><strong>中央区域</strong>：主要内容区，显示奏疏、政令、事件等</li>
          <li><strong>右侧面板</strong>：显示角色信息、势力信息等</li>
          <li><strong>顶部菜单</strong>：史记、存档、设置等功能</li>
        </ul>

        <h4>快捷按钮</h4>
        <ul>
          <li><strong>\u5929\u4E0B\u5927\u52BF</strong>\uFF1A\u67E5\u770B\u65F6\u4EE3\u8D8B\u52BF\u56FE\u548C\u5386\u53F2\u5927\u4E8B\u4EF6</li>
          <li><strong>🏆 成就</strong>：查看已解锁的成就</li>
          <li><strong>⚡ AI性能</strong>：查看AI推演性能统计</li>
          <li><strong>❓ 帮助</strong>：打开本帮助系统</li>
        </ul>

        <h4>顶部菜单</h4>
        <ul>
          <li><strong>📜 史记</strong>：查看历史记录和回合推演</li>
          <li><strong>💾 存档</strong>：保存和加载游戏</li>
        </ul>
      `
    },

    tips: {
      title: '💡 游戏技巧',
      content: `
        <h4>新手建议</h4>
        <ul>
          <li>先熟悉界面和基本操作，不要急于发布复杂政令</li>
          <li>注意观察资源变化，避免财政或粮食短缺</li>
          <li>及时处理奏疏，维护与NPC的关系</li>
          <li>\u5B9A\u671F\u67E5\u770B\u5929\u4E0B\u5927\u52BF\u548C\u5730\u65B9\u533A\u5212</li>
          <li>善用存档功能，尝试不同的决策路线</li>
        </ul>

        <h4>进阶技巧</h4>
        <ul>
          <li><strong>平衡集权</strong>：过高或过低的集权度都有风险</li>
          <li><strong>培养继承人</strong>：提前安排继承，避免权力真空</li>
          <li><strong>管理关系</strong>：维护与重要NPC的关系，防止叛乱</li>
          <li><strong>适应时代</strong>：根据时代状态调整策略</li>
          <li><strong>利用AI</strong>：善用AI推演，了解决策的可能后果</li>
        </ul>

        <h4>常见问题</h4>
        <ul>
          <li><strong>Q: 为什么AI推演很慢？</strong><br>A: 检查网络连接和API配置，可以在AI性能面板查看统计</li>
          <li><strong>Q: 如何提高缓存命中率？</strong><br>A: 保持角色状态相对稳定，避免频繁大幅度变化</li>
          <li><strong>Q: 存档在哪里？</strong><br>A: 存档保存在浏览器本地存储，可以导出为文件备份</li>
          <li><strong>Q: 如何切换朝代？</strong><br>A: 在编辑器中创建新剧本，选择不同的朝代模板</li>
        </ul>
      `
    },

    shortcuts: {
      title: '⌨️ 快捷键',
      content: `
        <h4>常用快捷键</h4>
        <ul>
          <li><strong>Enter</strong>：结束回合（在主界面）</li>
          <li><strong>Esc</strong>：关闭当前弹窗</li>
          <li><strong>Ctrl+S</strong>：快速保存</li>
        </ul>

        <p style="color:var(--txt-s);margin-top:1rem;">注：部分快捷键可能与浏览器冲突</p>
      `
    },

    edictQA: {
      title: '📜 诏书问对',
      content: `
        <h4>六类诏书通则</h4>
        <p>制度级诏书由 AI 自动识别分类，按完整度/紧急度/重要度三维度判定路径：</p>
        <ul>
          <li><strong>直断</strong>：诏书详尽或事急 → AI 即时推演</li>
          <li><strong>复奏</strong>：意图明确细节不足 → 大臣拟奏疏供朱批</li>
          <li><strong>追问</strong>：意图模糊 → 侍臣问疑</li>
        </ul>

        <h4>Ⅰ 货币改革</h4>
        <p>铸币、改制、发钞、废钞皆走此。必含<b>币种/重量/成色/官铸机构</b>四要素。</p>
        <div style="background:var(--bg-2);padding:6px 10px;border-left:3px solid var(--gold-500);margin:4px 0;">
          · 铸五铢钱，重五铢，上林三官造<br>
          · 发交子于蜀，十年一界，准备金足<br>
          · 减铸小钱当千，以纾军用<br>
          · 废宝钞，改行白银
        </div>
        <p style="color:var(--celadon-300);font-style:italic;">要旨：成色低则民弃之，私铸兴。发钞无准备金必崩。</p>

        <h4>Ⅱ 税种设立</h4>
        <p>新税种须含：<b>税基（田/丁/商/关）+ 税率 + 豁免对象</b>。</p>
        <div style="background:var(--bg-2);padding:6px 10px;border-left:3px solid var(--gold-500);margin:4px 0;">
          · 立算赋，每丁岁一百二十钱<br>
          · 置商税，百抽三，商户登记<br>
          · 开市舶司，海商百抽十<br>
          · 行两税法，夏秋两征
        </div>
        <p style="color:var(--celadon-300);font-style:italic;">要旨：过高赋役 → 逃户 → 税基流失。一条鞭法折银改革为典范。</p>

        <h4>Ⅲ 户籍制度</h4>
        <p>编户、黄册、保甲、色目皆此类。</p>
        <div style="background:var(--bg-2);padding:6px 10px;border-left:3px solid var(--gold-500);margin:4px 0;">
          · 编户齐民，什伍连坐<br>
          · 造黄册，十年一大造<br>
          · 推行保甲，十户一牌<br>
          · 摊丁入亩，永不加赋
        </div>
        <p style="color:var(--celadon-300);font-style:italic;">要旨：清查频率影响税基透明度。重造黄册费钱但扫隐户。</p>

        <h4>Ⅳ 徭役改革</h4>
        <p>三路径：<b>均役（分摊）/折银（雇佣代役）/摊入田赋</b>。</p>
        <div style="background:var(--bg-2);padding:6px 10px;border-left:3px solid var(--gold-500);margin:4px 0;">
          · 立均徭，丁岁三十日<br>
          · 行一条鞭法，役银合一<br>
          · 摊丁入亩，役尽归田
        </div>
        <p style="color:var(--celadon-300);font-style:italic;">要旨：大徭役死亡率 &gt; 30% 必民变。折银仅宜商贸发达地。</p>

        <h4>Ⅴ 兵制改革</h4>
        <p>七类兵制各有条件：<b>府兵需均田、募兵需军饷、卫所需世袭军户</b>。</p>
        <div style="background:var(--bg-2);padding:6px 10px;border-left:3px solid var(--gold-500);margin:4px 0;">
          · 立府兵，府兵轮番宿卫<br>
          · 行募兵制，月饷二两<br>
          · 建卫所，军户世袭<br>
          · 立团练，绅士领兵
        </div>
        <p style="color:var(--celadon-300);font-style:italic;">要旨：马政决定骑兵上限。兵权旁落 → 藩镇自立。</p>

        <h4>Ⅵ 官制设立</h4>
        <p>新设机构须含：<b>名称/品级/职事/员额/上司</b>。</p>
        <div style="background:var(--bg-2);padding:6px 10px;border-left:3px solid var(--gold-500);margin:4px 0;">
          · 立三省六部<br>
          · 置节度使<br>
          · 设内阁大学士<br>
          · 置总督巡抚
        </div>
        <p style="color:var(--celadon-300);font-style:italic;">要旨：同职位多则政出多门。冗官冗费 → 帑廪压力。</p>

        <h4>30 条历代典范诏书（示例）</h4>
        <div style="font-size:0.78rem;line-height:1.9;background:var(--bg-2);padding:8px 12px;border-radius:4px;max-height:280px;overflow-y:auto;">
          · [秦] 统一币制，废六国异币，铸圆方孔半两<br>
          · [汉] 铸五铢钱，禁郡国铸<br>
          · [唐] 废五铢，立开元通宝<br>
          · [宋] 发交子于蜀<br>
          · [明] 发大明宝钞<br>
          · [汉] 立算赋，每人每年一百二十钱<br>
          · [唐] 租庸调：丁岁粟二石、绢二丈、役二十日<br>
          · [唐] 行两税法，夏秋两征<br>
          · [明] 一条鞭法：赋役合一折银<br>
          · [秦] 编户齐民，什伍连坐<br>
          · [明] 造黄册，十年一大造<br>
          · [清] 推行保甲，十户一牌，十牌一甲<br>
          · [清] 摊丁入亩，永不加赋<br>
          · [秦] 立更役，丁岁一月<br>
          · [唐] 庸役折绢，岁二丈<br>
          · [明] 均徭，按丁田轮派<br>
          · [清] 火耗归公，养廉银制<br>
          · [唐] 立府兵，府兵轮番宿卫<br>
          · [宋] 行募兵制<br>
          · [明] 立卫所，军户世袭<br>
          · [清] 立八旗，兵民合一<br>
          · [清] 湘军淮军，团练练勇<br>
          · [秦] 立三公九卿<br>
          · [汉] 立刺史部十三州<br>
          · [唐] 立三省六部<br>
          · [宋] 立中书门下政事堂<br>
          · [明] 立内阁大学士
        </div>

        <h4>抗疏机制</h4>
        <p>重大制度诏书可能触发清流大臣抗疏。玩家有五种处理：<b>纳谏/斥之/下狱/诛/贬</b>。</p>
        <p style="color:var(--celadon-300);font-style:italic;">历史典范：魏征谏十思、包拯弹亲贵、海瑞直言天子失德、杨涟弹劾魏忠贤。</p>
      `
    },

    // ═══════════════════════════════════════════════════════════════
    //  历代典范（只读参考，不是游戏内选项）
    // ═══════════════════════════════════════════════════════════════
    classics: {
      title: '📚 历代典范参考',
      dynamicRender: true,  // 渲染时动态从 HistoricalPresets 读取
      content: '' // 占位，renderHelp 时动态填充
    }
  }
};

/**
 * 动态渲染"历代典范"帮助页 —— 从 HistoricalPresets 读取最新数据
 * （支持剧本 customPresets 覆盖）
 */
function _buildClassicsHelpContent() {
  var HP = window.HistoricalPresets;
  if (!HP) return '<p style="color:var(--vermillion-400);">历史预设库未加载</p>';

  // R143·委托给 tm-utils.js:569 (此处只需 <> 不严格)
  function _esc(s){return (typeof escHtml === 'function') ? escHtml(s) : String(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  var html = '<p style="color:var(--celadon-300);font-style:italic;">以下内容仅供参考——这些是历代典型案例，玩家推演时并不受其约束，AI 只要合理可产出任何架空策略。</p>';

  // 大徭役
  try {
    var corvee = typeof HP.getGreatCorveeProjects === 'function' ? HP.getGreatCorveeProjects() : (HP.GREAT_CORVEE_PROJECTS||[]);
    if (corvee.length) {
      html += '<h4>📜 历代大徭役（' + corvee.length + ' 条）</h4><div style="max-height:280px;overflow-y:auto;padding:8px;background:var(--bg-2);border-radius:4px;font-size:0.78rem;line-height:1.7;">';
      corvee.forEach(function(p){
        html += '· <b>[' + _esc(p.dynasty||'') + (p.year?' '+p.year:'') + ']</b> ' + _esc(p.name||p.id) + '：丁 ' + (p.labor||p.dingMobilized||'?') + ' · 殁 ' + Math.round((p.deathRate||p.mortalityRate||0)*100) + '%' + (p.notes?' · ' + _esc(p.notes):'') + '<br>';
      });
      html += '</div>';
    }
  } catch(_e){}

  // 迁徙
  try {
    var mig = typeof HP.getMigrationEventsDetail === 'function' ? HP.getMigrationEventsDetail() : (HP.MIGRATION_EVENTS_DETAIL||[]);
    if (mig.length) {
      html += '<h4>🗺 历代大迁徙（' + mig.length + ' 条）</h4><div style="max-height:200px;overflow-y:auto;padding:8px;background:var(--bg-2);border-radius:4px;font-size:0.78rem;line-height:1.7;">';
      mig.forEach(function(p){
        html += '· <b>[' + (p.year||'?') + ']</b> ' + _esc(p.name) + '：' + (p.scale?Math.round(p.scale/10000)+'万口':'') + ' · ' + _esc((p.from||[]).join('/')||'?') + ' → ' + _esc((p.to||[]).join('/')||'?') + (p.culturalShift?'（' + _esc(p.culturalShift) + '）':'') + '<br>';
      });
      html += '</div>';
    }
  } catch(_e){}

  // 兵制
  try {
    var mil = typeof HP.getMilitarySystemsDetail === 'function' ? HP.getMilitarySystemsDetail() : (HP.MILITARY_SYSTEMS_DETAIL||{});
    var mKeys = Object.keys(mil);
    if (mKeys.length) {
      html += '<h4>⚔ 历代兵制（' + mKeys.length + ' 种）</h4><div style="max-height:200px;overflow-y:auto;padding:8px;background:var(--bg-2);border-radius:4px;font-size:0.78rem;line-height:1.7;">';
      mKeys.forEach(function(k){
        var s = mil[k];
        html += '· <b>' + _esc(s.name||k) + '</b>（' + _esc(s.dynasty||'') + '·' + _esc(s.era||'') + '）：兵 ' + (s.totalStrength||'?') + (s.collapse?' · 衰于' + _esc(s.collapse):'') + '<br>';
      });
      html += '</div>';
    }
  } catch(_e){}

  // 30 典范诏
  try {
    var EP = window.EdictParser;
    var eds = EP && (typeof EP.getHistoricalEdictPresets === 'function' ? EP.getHistoricalEdictPresets() : (EP.HISTORICAL_EDICT_PRESETS||[]));
    if (eds && eds.length) {
      html += '<h4>📜 历代典范诏（' + eds.length + ' 条）</h4><div style="max-height:280px;overflow-y:auto;padding:8px;background:var(--bg-2);border-radius:4px;font-size:0.78rem;line-height:1.7;">';
      eds.forEach(function(p){
        html += '· <b>[' + _esc(p.dynasty||'') + ']</b> ' + _esc(p.text||'') + ' <span style="color:var(--txt-d);">(' + _esc(p.type||'') + ')</span><br>';
      });
      html += '</div>';
    }
  } catch(_e){}

  // 制度模板
  try {
    var inst = typeof HP.getInstitutionTemplates === 'function' ? HP.getInstitutionTemplates() : (HP.INSTITUTION_TEMPLATES||{});
    var iKeys = Object.keys(inst);
    if (iKeys.length) {
      html += '<h4>🏛 历代制度模板（' + iKeys.length + ' 种）</h4><div style="max-height:200px;overflow-y:auto;padding:8px;background:var(--bg-2);border-radius:4px;font-size:0.78rem;line-height:1.7;">';
      iKeys.forEach(function(k){
        var it = inst[k];
        html += '· <b>' + _esc(it.name||k) + '</b>' + (it.category?'（' + _esc(it.category) + '）':'') + (it.notes?'：' + _esc(it.notes):'') + '<br>';
      });
      html += '</div>';
    }
  } catch(_e){}

  html += '<p style="color:var(--gold);font-size:0.78rem;margin-top:12px;">这些条目本游戏 <b>不</b> 作为运行时触发规则。AI 推演时可能会参考也可能完全不参考——由局面和 AI 自由决定。若你写架空诏令（如"造纸币失败则发行国债"），AI 也会推演而非拒绝。</p>';

  return html;
}

// 打开帮助界面
function openHelp(topic) {
  var currentTopic = topic || HelpSystem.currentTopic;

  var ov = document.createElement('div');
  ov.className = 'generic-modal-overlay';
  ov.id = 'help-overlay';

  var html = '<div class="generic-modal" style="max-width:800px;max-height:85vh;display:flex;flex-direction:row;">';

  // 左侧导航
  html += '<div style="width:200px;border-right:1px solid var(--bg-3);padding:1rem;overflow-y:auto;">';
  html += '<h3 style="color:var(--gold);margin-bottom:1rem;">帮助主题</h3>';

  Object.keys(HelpSystem.topics).forEach(function(key) {
    var t = HelpSystem.topics[key];
    var isActive = key === currentTopic;
    html += '<div onclick="switchHelpTopic(\'' + key + '\')" style="';
    html += 'padding:0.6rem;margin-bottom:0.3rem;cursor:pointer;border-radius:4px;';
    html += 'background:' + (isActive ? 'var(--bg-3)' : 'transparent') + ';';
    html += 'color:' + (isActive ? 'var(--gold)' : 'var(--txt)') + ';';
    html += 'font-size:0.9rem;';
    html += '">';
    html += t.title;
    html += '</div>';
  });

  html += '</div>';

  // 右侧内容
  html += '<div style="flex:1;display:flex;flex-direction:column;">';
  html += '<div class="generic-modal-header">';
  html += '<h3>' + HelpSystem.topics[currentTopic].title + '</h3>';
  html += '<button onclick="closeHelp()">✕</button>';
  html += '</div>';
  html += '<div class="generic-modal-body" style="flex:1;overflow-y:auto;">';
  html += '<div style="line-height:1.8;font-size:0.9rem;">';
  var _topicEntry = HelpSystem.topics[currentTopic];
  if (_topicEntry && _topicEntry.dynamicRender && currentTopic === 'classics' && typeof _buildClassicsHelpContent === 'function') {
    html += _buildClassicsHelpContent();
  } else {
    html += _topicEntry ? _topicEntry.content : '';
  }
  html += '</div>';
  html += '</div>';
  html += '</div>';

  html += '</div>';

  ov.innerHTML = html;
  document.body.appendChild(ov);

  HelpSystem.currentTopic = currentTopic;
}

function closeHelp() {
  var ov = document.getElementById('help-overlay');
  if (ov) ov.remove();
}

function switchHelpTopic(topic) {
  closeHelp();
  openHelp(topic);
}

// ─── 新手帮助入口 ───
// 游戏内「帮助·典范」抽屉的 4 个按钮此前 onclick 调 openHelp*()·但这些函数从未定义→只 toast 标签(死按钮)。
// 此处定义并接到现有 HelpSystem·按钮的 `if(typeof openHelpNewbie==='function')` 守卫即转真→帮助内容(本就丰富)变可达。
function openHelpNewbie() { openHelp('gameplay'); }    // 新手入门 → 玩法指引
function openHelpPresets() { openHelp('overview'); }   // 历代典范 → 游戏概览(跨朝代)
function openHelpAI() { openHelp('apikey'); }          // AI 推演原理 → AI 引擎与密钥(没 key 则空转)
function openHelpHotkey() { openHelp('shortcuts'); }   // 键位速查 → 快捷键
if (typeof window !== 'undefined') {
  window.openHelpNewbie = openHelpNewbie;
  window.openHelpPresets = openHelpPresets;
  window.openHelpAI = openHelpAI;
  window.openHelpHotkey = openHelpHotkey;
}
// F1 打开帮助(状态栏宣传 F1 却一直无绑定·此处补上)·焦点在输入框时不拦截
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'F1') return;
    var t = e.target, tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (t && t.isContentEditable)) return;
    e.preventDefault();
    try { if (typeof openHelp === 'function') openHelp(); } catch (_) {}
  });
}

// ─── 开局·无 AI 密钥提示 ───
// 天命以 AI 为引擎(P.ai.key)·没 key 过回合只空转(世界无反应·非故障)·但开局完全不提示→新手误以为游戏坏了。
// 开局(enterGame:after)若未配 key·弹一条可关提示条·一键直达「如何配置」帮助。配了 key 即不打扰。
function _tmCheckApiKeyOnStart() {
  try {
    var _P = (typeof window !== 'undefined' && window.P) || (typeof P !== 'undefined' ? P : null);
    if (_P && _P.ai && _P.ai.key) return;                 // 已配置→不打扰
    if (typeof document === 'undefined' || !document.body) return;
    if (document.getElementById('tm-nokey-banner')) return; // 防重
    var bar = document.createElement('div');
    bar.id = 'tm-nokey-banner';
    bar.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:18px;z-index:2147483600;max-width:min(680px,92vw);background:linear-gradient(#3a2412,#2a1a0c);border:1px solid #c08a3a;border-radius:8px;padding:12px 16px;color:#f0dcc0;font-family:serif;font-size:0.85rem;box-shadow:0 8px 30px rgba(0,0,0,.55);display:flex;align-items:center;gap:12px;flex-wrap:wrap;';
    var msg = document.createElement('span');
    msg.style.cssText = 'flex:1;min-width:220px;line-height:1.55;';
    msg.innerHTML = '⚠ <b style="color:#e8c87a;">尚未配置 AI 密钥</b>——天命以 AI 为引擎，没有密钥过回合只会空转、世界毫无反应（这不是故障，是缺了引擎的燃料）。';
    bar.appendChild(msg);
    var help = document.createElement('button');
    help.className = 'bt bp'; help.textContent = '如何配置';
    help.style.cssText = 'min-height:40px;padding:0.45rem 0.95rem;touch-action:manipulation;white-space:nowrap;';
    help.onclick = function () { try { if (typeof openHelp === 'function') openHelp('apikey'); } catch (_) {} };
    var ok = document.createElement('button');
    ok.className = 'bt bs'; ok.textContent = '知道了';
    ok.style.cssText = 'min-height:40px;padding:0.45rem 0.95rem;touch-action:manipulation;white-space:nowrap;';
    ok.onclick = function () { try { bar.remove(); } catch (_) {} };
    bar.appendChild(help); bar.appendChild(ok);
    document.body.appendChild(bar);
  } catch (e) {}
}
if (typeof window !== 'undefined') window._tmCheckApiKeyOnStart = _tmCheckApiKeyOnStart;
if (typeof GameHooks !== 'undefined' && GameHooks && GameHooks.on) {
  GameHooks.on('enterGame:after', _tmCheckApiKeyOnStart);
}

// ─── 首回合·行动指引 ───
// 新手落地后面对 ~21 栏按钮+6 FAB·无"从这开始"·开场白纯氛围不讲机制。开局首回合弹一次"临朝第一日"四步引导
// (时政→拟诏→朝议→诏付有司)·一次性(localStorage 记忆·看过不再扰)·一键直达完整玩法帮助。
function _tmFirstTurnGuide() {
  try {
    var _GM = (typeof window !== 'undefined' && window.GM) || (typeof GM !== 'undefined' ? GM : null);
    if (!_GM || (_GM.turn || 1) !== 1) return;            // 仅开局首回合
    var KEY = 'tm_seen_firstturn_guide';
    try { if (localStorage.getItem(KEY)) return; } catch (_) {}   // 看过→不再打扰
    if (typeof document === 'undefined' || !document.body || document.getElementById('tm-firstturn-guide')) return;
    var ov = document.createElement('div');
    ov.id = 'tm-firstturn-guide';
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483650;background:rgba(8,6,4,.72);display:flex;align-items:center;justify-content:center;';
    var box = document.createElement('div');
    box.style.cssText = 'max-width:min(520px,92vw);max-height:84vh;overflow:auto;background:linear-gradient(#211710,#2b1f12);border:1px solid #b8893a;border-radius:10px;padding:22px 24px;color:#f0dcc0;font-family:serif;box-shadow:0 14px 44px rgba(0,0,0,.6);';
    box.innerHTML =
      '<div style="font-size:1.15rem;color:#e8c87a;text-align:center;margin-bottom:6px;">临朝第一日</div>'
      + '<div style="font-size:0.8rem;color:#bfa988;text-align:center;margin-bottom:16px;border-bottom:1px solid #5a4420;padding-bottom:12px;">天命无固定剧本——你的每道旨意都会被 AI 当场推演。开局先做这几件事：</div>'
      + '<div style="font-size:0.9rem;line-height:1.75;">'
      + '<div style="margin-bottom:10px;"><b style="color:#e8c87a;">一 · 御案时政 / 奏疏</b><br><span style="color:#cdb997;">看臣下所请、当前要务，心中有数。</span></div>'
      + '<div style="margin-bottom:10px;"><b style="color:#e8c87a;">二 · 拟诏施政</b><br><span style="color:#cdb997;">右下「拟诏」下达旨意——施政、任免、征伐皆由此。</span></div>'
      + '<div style="margin-bottom:10px;"><b style="color:#e8c87a;">三 · 朝议 / 召对</b><br><span style="color:#cdb997;">与群臣议事问对，听取异见。</span></div>'
      + '<div style="margin-bottom:4px;"><b style="color:#e8c87a;">四 · 诏付有司（过回合）</b><br><span style="color:#cdb997;">右下角推进时局——AI 演绎天下对你这一朝的反应。</span></div>'
      + '</div>';
    var foot = document.createElement('div');
    foot.style.cssText = 'display:flex;gap:0.6rem;justify-content:flex-end;margin-top:18px;';
    var more = document.createElement('button');
    more.className = 'bt bs'; more.textContent = '完整玩法';
    more.style.cssText = 'min-height:44px;padding:0.5rem 1rem;touch-action:manipulation;';
    more.onclick = function () { try { if (typeof openHelp === 'function') openHelp('gameplay'); } catch (_) {} };
    var start = document.createElement('button');
    start.className = 'bt bp'; start.textContent = '开始临朝';
    start.style.cssText = 'min-height:44px;padding:0.5rem 1.2rem;touch-action:manipulation;';
    start.onclick = function () { try { ov.remove(); } catch (_) {} };
    foot.appendChild(more); foot.appendChild(start);
    box.appendChild(foot); ov.appendChild(box); document.body.appendChild(ov);
    try { localStorage.setItem(KEY, '1'); } catch (_) {}
  } catch (e) {}
}
if (typeof window !== 'undefined') window._tmFirstTurnGuide = _tmFirstTurnGuide;
if (typeof GameHooks !== 'undefined' && GameHooks && GameHooks.on) {
  GameHooks.on('enterGame:after', _tmFirstTurnGuide);
}

// AI 推演缓存系统
var AICache = {
  cache: new Map(),
  maxSize: 100,
  ttl: 5, // 缓存有效期（回合数）

  // 统计信息
  stats: {
    totalCalls: 0,
    cacheHits: 0,
    cacheMisses: 0,
    errors: 0,
    totalTime: 0,
    avgTime: 0
  },

  // 生成缓存键
  generateKey: function(npc, context) {
    var key = npc.name + '_' +
              (npc.loyalty || 50) + '_' +
              (npc.ambition || 50) + '_' +
              (context.eraState ? context.eraState.centralControl : 0.5) + '_' +
              (context.eraState ? context.eraState.socialStability : 0.5);
    return key;
  },

  // 获取缓存
  get: function(npc, context) {
    var key = this.generateKey(npc, context);
    var cached = this.cache.get(key);

    if (cached && (GM.turn - cached.turn) <= this.ttl) {
      return cached.data;
    }

    return null;
  },

  // 设置缓存
  set: function(npc, context, data) {
    var key = this.generateKey(npc, context);

    // 如果缓存已满，删除最旧的条目
    if (this.cache.size >= this.maxSize) {
      var oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data: data,
      turn: GM.turn
    });
  },

  // 清空缓存
  clear: function() {
    this.cache.clear();
  },

  // 清理过期缓存
  cleanup: function() {
    var keysToDelete = [];
    this.cache.forEach(function(value, key) {
      if ((GM.turn - value.turn) > AICache.ttl) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(function(key) {
      AICache.cache.delete(key);
    });
  },

  // 重置统计
  resetStats: function() {
    this.stats = {
      totalCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      totalTime: 0,
      avgTime: 0
    };
  }
};

// 初始化 AI 缓存系统
function initAICache() {
  AICache.clear();
  AICache.resetStats();
  _dbg('AI 缓存系统已初始化');
}

// AI 批处理队列
var AIBatchQueue = {
  queue: [],
  processing: false,
  batchSize: 5, // 每批处理的 NPC 数量
  delay: 1000, // 批次间延迟（毫秒）

  // 添加到队列
  add: function(npc, context, callback) {
    this.queue.push({
      npc: npc,
      context: context,
      callback: callback
    });
  },

  // 处理队列
  process: async function() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      // 取出一批任务
      var batch = this.queue.splice(0, this.batchSize);

      // 并行处理这一批
      var promises = batch.map(function(item) {
        return processNPCWithCache(item.npc, item.context).then(function(result) {
          if (item.callback) {
            item.callback(result);
          }
          return result;
        });
      });

      await Promise.all(promises);

      // 批次间延迟
      if (this.queue.length > 0) {
        await new Promise(function(resolve) {
          setTimeout(resolve, AIBatchQueue.delay);
        });
      }
    }

    this.processing = false;
  },

  // 清空队列
  clear: function() {
    this.queue = [];
    this.processing = false;
  }
};

// 使用缓存处理 NPC 行为
async function processNPCWithCache(npc, context) {
  // 1. 检查缓存
  var cached = AICache.get(npc, context);
  if (cached) {
    return cached;
  }

  // 2. 调用 AI 推演
  var result = await executeNpcBehavior(npc, context);

  // 3. 存入缓存
  if (result) {
    AICache.set(npc, context, result);
  }

  return result;
}

// 批量处理 NPC 行为（优化版）
async function batchProcessNPCs(npcs, context) {
  var results = [];

  // 将所有 NPC 添加到批处理队列
  npcs.forEach(function(npc) {
    AIBatchQueue.add(npc, context, function(result) {
      if (result) {
        results.push({npc: npc, behavior: result});
      }
    });
  });

  // 处理队列
  await AIBatchQueue.process();

  return results;
}

// 性能监控
var AIPerformanceMonitor = {
  stats: {
    totalCalls: 0,
    cacheHits: 0,
    cacheMisses: 0,
    totalTime: 0,
    avgTime: 0
  },

  // 记录调用
  recordCall: function(isCacheHit, duration) {
    this.stats.totalCalls++;
    if (isCacheHit) {
      this.stats.cacheHits++;
    } else {
      this.stats.cacheMisses++;
    }
    this.stats.totalTime += duration;
    this.stats.avgTime = this.stats.totalTime / this.stats.totalCalls;
  },

  // 获取统计信息
  getStats: function() {
    var hitRate = this.stats.totalCalls > 0 ?
                  (this.stats.cacheHits / this.stats.totalCalls * 100).toFixed(1) : 0;
    return {
      totalCalls: this.stats.totalCalls,
      cacheHits: this.stats.cacheHits,
      cacheMisses: this.stats.cacheMisses,
      hitRate: hitRate + '%',
      avgTime: this.stats.avgTime.toFixed(2) + 'ms'
    };
  },

  // 重置统计
  reset: function() {
    this.stats = {
      totalCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalTime: 0,
      avgTime: 0
    };
  }
};

// 触发历史事件
function triggerHistoricalEvent(eventType, description) {
  if (!GM.historicalEvents) {
    GM.historicalEvents = [];
  }

  // 检查是否已触发过相同事件（避免重复）
  var recentEvent = GM.historicalEvents.find(function(e) {
    return e.type === eventType && (GM.turn - e.turn) < 10;
  });

  if (recentEvent) return; // 10 回合内不重复触发

  var event = {
    id: uid(),
    type: eventType,
    description: description,
    turn: GM.turn,
    date: GM.date,
    effects: []
  };

  // 根据事件类型添加效果
  switch(eventType) {
    case 'economic_crisis':
      var _crisisEco = typeof _findVarByType === 'function' ? _findVarByType('economy') : null;
      var _crisisMor = typeof _findVarByType === 'function' ? _findVarByType('morale') : null;
      if (_crisisEco) { event.effects.push(_crisisEco + ' -500'); GM.vars[_crisisEco].value = Math.max(GM.vars[_crisisEco].min, GM.vars[_crisisEco].value - 500); }
      if (_crisisMor) { event.effects.push(_crisisMor + ' -10'); GM.vars[_crisisMor].value = Math.max(GM.vars[_crisisMor].min, GM.vars[_crisisMor].value - 10); }
      var __mk=typeof _findVarByType==='function'?_findVarByType('morale'):null;if(__mk&&GM.vars[__mk]) GM.vars[__mk].value = Math.max(GM.vars[__mk].min||0, GM.vars[__mk].value - 10);
      break;
    case 'civil_unrest':
      event.effects.push('民心 -15');
      event.effects.push('社会稳定度 -0.05');
      var __mk=typeof _findVarByType==='function'?_findVarByType('morale'):null;if(__mk&&GM.vars[__mk]) GM.vars[__mk].value = Math.max(GM.vars[__mk].min||0, GM.vars[__mk].value - 15);
      if (GM.eraState) GM.eraState.socialStability = Math.max(0, GM.eraState.socialStability - 0.05);
      break;
    case 'political_fragmentation':
      event.effects.push('中央集权度 -0.05');
      event.effects.push('政治统一度 -0.05');
      if (GM.eraState) {
        GM.eraState.centralControl = Math.max(0, GM.eraState.centralControl - 0.05);
        GM.eraState.politicalUnity = Math.max(0, GM.eraState.politicalUnity - 0.05);
      }
      break;
    case 'power_decentralization':
      event.effects.push('中央集权度 -0.1');
      if (GM.eraState) GM.eraState.centralControl = Math.max(0, GM.eraState.centralControl - 0.1);
      break;
    case 'golden_age':
      event.effects.push('所有资源 +10%');
      Object.keys(GM.vars).forEach(function(key) {
        GM.vars[key].value = Math.min(GM.vars[key].max, Math.floor(GM.vars[key].value * 1.1));
      });
      break;
    case 'decline_begins':
      event.effects.push('所有资源 -5%');
      Object.keys(GM.vars).forEach(function(key) {
        GM.vars[key].value = Math.max(GM.vars[key].min || 0, Math.floor(GM.vars[key].value * 0.95));
      });
      break;
    case 'dynasty_collapse':
      event.effects.push('所有资源 -20%');
      event.effects.push('民心 -30');
      Object.keys(GM.vars).forEach(function(key) {
        GM.vars[key].value = Math.max(GM.vars[key].min || 0, Math.floor(GM.vars[key].value * 0.8));
      });
      var __mk=typeof _findVarByType==='function'?_findVarByType('morale'):null;if(__mk&&GM.vars[__mk]) GM.vars[__mk].value = Math.max(GM.vars[__mk].min||0, GM.vars[__mk].value - 30);
      break;
    case 'revival':
      event.effects.push('所有资源 +15%');
      event.effects.push('民心 +20');
      Object.keys(GM.vars).forEach(function(key) {
        GM.vars[key].value = Math.min(GM.vars[key].max, Math.floor(GM.vars[key].value * 1.15));
      });
      var __mk=typeof _findVarByType==='function'?_findVarByType('morale'):null;if(__mk&&GM.vars[__mk]) GM.vars[__mk].value = Math.min(GM.vars[__mk].max||100, GM.vars[__mk].value + 20);
      break;
    case 'total_crisis':
      event.effects.push('所有资源 -30%');
      event.effects.push('民心 -40');
      Object.keys(GM.vars).forEach(function(key) {
        GM.vars[key].value = Math.max(GM.vars[key].min || 0, Math.floor(GM.vars[key].value * 0.7));
      });
      var __mk=typeof _findVarByType==='function'?_findVarByType('morale'):null;if(__mk&&GM.vars[__mk]) GM.vars[__mk].value = Math.max(GM.vars[__mk].min||0, GM.vars[__mk].value - 40);
      break;
  }

  GM.historicalEvents.push(event);
  addEB('历史事件', description + '（效果：' + event.effects.join('、') + '）');
}

// ============================================================
// 亲疏关系网（横向人际关系，区别于纵向忠诚）
// 每对角色间有独立的亲疏值（-100 到 +100）
// NPC 之间也有关系，不以玩家为中心
// ============================================================
function _tmAffinityCanonName(name) {
  if (!name) return name;
  try {
    if (typeof canonicalizeCharName === 'function') return canonicalizeCharName(name) || name;
  } catch (_) {}
  return name;
}

var AffinityMap = {
  /** 获取两人之间的亲疏值 */
  get: function(nameA, nameB) {
    nameA = _tmAffinityCanonName(nameA);
    nameB = _tmAffinityCanonName(nameB);
    if (!GM.affinityMap || !nameA || !nameB) return 0;
    var key = [nameA, nameB].sort().join('|');
    return GM.affinityMap[key] || 0;
  },

  /** 设置两人之间的亲疏值 */
  set: function(nameA, nameB, value) {
    nameA = _tmAffinityCanonName(nameA);
    nameB = _tmAffinityCanonName(nameB);
    if (!nameA || !nameB) return;
    if (!GM.affinityMap) GM.affinityMap = {};
    var key = [nameA, nameB].sort().join('|');
    GM.affinityMap[key] = clamp(value, -100, 100);
  },

  /** 增减亲疏值 */
  add: function(nameA, nameB, delta, reason) {
    nameA = _tmAffinityCanonName(nameA);
    nameB = _tmAffinityCanonName(nameB);
    var cur = AffinityMap.get(nameA, nameB);
    AffinityMap.set(nameA, nameB, cur + delta);
    _dbg('[Affinity] ' + nameA + '↔' + nameB + ': ' + (delta>0?'+':'') + delta + ' → ' + AffinityMap.get(nameA, nameB) + (reason ? ' (' + reason + ')' : ''));
  },

  /** 获取某角色的所有关系（按绝对值排序） */
  getRelations: function(name) {
    name = _tmAffinityCanonName(name);
    if (!GM.affinityMap || !name) return [];
    var results = [];
    Object.keys(GM.affinityMap).forEach(function(key) {
      var parts = key.split('|');
      if (parts[0] === name || parts[1] === name) {
        var other = parts[0] === name ? parts[1] : parts[0];
        results.push({ name: other, value: GM.affinityMap[key] });
      }
    });
    results.sort(function(a, b) { return Math.abs(b.value) - Math.abs(a.value); });
    return results;
  },

  /** 获取所有显著关系（|value| >= threshold）供 AI 上下文 */
  getSignificantRelations: function(threshold) {
    if (!GM.affinityMap) return [];
    threshold = threshold || 20;
    var results = [];
    Object.keys(GM.affinityMap).forEach(function(key) {
      var v = GM.affinityMap[key];
      if (Math.abs(v) >= threshold) {
        var parts = key.split('|');
        results.push({ a: parts[0], b: parts[1], value: v });
      }
    });
    results.sort(function(a, b) { return Math.abs(b.value) - Math.abs(a.value); });
    return results;
  },

  /** 月度亲疏自然衰减（极端关系缓慢趋向中性） */
  monthlyDecay: function() {
    if (!GM.affinityMap) return;
    // 衰减放缓·每两月才衰减一次（原每月 -1 太快、君恩/积怨归零太速）——让一次大恩/大怨管更久·可调
    if (typeof GM._affinityDecayTick !== 'number') GM._affinityDecayTick = 0;
    GM._affinityDecayTick += 1;
    if (GM._affinityDecayTick % 2 !== 0) return;
    Object.keys(GM.affinityMap).forEach(function(key) {
      var v = GM.affinityMap[key];
      if (v > 0) GM.affinityMap[key] = Math.max(0, v - 1);
      else if (v < 0) GM.affinityMap[key] = Math.min(0, v + 1);
      if (GM.affinityMap[key] === 0) delete GM.affinityMap[key];
    });
  }
};

SettlementPipeline.register('affinityDecay', '亲疏衰减', function() { AffinityMap.monthlyDecay(); }, 23, 'monthly');

// ============================================================
// 双轨好感系统（借鉴晚唐风云 dual-track opinion）
// 好感 = 基础好感(计算型，实时) + 事件好感(衰减型，积累)
// ============================================================
/**
 * 双轨好感系统
 * @namespace
 * @property {function(Object, Object):number} calculateBase - 基础好感
 * @property {function(string, string, number, string):void} addEventOpinion - 事件好感
 * @property {function(Object, Object):number} getTotal - 总好感
 * @property {function():void} decayAll - 月度衰减
 */
var OpinionSystem = {
  /**
   * 计算两个角色间的基础好感（实时计算，不存储）
   * 考虑：同势力/同党派/品级差/性格相似度
   */
  calculateBase: function(charA, charB) {
    if (!charA || !charB) return 0;
    var score = 0;
    // 同势力 +15
    if (charA.faction && charA.faction === charB.faction) score += 15;
    // 同党派 +10
    if (charA.party && charA.party === charB.party) score += 10;
    // 上下级关系 +5
    if (charA.superior === charB.name || charB.superior === charA.name) score += 5;
    // 忠诚度影响（对君主/上级，不硬编码头衔）
    if (charB.isPlayer || charB.isRuler || (charB.rankLevel && charB.rankLevel >= 28)) {
      score += Math.round((charA.loyalty - 50) * 0.3);
    }
    // 特质匹配（CK3式：同特质加分，对立特质减分）
    if (charA.traitIds && charB.traitIds && P.traitDefinitions) {
      var traitMap = {};
      P.traitDefinitions.forEach(function(t) { traitMap[t.id] = t; });
      charA.traitIds.forEach(function(aId) {
        var aDef = traitMap[aId];
        if (!aDef) return;
        charB.traitIds.forEach(function(bId) {
          if (aId === bId) {
            // 同特质好感
            score += aDef.opinionSame || 10;
          } else if (aDef.opposite === bId) {
            // 对立特质减分
            score += aDef.opinionOpposite || -10;
          }
        });
      });
    } else if (charA.personality && charB.personality) {
      // 回退：旧式文本匹配
      var simWords = 0;
      var aWords = charA.personality.split(/[,，、\s]+/);
      var bWords = charB.personality.split(/[,，、\s]+/);
      aWords.forEach(function(w) { if (bWords.indexOf(w) >= 0) simWords++; });
      score += simWords * 5;
    }
    // 正统性差值影响（接入 LegitimacySystem）
    if (typeof LegitimacySystem !== 'undefined' && LegitimacySystem.calcGapOpinion && charA.legitimacy && charB.legitimacy) {
      var expected = (typeof LegitimacySystem.getRankCap === 'function' && charB.rankLevel) ? LegitimacySystem.getRankCap(charB.rankLevel) : 50;
      score += LegitimacySystem.calcGapOpinion(charB.legitimacy, expected);
    }
    return clamp(score, -100, 100);
  },

  /**
   * 添加事件好感（带衰减，存入角色数据）
   * @param {string} charName - 目标角色名
   * @param {string} fromName - 来源角色名
   * @param {number} value - 好感变化（正/负）
   * @param {string} reason - 原因描述
   */
  addEventOpinion: function(charName, fromName, value, reason) {
    var char = findCharByName(charName);
    if (!char) return;
    if (!char._eventOpinions) char._eventOpinions = [];
    char._eventOpinions.push({
      from: fromName,
      value: value,
      reason: reason || '',
      turn: GM.turn
    });
    _dbg('[Opinion] ' + fromName + '→' + charName + ': ' + (value>0?'+':'') + value + ' (' + reason + ')');
  },

  /**
   * 获取总好感 = 基础 + 事件累积
   */
  getTotal: function(charA, charB) {
    // 防御：任一方为 undefined 直接返回 0（findCharByName 可能找不到已死/不存在的角色）
    if (!charA || !charB || !charA.name || !charB.name) return 0;
    var base = OpinionSystem.calculateBase(charA, charB);
    var eventSum = 0;
    if (charA._eventOpinions) {
      charA._eventOpinions.forEach(function(op) {
        if (op.from === charB.name) eventSum += op.value;
      });
    }
    // 加入亲疏关系网数据
    var affinity = (typeof AffinityMap !== 'undefined') ? AffinityMap.get(charA.name, charB.name) : 0;
    // 加入恩怨系统修正
    var enYuanMod = (typeof EnYuanSystem !== 'undefined') ? EnYuanSystem.getModifier(charA.name, charB.name) : 0;
    // 加入门生网络修正
    var patronMod = (typeof PatronNetwork !== 'undefined') ? PatronNetwork.getOpinionModifier(charA.name, charB.name) : 0;
    return clamp(base + eventSum + affinity + enYuanMod + patronMod, -100, 100);
  },

  /**
   * 月度衰减：事件好感每回合衰减 1 点趋向 0
   */
  decayAll: function() {
    if (!GM.chars) return;
    var _ms = _getDaysPerTurn() / 30; // 月比例
    GM.chars.forEach(function(char) {
      if (!char._eventOpinions) return;
      char._eventOpinions = char._eventOpinions.filter(function(op) {
        var d = 1 * _ms; // 月基准衰减1点
        if (op.value > 0) { op.value = Math.max(0, op.value - d); }
        else if (op.value < 0) { op.value = Math.min(0, op.value + d); }
        return Math.abs(op.value) >= 0.5; // 移除近零的
      });
    });
  },

  /** 导出所有角色的事件观感（存档用） */
  getAllEventOpinions: function() {
    var result = {};
    if (!GM.chars) return result;
    GM.chars.forEach(function(c) {
      if (c._eventOpinions && c._eventOpinions.length > 0) {
        result[c.name] = c._eventOpinions.slice();
      }
    });
    return result;
  },

  /** 恢复角色事件观感（读档用） */
  restoreEventOpinions: function(data) {
    if (!data || !GM.chars) return;
    GM.chars.forEach(function(c) {
      if (data[c.name]) c._eventOpinions = data[c.name];
    });
  }
};

// ============================================================
// 存档版本迁移系统（借鉴晚唐风云 migrations.ts）
// 存档带版本号，加载时自动运行迁移函数链升级旧存档
// ============================================================
/** @type {number} 当前存档版本号 */
var SAVE_VERSION = 6; // v6: phase 5 slice 1/2 (战斗 affectedArmies/payArrears/tactics) + phase 6 NPC 识别状态 (recognitionState/lastInteractionMemory)

var SaveMigrations = {
  migrations: [
    // v1 → v2: 添加 triggeredOffendEvents、_rngState 等新字段
    {
      from: 1, to: 2,
      migrate: function(data) {
        var gm = data.gameState;
        if (!gm) return data;
        if (!gm.triggeredOffendEvents) gm.triggeredOffendEvents = {};
        if (!gm.eraStateHistory) gm.eraStateHistory = [];
        if (gm.taxPressure === undefined) gm.taxPressure = 50;
        _dbg('[SaveMigration] v1 → v2: 补充新字段');
        return data;
      }
    },
    // v2 → v3: 全面升级Phase A-F新增字段
    {
      from: 2, to: 3,
      migrate: function(data) {
        var gm = data.gameState || data;
        if (!gm) return data;
        // Phase A: 战斗/行军/围城
        if (!gm.activeBattles) gm.activeBattles = [];
        if (!gm.battleHistory) gm.battleHistory = [];
        if (!gm.activeWars) gm.activeWars = [];
        if (!gm.treaties) gm.treaties = [];
        if (!gm.marchOrders) gm.marchOrders = [];
        if (!gm.activeSieges) gm.activeSieges = [];
        if (!gm._rngCheckpoints) gm._rngCheckpoints = [];
        // Phase B: 双层国库
        if (gm.stateTreasury === undefined) gm.stateTreasury = 0;
        if (gm.privateTreasury === undefined) gm.privateTreasury = 0;
        if (gm._bankruptcyTurns === undefined) gm._bankruptcyTurns = 0;
        // Phase C: 恩怨/门生
        if (!gm.enYuanRecords) gm.enYuanRecords = [];
        if (!gm.patronNetwork) gm.patronNetwork = [];
        // Phase D: 阴谋/事件冷却
        if (!gm.activeSchemes) gm.activeSchemes = [];
        if (!gm.schemeCooldowns) gm.schemeCooldowns = {};
        if (!gm.eventCooldowns) gm.eventCooldowns = {};
        // Phase E: 年度编年史
        if (!gm.yearlyChronicles) gm.yearlyChronicles = [];
        _dbg('[SaveMigration] v2 → v3: 全面升级字段补充');
        return data;
      }
    },
    // v3 → v4: 角色完整字段（zi/性别/家族成员/仕途/内心独白/压力源/族望）
    {
      from: 3, to: 4,
      migrate: function(data) {
        var gm = (data.gameState && (data.gameState.GM || data.gameState)) || data.gameState || data;
        if (!gm || !Array.isArray(gm.chars)) return data;
        if (typeof CharFullSchema !== 'undefined' && typeof CharFullSchema.ensureAll === 'function') {
          var n = CharFullSchema.ensureAll(gm.chars);
          _dbg('[SaveMigration] v3 → v4: 角色完整字段补齐 ' + n + ' 位');
        } else {
          // CharFullSchema 未加载——保底手工补：zi/gender/familyMembers/career/stressSources
          gm.chars.forEach(function(ch) {
            if (!ch) return;
            if (ch.zi === undefined) ch.zi = ch.courtesyName || '';
            if (ch.gender === undefined) ch.gender = 'male';
            if (!Array.isArray(ch.familyMembers)) ch.familyMembers = [];
            if (!Array.isArray(ch.career)) ch.career = [];
            if (!Array.isArray(ch.stressSources)) ch.stressSources = [];
            if (ch.innerThought === undefined) ch.innerThought = '';
            if (ch.clanPrestige === undefined) ch.clanPrestige = 50;
            if (ch.management === undefined) ch.management = ch.administration || 50;
          });
          _dbg('[SaveMigration] v3 → v4: CharFullSchema 未就绪，使用保底补齐');
        }
        return data;
      }
    },
    // v4 → v5: 融合补强——NPC事件队列/官职深化/区划深化
    {
      from: 4, to: 5,
      migrate: function(data) {
        var gs = data.gameState || data;
        var gm = gs && (gs.GM || gs);
        var p  = gs && gs.P;
        if (!gm) return data;
        // NPC 事件反应队列
        if (!gm._pendingEventReactions) gm._pendingEventReactions = [];
        if (!gm._eventDetectCooldown) gm._eventDetectCooldown = {};
        // 变更日志（applyAITurnChanges）
        if (!gm.turnChanges) gm.turnChanges = {variables:[],characters:[],factions:[],parties:[],classes:[],military:[],map:[]};
        if (!gm.turnChanges.variables) gm.turnChanges.variables = [];
        // 官职深化字段在 GM.officeTree 内，遍历补齐默认值
        var _fix = function(positions){
          (positions||[]).forEach(function(pos){
            if (!pos) return;
            if (!pos.publicTreasuryInit) pos.publicTreasuryInit = {money:0,grain:0,cloth:0,quotaMoney:0,quotaGrain:0,quotaCloth:0};
            if (!pos.privateIncome) pos.privateIncome = {legalSalary:pos.salary||'',bonusType:'',bonusNote:'',illicitRisk:'medium'};
            if (!pos.powers) pos.powers = {appointment:false,yinBu:false,impeach:false,supervise:false,taxCollect:false,militaryCommand:false};
            if (!pos.hooks) pos.hooks = {triggerOnLowTreasury:'',triggerOnUnrest:'',triggerOnHeavenSign:'',tenureYears:0};
            if (pos.bindingHint === undefined) pos.bindingHint = '';
          });
        };
        var _walk = function(nodes){ (nodes||[]).forEach(function(n){ if (!n) return; _fix(n.positions); if (n.subs) _walk(n.subs); }); };
        _walk(gm.officeTree);
        if (p && p.officeTree) _walk(p.officeTree);
        if (p && p.government && p.government.nodes) _walk(p.government.nodes);
        // 区划深化 —— 遍历 adminHierarchy（runtime + preset）
        var _divFix = function(divs){
          (divs||[]).forEach(function(d){
            if (!d) return;
            if (typeof d.population === 'number') d.population = {total:d.population, households:0, mouths:d.population, ding:0};
            if (!d.population) d.population = {households:0,mouths:0,ding:0};
            if (!d.minxinDetails) d.minxinDetails = {};
            if (!d.corruption) d.corruption = {local:0};
            if (!d.publicTreasury) d.publicTreasury = {money:{stock:0},grain:{stock:0},cloth:{stock:0}};
            if (!d.fiscal) d.fiscal = {claimedRevenue:0,actualRevenue:0,remittedToCenter:0,retainedBudget:0,compliance:1.0};
            if (!d.environment) d.environment = {carryingCapacity:{arable:0,water:0,climate:0,currentLoad:0}};
            if (d.children) _divFix(d.children);
          });
        };
        if (p && p.adminHierarchy) {
          Object.keys(p.adminHierarchy).forEach(function(fid){
            var h = p.adminHierarchy[fid];
            if (h && h.divisions) _divFix(h.divisions);
          });
        }
        _dbg('[SaveMigration] v4 → v5: 融合补强字段齐备');
        return data;
      }
    },
    // v5 → v6: phase 5 slice 1/2 战斗 + phase 6 NPC 识别状态
    {
      from: 5, to: 6,
      migrate: function(data) {
        var gs = data.gameState || data;
        var gm = gs && (gs.GM || gs);
        if (!gm) return data;
        // phase 6: NPC.recognitionState / lastInteractionMemory
        if (Array.isArray(gm.chars)) {
          if (typeof CharFullSchema !== 'undefined' && typeof CharFullSchema.ensureAll === 'function') {
            var n = CharFullSchema.ensureAll(gm.chars);
            _dbg('[SaveMigration] v5 → v6: phase 6 NPC 字段·CharFullSchema 补 ' + n + ' 位');
          } else {
            gm.chars.forEach(function(ch) {
              if (!ch) return;
              if (ch.recognitionState === undefined) {
                ch.recognitionState = {
                  subject: ch.name || '', familiarity: 0, level: 'unknown',
                  lastTurn: 0, lastEvent: '', lastEmotion: '', lastType: '',
                  lastSource: '', lastWho: '', summary: '', history: []
                };
              }
              if (ch.lastInteractionMemory === undefined) ch.lastInteractionMemory = null;
            });
            _dbg('[SaveMigration] v5 → v6: CharFullSchema 未就绪·使用保底 phase 6 init');
          }
        }
        // phase 5 slice 2: battleResult.affectedArmies
        ['activeBattles', 'battleHistory'].forEach(function(k) {
          if (Array.isArray(gm[k])) {
            gm[k].forEach(function(b) {
              if (b && !Array.isArray(b.affectedArmies)) b.affectedArmies = [];
            });
          }
        });
        // phase 5 slice 1: payArrears / tactics
        if (!gm.payArrears) gm.payArrears = {};
        if (!gm.tactics) gm.tactics = {};
        // phase 3: influenceGroupState 兜底
        if (!gm.influenceGroupState) gm.influenceGroupState = {};
        return data;
      }
    }
  ],

  /** 运行迁移链：从存档版本自动升级到当前版本 */
  run: function(data) {
    var ver = (data._saveVersion || 1);
    if (ver >= SAVE_VERSION) return data; // 已是最新
    _dbg('[SaveMigration] 存档版本 ' + ver + ' → ' + SAVE_VERSION);
    SaveMigrations.migrations.forEach(function(m) {
      if (ver >= m.from && ver < m.to) {
        data = m.migrate(data);
        ver = m.to;
      }
    });
    data._saveVersion = SAVE_VERSION;
    return data;
  },

  /** 在保存时打上版本号 */
  stamp: function(data) {
    data._saveVersion = SAVE_VERSION;
    return data;
  }
};

// ============================================================
// 面子系统（Face/Honor）
// ============================================================

var FaceSystem = {
  /**
   * 获取角色面子值（0-100）
   * 存储在 character._face 字段
   */
  getFace: function(character) {
    if (!character) return 50;
    if (character._face === undefined) character._face = 60; // 初始60
    return character._face;
  },

  /**
   * 修改面子值
   * @param {Object} character
   * @param {number} delta - 正=获得面子，负=丢面子
   * @param {string} reason
   */
  changeFace: function(character, delta, reason) {
    if (!character) return;
    if (character._face === undefined) character._face = 60;
    var oldFace = character._face;
    character._face = clamp(character._face + delta, 0, 100);
    if (Math.abs(delta) >= 10) {
      _dbg('[Face] ' + character.name + ' 面子' + (delta>0?'+':'') + delta + '(' + reason + ') ' + oldFace + '→' + character._face);
    }
  },

  /**
   * 公开受辱（当众被贬/弹劾/失败）
   */
  publicHumiliation: function(character, reason) {
    FaceSystem.changeFace(character, -20, reason || '公开受辱');
    if (typeof EnYuanSystem !== 'undefined' && character._lastHumiliatedBy) {
      EnYuanSystem.add('yuan', character.name, character._lastHumiliatedBy, 2, reason || '公开受辱');
    }
    if (character.stress !== undefined) character.stress = Math.min(100, (character.stress||0) + 15);
  },

  /**
   * 公开受赏（当众嘉奖/升迁）
   */
  publicHonor: function(character, reason) {
    FaceSystem.changeFace(character, 15, reason || '公开受赏');
    if (typeof EnYuanSystem !== 'undefined' && character._lastHonoredBy) {
      EnYuanSystem.add('en', character.name, character._lastHonoredBy, 2, reason || '公开受赏');
    }
  },

  /**
   * 每回合面子自然回复
   */
  naturalRecovery: function() {
    if (!GM.chars) return;
    var decayRate = (P.opinionConfig && P.opinionConfig.faceDecayRate) || 0.02;
    var _ms = _getDaysPerTurn() / 30; // 月比例
    GM.chars.forEach(function(c) {
      if (c.alive === false) return;
      if (c._face === undefined) return;
      if (c._face < 60) {
        c._face = Math.min(60, c._face + (60 - c._face) * decayRate * _ms);
      }
    });
  },

  /**
   * 获取面子状态文本
   */
  getFaceText: function(character) {
    var f = FaceSystem.getFace(character);
    if (f >= 80) return '面子:如日中天';
    if (f >= 60) return '面子:体面';
    if (f >= 40) return '面子:低落';
    if (f >= 20) return '面子:颜面尽失';
    return '面子:奇耻大辱';
  }
};

// 注册面子回复到SettlementPipeline
SettlementPipeline.register('faceRecovery', '面子回复', function() { FaceSystem.naturalRecovery(); }, 23, 'perturn');

// ============================================================
// 注册结算步骤到 SettlementPipeline
// ============================================================
// monthly 步骤：每月子tick执行（经济/人事/社会类）
SettlementPipeline.register('variables', '变量更新', function(ctx) { updateVariables(ctx.timeRatio); }, 10, 'monthly');
SettlementPipeline.register('eraState', '时代状态', function() { updateEraState(); }, 15, 'monthly');
SettlementPipeline.register('relations', '关系更新', function() { updateRelations(); }, 20, 'monthly');
SettlementPipeline.register('opinionDecay', '好感衰减', function() { OpinionSystem.decayAll(); }, 22, 'monthly');
SettlementPipeline.register('postPerf', '岗位考绩', function() { if(GM.postSystem&&GM.postSystem.enabled) updatePostPerformance(); }, 25, 'monthly');
// perturn 步骤：每回合末执行一次（与 AI 推演结果配合的全局结算）
SettlementPipeline.register('changeQueue', '数据变化队列', function() { processChangeQueue(); }, 92, 'perturn');
SettlementPipeline.register('clearCache', '清空查询缓存', function() { WorldHelper.clearCache(); }, 95, 'perturn');

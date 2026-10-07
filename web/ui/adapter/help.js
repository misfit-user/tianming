// 帮助：内核 HelpSystem.topics（tm-help-social.js）里与界面无关的几卷照用（概览与模式、诏书问对、游戏系统、游戏技巧、AI 密钥、历代典范），
// 讲老界面布局的几卷（界面说明、快捷键、游戏玩法里的「行录」流程）不用——那几样由新前端按身份档另写（screens/help.js）。
// 内核的卷是写死的 HTML：去掉行内样式（老界面的配色变量新前端没有）、标题前的图标；提老界面位置的话改成新前端的位置。
const w = window;

const PICK = [['overview', '概览与模式'], ['edictQA', ''], ['systems', ''], ['tips', ''], ['apikey', ''], ['classics', '']];
const FIX = [[/或游戏内右栏「设置」→「API 连接」/g, '或局中顶栏「典」→「API 连接」'], [/可以在AI性能面板查看统计/g, '可在典章里查看']];
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}]\u{FE0F}?\s*/gu;

// 「历代典范」一卷没有写死的正文，内核开卷时现从 HistoricalPresets 拼（_buildClassicsHelpContent）
function contentOf(k, t) {
  if (t.dynamicRender && k === 'classics' && typeof w._buildClassicsHelpContent === 'function') return String(w._buildClassicsHelpContent() || '');
  return String(t.content || '');
}

export function topics() {
  const hs = w.HelpSystem && w.HelpSystem.topics;
  if (!hs) return [];
  return PICK.filter(([k]) => hs[k]).map(([k, name]) => {
    let html = contentOf(k, hs[k]).replace(/\sstyle="[^"]*"/g, '').replace(EMOJI, '');
    for (const [re, to] of FIX) html = html.replace(re, to);
    return { key: k, title: name || String(hs[k].title || k).replace(/^[^一-龥A-Za-z]+/u, '').trim(), html };
  });
}

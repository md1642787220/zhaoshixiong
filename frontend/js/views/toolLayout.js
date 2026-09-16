/* ============================================================
 * views/toolLayout.js - 工具详情页公共布局（面包屑 + 侧边导航 + 面板）
 * ============================================================ */
import { TOOLS, getTool } from '../data/tools.js';
import { icon } from '../components/icon.js';
import { featureIntro } from '../components/featureIntro.js';

/**
 * 生成工具详情页布局
 * @param {string} toolId  当前工具 id
 * @param {string} bodyHtml 面板内容 HTML
 */
export function toolPage(toolId, bodyHtml) {
  const tool = getTool(toolId);
  if (!tool) return '';

  const headTag = tool.closed ? '<span class="tool-tag">未开放</span>' : '';
  const notice = tool.closed
    ? '<div class="tool-notice">该功能尚未开放，以下界面为功能预览，敬请期待。</div>'
    : '';

  return `
  <div class="page-head">
    <div class="breadcrumb"><a href="#/">首页</a> / <a href="#/tools">工具板块</a> / ${tool.name}</div>
    <h1>${icon(tool.icon, 28)} ${tool.name}${headTag}</h1>
    <p class="sub">${tool.desc}</p>
  </div>
  <div class="tool-layout">
    <aside class="card tool-nav">
      ${TOOLS.map(t => `<a href="#${t.path}" class="${t.id === toolId ? 'active' : ''}${t.closed ? ' is-closed' : ''}">${icon(t.icon, 18)} ${t.name}${t.closed ? '<span class="tool-tag tool-tag-sm">未开放</span>' : ''}</a>`).join('')}
    </aside>
    <div class="card tool-panel">
      ${notice}
      ${featureIntro(tool.intro)}
      ${bodyHtml}
    </div>
  </div>`;
}

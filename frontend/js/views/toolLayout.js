/* ============================================================
 * views/toolLayout.js - 工具详情页公共布局（面包屑 + 侧边导航 + 面板）
 * ============================================================ */
import { TOOLS, getTool } from '../data/tools.js';
import { icon } from '../components/icon.js';

/**
 * 生成工具详情页布局
 * @param {string} toolId  当前工具 id
 * @param {string} bodyHtml 面板内容 HTML
 */
export function toolPage(toolId, bodyHtml) {
  const tool = getTool(toolId);
  if (!tool) return '';

  return `
  <div class="page-head">
    <div class="breadcrumb"><a href="#/">首页</a> / <a href="#/tools">工具板块</a> / ${tool.name}</div>
    <h1>${icon(tool.icon, 28)} ${tool.name}</h1>
    <p class="sub">${tool.desc}</p>
  </div>
  <div class="tool-layout">
    <aside class="card tool-nav">
      ${TOOLS.map(t => `<a href="#${t.path}" class="${t.id === toolId ? 'active' : ''}">${icon(t.icon, 18)} ${t.name}</a>`).join('')}
    </aside>
    <div class="card tool-panel">
      ${bodyHtml}
    </div>
  </div>`;
}

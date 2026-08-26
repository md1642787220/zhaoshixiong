/* ============================================================
 * views/tools.js - 工具板块列表页
 * ============================================================ */
import { TOOLS } from '../data/tools.js';
import { icon } from '../components/icon.js';

function toolCard(t) {
  return `
  <div class="card tool-card">
    <div class="card-icon">${icon(t.icon, 26)}</div>
    <h3>${t.name}</h3>
    <p class="desc">${t.desc}</p>
    <div class="card-meta">
      <a class="card-link" href="#${t.path}">立即使用</a>
    </div>
  </div>`;
}

export default {
  title: '工具板块 · Helper 助手',
  nav: '/tools',

  render() {
    return `
    <div class="page-head">
      <div class="breadcrumb"><a href="#/">首页</a> / 工具板块</div>
      <h1>${icon('toolbox', 28)} 工具板块</h1>
      <p class="sub">四大实用工具，覆盖日常办公高频场景</p>
    </div>
    <div class="grid-4">${TOOLS.map(toolCard).join('')}</div>`;
  },
};

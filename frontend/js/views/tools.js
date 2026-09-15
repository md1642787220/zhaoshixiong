/* ============================================================
 * views/tools.js - 工具板块列表页
 * toolCard 同时被首页复用，未开放工具统一在此追加角标。
 * ============================================================ */
import { TOOLS } from '../data/tools.js';
import { icon } from '../components/icon.js';
import { esc } from '../utils.js';

/** 工具卡片（工具板块与首页共用）；未开放工具追加「未开放」角标与右上角红叉 */
export function toolCard(t) {
  const tag = t.closed ? '<span class="tool-tag">未开放</span>' : '';
  return `
  <a class="card tool-card${t.closed ? ' is-closed is-unimplemented' : ''}" href="#${t.path}"${t.closed ? ' title="该功能尚未实现"' : ''}>
    <div class="card-icon">${icon(t.icon, 26)}</div>
    <h3>${esc(t.name)}${tag}</h3>
    <p class="desc">${esc(t.desc)}</p>
  </a>`;
}

export default {
  title: '工具板块 · 师兄',
  nav: '/tools',

  render() {
    return `
    <div class="page-head">
      <div class="breadcrumb"><a href="#/">首页</a> / 工具板块</div>
      <h1>${icon('toolbox', 28)} 工具板块</h1>
      <p class="sub">覆盖日常办公高频场景，无需安装即可在线使用</p>
    </div>
    <div class="grid-4">${TOOLS.map(toolCard).join('')}</div>`;
  },
};

/* ============================================================
 * views/category.js - 学习分类详情页
 * ============================================================ */
import { learnApi } from '../api/learn.js';
import { icon } from '../components/icon.js';
import { esc, toast } from '../utils.js';

function resourceTable(resources) {
  return `
  <div style="overflow-x:auto;">
  <table class="resource-table">
    <thead>
      <tr><th>资源名称</th><th>类型</th><th>格式</th><th>大小</th><th>操作</th></tr>
    </thead>
    <tbody>
      ${resources.map(r => `
      <tr>
        <td>
          <div class="r-title">${esc(r.title)}</div>
          <div class="r-summary">${esc(r.summary)}</div>
        </td>
        <td><span class="tag tag-${r.type}">${r.type}</span></td>
        <td>${r.format}</td>
        <td>${r.size}</td>
        <td><button class="btn btn-ghost btn-sm js-view">查看</button></td>
      </tr>`).join('')}
    </tbody>
  </table>
  </div>`;
}

export default {
  nav: '/learn',

  render() {
    return `
    <div class="page-head">
      <div class="breadcrumb"><a href="#/">首页</a> / <a href="#/learn">学习板块</a></div>
    </div>
    <div id="category-body"><div class="loadbox">加载中…</div></div>`;
  },

  async mount({ id }) {
    const body = document.getElementById('category-body');
    try {
      const cat = await learnApi.category(id);
      document.title = `${cat.name} · 师兄`;
      body.innerHTML = `
      <div class="card" style="padding:26px 28px;">
        <div class="category-head">
          <div class="card-icon">${icon(cat.icon, 30)}</div>
          <div>
            <h1 style="font-size:24px;">${esc(cat.name)}</h1>
            <p class="sub" style="color:var(--text-light); margin-top:4px;">${esc(cat.description)}</p>
          </div>
        </div>
        ${resourceTable(cat.resources)}
      </div>`;

      body.querySelectorAll('.js-view').forEach(btn => {
        btn.addEventListener('click', () => toast('资源整理中，敬请期待'));
      });
    } catch (e) {
      body.innerHTML = `<div class="banner warn">加载失败：${esc(e.message)}</div>`;
    }
  },
};

/* ============================================================
 * views/learn.js - 学习板块列表页
 * ============================================================ */
import { learnApi } from '../api/learn.js';
import { icon } from '../components/icon.js';
import { esc } from '../utils.js';

function learnCard(c) {
  return `
  <a class="card learn-card" href="#/learn/${c.id}">
    <div class="card-icon">${icon(c.icon, 26)}</div>
    <h3>${esc(c.name)}</h3>
    <p class="desc">${esc(c.description)}</p>
    <div class="card-meta">
      <span class="badge">${c.count} 项资源</span>
      <span class="card-link">进入专区</span>
    </div>
  </a>`;
}

export default {
  title: '学习板块 · 师兄',
  nav: '/learn',

  render() {
    return `
    <div class="page-head">
      <div class="breadcrumb"><a href="#/">首页</a> / 学习板块</div>
      <h1>${icon('book-open', 28)} 学习板块</h1>
      <p class="sub">五大专属专区，办公技能与考试提升持续充电</p>
    </div>
    <div class="grid-4" id="learn-grid"><div class="loadbox">加载中…</div></div>`;
  },

  async mount() {
    const grid = document.getElementById('learn-grid');
    const list = await learnApi.categories();
    grid.innerHTML = list.map(learnCard).join('');
  },
};

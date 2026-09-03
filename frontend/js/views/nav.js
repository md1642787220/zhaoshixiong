/* ============================================================
 * views/nav.js - 网址导航页
 * 支持：分类浏览（政府 / 教育）+ 关键词搜索 + 按地区筛选。
 * ============================================================ */
import { navApi } from '../api/nav.js';
import { icon } from '../components/icon.js';
import { esc } from '../utils.js';

function statusInfo(s) {
  if (!s.status) return { cls: 'pending', text: '待校验' };
  if (s.status === 'ok') return { cls: 'ok', text: '可访问' };
  if (s.status === 'unreachable') return { cls: 'bad', text: '暂不可达' };
  return { cls: 'warn', text: '待确认' };
}

function siteCard(s) {
  const st = statusInfo(s);
  return `
  <a class="site-card" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">
    <div class="site-head">
      <span class="site-name">${esc(s.name)}</span>
      <span class="status-dot ${st.cls}" title="${st.text}"></span>
    </div>
    <p class="site-desc">${esc(s.description || '')}</p>
    <div class="site-foot">
      <span class="site-region">${esc(s.region || '全国')}</span>
      ${s.level ? `<span class="site-level">${esc(s.level)}</span>` : ''}
      <span class="site-go">访问 →</span>
    </div>
  </a>`;
}

export default {
  title: '网址导航 · 师兄',
  nav: '/nav',

  render() {
    return `
    <div class="page-head">
      <div class="breadcrumb"><a href="#/">首页</a> / 网址导航</div>
      <h1>${icon('globe', 28)} 网址导航</h1>
      <p class="sub">收录全国各地政府官方网站，以及各地教育机构和学校官方网站，链接定期校验更新</p>
    </div>
    <div class="nav-toolbar">
      <div class="kind-tabs" id="navCats"></div>
      <div class="nav-filters">
        <div class="nav-search-wrap">
          ${icon('search', 16)}
          <input class="input" id="navSearch" placeholder="搜索站点名称 / 网址 / 关键词…">
        </div>
        <select class="input nav-region" id="navRegion">
          <option value="全部">全部地区</option>
        </select>
      </div>
    </div>
    <div class="grid-4" id="navGrid"><div class="loadbox">加载中…</div></div>`;
  },

  async mount() {
    const state = { category: null, region: '全部', q: '' };
    const catsEl = document.getElementById('navCats');
    const grid = document.getElementById('navGrid');
    const searchEl = document.getElementById('navSearch');
    const regionEl = document.getElementById('navRegion');

    const cats = await navApi.categories();
    if (!cats.length) { grid.innerHTML = '<p class="empty">暂无导航数据</p>'; return; }
    state.category = cats[0].id;

    catsEl.innerHTML = cats.map((c) => `
      <button type="button" class="kind-tab${c.id === state.category ? ' active' : ''}" data-cat="${c.id}">${esc(c.name)}</button>
    `).join('');

    async function loadRegions() {
      const regions = await navApi.regions(state.category);
      regionEl.innerHTML = '<option value="全部">全部地区</option>' +
        regions.map((r) => `<option value="${esc(r)}"${r === state.region ? ' selected' : ''}>${esc(r)}</option>`).join('');
    }

    async function loadSites() {
      grid.innerHTML = '<div class="loadbox">加载中…</div>';
      try {
        const sites = await navApi.sites({ category: state.category, region: state.region, q: state.q });
        grid.innerHTML = sites.length
          ? sites.map(siteCard).join('')
          : '<div class="empty">没有匹配的站点，换个关键词或地区试试</div>';
      } catch (e) {
        grid.innerHTML = `<div class="empty">加载失败：${esc(e.message)}</div>`;
      }
    }

    catsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.kind-tab');
      if (!btn) return;
      state.category = btn.dataset.cat;
      state.region = '全部';
      catsEl.querySelectorAll('.kind-tab').forEach((t) => t.classList.toggle('active', t === btn));
      loadRegions().then(loadSites);
    });
    regionEl.addEventListener('change', () => { state.region = regionEl.value; loadSites(); });

    let timer;
    searchEl.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => { state.q = searchEl.value.trim(); loadSites(); }, 250);
    });

    await loadRegions();
    await loadSites();
  },
};

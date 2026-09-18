/* ============================================================
 * views/navHub.js - 常用导航
 * 数据：js/data/navhub.js（由 scripts/crawl-navhub.mjs 抓取生成）
 * 交互：左侧一级分类切换 + 右侧子分类分组网格；顶部跨全站搜索。
 *
 * 布局：宽屏下放宽容器并自适应多列，每个一级分类有专属主题色，
 *       随窗口尺寸自动回流（详见 css/navhub.css）。
 * 数据量较大（3000+ 站点），故在 mount 时才动态 import。
 * ============================================================ */
import { icon } from '../components/icon.js';
import { esc } from '../utils.js';

const $ = (sel, root = document) => root.querySelector(sel);

/** 一级分类的主题色相（低饱和，与站点整体色调协调） */
const HUES = [212, 168, 26, 268, 148, 340, 196, 12, 178, 48, 300, 96, 238, 322];
const accentOf = (i) => `hsl(${HUES[i % HUES.length]} 44% 54%)`;
const accentSoftOf = (i) => `hsl(${HUES[i % HUES.length]} 44% 95%)`;

/**
 * 一级分类图标：按分类名关键词匹配（越具体越靠前）。
 * 源数据里多为 📁 或无图标，这里替换为与分类语义相符的彩色图标。
 */
const CAT_ICON_RULES = [
  { re: /设计|后期/, icon: '🎨' },
  { re: /影视|动漫|直播|纪录/, icon: '🎬' },
  { re: /电子书|漫画|音乐|听书/, icon: '📚' },
  { re: /磁力|BT/i, icon: '🧲' },
  { re: /AI/i, icon: '🤖' },
  { re: /电脑/, icon: '💻' },
  { re: /手机/, icon: '📱' },
  { re: /学习/, icon: '🎓' },
  { re: /考证|考级/, icon: '📝' },
  { re: /实用导航/, icon: '🧭' },
  { re: /冷门/, icon: '💎' },
  { re: /常用网站/, icon: '🌐' },
  { re: /工具|查询/, icon: '🔧' },
  { re: /游戏|解压|摸鱼/, icon: '🎮' },
  { re: /福利|资源/, icon: '🎁' },
];

/** 取分类图标：优先关键词规则，其次源图标（非 📁），最后兜底 */
function iconFor(name, fallback) {
  const hit = CAT_ICON_RULES.find((r) => r.re.test(name));
  if (hit) return hit.icon;
  const f = String(fallback || '').trim();
  return f && f !== '📁' ? f : '📌';
}

/** 取站点域名用于展示 */
function hostOf(url) {
  try { return new URL(url).host.replace(/^www\./, ''); } catch { return url; }
}

/** 站点卡片 */
function siteCard(s, catLabel = '') {
  const tip = catLabel ? `${s.name}\n${s.url}\n分类：${catLabel}` : `${s.name}\n${s.url}`;
  return `<a class="nh-site" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" title="${esc(tip)}">
    <span class="nh-site-name">${esc(s.name)}</span>
    ${catLabel ? `<span class="nh-site-cat">${esc(catLabel)}</span>` : ''}
    <span class="nh-site-host">${esc(hostOf(s.url))}</span>
  </a>`;
}

/** 一个分组：标题用分类自身名称，所属路径单独标注（层级归属更精准） */
function groupHtml(title, sites, catLabel = '', pathLabel = '') {
  if (!sites.length) return '';
  return `<section class="nh-group">
    <h3 class="nh-group-title">
      <span class="nh-dot" aria-hidden="true"></span>
      <span class="nh-group-name">${esc(title)}</span>
      ${pathLabel ? `<span class="nh-group-path">${esc(pathLabel)}</span>` : ''}
      <span class="nh-group-count">${sites.length}</span>
    </h3>
    <div class="nh-grid">${sites.map((s) => siteCard(s, catLabel)).join('')}</div>
  </section>`;
}

/**
 * 递归收集分组：每组保留「自身名称」+「所属路径」，而不是把父子名拼成一长串，
 * 这样每一组归在哪一层一目了然（深度 ≥2 的组会显示来源路径）。
 */
function collectGroups(node, parentPath, out) {
  if (node.sites && node.sites.length) {
    out.push({ name: node.name, path: parentPath, sites: node.sites });
  }
  const childPath = parentPath ? `${parentPath} › ${node.name}` : node.name;
  (node.children || []).forEach((ch) => collectGroups(ch, childPath, out));
}

/** 渲染某个一级分类（含任意深度子分类；直接挂在该分类下的站点归入「综合」） */
function categoryHtml(cat) {
  const groups = [];
  if (cat.sites && cat.sites.length) groups.push({ name: '综合', path: '', sites: cat.sites });
  (cat.children || []).forEach((ch) => collectGroups(ch, '', groups));
  return groups.map((g) => groupHtml(g.name, g.sites, '', g.path)).join('')
    || '<p class="empty">该分类暂无网站</p>';
}

/** 递归收集全部站点，附带所属分类路径（用于搜索） */
function flattenAll(categories) {
  const out = [];
  const walk = (list, parentPath) => {
    list.forEach((c) => {
      const path = parentPath ? `${parentPath} / ${c.name}` : c.name;
      (c.sites || []).forEach((s) => out.push({ ...s, cat: path }));
      walk(c.children || [], path);
    });
  };
  walk(categories, '');
  return out;
}

export default {
  title: '常用导航 · 师兄',
  nav: '/nav',

  render() {
    return `
    <div class="page-head">
      <div class="breadcrumb"><a href="#/">首页</a> / 常用导航</div>
      <h1>${icon('globe', 28)} 常用导航 <span class="count-tag" id="nh-total">…</span></h1>
      <p class="sub">精选优质网站，覆盖学习、办公、AI 工具、查询工具等，按分类浏览或直接搜索。</p>
    </div>

    <div class="card nh-hero">
      <div class="nh-hero-inner">
        <div class="nh-searchbox">
          <span class="nh-search-icon">${icon('search', 18)}</span>
          <input id="nh-q" class="nh-search" type="search"
            placeholder="搜索网站名称或网址，如「翻译」「PDF」「字典」" disabled>
        </div>
        <div class="nh-hero-meta" id="nh-hint">加载中…</div>
      </div>
    </div>

    <div class="nh-layout">
      <aside class="card nh-cats" id="nh-cats"><p class="empty">加载中…</p></aside>
      <section class="nh-main" id="nh-main"><p class="empty">正在加载导航数据…</p></section>
    </div>`;
  },

  async mount() {
    const mainEl = $('#nh-main');
    const catsEl = $('#nh-cats');
    const qEl = $('#nh-q');
    const hintEl = $('#nh-hint');
    const totalEl = $('#nh-total');
    if (!mainEl) return;

    let NAVHUB;
    try {
      ({ NAVHUB } = await import('../data/navhub.js'));
    } catch (e) {
      mainEl.innerHTML = `<p class="empty">导航数据加载失败：${esc(e.message)}</p>`;
      return;
    }
    if (!mainEl.isConnected) return; // 数据加载期间用户已离开本页

    let allSites = null; // 搜索用，延迟构建
    let activeId = NAVHUB.categories[0] ? NAVHUB.categories[0].id : null;

    totalEl.textContent = `${NAVHUB.totalSites} 个网站`;
    hintEl.textContent = `${NAVHUB.categories.length} 大类 · ${NAVHUB.totalCategories} 个分类 · ${NAVHUB.totalSites} 个站点`;
    qEl.disabled = false;

    /** 渲染左侧分类（每个分类带专属色相） */
    catsEl.innerHTML = NAVHUB.categories.map((c, i) => `
      <button type="button" class="nh-cat${c.id === activeId ? ' active' : ''}" data-cat="${esc(c.id)}"
        style="--nh-accent:${accentOf(i)};--nh-accent-soft:${accentSoftOf(i)}">
        <span class="nh-cat-icon">${esc(iconFor(c.name, c.icon))}</span>
        <span class="nh-cat-name">${esc(c.name)}</span>
        <span class="nh-cat-count">${c.count}</span>
      </button>`).join('');

    /** 渲染右侧内容，并把该分类的主题色注入容器 */
    const renderCategory = (id) => {
      const idx = NAVHUB.categories.findIndex((c) => c.id === id);
      const cat = NAVHUB.categories[idx];
      mainEl.style.setProperty('--nh-accent', accentOf(idx));
      mainEl.style.setProperty('--nh-accent-soft', accentSoftOf(idx));
      mainEl.innerHTML = cat ? categoryHtml(cat) : '';
    };

    catsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.nh-cat');
      if (!btn) return;
      activeId = btn.dataset.cat;
      catsEl.querySelectorAll('.nh-cat').forEach((b) => b.classList.toggle('active', b === btn));
      qEl.value = '';
      hintEl.textContent = `${NAVHUB.categories.length} 大类 · ${NAVHUB.totalCategories} 个分类 · ${NAVHUB.totalSites} 个站点`;
      renderCategory(activeId);
    });

    let timer;
    qEl.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const q = qEl.value.trim().toLowerCase();
        if (!q) {
          hintEl.textContent = `${NAVHUB.categories.length} 大类 · ${NAVHUB.totalCategories} 个分类 · ${NAVHUB.totalSites} 个站点`;
          renderCategory(activeId);
          return;
        }
        if (!allSites) allSites = flattenAll(NAVHUB.categories);
        const hits = allSites.filter((s) => s.name.toLowerCase().includes(q) || s.url.toLowerCase().includes(q));
        hintEl.textContent = `找到 ${hits.length} 个站点`;
        if (!hits.length) {
          mainEl.innerHTML = `<p class="empty">没有找到与「${esc(qEl.value.trim())}」相关的网站，换个关键词试试</p>`;
          return;
        }
        const LIMIT = 300;
        const shown = hits.slice(0, LIMIT);
        mainEl.style.setProperty('--nh-accent', 'var(--primary)');
        mainEl.style.setProperty('--nh-accent-soft', 'var(--primary-light)');
        mainEl.innerHTML = groupHtml('搜索结果', shown, '')
          + (hits.length > LIMIT ? `<p class="nh-more">仅显示前 ${LIMIT} 条，共 ${hits.length} 条，请输入更精确的关键词</p>` : '');
        // 搜索结果补上所属分类标签
        const links = mainEl.querySelectorAll('.nh-site');
        shown.forEach((s, i) => {
          if (links[i]) {
            const tag = document.createElement('span');
            tag.className = 'nh-site-cat';
            tag.textContent = s.cat;
            links[i].insertBefore(tag, links[i].querySelector('.nh-site-host'));
          }
        });
      }, 200);
    });

    renderCategory(activeId);
  },
};

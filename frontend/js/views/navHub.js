/* ============================================================
 * views/navHub.js - 常用导航
 * 数据：js/data/navhub.js（由 scripts/crawl-navhub.mjs 抓取生成）
 * 交互：左侧一级分类切换 + 右侧子分类分组网格；顶部跨全站搜索。
 *
 * 布局：宽屏下放宽容器并自适应多列，每个一级分类有专属主题色，
 *       随窗口尺寸自动回流（详见 css/navhub.css）。
 * 图标：每个站点优先显示站点自身 favicon；取不到则回退「首字母徽章」。
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

/**
 * 一级分类简介：一句话说明该分类收录什么，先看懂再点进去。
 * 与图标规则同理按关键词匹配，且「越具体越靠前」——
 * 例如「设计／影视后期」必须先于「影视」命中，否则会被后者的规则抢走。
 */
const CAT_DESC_RULES = [
  { re: /设计|后期/, desc: '设计素材、图片处理与影视后期软件资源' },
  { re: /考证|考级/, desc: '教师资格、考研、公考及各类等级考试的备考资料' },
  { re: /电子书|漫画|音乐|听书/, desc: '电子书、漫画、音乐与有声书的阅读和试听站点' },
  { re: /磁力|BT/i, desc: 'BT / 磁力资源搜索入口，内容良莠不齐，请自行甄别' },
  { re: /AI/i, desc: '对话、绘画、写作、编程等热门 AI 工具合集' },
  { re: /影视|动漫|直播|纪录/, desc: '影视剧集、动漫、直播与纪录片的在线观看和资源索引' },
  { re: /电脑/, desc: 'Windows / macOS 常用软件下载与系统维护工具' },
  { re: /手机/, desc: '安卓 / iOS 应用下载、玩机与刷机工具' },
  { re: /学习/, desc: '公开课、教程、题库与技能提升平台' },
  { re: /实用导航/, desc: '聚合型导航站与网址大全入口' },
  { re: /冷门/, desc: '小众但实用的宝藏网站，值得慢慢挖掘' },
  { re: /常用网站/, desc: '日常高频使用的综合门户与生活服务网站' },
  { re: /工具|查询/, desc: '在线工具与查询类站点：格式转换、计算、信息检索等' },
  { re: /游戏|解压|摸鱼/, desc: '休闲小游戏、解压玩具与摸鱼站点' },
  { re: /福利|资源/, desc: '综合资源站点合集' },
];

/** 取分类简介：命中关键词规则，否则给一句兜底说明 */
function descFor(name) {
  const hit = CAT_DESC_RULES.find((r) => r.re.test(name));
  return hit ? hit.desc : '该分类下的精选网站，点击卡片即可访问。';
}

/** 取站点域名用于展示 */
function hostOf(url) {
  try { return new URL(url).host.replace(/^www\./, ''); } catch { return url; }
}

/** 取站点 origin（用于拼 favicon 兜底地址） */
function originOf(url) {
  try { return new URL(url).origin; } catch { return ''; }
}

/** 取名称首字（跳过开头的 emoji / 装饰符号），作为无图标时的默认徽章 */
function firstLetter(name) {
  const s = String(name || '').replace(/^[^\p{L}\p{N}]+/u, '');
  const m = s.match(/[\p{L}\p{N}]/u);
  return m ? m[0].toUpperCase() : '·';
}

/**
 * 站点卡片
 * @param {object} s 站点 { name, url, favicon? , cat? }
 * @param {boolean} showCat 是否显示所属分类（搜索结果用，取 s.cat）
 */
function siteCard(s, showCat = false) {
  const root = originOf(s.url);
  // 图标候选链：源数据 favicon → /favicon.ico → /favicon.svg → /favicon.png，全失败则用首字母
  const chain = [...new Set([
    s.favicon ? String(s.favicon) : '',
    root ? `${root}/favicon.ico` : '',
    root ? `${root}/favicon.svg` : '',
    root ? `${root}/favicon.png` : '',
  ].filter(Boolean))];
  const src = chain[0] || '';
  const rest = chain.slice(1).join('|');
  const cat = showCat && s.cat ? s.cat : '';
  const tip = cat ? `${s.name}\n${s.url}\n分类：${cat}` : `${s.name}\n${s.url}`;

  return `<a class="nh-site" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" title="${esc(tip)}">
    <span class="nh-fav">
      ${src ? `<img class="nh-fav-img" src="${esc(src)}"${rest ? ` data-chain="${esc(rest)}"` : ''} alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ''}
      <span class="nh-fav-letter" aria-hidden="true">${esc(firstLetter(s.name))}</span>
    </span>
    <span class="nh-site-body">
      <span class="nh-site-name">${esc(s.name)}</span>
      ${cat ? `<span class="nh-site-cat">${esc(cat)}</span>` : ''}
      <span class="nh-site-host">${esc(hostOf(s.url))}</span>
    </span>
  </a>`;
}

/** 一个分组：标题用分类自身名称，所属路径单独标注（层级归属更精准） */
function groupHtml(title, sites, pathLabel = '', showCat = false) {
  if (!sites.length) return '';
  return `<section class="nh-group">
    <h3 class="nh-group-title">
      <span class="nh-dot" aria-hidden="true"></span>
      <span class="nh-group-name">${esc(title)}</span>
      ${pathLabel ? `<span class="nh-group-path">${esc(pathLabel)}</span>` : ''}
      <span class="nh-group-count">${sites.length}</span>
    </h3>
    <div class="nh-grid">${sites.map((s) => siteCard(s, showCat)).join('')}</div>
  </section>`;
}

/**
 * 图标加载失败时沿候选链依次重试（data-chain 为剩下的地址，'|' 分隔）；
 * 全部失败则移除 <img>，露出底层的「首字母徽章」作为默认图标。
 */
function bindFavicons(root) {
  root.querySelectorAll('img.nh-fav-img').forEach((img) => {
    img.addEventListener('error', function onError() {
      const rest = (img.dataset.chain || '').split('|').filter(Boolean);
      if (rest.length) {
        img.dataset.chain = rest.slice(1).join('|');
        img.src = rest[0];
        return;
      }
      img.remove();
    });
  });
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
  return groups.map((g) => groupHtml(g.name, g.sites, g.path)).join('')
    || '<p class="empty">该分类暂无网站</p>';
}

/** 分类说明条：分类名 + 站点数 + 一句话简介（置于该分类内容区顶部） */
function catIntroHtml(cat) {
  return `<div class="nh-intro">
    <span class="nh-intro-icon" aria-hidden="true">${esc(iconFor(cat.name, cat.icon))}</span>
    <div class="nh-intro-body">
      <h2 class="nh-intro-name">${esc(cat.name)}<span class="nh-intro-count">${cat.count} 个站点</span></h2>
      <p class="nh-intro-desc">${esc(descFor(cat.name))}</p>
    </div>
  </div>`;
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
        title="${esc(descFor(c.name))}"
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
      mainEl.innerHTML = cat ? catIntroHtml(cat) + categoryHtml(cat) : '';
      bindFavicons(mainEl);
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
        mainEl.innerHTML = groupHtml('搜索结果', shown, '', true)
          + (hits.length > LIMIT ? `<p class="nh-more">仅显示前 ${LIMIT} 条，共 ${hits.length} 条，请输入更精确的关键词</p>` : '');
        bindFavicons(mainEl);
      }, 200);
    });

    renderCategory(activeId);
  },
};

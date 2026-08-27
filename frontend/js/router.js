/* ============================================================
 * router.js - hash 路由器
 * 视图模块约定导出：{ title?, nav?, render(params), mount?(params) }
 * ============================================================ */
import homeView from './views/home.js';
import toolsView from './views/tools.js';
import convertView from './views/convert.js';
import audioView from './views/audio.js';
import videoView from './views/video.js';
import textView from './views/text.js';
import learnView from './views/learn.js';
import categoryView from './views/category.js';
import pdfView from './views/pdf.js';
import pdfToolView from './views/pdfTool.js';
import notfoundView from './views/notfound.js';

const routes = [
  { path: '/',                view: homeView },
  { path: '/tools',           view: toolsView },
  { path: '/tools/convert',   view: convertView },
  { path: '/tools/audio',     view: audioView },
  { path: '/tools/video',     view: videoView },
  { path: '/tools/text',      view: textView },
  { path: '/learn',           view: learnView },
  { path: '/learn/:id',       view: categoryView },
  { path: '/pdf',             view: pdfView },
  { path: '/pdf/:toolId',     view: pdfToolView },
];

/** 将 "/learn/:id" 之类的路径模板与实际路径匹配 */
function matchRoute(pathname) {
  for (const r of routes) {
    if (r.path.includes(':')) {
      const pattern = '^' + r.path.replace(/:(\w+)/g, '(?<$1>[\\w-]+)') + '$';
      const m = pathname.match(new RegExp(pattern));
      if (m) return { view: r.view, params: m.groups || {} };
    } else if (r.path === pathname) {
      return { view: r.view, params: {} };
    }
  }
  return { view: notfoundView, params: {} };
}

/** 高亮顶部导航（当前视图通过 nav 声明归属） */
function highlightNav(current) {
  document.querySelectorAll('#nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.nav === current);
  });
}

export function initRouter(appEl) {
  function renderRoute() {
    const path = location.hash.slice(1) || '/';
    const { view, params } = matchRoute(path);

    if (view.title) document.title = view.title;
    highlightNav(view.nav !== undefined ? view.nav : path);

    appEl.innerHTML = view.render(params);
    if (typeof view.mount === 'function') view.mount(params);
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', renderRoute);
  renderRoute();
}

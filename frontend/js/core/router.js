/* ============================================================
 * core/router.js - hash 路由器
 * 职责：根据当前 hash 匹配注册表里的视图并渲染。
 *       本文件不引用任何具体业务视图（除 404 兜底），
 *       新增页面由 registry 注册，此处无需改动。
 *
 * 视图模块约定导出：{ title?, nav?, render(params), mount?(params) }
 * ============================================================ */
import { getRoutes } from './registry.js';
import notfoundView from '../views/notfound.js';

/** 将 "/learn/:id" 之类的路径模板与实际路径匹配 */
function matchRoute(pathname) {
  for (const r of getRoutes()) {
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
  document.querySelectorAll('#nav a').forEach((a) => {
    a.classList.toggle('active', a.dataset.nav === current);
  });
}

/**
 * 初始化路由
 * @param {HTMLElement} appEl 页面挂载容器
 */
export function initRouter(appEl) {
  function renderRoute() {
    const path = location.hash.slice(1) || '/';
    const { view, params } = matchRoute(path);

    if (view.title) document.title = view.title;
    highlightNav(view.nav !== undefined ? view.nav : path);

    const isHome = (view.nav !== undefined ? view.nav : path) === '/';
    document.body.classList.toggle('is-home', isHome);
    document.body.classList.toggle('is-subpage', !isHome);

    appEl.innerHTML = view.render(params);
    if (typeof view.mount === 'function') view.mount(params);
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', renderRoute);
  renderRoute();
}

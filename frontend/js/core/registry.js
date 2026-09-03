/* ============================================================
 * core/registry.js - 视图注册表
 * 职责：解耦「路由匹配」与「具体页面」。
 *       新增页面时只需调用 registerRoute/registerRoutes 注册，
 *       无需修改 router.js，符合开闭原则。
 * ============================================================ */

/** @type {{path: string, view: object}[]} */
const routes = [];

/**
 * 注册单个路由
 * @param {string} path  路径模板，支持 :param，如 '/pdf/:toolId'
 * @param {object} view  视图模块，约定导出 { title?, nav?, render(params), mount?(params) }
 */
export function registerRoute(path, view) {
  if (!path) throw new Error('[registry] registerRoute 需要提供 path');
  if (!view || typeof view.render !== 'function') {
    throw new Error('[registry] 视图模块必须提供 render(params) 方法');
  }
  routes.push({ path, view });
}

/**
 * 批量注册路由
 * @param {{path: string, view: object}[]} list
 */
export function registerRoutes(list) {
  (list || []).forEach((item) => registerRoute(item.path, item.view));
}

/** 获取已注册路由（返回副本，避免外部篡改） */
export function getRoutes() {
  return routes.slice();
}

/** 清空注册表（主要用于测试） */
export function clearRoutes() {
  routes.length = 0;
}

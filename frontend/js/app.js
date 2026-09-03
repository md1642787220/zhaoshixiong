/* ============================================================
 * app.js - 应用入口
 * 职责：注册全部视图并启动路由。
 *       新增功能只需在 views/index.js 追加，本文件无需修改。
 * ============================================================ */
import { initRouter } from './core/router.js';
import { registerRoutes } from './core/registry.js';
import { views } from './views/index.js';
import { ensureToastRoot } from './utils.js';
import { initTheme } from './theme.js';

/* 注册路由（唯一装配点） */
registerRoutes(views);

ensureToastRoot();
initRouter(document.getElementById('app'));
initTheme();

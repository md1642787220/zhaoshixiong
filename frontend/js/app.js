/* ============================================================
 * app.js - 应用入口
 * ============================================================ */
import { initRouter } from './router.js';
import { ensureToastRoot } from './utils.js';

ensureToastRoot();
initRouter(document.getElementById('app'));

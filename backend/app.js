/* ============================================================
 * app.js - 应用工厂
 * 职责：组装中间件、API 路由与前端静态托管，输出一个 express 应用。
 *       所有依赖由外部注入，便于测试与复用。
 * ============================================================ */
const express = require('express');
const path = require('path');
const fs = require('fs');
const { createApiRouter } = require('./routes');
const { createCorsMiddleware } = require('./middlewares/corsMiddleware');
const { createErrorMiddleware } = require('./middlewares/errorMiddleware');

/**
 * 创建应用
 * @param {{config: object, logger: object, services: object, storage: object}} deps
 */
function createApp({ config, logger, services, storage }) {
  const app = express();

  /* ---------- 基础中间件 ---------- */
  app.use(express.json({ limit: config.limits.jsonBody }));
  app.use(express.urlencoded({ extended: true }));
  app.use(createCorsMiddleware());

  /* ---------- API 路由 ---------- */
  app.use('/api', createApiRouter({ services, storage, logger }));

  /* ---------- 同端口托管前端静态资源 ---------- */
  if (config.frontend.enabled && fs.existsSync(config.frontend.dir)) {
    // 开发期禁用静态资源缓存，避免修改前端 JS 后浏览器仍加载旧模块
    app.use(express.static(config.frontend.dir, {
      setHeaders(res) { res.setHeader('Cache-Control', 'no-store'); },
    }));
    // 前端使用 hash 路由，未匹配的路径回退到 index.html
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(path.join(config.frontend.dir, 'index.html'));
    });
    logger.info(`已托管前端静态资源: ${config.frontend.dir}`);
  } else {
    logger.warn(`未托管前端静态资源（目录不存在或已禁用）: ${config.frontend.dir}`);
  }

  /* ---------- 统一错误处理（必须最后注册） ---------- */
  app.use(createErrorMiddleware({ logger }));

  return app;
}

module.exports = { createApp };

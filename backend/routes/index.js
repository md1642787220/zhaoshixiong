/* ============================================================
 * routes/index.js - API 路由聚合
 * 职责：统一挂载各业务路由模块。
 *       新增业务模块时，只需在此注册一次，无需修改 app.js。
 * ============================================================ */
const express = require('express');
const { createHealthRoutes } = require('./healthRoutes');
const { createToolsRoutes } = require('./toolsRoutes');
const { createLearnRoutes } = require('./learnRoutes');
const { createPdfRoutes } = require('./pdfRoutes');
const { createNavRoutes } = require('./navRoutes');
const { createMediaRoutes } = require('./mediaRoutes');
const { createNotFoundMiddleware } = require('../middlewares/notFound');

/**
 * 创建 API 根路由
 * @param {{services: object, storage: object, logger: object}} deps
 */
function createApiRouter({ services, storage, logger }) {
  const router = express.Router();

  router.use('/health', createHealthRoutes({ logger }));
  router.use('/tools', createToolsRoutes({
    convertService: services.convert,
    textService: services.text,
    handwritingService: services.handwriting,
    storage,
    logger,
  }));
  router.use('/learn', createLearnRoutes({ learnService: services.learn, storage, logger }));
  router.use('/pdf', createPdfRoutes({ pdfService: services.pdf, storage, logger }));
  router.use('/nav', createNavRoutes({ navService: services.nav, logger }));
  router.use('/media', createMediaRoutes({ mediaSourceService: services.mediaSource, logger }));

  // /api 下未匹配的请求统一 404（JSON）
  router.use(createNotFoundMiddleware({ logger }));

  return router;
}

module.exports = { createApiRouter };

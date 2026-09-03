/* ============================================================
 * routes/healthRoutes.js - 健康检查
 * ============================================================ */
const express = require('express');

/**
 * 创建健康检查路由
 * @param {{logger: object, serviceName?: string}} deps
 */
function createHealthRoutes({ logger, serviceName = 'shixiong-backend' } = {}) {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.json({ status: 'ok', service: serviceName, time: new Date().toISOString() });
  });

  return router;
}

module.exports = { createHealthRoutes };

/* ============================================================
 * routes/learnRoutes.js - 学习板块接口（API 层）
 *
 *   GET /api/learn/categories       分类列表
 *   GET /api/learn/categories/:id   分类详情（含资源）
 * ============================================================ */
const express = require('express');
const { asyncHandler } = require('../core/http');

/**
 * 创建学习路由
 * @param {{learnService: object, logger: object}} deps
 */
function createLearnRoutes({ learnService, logger }) {
  const router = express.Router();

  /** 分类列表 */
  router.get('/categories', asyncHandler(async (req, res) => {
    res.json(learnService.listCategories());
  }));

  /** 分类详情 */
  router.get('/categories/:id', asyncHandler(async (req, res) => {
    res.json(learnService.getCategory(req.params.id));
  }));

  return router;
}

module.exports = { createLearnRoutes };

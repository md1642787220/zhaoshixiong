/* ============================================================
 * routes/navRoutes.js - 网址导航接口（API 层）
 *
 *   GET /api/nav/categories              分类列表（政府/教育）
 *   GET /api/nav/categories/:id          分类详情（含站点）
 *   GET /api/nav/sites?category=&region=&q=   搜索 / 筛选站点
 *   GET /api/nav/regions?category=       可用地区列表
 *   POST /api/nav/verify                 触发链接有效性校验
 * ============================================================ */
const express = require('express');
const { asyncHandler } = require('../core/http');

/**
 * 创建导航路由
 * @param {{navService: object, logger: object}} deps
 */
function createNavRoutes({ navService, logger }) {
  const router = express.Router();

  /** 分类列表 */
  router.get('/categories', asyncHandler(async (req, res) => {
    res.json(navService.listCategories());
  }));

  /** 可用地区 */
  router.get('/regions', asyncHandler(async (req, res) => {
    res.json(navService.listRegions(req.query.category || undefined));
  }));

  /** 搜索 / 筛选站点 */
  router.get('/sites', asyncHandler(async (req, res) => {
    const { category, region, q } = req.query;
    res.json(navService.search({ category, region, q }));
  }));

  /** 分类详情（含站点明细） */
  router.get('/categories/:id', asyncHandler(async (req, res) => {
    res.json(navService.getCategory(req.params.id));
  }));

  /** 触发链接校验 */
  router.post('/verify', asyncHandler(async (req, res) => {
    const result = await navService.verifyLinks({
      concurrency: Number(req.body && req.body.concurrency) || 8,
      timeoutMs: Number(req.body && req.body.timeoutMs) || 8000,
    });
    res.json({ ok: true, result });
  }));

  return router;
}

module.exports = { createNavRoutes };

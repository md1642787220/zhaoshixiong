/* ============================================================
 * routes/learnRoutes.js - 学习板块接口（API 层）
 *
 *   GET  /api/learn/categories               分类列表
 *   GET  /api/learn/categories/:id           分类详情（含资源）
 *   POST /api/learn/categories/:id/contributions  提交用户贡献（经验帖/文件/转载）
 *   GET  /api/learn/files/:name              贡献文件下载
 * ============================================================ */
const fs = require('fs');
const express = require('express');
const { asyncHandler } = require('../core/http');

/**
 * 创建学习路由
 * @param {{learnService: object, storage: object, logger: object}} deps
 */
function createLearnRoutes({ learnService, storage, logger }) {
  const router = express.Router();

  /** 分类列表 */
  router.get('/categories', asyncHandler(async (req, res) => {
    res.json(learnService.listCategories());
  }));

  /** 分类详情 */
  router.get('/categories/:id', asyncHandler(async (req, res) => {
    res.json(learnService.getCategory(req.params.id));
  }));

  /**
   * 提交用户贡献（multipart：普通字段 + 可选 file 文件）
   * 字段：kind=post|file|repost, title, author?, summary?, content?, url?, source?
   */
  router.post('/categories/:id/contributions', storage.single('file'), asyncHandler(async (req, res) => {
    // multer 落盘的是临时文件：读成 buffer 交给业务层，随后立即清理
    const file = req.file
      ? { buffer: fs.readFileSync(req.file.path), name: req.file.originalname, size: req.file.size }
      : null;
    if (req.file) storage.remove(req.file.path);

    const resource = learnService.addContribution(req.params.id, req.body, file);
    res.status(201).json({ ok: true, resource });
  }));

  /** 贡献文件下载 */
  router.get('/files/:name', asyncHandler(async (req, res) => {
    const filePath = learnService.resolveUpload(req.params.name);
    if (logger) logger.debug(`下载贡献文件: ${req.params.name}`);
    res.download(filePath);
  }));

  return router;
}

module.exports = { createLearnRoutes };

/* ============================================================
 * routes/toolsRoutes.js - 工具板块接口（API 层）
 * 职责：仅做入参校验与响应输出，业务逻辑委托给注入的 service。
 *
 *   POST /api/tools/convert         { type, content } -> { result }
 *   POST /api/tools/text-extract    file -> { text, pages? }
 *   POST /api/tools/handwriting     { text, style } -> 手写体图片文件流
 *
 * 注：音视频的「提取音频 / 视频截取」已改为纯前端 MediaRecorder 实现，
 *     不再依赖后端 ffmpeg，故此处移除了相关路由。
 * ============================================================ */
const express = require('express');
const { asyncHandler } = require('../core/http');
const { BadRequestError } = require('../core/errors');

/**
 * 创建工具路由
 * @param {{convertService: object, textService: object, handwritingService: object, storage: object, logger: object}} deps
 */
function createToolsRoutes({ convertService, textService, handwritingService, storage, logger }) {
  const router = express.Router();

  /** 以文件流响应并在结束后清理临时文件 */
  function streamFile(res, { filePath, filename, mime }) {
    res.setHeader('Content-Type', mime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
    );
    const stream = storage.createReadStream(filePath);
    stream.on('close', () => storage.remove(filePath));
    stream.on('error', () => storage.remove(filePath));
    stream.pipe(res);
  }

  /** 格式转换 */
  router.post('/convert', asyncHandler(async (req, res) => {
    const { type, content } = req.body || {};
    res.json(await convertService.convert({ type, content }));
  }));

  /** 文本提取：PDF/TXT/MD/CSV/JSON -> { text, pages? } */
  router.post('/text-extract', storage.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) throw new BadRequestError('请选择文件');
    const src = req.file.path;
    try {
      res.json(await textService.extract({
        filePath: src,
        originalName: req.file.originalname,
      }));
    } finally {
      storage.remove(src);
    }
  }));

  /** 手写体转换：打印体文字 -> 手写体图片（接口预留，后端逐步实现） */
  router.post('/handwriting', asyncHandler(async (req, res) => {
    const text = (req.body && req.body.text) || '';
    if (!text.trim()) throw new BadRequestError('请输入要转换的文字');
    const style = (req.body && req.body.style) || 'default';
    const out = await handwritingService.convert({ text, style });
    streamFile(res, out);
  }));

  return router;
}

module.exports = { createToolsRoutes };

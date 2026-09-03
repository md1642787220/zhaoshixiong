/* ============================================================
 * routes/toolsRoutes.js - 工具板块接口（API 层）
 * 职责：仅做入参校验与响应输出，业务逻辑委托给注入的 service。
 *
 *   GET  /api/tools/status          服务与 ffmpeg 状态
 *   POST /api/tools/convert         { type, content } -> { result }
 *   POST /api/tools/audio-extract   file -> 音频文件流
 *   POST /api/tools/video-clip      file + start/end -> 视频文件流
 *   POST /api/tools/text-extract    file -> { text, pages? }
 *   POST /api/tools/handwriting     { text, style } -> 手写体图片文件流
 * ============================================================ */
const express = require('express');
const { asyncHandler } = require('../core/http');
const { BadRequestError } = require('../core/errors');

/**
 * 创建工具路由
 * @param {{convertService: object, mediaService: object, textService: object, handwritingService: object, storage: object, logger: object}} deps
 */
function createToolsRoutes({ convertService, mediaService, textService, handwritingService, storage, logger }) {
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

  /** 服务状态（含 ffmpeg 是否可用） */
  router.get('/status', asyncHandler(async (req, res) => {
    res.json(await mediaService.status());
  }));

  /** 格式转换 */
  router.post('/convert', asyncHandler(async (req, res) => {
    const { type, content } = req.body || {};
    res.json(await convertService.convert({ type, content }));
  }));

  /** 音频提取：视频文件 -> MP3 */
  router.post('/audio-extract', storage.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) throw new BadRequestError('请选择视频文件');
    const src = req.file.path;
    try {
      const out = await mediaService.extractAudio({
        sourcePath: src,
        originalName: req.file.originalname,
      });
      streamFile(res, out);
    } finally {
      storage.remove(src);
    }
  }));

  /** 视频截取：file + 起止时间 -> 视频 */
  router.post('/video-clip', storage.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) throw new BadRequestError('请选择视频文件');
    const src = req.file.path;
    try {
      const out = await mediaService.clipVideo({
        sourcePath: src,
        originalName: req.file.originalname,
        start: req.body.start,
        end: req.body.end,
      });
      streamFile(res, out);
    } finally {
      storage.remove(src);
    }
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

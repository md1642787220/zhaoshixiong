/* ============================================================
 * routes/pdfRoutes.js - PDF 工具接口（API 层）
 * 职责：接收上传、调用 pdfService，并按结果类型输出响应。
 *       所有业务判断都在 service 中，本文件不含 PDF 处理逻辑。
 *
 *   GET  /api/pdf/capabilities      能力清单
 *   POST /api/pdf/:action           multipart: files + 参数
 * ============================================================ */
const express = require('express');
const { asyncHandler, sendDownload } = require('../core/http');
const { BadRequestError } = require('../core/errors');

/**
 * 创建 PDF 路由
 * @param {{pdfService: object, storage: object, logger: object}} deps
 */
function createPdfRoutes({ pdfService, storage, logger }) {
  const router = express.Router();

  /** 能力清单：前端据此给「暂未开放」的功能打角标 */
  router.get('/capabilities', (req, res) => {
    res.json({ ok: true, capabilities: pdfService.capabilities() });
  });

  router.post('/:action', storage.any(), asyncHandler(async (req, res) => {
    const { action } = req.params;
    const body = req.body || {};

    try {
      const result = await pdfService.execute({ action, req, body });

      switch (result.kind) {
        case 'pdf':
          return sendDownload(res, {
            buffer: result.buffer,
            filename: result.filename,
            contentType: 'application/pdf',
          });

        case 'zip':
          return sendZip(res, result.items, result.zipName);

        case 'json':
          return res.json(result.data);

        case 'text':
          return sendDownload(res, {
            buffer: Buffer.from(result.content, 'utf8'),
            filename: result.filename,
            contentType: result.contentType,
          });

        case 'upstream': {
          // 引擎转发结果原样透传
          if (result.disposition) res.setHeader('Content-Disposition', result.disposition);
          res.setHeader('Content-Type', result.contentType || 'application/octet-stream');
          return res.status(result.status).send(result.json ?? result.buffer);
        }

        case 'unavailable':
          return res.status(200).json({
            ok: false,
            engine: result.engine,
            message: `「${result.action}」需要服务端安装 ${result.engine} 引擎，当前环境未提供。接口与前端已就绪，安装后即可启用。`,
          });

        default:
          return res.status(200).json({ ok: false, message: `PDF 工具「${action}」返回结果未知。` });
      }
    } finally {
      storage.cleanup(req);
    }
  }));

  return router;
}

/** 多文件打包下载（依赖 adm-zip，不可用时退化为首个文件） */
function sendZip(res, items, zipName) {
  if (!items || !items.length) throw new BadRequestError('无可输出文件');
  try {
    // eslint-disable-next-line global-require
    const AdmZip = require('adm-zip');
    const zip = new AdmZip();
    items.forEach((it) => zip.addFile(it.name, it.buffer));
    return sendDownload(res, {
      buffer: zip.toBuffer(),
      filename: zipName,
      contentType: 'application/zip',
    });
  } catch {
    return sendDownload(res, {
      buffer: items[0].buffer,
      filename: items[0].name,
      contentType: 'application/octet-stream',
    });
  }
}

module.exports = { createPdfRoutes };

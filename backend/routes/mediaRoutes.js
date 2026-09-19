/* ============================================================
 * routes/mediaRoutes.js - 音视频素材接口（API 层）
 * 职责：入参校验与响应输出；解析走 service，下载直接流式转发 worker。
 *
 *   GET /api/media/resolve?url=...   解析视频源链接 -> 音频/视频下载项
 *   GET /api/media/download?url=&ref=&filename=...   流式代理下载
 * ============================================================ */
const express = require('express');
const { Readable } = require('stream');
const fs = require('fs');
const os = require('os');
const FormData = require('form-data');
const multer = require('multer');
const { asyncHandler } = require('../core/http');
const { BadRequestError } = require('../core/errors');

const URL_RE = /^https?:\/\//i;

/**
 * 创建音视频素材路由
 * @param {{mediaSourceService: object, logger: object}} deps
 */
const upload = multer({ dest: os.tmpdir() });

function createMediaRoutes({ mediaSourceService, logger }) {
  const router = express.Router();

  router.get('/resolve', asyncHandler(async (req, res) => {
    const url = String(req.query.url || '').trim();
    if (!URL_RE.test(url)) throw new BadRequestError('请输入以 http(s):// 开头的视频源链接');
    const data = await mediaSourceService.resolve(url);
    res.json(data);
  }));

  /** 下载代理：流式转发 worker 响应，浏览器拿到的即为文件流 */
  router.get('/download', asyncHandler(async (req, res) => {
    const { url, ref, filename, start, end } = req.query;
    if (!url || !URL_RE.test(String(url))) throw new BadRequestError('非法下载地址');

    const base = mediaSourceService.workerBase;
    if (!base) throw new BadRequestError('未配置 PDF_WORKER_URL，无法下载');

    const qs = new URLSearchParams({ url: String(url), filename: String(filename || 'download') });
    if (ref) qs.set('ref', String(ref));
    if (start != null && start !== '') qs.set('start', String(start));
    if (end != null && end !== '') qs.set('end', String(end));

    const workerRes = await fetch(`${base}/api/media/download?${qs.toString()}`);
    if (!workerRes.ok) {
      const err = await workerRes.json().catch(() => ({}));
      res.status(workerRes.status).json({ ok: false, message: err.message || `下载失败（${workerRes.status}）` });
      return;
    }

    res.setHeader('Content-Type', workerRes.headers.get('content-type') || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      workerRes.headers.get('content-disposition') || `attachment; filename*=UTF-8''${encodeURIComponent(String(filename || 'download'))}`
    );
    const len = workerRes.headers.get('content-length');
    if (len) res.setHeader('Content-Length', len);
    Readable.fromWeb(workerRes.body).pipe(res);
  }));

  /**
   * 合并下载：DASH 分离流（视频流本身不含音轨）交由 worker 用 yt-dlp 挑流 + ffmpeg 合并。
   * 与 /download 的区别：那条在「未裁剪」时只是代理纯视频流直链，拿到的文件没有声音。
   */
  router.get('/download-merged', asyncHandler(async (req, res) => {
    const { url, ref, height, filename, start, end } = req.query;
    if (!url && !ref) throw new BadRequestError('缺少下载地址');

    const base = mediaSourceService.workerBase;
    if (!base) throw new BadRequestError('未配置 PDF_WORKER_URL，无法下载');

    const qs = new URLSearchParams({
      url: String(url || ''),
      ref: String(ref || ''),
      filename: String(filename || 'merged.mp4'),
    });
    if (height != null && height !== '') qs.set('height', String(height));
    if (start != null && start !== '') qs.set('start', String(start));
    if (end != null && end !== '') qs.set('end', String(end));

    // 合并需要服务端「先下载再转码」，耗时随文件大小增长，故给足超时（30 分钟）
    const workerRes = await fetch(`${base}/api/media/download-merged?${qs.toString()}`, {
      signal: AbortSignal.timeout(30 * 60 * 1000),
    });
    if (!workerRes.ok) {
      const err = await workerRes.json().catch(() => ({}));
      res.status(workerRes.status).json({ ok: false, message: err.message || `合并下载失败（${workerRes.status}）` });
      return;
    }

    res.setHeader('Content-Type', workerRes.headers.get('content-type') || 'video/mp4');
    res.setHeader(
      'Content-Disposition',
      workerRes.headers.get('content-disposition') || `attachment; filename*=UTF-8''${encodeURIComponent(String(filename || 'merged.mp4'))}`
    );
    const len = workerRes.headers.get('content-length');
    if (len) res.setHeader('Content-Length', len);
    Readable.fromWeb(workerRes.body).pipe(res);
  }));

  /** 提取音频：上传视频文件 -> worker 用 ffmpeg 提取音频 MP3 */
  router.post('/extract-audio', upload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) throw new BadRequestError('请上传视频文件');

    const { start, end } = req.body || {};
    const base = mediaSourceService.workerBase;
    if (!base) throw new BadRequestError('未配置 PDF_WORKER_URL，无法提取音频');

    const form = new FormData();
    form.append('file', fs.createReadStream(req.file.path), req.file.originalname);
    if (start != null && start !== '') form.append('start', String(start));
    if (end != null && end !== '') form.append('end', String(end));

    const workerRes = await fetch(`${base}/api/media/extract-audio`, {
      method: 'POST',
      headers: form.getHeaders(),
      body: form,
    });
    fs.unlink(req.file.path, () => {});

    if (!workerRes.ok) {
      const err = await workerRes.json().catch(() => ({}));
      res.status(workerRes.status).json({ ok: false, message: err.message || `提取失败（${workerRes.status}）` });
      return;
    }

    res.setHeader('Content-Type', workerRes.headers.get('content-type') || 'audio/mpeg');
    res.setHeader(
      'Content-Disposition',
      workerRes.headers.get('content-disposition') || `attachment; filename*=UTF-8''${encodeURIComponent('audio.mp3')}`
    );
    const len = workerRes.headers.get('content-length');
    if (len) res.setHeader('Content-Length', len);
    Readable.fromWeb(workerRes.body).pipe(res);
  }));

  return router;
}

module.exports = { createMediaRoutes };

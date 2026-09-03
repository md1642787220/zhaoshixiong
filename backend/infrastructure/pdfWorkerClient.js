/* ============================================================
 * infrastructure/pdfWorkerClient.js - Python PDF Worker 客户端
 * 职责：封装与 pdf-worker 服务的 HTTP 通信（multipart 转发）。
 *       未配置 PDF_WORKER_URL 时 enabled 为 false，由业务层决定降级策略。
 * ============================================================ */
const fs = require('fs');
const FormData = require('form-data');

/**
 * 创建 worker 客户端
 * @param {{url: string, timeoutMs: number, logger: object}} deps
 */
function createPdfWorkerClient({ url = '', timeoutMs = 120000, logger }) {
  const enabled = Boolean(url);

  /**
   * 将 action 转发给 worker
   * @param {{action: string, req: object, body?: object}} params
   * @returns {Promise<{status:number, contentType:string, json?:object, buffer?:Buffer, disposition?:string}>}
   */
  async function forward({ action, req, body = {} }) {
    if (!enabled) {
      throw new Error('未配置 PDF_WORKER_URL，无法转发到 PDF 引擎');
    }

    const form = new FormData();
    for (const f of req.files || []) {
      form.append(f.fieldname, fs.createReadStream(f.path), {
        filename: f.originalname,
        contentType: f.mimetype,
      });
    }
    for (const [k, v] of Object.entries(body)) {
      if (v !== undefined && v !== null) form.append(k, String(v));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const upstream = await fetch(`${url}/api/pdf/${action}`, {
        method: 'POST',
        body: form,
        headers: form.getHeaders(),
        signal: controller.signal,
      });

      const contentType = upstream.headers.get('content-type') || '';
      const disposition = upstream.headers.get('content-disposition') || '';

      if (contentType.includes('application/json')) {
        return { status: upstream.status, contentType, disposition, json: await upstream.json() };
      }
      return {
        status: upstream.status,
        contentType,
        disposition,
        buffer: Buffer.from(await upstream.arrayBuffer()),
      };
    } catch (err) {
      if (logger) logger.warn(`转发 PDF action=${action} 失败: ${err.message}`);
      throw new Error(`PDF 引擎调用失败（${err.message}）。请确认 pdf-worker 服务已启动。`);
    } finally {
      clearTimeout(timer);
    }
  }

  return { enabled, forward };
}

module.exports = { createPdfWorkerClient };

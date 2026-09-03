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
    // 关键：必须先 readFileSync 把文件读成 Buffer 再 append。
    // fs.createReadStream 是异步流，form.getBuffer() 同步调用时流还没读完，
    // 导致序列化出的 multipart body 损坏（worker 报 boundary 解析错误）。
    for (const f of req.files || []) {
      form.append(f.fieldname, fs.readFileSync(f.path), {
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
      // 用 form.getBuffer() 把 multipart 完整序列化为 buffer 再传 fetch，
      // 保证 boundary 头与 body 内容一致，避免 Node 20 undici fetch 对 stream
      // 的 boundary 同步问题（python_multipart: Expected boundary character 45, got 91）。
      const buf = form.getBuffer();
      const headers = { ...form.getHeaders(), 'content-length': String(buf.length) };
      const upstream = await fetch(`${url}/api/pdf/${action}`, {
        method: 'POST',
        body: buf,
        headers,
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

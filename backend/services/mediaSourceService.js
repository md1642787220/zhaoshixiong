/* ============================================================
 * services/mediaSourceService.js - 音视频素材解析服务
 * 职责：转发到 Python worker 的 yt-dlp 解析接口；
 *       下载代理由路由层直接流式转发（避免大文件中转内存）。
 * ============================================================ */

/**
 * 创建音视频素材解析服务
 * @param {{config: object, logger: object}} deps
 */
function createMediaSourceService({ config, logger }) {
  const workerBase = (config && config.pdfWorker && config.pdfWorker.url) || '';
  const timeoutMs = (config && config.pdfWorker && config.pdfWorker.timeoutMs) || 600000;

  /**
   * 解析视频源链接
   * @param {string} url 视频源链接（http/https）
   * @returns {Promise<object>} { ok, title, audios, videos, ... }
   */
  async function resolve(url) {
    if (!workerBase) {
      throw new Error('未配置 PDF_WORKER_URL，无法调用解析引擎');
    }
    const res = await fetch(`${workerBase}/api/media/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `解析失败（${res.status}）`);
    }
    return data;
  }

  return { resolve, workerBase };
}

module.exports = { createMediaSourceService };

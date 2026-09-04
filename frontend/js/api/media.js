/* ============================================================
 * api/media.js - 音视频素材接口（API 调用层）
 *
 * 对应后端约定：
 *   GET /api/media/resolve?url=<视频源链接>
 *     -> { ok, title, uploader, duration, thumbnail, pageUrl, audios[], videos[] }
 *   GET /api/media/download?url=&ref=&filename=...  流式代理下载
 * ============================================================ */
import { API, API_BASE } from '../core/config.js';
import { apiJson } from './client.js';

export const mediaApi = {
  /**
   * 解析视频源链接
   * @param {string} url 视频源链接
   * @returns {Promise<object>} 解析结果（音频/视频下载项清单）
   */
  resolve(url) {
    return apiJson(`/media/resolve?url=${encodeURIComponent(url)}`);
  },

  /**
   * 构造代理下载地址（直链常带防盗链/跨域限制，统一走后端代理）
   * @param {{url: string}} item 解析结果中的下载项
   * @param {string} filename 保存文件名（含扩展名）
   * @param {string} pageRef 来源页面地址（作 Referer）
   * @param {number|null} start 片段开始秒数（可选）
   * @param {number|null} end 片段结束秒数（可选）
   */
  downloadUrl(item, filename, pageRef = '', start = null, end = null) {
    const qs = new URLSearchParams({
      url: item.url,
      filename,
    });
    if (pageRef) qs.set('ref', pageRef);
    if (start != null && !Number.isNaN(start)) qs.set('start', String(start));
    if (end != null && !Number.isNaN(end)) qs.set('end', String(end));
    return `${API}${API_BASE}/media/download?${qs.toString()}`;
  },
};

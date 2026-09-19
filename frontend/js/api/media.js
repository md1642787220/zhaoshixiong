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
   * 上传本地视频，由后端 ffmpeg 提取音频（MP3），支持起止时间裁剪
   * @param {File} file 视频文件
   * @param {number|null} start 开始秒数（可选）
   * @param {number|null} end 结束秒数（可选）
   * @returns {Promise<Blob>} MP3 音频 Blob
   */
  extractAudio(file, start = null, end = null) {
    const form = new FormData();
    form.append('file', file);
    if (start != null && !Number.isNaN(start)) form.append('start', String(start));
    if (end != null && !Number.isNaN(end)) form.append('end', String(end));
    return fetch(`${API}${API_BASE}/media/extract-audio`, { method: 'POST', body: form })
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.message || `提取失败（${r.status}）`);
        }
        return r.blob();
      });
  },

  /**
   * 构造「合并下载」地址：由服务端用 yt-dlp 挑选同清晰度视频流 + 最佳音频流，
   * 再用 ffmpeg 合并为带音轨的 MP4。
   *
   * 用于 DASH 音视频分离的平台（B站 / YouTube 等）：这些平台的视频流本身不含声音，
   * 直接下载直链会得到无声文件 —— 走本接口才能拿到正常带声音的视频。
   *
   * @param {{url: string, height?: number}} item 解析结果中的视频下载项
   * @param {string} filename 保存文件名（含扩展名）
   * @param {string} pageRef 来源页面地址（yt-dlp 据此重新挑选视频流 + 音频流）
   * @param {number|null} start 片段开始秒数（可选）
   * @param {number|null} end 片段结束秒数（可选）
   */
  mergedDownloadUrl(item, filename, pageRef = '', start = null, end = null) {
    const qs = new URLSearchParams({
      url: item.url || '',
      ref: pageRef || '',
      filename,
      height: String(item.height || 0),
    });
    if (start != null && !Number.isNaN(start)) qs.set('start', String(start));
    if (end != null && !Number.isNaN(end)) qs.set('end', String(end));
    return `${API}${API_BASE}/media/download-merged?${qs.toString()}`;
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

/* ============================================================
 * api/tools.js - 工具板块接口（接口留好，后端逐步实现）
 *
 * 对应后端约定：
 *   GET  /api/tools/status          服务与 ffmpeg 状态
 *   POST /api/tools/convert         { type, content } -> { result }
 *   POST /api/tools/audio-extract   file -> Blob(mp3)
 *   POST /api/tools/video-clip      file + start/end -> Blob(video)
 *   POST /api/tools/text-extract    file -> { text, pages? }
 *   POST /api/tools/handwriting     { text, style } -> 手写体图片 Blob（开发中）
 * ============================================================ */
import { API, API_BASE } from '../core/config.js';
import { apiJson, postFileForBlob, postFileForJson } from './client.js';

export const toolsApi = {
  /** 服务状态（含 ffmpeg 是否可用） */
  status() {
    return apiJson('/tools/status');
  },

  /** 格式转换：type = md2html | json2csv | csv2json */
  convert(type, content) {
    return apiJson('/tools/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, content }),
    });
  },

  /** 音频提取：视频文件 -> MP3 Blob */
  audioExtract(file) {
    return postFileForBlob('/tools/audio-extract', file);
  },

  /** 视频截取：file + 起止时间 -> 视频 Blob */
  videoClip(file, start, end) {
    return postFileForBlob('/tools/video-clip', file, { start, end });
  },

  /** 文本提取：PDF/TXT/MD/CSV/JSON -> { text, pages? } */
  textExtract(file) {
    return postFileForJson('/tools/text-extract', file);
  },

  /** 手写体转换：打印体文字 -> 手写体图片 Blob（功能开发中，后端逐步实现） */
  async handwriting(text, style = 'default') {
    const res = await fetch(API + API_BASE + '/tools/handwriting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, style }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || `请求失败（${res.status}）`);
    }
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition') || '';
    const m = cd.match(/filename\*=UTF-8''([^;]+)/);
    const filename = m ? decodeURIComponent(m[1]) : 'handwriting.png';
    return { blob, filename };
  },
};

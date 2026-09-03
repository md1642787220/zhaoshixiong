/* ============================================================
 * api/music.js - 音乐素材接口（API 调用层）
 * 职责：只负责「取数据」，不含任何解析与渲染逻辑。
 *
 * 后端接口约定（暂未实现）：
 *   GET /api/music/resolve?name=素材名称
 *   响应：{ id, name, artist, category, duration, size, format, bitrate, url }
 *
 * 当前后端未实现，MUSIC_USE_MOCK 为 true 时返回本地占位数据；
 * 后端就绪后只需在 core/config.js 中关闭该开关，本文件无需改动。
 * ============================================================ */
import { apiJson } from './client.js';
import { MUSIC_USE_MOCK, MOCK_LATENCY } from '../core/config.js';
import { findMockMaterial } from '../data/music.js';

/** 模拟网络延迟 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 占位实现：从本地素材库查找并标记 mock 来源 */
async function mockResolve(keyword) {
  await delay(MOCK_LATENCY);
  const item = findMockMaterial(keyword);
  if (!item) return null;
  return { ...item, mock: true };
}

/** 真实接口实现（后端就绪后启用） */
function remoteResolve(keyword) {
  return apiJson(`/music/resolve?name=${encodeURIComponent(keyword)}`);
}

export const musicApi = {
  /**
   * 解析音乐素材
   * @param {string} keyword 已清洗的素材名称
   * @returns {Promise<object|null>} 素材原始数据，未找到时为 null
   */
  resolve(keyword) {
    return MUSIC_USE_MOCK ? mockResolve(keyword) : remoteResolve(keyword);
  },
};

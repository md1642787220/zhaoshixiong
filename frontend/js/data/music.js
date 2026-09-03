/* ============================================================
 * data/music.js - 音乐素材占位数据
 * 职责：后端 /api/music/resolve 接口就绪前的本地素材库。
 *       真实接口接入后本文件可直接移除，不影响其他模块。
 *
 * 字段说明：
 *   id        素材唯一标识
 *   name      素材名称（用于关键词匹配）
 *   artist    作者/演唱者
 *   category  分类（轻音乐 / 音效 / 配乐 等）
 *   duration  时长（秒）
 *   format    音频格式
 *   size      文件大小（字节）
 *   bitrate   比特率
 *   url       下载地址（占位）
 * ============================================================ */

export const MOCK_MUSIC_LIBRARY = [
  {
    id: 'm-001',
    name: '清晨的微风',
    artist: '林晓',
    category: '轻音乐',
    duration: 184,
    format: 'mp3',
    size: 7_372_800,
    bitrate: '320kbps',
    url: 'https://cdn.example.com/materials/morning-breeze.mp3',
  },
  {
    id: 'm-002',
    name: '城市夜色',
    artist: '陈屿',
    category: '配乐',
    duration: 226,
    format: 'mp3',
    size: 9_043_200,
    bitrate: '320kbps',
    url: 'https://cdn.example.com/materials/city-night.mp3',
  },
  {
    id: 'm-003',
    name: '会议开场提示音',
    artist: '办公素材库',
    category: '音效',
    duration: 12,
    format: 'wav',
    size: 2_116_800,
    bitrate: '1411kbps',
    url: 'https://cdn.example.com/materials/meeting-intro.wav',
  },
  {
    id: 'm-004',
    name: '课间铃声',
    artist: '校园素材库',
    category: '音效',
    duration: 8,
    format: 'mp3',
    size: 320_000,
    bitrate: '320kbps',
    url: 'https://cdn.example.com/materials/class-bell.mp3',
  },
  {
    id: 'm-005',
    name: '颁奖典礼背景乐',
    artist: '赵沐',
    category: '配乐',
    duration: 152,
    format: 'mp3',
    size: 6_080_000,
    bitrate: '320kbps',
    url: 'https://cdn.example.com/materials/award-ceremony.mp3',
  },
];

/**
 * 在占位素材库中按名称查找（大小写不敏感，支持模糊匹配）
 * @param {string} keyword 已清洗的关键词
 * @returns {object|null}
 */
export function findMockMaterial(keyword) {
  if (!keyword) return null;
  const key = keyword.toLowerCase();
  return (
    MOCK_MUSIC_LIBRARY.find((item) => item.name.toLowerCase() === key) ||
    MOCK_MUSIC_LIBRARY.find((item) => item.name.toLowerCase().includes(key)) ||
    null
  );
}

/* ============================================================
 * services/musicParser.js - 音乐素材解析逻辑
 * 职责：纯逻辑层，负责输入校验、关键词清洗、结果建模与格式化。
 *       不接触 DOM、不发起网络请求，便于单独测试与复用。
 * ============================================================ */

/** 素材名称最小长度 */
export const MIN_KEYWORD_LENGTH = 1;

/** 素材名称最大长度 */
export const MAX_KEYWORD_LENGTH = 60;

/**
 * 清洗并校验用户输入的素材名称
 * @param {string} input 原始输入
 * @returns {{valid: boolean, keyword: string, message?: string}}
 */
export function normalizeKeyword(input) {
  const keyword = String(input ?? '').trim().replace(/\s+/g, ' ');

  if (!keyword) {
    return { valid: false, keyword: '', message: '请输入音乐素材名称' };
  }
  if (keyword.length < MIN_KEYWORD_LENGTH) {
    return { valid: false, keyword, message: '素材名称过短' };
  }
  if (keyword.length > MAX_KEYWORD_LENGTH) {
    return {
      valid: false,
      keyword,
      message: `素材名称不能超过 ${MAX_KEYWORD_LENGTH} 个字符`,
    };
  }
  return { valid: true, keyword };
}

/**
 * 将接口/占位数据转换为视图展示模型
 * 用于隔离「数据字段变化」对 UI 的影响：字段改名只需改这里。
 * @param {object} raw 原始数据
 * @returns {object|null} 展示模型，数据无效时返回 null
 */
export function parseMusicResult(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const url = raw.url || raw.downloadUrl || raw.link || '';
  if (!url) return null;

  return {
    id: raw.id || '',
    name: raw.name || '未命名素材',
    artist: raw.artist || '未知作者',
    category: raw.category || '未分类',
    durationText: formatDuration(raw.duration),
    sizeText: formatSize(raw.size),
    bitrate: raw.bitrate || '',
    format: (raw.format || '').toUpperCase(),
    downloadUrl: url,
    isMock: Boolean(raw.mock),
  };
}

/** 秒数格式化为 mm:ss 或 hh:mm:ss */
export function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** 字节数格式化 */
export function formatSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

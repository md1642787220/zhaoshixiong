/* ============================================================
 * components/musicResult.js - 音乐素材结果卡片（UI 组件）
 * 职责：纯展示，接收展示模型并输出 HTML 字符串，
 *       不含数据获取与业务判断，可在任何视图中复用。
 * ============================================================ */
import { icon } from './icon.js';
import { esc } from '../utils.js';

/**
 * 渲染素材结果卡片（含下载链接）
 * @param {object} model 由 services/musicParser.parseMusicResult 生成
 * @returns {string} HTML
 */
export function musicResultCard(model) {
  if (!model) return '';

  const metaItems = [
    model.artist && `<span class="mr-meta-item">${icon('user', 14)} ${esc(model.artist)}</span>`,
    model.category && `<span class="mr-meta-item">${icon('tag', 14)} ${esc(model.category)}</span>`,
    model.durationText && `<span class="mr-meta-item">${icon('clock', 14)} ${esc(model.durationText)}</span>`,
    model.format && `<span class="mr-meta-item">${icon('file-text', 14)} ${esc(model.format)}</span>`,
    model.bitrate && `<span class="mr-meta-item">${icon('activity', 14)} ${esc(model.bitrate)}</span>`,
    model.sizeText && `<span class="mr-meta-item">${icon('download', 14)} ${esc(model.sizeText)}</span>`,
  ].filter(Boolean).join('');

  return `
  <div class="music-result">
    <div class="mr-head">
      <span class="mr-icon">${icon('music', 26)}</span>
      <div class="mr-title-group">
        <p class="mr-name">${esc(model.name)}</p>
        <div class="mr-meta">${metaItems}</div>
      </div>
    </div>

    <a class="btn btn-primary mr-download" href="${esc(model.downloadUrl)}"
       target="_blank" rel="noopener noreferrer" download>
      ${icon('download', 16)} 下载素材
    </a>

    <p class="mr-link-tip">
      下载链接：<a href="${esc(model.downloadUrl)}" target="_blank" rel="noopener noreferrer">${esc(model.downloadUrl)}</a>
    </p>

    ${model.isMock ? `
    <div class="banner info">
      ${icon('info', 15)} 当前展示的是前端占位数据，后端接口
      <code>/api/music/resolve</code> 接入后将返回真实素材。
    </div>` : ''}
  </div>`;
}

/** 空结果提示 */
export function musicEmptyState(keyword) {
  return `
  <div class="music-empty">
    ${icon('search', 28)}
    <p>未找到与「<b>${esc(keyword)}</b>」匹配的素材</p>
    <p class="muted">请确认名称是否完整，或尝试其它关键词。</p>
  </div>`;
}

/** 加载中占位 */
export function musicLoadingState() {
  return `
  <div class="music-empty">
    <span class="spinner"></span>
    <p class="muted">正在解析素材…</p>
  </div>`;
}
